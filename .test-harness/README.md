# Offline test harnesses

Run privacy-critical, self-contained logic **without** building the full Tauri
crate (which compiles llama.cpp / CUDA and takes minutes).

## `redaction/` — Rust matcher tests
Includes `src-tauri/src/redaction.rs` via `#[path]`, so its `#[cfg(test)]` tests
run in isolation. It depends only on `regex` + `serde` + `std`.

```bash
cd .test-harness/redaction
export CARGO_TARGET_DIR="C:/tmp/rh"   # short path avoids Windows MAX_PATH
cargo test --offline
```

## `canonical-key.*.mjs` — PII canonicalization logic
Verifies the pure "same value → same token" normalization (NFC + whitespace
collapse + case-fold) that is ported verbatim into
`apps/desktop/src/stores/userContext.ts` (`canonicalRedactKey` /
`normalizeRedactValue`). The project has no TS test runner, so this is the
executable spec for that contract.

```bash
cd .test-harness && node canonical-key.test.mjs
```
