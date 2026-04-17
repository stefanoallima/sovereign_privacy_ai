# Change: green_custom-model-hf_01

## Metadata
sudd_version: 3.1

## Status
proposed

## Summary
Add ability to dynamically load GGUF models from HuggingFace URLs without hardcoding, with auto-metadata fetching from HF API.

## Motivation
Currently, local models are hardcoded in `llama_backend.rs::local_model_registry()`. Adding new models requires code changes and releases. Users want to add custom GGUF models from HuggingFace on-the-fly.

## Scope
What's included:
- JSON-based custom model registry (stored in models_dir/custom_models.json)
- Auto-fetch model metadata from HuggingFace API
- Fallback to manual entry if HF API fails
- UI for adding/removing custom models
- Integration with existing model list and download flow

What's NOT included:
- Direct model downloading (reuses existing download infrastructure)
- Non-GGUF model support
- Model validation or testing

## Success Criteria
- [ ] User can add custom GGUF model via HF URL
- [ ] Metadata auto-populated from HF API
- [ ] Custom models appear in model list with correct info
- [ ] User can remove custom models
- [ ] Existing hardcoded models still work unchanged
- [ ] Graceful error handling when HF API unavailable

## Dependencies
- green_gemma4-orchestration_01 (for context on model registry patterns)

## Risks
- HF API rate limits: mitigation via caching and fallback to manual
- Malformed URLs: validation before API call
