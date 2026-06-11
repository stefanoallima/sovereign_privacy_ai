# Tasks: Redaction Completeness

## T1: Redact sendDirect's current message
- **Effort**: S
- **Dependencies**: none
- **Files**: apps/desktop/src/hooks/usePrivacyChat.ts
- **SharedFiles**: apps/desktop/src/hooks/usePrivacyChat.ts
- **Description**: In `sendDirect`, route the current user message through `redactForCloud` before pushing to the cloud `messages` array; merge mappings into `directMappings` so the streamed response rehydrates. No raw PII in "direct" mode.
- [ ] Replace the raw `messages.push({ role: "user", content: contentToSend.trim() })` with a redacted push
- [ ] Merge redactForCloud mappings into directMappings
- [ ] `pnpm typecheck` passes
- [ ] Manual: a PII value in the current message is a token in the outgoing payload

## T2: GLiNER-redact the orchestration-delegated prompt
- **Effort**: M
- **Dependencies**: T1 (shares usePrivacyChat.ts — run after T1)
- **Files**: apps/desktop/src/hooks/usePrivacyChat.ts
- **SharedFiles**: apps/desktop/src/hooks/usePrivacyChat.ts
- **Description**: In `sendLocalOnly`, run `fullPrompt` through `redactForCloud` before `orchestrated_generate`; pass the redacted prompt; rehydrate the cloud-assisted response with the returned mappings. Keep passing `redactionTerms`.
- [ ] Redact fullPrompt via redactForCloud before orchestrated_generate
- [ ] Pass redacted prompt; keep redactionTerms
- [ ] Rehydrate the orchestration response before display/store
- [ ] `pnpm typecheck` passes
- [ ] Manual: a new PII value in a delegated prompt is a token in the cloud request

## T3: Remove the dead useChat bypass
- **Effort**: S
- **Dependencies**: none
- **Files**: apps/desktop/src/hooks/useChat.ts, apps/desktop/src/hooks/index.ts
- **SharedFiles**: apps/desktop/src/hooks/index.ts
- **Description**: Confirm no live importer of `useChat`; if dead, delete the hook + its export. If a live importer exists, route its cloud sends + mem0 writes through `redactForCloud` instead of deleting.
- [ ] grep for live importers (exclude usePrivacyChat/useChatStore/def/index export)
- [ ] If dead: delete useChat.ts + remove the export from hooks/index.ts
- [ ] If live: route its sends through redactForCloud / store redacted
- [ ] `pnpm typecheck` passes

## Dependency Graph
```
T1 → T2 (share usePrivacyChat.ts; strictly sequential) ... Batch 1
T3 (independent) ............................................ Batch 2
```
