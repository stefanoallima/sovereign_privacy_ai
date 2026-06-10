# Specs: Security Hardening

## FR1 (F-04): No API key in logs
- Remove the API-key slice from `nebius.ts` (~line 87). Replace with a boolean presence indicator, e.g. `key=${this.apiKey ? 'set' : '(none)'}`.
- No code path may log any substring of the key.
- Acceptance: grep finds no `slice(0, 8)` / `substring(0, 8)` of `apiKey`; typecheck passes.

## FR2 (F-03): Strict Content Security Policy
- `apps/desktop/src-tauri/tauri.conf.json` `app.security.csp` MUST be a non-null string.
- Baseline (adjust `connect-src` to the configured cloud host(s), e.g. Nebius `https://api.studio.nebius.ai` and any OpenAI-compatible endpoint the app uses):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.studio.nebius.ai https://*.nebius.ai; font-src 'self'`
- Acceptance: CSP non-null; `pnpm tauri dev` (or a build) loads the UI and a cloud chat still connects (manual smoke note in log).

## FR3 (F-01): Credential-store key, additive
- Use `winapi::um::wincred` (`CredWriteW`/`CredReadW`, already an imported dependency — no new crate).
- Target name: e.g. `PrivateAssistant/encryption-key`.
- LOAD order: (1) try CredRead; if present, use it. (2) else read existing `.encryption.key` file; if present, use it AND write it into the credential store (one-time migration). (3) else generate a new key, store in BOTH credential store and file.
- SAVE: write to the credential store. The file MUST continue to exist as a fallback (do NOT delete `.encryption.key`).
- Non-Windows: unchanged file behavior, behind existing `#[cfg(...)]`.
- Acceptance: `cargo test crypto` passes (encrypt→decrypt round-trips with the key obtained via the new path); a machine with only the file (no cred entry) still decrypts (fallback). NO deletion of the key file anywhere.

## FR4 (F-02): Encrypt PII values in mappings, additive
- When building an anonymization mapping (`anonymization.rs` ~line 316-330), encrypt the PII value with the existing ChaCha20-Poly1305 key (`crypto::PiiEncryption::encrypt`) → store ciphertext in `pii_value_encrypted`, set `is_encrypted: true`.
- The anonymization service needs access to the `EncryptionKeyManager`; plumb it in (constructor parameter or setter). Keep changes minimal and behind the existing struct.
- READ: when consuming a mapping, if `is_encrypted` decrypt; if not (legacy rows where `is_encrypted: false`) use the existing plaintext field unchanged. NEVER error on legacy rows.
- Acceptance: `cargo test anonymization` passes with a round-trip test (encrypt on write, decrypt on read) AND a legacy-row test (is_encrypted false → plaintext returned).

## FR-VERIFY
- Rust: `cd apps/desktop/src-tauri && cargo test crypto anonymization` (or the standalone-harness trick if the llama.cpp/CUDA build is too slow — compile only the target module via `#[path]`).
- TS: `cd apps/desktop && pnpm typecheck` (for F-04).
- Each task that touches crypto MUST keep prior-format data readable; if that cannot be guaranteed, mark the task STUCK rather than merge.
