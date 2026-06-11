use crate::redaction::{
    redact_messages, redact_text, rehydrate_text, RedactMessagesResult, RedactResult, RedactTerm,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[tauri::command]
pub async fn redact_text_command(
    text: String,
    terms: Vec<RedactTerm>,
) -> Result<RedactResult, String> {
    Ok(redact_text(&text, &terms))
}

/// Redact PII from an entire conversation (every message), not just the latest.
/// Returns the redacted messages plus a merged placeholder→value map so the
/// cloud response can be rehydrated locally. Closes the history-leak gap.
#[tauri::command]
pub async fn redact_messages_command(
    messages: Vec<String>,
    terms: Vec<RedactTerm>,
) -> Result<RedactMessagesResult, String> {
    Ok(redact_messages(&messages, &terms))
}

#[tauri::command]
pub async fn rehydrate_text_command(
    text: String,
    mappings: HashMap<String, String>,
) -> Result<String, String> {
    Ok(rehydrate_text(&text, &mappings))
}
