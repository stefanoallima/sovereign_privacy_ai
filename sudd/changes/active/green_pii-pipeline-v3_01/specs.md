# Specs: PII Pipeline V3 (residual hardening)

## FR1: Remove dead leaky cloud-send path
- `sendPrivacyAwareChat` and `streamPrivacyAwareChat` in `apps/desktop/src/services/privacy-chat-service.ts` MUST NOT build a cloud messages array containing unredacted conversation history.
- Preferred: delete both functions (they have no caller). Also delete the helper `processWithNebius` if it becomes unused.
- Remove their re-exports from `apps/desktop/src/services/index.ts`.
- Acceptance: `grep -rn "sendPrivacyAwareChat\|streamPrivacyAwareChat" apps/desktop/src` returns no matches (definition + exports gone, no importers). `previewPrivacyProcessing` (also in that file) MAY remain — it is used by `usePrivacyChat`; keep it.

## FR2: Symmetric GLiNER coverage on all cloud-bound content
- In `apps/desktop/src/hooks/usePrivacyChat.ts`, the `maybeRedact(text)` helper inside `executePrivacySend` MUST apply GLiNER NER (`detect_pii_with_gliner`) in addition to the existing `customRedactTerms` term-matching, for every cloud-bound content piece it processes (history messages, context docs, memories, KB chunks, canvas docs).
- GLiNER placeholders MUST use the SAME format already produced by `applyGlinerPiiRedaction` (`[PII_<LABEL>]`) so they merge cleanly with current-message mappings and rehydrate via the existing `rehydrateResponse`.
- GLiNER-detected entities from this content MUST be merged into `allMappings` (for response rehydration) and SHOULD be auto-persisted to `customRedactTerms` (same dedup-guarded logic already in `applyGlinerPiiRedaction`).
- Gating: only runs when `autoRedactAllContent` is true (same gate as today). When false, behavior is unchanged.
- Acceptance: a PII string present ONLY in a history message and absent from `customRedactTerms` does NOT appear verbatim in the assembled `messages` array sent to the cloud client.

## FR3: Batch history redaction via Rust
- History-message redaction in `executePrivacySend` MUST use a single `redact_messages_command` Tauri call for the batch of history messages, instead of calling `redact_text_command` once per message.
- `redact_messages_command(messages: string[], terms: RedactTerm[]) -> { messages: string[], mappings: Record<string,string>, redaction_count: number }`.
- The merged `mappings` MUST be added to `allMappings` for rehydration.
- If the Rust command is not present in the working tree, implement it in `redaction.rs` (`redact_messages`) + `redaction_commands.rs` + register in `lib.rs`, WITH a unit test (see design).

## FR-VERIFY: Verification protocol (no frontend test runner)
- Rust: `cd apps/desktop/src-tauri && cargo test redaction` (the `redaction` module tests must pass, including the batch primitive). A fast alternative that avoids the llama.cpp/CUDA build is a standalone harness that compiles only `redaction.rs` via `#[path]` — use if a full build is too slow.
- TypeScript: `cd apps/desktop && pnpm typecheck && pnpm lint` must pass.
- Behavioral (manual, document in log): construct a history with a PII value not in `customRedactTerms`, run the privacy send path with `autoRedactAllContent` on, and confirm the assembled cloud `messages` contain a placeholder, not the raw value.
