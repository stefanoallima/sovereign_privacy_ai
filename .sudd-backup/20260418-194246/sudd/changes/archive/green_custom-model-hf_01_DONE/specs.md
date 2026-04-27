# Specifications: green_custom-model-hf_01

## Metadata
sudd_version: 3.3
change_id: green_custom-model-hf_01

## Functional Requirements

### FR-1: Custom Model Storage
- **Given**: User has a HuggingFace GGUF URL
- **When**: User adds a custom model via UI
- **Then**: Model metadata is stored in `{models_dir}/custom_models.json` and model appears in the model list

### FR-2: HuggingFace Metadata Auto-Fetch
- **Given**: User provides a valid HuggingFace GGUF URL
- **When**: User clicks "Fetch Metadata"
- **Then**: System calls HF API, parses response, returns pre-filled form with model name, description, and inferred context size

### FR-3: Fallback to Manual Entry
- **Given**: HF API is unavailable (timeout, rate limit, network error)
- **When**: User attempts to fetch metadata
- **Then**: Show form with sensible defaults (ctx_size=8192, speed=medium, intelligence=high) and error message

### FR-4: Model Merging
- **Given**: Custom models exist in JSON and hardcoded models exist in Rust registry
- **When**: `list_local_models` is called
- **Then**: Return merged list with hardcoded models first, custom models appended, no ID collisions

### FR-5: Custom Model Removal
- **Given**: A custom model exists in JSON
- **When**: User removes it via UI
- **Then**: Remove from JSON and model disappears from list

## Non-Functional Requirements

### NFR-1: Error Handling
- **Constraint**: HF API calls must timeout after 10 seconds
- **Rationale**: Prevent UI freeze on network issues

### NFR-2: URL Validation
- **Constraint**: Must accept full URLs and short repo IDs (e.g., `ggml-org/gemma-4-E4B-it-GGUF`)
- **Rationale**: User convenience - both formats are common

### NFR-3: ID Collision Prevention
- **Constraint**: Custom model IDs must be prefixed with `custom-`
- **Rationale**: Avoid collisions with hardcoded model IDs

### NFR-4: Persistence
- **Constraint**: Custom models survive app restart
- **Rationale**: Core requirement - stored in JSON file

### NFR-5: Download Integration
- **Constraint**: Custom models use same download infrastructure as hardcoded models
- **Rationale**: Reuse existing code, consistent behavior

## Data Models

### CustomModelStore (JSON file)
```json
{
  "custom_models": [
    {
      "id": "string (prefixed with 'custom-')",
      "name": "string",
      "filename": "string",
      "url": "string (HF URL)",
      "size_bytes": "u64",
      "ctx_size": "u32",
      "description": "string",
      "speed_tier": "string",
      "intelligence_tier": "string",
      "is_downloaded": "bool",
      "local_path": "string | null"
    }
  ]
}
```

### HfModelMetadata (internal Rust struct)
```rust
struct HfModelMetadata {
    repo_id: String,        // "ggml-org/gemma-4-E4B-it-GGUF"
    filename: String,        // "gemma-4-e4b-it-Q4_K_M.gguf"
    name: String,            // Derived from repo_id
    description: String,     // From HF API or default
    inferred_ctx_size: u32, // Guessed from model family or default 8192
}
```

## API Contracts

### Tauri Command: add_custom_model
- **Input**: `{ url: string }`
- **Output**: `Result<LocalModelInfo, string>`
- **Errors**:
  - `"Invalid URL format"` - URL doesn't match expected pattern
  - `"Model not found"` - HF API returns 404
  - `"HF API error: ..."` - Other HF API failures
  - `"Failed to save"` - JSON write failure

### Tauri Command: remove_custom_model
- **Input**: `{ id: string }`
- **Output**: `Result<(), string>`
- **Errors**:
  - `"Model not found"` - ID doesn't exist in custom models
  - `"Failed to save"` - JSON write failure

### Tauri Command: fetch_hf_model_metadata
- **Input**: `{ url: string }`
- **Output**: `Result<HfModelMetadata, string>`
- **Errors**:
  - `"Invalid URL format"`
  - `"Network error: ..."`
  - `"HF API error: ..."`
  - `"Timeout"` - After 10 seconds

## Consumer Handoffs

### Handoff 1: Frontend → Rust (add_custom_model)
- **Format**: JSON via Tauri invoke
- **Schema**:
```typescript
// Input
{ url: string }

// Output (LocalModelInfo)
{
  id: string;
  name: string;
  filename: string;
  url: string;
  size_bytes: number;
  ctx_size: number;
  description: string;
  speed_tier: string;
  intelligence_tier: string;
  is_downloaded: boolean;
  local_path: string | null;
}
```
- **Validation**: Rust validates URL format before API call

### Handoff 2: Frontend → Rust (fetch_hf_model_metadata)
- **Format**: JSON via Tauri invoke
- **Schema**:
```typescript
// Input
{ url: string }

// Output
{
  repo_id: string;
  filename: string;
  name: string;
  description: string;
  inferred_ctx_size: number;
}
```

### Handoff 3: Rust → JSON Storage
- **Format**: File write to `{models_dir}/custom_models.json`
- **Schema**: See CustomModelStore above
- **Validation**: Read-on-write validation, create empty array if file missing

## Out of Scope
- Direct model downloading (reuse existing infrastructure)
- Non-GGUF model support
- Model file validation
- HF API authentication (public models only)
- Automatic model updates
