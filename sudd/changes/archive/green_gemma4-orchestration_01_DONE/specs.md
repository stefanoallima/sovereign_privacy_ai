# Specs: green_gemma4-orchestration_01

## S1: Add Gemma 4 E4B to Model Registry

### Requirements
- Add `gemma4-e4b` entry to `local_model_registry()` in `llama_backend.rs`
- GGUF URL: from `ggml-org/gemma-4-E4B-it-GGUF` collection (Q4_K_M variant)
- Context size: 32768 (practical default; user can increase up to 128K if VRAM allows)
- Size: ~5 GB (Q4_K_M)
- Mark as `intelligence_tier: "very-high"`, `speed_tier: "medium"`
- Also add `gemma4-e2b` (smaller, 2.3B effective, 128K context, ~3 GB Q4_K_M)

### Acceptance Criteria
- [ ] `local_model_registry()` returns Gemma 4 entries
- [ ] Models downloadable via existing `download_local_model` command
- [ ] Models load and run inference correctly
- [ ] Existing Qwen3 models unaffected

## S2: Support Large Context Windows

### Requirements
- Update `max_gen_tokens()` to handle ctx_size > 16K (up to 128K)
- Add context size configuration: allow users to override ctx_size per model
- For 128K context, batch size should increase (N_BATCH 512-1024)
- KV cache quantization (already Q8_0) is critical at 128K — keep it

### Acceptance Criteria
- [ ] 32K context works out of the box for Gemma 4
- [ ] User can configure context size in model settings
- [ ] max_gen_tokens scales appropriately (4096 for 32K+, 8192 for 64K+)
- [ ] No OOM crashes on 8GB VRAM GPUs with 32K context

## S3: Smart Orchestration — Cloud Question Delegation

### Requirements
- New `orchestration.rs` module
- After local model generates a response, analyze it for uncertainty signals:
  - Explicit: "I don't know", "I'm not sure", "I cannot answer"
  - Implicit: very short response (<50 chars), repetitive text, low-confidence markers
- When uncertainty detected:
  1. Extract the core question (strip PII context)
  2. Anonymize using existing pipeline
  3. Send to cloud (Nebius) for expert answer
  4. Merge cloud answer back into conversation
- Configuration: enable/disable per persona, confidence threshold
- Works with `hybrid` backend mode

### Acceptance Criteria
- [ ] Orchestration detects uncertainty in local model responses
- [ ] Cloud delegation only happens when local model is uncertain
- [ ] PII is anonymized before cloud delegation
- [ ] Cloud response is merged back coherently
- [ ] User sees indication that cloud was consulted
- [ ] Can be disabled per persona

## S4: Frontend — Model Selection & Orchestration UI

### Requirements
- Model selector already exists (multi-model commands in inference_commands.rs)
- Add Gemma 4 models to the model list UI
- Add orchestration toggle in persona settings:
  - "Enable smart cloud delegation" checkbox
  - Confidence threshold slider (optional, advanced)
- Show cloud delegation indicator in chat messages
- Show model info (context size, speed tier) in model selector

### Acceptance Criteria
- [ ] Gemma 4 models appear in model download/selection UI
- [ ] Orchestration toggle visible in persona settings
- [ ] Chat messages show when cloud was consulted
- [ ] Model info displayed (context window, size, speed tier)
