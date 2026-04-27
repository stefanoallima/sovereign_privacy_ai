# Micro-Persona: T08 - Rust Tests

## Task
Write unit tests for URL parsing, JSON storage, and merge logic.

## Test Cases

### parse_hf_url
- Full URL: `https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf`
- URL without filename: `https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF`
- Short repo ID: `ggml-org/gemma-4-E4B-it-GGUF`
- Invalid: `not-a-url`
- Empty string

### CustomModelStore
- Save → Load roundtrip preserves data
- Missing file returns empty Vec
- Empty array file returns empty Vec
- Invalid JSON returns error

### Merge Logic
- Hardcoded models appear before custom
- Custom models have `custom-` prefix
- Empty custom list returns hardcoded only
- Mixed custom and hardcoded merge correctly

## Quality Bar
- All test cases pass
- No panics on any input
- Graceful error handling in all cases
