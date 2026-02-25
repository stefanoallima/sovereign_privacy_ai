use crate::gliner::{DetectedEntity, GlinerBackend, GlinerModelInfoWithStatus};
use log::info;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct GlinerState(pub Arc<Mutex<Option<GlinerBackend>>>);

const UNAVAILABLE: &str = "GLiNER backend unavailable (failed to initialise on startup)";

/// List all available GLiNER models with download status and local paths.
#[tauri::command]
pub async fn list_gliner_models(
    state: State<'_, GlinerState>,
) -> Result<Vec<GlinerModelInfoWithStatus>, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    Ok(backend.list_models())
}

/// Download a GLiNER model by ID.
#[tauri::command]
pub async fn download_gliner_model(
    state: State<'_, GlinerState>,
    model_id: String,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    info!("Starting download of GLiNER model: {}", model_id);
    backend.download_model(&model_id).await
}

/// Get the current download progress (0-100).
#[tauri::command]
pub async fn get_gliner_download_progress(
    state: State<'_, GlinerState>,
) -> Result<u8, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    Ok(backend.get_download_progress())
}

/// Delete a downloaded GLiNER model.
#[tauri::command]
pub async fn delete_gliner_model(
    state: State<'_, GlinerState>,
    model_id: String,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    info!("Deleting GLiNER model: {}", model_id);
    backend.delete_model(&model_id)
}

/// Get the absolute path to the GLiNER models directory (for "Open Folder").
#[tauri::command]
pub async fn get_gliner_models_dir(
    state: State<'_, GlinerState>,
) -> Result<String, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    Ok(backend.get_models_directory())
}

/// Detect PII entities in text using GLiNER zero-shot NER.
#[tauri::command]
pub async fn detect_pii_with_gliner(
    state: State<'_, GlinerState>,
    text: String,
    confidence_threshold: Option<f32>,
    enabled_labels: Option<Vec<String>>,
) -> Result<Vec<DetectedEntity>, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or(UNAVAILABLE)?;
    info!("Detecting PII with GLiNER (text length: {} chars)", text.len());
    backend.detect_pii(&text, confidence_threshold, enabled_labels).await
}
