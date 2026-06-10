# Design: Form-Fill Pipeline

## Architecture

```
User attaches file → file_parsers.rs extracts text
                   → LLM analyzes structure (no PII) → field map JSON
                   → Profile matching (local) → fill simple fields
                   → Gap-fill chat (interactive) → collect missing values
                   → LLM composes reasoning fields (placeholders only)
                   → rehydration.rs fills placeholders locally
                   → Canvas preview → user reviews/edits
                   → Export: patch original DOCX XML or generate new DOCX
```

## Component Design

### Rust Backend

#### New: `form_fill.rs`
- `FormFieldExtraction` — struct for LLM-returned field analysis
- `extract_form_fields(text: &str) -> Vec<FormField>` — prompt LLM with blank form, parse JSON response
- `match_profile_fields(fields: &[FormField], profile: &UserProfile) -> FieldMatchResult` — local matching
- `compose_reasoning_field(field: &FormField, attributes: &TaxAttributes) -> String` — LLM with placeholders

#### New: `form_export.rs`
- `fill_docx_template(template_path: &str, field_values: &HashMap<String, String>) -> Result<Vec<u8>>` — opens DOCX as ZIP, parses word/document.xml, finds field labels in XML paragraphs, injects values after them, returns modified DOCX bytes
- `fill_pdf_form(pdf_path: &str, field_values: &HashMap<String, String>) -> Result<Vec<u8>>` — for fillable PDFs only, writes to form field annotations
- `generate_docx(title: &str, fields: &[(String, String)]) -> Result<Vec<u8>>` — creates new clean DOCX

#### New: `form_fill_commands.rs`
- `#[tauri::command] extract_form_fields(text: String, state: State<InferenceState>) -> Result<Vec<FormField>>`
- `#[tauri::command] export_filled_docx(template_path: String, field_values: HashMap<String, String>) -> Result<Vec<u8>>`
- `#[tauri::command] export_filled_pdf(pdf_path: String, field_values: HashMap<String, String>) -> Result<Vec<u8>>`
- `#[tauri::command] generate_new_docx(title: String, fields: Vec<(String, String)>) -> Result<Vec<u8>>`

#### Extended: `rehydration.rs`
- Add `rehydrate_form_field(template: &str, profile: &PIIValues) -> RehydrationResult` — reuses existing placeholder logic for reasoning field output

#### New: `user_profile.rs`
- `UserProfile` struct (Rust-side, for encrypted storage)
- `save_profile(profile: &UserProfile, key_manager: &EncryptionKeyManager) -> Result<()>`
- `load_profile(key_manager: &EncryptionKeyManager) -> Result<UserProfile>`
- Stored in app data dir as encrypted binary file (same pattern as PII vault)

### React Frontend

#### New: `src/stores/formFill.ts`
- Zustand store for form-fill pipeline state
- Tracks: current form, field map, fill status, gaps, assembled values
- Actions: `startFormFill()`, `updateFieldValue()`, `markComplete()`

#### New: `src/stores/userProfile.ts`
- Zustand store for My Info profile
- Syncs with Rust backend (encrypted storage)
- Actions: `loadProfile()`, `updateField()`, `addCustomField()`, `importFromPII()`

#### New: `src/components/chat/AttachmentButton.tsx`
- Paperclip icon button, opens Tauri file dialog
- Filtered to: .pdf, .docx, .doc, .md, .txt

#### New: `src/components/chat/AttachmentPreview.tsx`
- Inline card in chat input showing: filename, type badge (PDF/DOCX/etc), file size
- Two buttons: "Send as context" / "Fill this form"
- X button to remove

#### New: `src/components/chat/FormFillProgress.tsx`
- Progress card in assistant message area
- Steps: Parsing → Extracting fields → Matching profile → Filling gaps → Composing → Done
- Checkmarks on completed steps

#### New: `src/components/chat/GapFillPrompt.tsx`
- Chat message for collecting missing values
- Shows field label, what the form expects
- Text input + "Save to My Info" checkbox

#### New: `src/components/settings/MyInfoPanel.tsx`
- Settings panel for managing UserProfile
- Grouped sections: Identity, Contact, Employment, Financial, Custom
- Encryption badge
- Import from detected PII button

#### Modified: `src/components/chat/ChatWindow.tsx`
- Add AttachmentButton next to send button
- Add drag-drop zone with overlay
- Parse `/fill` command
- Handle form-fill pipeline orchestration

#### Modified: `src/components/chat/MessageBubble.tsx`
- Render FileAttachment cards on user messages

#### Modified: `src/components/chat/CanvasPanel.tsx`
- Form-fill preview mode: render filled form with highlighted values
- Export buttons: "Download DOCX", "Download PDF" (conditional)

#### Modified: `src/lib/db.ts`
- Add `formFills` table
- Add `userProfile` table
- Extend `LocalMessage` with optional `attachments`

#### Modified: `src/types/index.ts`
- Add `FileAttachment`, `FormField`, `FormFill`, `UserProfile` types

## Data Flow

### Simple Field (e.g., "Full Name")
```
Form text → LLM: "field: Full Name, category: full_name, type: simple"
         → App looks up profile.fullName locally
         → Value injected into field map
         → Never touches LLM
```

### Reasoning Field (e.g., "Describe your employment situation")
```
Form text → LLM: "field: Employment description, category: custom, type: reasoning"
         → App builds prompt: "Write for [EMPLOYMENT_TYPE] as [JOB_TITLE] at [EMPLOYER_NAME]"
         → LLM returns: "The applicant is a [EMPLOYMENT_TYPE] working as [JOB_TITLE]..."
         → rehydration.rs replaces: "The applicant is a freelancer working as software engineer..."
         → Rehydrated text injected into field map
```

### DOCX Export
```
Original DOCX (ZIP) → extract word/document.xml
                    → parse XML paragraphs
                    → find text matching field labels
                    → inject values after/replacing placeholder text
                    → repackage ZIP → save as new DOCX
```

## Acceptance Criteria

1. User can attach PDF/DOCX/TXT via button, drag-drop, or `/fill` command
2. LLM extracts form fields without receiving any PII
3. Simple fields auto-filled from My Info profile
4. Missing values collected via chat interaction
5. Reasoning fields composed with placeholders, rehydrated locally
6. Filled form previewed in Canvas with highlighted values
7. DOCX export preserves original template formatting
8. All profile data encrypted at rest
9. Pipeline works in local, hybrid, and cloud privacy modes
