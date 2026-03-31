use crate::embedding::{EmbeddingBackend, EmbeddingModelInfoWithStatus};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct EmbeddingState(pub Arc<Mutex<Option<EmbeddingBackend>>>);

const UNAVAILABLE: &str = "Embedding backend unavailable (failed to initialise on startup)";

/// List all available embedding models with download status and local paths.
#[tauri::command]
pub async fn list_embedding_models(
    state: State<'_, EmbeddingState>,
) -> Result<Vec<EmbeddingModelInfoWithStatus>, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    Ok(backend.list_models())
}

/// Get the absolute path to the embedding models directory (for "Open Folder").
#[tauri::command]
pub async fn get_embedding_models_dir(
    state: State<'_, EmbeddingState>,
) -> Result<String, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    Ok(backend.get_models_directory())
}
