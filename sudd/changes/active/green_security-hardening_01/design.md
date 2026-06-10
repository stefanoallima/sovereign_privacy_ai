# Design: Security Hardening

## Ordering (safest first — S1 is a good canary for apply.md Step 2.5)
S1 (F-04 log) → S2 (F-03 CSP) → S3 (F-01 key) → S4 (F-02 mappings).
S1/S2 are low-risk and independent. S3/S4 touch crypto and must be additive.

## S1 — F-04: remove API key from logs
`nebius.ts` ~line 87: replace `key=${this.apiKey ? this.apiKey.slice(0, 8) + '…' : '(none)'}` with `key=${this.apiKey ? 'set' : '(none)'}`. Grep the file for any other key logging. `pnpm typecheck`.

## S2 — F-03: CSP
Edit `tauri.conf.json` → `app.security.csp` (currently `null`). Use the baseline in specs FR2. Determine the real cloud host(s) from `nebius.ts` (`https://api.studio.nebius.ai/v1`) and `settings.ts` (`nebiusApiEndpoint`) and include them in `connect-src`. If the app supports arbitrary OpenAI-compatible endpoints, this is a known tension — prefer a CSP that covers the default host and document that custom endpoints may require a CSP update (do NOT revert to null). Smoke-test that the UI loads and a chat connects; note it in log.

## S3 — F-01: credential-store key (ADDITIVE)
In `crypto.rs`:
- `load_key_from_windows_credential_manager()`: replace the file-only placeholder with: try `CredReadW(target)`; on success return the blob. On failure, read `.encryption.key` (existing `get_key_path()`); if it exists, write it into the credential store via `CredWriteW` (migration) and return it. Propagate "not found" so `new()`'s existing generate-and-save path runs for first-time users.
- `save_key_to_windows_credential_manager(key)`: `CredWriteW(target, key)` AND keep writing the file (existing behavior) as a fallback. Do NOT delete the file.
- Use `CRED_TYPE_GENERIC`, `CRED_PERSIST_LOCAL_MACHINE` (or `CRED_PERSIST_ENTERPRISE`). Wide strings for target name. Handle `GetLastError` → return Err so the fallback chain runs.
- Keep all non-Windows code paths unchanged (`#[cfg(not(target_os = "windows"))]`).
- TEST: `crypto::tests` — a test that round-trips encrypt/decrypt using `EncryptionKeyManager::new()` regardless of backend; and (where feasible) that a present `.encryption.key` is still honored. Avoid tests that require a real Windows credential store in CI — guard with `#[cfg(target_os = "windows")]` or test the fallback path.

## S4 — F-02: encrypt mapping PII values (ADDITIVE)
- `AnonymizationService` must hold an `EncryptionKeyManager` (add a field + constructor param; update the single construction site in `lib.rs` to pass the existing `encryption_key`).
- At mapping creation (`anonymization.rs` ~316-330): `let ct = PiiEncryption::encrypt(pii_value, &key)?; pii_value_encrypted = ct; is_encrypted = true;` Keep the plaintext `pii_value` field behavior compatible if other code reads it in-memory during the same session, but the PERSISTED row (`db.rs` insert) must carry the ciphertext + `is_encrypted=true`.
- READ path (wherever mappings are loaded, e.g. `db.rs:658` getter + de-anonymization in `anonymization.rs:213`): if `is_encrypted` → `PiiEncryption::decrypt`; else use the existing plaintext. NEVER panic/error on legacy rows.
- TEST: `anonymization::tests` — (a) create mapping → persisted value is encrypted, decrypt returns original; (b) a constructed legacy row (`is_encrypted=false`, plaintext set) de-anonymizes correctly.

## Cross-cutting
- No new crates (network-fetch will fail). Use vendored `winapi`, `chacha20poly1305`, `zeroize`.
- Full crate build is slow (llama.cpp/CUDA). For unit tests, the standalone `#[path]` harness that compiles only `crypto.rs` / `anonymization.rs` + their deps is acceptable to iterate fast; final verification via `cargo test crypto anonymization`.
- Any task that cannot preserve readability of pre-existing data → STUCK, not merge.
