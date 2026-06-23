# Specs: Team Collaboration Advanced (Audit Trail, Export, Key Control)

## Export Format (JSON Schema)

```typescript
{
  version: "1.0",
  exportedAt: ISO8601 timestamp,
  exportedBy: userId,
  encryptionAlgorithm: "ChaCha20-Poly1305",
  keyDerivation: "PBKDF2-SHA256",
  chats: [
    {
      id: string,
      title: string,
      personaId: string,
      personaName: string,
      modelId: string,
      createdAt: ISO8601,
      updatedAt: ISO8601,
      messages: [
        {
          id: string,
          role: "user" | "assistant",
          content: string,
          createdAt: ISO8601,
          privacyLevel: "local-only" | "anonymized" | "public",
          redacted?: boolean,
          approvalStatus: "pending" | "approved" | "rejected"
        }
      ],
      activeContextIds: string[],
      totalTokensUsed: number
    }
  ]
}
```

## Import Validation Rules

- Schema version must be "1.0"
- All required fields present (id, title, messages array)
- Messages array non-empty
- Timestamps valid ISO8601 format
- Privacy levels must be valid enum values
- Role values strictly "user" | "assistant"
- Chat IDs must be non-empty strings
- Message content must be non-null string

## Deduplication Logic

- **Hash algorithm:** SHA256 of (chat.title + chat.personaId + concatenated_message_content)
- **Duplicate detection:** Compare new chat hash against existing chat hashes
- **User strategy options:**
  - **Skip:** Don't import this chat
  - **Overwrite:** Replace existing chat with imported version
  - **Merge:** Append new messages only (deduplicate by message content)
- **New ID assignment:** Imported chats get new UUIDs; original IDs preserved in metadata
- **Similarity score:** Show % of messages already present (for merge preview)

## Audit Log Schema

```typescript
{
  id: string (UUID),
  userId: string,
  chatId?: string,
  action: "read" | "append" | "edit" | "delete" | "share" | "export" | "import" | "re-encrypt",
  timestamp: Date (ISO8601),
  metadata: {
    messageCount?: number,
    oldKeyId?: string (for re-encrypt),
    newKeyId?: string (for re-encrypt),
    targetUsers?: string[] (for share),
    importSource?: string (for import),
    exportFormat?: "json" | "pdf",
    fileSize?: number
  },
  signature: string (HMAC-SHA256 of {userId, chatId, action, timestamp, metadata})
}
```

**Retention policy:** Immutable (append-only), never deleted. CSV exports preserve all history.

**Audit log queries:**
- By user: `queryByUser(userId, dateRange?)`
- By chat: `queryByChat(chatId)`
- By action: `queryByAction(action)`
- Date range: `queryByDateRange(startDate, endDate)`
- All actions for export: `queryAll()`

## Key Derivation (PBKDF2-SHA256)

- **Algorithm:** PBKDF2-SHA256
- **Iterations:** 100,000 (OWASP-compliant as of 2025)
- **Salt:** 16 bytes random, stored with encrypted key
- **Output:** 32 bytes (256-bit key for ChaCha20-Poly1305)
- **Hash function:** SHA-256

```typescript
async function deriveKey(password: string, salt?: Uint8Array): Promise<{
  key: CryptoKey,
  salt: Uint8Array
}>
```

## Encryption/Decryption APIs

```typescript
// lib/encryption.ts

export type EncryptedData = {
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  tag: Uint8Array
}

export async function encrypt(
  data: string, 
  key: CryptoKey
): Promise<EncryptedData>
// Returns: {ciphertext, nonce, tag}
// Throws: EncryptionError if operation fails

export async function decrypt(
  encrypted: EncryptedData, 
  key: CryptoKey
): Promise<string>
// Throws: DecryptionError if tag verification fails (data tampered)
// Throws: DecryptionError if decryption fails

export async function deriveKey(
  password: string, 
  salt?: Uint8Array
): Promise<{
  key: CryptoKey,
  salt: Uint8Array
}>
// Generates random salt if not provided
// Performs PBKDF2 derivation
// Returns CryptoKey ready for encrypt/decrypt

export async function generateMasterKey(
  passphrase: string
): Promise<{
  encryptedKey: string,
  salt: string,
  keyId: string
}>
// Derives key from passphrase
// Encrypts the key with itself (or user password)
// Returns base64-encoded encrypted key + salt + unique keyId
```

## Database Migrations

**Version 5 migration script:**

```sql
CREATE TABLE IF NOT EXISTS auditLogs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  chatId TEXT,
  action TEXT NOT NULL CHECK(action IN ('read', 'append', 'edit', 'delete', 'share', 'export', 'import', 're-encrypt')),
  timestamp DATETIME NOT NULL,
  metadata JSON,
  signature TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auditLogs_userId_timestamp 
  ON auditLogs(userId, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_auditLogs_chatId 
  ON auditLogs(chatId);

CREATE TABLE IF NOT EXISTS encryptionKeys (
  id TEXT PRIMARY KEY,
  keyId TEXT UNIQUE NOT NULL,
  encryptedKey TEXT NOT NULL,
  salt TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'ChaCha20-Poly1305',
  createdAt DATETIME NOT NULL,
  isMaster BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'rotated', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_encryptionKeys_isMaster 
  ON encryptionKeys(isMaster) WHERE isMaster = 1;
```

**TypeScript interfaces:**

```typescript
export type LocalAuditLog = {
  id: string;
  userId: string;
  chatId?: string;
  action: 'read' | 'append' | 'edit' | 'delete' | 'share' | 'export' | 'import' | 're-encrypt';
  timestamp: Date;
  metadata?: Record<string, any>;
  signature: string;
}

export type LocalEncryptionKey = {
  id: string;
  keyId: string;
  encryptedKey: string;
  salt: string;
  algorithm: string;
  createdAt: Date;
  isMaster: boolean;
  status: 'active' | 'rotated' | 'revoked';
}
```

## API Endpoints

**Export endpoints:**
- `POST /api/export` — Request export with filters
  - Body: `{ dateRange?: {start, end}, chatIds?: string[], format: 'json'|'pdf', encryptionMethod: 'password'|'masterKey' }`
  - Response: `{ downloadUrl: string, fileSize: number }`

- `POST /api/export/password-encrypt` — Encrypt export with password
  - Body: `{ data: string, password: string }`
  - Response: `{ encrypted: string, salt: string }`

**Import endpoints:**
- `POST /api/import` — Upload encrypted file
  - Body: `{ file: Blob, password: string }`
  - Response: `{ duplicates: [{chatId, title, matchPercentage}], strategy: 'skip'|'overwrite'|'merge' }`

- `POST /api/import/commit` — Execute import with resolved conflicts
  - Body: `{ duplicateResolutions: {[chatId]: 'skip'|'overwrite'|'merge'} }`
  - Response: `{ importedCount: number, skippedCount: number }`

**Audit endpoints:**
- `GET /api/audit-log` — Retrieve audit entries (paginated)
  - Query: `?userId=...&action=...&startDate=...&endDate=...&limit=50&offset=0`
  - Response: `{ entries: LocalAuditLog[], total: number, nextOffset?: number }`

- `POST /api/audit-log/export` — CSV export
  - Body: `{ startDate?: string, endDate?: string, actions?: string[] }`
  - Response: CSV file download

**Key management endpoints:**
- `POST /api/keys/setup-master` — Initialize master key
  - Body: `{ passphrase: string }`
  - Response: `{ keyId: string, createdAt: string }`

- `POST /api/keys/re-encrypt` — Trigger re-encryption pipeline
  - Body: `{ chatIds?: string[] }` (empty = all chats)
  - Response: `{ jobId: string, chatCount: number }`

- `GET /api/keys/re-encrypt/:jobId` — Check re-encryption progress
  - Response: `{ status: 'pending'|'in-progress'|'completed', processed: number, total: number, failedCount: number }`

- `GET /api/keys/status` — Check encryption status
  - Response: `{ masterKeyEnabled: boolean, masterKeyId?: string, createdAt?: string, chatsReencrypted: number, chatsTotal: number }`

## Error Handling Scenarios

| Scenario | Error | User Message | Recovery |
|----------|-------|--------------|----------|
| Invalid password on import | `DecryptionError` | "Password incorrect or file corrupted" | Retry with correct password |
| Corrupted export file | `ValidationError` | "Invalid file format. Missing field: {field}" | Download valid export again |
| Duplicate chat (import) | `DuplicateDetected` | "1 existing chat matches — choose action" | User selects skip/overwrite/merge |
| Master key not enabled | `MasterKeyNotFound` | "Master key not set. Use password instead." | User can set master key in settings |
| Large export timeout | `TimeoutError` | "Export taking too long. Retrying..." | System resumes from last batch |
| Re-encryption interrupted | `InterruptedError` | "Re-encryption paused. Click resume." | User clicks resume button in UI |
| Audit log tampered | `AuditTamperingDetected` | "Audit log integrity check failed — contact admin" | Log flagged; investigation required |
| Master key passphrase weak | `WeakPassphrase` | "Passphrase too weak. Use 12+ characters with mixed case" | User enters stronger passphrase |

## Security Considerations

- **Encryption:** ChaCha20-Poly1305 provides AEAD (authentication + encryption)
- **Authentication tag:** Prevents tampering; decryption fails if modified
- **Master key derivation:** PBKDF2 with 100k iterations resists brute-force
- **Key storage:** Encrypted key stored in database; never exposed in logs or UI
- **Audit signing:** HMAC-SHA256 prevents audit log tampering
- **Memory safety:** Clear sensitive data (passwords, keys) from memory after use
- **Export files:** Contain ciphertext only; unreadable without key/password
- **Session isolation:** Each user's keys isolated; cannot decrypt other users' exports
