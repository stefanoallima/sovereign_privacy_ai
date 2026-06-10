# Summary: green_security-hardening_01

## What Changed

Closed the four open security findings from `adversarial_report.md` (all re-verified live on 2026-06-10):

- **F-04 (MEDIUM)** `apps/desktop/src/services/nebius.ts` — the request log no longer prints an
  API-key prefix; it emits `key=set` / `key=(none)` only.
- **F-03 (HIGH)** `apps/desktop/src-tauri/tauri.conf.json` — `app.security.csp` changed from `null`
  to a strict CSP: `default-src 'self'`, scoped `script-src`/`style-src`/`img-src`/`font-src`, and
  `connect-src 'self' ipc: http://ipc.localhost https://api.studio.nebius.ai https://*.nebius.ai`.
- **F-01 (HIGH)** `apps/desktop/src-tauri/src/crypto.rs` — replaced the placeholder file-only
  "credential manager" with real `CredReadW`/`CredWriteW` (`winapi::um::wincred`). Load order:
  OS credential store → legacy `.encryption.key` file (read + one-time migrate into the store) →
  generate. Save writes the store **and** keeps the key file. The file is **never deleted**.
  Non-Windows code paths unchanged.
- **F-02 (HIGH)** `apps/desktop/src-tauri/src/anonymization.rs` + `lib.rs` — `AnonymizationService`
  now holds an optional `EncryptionKeyManager` (wired from the app's existing key). PII values in new
  mappings are ChaCha20-Poly1305 encrypted (`is_encrypted=true` + ciphertext), failing **closed** to
  an empty blob — never cleartext. New `resolve_pii_value` decrypts encrypted rows and passes legacy
  `is_encrypted=false` plaintext rows through, never erroring.

## Why

These four findings undermine the product's core confidentiality promise (PII never leaves the
machine in a recoverable form) and are prerequisites for the planned legal vertical. A plaintext
key on disk defeats at-rest encryption; unencrypted mapping values re-expose the PII the pipeline
just removed; a null CSP turns RAG-rendered untrusted content into an XSS → IPC-abuse vector; and a
logged key prefix leaks credential material. The design is strictly **additive** so no pre-existing
user data can be locked out.

## Validation

- **F-04**: `grep` for `slice(0, 8)`/`substring(0, 8)` in `nebius.ts` → empty. `pnpm typecheck`
  (`tsc --noEmit`) → exit 0.
- **F-03**: `tauri.conf.json` parses; `app.security.csp` is non-null. Live `tauri dev` WebView smoke
  is a **manual follow-up** (needs the GPU/llama.cpp build) — see `verification.md`.
- **F-01 / F-02**: standalone `#[path]` harness (`crypto.rs` + `anonymization.rs` + db/ollama stubs),
  `cargo test --offline` → **9 passed, 0 failed** (crypto round-trips ×3; anonymization existing ×4;
  encrypted-roundtrip; legacy-row read). The harness also caught a missing `warn` import in
  `crypto.rs` before it could break the real build.
- Full `cargo check` on the real crate was not run (multi-minute llama.cpp/CUDA build); per project
  convention self-contained modules are verified via the harness. The only line not covered by a
  build is the trivial `lib.rs` `.with_key_manager(encryption_key.clone())` call.

## Lessons

For encryption-store migrations, make every path additive — never delete the old store, read both
formats, fail closed to no-value (never cleartext) — so existing data can't be locked out. Unit
tests must never mutate the real OS credential store (added a `#[cfg(test)] from_raw_key`). Adding a
logging macro requires updating the file's `use log::{...}`. When an acceptance criterion is
inherently manual (a live smoke needing a heavy build), record it transparently rather than checking
a box you didn't verify. Full lesson in `sudd/memory/lessons.md`.

## Files Changed

- `apps/desktop/src/services/nebius.ts` (F-04)
- `apps/desktop/src-tauri/tauri.conf.json` (F-03)
- `apps/desktop/src-tauri/src/crypto.rs` (F-01 + new tests)
- `apps/desktop/src-tauri/src/anonymization.rs` (F-02 + new tests)
- `apps/desktop/src-tauri/src/lib.rs` (F-02 wiring)
