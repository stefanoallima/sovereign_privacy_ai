# Specs: Form-Fill Pipeline

## Consumer
Stefano — privacy-conscious user who needs to fill government and business forms without sharing PII with cloud LLM providers.

## Functional Requirements

### FR1: File Attachment in Chat
- Paperclip button next to send button in ChatWindow
- Drag-and-drop zone on chat area with visual overlay
- `/fill` slash command opens file dialog with optional context message
- Supported formats: PDF, DOCX, DOC, MD, TXT
- After selection: show attachment preview card (filename, type badge, size)
- Two actions: "Send as context" (appends text to conversation) or "Fill this form" (triggers pipeline)

### FR2: "My Info" Profile
- Structured profile extending existing PIIProfileCard
- Fields: fullName, dateOfBirth, bsn, nationality, email, phone, address (street/city/postalCode/country), employerName, employmentType, jobTitle, incomeBracket, bankName, iban
- Custom fields: arbitrary key-value pairs for uncommon form data
- Stored encrypted in IndexedDB (ChaCha20-Poly1305 via existing crypto.rs)
- Auto-import from PII detected in conversations (opt-in)
- Accessible from settings sidebar as "MyInfoPanel"

### FR3: Form-Fill Pipeline
- **Step 1 — Field Extraction**: LLM receives only blank form text. Returns JSON array of fields: `{ label, category, type: "simple"|"reasoning", hint? }`
- **Step 2 — Profile Matching**: App maps each field's `category` to UserProfile properties locally
- **Step 3 — Gap-Fill**: For missing values, assistant asks user in chat one at a time. Optional "Save to My Info" checkbox.
- **Step 4 — Reasoning Fields**: LLM composes text using placeholder tokens (e.g., `[EMPLOYMENT_TYPE]`). App rehydrates locally using existing rehydration.rs pattern.
- **Step 5 — Assembly**: All values combined into `{ field_label → filled_value }` map.

### FR4: Canvas Preview
- Filled form rendered in CanvasPanel preserving original structure (headings, sections, field order)
- For DOCX input: faithful visual approximation of the template layout
- Filled values highlighted inline for review
- Inline editing — click any value to correct before export

### FR5: Export
- **DOCX input → DOCX output**: Opens original template XML, injects values at field positions. Preserves formatting, logos, tables, styles. Template is read-only mold.
- **Non-DOCX input → DOCX output**: Generates new clean DOCX from field map.
- **Fillable PDF input → PDF output**: Writes into existing form fields. Preserves layout.
- **Non-fillable PDF → DOCX only**: No PDF generation for flat/scanned PDFs.

### FR6: Persistence
- `formFills` table: tracks pipeline state per form (extracting → filling → reviewing → complete)
- `userProfile` table: single encrypted row with UserProfile data
- Messages gain optional `attachments: FileAttachment[]` field

## Non-Functional Requirements

### Privacy
- LLM never receives real PII values
- Simple fields filled entirely on-device
- Reasoning fields use existing placeholder/rehydration pattern
- Profile data encrypted at rest
- Works in all three privacy modes (local, hybrid, cloud)

### Performance
- File parsing < 3s for documents up to 50 pages
- Field extraction LLM call < 10s
- Local profile matching instant
- Export < 5s

## Existing Code to Reuse
- `file_parsers.rs` — PDF/DOCX/TXT parsing (ParsedDocument, DocumentStructure)
- `rehydration.rs` — PIIValues, placeholder constants, rehydrate_template(), build_template_prompt()
- `anonymization.rs` — PiiMapping pattern, validation
- `crypto.rs` — ChaCha20-Poly1305 encryption for profile storage
- `attribute_extraction.rs` — categorical attribute pattern for reasoning context
- `DocumentUploadWidget.tsx` — upload pipeline UI pattern
- `PIIProfileCard.tsx` — profile display/edit pattern
- `CanvasPanel.tsx` — document preview/edit
- `ChatWindow.tsx` — message input area (attachment button insertion point)
