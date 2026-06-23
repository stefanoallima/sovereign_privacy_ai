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

## green_security-hardening_01 (2026-06-10)

- **Task**: Security hardening — 4 findings from `adversarial_report.md`: plaintext key on disk (F-01), unencrypted PII in anonymization mappings (F-02), disabled CSP (F-03), API-key prefix in logs (F-04).
- **What worked**: Strictly ADDITIVE design made the crypto-touching tasks safe — F-01 keeps the `.encryption.key` file as a never-deleted fallback (load order CredRead→file+migrate→generate); F-02 reads legacy `is_encrypted=false` rows as plaintext and fails encryption *closed* to an empty blob (never cleartext). `winapi` already shipped `wincred` so no new crate / network fetch. The `#[path]` harness (`crypto.rs` is fully self-contained; `anonymization.rs` only needs `db::PiiMapping` + `ollama::PIIExtraction` stubs) ran 9 tests in seconds and caught a missing `warn` import before it could break the real build.
- **What failed / gotchas**: (1) New `warn!` calls in `crypto.rs` failed to compile — the file only imported `log::{info, error}`. Adding a macro means checking the module's existing `use log::{...}`. (2) Test footgun: calling `EncryptionKeyManager::new()` in a unit test would write a *random* key into the real Windows credential vault, and since load now prefers CredRead, the app would then fail to decrypt existing file-key data → lockout. Fix: `#[cfg(test)] from_raw_key(bytes)` so tests stay hermetic. (3) Avoided `GetLastError` to dodge adding the `errhandlingapi` winapi feature (keeps the change to `crypto.rs` only) — a generic `Err` is enough for the fallback chain.
- **Validation gotcha**: F-03's acceptance includes a *live* WebView smoke (app loads + cloud chat connects) that needs the full GPU/llama.cpp build — not runnable in an autonomous session. Recorded it honestly as a manual follow-up rather than faking the checkbox. For Tauri v2, a non-null CSP must include `ipc:` + `http://ipc.localhost` in `connect-src` or IPC breaks, and same-origin Vite HMR ws is covered by `'self'`.
- **Lesson**: For encryption-store migrations, make every path additive (never delete the old store; read both formats; fail closed to no-value, never cleartext) so pre-existing user data can't be locked out. Unit tests must never mutate a real OS credential store — add a raw-key test constructor. When adding a logging macro, update the file's `use log::{...}`. When an acceptance criterion is inherently manual (live smoke needing a heavy build), record it transparently instead of checking a box you didn't verify.

## green_form-fill_01 (2026-06-10)

- **Task**: Privacy-first form-fill pipeline — parse PDF/DOCX/MD/TXT, fill simple fields locally from "My Info", use placeholder/rehydration for reasoning fields so the cloud LLM never sees PII, preview in Canvas, export preserving template.
- **What worked**: Reused existing assets end-to-end — `file_parsers.rs` for extraction, the GLiNER + anonymization pipeline for PII, the Canvas system for preview, ChaCha20-Poly1305 for encrypted local "My Info". Implementation split cleanly into `form_fill.rs`/`form_fill_commands.rs` (field extraction + profile matching + reasoning composition) and `form_export.rs`/`form_export_commands.rs` (DOCX/PDF export), all wired in `lib.rs` invoke_handler.
- **Lesson**: Placeholder-token + on-device rehydration is the reusable primitive for "LLM composes text that must contain PII without ever seeing it" — the same pattern underlies the redaction/rehydration commands. Verified shipped (39/39) against live code; archived as reconciliation, not fresh build.

## green_gemma4-orchestration_01 (2026-06-10)

- **Task**: Add Gemma 4 E4B (128k context, Apache-2.0 GGUF) as a selectable local model and add an orchestration layer so the local model can delegate knowledge-gap sub-questions to the cloud model while keeping PII local.
- **What worked**: `orchestration.rs`/`orchestration_commands.rs` encapsulate the "local model detects 'I don't know' → anonymize sub-question → cloud answer → merge" loop, wired in `lib.rs`. Gemma GGUF entries added to the model registry in `llama_backend.rs`. Multi-model selection reused the existing model-management UI.
- **Lesson**: Keep cloud-delegation as an explicit orchestration module rather than inlining it in the chat hook — it must funnel every outbound sub-question through the same anonymization gate as a normal send, so a single choke point (not scattered call sites) is what preserves the privacy guarantee.

## green_local-rag_01 (2026-06-10)

- **Task**: Fully local, privacy-first RAG — chunk uploaded docs, embed locally via ONNX (`ort`), store vectors in SQLite, cosine top-K retrieval injected into chat context. Replaces the mock knowledge-base UI.
- **What worked**: Implemented as `embedding.rs`/`embedding_commands.rs` (ONNX embed via `ort`), `chunker.rs` (overlap chunking), and `knowledge_store.rs`/`knowledge_commands.rs` (SQLite vector store + `ingest_document`/`create_knowledge_base`/`list_knowledge_bases`). Note the shipped filenames differ from the proposal (`knowledge_store.rs`/`knowledge_commands.rs`, not `vector_store.rs`/`rag.rs`/`rag_commands.rs`) — proposals are plans, not contracts.
- **Lesson**: For ONNX-embedding + llama.cpp coexistence, use the CPU execution provider for the small embedding model to sidestep `ort` CUDA vs. llama-cpp CUDA contention — embeds stay ~10ms while inference keeps the GPU. Brute-force cosine in SQLite is fine for <100K chunks; defer HNSW. When auditing "is it shipped", grep `lib.rs` invoke_handler for the commands, not the proposal's filenames.

## green_perf-privacy-opt_01 (2026-06-10)

- **Task**: Three optimizations — (1) KV cache q8_0 for ~50% VRAM saving, (2) Rust-side batch text redaction (10-50x faster than per-term JS regex), (3) local ONNX embeddings + SQLite to replace the mem0 cloud dependency.
- **What worked**: (1) `llama_backend.rs:775-776` `.with_type_k(KvCacheType::Q8_0)`/`.with_type_v(...)` — one-line-each, negligible quality loss. (2) `redaction.rs`/`redaction_commands.rs` expose `redact_text_command` + the `redact_messages_command` batch primitive (collapses N per-message IPC calls to 1) + `rehydrate_text_command`. (3) `local_memory.rs`/`local_memory_commands.rs` (`add_memory`/`search_memories`/`recent_memories`) move semantic memory on-device.
- **Lesson**: Push hot per-message string work (redaction over history+context+memories+canvas) across the IPC boundary into Rust as a single batch call — per-term JS regex over multi-KB content on every send is the latency trap. The shared local-embedding + SQLite store is the foundation both this change and local-rag build on; build it once.

## green_pii-pipeline-v2_01 (2026-06-10)

- **Task**: Close critical PII pipeline gaps — dedup redaction terms on import, route imported PII to the vault (not just custom redaction), extend anonymization to ALL cloud-bound content (history/context/KB/memories), add a user "auto-redact all cloud-bound content" setting.
- **What worked**: Original scope T01–T05 shipped directly in the live send path (`usePrivacyChat.ts` → `executePrivacySend`, `autoRedactAllContent` default true). Residual hardening (T06 dead leaky path, T07 asymmetric GLiNER coverage, T08 per-message IPC batching) was deliberately split out to `green_pii-pipeline-v3_01`, which shipped and archived the same day — so v2's full intent is now live across the v2+v3 pair.
- **Lesson**: When a change's residual hardening is carved into a successor change, archive the parent against the successor's shipped evidence rather than leaving it to rot "active" — but only after confirming the successor actually closed each carved item (here, v3's lesson explicitly lists dead-leaky-path / GLiNER-coverage / batch-IPC as done). Splitting "ship the obvious 80% now, harden the privacy edge-cases in a vN+1" kept each change reviewable.

## green_redaction-completeness_01 (2026-06-11)

- **Task**: Make the cloud-redaction invariant total — route the three residual bypasses (sendDirect current message, orchestration-delegated prompt, dead useChat hook) through the canonical `redactForCloud` so no path sends raw PII to a cloud LLM.
- **What worked**: T1 wrapped `sendDirect`'s current message in `redactForCloud` (GLiNER + profile-wide terms) and merged mappings into the path's existing `directMappings` so the streamed response rehydrated for free. T2 redacted the ChatML/Gemma `fullPrompt` before `orchestrated_generate` (`prompt: safePrompt`) and rehydrated `result.response` with the returned mappings; the default local `ollama_generate` path keeps the raw prompt (local-only, no leak). T3 deleted the dead `useChat.ts` after a repo-wide grep proved zero importers (only the def, the barrel export, and a doc comment remained).
- **What failed**: nothing — but auditing the T1 function surfaced a *second, undocumented* leak the proposal missed: cloud mem0 `addMemories` stored the rehydrated `fullContent` (raw PII) as the assistant memory. "Redaction completeness" means every cloud send in the function, not just the one named in the proposal — capture the pre-rehydration `redactedResponse` and store tokens (mirroring `executePrivacySend`).
- **Lesson**: When closing a "send raw PII to cloud" invariant, the audit unit is the *whole function*, not the single call site named in the proposal — the same fn that does the obvious chat send often also does a mem0/summary/title cloud write on rehydrated (raw) text. Reuse the established redact→send→rehydrate primitive (`redactForCloud`/`rehydrateFromCloud`) and merge into the path's existing mapping Map so the response rehydrates with no extra plumbing. For TS-only frontend changes against a heavy Rust crate, `git diff -- '*.rs'` being empty + a passing `tsc --noEmit` is the honest verification — running the full llama.cpp/CUDA `cargo check` only re-confirms what git proves and costs 10+ min.

## Lesson: Batch Pattern for Personas Works (green_add-personas-batch2_02)

**Context:** Adding 14 specialist advisors all at once would be a large coordinated effort. Batch 1 (5 high-sensitivity advisors: tax, health, legal, financial, negotiation) shipped with new UI controls (backend override, privacy tab, Prompt Review Modal). Batch 2 (5 complementary advisors: branding, social, real estate, cybersecurity, immigration) validated that batch 1's infrastructure scales horizontally — no new UI components, no new Rust modules, only domain quality and test coverage.

**Insight:** Large persona feature sets should be decomposed by *sensitivity* and *infrastructure readiness*, not arbitrarily by count. Batch 1 built the foundation; batch 2 proved it works across diverse domains. This reduces per-batch risk and lets later batches ship faster by reusing infrastructure.

**Application:** When shipping multiple personas: use a "foundation batch" (store, UI, privacy controls, test framework, docs) followed by "leverage batches" (reuse foundation, focus on domain quality and comprehensive testing). Splits reduce review burden per batch and allow parallel development once foundation ships.

**Tags:** #persona-development #batch-work #architecture #shipping

---

## Lesson: Privacy-First Design Requires Systematic Redaction Rules (green_add-personas-batch2_02)

**Context:** Batch 2 added 5 personas with varying privacy requirements: 2 low-sensitivity (optional anonymization), 2 high-sensitivity (required + vault), 1 max-privacy (local-only). T09 integration testing caught that missing even one `requiresPIIVault` or `anonymization_mode` field would leak PII to cloud.

**Insight:** Privacy architecture cannot rely on per-user configuration — it must be built into the persona definition itself. Every hybrid persona must explicitly declare anonymization_mode, requiresPIIVault, and preferred_backend. Missing one field cascades into leakage.

**Application:** Create a pre-flight checklist for new personas:
- [ ] Does this persona expose PII? (financial, medical, legal, personal)
- [ ] If yes, is anonymization_mode set to 'required'?
- [ ] If yes, is requiresPIIVault set to true?
- [ ] If local-only, is preferred_backend set to 'ollama'?
- [ ] Does system prompt include privacy note?

Encode rules into type definitions so omissions are caught at compile time.

**Tags:** #privacy-design #persona-development #pii-handling #architecture

---

## Lesson: Testing in Layers Catches Different Issues (green_add-personas-batch2_02)

**Context:** Batch 2 had 131+ tests across 4 layers: regression (42), golden path (38), privacy validation (42), integration (9+). Regression caught regressions. Golden path caught generic responses. Privacy validation caught missing redaction. Integration discovered missing batch 1 personas — an issue no lower layer could surface.

**Insight:** Comprehensive testing requires layered strategy, each layer testing a different concern:
1. Unit tests (definitions): Do fields compile and load?
2. Golden path (domain fit): Are responses domain-appropriate?
3. Privacy validation (security): Does redaction work? Are modes enforced?
4. Integration (E2E): Does the full app work? Do settings persist?

No single layer would have caught all issues.

**Application:** For future persona batches:
- Tier 1 (Must Have): Unit tests for definitions + structure
- Tier 2 (Critical): Golden path tests (3–5 scenarios per domain)
- Tier 3 (Privacy): Redaction validation (network audit, history check)
- Tier 4 (Shipping): Full E2E test (all 14 personas, settings persistence, edge cases)

Allocate ~50% time to Tier 1–2, ~30% to Tier 3, ~20% to Tier 4. Run sequentially.

**Tags:** #testing #qa-strategy #privacy-validation #regression-testing

---

## Lesson: Documentation Completeness Prevents Support Friction (green_add-personas-batch2_02)

**Context:** Batch 2 included full README (all 14 personas grouped), backend defaults table, per-persona specs, architecture notes, acceptance criteria per task. New developers could onboard without asking questions.

**Insight:** Complete documentation (README, architecture docs, module guides) is not "nice to have" — it's the primary mechanism for reducing support load. A developer reading "Real Estate Advisor uses hybrid + required anonymization" understands why PII redaction matters; one reading "use hybrid" without context breaks privacy.

**Application:** For any persona/feature change:
- README update: 1–2 sentence + icon + category
- Architecture doc: Design rationale (why this backend, temp, anonymization mode)
- Backend defaults table: Matrix (persona ID, backend, anonymization, vault)
- Acceptance criteria: Per-task checklist for code review and QA
- Per-module guides: Minimal examples if adding new modules

Treat docs as part of implementation, not afterthought.

**Tags:** #documentation #developer-experience #knowledge-sharing #onboarding

---

## Lesson: Integration Testing Must Be Comprehensive (green_add-personas-batch2_02)

**Context:** All unit, golden path, and privacy tests passed. T09 integration test discovered missing batch 1 personas in selector on first boot — an issue no lower layer caught because they test components in isolation, not the full user flow.

**Insight:** Integration testing must cover boot sequence (all personas load), persistence (settings saved), user flow (select → send → response), switching (mid-conversation), and edge cases (deleted personas). Unit tests rarely catch these because they're system-level concerns.

**Application:** Before shipping any persona batch:
- Run full app locally as real user
- Switch between all personas (new + batch 1 + batch 2)
- Send test messages; verify responses sensible
- Close/reopen app; verify settings persist
- Check browser console for errors
- Monitor Network tab for cloud sends + PII redaction

Document as pre-release checklist so future releases don't skip E2E.

**Tags:** #integration-testing #e2e-testing #validation #shipping
