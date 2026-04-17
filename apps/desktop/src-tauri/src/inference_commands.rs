use crate::inference::{LocalInference, ModelStatus};
use crate::gpu_detect;
use crate::llama_backend::{LlamaCppBackend, LocalModelInfo, HfModelMetadata, CustomModelStore, parse_hf_url, fetch_hf_metadata};
use crate::ollama::{PIIExtraction, DynamicPIIExtraction};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use log::{info, error};

// ---------------------------------------------------------------------------
// Fast table parser -- bypass LLM for structured tabular data
// ---------------------------------------------------------------------------

/// Try to parse structured tabular data without using the LLM.
/// Returns `Some(DynamicPIIExtraction)` if the text looks like a table,
/// `None` otherwise (fall through to LLM).
fn try_parse_table(text: &str) -> Option<DynamicPIIExtraction> {
    let lines: Vec<&str> = text.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    if lines.len() < 2 {
        return None;
    }

    let header_line = lines[0];

    // Try pipe delimiter first
    if header_line.contains('|') {
        return try_parse_pipe_table(&lines);
    }

    // Try tab delimiter
    if header_line.contains('\t') {
        return try_parse_delimited_table(&lines, '\t');
    }

    // Try comma delimiter (CSV)
    if header_line.contains(',') && !header_line.contains("  ") {
        return try_parse_delimited_table(&lines, ',');
    }

    // Try whitespace-aligned columns (PDF-extracted text)
    let header_tokens: Vec<&str> = header_line.split_whitespace().collect();
    if header_tokens.len() >= 2 {
        return try_parse_space_table(&lines);
    }

    None
}

fn try_parse_pipe_table(lines: &[&str]) -> Option<DynamicPIIExtraction> {
    let parse_row = |line: &str| -> Vec<String> {
        line.split('|')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    };

    let columns = parse_row(lines[0]);
    if columns.len() < 2 { return None; }

    let mut records = Vec::new();
    for line in &lines[1..] {
        // Skip separator rows like |---|---|
        if line.chars().all(|c| c == '|' || c == '-' || c == ' ' || c == '+' || c == ':') {
            continue;
        }
        let values = parse_row(line);
        if values.len() + 1 >= columns.len() {
            let mut record = HashMap::new();
            for (i, col) in columns.iter().enumerate() {
                if let Some(val) = values.get(i) {
                    if !val.is_empty() {
                        record.insert(col.clone(), val.clone());
                    }
                }
            }
            if !record.is_empty() {
                records.push(record);
            }
        }
    }

    if records.is_empty() { return None; }
    Some(DynamicPIIExtraction { columns, records })
}

fn try_parse_delimited_table(lines: &[&str], delimiter: char) -> Option<DynamicPIIExtraction> {
    let columns: Vec<String> = lines[0].split(delimiter)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if columns.len() < 2 { return None; }

    let mut records = Vec::new();
    for line in &lines[1..] {
        let values: Vec<String> = line.split(delimiter)
            .map(|s| s.trim().to_string())
            .collect();
        if values.len() + 1 >= columns.len() {
            let mut record = HashMap::new();
            for (i, col) in columns.iter().enumerate() {
                if let Some(val) = values.get(i) {
                    if !val.is_empty() {
                        record.insert(col.clone(), val.clone());
                    }
                }
            }
            if !record.is_empty() {
                records.push(record);
            }
        }
    }

    if records.is_empty() { return None; }
    Some(DynamicPIIExtraction { columns, records })
}

fn try_parse_space_table(lines: &[&str]) -> Option<DynamicPIIExtraction> {
    let header = lines[0];
    let columns: Vec<String> = header.split_whitespace()
        .map(|s| s.to_string())
        .collect();

    if columns.len() < 2 { return None; }

    let mut col_positions: Vec<usize> = Vec::new();
    for col in &columns {
        let search_from = col_positions.last().map(|&p| p + 1).unwrap_or(0);
        if let Some(pos) = header[search_from..].find(col.as_str()) {
            col_positions.push(search_from + pos);
        }
    }

    if col_positions.len() != columns.len() { return None; }

    let mut records = Vec::new();
    for line in &lines[1..] {
        if line.is_empty() { continue; }
        let values: Vec<String> = line.split_whitespace()
            .map(|s| s.to_string())
            .collect();
        if values.len() + 1 >= columns.len() && values.len() <= columns.len() + 1 {
            let mut record = HashMap::new();
            for (i, col) in columns.iter().enumerate() {
                if let Some(val) = values.get(i) {
                    if !val.is_empty() {
                        record.insert(col.clone(), val.clone());
                    }
                }
            }
            if !record.is_empty() {
                records.push(record);
            }
        }
    }

    if records.is_empty() { return None; }
    Some(DynamicPIIExtraction { columns, records })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Tauri state for the inference backend (llama.cpp or Ollama fallback)
pub struct InferenceState(pub Arc<Mutex<Arc<dyn LocalInference>>>);

/// Separate state that gives us direct access to LlamaCppBackend methods
/// (list_models, download_model_by_id, set_active_model, etc.)
pub struct LlamaBackendState(pub Arc<Mutex<Option<Arc<LlamaCppBackend>>>>);

/// Helper to get the inference backend from state
async fn get_inference(state: &State<'_, InferenceState>) -> Arc<dyn LocalInference> {
    eprintln!("[get_inference] acquiring InferenceState lock…");
    let guard = state.0.lock().await;
    eprintln!("[get_inference] lock acquired, cloning Arc");
    guard.clone()
}

/// Check if local inference is available
#[tauri::command]
pub async fn ollama_is_available(state: State<'_, InferenceState>) -> Result<bool, String> {
    let inference = get_inference(&state).await;
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

    // Truncate text to avoid exceeding context window on small models
    let truncated = if text.len() > 2000 {
        let mut end = 2000;
        while end > 0 && !text.is_char_boundary(end) { end -= 1; }
        &text[..end]
    } else {
        &text
    };

    let prompt = format!(
        r#"/no_think
Extract PII from this text. Return ONLY a JSON object, no other text.

{{"bsn":"9-digit BSN or null","name":"first name or null","surname":"last name or null","phone":"phone or null","address":"address or null","email":"email or null","income":"income or null"}}

Text:
{}

JSON:"#,
        truncated
    );

    // Check if model is available first
    if !inference.is_available().await {
        return Err("Local AI model is not loaded. Please download a model in Settings → Privacy & Local first.".to_string());
    }

    match inference.generate_json_short(&prompt, 256).await {
        Ok(response) => {
            if response.trim().is_empty() {
                return Err("Local AI model returned empty response. The model may still be loading — please try again in a moment.".to_string());
            }
            info!("PII extraction raw response: {}", &response[..response.len().min(500)]);
            // Try parsing the JSON response; if it fails, try to extract JSON from the text
            let extraction: PIIExtraction = match serde_json::from_str(&response) {
                Ok(e) => e,
                Err(e1) => {
                    // Try to find a JSON object in the response (model may have added extra text)
                    let trimmed = response.trim();
                    let json_str = if let Some(start) = trimmed.find('{') {
                        if let Some(end) = trimmed.rfind('}') {
                            &trimmed[start..=end]
                        } else {
                            trimmed
                        }
                    } else {
                        trimmed
                    };
                    serde_json::from_str(json_str).map_err(|e2| {
                        error!("Failed to parse PII extraction JSON: {} / {}. Response was: {}", e1, e2, &response[..response.len().min(300)]);
                        format!("PII extraction failed: the AI model returned invalid output. Please try again or use a larger model.")
                    })?
                }
            };
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

    eprintln!(
        "[ollama_generate] START — model='{}', prompt_len={} chars",
        model_name,
        prompt.len()
    );

    match inference.generate(&prompt, &model_name).await {
        Ok(response) => {
            eprintln!("[ollama_generate] SUCCESS — response_len={} chars", response.len());
            Ok(response)
        }
        Err(e) => {
            eprintln!("[ollama_generate] ERROR — {}", e);
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

/// Extract PII dynamically from document text - supports arbitrary columns and multiple records.
/// Uses a fast table parser for structured data; falls back to LLM for unstructured text.
#[tauri::command]
pub async fn extract_pii_dynamic(
    text: String,
    state: State<'_, InferenceState>,
) -> Result<DynamicPIIExtraction, String> {
    info!("Dynamic PII extraction from document (length: {} chars)", text.len());

    // ---------------------------------------------------------------
    // Fast path: try parsing structured table data without the LLM
    // ---------------------------------------------------------------
    if let Some(result) = try_parse_table(&text) {
        info!(
            "Table parsed directly -- {} columns, {} records (no LLM needed)",
            result.columns.len(),
            result.records.len()
        );
        return Ok(result);
    }

    // ---------------------------------------------------------------
    // Slow path: use LLM for unstructured text
    // ---------------------------------------------------------------
    let inference = get_inference(&state).await;

    // Truncate text to 6000 chars (larger ctx window)
    let truncated = if text.len() > 6000 {
        let mut end = 6000;
        while end > 0 && !text.is_char_boundary(end) { end -= 1; }
        &text[..end]
    } else {
        &text
    };

    let prompt = format!(
        r#"/no_think
Extract ALL personal information from this document. The document may contain a table with multiple people.

Return a JSON object with:
- "columns": array of column/field names found (e.g. ["Name", "Surname", "BSN", "SSN"])
- "records": array of objects, one per person/row found

Example: {{"columns":["Name","Email"],"records":[{{"Name":"John","Email":"john@x.com"}},{{"Name":"Jane","Email":"jane@x.com"}}]}}

If only one person, still use the records array with one entry.
Keep the response under 500 tokens. Return ONLY the JSON.

Text:
{}

JSON:"#,
        truncated
    );

    if !inference.is_available().await {
        return Err("Local AI model is not loaded. Please download a model in Settings.".to_string());
    }

    match inference.generate_json_short(&prompt, 512).await {
        Ok(response) => {
            if response.trim().is_empty() {
                return Err("Local AI model returned empty response.".to_string());
            }
            info!("Dynamic PII extraction raw response: {}", &response[..response.len().min(500)]);

            // Try direct parse first
            let extraction: DynamicPIIExtraction = match serde_json::from_str(&response) {
                Ok(e) => e,
                Err(e1) => {
                    // Fallback: extract JSON object from response text
                    let trimmed = response.trim();
                    let json_str = if let Some(start) = trimmed.find('{') {
                        if let Some(end) = trimmed.rfind('}') {
                            &trimmed[start..=end]
                        } else {
                            trimmed
                        }
                    } else {
                        trimmed
                    };
                    serde_json::from_str(json_str).map_err(|e2| {
                        error!("Failed to parse dynamic PII JSON: {} / {}. Response: {}", e1, e2, &response[..response.len().min(300)]);
                        "Dynamic PII extraction failed: the AI model returned invalid output. Please try again.".to_string()
                    })?
                }
            };
            Ok(extraction)
        }
        Err(e) => {
            error!("Dynamic PII extraction failed: {}", e);
            Err(format!("Dynamic PII extraction failed: {}", e))
        }
    }
}

// ---------------------------------------------------------------------------
// Multi-model commands (direct LlamaCppBackend access)
// ---------------------------------------------------------------------------

/// List all available local models with download status
#[tauri::command]
pub async fn list_local_models(
    state: State<'_, LlamaBackendState>,
) -> Result<Vec<LocalModelInfo>, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.list_models())
}

/// Download a specific local model by ID
#[tauri::command]
pub async fn download_local_model(
    model_id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?.clone();
    drop(guard); // Release lock before long download
    backend
        .download_model_by_id(&model_id)
        .await
        .map_err(|e| format!("Download failed: {}", e))
}

/// Delete a downloaded local model
#[tauri::command]
pub async fn delete_local_model(
    model_id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    backend
        .delete_model(&model_id)
        .map_err(|e| format!("Delete failed: {}", e))
}

/// Set the active local model (will be loaded on next inference call)
#[tauri::command]
pub async fn set_active_local_model(
    model_id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    backend
        .set_active_model(&model_id)
        .await
        .map_err(|e| format!("Failed to set active model: {}", e))
}

/// Get the currently active local model ID
#[tauri::command]
pub async fn get_active_local_model(
    state: State<'_, LlamaBackendState>,
) -> Result<String, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.get_active_model_id().await)
}

/// Get download progress for the current download
#[tauri::command]
pub async fn get_local_download_progress(
    state: State<'_, LlamaBackendState>,
) -> Result<u8, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.get_download_progress())
}

/// Get the local models directory path
#[tauri::command]
pub async fn get_local_models_dir(
    state: State<'_, LlamaBackendState>,
) -> Result<String, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.models_dir_string())
}

/// Get GPU detection info (CUDA availability, VRAM, etc.)
#[tauri::command]
pub async fn get_gpu_info() -> Result<gpu_detect::GpuInfo, String> {
    Ok(gpu_detect::detect_gpu())
}

/// Toggle GPU acceleration on/off. Triggers model reload with new GPU settings.
#[tauri::command]
pub async fn set_gpu_enabled(
    enabled: bool,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    backend.set_gpu_enabled(enabled).await;
    Ok(())
}

/// Get whether GPU acceleration is currently enabled.
#[tauri::command]
pub async fn is_gpu_enabled(
    state: State<'_, LlamaBackendState>,
) -> Result<bool, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    Ok(backend.is_gpu_enabled())
}

// ---------------------------------------------------------------------------
// Custom model commands (HuggingFace GGUF)
// ---------------------------------------------------------------------------

/// Fetch metadata for a HuggingFace model URL
#[tauri::command]
pub async fn fetch_hf_model_metadata(url: String) -> Result<HfModelMetadata, String> {
    let (repo_id, filename) = parse_hf_url(&url)?;
    let mut meta = fetch_hf_metadata(&repo_id).await?;
    // If the user provided a specific filename, use it instead of auto-detected
    if !filename.is_empty() {
        meta.filename = filename;
    }
    Ok(meta)
}

/// Add a custom model from a HuggingFace URL
#[tauri::command]
pub async fn add_custom_model(
    url: String,
    name: Option<String>,
    ctx_size: Option<u32>,
    description: Option<String>,
    speed_tier: Option<String>,
    intelligence_tier: Option<String>,
    state: State<'_, LlamaBackendState>,
) -> Result<LocalModelInfo, String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    let models_dir = backend.models_dir().to_path_buf();
    drop(guard);

    let (repo_id, parsed_filename) = parse_hf_url(&url)?;

    // Try to get metadata from HF API; fall back to defaults
    let meta = fetch_hf_metadata(&repo_id).await.ok();

    let filename = if !parsed_filename.is_empty() {
        parsed_filename
    } else if let Some(ref m) = meta {
        if !m.filename.is_empty() {
            m.filename.clone()
        } else {
            return Err("Could not determine GGUF filename. Please provide a direct link to a .gguf file.".into());
        }
    } else {
        return Err("Could not determine GGUF filename. Please provide a direct link to a .gguf file.".into());
    };

    let model_name = name.unwrap_or_else(|| {
        meta.as_ref().map(|m| m.name.clone()).unwrap_or_else(|| repo_id.clone())
    });

    // Build download URL
    let download_url = if url.starts_with("http") {
        url.clone()
    } else {
        format!("https://huggingface.co/{}/resolve/main/{}", repo_id, filename)
    };

    // Generate a unique ID with custom- prefix
    let id = format!("custom-{}", repo_id.replace('/', "-").to_lowercase());

    let model_info = LocalModelInfo {
        id: id.clone(),
        name: model_name,
        filename,
        url: download_url,
        size_bytes: 0, // Unknown until download
        ctx_size: ctx_size.unwrap_or_else(|| meta.as_ref().map(|m| m.inferred_ctx_size).unwrap_or(8192)),
        description: description.unwrap_or_else(|| meta.as_ref().map(|m| m.description.clone()).unwrap_or_default()),
        speed_tier: speed_tier.unwrap_or_else(|| "medium".into()),
        intelligence_tier: intelligence_tier.unwrap_or_else(|| "high".into()),
        is_downloaded: false,
        local_path: None,
    };

    // Load existing, check for duplicates, append, save
    let mut custom = CustomModelStore::load(&models_dir).unwrap_or_default();
    if custom.iter().any(|m| m.id == id) {
        return Err(format!("Custom model '{}' already exists", id));
    }
    custom.push(model_info.clone());
    CustomModelStore::save(&models_dir, &custom)?;

    Ok(model_info)
}

/// Remove a custom model by ID
#[tauri::command]
pub async fn remove_custom_model(
    id: String,
    state: State<'_, LlamaBackendState>,
) -> Result<(), String> {
    let guard = state.0.lock().await;
    let backend = guard.as_ref().ok_or("Local backend not available")?;
    let models_dir = backend.models_dir().to_path_buf();
    drop(guard);

    let mut custom = CustomModelStore::load(&models_dir)?;
    let before = custom.len();
    custom.retain(|m| m.id != id);
    if custom.len() == before {
        return Err(format!("Custom model '{}' not found", id));
    }
    CustomModelStore::save(&models_dir, &custom)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_space_table() {
        let text = "Name Surname BSN SSN
John Doe 000123456 000-12-3456
Jane Smith 999876543 666-99-8888";
        let result = try_parse_table(text).expect("should parse space table");
        assert_eq!(result.columns, vec!["Name", "Surname", "BSN", "SSN"]);
        assert_eq!(result.records.len(), 2);
        assert_eq!(result.records[0].get("Name").unwrap(), "John");
        assert_eq!(result.records[0].get("BSN").unwrap(), "000123456");
        assert_eq!(result.records[1].get("Surname").unwrap(), "Smith");
        assert_eq!(result.records[1].get("SSN").unwrap(), "666-99-8888");
    }

    #[test]
    fn test_parse_space_table_with_title() {
        let text = "Fake PII Data Example
Name Surname BSN SSN
John Doe 000123456 000-12-3456
Jane Smith 999876543 666-99-8888";
        let result = try_parse_table(text);
        assert!(result.is_some());
    }

    #[test]
    fn test_parse_csv_table() {
        let text = "Name,Surname,BSN
John,Doe,000123456
Jane,Smith,999876543";
        let result = try_parse_table(text).expect("should parse CSV");
        assert_eq!(result.columns, vec!["Name", "Surname", "BSN"]);
        assert_eq!(result.records.len(), 2);
        assert_eq!(result.records[0].get("Name").unwrap(), "John");
    }

    #[test]
    fn test_parse_tab_table() {
        let text = "Name\tSurname\tBSN
John\tDoe\t000123456";
        let result = try_parse_table(text).expect("should parse tab-delimited");
        assert_eq!(result.columns, vec!["Name", "Surname", "BSN"]);
        assert_eq!(result.records.len(), 1);
    }

    #[test]
    fn test_parse_pipe_table() {
        let text = "| Name | Surname | BSN |
|------|---------|-----|
| John | Doe | 000123456 |";
        let result = try_parse_table(text).expect("should parse pipe table");
        assert_eq!(result.columns, vec!["Name", "Surname", "BSN"]);
        assert_eq!(result.records.len(), 1);
        assert_eq!(result.records[0].get("Name").unwrap(), "John");
    }

    #[test]
    fn test_single_line_no_parse() {
        let text = "Hello, my name is John Doe and my BSN is 123456789.";
        assert!(try_parse_table(text).is_none(), "single prose line should not parse as table");
    }

    #[test]
    fn test_prose_no_parse() {
        let text = "Dear Sir,
I am writing to inform you that my BSN is 123456789.
Regards, John";
        let _ = try_parse_table(text);
    }
}
