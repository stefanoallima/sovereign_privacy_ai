<!-- refreshed-at: 2026-06-10T21:55:00Z -->
# Current State

## TL;DR

1 active, 0 stuck, 0 dirty, 0 inbox, 0 queued · refreshed 2026-06-10T21:55:00Z

The active queue is clean: the five formed AILocalMind changes that had been sitting as "shipped — archive later" debt (form-fill, gemma4-orchestration, local-rag, perf-privacy-opt, pii-pipeline-v2) were verified against live code and archived DONE this session. The only remaining `active/` entry is an empty `brown_night-queue_01` stub (no proposal/specs/design/tasks). Nothing is stuck, queued, or in the inbox — there is no pending build work; intake is the bottleneck, not throughput.

## Active

- [`brown_night-queue_01`](changes/active/brown_night-queue_01/) — Empty stub: only an empty `personas/` dir, no proposal/specs/design/tasks. Never started; candidate to flesh out or discard.

## Stuck

_none_

## Dirty (shipped, needs cleanup)

_none_

## Just Shipped (last 10)

- [`green_pii-pipeline-v2_01`](changes/archive/green_pii-pipeline-v2_01_DONE/) — Closed critical PII gaps: dedup-on-import, PII-vault routing, full-pipeline anonymization of all cloud-bound content (history/context/KB/memories/canvas), and the "auto-redact all cloud-bound content" setting (default ON). Residual hardening shipped via pii-pipeline-v3.
- [`green_perf-privacy-opt_01`](changes/archive/green_perf-privacy-opt_01_DONE/) — KV cache q8_0 (~50% VRAM saving), Rust-side batch redaction (`redact_messages_command`), and local ONNX embeddings + SQLite replacing the mem0 cloud dependency.
- [`green_local-rag_01`](changes/archive/green_local-rag_01_DONE/) — Fully local privacy-first RAG: ONNX embedding (`ort`), overlap chunking, SQLite vector store with cosine top-K retrieval injected into chat context. Replaced the mock knowledge-base UI.
- [`green_gemma4-orchestration_01`](changes/archive/green_gemma4-orchestration_01_DONE/) — Gemma 4 E4B (128k context) as a selectable local model + orchestration layer that delegates anonymized knowledge-gap sub-questions to the cloud model.
- [`green_form-fill_01`](changes/archive/green_form-fill_01_DONE/) — Privacy-first form-fill pipeline (PDF/DOCX/MD/TXT): LLM analyzes form structure only, simple fields filled locally, reasoning fields composed via placeholder tokens rehydrated on-device, template-preserving export.
- [`green_security-hardening_01`](changes/archive/green_security-hardening_01_DONE/) — Four adversarial-report findings: plaintext key on disk (F-01), unencrypted PII in anonymization mappings (F-02), disabled CSP (F-03), API-key prefix in logs (F-04).
- [`green_pii-pipeline-v3_01`](changes/archive/green_pii-pipeline-v3_01_DONE/) — Residual cloud-leak hardening carved out of pii-v2: removed dead leaky path, made GLiNER NER cover all cloud-bound content (not just current message), batched per-message redaction IPC.
- [`green_dynamic-gpu_01`](changes/archive/green_dynamic-gpu_01_DONE/) — Dynamic GPU detection/configuration.
- [`green_custom-model-hf_01`](changes/archive/green_custom-model-hf_01_DONE/) — Custom HuggingFace model support.
- [`ported-superpowers-2026-03-28-form-fill-design`](changes/archive/ported-superpowers-2026-03-28-form-fill-design_SUPERSEDED/) — Early superpowers-ported form-fill design, superseded by green_form-fill_01.

## Inbox (unpromoted)

_none_

## Next up

_none_

## Trajectory vs Vision

Note: `sudd/vision.md` currently describes the **SUDD framework itself**, not this repo's actual product (**AILocalMind** — a privacy-first Tauri/React/Rust desktop AI assistant). The vision doc is stale/mismatched and should be re-pointed at AILocalMind before the next planning cycle. Judged against the *real* product, recent trajectory is strongly coherent: a sustained push on the privacy-first core — local RAG, local embeddings/memory (killing the mem0 cloud dependency), full-pipeline PII anonymization, security hardening, plus capability (Gemma 4 128k, form-fill, dynamic GPU). Every shipped change reinforces "PII never leaves the machine." The main gaps are process, not direction: the mismatched vision.md and an empty `brown_night-queue_01` stub. [MOUNTAIN]

## Health

- Last audit health: _unknown_
- Last audit at: 2026-04-15T16:58:40Z
- State doc refreshed: 2026-06-10T21:55:00Z (manual — `sudd state --refresh` LLM TL;DR/Trajectory generators unavailable in this context)
