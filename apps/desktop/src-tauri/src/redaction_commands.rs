use crate::redaction::{redact_text, rehydrate_text, RedactResult, RedactTerm};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[tauri::command]
pub async fn redact_text_command(
    text: String,
    terms: Vec<RedactTerm>,
) -> Result<RedactResult, String> {
    Ok(redact_text(&text, &terms))
}

#[tauri::command]
pub async fn rehydrate_text_command(
    text: String,
    mappings: HashMap<String, String>,
) -> Result<String, String> {
    Ok(rehydrate_text(&text, &mappings))
}
