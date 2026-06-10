# Form-Fill Feature — Design Spec

> **Ported from superpowers specs.** Original content below. Review, then
> `/sudd-plan` will generate proper specs/design/tasks from it.

# Form-Fill Feature — Design Spec

## Overview

Users can attach PDF, DOCX, MD, and TXT files to chat conversations. The primary use case is **form filling**: upload a blank form template, and the AI fills it using locally-stored personal data — without ever sending PII to the LLM provider.

## Privacy Guarantee

The LLM never sees real PII. Simple fields (name, address, BSN) are filled entirely locally. Reasoning fields (composed paragraphs) use the existing placeholder/rehydration pattern — the LLM writes with tokens like `[FULL_NAME]`, and the app replaces them locally.

---

## 1. "My Info" Profile

Structured local profile for personal data, encrypted at rest (ChaCha20-Poly1305).

```typescript
interface UserProfile {
  id: string;
  fullName?: string;
  dateOfBirth?: string;
  bsn?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  address?: { street: string; city: string; postalCode: string; country: string };
  employerName?: string;
  employmentType?: 'employed' | 'self-employed' | 'freelancer' | 'retired' | 'student';
  jobTitle?: string;
  incomeBracket?: string;
  bankName?: string;
  iban?: string;
  customFields: Record<string, string>;
}
```

- Stored in IndexedDB (new `userProfile` Dexie table), single encrypted row
- Editable from settings sidebar (`MyInfoPanel` component)
- PII detected from chat can be offered for auto-import (opt-in)
- Custom fields support arbitrary key-value pairs for uncommon form data

---

## 2. File Input

Three input methods, all converging to the same pipeline:

- **Attachment button**: Paperclip icon next to send button. Opens Tauri `open()` dialog filtered to `.pdf, .docx, .doc, .md, .txt`.
- **Drag & drop**: Drop zone on chat area with visual overlay.
- **`/fill` command**: Opens file dialog. Supports optional context message (e.g., `/fill this is for the Keizersgracht apartment`).

After file selection:
1. File parsed via existing `parse_document` Tauri command (`file_parsers.rs`)
2. User message with attachment added to chat (filename, type badge, size, preview snippet)
3. User chooses: **"Send as context"** (text appended to conversation) or **"Fill this form"** (triggers form-fill pipeline)

### FileAttachment type

```typescript
interface FileAttachment {
  id: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'doc' | 'md' | 'txt';
  filePath: string;
  fileSize: number;
  textContent: string;
  structure: DocumentStructure;
  isFormFill?: boolean;
}
```

---

## 3. Form-Fill Pipeline

### Step 1 — Field Extraction (LLM, no PII)

Send only the blank form structure to the LLM. System prompt asks it to return a JSON array:

```json
[
  { "label": "Full Name", "category": "full_name", "type": "simple" },
  { "label": "Address", "category": "address", "type": "simple" },
  { "label": "Reason for application", "category": "custom", "type": "reasoning", "hint": "Explain why you are applying" }
]
```

The LLM sees the template text only — no personal data.

### Step 2 — Local Profile Matching

App matches each field's `category` to `UserProfile` properties:
- `full_name` → `profile.fullName`
- `address` → `profile.address` (formatted)
- `iban` → `profile.iban`
- etc.

Unmatched fields flagged as gaps.

### Step 3 — Interactive Gap-Fill

For each missing field, the assistant asks in chat:
> "The form asks for **Reason for application**. What should I write here?"

User answers. Optionally saves to `profile.customFields` for reuse.

### Step 4 — Reasoning Fields (LLM, with placeholders)

For `type: "reasoning"` fields, the LLM composes text using placeholder tokens:
> "Write a paragraph for 'Reason for application'. The applicant is a [EMPLOYMENT_TYPE] working as [JOB_TITLE]."

App rehydrates placeholders locally with real values.

### Step 5 — Assembly

All filled values combined into `{ field_label → filled_value }` map. Pipeline status set to `reviewing`.

---

## 4. Canvas Preview & Export

### Canvas Preview

- DOCX input: faithful visual approximation preserving section headings, field labels, layout order. Filled values highlighted inline.
- Non-DOCX input: clean structured view of fields and values.
- Inline editing — click any filled value to correct before export.

### Export: DOCX

- **DOCX input**: Opens the **original template file**, injects values into the XML. Output is the exact template with fields populated — formatting, logos, tables, styles preserved. The template is treated as a read-only mold.
- **Non-DOCX input**: Generates a new clean DOCX from the field map.

### Export: PDF

- **Fillable PDF input**: Writes values into existing PDF form fields, preserving layout.
- **Non-fillable PDF / other inputs**: Not offered. User gets DOCX.

---

## 5. Database Schema

### New table: `formFills`

```typescript
interface FormFill {
  id: string;
  conversationId: string;
  messageId: string;
  templatePath: string;
  templateFilename: string;
  fileType: 'pdf' | 'docx' | 'doc' | 'md' | 'txt';
  fieldMap: FormField[];
  status: 'extracting' | 'filling' | 'reviewing' | 'complete';
  canvasDocId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FormField {
  label: string;
  category: string;
  type: 'simple' | 'reasoning';
  value?: string;
  source: 'profile' | 'user-input' | 'llm-composed';
  placeholder?: string;
}
```

### New table: `userProfile`

Single encrypted row holding `UserProfile`.

### Modified: `Message`

Add optional `attachments: FileAttachment[]` field.

No changes to existing conversations, canvas documents, or privacy pipeline tables.

---

## 6. UI Components

### New

| Component | Purpose |
|-----------|---------|
| `AttachmentButton` | Paperclip icon next to send button, opens file dialog |
| `AttachmentPreview` | In chat input area after file selection. Shows filename, type, size. Actions: "Send as context" / "Fill this form". Removable. |
| `FormFillProgress` | Assistant message showing pipeline steps with progress checkmarks |
| `GapFillPrompt` | Chat prompt for missing fields. Input + "Save to My Info" checkbox |
| `FormFillCanvas` | Canvas extension for form-fill mode. DOCX-faithful preview + export buttons |
| `MyInfoPanel` | Settings sidebar panel. Structured profile form. Grouped sections. Encryption badge. |

### Modified

| Component | Change |
|-----------|--------|
| `ChatWindow.tsx` | Drag-drop zone, attachment button, `/fill` command parsing |
| `MessageBubble.tsx` | Render attachment cards on user messages |
| `CanvasPanel.tsx` | Support form-fill mode alongside existing document mode |

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Unparseable file (corrupted, password-protected, scanned image) | Error in chat with reason + suggestion |
| No fillable fields found | Offer to attach as context instead |
| Missing profile data | Ask sequentially in chat, allow skipping |
| LLM unavailable | Prompt user to set up backend first |
| Large document (>50 pages / 100K chars) | Warn if truncated |
| DOCX XML patching fails | Fall back to new DOCX, warn user |

---

## 8. Phased Delivery

**Phase 1 (this spec)**: Generic business forms — contracts, applications, intake forms.

**Phase 2 (future)**: Government/tax forms — Dutch Belastingdienst, fixed-field PDFs, coordinate-based layouts. Builds on existing tax knowledge base.

