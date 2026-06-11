# Specs: Redaction Completeness

## FR1: sendDirect must not send raw PII
- In `usePrivacyChat.ts` `sendDirect` (the cloud path for personas without `enable_local_anonymizer`), the current user message MUST be redacted via `redactForCloud` before being pushed to the cloud `messages` array.
- Merge the returned mappings into the path's existing rehydration map (`directMappings`) so the streamed response is rehydrated to real values for display.
- History is already redacted there (`maybeRedactDirect`); keep it. Result: "direct" mode pseudonymizes consistently (same registry tokens), never sends raw PII.
- Acceptance: a PII value in the current message appears as its registry token in the outgoing `messages`, and the displayed response shows the real value.

## FR2: Orchestration delegation must GLiNER-redact the prompt
- In `usePrivacyChat.ts` `sendLocalOnly`, when `orchestrated_generate` is invoked (cloud delegation), the prompt MUST first pass through `redactForCloud` so GLiNER-detected new PII (not yet a custom term) is tokenized before any cloud call.
- Pass the redacted prompt; rehydrate the orchestration response with the returned mappings before display/store.
- Keep passing `redactionTerms` (defense in depth / Rust-side term match).
- Acceptance: a brand-new PII value present only in a delegated prompt is a token in the cloud request, and the response is rehydrated.

## FR3: Remove the dead useChat bypass
- Confirm no live importer: `grep -rn "useChat\b" apps/desktop/src --include=*.tsx --include=*.ts` excluding `usePrivacyChat`, `useChatStore`, the definition, and the `hooks/index.ts` export.
- If no live importer: delete `apps/desktop/src/hooks/useChat.ts` and its export line in `apps/desktop/src/hooks/index.ts`.
- If a live importer exists: do NOT delete — instead route its `streamChatCompletion` sends + mem0 writes through `redactForCloud` / store redacted content (mirror usePrivacyChat).
- Acceptance: no remaining cloud send in `useChat` that emits raw text; `pnpm typecheck` passes.

## FR-VERIFY
- `cd apps/desktop && pnpm typecheck` passes.
- `cd apps/desktop/src-tauri && cargo check` passes (Rust untouched; guard against accidental breakage — the cache is warm so this is fast).
- Manual inspection per FR1/FR2: confirm the outgoing payload contains tokens, not raw PII.
