# Summary: green_pii-pipeline-v3_01

Residual PII-pipeline hardening (v3) — closes the three privacy gaps left after
pii-pipeline-v2: a dead leaky cloud-send path, asymmetric GLiNER coverage, and
per-message IPC in history redaction.

## What Changed

- **T1 — removed the dead leaky path** (`apps/desktop/src/services/privacy-chat-service.ts`,
  `services/index.ts`): deleted `sendPrivacyAwareChat` and `streamPrivacyAwareChat`
  (they assembled the cloud `messages` array with raw `...history` and had no
  caller), plus their now-orphaned helpers (`processWithOllama`,
  `processWithNebius`, `getPrivacyIndicatorIcon`), dead interfaces
  (`PrivacyChatOptions/Result/ProcessingInfo`), and the dead bottom re-export
  block. Kept the one consumed export, `previewPrivacyProcessing`, and trimmed
  the `index.ts` re-exports. (−364 lines net.)
- **T2 — symmetric GLiNER coverage** (`apps/desktop/src/hooks/usePrivacyChat.ts`,
  `executePrivacySend`): added a `glinerPass` helper and rewrote `maybeRedact` to
  run GLiNER NER **first** (reusing `applyGlinerPiiRedaction`) and then
  user-confirmed term-matching, for ALL cloud-bound content (history, context,
  memories, KB, canvas). The redaction gate changed from
  `!autoRedactAllContent || redactTerms.length === 0` to `!autoRedactAllContent`
  alone, so GLiNER now runs even when the user has zero custom redaction terms.
  GLiNER placeholders use the existing `[PII_<LABEL>]` scheme and merge into
  `allMappings` for rehydration; auto-persist + GLiNER-unavailable fallback are
  inherited from `applyGlinerPiiRedaction`.
- **T3 — batch history redaction** (`apps/desktop/src/hooks/usePrivacyChat.ts`):
  replaced the per-message `redact_text_command` history loop with GLiNER per
  message + a single `redact_messages_command` batch call for the term pass,
  preserving message roles and merging returned mappings. The Rust primitive
  (`redact_messages` + `redact_messages_command` + registration + regression
  test) was already present in the working tree, so T3 was TS-side wiring only.
  Falls back to per-message `redactText` if the batch command is unavailable.

## Why

PII-pipeline-v2 redacted cloud-bound content but only via term-matching against
the user's `customRedactTerms`. Three residual leaks remained: (1) an exported,
callerless function pair that bypassed redaction entirely (latent footgun for
any future import); (2) PII present in history/context that the user never
saved as a redaction term would reach the cloud in cleartext — GLiNER was only
applied to the *current* message (Gap 2, the most important for the planned
legal vertical); (3) one IPC round-trip per history message. These harden the
"PII never leaves the machine unredacted" guarantee the product depends on.

## Validation

- **Rust** `cargo test redaction` (standalone `#[path]` harness over
  `redaction.rs` + `cargo --offline`, avoiding the llama.cpp/CUDA build per spec
  FR-VERIFY): **9/9 pass**, including
  `test_redact_messages_covers_entire_conversation_not_just_last`.
- **TypeScript** `pnpm typecheck` (`tsc --noEmit`): **PASS (exit 0)**.
- **ESLint**: changed files lint with **0 errors** (`pnpm exec eslint` on the 3
  files, exit 0); only pre-existing-style warnings at untouched lines. No new
  lint problems introduced.
- **T1 acceptance grep**: `sendPrivacyAwareChat`/`streamPrivacyAwareChat` →
  **no matches** in `apps/desktop/src`.
- **FR2 behavioral inspection** (manual; no frontend test runner): traced that a
  history-only PII value absent from `customRedactTerms` is replaced by a
  `[PII_…]` placeholder in the assembled cloud `messages` and rehydrated in the
  reply. Detailed trace in `log.md`. Browser testing N/A (no personas, no dev
  server URL).

### Files Changed
- `apps/desktop/src/services/privacy-chat-service.ts` (−364, dead path removed)
- `apps/desktop/src/services/index.ts` (−2 re-exports)
- `apps/desktop/src/hooks/usePrivacyChat.ts` (+109, T2 + T3)
- Rust (`redaction.rs` / `redaction_commands.rs` / `lib.rs`): already present in
  the working tree from prior investigation; verified, not modified this session.

### Follow-ups (out of scope — pre-existing, unrelated to this change)
- `pnpm lint` is not runnable as-is: `eslint.config.js` imports `@eslint/js`
  which is **not a declared `devDependency`** (present in the pnpm store +
  lockfile but not hoisted). Recommended fix: add `@eslint/js` to
  `apps/desktop/package.json` devDependencies.
- Once resolvable, the full lint suite still reports **56 pre-existing errors**
  in untouched files: missing DOM globals (`MediaDeviceInfo`,
  `HTMLAudioElement`, `ScriptProcessorNode`, `SpeechSynthesisUtterance`) in the
  eslint `globals` block, and `no-case-declarations` in
  `rehydration-service.ts` / `userContext.ts`.

## Lessons

- A redaction gate that short-circuits on "user has no custom terms"
  (`redactTerms.length === 0`) is a privacy footgun — NER must run independently
  of the user's term list. (Root cause of Gap 2.)
- Always re-verify a session handoff doc's timestamp and scope before trusting
  it: `sudd/CURRENT_STATE.md` here was ~7 weeks stale and described a different
  SUDD instance; the live truth was `state.json.auto_session.queue_remaining`.
- Test self-contained Rust modules in heavy-build crates via a `#[path]`
  standalone harness + `cargo --offline` to skip the llama.cpp/CUDA build.

See `sudd/memory/lessons.md` for the durable entry.
