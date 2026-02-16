use crate::anonymization::AnonymizationService;
use crate::db::PiiMapping;
use crate::ollama::PIIExtraction;
use std::sync::Mutex;
use tauri::State;
use log::{info, error};

pub struct AnonymizationState(pub Mutex<AnonymizationService>);

/// Anonymize text by replacing PII with placeholders
#[tauri::command]
pub fn anonymize_text(
    text: String,
    pii_extraction: PIIExtraction,
    conversation_id: String,
    state: State<'_, AnonymizationState>,
) -> Result<AnonymizationResult, String> {
    match state.0.lock() {
        Ok(service) => {
            info!("Anonymizing text for conversation: {}", conversation_id);

            let (anonymized, mappings) = service.anonymize_text(&text, &pii_extraction, &conversation_id);

            Ok(AnonymizationResult {
                anonymized_text: anonymized,
                mappings: mappings.into_iter().map(|m| MappingDto::from(m)).collect(),
            })
        }
        Err(e) => {
            error!("Failed to acquire anonymization service: {}", e);
            Err(format!("Failed to acquire anonymization service: {}", e))
        }
    }
}

/// Validate anonymization to check for remaining PII patterns
#[tauri::command]
pub fn validate_anonymization(
    text: String,
    state: State<'_, AnonymizationState>,
) -> Result<ValidationResult, String> {
    match state.0.lock() {
        Ok(service) => {
            info!("Validating anonymization");

            let validation = service.validate_anonymization(&text);

            Ok(ValidationResult {
                is_safe: validation.is_safe,
                found_patterns: validation.found_patterns.into_iter().map(|s| s.to_string()).collect(),
            })
        }
        Err(e) => {
            error!("Failed to acquire anonymization service: {}", e);
            Err(format!("Failed to acquire anonymization service: {}", e))
        }
    }
}

#[derive(serde::Serialize)]
pub struct AnonymizationResult {
    pub anonymized_text: String,
    pub mappings: Vec<MappingDto>,
}

#[derive(serde::Serialize)]
pub struct MappingDto {
    pub id: String,
    pub conversation_id: String,
    pub pii_category: String,
    pub placeholder: String,
    pub is_encrypted: bool,
    pub created_at: String,
}

impl MappingDto {
    fn from(mapping: PiiMapping) -> Self {
        MappingDto {
            id: mapping.id,
            conversation_id: mapping.conversation_id,
            pii_category: mapping.pii_category,
            placeholder: mapping.placeholder,
            is_encrypted: mapping.is_encrypted,
            created_at: mapping.created_at,
        }
    }
}

#[derive(serde::Serialize)]
pub struct ValidationResult {
    pub is_safe: bool,
    pub found_patterns: Vec<String>,
}
