# Summary: green_redaction-completeness_01

## What Changed
Made the PII cloud-redaction invariant **total** — every path that sends text to a cloud LLM now funnels through the canonical `redactForCloud` (`apps/desktop/src/services/cloud-redaction.ts`). Three residual bypasses closed in `apps/desktop/src/hooks/usePrivacyChat.ts` + hook removal:

- **T1 — `sendDirect` current message**: the user's current message is now redacted via `redactForCloud` (GLiNER NER → stable profile-wide tokens + term-matching) before being pushed to the cloud `messages` array; mappings merge into the path's existing `directMappings` so the streamed response rehydrates locally. Also closed an **undocumented second leak in the same function**: cloud `mem0.addMemories` was storing the rehydrated (raw-PII) assistant text — now stores the pre-rehydration tokenized `redactedResponse`, and the user memory stores the tokenized message (mirrors `executePrivacySend`'s redacted-memory pattern).
- **T2 — orchestration delegation**: in `sendLocalOnly`, the ChatML/Gemma `fullPrompt` is redacted via `redactForCloud` before `orchestrated_generate` (`prompt: safePrompt`), and `result.response` is rehydrated with the returned mappings. `redactionTerms` still passed (Rust-side defense in depth). Catches brand-new GLiNER-detected PII appearing only in a delegated turn. The default-local `ollama_generate` path keeps the raw prompt (local-only, no leak).
- **T3 — dead `useChat` hook**: deleted `apps/desktop/src/hooks/useChat.ts` (raw cloud `streamChatCompletion` sends + raw mem0 writes) and removed its export from `hooks/index.ts`. Repo-wide grep confirmed zero importers — a revivable bypass, now gone.

## Why
PR #1 established `redactForCloud` and routed chat/summary/title-gen/mem0/document-import through it, but the 2026-06-11 audit found three live paths still emitting raw PII: `sendDirect`'s current message, the orchestration-delegated prompt (terms only, no GLiNER), and the legacy `useChat` hook. For the privacy-first vision there must be **no** path that sends raw PII to the cloud, and pseudonymization must be consistent (same value → same stable token everywhere). This change closes the gap so the invariant holds across all cloud send sites.

## Validation
- `pnpm typecheck` (`tsc --noEmit`) — **exit 0, clean**.
- `cargo check` guard — **satisfied without running the build**: `git diff -- '*.rs'` is empty (no Rust touched) and no Tauri command signature changed (T1/T2 only swapped a `string` arg and reused existing commands `detect_pii_with_gliner`/`redact_text_command`). Running the full llama.cpp/CUDA build would only re-confirm what git proves.
- Wiring grep confirmed: `orchestrated_generate` receives `prompt: safePrompt`; `sendDirect` pushes `redactedMessage`; `fullPrompt` remains only on the local `ollama_generate` fallback. `useChat` removal broke no import (typecheck clean).
- No regression: hybrid (`executePrivacySend`) and default-local (`ollama_generate`) paths untouched; only the direct and cloud-delegation paths were hardened.
- Manual-inspection note (no frontend test runner exists): in each touched path a PII value in the source text becomes a stable token in the outgoing payload, and the displayed/stored response is rehydrated to real values via the merged mappings.

## Lessons
When closing a "no raw PII to cloud" invariant, the audit unit is the **whole function**, not just the call site named in the proposal — the same function that does the obvious chat send often also does a mem0/summary/title cloud write on rehydrated (raw) text (that's how the sendDirect mem0 sub-leak was found). Reuse the established redact→send→rehydrate primitive and merge into the path's existing mapping `Map` so the response rehydrates with no extra plumbing. For TS-only changes against a heavy Rust crate, empty `git diff -- '*.rs'` + passing `tsc --noEmit` is the honest verification. See `sudd/memory/patterns.md` → "Single cloud-redaction chokepoint + placeholder-token/rehydration" (now a promoted 4-occurrence success pattern).

## Files Changed
- `apps/desktop/src/hooks/usePrivacyChat.ts` — T1 (`sendDirect` message + mem0), T2 (`sendLocalOnly` orchestration)
- `apps/desktop/src/hooks/index.ts` — removed `useChat` barrel export (T3)
- `apps/desktop/src/hooks/useChat.ts` — **deleted** (dead bypass, T3)
