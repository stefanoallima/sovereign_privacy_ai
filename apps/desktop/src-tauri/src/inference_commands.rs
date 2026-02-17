use crate::inference::{LocalInference, ModelStatus};
use crate::ollama::PIIExtraction;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use log::{info, error};

/// Tauri state for the inference backend (llama.cpp or Ollama fallback)
pub struct InferenceState(pub Arc<Mutex<Arc<dyn LocalInference>>>);

/// Helper to get the inference backend from state
async fn get_inference(state: &State<'_, InferenceState>) -> Arc<dyn LocalInference> {
    let guard = state.0.lock().await;
    guard.clone()
}

/// Check if local inference is available
#[tauri::command]
pub async fn ollama_is_available(state: State<'_, InferenceState>) -> Result<bool, String> {
    let inference = get_inference(&state).await;
    info!("Checking local inference availability");
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
            info!("PII extraction successful");
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

    info!(
        "Generating text with model '{}' (prompt length: {} chars)",
        model_name,
        prompt.len()
    );

    match inference.generate(&prompt, &model_name).await {
        Ok(response) => {
            info!("Text generation successful");
            Ok(response)
        }
        Err(e) => {
            error!("Text generation failed: {}", e);
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
            // Non-fatal for Ollama fallback (model might already exist)
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
