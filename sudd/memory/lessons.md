# SUDD2 Lessons Learned

This file is updated automatically after each task. Agents read it to avoid repeating mistakes.

## Template
- **Task**: [name]
- **What worked**: [approach that succeeded]
- **What failed**: [approach that didn't work]
- **Lesson**: [takeaway for future tasks]

---

## green_form-fill_01 (2026-03-28)

- **Task**: Form-fill pipeline — privacy-first form filling for PDF/DOCX
- **What worked**: Batching 4 independent Rust modules in parallel (T01-T04), then frontend in parallel batches. Full build passed on first try.
- **What failed**: Pipeline was wired but never called (startPipeline dead code). Serde camelCase/snake_case mismatch between TS and Rust. Export commands returned bytes but frontend expected file writing.
- **Lesson**: Always verify the entry point is actually connected. When Rust structs are consumed by TypeScript via Tauri, add `#[serde(rename_all = "camelCase")]` by default. When commands need to write files, accept output_path in Rust rather than returning bytes to the frontend.

- **Task**: DOCX template filling
- **What failed**: Simple string replacement misses Word's run-splitting (text split across `<w:r>` elements)
- **Lesson**: Always normalize DOCX XML runs before text replacement. Use regex to merge adjacent `</w:t></w:r><w:r><w:t>` patterns.

- **Task**: Gap-fill UI interaction
- **What failed**: Both removing from array AND incrementing index caused every-other-field skip
- **Lesson**: Pick one progression strategy — either shrink the array (always read index 0) or advance the index (keep array stable). Never both.

## green_pii-pipeline-v3_01 (2026-06-10)

- **Task**: PII pipeline v3 — close residual cloud-leak gaps (dead leaky path, asymmetric GLiNER coverage, per-message IPC).
- **What worked**: The plan was verified against live code the same day, so brown mode went straight to build. Found T3's Rust primitive (`redact_messages`/`redact_messages_command` + regression test) ALREADY shipped in the working tree — T3 collapsed to TS wiring only. Reused `applyGlinerPiiRedaction` (already returns `{sanitized, mappings}` on arbitrary text AND auto-persists + self-fallbacks) so T2 needed no new GLiNER/persist plumbing.
- **What failed / gotchas**: (1) `sudd/CURRENT_STATE.md` was ~7 weeks stale and described a *different* SUDD instance — trusting it would have derailed the session; the real queue was in `state.json.auto_session.queue_remaining`. (2) The subtle bug-class: a redaction gate `!autoRedactAllContent || redactTerms.length === 0` silently skips ALL redaction when the user has no custom terms — meaning GLiNER-catchable PII in history leaked. Fix: gate GLiNER on `autoRedactAllContent` ALONE; only term-matching needs `redactTerms.length > 0`.
- **Validation gotcha**: `cargo test` on a fresh standalone `#[path]` harness failed on crates.io SSL revocation — `--offline` (deps already in cargo cache from the main build) fixed it. Verifying a self-contained module (`redaction.rs` → only `regex`/`serde`/`std`) via a `#[path]` harness avoids the multi-minute llama.cpp/CUDA build entirely.
- **Tooling gap surfaced**: `pnpm lint` is unrunnable in this repo — `eslint.config.js` imports `@eslint/js` which is NOT a declared `devDependency` (only in the pnpm store), and even once resolved there are 56 pre-existing errors (missing DOM globals + `no-case-declarations`) in untouched files. Verify changed files in isolation (`pnpm exec eslint <files>`) rather than treating a red full-suite as a regression.
- **Lesson**: A boolean redaction gate that short-circuits on "no user-configured terms" is a privacy footgun — NER must run independently of user term lists. Always re-verify a session handoff doc's timestamp/scope before trusting it. Prefer `#[path]` standalone harnesses + `cargo --offline` to test self-contained Rust modules in heavy-build crates.
