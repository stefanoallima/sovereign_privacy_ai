# Tasks: Form-Fill Pipeline

## T01: Types & Database Schema
- **Effort**: S
- **Dependencies**: none
- **Files**: src/types/index.ts, src/lib/db.ts
- **SharedFiles**: src/types/index.ts
- **Description**: Add FileAttachment, FormField, FormFill, UserProfile types to index.ts. Add formFills and userProfile tables to Dexie db.ts. Add optional attachments field to LocalMessage.
- [x] Add types to src/types/index.ts
- [x] Add tables to src/lib/db.ts
- [x] Add attachments to LocalMessage

## T02: Rust UserProfile Storage
- **Effort**: S
- **Dependencies**: none
- **Files**: src-tauri/src/user_profile.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: Create user_profile.rs with UserProfile struct, save/load with ChaCha20-Poly1305 encryption. Register Tauri commands: save_user_profile, load_user_profile. Wire into lib.rs state.
- [x] Create user_profile.rs with struct + encrypt/decrypt
- [x] Add Tauri commands
- [x] Register in lib.rs

## T03: Rust Form Field Extraction
- **Effort**: M
- **Dependencies**: none
- **Files**: src-tauri/src/form_fill.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: Create form_fill.rs. Build LLM prompt that sends only blank form text and asks for JSON field array. Parse LLM response into Vec<FormField>. Add extract_form_fields Tauri command. Wire into lib.rs.
- [x] Create form_fill.rs with extraction logic
- [x] Build system prompt for field extraction
- [x] Parse JSON response
- [x] Add Tauri command
- [x] Register in lib.rs

## T04: Rust Form Export (DOCX)
- **Effort**: M
- **Dependencies**: none
- **Files**: src-tauri/src/form_export.rs, src-tauri/src/lib.rs, src-tauri/Cargo.toml
- **SharedFiles**: src-tauri/src/lib.rs, src-tauri/Cargo.toml
- **Description**: Create form_export.rs. Implement fill_docx_template: open DOCX as ZIP, parse word/document.xml, locate field labels in XML, inject values. Implement generate_docx for non-DOCX inputs. Add Tauri commands. Add any needed crate deps.
- [x] Create form_export.rs
- [x] Implement DOCX template filling (ZIP + XML manipulation)
- [x] Implement new DOCX generation
- [x] Add Tauri commands
- [x] Update Cargo.toml if needed (not needed — zip v2 has write support)

## T05: UserProfile Store & MyInfoPanel
- **Effort**: M
- **Dependencies**: T01, T02
- **Files**: src/stores/userProfile.ts, src/components/settings/MyInfoPanel.tsx
- **SharedFiles**: none
- **Description**: Create Zustand store syncing with Rust backend. Build MyInfoPanel component: grouped sections (Identity, Contact, Employment, Financial, Custom), encryption badge, import-from-PII button. Add to settings sidebar.
- [x] Create userProfile.ts store
- [x] Build MyInfoPanel component
- [x] Wire into settings sidebar (added to SettingsDialog.tsx as "My Info" tab)

## T06: Attachment Button & Drag-Drop
- **Effort**: M
- **Dependencies**: T01
- **Files**: src/components/chat/AttachmentButton.tsx, src/components/chat/AttachmentPreview.tsx, src/components/chat/ChatWindow.tsx
- **SharedFiles**: src/components/chat/ChatWindow.tsx
- **Description**: Create AttachmentButton (paperclip icon, Tauri file dialog). Create AttachmentPreview (filename, type badge, size, "Send as context"/"Fill this form" buttons). Add drag-drop zone to ChatWindow. Parse /fill command. Add attachment to user message on send.
- [x] Create AttachmentButton component
- [x] Create AttachmentPreview component
- [x] Add drag-drop to ChatWindow
- [x] Parse /fill command
- [x] Attach files to messages

## T07: FormFill Store & Pipeline Orchestration
- **Effort**: L
- **Dependencies**: T01, T03, T05
- **Files**: src/stores/formFill.ts, src/hooks/useFormFill.ts
- **SharedFiles**: none
- **Description**: Create formFill Zustand store tracking pipeline state. Create useFormFill hook orchestrating: parse file → extract fields (Tauri) → match profile → identify gaps → collect via chat → compose reasoning fields → assemble. Integrates with usePrivacyChat for LLM calls.
- [x] Create formFill.ts store
- [x] Create useFormFill.ts hook
- [x] Implement pipeline steps 1-5
- [x] Integration with privacy chat for reasoning fields

## T08: FormFill UI (Progress, GapFill, MessageBubble)
- **Effort**: M
- **Dependencies**: T06, T07
- **Files**: src/components/chat/FormFillProgress.tsx, src/components/chat/GapFillPrompt.tsx, src/components/chat/MessageBubble.tsx
- **SharedFiles**: src/components/chat/MessageBubble.tsx
- **Description**: Create FormFillProgress (pipeline step indicators). Create GapFillPrompt (field input + save checkbox). Extend MessageBubble to render attachment cards on user messages.
- [x] Create FormFillProgress component
- [x] Create GapFillPrompt component
- [x] Extend MessageBubble for attachments

## T09: Canvas Form Preview & Export UI
- **Effort**: M
- **Dependencies**: T04, T07
- **Files**: src/components/chat/CanvasPanel.tsx, src/components/chat/FormFillCanvas.tsx
- **SharedFiles**: src/components/chat/CanvasPanel.tsx
- **Description**: Create FormFillCanvas mode in CanvasPanel. Render filled form preserving original structure. Highlight filled values. Inline editing. Export buttons: "Download DOCX" (always), "Download PDF" (fillable PDF only). Call Rust export commands via Tauri.
- [x] Create FormFillCanvas component
- [x] Integrate into CanvasPanel
- [x] Wire export buttons to Rust commands
- [x] Implement Tauri save dialog for downloads

## T10: Integration Tests
- **Effort**: M
- **Dependencies**: T02, T03, T04
- **Files**: src-tauri/src/form_fill.rs, src-tauri/src/form_export.rs, src-tauri/src/user_profile.rs
- **SharedFiles**: none
- **Description**: Write Rust tests: user profile encrypt/decrypt round-trip, form field extraction prompt building, DOCX template filling (create test DOCX, fill, verify XML), new DOCX generation.
- [x] Profile storage tests (6 tests passing)
- [x] Field extraction tests (19 tests passing)
- [x] DOCX fill tests (10 tests passing)
- [x] DOCX generation tests (included above)

## Dependency Graph
```
T01 ─┬─→ T05 (needs types + Rust profile) ─→ T07 (needs profile store)
     │                                          ↓
T02 ─┘                                        T08 (needs pipeline)
                                                ↓
T03 ────────────────────────────────────→ T07   T09 (needs pipeline + export)
                                                 ↑
T04 ────────────────────────────────────────────┘

T06 (needs types) ──────────────────────→ T08

T10 (needs T02, T03, T04)

Batch 1: T01, T02, T03, T04 (independent)
Batch 2: T05, T06, T10 (depend on batch 1)
Batch 3: T07 (depends on T01, T03, T05)
Batch 4: T08, T09 (depend on T07)
```
