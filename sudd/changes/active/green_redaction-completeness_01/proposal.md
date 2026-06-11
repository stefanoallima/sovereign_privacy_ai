# Change: green_redaction-completeness_01

## Status
proposed

## Summary
Make the PII-redaction invariant **total**: every path that sends text to a cloud LLM API must go through the canonical `redactForCloud` (the one profile-wide registry), so the same PII value maps to the same token everywhere and no raw PII can leave the machine. The chokepoint + main paths shipped in PR #1; this closes the three residual bypasses found in the audit.

## Motivation (audit of cloud-LLM send sites, 2026-06-11)
PR #1 introduced `apps/desktop/src/services/cloud-redaction.ts` (`redactForCloud`) and routed chat, project-summary, title-gen, mem0, and document-import through it. Three live paths still bypass it:

1. **`sendDirect` sends the current message RAW.** In `usePrivacyChat.ts`, the "direct" cloud path (cloud mode + persona without `enable_local_anonymizer`) redacts history via `maybeRedactDirect` but pushes the current user message (`contentToSend.trim()`) unredacted. For the vision there must be NO path that sends raw PII — "no anonymization" should still pseudonymize consistently.
2. **Orchestration delegation uses terms only, no GLiNER.** In `sendLocalOnly`, `orchestrated_generate` is given `redactionTerms` (profile terms) but the delegated prompt is not run through GLiNER, so a brand-new PII value appearing only in a delegated turn can reach the cloud unredacted.
3. **Legacy `useChat.ts` hook has unredacted cloud sends.** It is exported (`hooks/index.ts`) but appears unused by any component; if live it leaks, if dead it's a revivable bypass.

## Scope

### Included
- Route `sendDirect`'s current message through `redactForCloud`; merge mappings and rehydrate the response (consistent tokens even in "direct" mode).
- Run the orchestration-delegated prompt through `redactForCloud` before `orchestrated_generate`; rehydrate the returned response.
- Remove the dead `useChat.ts` hook (and its export) after confirming no live importer; if a live importer exists, route its cloud sends through `redactForCloud` instead of removing.

### NOT included
- Removing the Rust `anonymize_text`/`deanonymize_text`/`pii_mappings` round-trip — superseded for documents but kept pending a human decision (encrypted persisted store; candidate for the legal client). Out of scope here.
- localStorage at-rest encryption of the registry (secondary; tracked separately).

## Success Criteria
- [ ] No cloud-LLM send path emits a raw user-provided string: `sendDirect`, orchestration delegation, and any `useChat` send all route through `redactForCloud` (or the path is removed).
- [ ] In "direct" mode, a PII value in the current message is replaced by its stable registry token before send, and the response is rehydrated locally.
- [ ] Orchestration: a new PII value present only in a delegated prompt is redacted (GLiNER) before reaching the cloud.
- [ ] `useChat.ts` is removed (no importer) OR routes through `redactForCloud`.
- [ ] `pnpm typecheck` passes; full-crate `cargo check` passes (Rust unchanged here, so check is a guard).
- [ ] No regression in chat / hybrid / local modes.

## Key Files
- `apps/desktop/src/hooks/usePrivacyChat.ts` — `sendDirect` (T1), `sendLocalOnly` orchestration (T2)
- `apps/desktop/src/hooks/useChat.ts`, `apps/desktop/src/hooks/index.ts` — dead-hook removal (T3)
- `apps/desktop/src/services/cloud-redaction.ts` — the canonical redactor (already exists; do not duplicate)

## Risks
- **Rehydration drift**: every redaction must rehydrate its response with the same mappings, or the user sees tokens. Mitigation: follow the established redact→send→`rehydrateFromCloud` pattern.
- **Removing a live hook**: T3 must verify no importer before removal (grep). If unsure, route through `redactForCloud` instead of deleting.
- **No frontend test runner**: verify via `pnpm typecheck` + manual inspection (a PII value in each path becomes a token in the outgoing payload).
