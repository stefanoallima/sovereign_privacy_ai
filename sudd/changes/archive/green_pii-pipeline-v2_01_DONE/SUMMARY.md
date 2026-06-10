# Summary: green_pii-pipeline-v2_01

## What Changed
Closed critical PII-pipeline gaps:
- **Dedup on import** — `addCustomRedactTerm` rejects case-insensitive duplicates (`userContext.ts:351-355`, `:412-413`).
- **PII vault routing** — document import maps known fields (Name/BSN/Email) into the PII vault AND custom redaction (`DocumentUploadWidget.tsx:181-209`).
- **Full-pipeline anonymization** — history, context docs, memories, KB chunks, and canvas docs all run through `maybeRedact` before cloud send and are rehydrated on response (`usePrivacyChat.ts:1240`, `:1162`, `:1333`).
- **User control** — "Auto-redact all cloud-bound content" setting, default ON (`settings.ts:138`, `types/index.ts:67`); pre-send review reports PII across all content (`usePrivacyChat.ts:1513-1683` → PromptReviewPanel).

Residual hardening (T06 dead leaky path, T07 asymmetric GLiNER coverage, T08 per-message IPC batch) was split out to **green_pii-pipeline-v3_01**, which shipped and archived the same day.

## Why
In hybrid mode only the current message was anonymized — history/context/memories/canvas went to the cloud in plaintext, so a BSN mentioned earlier leaked on the next send. Imports also created duplicate terms and never populated the PII vault (counter stuck at 0).

## Validation
- 29/29 tasks complete: T01–T05 verified in the live send path; T06–T08 satisfied via the shipped+archived `green_pii-pipeline-v3_01` (its lesson explicitly records dead-leaky-path / GLiNER-coverage / batch-IPC as closed).
- Local-only and direct-cloud no-regression checks reconciled; live runtime regression smoke needs the full GPU build (manual follow-up).

## Lessons
When residual hardening is carved into a successor change, archive the parent against the successor's shipped evidence — after confirming each carved item actually closed. See `sudd/memory/lessons.md` → green_pii-pipeline-v2_01.
