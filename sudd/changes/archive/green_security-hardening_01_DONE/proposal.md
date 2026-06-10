# Change: green_security-hardening_01

## Status
done

## Summary
Fix the four security findings from `adversarial_report.md` that remain open as of 2026-06-10: plaintext encryption key on disk (F-01), unencrypted PII values in anonymization mappings (F-02), disabled Content Security Policy (F-03), and Nebius API-key prefix in logs (F-04). All four still verified present in the live code. These are prerequisites for any confidentiality claim — especially the planned legal vertical.

## Motivation (verified 2026-06-10)
- **F-01 [HIGH]** `apps/desktop/src-tauri/src/crypto.rs:67-91` — the "Windows Credential Manager" functions are placeholders that read/write the ChaCha20 key as a plaintext file `.encryption.key`. Any local process can read the key and decrypt all PII.
- **F-02 [HIGH]** `apps/desktop/src-tauri/src/anonymization.rs:328-330` — `pii_value_encrypted: Vec::new()`, `is_encrypted: false`. PII values in the anonymization mapping (persisted to the `pii_mappings` table, `db.rs:641`) are stored in cleartext.
- **F-03 [HIGH]** `apps/desktop/src-tauri/tauri.conf.json:25` — `"csp": null` disables CSP in the WebView; combined with RAG-rendered untrusted content this is an XSS → IPC-abuse vector.
- **F-04 [MEDIUM]** `apps/desktop/src/services/nebius.ts:87` — logs `key=${this.apiKey.slice(0,8)+'…'}`, leaking the API-key prefix to console.

## Scope

### Included (each task is ADDITIVE / non-destructive — see specs)
- F-01: store the key in the OS credential store via the already-imported `winapi::um::wincred` (CredRead/CredWrite). Keep the file as a read fallback; never delete it → no lockout possible.
- F-02: encrypt PII values with the existing ChaCha20 key before persisting; reads handle both encrypted and legacy plaintext → no data loss.
- F-03: set a strict CSP that still allows the app and the configured cloud endpoint.
- F-04: stop logging any portion of the API key.

### NOT included
- New crates that require network fetch (use the already-vendored `winapi`, `chacha20poly1305`).
- macOS/Linux keychain backends (F-01 is Windows-first here; gate non-Windows behind the existing `cfg` so builds stay green).

## Success Criteria
- [x] F-04: `grep -rn "slice(0, 8)\|substring(0, 8)" apps/desktop/src/services/nebius.ts` returns nothing; no API-key bytes are logged. **(verified: grep empty, typecheck exit 0)**
- [x] F-03: `tauri.conf.json` has a non-null CSP. **(CSP set to standard Tauri-safe baseline incl. Nebius host; live `tauri dev` smoke is a manual follow-up — see verification.md)**
- [x] F-01: key is stored/retrieved via credential manager; if the credential entry is absent the existing `.encryption.key` file is still read (fallback); the file is never deleted; `cargo test crypto` passes (encrypt/decrypt round-trip). **(verified via standalone harness: 3/3 crypto tests; CredRead/Write compile on Windows)**
- [x] F-02: new anonymization mappings persist `is_encrypted: true` with an encrypted value; reading a legacy `is_encrypted: false` row still returns the plaintext value; `cargo test anonymization` passes. **(verified via harness: encrypted-roundtrip + legacy-row tests green)**
- [x] Existing data created before this change is still readable (no migration lockout). **(additive by design: key file never deleted, legacy rows read as plaintext)**

## Key Files
- `apps/desktop/src-tauri/src/crypto.rs` (F-01)
- `apps/desktop/src-tauri/src/anonymization.rs`, `db.rs` (F-02)
- `apps/desktop/src-tauri/tauri.conf.json` (F-03)
- `apps/desktop/src/services/nebius.ts` (F-04)

## Risks
- **Data lockout (F-01/F-02)** is the worst-case. Mitigated by the ADDITIVE design: F-01 keeps the file fallback and never deletes it; F-02 reads both encrypted and legacy plaintext. If a task cannot be implemented safely, it must go STUCK (not merge a destructive change) — partial completion is acceptable.
- **CSP too strict (F-03)** could break the WebView. Mitigation: start from a known-good Tauri CSP that allows `'self'`, inline styles, data/blob images, and `connect-src` to the configured cloud endpoint; verify the app loads.
