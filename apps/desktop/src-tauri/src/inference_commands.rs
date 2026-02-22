use crate::inference::{LocalInference, ModelStatus};
use crate::llama_backend::{LlamaCppBackend, LocalModelInfo};
use crate::ollama::PIIExtraction;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use log::{info, error};

/// Tauri state for the inference backend (llama.cpp or Ollama fallback)
pub struct InferenceState(pub Arc<Mutex<Arc<dyn LocalInference>>>);

/// Separate state that gives us direct access to LlamaCppBackend methods
/// (list_models, download_model_by_id, set_active_model, etc.)
pub struct LlamaBackendState(pub Arc<Mutex<Option<Arc<LlamaCppBackend>>>>);

/// Helper to get the inference backend from state
async fn get_inference(state: &State<'_, InferenceState>) -> Arc<dyn LocalInference> {
    eprintln!("[get_inference] acquiring InferenceState lock…");
    let guard = state.0.lock().await;
    eprintln!("[get_inference] lock acquired, cloning Arc");
    guard.clone()
}

/// Check if local inference is available
#[tauri::command]
pub async fn ollama_is_available(state: State<'_, InferenceState>) -> Result<bool, String> {
    let inference = get_inference(&state).await;
    Ok(inference.is_available().await)
}

/// Extract PII from document text using local inference
#[tauri::command]
pub async fn extract_pii_from_document(
    text: String,
    state: State<'_, InferenceState>,
) -> Result<PIIExtraction, String> {
    let inference = get_inference(&state).await;

    info!("Extracting PII from document (length: {} chars)", text.len());

    let prompt = format!(
        r#"Extract personally identifiable information from the following Dutch text.
Return a JSON object with the following fields (use null for missing values):
- bsn: Dutch tax ID / BSN (9 digits)
- name: First name(s)
- surname: Last name
- phone: Phone number
- address: Full address
- email: Email address
- income: Annual income if mentioned

Text to analyze:
{}

Return ONLY valid JSON, no markdown, no extra text."#,
        text
    );

    match inference.generate_json(&prompt).await {
        Ok(response) => {
            let extraction: PIIExtraction = serde_json::from_str(&response).map_err(|e| {
                error!("Failed to parse PII extraction JSON: {}", e);
                format!("PII extraction parse failed: {}", e)
            })?;
            Ok(extraction)
        }
        Err(e) => {
            error!("PII extraction failed: {}", e);
            Err(format!("PII extraction failed: {}", e))
        }
    }
}

/// Generate text using local inference
#[tauri::command]
pub async fn ollama_generate(
    prompt: String,
    model: Option<String>,
    state: State<'_, InferenceState>,
) -> Result<String, String> {
    let inference = get_inference(&state).await;
    let model_name = model.unwrap_or_else(|| inference.default_model().to_string());

    eprintln!(
        "[ollama_generate] START — model='{}', prompt_len={} chars",
        model_name,
        prompt.len()
    );

    match inference.generate(&prompt, &model_name).await {
        Ok(response) => {
            eprintln!("[ollama_generate] SUCCESS — response_len={} chars", response.len());
            Ok(response)
        }
        Err(e) => {
            eprintln!("[ollama_generate] ERROR — {}", e);
            Err(format!("Text generation failed: {}", e))
        }
    }
}

/// Ensure model is downloaded/pulled
#[tauri::command]
pub async fn ollama_pull_model(
    model_name: String,
    state: State<'_, InferenceState>,
) -> Result<(), String> {
    let inference = get_inference(&state).await;
    info!("Ensuring model is ready: {}", model_name);

    inference
        .ensure_model(&model_name)
        .await
        .map_err(|e| format!("Failed to ensure model: {}", e))
}

/// Initialize the inference backend (ensure default model is ready)
#[tauri::command]
pub async fn ollama_initialize(state: State<'_, InferenceState>) -> Result<(), String> {
    let inference = get_inference(&state).await;
    info!("Initializing inference backend");

    let default = inference.default_model().to_string();
    match inference.ensure_model(&default).await {
        Ok(_) => {
            info!("Inference backend initialized successfully");
            Ok(())
        }
        Err(e) => {
            error!("Warning: Could not ensure model: {}", e);
            Ok(())
        }
    }
}

/// Get the current model status (download progress, loaded state, etc.)
#[tauri::command]
pub async fn get_model_status(state: State<'_, InferenceState>) -> Result<ModelStatus, String> {
    let inference = get_inference(&state).await;
    Ok(inference.get_model_status().await)
}

/// Download the default model for local inference
#[tauri::command]
pub async fn download_default_model(state: State<'_, InferenceState>) -> Result<(), String> {
    let inference = get_inference(&state).await;
    let default = inference.default_model().to_string();
    info!("Downloading default model: {}", default);

    inference
        .ensure_model(&default)
        .await
        .map_err(|e| format!("Download failed: {}", e))
}

// ---------------------------------------------------------------------------
// Multi-model commands (direct LlamaCppBackend access)
// ---------------------------------------------------------------------------

/// List all available local models with download status
#[tauri::command]
pub async fn list_local_models(
    state: State<'_, LlamaBackendState>,
) -> Result<Vec<LocalModelInfo>, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.list_models())
}

/// Download a specific local model by ID
#[tauri::command]
pub async fn download_local_model(
    model_id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?.clone();
    drop(guard); // Release lock before long download
    backend
        .download_model_by_id(&model_id)
        .await
        .map_err(|e| format!("Download failed: {}", e))
}

/// Delete a downloaded local model
#[tauri::command]
pub async fn delete_local_model(
    model_id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    backend
        .delete_model(&model_id)
        .map_err(|e| format!("Delete failed: {}", e))
}

/// Set the active local model (will be loaded on next inference call)
#[tauri::command]
pub async fn set_active_local_model(
    model_id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    backend
        .set_active_model(&model_id)
        .await
        .map_err(|e| format!("Failed to set active model: {}", e))
}

/// Get the currently active local model ID
#[tauri::command]
pub async fn get_active_local_model(
    state: State<'_, LlamaBackendState>,
) -> Result<String, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.get_active_model_id().await)
}

/// Get download progress for the current download
#[tauri::command]
pub async fn get_local_download_progress(
    state: State<'_, LlamaBackendState>,
) -> Result<u8, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.get_download_progress())
}

/// Get the local models directory path
#[tauri::command]
pub async fn get_local_models_dir(
    state: State<'_, LlamaBackendState>,
) -> Result<String, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.models_dir_string())
}
