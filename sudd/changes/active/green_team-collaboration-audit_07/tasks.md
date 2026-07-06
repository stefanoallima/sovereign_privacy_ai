# Tasks: Team Collaboration Advanced (Audit Trail, Export, Key Control)

## Phase 1: Foundation (Encryption & Database)

- [ ] **T01: Create encryption service with ChaCha20-Poly1305**
  - Effort: M
  - Files: `apps/desktop/src/lib/encryption.ts`
  - Dependencies: None
  - Description: Implement core encrypt/decrypt functions using Web Crypto API. Include unit tests for round-trip encryption and authentication tag verification.

- [ ] **T02: Implement PBKDF2 key derivation**
  - Effort: S
  - Files: `apps/desktop/src/lib/encryption.ts`
  - Dependencies: [T01]
  - Description: Add key derivation with salt generation and OWASP-compliant iteration count (100,000). Expose salt for storage.

- [ ] **T03: Add database version 5 migration for audit logs**
  - Effort: S
  - Files: `apps/desktop/src/lib/db.ts`
  - Dependencies: None
  - Description: Create auditLogs table with proper indexes on userId, timestamp, chatId. Add TypeScript interface `LocalAuditLog`.

- [ ] **T04: Add database version 5 migration for encryption keys**
  - Effort: S
  - Files: `apps/desktop/src/lib/db.ts`
  - Dependencies: [T03]
  - Description: Create encryptionKeys table for storing master key metadata. Add TypeScript interface `LocalEncryptionKey`.

- [ ] **T05: Add DbOps helpers for audit logs**
  - Effort: S
  - Files: `apps/desktop/src/lib/db.ts`
  - Dependencies: [T03]
  - Description: Implement `auditDbOps.createAuditEntry()`, `queryByUser()`, `queryByChat()`, `queryByAction()` with proper typing.

- [ ] **T06: Add DbOps helpers for encryption keys**
  - Effort: S
  - Files: `apps/desktop/src/lib/db.ts`
  - Dependencies: [T04]
  - Description: Implement `keyDbOps.saveMasterKey()`, `getMasterKey()`, `deleteMasterKey()` with atomic transactions.

## Phase 2: Audit System (Non-Blocking)

- [ ] **T07: Create audit logger service**
  - Effort: M
  - Files: `apps/desktop/src/services/audit-logger.ts`
  - Dependencies: [T03, T05, T01]
  - Description: Implement AuditLogger class with `logAction()` method. Include HMAC-SHA256 signature generation. Add rate-limiting to prevent spam.

- [ ] **T08: Instrument chat service for audit logging**
  - Effort: M
  - Files: `apps/desktop/src/stores/chat.ts`, `apps/desktop/src/services/audit-logger.ts`
  - Dependencies: [T07]
  - Description: Add audit log calls in createConversation, addMessage, deleteConversation, approveMessage. Capture user context from auth store.

- [ ] **T09: Create audit log viewer component**
  - Effort: M
  - Files: `apps/desktop/src/components/team/AuditLogViewer.tsx`
  - Dependencies: [T07, T08]
  - Description: Build table component with filtering (user, action, date range), sorting, and pagination. Show message preview on hover.

- [ ] **T10: Implement CSV export for audit logs**
  - Effort: S
  - Files: `apps/desktop/src/services/audit-logger.ts`
  - Dependencies: [T07, T09]
  - Description: Add `exportAsCSV()` method. Include headers: User, Chat ID, Action, Timestamp, Metadata. Format dates in ISO8601.

- [ ] **T11: Add audit log settings panel to Settings**
  - Effort: S
  - Files: `apps/desktop/src/components/settings/SettingsDialog.tsx`, `apps/desktop/src/components/team/AuditLogViewer.tsx`
  - Dependencies: [T09, T10]
  - Description: Add "Team > Audit Log" tab to settings. Link to viewer and export button. Show audit log status (enabled/disabled).

## Phase 3: Key Management

- [ ] **T12: Create key manager service**
  - Effort: M
  - Files: `apps/desktop/src/services/key-manager.ts`
  - Dependencies: [T02, T04, T06]
  - Description: Implement KeyManager class with `generateMasterKey()`, `deriveMasterKey()`, `validateMasterKey()`. Include secure key storage.

- [ ] **T13: Implement master key setup UI modal**
  - Effort: M
  - Files: `apps/desktop/src/components/team/EncryptionSettings.tsx`
  - Dependencies: [T12]
  - Description: Create modal for entering master key passphrase. Show strength indicator, confirmation, and warning about security implications.

- [ ] **T14: Add master key status to settings**
  - Effort: S
  - Files: `apps/desktop/src/components/settings/SettingsDialog.tsx`, `apps/desktop/src/components/team/EncryptionSettings.tsx`
  - Dependencies: [T13]
  - Description: Add "Team > Encryption" tab. Show master key status (enabled/disabled), key creation date, and re-encryption button.

- [ ] **T15: Create re-encryption pipeline service**
  - Effort: L
  - Files: `apps/desktop/src/services/key-manager.ts`
  - Dependencies: [T12, T01, T02, T08]
  - Description: Implement re-encryption of all existing chats. Process in batches, track progress, create audit log entries. Support resume on failure.

- [ ] **T16: Implement re-encryption progress UI**
  - Effort: M
  - Files: `apps/desktop/src/components/team/EncryptionSettings.tsx`
  - Dependencies: [T15]
  - Description: Show progress bar during re-encryption with chat count, estimated time, and cancel button. Prevent navigation during operation.

## Phase 4: Export Functionality

- [ ] **T17: Create export service for chat serialization**
  - Effort: M
  - Files: `apps/desktop/src/services/export-service.ts`
  - Dependencies: [T05, T01]
  - Description: Implement `serializeChats()` to convert LocalConversation/LocalMessage to export format. Preserve metadata and privacy levels.

- [ ] **T18: Implement encryption wrapper for exports**
  - Effort: S
  - Files: `apps/desktop/src/services/export-service.ts`
  - Dependencies: [T17, T01, T02]
  - Description: Add `encryptExportData()` to apply password or master key encryption. Return base64-encoded ciphertext with nonce/salt.

- [ ] **T19: Add PDF export rendering**
  - Effort: M
  - Files: `apps/desktop/src/services/export-service.ts`
  - Dependencies: [T17]
  - Description: Use jsPDF library to render chats as readable PDF. Include conversation header, messages with timestamps, redaction indicators.

- [ ] **T20: Create export modal component**
  - Effort: M
  - Files: `apps/desktop/src/components/team/ExportModal.tsx`
  - Dependencies: [T17, T18, T19]
  - Description: UI for selecting export format (JSON/PDF), date range, chat list, encryption method (password/master key). Show file size estimate.

- [ ] **T21: Implement file download handler**
  - Effort: S
  - Files: `apps/desktop/src/services/export-service.ts`
  - Dependencies: [T18, T20]
  - Description: Generate blob, trigger download with filename `sovereign-ai-export-[date].json.encrypted` or `.pdf`. Clear memory after download.

- [ ] **T22: Add export to chat context menu**
  - Effort: S
  - Files: `apps/desktop/src/components/chat/ChatWindow.tsx`
  - Dependencies: [T20, T21]
  - Description: Add right-click menu item "Export this chat" that opens ExportModal pre-filled with current chat.

## Phase 5: Import Functionality

- [ ] **T23: Create import validation service**
  - Effort: M
  - Files: `apps/desktop/src/services/import-service.ts`
  - Dependencies: [T01, T02]
  - Description: Implement `decryptImportFile()` and `validateExportSchema()`. Throw ValidationError with field details if invalid. Test with corrupted files.

- [ ] **T24: Implement deduplication logic**
  - Effort: M
  - Files: `apps/desktop/src/services/import-service.ts`
  - Dependencies: [T23]
  - Description: Create `detectDuplicates()` using SHA256 hashing of chat content. Return list of potential duplicates with similarity scores.

- [ ] **T25: Implement conflict resolution UI**
  - Effort: M
  - Files: `apps/desktop/src/components/team/ImportDialog.tsx`
  - Dependencies: [T24]
  - Description: Show list of duplicates found. For each, allow Skip/Overwrite/Merge strategy selection. Preview differences before proceeding.

- [ ] **T26: Create import service merge function**
  - Effort: M
  - Files: `apps/desktop/src/services/import-service.ts`
  - Dependencies: [T24, T25]
  - Description: Implement `mergeChats()` to apply user's conflict strategy. For Merge, append new messages only. Assign new IDs and preserve createdAt.

- [ ] **T27: Implement import dialog component**
  - Effort: M
  - Files: `apps/desktop/src/components/team/ImportDialog.tsx`
  - Dependencies: [T23, T25, T26]
  - Description: File picker for encrypted export file, password entry, duplicate resolution UI, preview of imported chats before commit.

- [ ] **T28: Add import to sidebar/menu**
  - Effort: S
  - Files: `apps/desktop/src/components/chat/Sidebar.tsx`
  - Dependencies: [T27]
  - Description: Add "Import encrypted backup" button in Sidebar or hamburger menu. Opens ImportDialog. Show success message after import.

## Phase 6: Testing & Integration

- [ ] **T29: Write encryption round-trip tests**
  - Effort: M
  - Files: `apps/desktop/src/lib/encryption.test.ts`
  - Dependencies: [T01, T02]
  - Description: Test encrypt/decrypt with various payload sizes. Verify authentication fails on tampered data. Test key derivation consistency.

- [ ] **T30: Write export/import round-trip tests**
  - Effort: L
  - Files: `apps/desktop/src/services/export-service.test.ts`, `apps/desktop/src/services/import-service.test.ts`
  - Dependencies: [T17, T23, T24, T26]
  - Description: Export sample chats, import with password, verify data integrity. Test with 1000+ messages, duplicates, privacy levels preserved.

- [ ] **T31: Write audit logging integration tests**
  - Effort: M
  - Files: `apps/desktop/src/services/audit-logger.test.ts`
  - Dependencies: [T07, T08]
  - Description: Create chat, perform operations, verify audit entries logged. Test HMAC signature, tampering detection, CSV export format.

- [ ] **T32: End-to-end flow testing**
  - Effort: L
  - Files: Manual test plan
  - Dependencies: [T01-T31]
  - Description: Full workflow: Setup master key → Export chats → Verify encrypted → Import to new machine → Check audit log → Verify re-encryption.

---

## Summary

**Total tasks:** 32  
**Estimated effort:** ~38 story points  
  - S (small, 1 day) = 11 tasks
  - M (medium, 2-3 days) = 17 tasks
  - L (large, 5+ days) = 4 tasks

**Critical path:** Encryption (T01-T02) → Database (T03-T06) → Export (T17-T21) → Import (T23-T26) → Testing (T29-T31)

**Implementation timeline:**
- **Sprint 1 (Week 1-2):** T01-T10 (Encryption + Audit foundation)
- **Sprint 2 (Week 2-3):** T11-T16 (Key management + re-encryption)
- **Sprint 3 (Week 3-4):** T17-T28 (Export/Import + UI)
- **Sprint 4 (Week 4+):** T29-T32 (Testing + Integration)

**Dependencies:**
- All crypto tasks (T01-T02) block export/import/keys (T12-T28)
- Database tasks (T03-T06) block audit and key storage (T07-T14)
- Export/Import can proceed in parallel after dependencies met
- Testing (T29-T32) must follow all implementation

## Blocking Dependency

⚠️ **BLOCKED: Waiting for green_team-collaboration-basic_06**

This change requires the basic team collaboration feature (multi-user chats, shared access) to be shipped first. Currently, that change is marked as STUCK.

**Status:** Planning complete. Build phase can begin once green_team-collaboration-basic_06 ships.

**Unblock path:**
1. Fix green_team-collaboration-basic_06 and move to archive
2. Return to this change and invoke `/sudd-run brown green_team-collaboration-audit_07` to continue to build phase
