use crate::ollama::{OllamaClient, PIIExtraction};
use std::sync::Mutex;
use tauri::State;
use log::{info, error};

/// Tauri state for Ollama client
pub struct OllamaState(pub Mutex<OllamaClient>);

/// Check if Ollama service is available
#[tauri::command]
pub async fn ollama_is_available(state: State<'_, OllamaState>) -> Result<bool, String> {
    let client = {
        let guard = state.0.lock().map_err(|e| format!("Failed to acquire Ollama client: {}", e))?;
        guard.clone()
    };
    info!("Checking Ollama availability");
    let available = client.is_available().await;
    Ok(available)
}

/// Extract PII from document text
#[tauri::command]
pub async fn extract_pii_from_document(
    text: String,
    state: State<'_, OllamaState>,
) -> Result<PIIExtraction, String> {
    let client = {
        let guard = state.0.lock().map_err(|e| {
            error!("Failed to acquire Ollama client lock: {}", e);
            format!("Failed to acquire Ollama client: {}", e)
        })?;
        guard.clone()
    };

    info!("Extracting PII from document (length: {} chars)", text.len());

    match client.extract_pii(&text).await {
        Ok(extraction) => {
            info!("PII extraction successful");
            Ok(extraction)
        }
        Err(e) => {
            error!("PII extraction failed: {}", e);
            Err(format!("PII extraction failed: {}", e))
        }
    }
}

/// Generate text using Ollama
#[tauri::command]
pub async fn ollama_generate(
    prompt: String,
    model: Option<String>,
    state: State<'_, OllamaState>,
) -> Result<String, String> {
    let client = {
        let guard = state.0.lock().map_err(|e| {
            error!("Failed to acquire Ollama client lock: {}", e);
            format!("Failed to acquire Ollama client: {}", e)
        })?;
        guard.clone()
    };

    let model_name = model.unwrap_or_else(|| "mistral:7b-instruct-q5_K_M".to_string());
    info!("Generating text with Ollama model '{}' (prompt length: {} chars)", model_name, prompt.len());

    match client.generate_with_model(&prompt, &model_name).await {
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

/// Pull a model from Ollama registry
#[tauri::command]
pub async fn ollama_pull_model(
    model_name: String,
    state: State<'_, OllamaState>,
) -> Result<(), String> {
    let client = {
        let guard = state.0.lock().map_err(|e| {
            error!("Failed to acquire Ollama client lock: {}", e);
            format!("Failed to acquire Ollama client: {}", e)
        })?;
        guard.clone()
    };

    info!("Pulling Ollama model: {}", model_name);

    match client.pull_model(&model_name).await {
        Ok(_) => {
            info!("Model {} pulled successfully", model_name);
            Ok(())
        }
        Err(e) => {
            error!("Failed to pull model: {}", e);
            Err(format!("Failed to pull model: {}", e))
        }
    }
}

/// Initialize Ollama (pull default PII extraction model)
#[tauri::command]
pub async fn ollama_initialize(state: State<'_, OllamaState>) -> Result<(), String> {
    let client = {
        let guard = state.0.lock().map_err(|e| {
            error!("Failed to acquire Ollama client lock: {}", e);
            format!("Failed to acquire Ollama client: {}", e)
        })?;
        guard.clone()
    };

    info!("Initializing Ollama");

    // Check availability first
    if !client.is_available().await {
        return Err("Ollama is not available. Please start the Ollama service.".to_string());
    }

    // Try to pull the PII extraction model
    match client.pull_model("mistral:7b-instruct-q5_K_M").await {
        Ok(_) => {
            info!("Ollama initialized successfully");
            Ok(())
        }
        Err(e) => {
            // Non-fatal: model might already be downloaded
            error!("Warning: Could not pull model: {}", e);
            Ok(())
        }
    }
}
