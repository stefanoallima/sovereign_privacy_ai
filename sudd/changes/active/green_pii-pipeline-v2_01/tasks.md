# Tasks: PII Pipeline V2

> **Status note (2026-06-10):** T01–T05 verified implemented in the live path
> (`usePrivacyChat.ts` → `executePrivacySend`, `autoRedactAllContent` default true).
> Boxes checked with file:line evidence. New hardening work is T06–T08.

## T01: Deduplication in addCustomRedactTerm — DONE
- **Effort**: S
- **Dependencies**: none
- **Files**: src/stores/userContext.ts
- **SharedFiles**: none
- **Description**: Add case-insensitive value dedup check in addCustomRedactTerm. Skip if value already exists.
- [x] Add dedup check — `userContext.ts:351-355`
- [x] Also dedup in importCustomRedactTerms bulk path — `userContext.ts:412-413`

## T02: PII Vault Routing on Import — DONE
- **Effort**: S
- **Dependencies**: none
- **Files**: src/components/pii/DocumentUploadWidget.tsx
- **SharedFiles**: none
- **Description**: Fix handleDynamicConfirm to call setPIIValue for known fields. Ensure Privacy Shield counter reflects PII vault entries.
- [x] Route known fields to PII vault via setPIIValue — `DocumentUploadWidget.tsx:181-209`
- [ ] Verify Privacy Shield counter updates — confirm UI binding reads PII vault count

## T03: Auto-Redact Setting — DONE
- **Effort**: S
- **Dependencies**: none
- **Files**: src/stores/settings.ts, src/components/settings/PrivacySettings.tsx
- **SharedFiles**: src/stores/settings.ts
- **Description**: Add autoRedactAllContent boolean to AppSettings (default true). Add toggle in Privacy settings UI.
- [x] Add setting to store — `settings.ts:138` (default true), `types/index.ts:67`
- [x] Add toggle UI — PrivacySettings

## T04: Full-Pipeline Anonymization — DONE
- **Effort**: L
- **Dependencies**: T03
- **Files**: src/hooks/usePrivacyChat.ts
- **SharedFiles**: none
- **Description**: In executePrivacySend, apply redaction to conversation history, context docs, canvas docs, and memories before cloud send. Respect autoRedactAllContent.
- [x] Create reusable maybeRedact helper — `usePrivacyChat.ts:1133-1143`
- [x] Apply to conversation history messages — `:1240`
- [x] Apply to active context documents — `:1162`
- [x] Apply to canvas/project documents — `:1267`
- [x] Apply to memories — `:1193` (and KB chunks `:1221`)
- [x] Respect autoRedactAllContent setting toggle — `:1134`
- [x] Collect all mappings for rehydration — `allMappings` + `rehydrateResponse` `:1333`

## T05: Pre-Send PII Report — DONE
- **Effort**: M
- **Dependencies**: T04
- **Files**: src/hooks/usePrivacyChat.ts, src/components/chat/ChatWindow.tsx
- **SharedFiles**: src/components/chat/ChatWindow.tsx
- **Description**: In hybrid mode review panel, show PII counts found across all content with category breakdown.
- [x] Count PII entities by category during anonymization — `:1531-1668` (categoryMap, sourceCounts)
- [x] Pass counts to review panel — PendingReview.piiReport
- [x] Display summary in PromptReviewPanel — PromptReviewPanel

---

## T06: Remove dead leaky cloud path
- **Effort**: S
- **Dependencies**: none
- **Files**: src/services/privacy-chat-service.ts, src/services/index.ts
- **SharedFiles**: src/services/index.ts
- **Description**: `sendPrivacyAwareChat`/`streamPrivacyAwareChat` build the cloud messages array with raw `...history` (no redaction) and are re-exported via services/index.ts with no current caller. Deleting removes a latent leak and dead code; if a caller is ever intended, route it through executePrivacySend's redaction instead.
- [ ] Confirm no remaining callers (grep across src)
- [ ] Delete the two functions (or redact history if a caller is intended)
- [ ] Remove the re-exports from services/index.ts
- [ ] tsc typecheck passes

## T07: Symmetric GLiNER coverage on all cloud-bound content (legal-critical)
- **Effort**: M
- **Dependencies**: none (touches usePrivacyChat.ts — coordinate with T08)
- **Files**: src/hooks/usePrivacyChat.ts
- **SharedFiles**: src/hooks/usePrivacyChat.ts
- **Description**: Only the current message gets GLiNER NER (`detect_pii_with_gliner`); history/context/memories/KB/canvas get term-matching only (`customRedactTerms`). A PII value present in history but never persisted as a term leaks to the cloud. Extend `maybeRedact` to also run GLiNER NER (merge mappings into allMappings). Mind performance — pair with T08 batch and/or cache per-message results.
- [ ] Extend maybeRedact to run GLiNER NER in addition to term-matching
- [ ] Apply to history, context, memories, KB, canvas
- [ ] Merge GLiNER mappings into allMappings for rehydration
- [ ] Verify no raw PII survives in the cloud payload (inspect assembled messages)
- [ ] Guard performance (batch / cache)

## T08: Use Rust redact_messages batch primitive in executePrivacySend
- **Effort**: S
- **Dependencies**: none (Rust side already landed)
- **Files**: src/hooks/usePrivacyChat.ts (Rust: redaction.rs, redaction_commands.rs — done)
- **SharedFiles**: src/hooks/usePrivacyChat.ts
- **Description**: executePrivacySend redacts history with one `redact_text_command` IPC call per message (loop at :1237-1242). The Rust `redact_messages_command` redacts all messages in one call. Wire the history loop to it to cut N IPC crossings to 1 (aligns with perf-privacy-opt).
- [x] Rust `redact_messages` primitive + `redact_messages_command` + unit tests (9/9 green, this session)
- [ ] TS: call redact_messages_command for the history batch
- [ ] Merge returned mappings into allMappings
- [ ] tsc typecheck passes

## Dependency Graph
```
T01–T05 ........................ DONE (verified 2026-06-10)
T06 (independent) .............. Batch 1
T07, T08 (share usePrivacyChat.ts; sequence to avoid conflicts) ... Batch 2
```
