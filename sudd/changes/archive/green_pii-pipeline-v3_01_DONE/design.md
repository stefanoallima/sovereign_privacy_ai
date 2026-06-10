# Design: PII Pipeline V3 (residual hardening)

## Context the agents need
The live cloud-send path is `usePrivacyChat.ts` → `sendWithPrivacy` → `executePrivacySend`. The dead path is in `privacy-chat-service.ts`. Do NOT confuse them. `executePrivacySend` already assembles `messages` and calls `maybeRedact` on each content source, then rehydrates the streamed response with `allMappings` (`rehydrateResponse`). The current message is separately scrubbed with GLiNER in `sendWithPrivacy` Step 0 via `applyGlinerPiiRedaction`.

## T1 — Remove dead leaky path
1. `grep -rn "sendPrivacyAwareChat\|streamPrivacyAwareChat" apps/desktop/src` → confirm only the definition (privacy-chat-service.ts) and the re-export (services/index.ts) match; no real callers.
2. Delete both functions from `privacy-chat-service.ts`. Delete now-unused helpers (`processWithNebius`) and unused imports. KEEP `previewPrivacyProcessing` and `processChatWithPrivacy` usage intact (used elsewhere).
3. Remove the two names from the `export { … }` in `services/index.ts`.
4. `pnpm typecheck` to confirm nothing referenced them.

## T2 — GLiNER on all cloud-bound content
The cleanest implementation reuses existing code:
1. Refactor the GLiNER-redaction core out of `applyGlinerPiiRedaction(text, onEntities?)` so it can run on ANY text and return `{ sanitized, mappings: Map<string,string> }`. (It already does this — make it callable from `maybeRedact`.)
2. In `executePrivacySend`, change `maybeRedact(text)` so that, when `autoRedactAllContent` is on, it runs BOTH:
   - GLiNER NER on `text` (reusing the refactored helper) → placeholders `[PII_<LABEL>]`, merge mappings into `allMappings`;
   - then the existing `redactText(text, redactTerms)` term-matching.
   Order: GLiNER first (catches novel PII), then term-matching (catches user-confirmed terms). Merge all mappings into `allMappings`.
3. Reuse the existing auto-persist block from `applyGlinerPiiRedaction` (dedup-guarded `addCustomRedactTerm`) so detected entities become future terms.
4. Performance guard: GLiNER backend is already loaded (GlinerState). Skip GLiNER for empty/very short text. Do not parallel-explode — sequential per content piece is acceptable. If GLiNER is unavailable, fall back to term-matching only (the helper already try/catches and returns the input on failure).
5. Rehydration is unchanged — `rehydrateResponse(fullContent, allMappings)` already merges all mappings.

## T3 — Batch history redaction
1. Check the working tree: `redact_messages` in `apps/desktop/src-tauri/src/redaction.rs`, `redact_messages_command` in `redaction_commands.rs`, and its registration in `lib.rs`'s `invoke_handler`. It MAY already be present (added during investigation).
2. If present and `cargo test redaction` passes → no Rust work; go to step 4.
3. If absent → implement:
   ```rust
   pub struct RedactMessagesResult { pub messages: Vec<String>, pub mappings: HashMap<String,String>, pub redaction_count: usize }
   pub fn redact_messages(messages: &[String], terms: &[RedactTerm]) -> RedactMessagesResult {
       // redact_text each message, merge mappings, sum counts
   }
   ```
   Add `#[tauri::command] redact_messages_command(messages, terms)`; register in `lib.rs`. Add a unit test proving every message (not just the last) is redacted and mappings merge. TDD: test first.
4. In `executePrivacySend`, replace the per-message history loop (`for (const msg of history) messages.push({ role, content: await maybeRedact(msg.content) })`) with: collect history contents → one `invoke('redact_messages_command', { messages, terms: redactTerms })` → push redacted contents (preserving roles) → merge returned mappings into `allMappings`.
   - IMPORTANT: history still also needs GLiNER (T2). Either run GLiNER over the history batch first, or apply the T2 `maybeRedact` (GLiNER) then the batch term-pass. Keep it correct over clever: GLiNER per message (T2) + a single term-redaction batch call (T3) is acceptable. Coordinate with T2 since both edit the history assembly in `executePrivacySend`.

## Sequencing
- T1 is independent (different file).
- T2 and T3 BOTH edit `executePrivacySend` in `usePrivacyChat.ts` → SharedFile. Execute T2 then T3 sequentially in the same workspace (no parallel worktrees) to avoid merge conflicts.

## Acceptance evidence to capture in log.md
- `grep` output proving T1 removal.
- `cargo test redaction` output for T3.
- `pnpm typecheck` + `pnpm lint` output.
- The manual inspection note for FR2 (history-only PII becomes a placeholder).
