# Proposal: Form-Fill Pipeline

## Problem
Users need to fill PDF/DOCX forms with personal data, but sharing PII with cloud LLM providers violates the privacy-first guarantee of AILocalMind.

## Solution
A form-fill pipeline that:
1. Parses uploaded forms (PDF, DOCX, MD, TXT)
2. Uses the LLM to analyze form structure only (no PII sent)
3. Fills simple fields locally from a "My Info" profile
4. Uses placeholder/rehydration for reasoning fields (LLM composes with tokens, app replaces locally)
5. Previews in Canvas, exports as original template with values filled

## Privacy Guarantee
The LLM never sees real PII. Simple fields filled entirely locally. Reasoning fields use placeholder tokens rehydrated on-device.

## Inputs
- File attachments via paperclip button, drag-drop, or `/fill` command
- User's structured profile ("My Info") stored encrypted in IndexedDB
- Interactive gap-fill for missing values

## Outputs
- Canvas preview of filled form
- DOCX export preserving original template formatting
- PDF export only for fillable PDFs

## Existing Assets
- `file_parsers.rs` — PDF/DOCX/TXT extraction already working
- `DocumentUploadWidget.tsx` — upload pipeline with PII detection
- GLiNER + anonymization pipeline
- Canvas system for document preview
- ChaCha20-Poly1305 encryption for local storage
