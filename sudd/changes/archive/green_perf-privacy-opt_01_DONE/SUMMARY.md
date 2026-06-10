# Summary: green_perf-privacy-opt_01

## What Changed
Three targeted optimizations:
1. **KV cache q8_0** — `llama_backend.rs:775-776` `.with_type_k(KvCacheType::Q8_0)` / `.with_type_v(KvCacheType::Q8_0)` for ~50% KV VRAM saving, negligible quality loss.
2. **Rust-side redaction** — `redaction.rs` / `redaction_commands.rs` expose `redact_text_command`, the `redact_messages_command` batch primitive (N per-message IPC calls → 1), and `rehydrate_text_command`.
3. **Local embeddings replacing mem0** — `local_memory.rs` / `local_memory_commands.rs` (`add_memory`, `search_memories`, `recent_memories`, `delete_conversation_memories`, `get_memory_count`) keep semantic memory on-device in SQLite.

All wired into `lib.rs` invoke_handler.

## Why
KV f16 cache wasted VRAM; per-term JS regex redaction over history+context+memories+canvas on every send was slow; and mem0 sent conversation memories to a cloud service (PII leak + online requirement).

## Validation
- 16/16 tasks complete (reconciled against live code).
- KV q8_0 confirmed at `llama_backend.rs:775-776`; redaction + local_memory commands registered in `lib.rs` invoke_handler — verified live 2026-06-10.
- KV q8_0 fallback to f16 on unsupported GPUs and mem0 kept as optional fallback (no data loss).
- VRAM/latency micro-benchmarks need the full GPU build (manual follow-up).

## Lessons
Push hot per-message string work across the IPC boundary into Rust as a single batch call; the shared local-embedding + SQLite store is the foundation local-rag also builds on — build it once. See `sudd/memory/lessons.md` → green_perf-privacy-opt_01.
