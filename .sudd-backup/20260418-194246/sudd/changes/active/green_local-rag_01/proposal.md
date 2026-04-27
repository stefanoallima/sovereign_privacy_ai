# Change: green_local-rag_01

## Status
proposed

## Summary
Implement a fully local, privacy-first RAG (Retrieval Augmented Generation) pipeline. Documents uploaded to persona knowledge bases are chunked, embedded locally (GPU-accelerated via ONNX), stored in SQLite, and retrieved via semantic search during chat. No data leaves the machine. Replaces the current mock knowledge base UI with a working pipeline.

## Motivation
- Knowledge bases are defined in types but never used — the UI is pure placeholder
- Personas promise "RAG-Powered Knowledge" but deliver nothing
- mem0 is the only semantic memory, but it's a **cloud service** — PII goes to their servers
- Users upload tax documents, medical records, contracts — these should be searchable locally
- The app has all the building blocks (ONNX runtime, SQLite, PDF parser, GPU) but no pipeline connecting them

## Architecture

```
INGEST PIPELINE (one-time per document):
  Upload PDF/DOCX/TXT → file_parsers.rs (existing)
    → Chunk text (fixed-size with overlap, ~512 tokens each)
    → Embed each chunk locally (ONNX embedding model on GPU via ort crate)
    → Store in SQLite: chunks table (text, embedding vector, metadata)

RETRIEVAL PIPELINE (per chat message):
  User message → Embed query (same ONNX model)
    → SQLite: cosine similarity search → Top-K chunks (k=5)
    → Inject as context: "Relevant knowledge:\n[chunk1]\n[chunk2]..."
    → LLM generates response with grounded knowledge

PRIVACY:
  - All embeddings computed locally (ort + CUDA)
  - All vectors stored in local SQLite
  - No cloud calls for RAG — fully offline capable
  - Knowledge base content redacted before cloud send (existing PII pipeline)
```

## Scope

### Included
- **Rust: Embedding module** (`embedding.rs`)
  - Load ONNX embedding model (e.g., all-MiniLM-L6-v2, ~80MB)
  - GPU-accelerated via ort crate (already in dependencies)
  - Embed text chunks → f32 vectors (384-dim)

- **Rust: Vector store** (`vector_store.rs`)
  - SQLite table: `kb_chunks (id, kb_id, doc_id, text, embedding BLOB, position)`
  - Cosine similarity search (brute-force for <100K chunks, fast enough)
  - CRUD for knowledge bases and documents

- **Rust: Chunking** (`chunker.rs`)
  - Fixed-size chunking with overlap (512 tokens, 64 token overlap)
  - Paragraph-aware splitting (don't break mid-sentence)
  - Metadata: source document, page number, position

- **Rust: RAG pipeline** (`rag.rs`)
  - Orchestrates: query → embed → search → format context
  - Tauri commands: `rag_ingest_document`, `rag_search`, `rag_delete_document`

- **Frontend: Knowledge base management**
  - Replace mock KnowledgeBaseSettings with real UI
  - Upload documents to knowledge bases
  - Show chunk count, embedding status, storage size
  - Per-persona knowledge base assignment (existing UI, wire to backend)

- **Frontend: Chat integration**
  - In `executePrivacySend`, retrieve relevant chunks for the active persona's knowledge bases
  - Inject as system context before the user message
  - Show "Sources" in the response (which documents were used)

- **Embedding model management**
  - Download model from HuggingFace on first use (~80MB)
  - Store in app data dir alongside LLM models
  - Settings UI to manage embedding model

### NOT included
- Hybrid search (keyword + vector) — vector-only for v1
- Re-ranking (cross-encoder) — top-K cosine is sufficient for v1
- Streaming ingestion — batch only
- Multi-modal (images in PDFs) — text-only
- Cloud RAG fallback — fully local only
- Replacing mem0 — can coexist (mem0 for conversation memory, RAG for documents)

## Success Criteria
- [ ] User can upload a PDF to a persona's knowledge base
- [ ] Document is chunked and embedded locally (GPU if available)
- [ ] Asking a question retrieves relevant chunks from the knowledge base
- [ ] Retrieved chunks appear in the LLM context (visible in privacy review)
- [ ] No network calls during RAG — fully offline
- [ ] Embedding model downloadable from Settings
- [ ] Knowledge base storage visible (chunk count, size)
- [ ] Multiple documents per knowledge base
- [ ] Multiple knowledge bases per persona

## Dependencies
- `ort` crate v2.0.0-rc.9 (already in Cargo.toml, load-dynamic)
- `rusqlite` (already in Cargo.toml, bundled SQLite)
- ONNX embedding model: `all-MiniLM-L6-v2` or `bge-small-en-v1.5` (~80MB ONNX)
- Existing: `file_parsers.rs` for document parsing

## Risks
- **ONNX + CUDA conflict**: The `ort` crate uses ONNX Runtime which has its own CUDA provider. May conflict with llama-cpp-2's CUDA usage. Mitigation: use CPU execution provider for embeddings (still fast for small models, ~10ms per chunk).
- **SQLite vector search performance**: Brute-force cosine similarity is O(n) per query. For <100K chunks, this is <100ms. For larger corpora, would need an index (HNSW). Mitigation: fine for v1, add HNSW later if needed.
- **Embedding model size**: ~80MB download. Mitigation: lazy download on first knowledge base creation.
- **Chunk quality**: Fixed-size chunking may split important context. Mitigation: paragraph-aware splitting with overlap.

## Estimated Effort
- Rust embedding module: M
- Rust vector store (SQLite): M
- Rust chunking: S
- Rust RAG pipeline + commands: M
- Frontend knowledge base UI: M
- Frontend chat integration: S
- Embedding model download: S
- Total: ~L (7 tasks across 3 batches)

## Key Files (existing, to modify)
- `src-tauri/Cargo.toml` — no new deps needed (ort, rusqlite already there)
- `src-tauri/src/lib.rs` — register new modules + commands
- `src-tauri/src/file_parsers.rs` — reuse for document parsing
- `src/hooks/usePrivacyChat.ts` — inject RAG context in executePrivacySend
- `src/components/settings/KnowledgeBaseSettings.tsx` — replace mock with real UI
- `src/components/personas/PersonaKnowledgeTab.tsx` — wire to backend
- `src/types/index.ts` — KnowledgeBase types already defined

## Key Files (new)
- `src-tauri/src/embedding.rs` — ONNX embedding model loading + inference
- `src-tauri/src/vector_store.rs` — SQLite vector storage + cosine search
- `src-tauri/src/chunker.rs` — text chunking with overlap
- `src-tauri/src/rag.rs` — RAG orchestration
- `src-tauri/src/rag_commands.rs` — Tauri command wrappers
