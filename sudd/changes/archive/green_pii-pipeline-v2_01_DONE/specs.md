# Specs: PII Pipeline V2

## FR1: Deduplication in addCustomRedactTerm
- Check existing terms by value (case-insensitive) before adding
- If duplicate found, skip silently (no error)
- Apply to both `addCustomRedactTerm` and bulk import paths

## FR2: PII Vault Routing on Document Import
- When importing PII from documents (DynamicPiiDialog), map known fields to PII vault via `setPIIValue`:
  - name, surname, bsn, email, phone, address, iban, income → PII vault
- For single-record docs: populate PII vault AND custom redaction
- For multi-record docs: only custom redaction (can't pick one person as profile)
- Privacy Shield counter should reflect actual PII vault entries (not always 0)

## FR3: Full-Pipeline Anonymization
- Apply GLiNER + custom redaction to ALL cloud-bound content, not just the current message:
  - Conversation history messages
  - Active context documents
  - Canvas/project documents
  - Memories (from Mem0)
- Apply redaction in `executePrivacySend` before building the messages array
- Use consistent placeholders so the LLM sees a coherent anonymized conversation

## FR4: Auto-Redact Setting
- New setting: `autoRedactAllContent` (boolean, default: true)
- In Settings > Privacy: toggle "Auto-redact all cloud-bound content"
- When ON: full-pipeline anonymization (FR3)
- When OFF: only current message redacted (legacy behavior)

## FR5: Pre-Send PII Report
- In hybrid mode review panel, show PII found across ALL content
- Count by category: "3 names, 2 BSNs, 1 email found in history + context"
- User can review before approving the send
