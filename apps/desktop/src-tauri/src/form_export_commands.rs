use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// IPC-safe result for the export command (no raw bytes over IPC).
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub matched_count: usize,
    pub unmatched_labels: Vec<String>,
}

#[tauri::command]
pub async fn export_filled_docx(
    template_path: String,
    field_values: HashMap<String, String>,
    output_path: String,
) -> Result<ExportResult, String> {
    let result = crate::form_export::fill_docx_template(&template_path, &field_values)?;
    std::fs::write(&output_path, &result.bytes).map_err(|e| format!("Write error: {}", e))?;
    Ok(ExportResult {
        matched_count: result.matched_count,
        unmatched_labels: result.unmatched_labels,
    })
}

#[tauri::command]
pub async fn generate_new_docx(
    title: String,
    fields: Vec<(String, String)>,
    output_path: String,
) -> Result<(), String> {
    let bytes = crate::form_export::generate_docx(&title, &fields)?;
    std::fs::write(&output_path, &bytes).map_err(|e| format!("Write error: {}", e))
}
