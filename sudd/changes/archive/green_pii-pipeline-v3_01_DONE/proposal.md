# Change: green_pii-pipeline-v3_01

## Status
proposed

## Summary
Close the three residual privacy gaps left after pii-pipeline-v2 shipped: (1) a dead but exported cloud-send path that bypasses redaction, (2) GLiNER NER coverage that is applied only to the current message and not to history/context/memories, and (3) per-message IPC overhead in history redaction. These harden the "PII never leaves the machine unredacted" guarantee that the product — and the planned legal thin-client — depends on.

## Motivation (verified against live code 2026-06-10)

pii-pipeline-v2 already redacts all cloud-bound content (history, context, memories, KB, canvas) via `executePrivacySend`'s `maybeRedact`, gated by `autoRedactAllContent` (default true). Three gaps remain:

**Gap 1 — Dead leaky path.** `apps/desktop/src/services/privacy-chat-service.ts` exports `sendPrivacyAwareChat` and `streamPrivacyAwareChat`. Both build the cloud messages array with raw `...history` (no redaction) — e.g. `streamPrivacyAwareChat` at ~line 249-255. They are re-exported via `apps/desktop/src/services/index.ts` (~line 49-50) but have **no caller** in the app (the UI uses `usePrivacyChat` → `executePrivacySend`). This is a latent footgun: any future import would silently leak conversation history to the cloud.

**Gap 2 — GLiNER coverage asymmetry (most important for the legal vertical).** In `apps/desktop/src/hooks/usePrivacyChat.ts`, the *current message* is scrubbed with GLiNER NER (`applyGlinerPiiRedaction` → `detect_pii_with_gliner`) in `sendWithPrivacy` (Step 0). But history/context/memories/KB/canvas are redacted by `maybeRedact`, which only does **term-matching** against `customRedactTerms` — no GLiNER NER. A PII value present in history that was never persisted as a redaction term (e.g. from an earlier session, or a value GLiNER would catch but the user never confirmed) is sent to the cloud in cleartext. The pii-pipeline-v2 `design.md` actually specified "GLiNER + custom redaction" for all content; the implementation only delivered the term-matching half for non-current content.

**Gap 3 — Per-message IPC.** `executePrivacySend` redacts history with one `redact_text_command` Tauri call per message (loop ~line 1237-1242). A Rust batch primitive `redact_messages_command` collapses this to a single call (aligns with perf-privacy-opt's "Rust-side redaction" goal).

## Scope

### Included
- Remove (or make non-leaky) the dead `sendPrivacyAwareChat`/`streamPrivacyAwareChat` path and its re-exports.
- Extend `maybeRedact` so ALL cloud-bound content gets GLiNER NER in addition to term-matching, merging detected entities into the rehydration mappings and auto-persisting them to `customRedactTerms` (reuse the existing logic in `applyGlinerPiiRedaction`).
- Wire history redaction to the `redact_messages_command` batch primitive.

### NOT included
- Crypto/key changes (handled in `green_security-hardening_01`).
- The legal thin-client transport / Italian redaction / citation passthrough (separate future change — bigger initiative).
- Changing `autoRedactAllContent` default or the review-panel UX.

## Success Criteria
- [ ] `sendPrivacyAwareChat`/`streamPrivacyAwareChat` no longer send raw history (removed, or routed through the same redaction); no remaining importers; `services/index.ts` exports cleaned.
- [ ] With `autoRedactAllContent` on, a PII value that appears ONLY in conversation history (and is NOT in `customRedactTerms`) is replaced by a placeholder in the assembled cloud payload (GLiNER catches it).
- [ ] GLiNER-detected entities from history/context are merged into rehydration mappings so the response is rehydrated correctly.
- [ ] History redaction issues a single `redact_messages_command` call rather than one `redact_text_command` per message.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] No regression: local-only (airplane) mode and direct cloud mode behave as before.

## Key Files
- `apps/desktop/src/services/privacy-chat-service.ts` — remove dead leaky functions
- `apps/desktop/src/services/index.ts` — remove re-exports
- `apps/desktop/src/hooks/usePrivacyChat.ts` — GLiNER in maybeRedact (T2), batch wiring (T3)
- `apps/desktop/src-tauri/src/redaction.rs`, `redaction_commands.rs`, `lib.rs` — `redact_messages` batch primitive (may already be present in the working tree; see T3)

## Risks
- **Performance**: GLiNER per content-piece on every send could be slow with long histories. Mitigation: only when `autoRedactAllContent` is on; reuse one GLiNER backend; cap/skip very large content; pair with the T3 batch. Acceptance does NOT require sub-second — correctness first.
- **Rehydration drift**: GLiNER placeholders in history must use the SAME placeholder scheme already used for the current message so the response rehydrates. Mitigation: reuse `applyGlinerPiiRedaction`'s placeholder format exactly.
- **Behavioral test gap**: the frontend has no test runner. Verification is `pnpm typecheck` + `pnpm lint` + an explicit manual inspection (see specs FR-VERIFY). The Rust batch primitive is unit-testable and must have a test.
