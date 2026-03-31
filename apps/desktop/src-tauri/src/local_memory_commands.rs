use tauri::State;
use tokio::sync::Mutex;
use crate::local_memory::{LocalMemoryStore, Memory};

pub struct LocalMemoryState {
    pub store: LocalMemoryStore,
}

#[tauri::command]
pub async fn add_memory(
    text: String,
    conversation_id: Option<String>,
    role: String,
    state: State<'_, Mutex<LocalMemoryState>>,
) -> Result<i64, String> {
    let state = state.lock().await;
    state.store.add_memory(&text, conversation_id.as_deref(), &role)
}

#[tauri::command]
pub async fn search_memories(
    query: String,
    top_k: Option<usize>,
    state: State<'_, Mutex<LocalMemoryState>>,
) -> Result<Vec<Memory>, String> {
    let state = state.lock().await;
    state.store.search_memories(&query, top_k.unwrap_or(5))
}

#[tauri::command]
pub async fn recent_memories(
    limit: Option<usize>,
    state: State<'_, Mutex<LocalMemoryState>>,
) -> Result<Vec<Memory>, String> {
    let state = state.lock().await;
    state.store.recent_memories(limit.unwrap_or(10))
}

#[tauri::command]
pub async fn delete_conversation_memories(
    conversation_id: String,
    state: State<'_, Mutex<LocalMemoryState>>,
) -> Result<usize, String> {
    let state = state.lock().await;
    state.store.delete_memories_by_conversation(&conversation_id)
}

#[tauri::command]
pub async fn get_memory_count(
    state: State<'_, Mutex<LocalMemoryState>>,
) -> Result<usize, String> {
    let state = state.lock().await;
    state.store.memory_count()
}
