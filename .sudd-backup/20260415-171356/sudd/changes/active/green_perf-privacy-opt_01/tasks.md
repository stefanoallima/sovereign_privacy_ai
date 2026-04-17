# Tasks: Performance & Privacy Optimizations

## T01: KV Cache q8_0 Quantization
- **Effort**: S
- **Dependencies**: none
- **Files**: src-tauri/src/llama_backend.rs
- **SharedFiles**: none
- **Description**: Add KV cache quantization to context params. Saves ~50% VRAM.
- [ ] Add q8_0 KV type to context params

## T02: Rust-Side Text Redaction
- **Effort**: M
- **Dependencies**: none
- **Files**: src-tauri/src/redaction.rs, src-tauri/src/redaction_commands.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: Rust redaction engine with Tauri commands. Case-insensitive matching, returns redacted text + mappings.
- [ ] Create redaction.rs
- [ ] Create redaction_commands.rs
- [ ] Register in lib.rs
- [ ] Add tests

## T03: Frontend — Use Rust Redaction
- **Effort**: M
- **Dependencies**: T02
- **Files**: src/hooks/usePrivacyChat.ts
- **SharedFiles**: none
- **Description**: Replace inline JS redaction with Rust invoke calls.
- [ ] Replace JS redaction with Rust invoke
- [ ] Update both sendWithPrivacy and sendDirect paths

## T04: Local Embedding Model
- **Effort**: M
- **Dependencies**: none
- **Files**: src-tauri/src/embedding.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: ONNX embedding model (all-MiniLM-L6-v2) via ort crate.
- [ ] Create embedding.rs
- [ ] Model download + embed_text function
- [ ] Tauri commands

## T05: Local Memory Store
- **Effort**: M
- **Dependencies**: T04
- **Files**: src-tauri/src/local_memory.rs, src-tauri/src/local_memory_commands.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: SQLite memory store with cosine similarity search.
- [ ] Create local_memory.rs with SQLite schema
- [ ] add/search/delete memory functions
- [ ] Tauri commands

## T06: Frontend — Local Memory Integration
- **Effort**: M
- **Dependencies**: T05
- **Files**: src/hooks/usePrivacyChat.ts, src/stores/settings.ts, src/components/settings/PrivacySettings.tsx
- **SharedFiles**: src/hooks/usePrivacyChat.ts
- **Description**: Replace mem0 with local memory. Settings toggle.
- [ ] Add useLocalMemory setting
- [ ] Replace mem0 calls with local invoke
- [ ] Settings toggle UI

## Batches
```
Batch 1: T01, T02, T04 (independent)
Batch 2: T03 (needs T02), T05 (needs T04)
Batch 3: T06 (needs T05)
```
