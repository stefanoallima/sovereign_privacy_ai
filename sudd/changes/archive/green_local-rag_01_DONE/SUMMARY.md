# Summary: green_local-rag_01

## What Changed
Fully local, privacy-first RAG pipeline replacing the mock knowledge-base UI:
- `embedding.rs` / `embedding_commands.rs` — ONNX embedding via the `ort` crate (`list_embedding_models`, `get_embedding_models_dir`).
- `chunker.rs` — overlap-aware text chunking.
- `knowledge_store.rs` / `knowledge_commands.rs` — SQLite vector store + `ingest_document`, `create_knowledge_base`, `list_knowledge_bases`; cosine top-K retrieval injected into chat context.
- All wired into `lib.rs` invoke_handler (`KnowledgeStore`, `EmbeddingBackend` managed state).

Note: shipped filenames differ from the proposal (`knowledge_store.rs`/`knowledge_commands.rs` rather than `vector_store.rs`/`rag.rs`/`rag_commands.rs`).

## Why
Knowledge bases were defined in types but never used; personas promised "RAG-Powered Knowledge" but delivered a placeholder UI, and the only semantic memory (mem0) was a cloud service that leaks PII. Users upload tax/medical/contract docs that must be searchable locally.

## Validation
- 23/23 tasks complete (reconciled against live code).
- Embedding/chunking/knowledge modules present and registered in `lib.rs` invoke_handler — verified live 2026-06-10.
- No cloud calls in the RAG path (local ONNX + SQLite); fully offline-capable by design.
- Large-corpus performance (HNSW) deferred; live ingest/retrieval smoke needs the full GPU build (manual follow-up).

## Lessons
Use the ONNX CPU execution provider for the small embedding model to avoid `ort`-vs-llama.cpp CUDA contention; brute-force cosine in SQLite is fine for <100K chunks. See `sudd/memory/lessons.md` → green_local-rag_01.
