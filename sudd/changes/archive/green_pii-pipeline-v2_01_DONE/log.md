# Log: green_pii-pipeline-v2_01

## 2026-03-29 — Proposal Created
- Investigated full privacy pipeline across 15+ files
- Found 4 critical issues: no dedup, wrong PII routing, asymmetric anonymization, no user control
- Key finding: only current message is anonymized, all context/history/memories sent in plaintext to cloud
- Next: /sudd:plan or /sudd:run to implement
