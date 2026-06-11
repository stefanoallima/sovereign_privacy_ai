# Log: green_redaction-completeness_01

Mode: brown · Autonomy: full · Started by `/sudd-run brown green_redaction-completeness_01`

## Build

### Pre-build discovery (read actual code)
- `cloud-redaction.ts` confirmed canonical: `redactForCloud(text) -> {redacted, mappings}` (GLiNER NER → stable `ensureRedactTerm` tokens + profile-wide term match) and `rehydrateFromCloud(text, mappings)`. Do NOT reimplement.
- T1 site: `usePrivacyChat.ts` `sendDirect` (~L1910). Current message pushed raw-after-term-only at `messages.push({ role:"user", content: contentToSend.trim() })` (L2053). Also found a **second, undocumented leak in the same fn**: cloud mem0 `addMemories` stored the *rehydrated* `fullContent` (raw PII) as the assistant memory (L2114) and term-only `contentToSend` as user memory — fixing both is required by Success Criterion #1 ("no cloud-LLM send path emits a raw user-provided string"). Mirrored `executePrivacySend`'s redacted-memory pattern.
- T2 site: `sendLocalOnly` orchestration (L948-989). `orchestrated_generate` got `prompt: fullPrompt` (raw) + `redactionTerms` (term-match only, applied Rust-side; no GLiNER). Only reached when persona has `enable_cloud_delegation === true` — the default `ollama_generate` path keeps the raw prompt (local-only, no leak).
- T3 site: `useChat.ts` exported from `hooks/index.ts:7`. Grep across `apps/desktop` (excl. node_modules): only the definition, the barrel export, and a doc-comment mention in `usePrivacyChat.ts:4`. **No live importer → dead.** It has raw cloud `streamChatCompletion` sends + raw mem0 writes → revivable bypass. Delete per design.

### Batch 1 — T1 then T2 (share usePrivacyChat.ts, sequential)
- **T1**: route `sendDirect` current message through `redactForCloud` (dynamic import, matches file style); merge mappings into existing `directMappings` so the streamed response rehydrates. Captured `redactedResponse` (pre-rehydration) and switched user/assistant memory writes (local + cloud mem0) to the tokenized values.
- **T2**: redact `fullPrompt` via `redactForCloud` before `orchestrated_generate`; pass `safePrompt`; keep `redactionTerms`; rehydrate `result.response` with the returned mappings before clean/display/store.

### Batch 2 — T3
- Deleted `apps/desktop/src/hooks/useChat.ts`; removed `export { useChat } from './useChat';` from `hooks/index.ts`.
