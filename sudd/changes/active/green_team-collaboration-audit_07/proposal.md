# Proposal: Implement Team Collaboration Advanced Features (Audit Trail, Export, Key Control)

**ID:** green_team-collaboration-audit_07  
**Title:** Add audit trail, chat export/import, and company-controlled encryption for team data  
**Size:** L (large)  
**Persona:** Aisha (primary)  
**Priority:** 2  

## Why

This is the second part of GAP005 closure. After basic team collaboration ships (green_team-collaboration-basic_06), Aisha needs advanced features to fully own her team's data:

1. **Export/Import:** Build a searchable, encrypted internal knowledge base... Export chat history as encrypted PDF or encrypted database"
2. **Audit Trail:** "She needs to know who accessed what, when" (for legal review and compliance)
3. **Encryption Key Control:** "She wants her chat database to live in her company's file system, encrypted with keys that only her company controls"

These features directly unblock Aisha's objective: "Build a searchable, encrypted internal knowledge base of legal Q&A specific to her startup's stage and geography... Set up a shared local copy of the Sovereign AI chat database on her company's internal server."

Without export/import and key control, Aisha is still dependent on Sovereign AI's infrastructure (even if local). With these features, she owns her data completely.

## Current State

- **No export functionality** — Chats are stored in IndexedDB + SQLite; no portable export format
- **No import functionality** — Cannot restore exported chats or migrate between machines
- **No audit trail** — No log of who accessed what, when
- **System-managed encryption** — ChaCha20 keys are generated and managed by app; no team key option
- **No encrypted backup format** — Cannot export as encrypted PDF or database

## Desired State

1. **Chat Export:**
   - Export format: Encrypted JSON (default) or Encrypted PDF (for legal review)
   - Scope: All chats, filtered by date range, or individual chat
   - Encryption: User provides password or uses company master key
   - Output: `sovereign-ai-export-[date].json.encrypted` or PDF
   - Includes metadata: Chat date, personas used, redaction status

2. **Chat Import:**
   - User can import previously exported chats
   - Merge with existing chat history (no duplicates)
   - Restore to same user or different team member
   - Encrypted import: Password or master key

3. **Audit Trail:**
   - Log all team access: (user, chat_id, action, timestamp)
   - Actions: read, append, edit, delete, share, export
   - UI: Settings → Team → Audit Log
   - Export audit log as CSV for compliance

4. **Encryption Key Management:**
   - Option: "Use company-controlled encryption key"
   - Team admin sets master key (passphrase or file-based)
   - All new chats use master key instead of system-generated keys
   - Existing chats can be re-encrypted with master key (manual migration)

5. **Database Portability:**
   - Allow export of entire chat database (encrypted)
   - Can set up local copy on company server
   - Other machines can import and sync

## Acceptance Criteria

1. **Export works** — User exports chats as JSON or PDF; file is encrypted and portable
2. **Import works** — User imports exported chats; they appear in chat list with original metadata
3. **Audit trail is logged** — All team actions logged; Settings → Team → Audit Log shows history
4. **Audit export works** — User exports audit log as CSV for compliance/legal review
5. **Master key option is available** — Admin can set company-controlled encryption key
6. **Chats use master key** — New chats after master key setup are encrypted with it
7. **Re-encryption works** — Admin can re-encrypt existing chats with master key
8. **No data loss** — Export/import preserves all chat metadata, redaction status, messages
9. **Aisha can showcase compliance** — She exports audit log and encrypted backups; her lawyer verifies "no data leaks"

## Dependencies

- Depends on: green_team-collaboration-basic_06 (multi-user, shared chats)
- Unblocks: None immediate, but enables Aisha's full use case

## Effort Justification

**L (Large) — 3–4 weeks (15–20 business days)**

**Complexity breakdown:**

1. **Chat export logic:** (3–4 days)
   - Serialize chat data (all messages, metadata, redaction info)
   - Encrypt with user-provided password or master key (ChaCha20-Poly1305)
   - JSON format: structured, easy to parse
   - PDF export: use library (e.g., jsPDF); format chats as readable document
   - Handle large exports (pagination, streaming)

2. **Chat import logic:** (3–4 days)
   - Decrypt import file
   - Parse JSON schema (validate structure)
   - Merge with existing chats (detect duplicates via hash)
   - Store in IndexedDB/SQLite with new IDs
   - Handle conflicts: user chooses skip/overwrite/merge

3. **Audit trail system:** (3–4 days)
   - Add audit log table: (user_id, chat_id, action, timestamp)
   - Instrument all chat operations: read, write, delete, share
   - Filter and query audit log
   - CSV export for compliance

4. **Encryption key management:** (3–4 days)
   - Key derivation: PBKDF2 from master passphrase
   - Master key storage: encrypted in SQLite (user-provided password)
   - Re-encryption pipeline: read old chats, decrypt with old key, re-encrypt with new key
   - Key rotation support (post-v1)

5. **UI components:** (2–3 days)
   - Export modal: choose format, date range, encryption method
   - Import dialog: file picker, password entry, merge options
   - Audit log viewer: table of actions, filters, CSV export
   - Key management: Settings → Team → Encryption panel

6. **Testing & QA:** (3–4 days)
   - Export then import round-trip: data integrity
   - Large export handling (10k+ messages)
   - Encryption verification (exported files are unreadable without key)
   - Audit log completeness: all actions logged
   - Master key re-encryption: verify all chats re-encrypted

**Why it's L and not M:**
- Cryptographic operations (encryption, key derivation) are high-risk
- Data integrity is critical (audit trail must be tamper-proof)
- Complex state machine: export, import, re-encryption all interact
- Testing surface is large (encryption round-trips, audit log verification)

**Why it's not XL:**
- Encryption library (ChaCha20) is well-proven
- Export format is simple JSON
- No distributed systems complexity (local-only)

## Alignment Gap

**Reference:** GAP005 (Team Collaboration & Export Features Expected by Aisha, Not Shipped)

**Report excerpt:**
> "She needs to: 1. Export chats for legal review (not possible). 2. Share with co-founder securely (addressed in green_team-collaboration-basic_06). 3. Control encryption keys (not possible; keys are system-managed)."

This proposal closes the export and key control gaps.

## Design Decisions

1. **Master key is optional:** Default: system-managed keys; opt-in to company-controlled master key (backward compatible)
2. **Encryption is transparent:** User doesn't see cryptography details; just "export with password" and "import"
3. **Audit trail is immutable:** Logs are stored separately and cannot be edited (only read/export)
4. **PDF export is human-readable:** For legal review; JSON export is machine-readable (for migration)

## UX Considerations

- **Aisha's mental model:** "I can extract my company's data at any time, in any format, encrypted with keys only we control"
- **Legal use case:** She exports a chat chain for lawyer review; lawyer sees redacted prompts and AI advice without seeing raw PII
- **Compliance:** She exports audit log for SOC 2 or ISO 27001 audit; shows exactly who accessed what

## Security Considerations

- **Encryption:** ChaCha20-Poly1305 is AEAD (authenticated encryption); prevents tampering
- **Master key derivation:** PBKDF2-SHA256 with salt and iterations (prevent brute-force)
- **Export file handling:** Clear sensitive data from memory after export (no temp files)
- **Audit trail:** Log is signed (HMAC-SHA256) to prevent tampering

## Future Enhancement (Post-v1)

- Key rotation: Re-encrypt all chats with new master key on schedule
- Encrypted sync: Sync encrypted chats across machines using company's key
- Compliance integrations: SOC 2 audit logging, GDPR data subject access requests
- Backup scheduling: Auto-export encrypted backups on schedule

## Success Metric (Aisha)

Within 3 months after this ships, Aisha:
1. Exports her legal Q&A chats as encrypted PDF and provides to lawyer
2. Lawyer confirms "all PII is redacted; this is work product"
3. Aisha sets up company-controlled encryption key and re-encrypts all chats
4. She exports full encrypted database and stores on company server
5. Success: "I own my data completely. I could leave Sovereign AI at any time and take everything with me."
