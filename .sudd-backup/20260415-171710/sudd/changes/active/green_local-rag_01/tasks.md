# Tasks: Local RAG Pipeline

## T01: Rust — Document Chunker
- **Effort**: S
- **Dependencies**: none
- **Files**: src-tauri/src/chunker.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: Text chunking with paragraph-aware splitting and overlap. ~512 chars per chunk, 64 char overlap.
- [ ] Create chunker.rs with chunk_text function
- [ ] Register module in lib.rs
- [ ] Tests

## T02: Rust — Knowledge Base Store (SQLite)
- **Effort**: M
- **Dependencies**: none
- **Files**: src-tauri/src/knowledge_store.rs, src-tauri/src/knowledge_commands.rs, src-tauri/src/lib.rs
- **SharedFiles**: src-tauri/src/lib.rs
- **Description**: SQLite tables for knowledge bases, documents, and chunks. FTS5 search on chunks. CRUD operations + Tauri commands.
- [ ] Create knowledge_store.rs with SQLite schema (knowledge_bases, kb_documents, kb_chunks tables)
- [ ] FTS5 virtual table on chunks for text search
- [ ] create_kb, delete_kb, add_document, delete_document, search_chunks
- [ ] Create knowledge_commands.rs with Tauri commands
- [ ] Register in lib.rs
- [ ] Tests

## T03: Rust — Document Ingestion Pipeline
- **Effort**: M
- **Dependencies**: T01, T02
- **Files**: src-tauri/src/knowledge_commands.rs
- **SharedFiles**: none
- **Description**: Tauri command that takes a file path, parses it (existing file_parsers), chunks the text, stores chunks in the knowledge base.
- [ ] ingest_document command: parse → chunk → store
- [ ] Return ingestion stats (chunk count, total chars)

## T04: Frontend — Knowledge Base Management UI
- **Effort**: M
- **Dependencies**: T02
- **Files**: src/components/settings/KnowledgeBaseSettings.tsx
- **SharedFiles**: none
- **Description**: Replace mock KnowledgeBaseSettings with real UI. Create/delete KBs, upload documents, show stats.
- [ ] Replace mock with real Tauri invoke calls
- [ ] Create KB dialog
- [ ] Upload document to KB
- [ ] Show chunk count, document count per KB
- [ ] Delete KB / document

## T05: Frontend — Persona Knowledge Base Assignment
- **Effort**: S
- **Dependencies**: T02
- **Files**: src/components/personas/PersonaKnowledgeTab.tsx
- **SharedFiles**: none
- **Description**: Wire the existing persona knowledge tab to real backend. List available KBs, assign to persona.
- [ ] Replace mock data with invoke calls
- [ ] Save persona KB assignments

## T06: Chat Integration — RAG Retrieval
- **Effort**: M
- **Dependencies**: T02, T05
- **Files**: src/hooks/usePrivacyChat.ts
- **SharedFiles**: src/hooks/usePrivacyChat.ts
- **Description**: In executePrivacySend, retrieve relevant chunks from persona's knowledge bases and inject as context.
- [ ] Get persona's knowledgeBaseIds
- [ ] Search chunks across those KBs using user's query
- [ ] Inject top-K chunks as system context
- [ ] Apply PII redaction to retrieved chunks (existing pipeline)
- [ ] Show "Sources" info in response

## Batches
```
Batch 1: T01, T02 (independent)
Batch 2: T03 (needs T01+T02), T04 (needs T02), T05 (needs T02)
Batch 3: T06 (needs T02+T05)
```
