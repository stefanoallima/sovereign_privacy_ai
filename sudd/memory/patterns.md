# SUDD2 Patterns

Patterns are lessons that appear 3+ times. Automatically promoted from `lessons.md` by the learning-engine agent.

## Failure Patterns

(No patterns detected yet)

## Success Patterns

### Single cloud-redaction chokepoint + placeholder-token/rehydration
**Occurrences (4):** green_pii-pipeline-v2_01, green_gemma4-orchestration_01, green_perf-privacy-opt_01, green_redaction-completeness_01

Every path that sends text to a cloud LLM must funnel through ONE redaction primitive
rather than scattering anonymization across call sites. The reusable shape:
`redactForCloud(text) -> { redacted, mappings }` (GLiNER NER → **stable, profile-wide**
tokens via `ensureRedactTerm` + term-matching) → send `redacted` → `rehydrateFromCloud(response, mappings)`
to restore real values locally. Stable tokens mean the same PII value maps to the same
token across every conversation/document, preserving narrative coherence for the model.

Apply this when: adding any new outbound LLM call (chat, mem0/memory write, summary,
title-gen, orchestration delegation, document import). The audit unit is the **whole
function**, not the one call site named in the proposal — the same fn that does the chat
send often also does a mem0/summary cloud write on rehydrated (raw) text. Push hot
per-message redaction across the IPC boundary into Rust as a single batch call.
