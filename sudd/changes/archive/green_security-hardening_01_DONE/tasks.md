# Tasks: Security Hardening

## S1: F-04 — remove API key prefix from logs
- **Effort**: S
- **Dependencies**: none
- **Files**: apps/desktop/src/services/nebius.ts
- **SharedFiles**: none
- **Description**: Replace the logged key slice (~line 87) with a boolean presence indicator. Ensure no code path logs any substring of the key.
- [x] Replace `apiKey.slice(0,8)` log with `set/(none)` indicator
- [x] grep nebius.ts for any other key logging; remove (only `Authorization` headers remain — required, not logged)
- [x] `pnpm typecheck` passes (exit 0)

## S2: F-03 — set a strict Content Security Policy
- **Effort**: S
- **Dependencies**: none
- **Files**: apps/desktop/src-tauri/tauri.conf.json
- **SharedFiles**: none
- **Description**: Set `app.security.csp` (currently null) to the strict baseline in specs FR2, with `connect-src` covering the configured cloud host(s). Do NOT leave it null.
- [x] Set non-null CSP with correct connect-src (Nebius host + Tauri IPC sources; valid JSON verified)
- [x] CSP uses the standard Tauri-safe baseline; live `tauri dev` smoke is a documented manual follow-up (needs GPU build + cloud chat) — see log.md / verification.md

## S3: F-01 — store encryption key in OS credential manager (additive)
- **Effort**: M
- **Dependencies**: none
- **Files**: apps/desktop/src-tauri/src/crypto.rs
- **SharedFiles**: none
- **Description**: Use the already-imported `winapi::um::wincred` to read/write the key. Load order: CredRead → file fallback (+migrate) → generate. Save to credential store AND keep the file. NEVER delete `.encryption.key`. Non-Windows unchanged.
- [x] Implement CredRead/CredWrite in load/save functions (winapi wincred; compiles clean on Windows)
- [x] File fallback preserved; key file never deleted (load: CredRead→file+migrate→generate; save: CredWrite + write_key_file)
- [x] `cargo test crypto` passes (round-trip) via standalone `#[path]` harness — 3/3 crypto tests green

## S4: F-02 — encrypt PII values in anonymization mappings (additive)
- **Effort**: L
- **Dependencies**: S3 (both crypto-adjacent; run after S3 to avoid key-plumbing churn overlapping)
- **Files**: apps/desktop/src-tauri/src/anonymization.rs, apps/desktop/src-tauri/src/db.rs, apps/desktop/src-tauri/src/lib.rs
- **SharedFiles**: apps/desktop/src-tauri/src/lib.rs
- **Description**: Plumb `EncryptionKeyManager` into `AnonymizationService`. Encrypt PII value at mapping creation → persisted row carries ciphertext + `is_encrypted=true`. Read path decrypts when `is_encrypted`, else returns legacy plaintext. NEVER error on legacy rows.
- [x] Add key manager to AnonymizationService (`Option<EncryptionKeyManager>` + `with_key_manager`; lib.rs passes `encryption_key.clone()`)
- [x] Encrypt at mapping creation; persist is_encrypted=true + ciphertext (fails closed to empty blob, never cleartext)
- [x] Read path (`resolve_pii_value`): decrypt encrypted, passthrough legacy plaintext, never errors
- [x] `cargo test anonymization` passes (encrypted round-trip + legacy-row test) via harness — 6/6 anonymization tests green

## Dependency Graph
```
S1, S2 (independent, low-risk) ......... Batch 1
S3 ..................................... Batch 2
S4 (depends on S3; shares lib.rs) ...... Batch 3
```

## SAFETY NOTE (read before applying S3/S4)
These touch encryption. The design is strictly ADDITIVE: never delete the key file (S3), always read legacy plaintext rows (S4). If a task cannot guarantee that pre-existing user data stays readable, mark it STUCK rather than merge a destructive change.
