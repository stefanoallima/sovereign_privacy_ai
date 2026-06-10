# Log: green_pii-pipeline-v3_01

Mode: brown · Started: 2026-06-10

## Session Start — State Reconciliation

- `sudd/CURRENT_STATE.md` was stale (refreshed 2026-04-20) and described a
  different SUDD instance — ignored per the trust contract; re-verified against
  the filesystem.
- Real state: `state.json.auto_session.queue_remaining[0]` = this change in
  `brown` mode. Planning artifacts (proposal/specs/design/tasks) already exist
  and were verified against live code on 2026-06-10. No personas dir (infra
  hardening change) → persona early-validation / design-gate steps N/A.
- Phase advanced inception → build (planning complete).

## Pre-Build Code Verification (against the plan's claims)

- **T1**: `sendPrivacyAwareChat` / `streamPrivacyAwareChat` exist only as
  definitions in `privacy-chat-service.ts` and re-exports in `services/index.ts`
  (lines 49-50). `grep` shows NO real callers. Helpers `processWithOllama`,
  `processWithNebius`, `getPrivacyIndicatorIcon` and interfaces
  `PrivacyChatOptions/Result/ProcessingInfo` are used ONLY by those two
  functions → become dead on removal. `previewPrivacyProcessing` is the only
  consumed export (used by `usePrivacyChat.ts:445`) → KEEP. Confirmed nothing
  imports the bottom re-export block's symbols from this module.
- **T2**: `executePrivacySend.maybeRedact` (usePrivacyChat.ts ~1133) currently
  does term-matching only and is gated `!autoRedactAllContent || redactTerms.length === 0`
  — so with zero custom terms it skips entirely (= Gap 2). GLiNER core
  `applyGlinerPiiRedaction` already returns `{sanitized, mappings}` on arbitrary
  text and auto-persists detected entities → reusable.
- **T3**: **Rust side already shipped in the working tree** — `redact_messages`
  + `RedactMessagesResult` + regression test in `redaction.rs`,
  `redact_messages_command` in `redaction_commands.rs`, and registration in
  `lib.rs:402`. T3 reduces to wiring the TS history loop (1237-1242) to the
  batch command.

## Implementation

- **T1** (`privacy-chat-service.ts`, `services/index.ts`): deleted
  `sendPrivacyAwareChat` + `streamPrivacyAwareChat` + their only-callers helpers
  (`processWithOllama`, `processWithNebius`, `getPrivacyIndicatorIcon`) + dead
  interfaces (`PrivacyChatOptions/Result/ProcessingInfo`) + dead bottom
  re-export block. Kept `previewPrivacyProcessing` (sole consumed export, used
  by `usePrivacyChat.ts:445`). Trimmed re-exports in `index.ts`. Net −364 lines.
- **T2** (`usePrivacyChat.ts` `executePrivacySend`): added `glinerPass(text)`
  (GLiNER NER via `applyGlinerPiiRedaction`, merges into `allMappings`, gated by
  `autoRedactAllContent` only). Rewrote `maybeRedact` = GLiNER first → then
  term-matching when terms exist. **Critical**: old gate was
  `!autoRedactAllContent || redactTerms.length === 0` (skipped entirely with no
  terms = Gap 2); new gate is `!autoRedactAllContent` so GLiNER always runs.
  Auto-persist + GLiNER failure fallback are inherited from
  `applyGlinerPiiRedaction`.
- **T3** (`usePrivacyChat.ts` history loop): GLiNER per message (sequential),
  then ONE `redact_messages_command` batch call for the term pass (was one
  `redact_text_command` per message). Mappings merged; roles preserved;
  try/catch falls back to per-message `redactText` if the Rust command is
  absent. Redaction-off branch pushes raw history (behavior preserved).

## Validation (FR-VERIFY)

- **Rust** `cargo test redaction` — ran via standalone `#[path]` harness over
  `redaction.rs` (avoids the heavy llama.cpp/CUDA build, per spec; deps from
  cargo cache with `--offline`). **9/9 pass**, incl.
  `test_redact_messages_covers_entire_conversation_not_just_last`.
- **TypeScript** `pnpm typecheck` (`tsc --noEmit`) — **PASS (exit 0)**.
- **ESLint** — scoped lint on the 3 changed files: **0 errors** (exit 0); only
  pre-existing-style `no-explicit-any`/`exhaustive-deps` warnings at lines NOT
  touched by this change. **My changes introduce zero new lint problems.**
  Full-suite `pnpm lint` exits 1 due to **pre-existing breakage unrelated to
  this change**: (a) `eslint.config.js` imports `@eslint/js` which is not a
  declared `devDependency` (present in pnpm store/lockfile but not hoisted), and
  (b) 56 pre-existing errors in untouched files — missing DOM globals
  (`MediaDeviceInfo`, `HTMLAudioElement`, `ScriptProcessorNode`,
  `SpeechSynthesisUtterance`) in the config `globals` list + `no-case-declarations`
  in `rehydration-service.ts`/`userContext.ts`. See SUMMARY "Follow-ups".
- **T1 acceptance grep** `grep -rn "sendPrivacyAwareChat\|streamPrivacyAwareChat" apps/desktop/src`
  → **no matches** (exit 1).

### FR2 behavioral inspection (manual — no frontend test runner)

Trace with `autoRedactAllContent = true`, a history turn `"My SSN is 123-45-6789"`,
and `123-45-6789` NOT in `customRedactTerms`:
1. History block (T3) takes the `autoRedactAllContent` branch.
2. `glinerPass("My SSN is 123-45-6789")` → `applyGlinerPiiRedaction` detects the
   SSN → returns `"My SSN is [PII_…]"`; mapping `[PII_…] → 123-45-6789` merged
   into `allMappings`.
3. Batch term pass (or GLiNER-only branch when no terms) pushes the
   **GLiNER-sanitized** text into `messages`.
4. ∴ assembled cloud `messages` contain the **placeholder, not the raw SSN**;
   `rehydrateResponse(fullContent, allMappings)` restores it in the reply.

Pre-change: the old `maybeRedact` returned early (no terms) or did term-only,
so the raw SSN would have reached the cloud. **Gap 2 closed.**

Browser testing N/A: no personas dir for this change and no `dev_server.url`
configured (`sudd.yaml audit.url` empty) → gate.md's browser step does not apply.

## Outcome: DONE
