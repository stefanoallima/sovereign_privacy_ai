# Design: Redaction Completeness

## Shared primitive (already exists — do NOT reimplement)
`apps/desktop/src/services/cloud-redaction.ts`:
- `redactForCloud(text) -> { redacted, mappings: Map<string,string> }` — GLiNER NER → stable registry tokens (`ensureRedactTerm`) + profile-wide term-matching.
- `rehydrateFromCloud(text, mappings) -> string`.
Pattern everywhere: `const { redacted, mappings } = await redactForCloud(text)` → send `redacted` → `rehydrateFromCloud(response, mappings)`.

## T1 — sendDirect current message
In `usePrivacyChat.ts` `sendDirect`: locate where the current message is pushed:
`messages.push({ role: "user", content: contentToSend.trim() })`.
Replace with a redacted push and merge mappings:
```ts
const { redacted, mappings } = await redactForCloud(contentToSend.trim());
for (const [k, v] of mappings) directMappings.set(k, v);
messages.push({ role: "user", content: redacted });
```
`directMappings` is the map already used by this path to rehydrate the streamed response (`rehydrateResponse(fullContent, directMappings)`), so the response will rehydrate correctly. Import `redactForCloud` from `@/services/cloud-redaction` (dynamic import is fine, matching the file's style).

## T2 — orchestration delegation
In `usePrivacyChat.ts` `sendLocalOnly`, before the `orchestrated_generate` invoke, redact the prompt:
```ts
const { redacted: safePrompt, mappings: orchMappings } = await redactForCloud(fullPrompt);
```
Pass `safePrompt` as the `prompt` argument (instead of the raw `fullPrompt`). Keep passing `redactionTerms`. After the call, if a cloud-assisted response came back, rehydrate it: `rehydrateFromCloud(result.response, orchMappings)` before it is displayed/stored. (Local-only responses need no rehydration, but rehydrating is harmless — tokens simply won't be present.)
Note: `fullPrompt` is the ChatML/Gemma-templated prompt; redacting it tokenizes any PII in the user message + history it contains. The template tokens (`<|im_start|>` etc.) are untouched by redaction.

## T3 — remove the dead useChat bypass
1. `grep -rn "useChat\b" apps/desktop/src --include=*.tsx --include=*.ts | grep -vE "usePrivacyChat|useChatStore|hooks/useChat.ts|hooks/index.ts|function useChat"`
2. If empty → delete `apps/desktop/src/hooks/useChat.ts`; remove the `export { useChat } from './useChat';` line from `apps/desktop/src/hooks/index.ts`.
3. If non-empty (a real importer) → leave the file; wrap each `streamChatCompletion`/`chatCompletion` send and mem0 write through `redactForCloud` / store redacted content (mirror `usePrivacyChat`).
4. `pnpm typecheck`.

## Sequencing
- T1 and T2 both edit `usePrivacyChat.ts` (SharedFile) → run sequentially.
- T3 is independent (different files) → can run in its own batch.

## Verification evidence to log
- `pnpm typecheck` output; `cargo check` output; the T3 grep result; and a manual note confirming tokens (not raw PII) in each path's outgoing payload.
