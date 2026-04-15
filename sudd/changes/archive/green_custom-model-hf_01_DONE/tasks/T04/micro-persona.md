# Micro-Persona: T04 - Add Tauri Commands

## Task
Add three Tauri commands to `inference_commands.rs`: `add_custom_model`, `remove_custom_model`, `fetch_hf_model_metadata`.

## Consumer
Frontend React components via `invoke()` calls.

## Contract
```rust
#[tauri::command]
async fn add_custom_model(url: String) -> Result<LocalModelInfo, String>;

#[tauri::command]
async fn remove_custom_model(id: String) -> Result<(), String>;

#[tauri::command]
async fn fetch_hf_model_metadata(url: String) -> Result<HfModelMetadata, String>;
```

## Error Handling
- `add_custom_model`: URL parse error → clear message; HF API error → clear message; save error → "Failed to save"
- `remove_custom_model`: Not found → "Model not found"; save error → "Failed to save"
- `fetch_hf_model_metadata`: URL parse error → "Invalid URL"; HF API error → "HF API error: {details}"

## Quality Bar
- All error cases return user-friendly strings (not internal errors)
- Commands are async and don't block
- Proper use of `?` and `map_err` for error conversion
