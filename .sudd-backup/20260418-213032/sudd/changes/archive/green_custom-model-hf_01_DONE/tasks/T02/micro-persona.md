# Micro-Persona: T02 - URL Parsing and HF API Integration

## Task
Implement `parse_hf_url()` to extract repo_id and filename, and `fetch_hf_metadata()` to call HuggingFace API and parse response.

## Consumer
The Tauri command `fetch_hf_model_metadata` that returns `HfModelMetadata` to the frontend.

## Contract
```rust
fn parse_hf_url(url: &str) -> Result<(String, String), String>;
// "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf"
// → Ok(("ggml-org/gemma-4-E4B-it-GGUF", "gemma-4-e4b-it-Q4_K_M.gguf"))

async fn fetch_hf_metadata(repo_id: &str) -> Result<HfModelMetadata, String>;
```

## Supported URL Formats
1. `https://huggingface.co/{repo_id}/resolve/main/{filename}`
2. `https://huggingface.co/{repo_id}` (short form - no filename)
3. `{repo_id}` (just repo ID)

## Quality Bar
- Unit tests for all URL formats
- Timeout of 10 seconds enforced
- HF API 404 returns clear "Model not found" error
- JSON parse failure returns clear error message
