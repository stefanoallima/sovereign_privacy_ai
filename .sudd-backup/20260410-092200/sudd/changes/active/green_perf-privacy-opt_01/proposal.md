# Change: green_perf-privacy-opt_01

## Status
proposed

## Summary
Three targeted optimizations: KV cache quantization (50% VRAM savings), Rust-side text redaction (10-50x faster PII removal), and local embeddings to replace mem0 cloud dependency.

## 1. KV Cache q8_0

**Current**: KV cache uses f16 → 896 MB for Qwen3 1.7B at 8K context
**After**: KV cache uses q8_0 → ~448 MB (50% savings)
**Impact**: Fit larger models or longer context in same 6GB VRAM
**Effort**: S — one-line change in `llama_backend.rs` context params

```rust
let ctx_params = LlamaContextParams::default()
    .with_n_ctx(...)
    .with_flash_attn(true)
    .with_type_k(GgmlType::Q8_0)   // ← add this
    .with_type_v(GgmlType::Q8_0);  // ← add this
```

Quality impact: negligible for q8_0 (virtually lossless quantization).

## 2. Rust-Side Text Redaction

**Current**: Custom redaction runs in TypeScript — regex per term per message content, applied to history + context + canvas + memories on every send. With 37+ terms × multi-KB content = slow JS string operations.

**After**: Single Tauri command `redact_text(text, terms) → { redacted, mappings }` in Rust. Compiled regex, zero-copy string ops, 10-50x faster.

**New files**:
- `src-tauri/src/redaction.rs` — Rust redaction engine
- `src-tauri/src/redaction_commands.rs` — Tauri command wrappers

**Frontend change**: Replace inline JS redaction in `usePrivacyChat.ts` with `invoke('redact_text', ...)`.

**Effort**: M

## 3. Local Embeddings (Replace mem0)

**Current**: mem0 is a cloud service — conversation memories are sent to mem0's servers for embedding and storage. PII leak risk. Requires internet.

**After**: Local embedding model (all-MiniLM-L6-v2, ~80MB ONNX) runs on device via `ort` crate. Embeddings stored in local SQLite. Semantic memory search is fully offline.

**Architecture**:
```
Chat message → embed locally (ort + ONNX model)
            → store in SQLite: memories(id, text, embedding, timestamp)
            → on new message: embed query → cosine search → top-K memories
            → inject as context (same as mem0 does now)
```

**New files**:
- `src-tauri/src/local_memory.rs` — embedding + SQLite memory store
- `src-tauri/src/local_memory_commands.rs` — Tauri commands

**Frontend change**: In `usePrivacyChat.ts`, replace mem0 API calls with local memory commands. Keep mem0 as optional fallback (user can choose in settings).

**Effort**: M-L (shared embedding model with RAG proposal)

## Dependencies
- KV cache: None (llama-cpp-2 API already supports it)
- Rust redaction: None (pure Rust, regex crate already in deps)
- Local embeddings: ONNX model download (~80MB), shared with RAG proposal (`green_local-rag_01`)

## Success Criteria
- [ ] KV cache shows `K (q8_0)` in terminal logs instead of `K (f16)`
- [ ] VRAM usage for KV cache reduced by ~50%
- [ ] Redaction of 37 terms across 10KB of content completes in <5ms (Rust) vs ~50ms+ (JS)
- [ ] Conversation memories stored locally in SQLite, not sent to mem0
- [ ] Semantic memory search works offline
- [ ] Settings toggle: "Use local memory" vs "Use mem0 (cloud)"
- [ ] No quality regression in LLM output from KV quantization

## Risks
- **KV q8_0 on CUDA**: Some older GPUs may not support q8 KV. Mitigation: fall back to f16 if error.
- **ONNX + CUDA coexistence**: ort's CUDA provider may conflict with llama-cpp's CUDA. Mitigation: use CPU execution provider for embeddings (still fast, ~10ms per embed).
- **mem0 migration**: Existing mem0 memories won't transfer. Mitigation: keep mem0 as optional, don't delete existing data.

## Relationship to Other Proposals
- Shares embedding infrastructure with `green_local-rag_01` (RAG proposal)
- If both are implemented, the embedding model + SQLite store are shared
- Recommend implementing this first — the embedding module becomes a foundation for RAG
