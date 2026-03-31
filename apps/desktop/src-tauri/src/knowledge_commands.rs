use serde::{Serialize, Deserialize};
use std::path::Path;
use tauri::State;
use tokio::sync::Mutex;
use crate::knowledge_store::{KnowledgeStore, KnowledgeBase, KbDocument, KbChunk};
use crate::file_parsers;
use crate::chunker;

pub struct KnowledgeState {
    pub store: KnowledgeStore,
}

#[derive(Serialize, Deserialize)]
pub struct IngestResult {
    pub doc_id: String,
    pub filename: String,
    pub chunk_count: usize,
    pub total_chars: usize,
}

#[tauri::command]
pub async fn ingest_document(
    kb_id: String,
    file_path: String,
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<IngestResult, String> {
    let path = Path::new(&file_path);

    // Validate file exists and size
    let metadata = std::fs::metadata(&file_path)
        .map_err(|e| format!("Cannot access file: {}", e))?;
    const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50 MB
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large ({:.1} MB). Maximum is 50 MB.",
            metadata.len() as f64 / (1024.0 * 1024.0)
        ));
    }

    // 1. Parse the file
    let parsed = file_parsers::parse_file(path)
        .map_err(|e| format!("Failed to parse file: {}", e))?;

    // 2. Chunk the text
    let text_chunks = chunker::chunk_text_default(&parsed.text_content);

    // 3. Generate a doc ID
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let random: u32 = rand::random();
    let doc_id = format!("doc-{}-{:08x}", timestamp, random);

    // 4. Add the document record
    let store = &state.lock().await.store;
    store.add_document(&doc_id, &kb_id, &parsed.filename, &parsed.file_type)?;

    // 5. Build chunk tuples and add them
    let total_chars: usize = text_chunks.iter().map(|c| c.text.len()).sum();
    let chunk_tuples: Vec<(String, String, String, i64)> = text_chunks
        .iter()
        .map(|c| (doc_id.clone(), kb_id.clone(), c.text.clone(), c.position as i64))
        .collect();
    store.add_chunks(&chunk_tuples)?;

    // 6. Return stats
    Ok(IngestResult {
        doc_id,
        filename: parsed.filename,
        chunk_count: chunk_tuples.len(),
        total_chars,
    })
}

#[tauri::command]
pub async fn create_knowledge_base(
    id: String, name: String, description: String,
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<(), String> {
    state.lock().await.store.create_kb(&id, &name, &description)
}

#[tauri::command]
pub async fn list_knowledge_bases(
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<Vec<KnowledgeBase>, String> {
    state.lock().await.store.list_kbs()
}

#[tauri::command]
pub async fn delete_knowledge_base(
    id: String,
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<(), String> {
    state.lock().await.store.delete_kb(&id)
}

#[tauri::command]
pub async fn list_kb_documents(
    kb_id: String,
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<Vec<KbDocument>, String> {
    state.lock().await.store.list_documents(&kb_id)
}

#[tauri::command]
pub async fn delete_kb_document(
    doc_id: String,
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<(), String> {
    state.lock().await.store.delete_document(&doc_id)
}

#[tauri::command]
pub async fn search_knowledge(
    query: String,
    kb_ids: Vec<String>,
    top_k: Option<usize>,
    state: State<'_, Mutex<KnowledgeState>>,
) -> Result<Vec<KbChunk>, String> {
    state.lock().await.store.search_chunks(&query, &kb_ids, top_k.unwrap_or(5))
}
