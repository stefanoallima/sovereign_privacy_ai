# Design: Team Collaboration Advanced (Audit Trail, Export, Key Control)

## Architecture Overview

The system is layered with clear separation of concerns:

1. **Encryption Services** - Core cryptographic operations using Web Crypto API (ChaCha20-Poly1305)
2. **Export Service** - Serializes chat data to encrypted JSON/PDF formats
3. **Import Service** - Decrypts and validates import files with conflict resolution
4. **Audit Logger** - Tracks team access with immutable logging
5. **Key Manager** - Handles master key derivation and storage
6. **Database Layer** - New tables for audit logs and encryption keys
7. **UI Components** - Settings panels, modals, and viewers

## System Components

### 1. Encryption Engine (`lib/encryption.ts`)

- **Algorithm:** ChaCha20-Poly1305 (AEAD encryption)
- **Key derivation:** PBKDF2-SHA256 with 100,000 iterations
- **Secure random:** Cryptographically-sound salt/nonce generation
- **API:** Transparent encrypt/decrypt functions
- **Error handling:** Clear distinction between cryptographic failures and data integrity issues

### 2. Export Service (`services/export-service.ts`)

- `exportChatsAsJSON()` - Serialize conversations with metadata
- `exportChatsAsPDF()` - Generate readable PDF for legal review
- `encryptExport()` - Apply password or master key encryption
- **Features:**
  - Streaming for large exports (prevent memory exhaustion)
  - Metadata preservation (dates, personas, redaction status)
  - Progress tracking for UI feedback
  - Secure cleanup (clear sensitive data from memory)

### 3. Import Service (`services/import-service.ts`)

- `decryptImport()` - Decrypt JSON with password/master key
- `validateExportSchema()` - Ensure structure integrity
- `detectDuplicates()` - Hash-based deduplication
- `mergeChats()` - Conflict resolution (skip/overwrite/merge)
- `restoreToDatabase()` - Persist with new IDs
- **Features:**
  - Atomic transactions (all-or-nothing import)
  - User-driven conflict resolution
  - Duplicate detection via SHA256 hashing

### 4. Audit Logger (`services/audit-logger.ts`)

- Immutable append-only log
- **Actions tracked:** read, append, edit, delete, share, export, import, re-encrypt
- **Signing:** HMAC-SHA256 to prevent tampering
- **Export:** CSV format for compliance audits
- **Rate limiting:** Prevent audit log spam from batch operations

### 5. Key Manager (`services/key-manager.ts`)

- Master key derivation from passphrase
- Secure storage in encrypted form (encrypted with user password)
- Re-encryption pipeline for existing chats
- Key rotation support (post-v1)
- **Safety:** Master key never stored unencrypted

### 6. Database Extensions (`lib/db.ts`)

- **Version 5 migration:**
  - `auditLogs` table: user_id, chat_id, action, timestamp, metadata, signature
  - `encryptionKeys` table: keyId, encryptedKey, salt, algorithm, createdAt, isMaster
- **Indexes:** Efficient querying by user, timestamp, chat_id
- **Soft-delete support:** Audit trail preserved even after deletion

### 7. UI Components (`components/team/`)

- `ExportModal.tsx` - Format/date range/encryption method selection
- `ImportDialog.tsx` - File picker, password, merge strategy
- `AuditLogViewer.tsx` - Filtered table with CSV export
- `EncryptionSettings.tsx` - Master key setup/re-encryption control

## Data Flow

### Export Flow

1. User selects chats in ExportModal → specifies date range, format (JSON/PDF), encryption (password/master key)
2. ExportService.serializeChats() → Converts chat objects to export JSON format
3. Preserves: message content, timestamps, personas, privacy levels, redaction status
4. ExportService.encryptExport() → ChaCha20-Poly1305 encryption with user/master key
5. Output: Base64-encoded file with nonce + salt + ciphertext
6. Browser downloads file as `sovereign-ai-export-[date].json.encrypted` or `.pdf`
7. AuditLogger logs action with file size, date range, format

### Import Flow

1. User selects encrypted file in ImportDialog → enters password or uses master key
2. ImportService.decryptImport() → Verifies authentication tag, decrypts JSON
3. ImportService.validateExportSchema() → Checks all required fields
4. ImportService.detectDuplicates() → Hashes chats, flags matches
5. UI shows duplicates → User chooses Skip/Overwrite/Merge strategy
6. ImportService.mergeChats() → Applies strategy, assigns new IDs, preserves metadata
7. Transaction commits to database → Audit log entry recorded
8. Chat list updates with new imported conversations

### Audit Flow

1. Every chat operation (create/read/write/delete/share) triggers AuditLogger.logAction()
2. Entry captured: {userId, chatId, action, timestamp, metadata}
3. Entry signed with HMAC-SHA256 → Appended to auditLogs table
4. Queries filtered by user/action/timestamp range
5. CSV export for compliance → Human-readable format with signatures

## Encryption Strategy

- **Algorithm:** ChaCha20-Poly1305 (proven AEAD cipher)
- **Key derivation:** PBKDF2-SHA256 with 100,000 iterations + random salt
- **Master key option:** Company controls passphrase, optionally stores on file server
- **Backward compatibility:** Existing chats use system-managed keys until re-encrypted
- **Re-encryption:** Read old chat → Decrypt with old key → Re-encrypt with master key → Write
- **Key rotation:** Future support via versioning in encryptionKeys table

## Integration Points

- **Minimal changes to chat interfaces:** Export/import operates on public chat objects
- **Non-intrusive audit logging:** Injected via service layer, not coupled to components
- **Master key transparent:** Users don't see cryptography details
- **Backward compatible:** Non-team users unaffected; master key is opt-in

## Implementation Sequence

1. **Foundation:** Encryption engine (T01-T02) → Database schema (T03-T06)
2. **Audit system:** Logger service (T07-T08) → UI components (T09-T11)
3. **Key management:** KeyManager (T12) → Master key UI (T13-T14) → Re-encryption (T15-T16)
4. **Export:** Service (T17-T19) → Modal UI (T20-T22)
5. **Import:** Validation (T23-T24) → Merge logic (T25-T26) → Dialog UI (T27-T28)
6. **Testing:** Unit tests (T29-T31) → E2E (T32)

Each phase builds on prior phases; tasks within phases are parallel-friendly when dependencies allow.
