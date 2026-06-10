# Verification: green_security-hardening_01

Date: 2026-06-10

## Automated (PASS)

| Finding | Check | Result |
|---------|-------|--------|
| F-04 | `grep -rn "slice(0, 8)\|substring(0, 8)" nebius.ts` | empty — PASS |
| F-04 | `pnpm typecheck` (`tsc --noEmit`) | exit 0 — PASS |
| F-03 | `tauri.conf.json` parses; `app.security.csp` non-null | PASS |
| F-01 | `cargo test` (crypto, via `#[path]` harness, `--offline`) | 3/3 — PASS |
| F-02 | `cargo test` (anonymization, via harness) | 6/6 incl. encrypted-roundtrip + legacy-row — PASS |

Harness: `C:/tmp/sech` includes `crypto.rs` + `anonymization.rs` via `#[path]` with minimal
`db::PiiMapping` / `ollama::PIIExtraction` stubs. Total: **9 passed, 0 failed**. The harness caught a
missing `warn` import in `crypto.rs` (fixed) before it reached the real build.

## Manual follow-up REQUIRED (not runnable in this autonomous session)

1. **F-03 live CSP smoke** — run `pnpm tauri dev` (or a build) and confirm:
   - the UI renders (no CSP violations in the WebView console),
   - a cloud chat against the configured Nebius endpoint still connects,
   - Tauri IPC (`invoke`) still works.
   The CSP is the standard Tauri-safe baseline with the Nebius host + `ipc:`/`http://ipc.localhost`
   allowed, so the expected risk is low. If the user configures a *custom* OpenAI-compatible
   endpoint, its host must be added to `connect-src` (documented tension — do **not** revert to null).

2. **Full `cargo check`/`cargo test`** on the real crate (GPU/llama.cpp build) to confirm the
   `lib.rs` wiring line compiles in-tree. (The modules themselves are harness-verified.)

## Safety notes

- Additive by construction: `.encryption.key` is never deleted (F-01); legacy `is_encrypted=false`
  mapping rows are read as plaintext and never error (F-02). No migration lockout path exists.
- Unit tests use a hermetic `from_raw_key` constructor and never touch the real Windows credential
  vault.
