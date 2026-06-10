# Tasks: PII Pipeline V3 (residual hardening)

## T1: Remove dead leaky cloud-send path
- **Effort**: S
- **Dependencies**: none
- **Files**: apps/desktop/src/services/privacy-chat-service.ts, apps/desktop/src/services/index.ts
- **SharedFiles**: apps/desktop/src/services/index.ts
- **Description**: Delete `sendPrivacyAwareChat` + `streamPrivacyAwareChat` (they assemble cloud messages with raw, unredacted history and have no caller). Remove now-unused helpers/imports (e.g. `processWithNebius`). Remove the two re-exports from `services/index.ts`. KEEP `previewPrivacyProcessing` and `processChatWithPrivacy`.
- [ ] Confirm no real callers: `grep -rn "sendPrivacyAwareChat\|streamPrivacyAwareChat" apps/desktop/src`
- [ ] Delete the two functions + dead helpers/imports
- [ ] Remove the re-exports from services/index.ts
- [ ] `pnpm typecheck` passes

## T2: GLiNER NER on all cloud-bound content
- **Effort**: M
- **Dependencies**: none
- **Files**: apps/desktop/src/hooks/usePrivacyChat.ts
- **SharedFiles**: apps/desktop/src/hooks/usePrivacyChat.ts
- **Description**: Make `maybeRedact` (in `executePrivacySend`) run GLiNER NER (reuse `applyGlinerPiiRedaction`'s core) in addition to term-matching, for history/context/memories/KB/canvas. Merge GLiNER mappings into `allMappings`; auto-persist detected entities to `customRedactTerms` (dedup-guarded). Only when `autoRedactAllContent` is on. Use the existing `[PII_<LABEL>]` placeholder format so rehydration works.
- [ ] Refactor GLiNER-redaction core to be callable on arbitrary text
- [ ] Call GLiNER + term-matching inside maybeRedact (GLiNER first)
- [ ] Merge GLiNER mappings into allMappings
- [ ] Auto-persist detected entities (dedup-guarded)
- [ ] Fallback to term-matching only if GLiNER unavailable
- [ ] Manual check: history-only PII becomes a placeholder in the assembled payload
- [ ] `pnpm typecheck` + `pnpm lint` pass

## T3: Batch history redaction via Rust redact_messages
- **Effort**: S
- **Dependencies**: T2 (shares usePrivacyChat.ts — run after T2)
- **Files**: apps/desktop/src/hooks/usePrivacyChat.ts, apps/desktop/src-tauri/src/redaction.rs, apps/desktop/src-tauri/src/redaction_commands.rs, apps/desktop/src-tauri/src/lib.rs
- **SharedFiles**: apps/desktop/src/hooks/usePrivacyChat.ts
- **Description**: Replace the per-message `redact_text_command` history loop with one `redact_messages_command` call. The Rust `redact_messages` primitive + command + lib.rs registration MAY already exist in the working tree — if so and `cargo test redaction` passes, only wire the TS side; do NOT recreate it. If absent, implement it TDD (unit test proving all messages redacted + mappings merged) then wire TS. Merge returned mappings into `allMappings`.
- [ ] Verify presence of redact_messages_command (redaction.rs / redaction_commands.rs / lib.rs); implement TDD if missing
- [ ] `cargo test redaction` passes (incl. batch test)
- [ ] Wire executePrivacySend history loop to redact_messages_command (preserve roles)
- [ ] Merge returned mappings into allMappings
- [ ] `pnpm typecheck` passes

## Dependency Graph
```
T1 (independent) ............... Batch 1
T2 → T3 (both edit usePrivacyChat.ts; strictly sequential) ... Batch 2
```
