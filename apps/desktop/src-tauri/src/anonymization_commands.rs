use crate::anonymization::AnonymizationService;
use crate::commands::DbState;
use crate::db::{self, PiiMapping};
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
    db_state: State<'_, DbState>,
) -> Result<AnonymizationResult, String> {
    info!("Anonymizing text for conversation: {}", conversation_id);

    // Compute the anonymized text + mappings, then drop the service lock before
    // touching the DB (never hold two locks at once).
    let (anonymized, mappings) = {
        let service = state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire anonymization service: {}", e))?;
        service.anonymize_text(&text, &pii_extraction, &conversation_id)
    };

    // Persist each mapping with the PII value encrypted at rest (F-02), so the
    // anonymization can be reversed via deanonymize_text. Persistence failures
    // (e.g. an unknown conversation_id) are logged, not fatal — the caller still
    // receives the anonymized text.
    {
        let conn = db_state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire database: {}", e))?;
        for mapping in &mappings {
            if let Err(e) = db::store_pii_mapping(&conn, mapping) {
                error!("Failed to persist PII mapping {}: {}", mapping.id, e);
            }
        }
    }

    Ok(AnonymizationResult {
        anonymized_text: anonymized,
        mappings: mappings.into_iter().map(MappingDto::from).collect(),
    })
}

/// Reverse anonymization: restore original PII values in `text` using the
/// stored mappings for the conversation. Encrypted values are decrypted with
/// the key manager; legacy plaintext rows are honored; unrecoverable values
/// fall back to a category label.
#[tauri::command]
pub fn deanonymize_text(
    text: String,
    conversation_id: String,
    state: State<'_, AnonymizationState>,
    db_state: State<'_, DbState>,
) -> Result<String, String> {
    let mappings = {
        let conn = db_state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire database: {}", e))?;
        db::get_pii_mappings_for_conversation(&conn, &conversation_id)
            .map_err(|e| format!("Failed to load PII mappings: {}", e))?
    };

    let service = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire anonymization service: {}", e))?;
    Ok(service.deanonymize_text(&text, &mappings))
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
