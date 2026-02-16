/**
 * Backend Routing Module
 * Handles routing of requests to appropriate LLM backends based on persona configuration
 *
 * Privacy-First Design:
 * - Determines backend based on persona LLM config
 * - Checks Ollama availability
 * - Integrates anonymization pipeline
 * - BLOCKS unsafe fallbacks when anonymization is required
 * - Supports attribute-only mode (never sends full text)
 * - Audits all backend decisions
 *
 * IMPORTANT: Nebius has zero-training policy, but we still minimize PII sharing
 * because the goal is privacy-first, not just "no training".
 */

use crate::db::Persona;
use crate::ollama::OllamaClient;
use std::error::Error;
use log::{info, warn, error};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BackendType {
    /// Direct cloud API (fastest, least private)
    Nebius,
    /// Local model inference (private, slowest)
    Ollama,
    /// Local anonymization then cloud (balanced)
    Hybrid,
}

#[derive(Debug, Clone)]
pub enum AnonymizationMode {
    /// No anonymization
    None,
    /// Anonymize if possible, continue if fails
    Optional,
    /// Fail request if anonymization fails
    Required,
}

impl AnonymizationMode {
    pub fn from_string(s: &str) -> Self {
        match s {
            "optional" => AnonymizationMode::Optional,
            "required" => AnonymizationMode::Required,
            _ => AnonymizationMode::None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BackendConfig {
    /// Which backend to use
    pub backend: BackendType,
    /// Whether to enable local anonymization
    pub enable_anonymization: bool,
    /// How strict anonymization should be
    pub anonymization_mode: AnonymizationMode,
    /// Which Ollama model to use (if applicable)
    pub ollama_model: Option<String>,
}

/// How to handle the request content
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ContentMode {
    /// Send full text (anonymized or not)
    FullText,
    /// Extract attributes only, never send full text (maximum privacy)
    AttributesOnly,
}

/// What happened during fallback (for audit trail)
#[derive(Debug, Clone)]
pub enum FallbackEvent {
    /// No fallback needed
    None,
    /// Ollama was unavailable, fell back to Nebius (only for optional mode)
    OllamaUnavailable,
    /// Anonymization failed, fell back to cloud (only for optional mode)
    AnonymizationFailed,
    /// Blocked - anonymization required but failed
    Blocked(String),
}

#[derive(Debug, Clone)]
pub struct BackendDecision {
    /// Which backend was selected
    pub backend: BackendType,
    /// Whether anonymization is planned
    pub anonymize: bool,
    /// Model to use
    pub model: Option<String>,
    /// Reason for this decision
    pub reason: String,
    /// How content should be processed
    pub content_mode: ContentMode,
    /// What fallback happened (if any)
    pub fallback: FallbackEvent,
    /// Is it safe to proceed?
    pub is_safe: bool,
}

#[derive(Debug, Clone)]
pub struct ProcessingResult {
    /// Which backend was actually used
    pub backend_used: BackendType,
    /// How many PII fields were anonymized (if applicable)
    pub pii_fields_anonymized: usize,
    /// Whether anonymization was attempted
    pub anonymization_attempted: bool,
    /// Success or error message
    pub status: String,
}

/// Determine which backend to use for this request based on persona configuration
pub async fn determine_backend(persona: &Persona, ollama_client: &OllamaClient) -> Result<BackendConfig, Box<dyn Error + Send + Sync>> {
    let backend_str = persona.preferred_backend.to_lowercase();
    let backend = match backend_str.as_str() {
        "ollama" => BackendType::Ollama,
        "hybrid" => BackendType::Hybrid,
        _ => BackendType::Nebius, // Default
    };

    let anonymization_mode = AnonymizationMode::from_string(&persona.anonymization_mode);
    let enable_anonymization = persona.enable_local_anonymizer;

    // Validate configuration
    validate_backend_config(&backend, enable_anonymization, &anonymization_mode)?;

    // Check Ollama availability if needed
    if backend == BackendType::Ollama || (backend == BackendType::Hybrid && enable_anonymization) {
        let is_available = ollama_client.is_available().await;
        if !is_available {
            match backend {
                BackendType::Ollama => {
                    return Err("Ollama service is required for local backend but is not running".into());
                }
                BackendType::Hybrid => {
                    warn!("Ollama not available for hybrid backend, will use Nebius fallback");
                }
                _ => {}
            }
        }
    }

    Ok(BackendConfig {
        backend,
        enable_anonymization,
        anonymization_mode,
        ollama_model: persona.local_ollama_model.clone(),
    })
}

/// Make a backend routing decision for a specific request
/// IMPORTANT: This function enforces privacy-first routing:
/// - "required" mode BLOCKS if Ollama unavailable or anonymization fails
/// - "optional" mode warns but allows fallback
/// - Attribute-only mode recommended for maximum privacy
pub async fn make_routing_decision(
    persona: &Persona,
    ollama_client: &OllamaClient,
    _request_text: &str,
) -> Result<BackendDecision, Box<dyn Error + Send + Sync>> {
    let backend_str = persona.preferred_backend.to_lowercase();
    let anonymization_mode = AnonymizationMode::from_string(&persona.anonymization_mode);
    let enable_anonymization = persona.enable_local_anonymizer;

    // Check Ollama availability upfront
    let ollama_available = ollama_client.is_available().await;

    // Determine content mode based on privacy needs
    // For "required" mode with hybrid backend, use attributes-only for maximum privacy
    let content_mode = if matches!(anonymization_mode, AnonymizationMode::Required) &&
                         backend_str == "hybrid" {
        ContentMode::AttributesOnly
    } else {
        ContentMode::FullText
    };

    let decision = match backend_str.as_str() {
        "nebius" => {
            // Direct cloud - no anonymization, no privacy protection
            if matches!(anonymization_mode, AnonymizationMode::Required) && enable_anonymization {
                // User wants required anonymization but selected direct cloud
                // This is a configuration error - warn and proceed with attributes only
                warn!("Nebius backend with required anonymization - using attributes-only mode");
                BackendDecision {
                    backend: BackendType::Nebius,
                    anonymize: false,
                    model: persona.preferred_model_id.clone().into(),
                    reason: "Cloud direct with attributes-only (required privacy mode)".to_string(),
                    content_mode: ContentMode::AttributesOnly,
                    fallback: FallbackEvent::None,
                    is_safe: true,
                }
            } else {
                BackendDecision {
                    backend: BackendType::Nebius,
                    anonymize: false,
                    model: persona.preferred_model_id.clone().into(),
                    reason: "Cloud direct (fastest)".to_string(),
                    content_mode: ContentMode::FullText,
                    fallback: FallbackEvent::None,
                    is_safe: true,
                }
            }
        }
        "ollama" => {
            if !ollama_available {
                // Ollama not available - check if we can fallback
                match anonymization_mode {
                    AnonymizationMode::Required => {
                        // BLOCK - cannot proceed without local inference
                        error!("Ollama backend required but service unavailable - BLOCKING request");
                        BackendDecision {
                            backend: BackendType::Ollama,
                            anonymize: false,
                            model: None,
                            reason: "BLOCKED: Ollama service required but unavailable".to_string(),
                            content_mode: ContentMode::FullText,
                            fallback: FallbackEvent::Blocked("Ollama service unavailable".to_string()),
                            is_safe: false,
                        }
                    }
                    _ => {
                        // Optional or None - warn and fallback to Nebius
                        warn!("Ollama backend unavailable, falling back to Nebius (optional mode)");
                        BackendDecision {
                            backend: BackendType::Nebius,
                            anonymize: false,
                            model: persona.preferred_model_id.clone().into(),
                            reason: "Fallback to cloud (Ollama unavailable)".to_string(),
                            content_mode: ContentMode::FullText,
                            fallback: FallbackEvent::OllamaUnavailable,
                            is_safe: true,
                        }
                    }
                }
            } else {
                let model = persona.local_ollama_model.clone()
                    .unwrap_or_else(|| "mistral:7b-instruct-q5_K_M".to_string());
                BackendDecision {
                    backend: BackendType::Ollama,
                    anonymize: false,
                    model: Some(model),
                    reason: "Local inference (maximum privacy)".to_string(),
                    content_mode: ContentMode::FullText,
                    fallback: FallbackEvent::None,
                    is_safe: true,
                }
            }
        }
        "hybrid" | _ => {
            // Hybrid: local anonymization + cloud API
            if !ollama_available && enable_anonymization {
                // Can't anonymize without Ollama
                match anonymization_mode {
                    AnonymizationMode::Required => {
                        // BLOCK - cannot proceed without anonymization
                        error!("Hybrid backend with required anonymization but Ollama unavailable - BLOCKING");
                        BackendDecision {
                            backend: BackendType::Hybrid,
                            anonymize: false,
                            model: None,
                            reason: "BLOCKED: Anonymization required but Ollama unavailable".to_string(),
                            content_mode: ContentMode::FullText,
                            fallback: FallbackEvent::Blocked("Cannot anonymize without Ollama".to_string()),
                            is_safe: false,
                        }
                    }
                    AnonymizationMode::Optional => {
                        // Warn and fallback - use attributes-only for safety
                        warn!("Hybrid backend: Ollama unavailable for anonymization, using attributes-only fallback");
                        BackendDecision {
                            backend: BackendType::Nebius,
                            anonymize: false,
                            model: persona.preferred_model_id.clone().into(),
                            reason: "Fallback to cloud with attributes-only (Ollama unavailable)".to_string(),
                            content_mode: ContentMode::AttributesOnly,
                            fallback: FallbackEvent::OllamaUnavailable,
                            is_safe: true,
                        }
                    }
                    AnonymizationMode::None => {
                        // No anonymization needed anyway
                        BackendDecision {
                            backend: BackendType::Nebius,
                            anonymize: false,
                            model: persona.preferred_model_id.clone().into(),
                            reason: "Cloud direct (no anonymization configured)".to_string(),
                            content_mode: ContentMode::FullText,
                            fallback: FallbackEvent::None,
                            is_safe: true,
                        }
                    }
                }
            } else {
                // Normal hybrid operation
                BackendDecision {
                    backend: BackendType::Hybrid,
                    anonymize: enable_anonymization,
                    model: persona.preferred_model_id.clone().into(),
                    reason: format!(
                        "Hybrid: local anonymization + cloud API (mode: {})",
                        match anonymization_mode {
                            AnonymizationMode::Required => "required",
                            AnonymizationMode::Optional => "optional",
                            AnonymizationMode::None => "none",
                        }
                    ),
                    content_mode,
                    fallback: FallbackEvent::None,
                    is_safe: true,
                }
            }
        }
    };

    // Log the decision
    info!(
        target: "backend_routing",
        "backend_decision persona={} backend={:?} anonymize={} content_mode={:?} is_safe={} reason={}",
        persona.name, decision.backend, decision.anonymize, decision.content_mode, decision.is_safe, decision.reason
    );

    Ok(decision)
}

/// Check if a routing decision allows proceeding
pub fn can_proceed(decision: &BackendDecision) -> bool {
    decision.is_safe
}

/// Check if decision requires attribute extraction (privacy-first mode)
pub fn requires_attribute_extraction(decision: &BackendDecision) -> bool {
    decision.content_mode == ContentMode::AttributesOnly
}

/// Validate that backend configuration is consistent
fn validate_backend_config(
    backend: &BackendType,
    enable_anonymization: bool,
    anonymization_mode: &AnonymizationMode,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    // If anonymization is required, it must be enabled
    if matches!(anonymization_mode, AnonymizationMode::Required) && !enable_anonymization {
        return Err(
            "Cannot set anonymization_mode to 'required' when enable_local_anonymizer is false".into()
        );
    }

    // If backend is Ollama, anonymization must be enabled
    if matches!(backend, BackendType::Ollama) && !enable_anonymization {
        return Err(
            "Ollama backend requires enable_local_anonymizer to be true".into()
        );
    }

    Ok(())
}

/// Determine if a request can be processed with the given anonymization mode
pub fn can_process_with_anonymization_mode(
    mode: &AnonymizationMode,
    anonymization_succeeded: bool,
) -> bool {
    match mode {
        AnonymizationMode::None => true, // No anonymization needed
        AnonymizationMode::Optional => true, // Can proceed with or without anonymization
        AnonymizationMode::Required => anonymization_succeeded, // Must have successful anonymization
    }
}

/// Log backend selection and PII processing
pub fn log_backend_decision(
    persona_name: &str,
    backend: BackendType,
    pii_count: usize,
    anonymization_success: bool,
) {
    let backend_str = match backend {
        BackendType::Nebius => "nebius",
        BackendType::Ollama => "ollama",
        BackendType::Hybrid => "hybrid",
    };

    info!(
        target: "backend_audit",
        "backend_selection persona={} backend={} pii_count={} anonymization_success={}",
        persona_name, backend_str, pii_count, anonymization_success
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anonymization_mode_from_string() {
        assert_eq!(AnonymizationMode::from_string("optional"), AnonymizationMode::Optional);
        assert_eq!(AnonymizationMode::from_string("required"), AnonymizationMode::Required);
        assert_eq!(AnonymizationMode::from_string("none"), AnonymizationMode::None);
        assert_eq!(AnonymizationMode::from_string("invalid"), AnonymizationMode::None);
    }

    #[test]
    fn test_validation_required_requires_enabled() {
        let result = validate_backend_config(
            &BackendType::Nebius,
            false, // anonymization disabled
            &AnonymizationMode::Required, // but required
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_ollama_requires_enabled() {
        let result = validate_backend_config(
            &BackendType::Ollama,
            false, // anonymization disabled
            &AnonymizationMode::None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_valid_config() {
        let result = validate_backend_config(
            &BackendType::Nebius,
            false,
            &AnonymizationMode::None,
        );
        assert!(result.is_ok());

        let result = validate_backend_config(
            &BackendType::Ollama,
            true, // enabled
            &AnonymizationMode::None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_can_process_with_modes() {
        assert!(can_process_with_anonymization_mode(&AnonymizationMode::None, false));
        assert!(can_process_with_anonymization_mode(&AnonymizationMode::Optional, false));
        assert!(can_process_with_anonymization_mode(&AnonymizationMode::Optional, true));
        assert!(!can_process_with_anonymization_mode(&AnonymizationMode::Required, false));
        assert!(can_process_with_anonymization_mode(&AnonymizationMode::Required, true));
    }
}
