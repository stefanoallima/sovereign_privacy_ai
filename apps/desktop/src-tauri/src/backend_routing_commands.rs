/**
 * Backend Routing Tauri Commands
 * Exposes backend routing functionality to the frontend via IPC
 */

use crate::db::Persona;
use crate::ollama::OllamaClient;
use crate::backend_routing::make_routing_decision;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

#[derive(Clone)]
pub struct BackendRoutingState {
    pub ollama: OllamaClient,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendDecisionResponse {
    pub backend: String, // 'nebius', 'ollama', 'hybrid'
    pub anonymize: bool,
    pub model: Option<String>,
    pub reason: String,
    // New privacy-first fields
    pub content_mode: String, // 'full_text' or 'attributes_only'
    pub fallback_event: Option<String>, // Description of what fallback occurred
    pub is_safe: bool, // Whether it's safe to proceed
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendConfigValidation {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Make a routing decision for a persona
#[tauri::command]
pub async fn make_backend_routing_decision(
    persona: Persona,
    state: State<'_, Mutex<BackendRoutingState>>,
) -> Result<BackendDecisionResponse, String> {
    let ollama_client = {
        let state_guard = state.lock().map_err(|e| e.to_string())?;
        state_guard.ollama.clone()
    };

    let decision = make_routing_decision(&persona, &ollama_client, "")
        .await
        .map_err(|e| e.to_string())?;

    // Convert content_mode to string
    let content_mode_str = match decision.content_mode {
        crate::backend_routing::ContentMode::FullText => "full_text".to_string(),
        crate::backend_routing::ContentMode::AttributesOnly => "attributes_only".to_string(),
    };

    // Convert fallback_event to optional string
    let fallback_event_str = match &decision.fallback {
        crate::backend_routing::FallbackEvent::None => None,
        crate::backend_routing::FallbackEvent::OllamaUnavailable => {
            Some("Ollama service unavailable, fell back to cloud".to_string())
        }
        crate::backend_routing::FallbackEvent::AnonymizationFailed => {
            Some("Anonymization failed, fell back to alternative".to_string())
        }
        crate::backend_routing::FallbackEvent::Blocked(reason) => {
            Some(format!("BLOCKED: {}", reason))
        }
    };

    Ok(BackendDecisionResponse {
        backend: match decision.backend {
            crate::backend_routing::BackendType::Nebius => "nebius".to_string(),
            crate::backend_routing::BackendType::Ollama => "ollama".to_string(),
            crate::backend_routing::BackendType::Hybrid => "hybrid".to_string(),
        },
        anonymize: decision.anonymize,
        model: decision.model,
        reason: decision.reason,
        content_mode: content_mode_str,
        fallback_event: fallback_event_str,
        is_safe: decision.is_safe,
    })
}

/// Validate persona LLM backend configuration
#[tauri::command]
pub async fn validate_persona_backend_config(
    preferred_backend: String,
    enable_local_anonymizer: bool,
    anonymization_mode: String,
    local_ollama_model: Option<String>,
    state: State<'_, Mutex<BackendRoutingState>>,
) -> Result<BackendConfigValidation, String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validate backend value
    if !matches!(preferred_backend.as_str(), "nebius" | "ollama" | "hybrid") {
        errors.push(format!(
            "Invalid backend '{}'. Must be one of: nebius, ollama, hybrid",
            preferred_backend
        ));
    }

    // Validate anonymization_mode value
    if !matches!(anonymization_mode.as_str(), "none" | "optional" | "required") {
        errors.push(format!(
            "Invalid anonymization_mode '{}'. Must be one of: none, optional, required",
            anonymization_mode
        ));
    }

    // Validate configuration consistency
    if anonymization_mode == "required" && !enable_local_anonymizer {
        errors.push(
            "Cannot set anonymization_mode to 'required' when enable_local_anonymizer is false".to_string()
        );
    }

    if preferred_backend == "ollama" && !enable_local_anonymizer {
        errors.push(
            "Ollama backend requires enable_local_anonymizer to be true".to_string()
        );
    }

    // Check Ollama availability if needed
    if preferred_backend == "ollama" || (preferred_backend == "hybrid" && enable_local_anonymizer) {
        let ollama_client = {
            let state_guard = state.lock().map_err(|e| e.to_string())?;
            state_guard.ollama.clone()
        };
        if !ollama_client.is_available().await {
            if preferred_backend == "ollama" {
                errors.push(
                    "Ollama service is required for local backend but is not running".to_string()
                );
            } else {
                warnings.push(
                    "Ollama service is not running. Hybrid mode will fall back to Nebius".to_string()
                );
            }
        }
    }

    // Check Ollama model availability if specified
    if let Some(model) = local_ollama_model {
        let ollama_client = {
            let state_guard = state.lock().map_err(|e| e.to_string())?;
            state_guard.ollama.clone()
        };
        if !ollama_client.is_available().await {
            warnings.push(format!(
                "Cannot verify Ollama model '{}' - service is not running",
                model
            ));
        }
    }

    let is_valid = errors.is_empty();
    Ok(BackendConfigValidation {
        is_valid,
        errors,
        warnings,
    })
}

/// Check if Ollama service is available
#[tauri::command]
pub async fn check_ollama_availability(
    state: State<'_, Mutex<BackendRoutingState>>,
) -> Result<bool, String> {
    let ollama_client = {
        let state_guard = state.lock().map_err(|e| e.to_string())?;
        state_guard.ollama.clone()
    };
    Ok(ollama_client.is_available().await)
}

/// Get available Ollama models
#[tauri::command]
pub fn get_available_ollama_models(
    state: State<'_, Mutex<BackendRoutingState>>,
) -> Result<Vec<String>, String> {
    // This would require implementing a method in OllamaClient to list available models
    // For now, return a default list of common models
    Ok(vec![
        "mistral:7b-instruct-q5_K_M".to_string(),
        "mistral:7b".to_string(),
        "llama2:7b".to_string(),
        "neural-chat:7b".to_string(),
    ])
}
