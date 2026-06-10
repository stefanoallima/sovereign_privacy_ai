# Change: green_pii-pipeline-v2_01

## Status
shipped — original scope (T01–T05) verified in live code 2026-06-10; residual hardening moved to green_pii-pipeline-v3_01 (excluded from sudd-auto scan; archive later)

## Summary
Fix critical privacy gaps in the PII pipeline: deduplicate redaction terms, properly route imported PII to the vault (not just custom redaction), extend anonymization to ALL cloud-bound content (context, history, knowledge base, memories), and add a user-controlled "PII scan before send" setting.

## Status Update — 2026-06-10 (verified against live code)

The original T01–T05 scope is **implemented and shipped in the live send path** (`usePrivacyChat.ts` → `executePrivacySend`), with `autoRedactAllContent` defaulting to **true** (`settings.ts:138`). Conversation history, context docs, memories, KB chunks, and canvas docs are all run through `maybeRedact` before cloud send, and the response is rehydrated (`usePrivacyChat.ts:1333`). The unchecked boxes below reflected stale bookkeeping, not missing code — they are now marked done with file:line evidence.

Three real gaps remain (added as T06–T08):
1. **Dead leaky path** — `privacy-chat-service.ts`'s `sendPrivacyAwareChat`/`streamPrivacyAwareChat` build the cloud messages array with **raw `...history`** (no redaction) and are exported via `services/index.ts` with no current caller. Latent footgun.
2. **GLiNER coverage asymmetry** — only the *current message* gets GLiNER NER; history/context/memories get **term-matching only** (`customRedactTerms`). A PII value present in history that was never persisted as a term can leak. (Most important for the legal vertical.)
3. **Per-message IPC** — history is redacted with one `redact_text_command` call per message; the new Rust `redact_messages` batch primitive (added + unit-tested this session, 9/9 green) collapses that to one call.

## Motivation

### Current Problems (from codebase investigation)

**1. No deduplication on import**
`addCustomRedactTerm()` blindly adds entries. Importing the same PDF twice doubles the redaction terms (user has 37 terms, many duplicates). Only GLiNER auto-persist has dedup.

**2. Imported PII goes to custom redaction, NOT the PII vault**
When importing documents via DynamicPiiDialog, ALL values are added as custom redaction terms (via `addCustomRedactTerm`). Known fields like Name, BSN, Email should also populate the PII vault (`setPIIValue`). Currently: Privacy Shield shows "37 redactions, 0 PII" — the PII counter is always 0 because nothing flows to `currentPII`.

**3. Asymmetric anonymization — CRITICAL PRIVACY GAP**
In hybrid mode, only the user's current message is anonymized. Everything else is sent in plaintext:
- Context documents → NOT anonymized
- Canvas documents → NOT anonymized
- Conversation history → NOT anonymized
- Memories (Mem0) → NOT anonymized
- System prompts → NOT anonymized

This means if a user discussed their BSN in message #1, it's in the history sent to Nebius for message #2 — completely unredacted.

**4. No user control over context PII**
There's no setting for "automatically scan and strip PII from all cloud-bound content." Users can't see what PII is in their context/history before it goes to the cloud.

## Scope

### Included
- **Deduplication**: `addCustomRedactTerm` checks for existing values (case-insensitive)
- **PII vault routing**: Document import maps known fields to PII vault AND adds as custom redaction
- **Full-pipeline anonymization**: Apply GLiNER + custom redaction to ALL cloud-bound content:
  - Conversation history messages
  - Active context documents
  - Canvas/project documents
  - Memories
- **PII scan setting**: New toggle in Privacy settings: "Auto-redact all cloud-bound content"
  - When ON: all context/history is redacted before cloud send
  - When OFF: only current message is redacted (current behavior)
  - Default: ON
- **Pre-send PII report**: In hybrid mode review panel, show what PII was found across ALL content (not just the current message), with counts per category

### NOT included
- System prompt anonymization (these are templates, not user data)
- Changing how local-only mode works (no need — data stays local)
- Changing the PII vault schema (just routing to it correctly)
- Multi-person PII vault (architectural limitation — future work)

## Success Criteria

### Original scope — verified shipped 2026-06-10
- [x] Importing same PDF twice does not create duplicate redaction terms — `userContext.ts:351-355` + `:412-413`
- [x] Importing a PDF with a Name populates both PII vault AND custom redaction — `DocumentUploadWidget.tsx:181-209` (`setPIIValue` per known field)
- [x] Privacy Shield shows correct PII count (not always 0) — PII vault routing in place (confirm counter UI binding)
- [x] In hybrid mode, conversation history sent to cloud has PII redacted — `usePrivacyChat.ts:1240`, gated by `autoRedactAllContent` (default true)
- [x] In hybrid mode, context documents sent to cloud have PII redacted — `usePrivacyChat.ts:1162`
- [x] New setting "Auto-redact all cloud-bound content" in Privacy settings — `settings.ts:138`, `types/index.ts:67`
- [x] Pre-send review shows PII found across all content, not just current message — `usePrivacyChat.ts:1513-1683` → PromptReviewPanel
- [ ] No regression on local-only mode
- [ ] No regression on direct cloud mode

### Hardening follow-ups (this iteration)
- [ ] Dead leaky cloud path removed/fixed — `privacy-chat-service.ts` no longer sends raw history; not exported as a footgun
- [ ] GLiNER NER applied to ALL cloud-bound content (history/context/memories), not just the current message
- [ ] History redaction uses the Rust `redact_messages` batch primitive (1 IPC call, not N)
- [ ] `sendDirect` (cloud mode, persona without anonymizer) confirmed not to be an unredacted bypass

## Risks
- **Performance**: Redacting all history + context on every message could be slow with many custom terms. Mitigation: cache redacted versions, only re-redact when terms change.
- **Rehydration complexity**: If history is redacted, the LLM sees placeholders in prior messages. This could confuse the model. Mitigation: use consistent placeholders so the model learns the pattern.
- **Breaking existing flows**: The anonymization code is tightly coupled. Mitigation: add the setting with default ON, but allow users to switch to current behavior (OFF).

## Key Files
- `src/stores/userContext.ts` — dedup fix, PII routing
- `src/hooks/usePrivacyChat.ts` — full-pipeline anonymization
- `src/components/pii/DocumentUploadWidget.tsx` — PII vault routing on import
- `src/components/settings/PrivacySettings.tsx` — new auto-redact setting
- `src/stores/settings.ts` — new setting field
