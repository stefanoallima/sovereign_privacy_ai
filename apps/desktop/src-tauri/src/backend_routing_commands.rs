/**
 * Backend Routing Tauri Commands
 * Exposes backend routing functionality to the frontend via IPC
 */

use crate::db::Persona;
use crate::inference::LocalInference;
use crate::backend_routing::make_routing_decision;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct BackendRoutingState {
    pub inference: Arc<dyn LocalInference>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendDecisionResponse {
    pub backend: String, // 'nebius', 'ollama', 'hybrid'
    pub anonymize: bool,
    pub model: Option<String>,
    pub reason: String,
    pub content_mode: String, // 'full_text' or 'attributes_only'
    pub fallback_event: Option<String>,
    pub is_safe: bool,
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
    let inference = {
        let state_guard = state.lock().await;
        state_guard.inference.clone()
    };

    let decision = make_routing_decision(&persona, inference.as_ref(), "")
        .await
        .map_err(|e| e.to_string())?;

    let content_mode_str = match decision.content_mode {
        crate::backend_routing::ContentMode::FullText => "full_text".to_string(),
        crate::backend_routing::ContentMode::AttributesOnly => "attributes_only".to_string(),
    };

    let fallback_event_str = match &decision.fallback {
        crate::backend_routing::FallbackEvent::None => None,
        crate::backend_routing::FallbackEvent::OllamaUnavailable => {
            Some("Local inference unavailable, fell back to cloud".to_string())
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

    if !matches!(preferred_backend.as_str(), "nebius" | "ollama" | "hybrid") {
        errors.push(format!(
            "Invalid backend '{}'. Must be one of: nebius, ollama, hybrid",
            preferred_backend
        ));
    }

    if !matches!(anonymization_mode.as_str(), "none" | "optional" | "required") {
        errors.push(format!(
            "Invalid anonymization_mode '{}'. Must be one of: none, optional, required",
            anonymization_mode
        ));
    }

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

    // Check local inference availability if needed
    if preferred_backend == "ollama" || (preferred_backend == "hybrid" && enable_local_anonymizer) {
        let inference = {
            let state_guard = state.lock().await;
            state_guard.inference.clone()
        };
        if !inference.is_available().await {
            if preferred_backend == "ollama" {
                errors.push(
                    "Local model is not downloaded. Please download the privacy engine first.".to_string()
                );
            } else {
                warnings.push(
                    "Local model is not available. Hybrid mode will fall back to Nebius.".to_string()
                );
            }
        }
    }

    if let Some(model) = local_ollama_model {
        let inference = {
            let state_guard = state.lock().await;
            state_guard.inference.clone()
        };
        if !inference.is_available().await {
            warnings.push(format!(
                "Cannot verify model '{}' - local inference is not available",
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

/// Check if local inference is available
#[tauri::command]
pub async fn check_ollama_availability(
    state: State<'_, Mutex<BackendRoutingState>>,
) -> Result<bool, String> {
    let inference = {
        let state_guard = state.lock().await;
        state_guard.inference.clone()
    };
    Ok(inference.is_available().await)
}

/// Get available local models
#[tauri::command]
pub async fn get_available_ollama_models(
    state: State<'_, Mutex<BackendRoutingState>>,
) -> Result<Vec<String>, String> {
    let inference = {
        let state_guard = state.lock().await;
        state_guard.inference.clone()
    };
    Ok(vec![inference.default_model().to_string()])
}
