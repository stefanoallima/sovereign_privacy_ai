# Design: green_custom-model-hf_01

## Metadata
sudd_version: 3.3

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  ModelSettings.tsx                                                  │
│  ├── AddCustomModelButton ───▶ CustomModelModal                     │
│  │                           ├── URLInput                           │
│  │                           ├── FetchMetadataButton                │
│  │                           ├── LoadingSpinner                     │
│  │                           └── ConfirmationForm                  │
│  │                                                               │
│  └── localModels list ───────────── (refreshed after add/remove)  │
└────────────────────────────┬──────────────────────────────────────┘
                             │ invoke()
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Rust Backend                                   │
├─────────────────────────────────────────────────────────────────────┤
│  llama_backend.rs                                                  │
│  ├── LocalModelInfo ─────────────── (existing struct)              │
│  ├── local_model_registry() ───────── (existing, returns hardcoded) │
│  │                                                               │
│  ├── CustomModelStore                                             │
│  │   ├── load() -> Vec<LocalModelInfo>                           │
│  │   └── save()                                                  │
│  │                                                               │
│  ├── HF integration                                               │
│  │   ├── parse_hf_url() -> (repo_id, filename)                   │
│  │   └── fetch_hf_metadata() -> HfModelMetadata                  │
│  │                                                               │
│  ├── LlamaCppBackend                                              │
│  │   └── list_models() ─────────────── (modified to merge)        │
│  │                                                               │
│  └── Tauri commands                                               │
│      ├── add_custom_model(url)                                    │
│      ├── remove_custom_model(id)                                  │
│      └── fetch_hf_model_metadata(url)                             │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      File System                                    │
├─────────────────────────────────────────────────────────────────────┤
│  {models_dir}/                                                     │
│  ├── custom_models.json  ────────── (new)                         │
│  └── *.gguf              ────────── (existing, downloaded models)  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component: CustomModelStore

### Responsibility
Persists custom model metadata to JSON file in models directory.

### Dependencies
- `serde_json` for JSON serialization
- `std::fs` for file I/O
- `models_dir` path from `LlamaCppBackend`

### Interface
```rust
impl CustomModelStore {
    fn path(models_dir: &Path) -> PathBuf;
    fn load(models_dir: &Path) -> Result<Vec<LocalModelInfo>, String>;
    fn save(models_dir: &Path, models: &[LocalModelInfo]) -> Result<(), String>;
}
```

### Implementation Notes
- File location: `{models_dir}/custom_models.json`
- Create with empty array `{"custom_models":[]}` if file doesn't exist
- Prefix all custom model IDs with `custom-` to avoid collisions
- Use `serde_json` with pretty print for human editability

## Component: HF Integration

### Responsibility
Parse HuggingFace URLs and fetch model metadata from HF API.

### Dependencies
- `reqwest::Client` (reuse singleton from `orchestration.rs`)
- URL parsing via `url` crate or manual string parsing

### Interface
```rust
/// Parse HF URL into repo_id and filename
fn parse_hf_url(url: &str) -> Result<(String, String), String>;

/// Fetch metadata from HuggingFace API
async fn fetch_hf_metadata(repo_id: &str) -> Result<HfModelMetadata, String>;
```

### Implementation Notes
- **URL formats supported**:
  - Full: `https://huggingface.co/{repo_id}/resolve/main/{filename}`
  - Short: `{repo_id}` (e.g., `ggml-org/gemma-4-E4B-it-GGUF`)
- **HF API endpoint**: `GET https://huggingface.co/api/models/{repo_id}`
- **Response parsing**: Extract `model_id` from JSON response for name
- **Context size inference**: Default to 8192, GGUF files may hint via tags
- **Timeout**: 10 seconds using `reqwest::Client` with timeout builder

## Component: list_models() modification

### Responsibility
Merge hardcoded registry with custom models from JSON.

### Changes
```rust
// Before (llama_backend.rs ~line 228)
pub fn list_models(&self) -> Vec<LocalModelInfo> {
    local_model_registry().into_iter().map(...)
}

// After
pub fn list_models(&self) -> Vec<LocalModelInfo> {
    let mut models = local_model_registry();
    let custom = CustomModelStore::load(&self.models_dir).unwrap_or_default();
    models.extend(custom);
    models
}
```

## Data Flow: Add Custom Model

```
User Input URL
      │
      ▼
┌─────────────────────────────────────┐
│  parse_hf_url(url)                  │
│  ├─ Validate URL format             │
│  ├─ Extract repo_id                 │
│  └─ Extract filename                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  fetch_hf_metadata(repo_id)          │
│  ├─ GET hf.co/api/models/{repo_id}  │
│  ├─ Parse JSON response             │
│  ├─ Extract name/description        │
│  └─ Return HfModelMetadata          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Frontend receives metadata          │
│  ├─ Pre-fills confirmation form     │
│  └─ User confirms/corrects          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  add_custom_model(url + form data)  │
│  ├─ Create LocalModelInfo           │
│  │   ├─ id = "custom-{hash}"       │
│  │   └─ Fill from form data         │
│  ├─ CustomModelStore::load()        │
│  ├─ Append new model               │
│  └─ CustomModelStore::save()        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  list_local_models                  │
│  └─ Returns merged list             │
└─────────────────────────────────────┘
```

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `src-tauri/src/llama_backend.rs` | Add `CustomModelStore`, `parse_hf_url`, `fetch_hf_metadata`, modify `list_models()` to merge registries |
| `src-tauri/src/inference_commands.rs` | Add three new Tauri commands |
| `src-tauri/src/lib.rs` | Register new commands in invoke_handler |
| `src/components/settings/ModelSettings.tsx` | Add custom model modal UI |

### No New Files Required
All code added to existing modules.

## Configuration

### New Config
- **File**: `{models_dir}/custom_models.json`
- **Created on first use**: Yes (empty array if missing)

### No New Environment Variables
Uses existing `models_dir` configuration.

## Migration Plan

### Step 1: Add Rust Backend
- Add `CustomModelStore` struct with load/save
- Add `parse_hf_url()` and `fetch_hf_metadata()`
- Modify `list_models()` to merge registries
- Add Tauri commands
- Register in lib.rs

### Step 2: Add Frontend UI
- Add "Add Custom Model" button to ModelSettings.tsx
- Create modal with URL input
- Connect to new Tauri commands
- Handle loading and error states

### Step 3: Test
- Verify custom models persist across restarts
- Verify merge with hardcoded models works
- Verify URL parsing handles all formats
- Verify error handling for HF API failures

## Error Handling Matrix

| Error | Source | User Message | Recovery |
|-------|--------|-------------|----------|
| Invalid URL format | parse_hf_url | "Invalid HuggingFace URL. Expected format: https://huggingface.co/..." | User corrects URL |
| HF API 404 | fetch_hf_metadata | "Model not found on HuggingFace. Check the URL." | User corrects URL |
| HF API timeout | fetch_hf_metadata | "Couldn't reach HuggingFace. Check your connection." | Show defaults, allow manual entry |
| HF API rate limit | fetch_hf_metadata | "Too many requests. Try again later." | Show defaults, allow manual entry |
| HF API error | fetch_hf_metadata | "HuggingFace error: {details}" | Show defaults, allow manual entry |
| JSON read error | CustomModelStore::load | Silently create empty store | Continue with empty |
| JSON write error | CustomModelStore::save | "Failed to save custom model." | Retry or discard |
