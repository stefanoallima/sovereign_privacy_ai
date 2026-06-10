# Log: green_security-hardening_01

## Session 2026-06-10 (brown continuation)

Planning artifacts (proposal/specs/design/tasks) already present. Verified all four
findings still live in code before building:
- F-04 confirmed: `nebius.ts:87` logs `this.apiKey.slice(0, 8) + '…'`.
- F-03 confirmed: `tauri.conf.json:25` `"csp": null`.
- F-01 confirmed: `crypto.rs:67-91` placeholder cred-manager writes plaintext file.
- F-02 confirmed: `anonymization.rs:328-330` `pii_value_encrypted: Vec::new()`, `is_encrypted: false`.
- Dependency `winapi = { version = "0.3", features = ["wincred", "winerror"] }` already present.

Build order (design): S1 (F-04) → S2 (F-03) → S3 (F-01) → S4 (F-02).

## Implementation

- **S1 (F-04)** `nebius.ts:87` — log now emits `key=${this.apiKey ? 'set' : '(none)'}`; no key bytes.
- **S2 (F-03)** `tauri.conf.json` — `app.security.csp` set to:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ipc: http://ipc.localhost https://api.studio.nebius.ai https://*.nebius.ai; font-src 'self'`
  (Nebius default host `https://api.studio.nebius.ai` from `nebius.ts:55`; `ipc:`/`http://ipc.localhost` for Tauri v2 IPC.)
- **S3 (F-01)** `crypto.rs` — real `CredReadW`/`CredWriteW` via `winapi::um::wincred`. Load order:
  CredRead → legacy `.encryption.key` file (read + migrate into store) → propagate not-found (→ generate).
  Save: CredWrite **and** keep writing the key file (`write_key_file`). File is **never** deleted. Non-Windows paths unchanged. Added `#[cfg(test)] from_raw_key` so tests never write a random key into the real OS vault (that would lock out existing data).
- **S4 (F-02)** `anonymization.rs` + `lib.rs` — `AnonymizationService` gained `Option<EncryptionKeyManager>`
  (`with_key_manager`, wired from `encryption_key.clone()` in `lib.rs`). Mapping creation encrypts the PII
  value (`is_encrypted=true` + ciphertext), failing **closed** to an empty blob — never cleartext. New
  `resolve_pii_value` read path decrypts encrypted rows and passes legacy plaintext rows through, never
  erroring. `db.rs` already persisted `pii_value_encrypted`/`is_encrypted` — no schema change needed.

## Verification (2026-06-10)

- **F-04**: `grep -rn "slice(0, 8)\|substring(0, 8)" nebius.ts` → empty (PASS). `pnpm typecheck` (`tsc --noEmit`) → exit 0 (PASS).
- **F-03**: `tauri.conf.json` parsed by node; `app.security.csp` non-null (PASS). Live WebView smoke (`pnpm tauri dev` + cloud chat) is a **manual follow-up** — not runnable here (GPU/llama.cpp build); CSP is the standard Tauri-safe baseline so risk is low.
- **F-01 / F-02**: standalone `#[path]` harness (`C:/tmp/sech`) compiling only `crypto.rs` + `anonymization.rs`
  (+ db/ollama stubs), `CARGO_NET_OFFLINE=true cargo test --offline` → **9 passed; 0 failed**:
  crypto round-trip ×3, anonymization existing ×4, `test_mapping_encrypts_pii_value_roundtrip`,
  `test_legacy_plaintext_row_resolves`. Harness caught a real bug first: `crypto.rs` imported
  `log::{info, error}` but new code used `warn!` → added `warn` to the import.
- **Bug found by harness**: missing `warn` import in `crypto.rs` (fixed).
- **Tooling note**: full `cargo check` on the real crate not run (multi-minute llama.cpp/CUDA build); per
  project convention ([[verification-gotchas]]) self-contained modules are verified via the harness. The one
  unverified-by-build line is the trivial `lib.rs` `.with_key_manager(encryption_key.clone())` call.
- **eslint**: globally broken in this repo (`@eslint/js` not hoisted) — pre-existing, out of scope.

## Outcome: DONE (code-complete + unit-verified; F-03 live smoke is a manual follow-up).
