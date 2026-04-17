# Change: green_gemma4-orchestration_01

## Status
proposed

## Summary
Add Gemma 4 E4B model support (128k context, multimodal) and improve the orchestration layer so the local model can intelligently delegate questions to the cloud model.

## Motivation
Current setup uses Qwen3-8B Q4_K_M with limited context window. Gemma 4 E4B offers:
- **128k context window** — massively better for document-heavy conversations and RAG
- **4.5B effective params** (8B with embeddings) — similar resource footprint to current model
- **Multimodal** — image + audio input support (future-ready)
- **Apache 2.0** — fully open, no licensing concerns
- **GGUF available** — drop-in for our llama.cpp backend via `ggml-org/gemma-4-E4B-it-GGUF`

The orchestration improvement lets the local model recognize when it lacks knowledge and route specific sub-questions to the cloud model, getting better answers while keeping PII local.

## Scope
What's included:
- Gemma 4 E4B GGUF model download and configuration
- Update `llama_backend.rs` for Gemma 4 model parameters (128k context, chat template)
- Model selection UI — let user pick between Qwen3-8B and Gemma 4 E4B
- Orchestration layer: local model identifies questions needing cloud expertise
- Cloud query pipeline: anonymize sub-question -> send to cloud -> merge answer back
- Update model download/management for multiple models

What's NOT included:
- Multimodal (image/audio) input — future change
- Gemma 4 E2B (too small) or 31B/26B (too large for most local GPUs)
- Fine-tuning or LoRA adapters
- Changing the privacy pipeline fundamentals

## Success Criteria
- [ ] Gemma 4 E4B GGUF loads and runs inference correctly
- [ ] 128k context window is usable (not artificially limited)
- [ ] User can select model from UI
- [ ] Orchestration detects "I don't know" / knowledge-gap patterns
- [ ] Cloud delegation preserves PII anonymization
- [ ] Response quality improves for domain-specific questions (tax, finance)
- [ ] No regression in privacy guarantees

## Dependencies
- GGUF model: `ggml-org/gemma-4-E4B-it-GGUF` (Q4_K_M ~5GB)
- Existing llama.cpp backend must support Gemma 4 architecture
- Cloud API (Nebius) endpoint remains available

## Risks
- llama.cpp GGUF support for Gemma 4: mitigate by checking ggml-org repo for confirmed support
- 128k context may require significant VRAM: mitigate with configurable context length
- Orchestration quality depends on local model's self-awareness: mitigate with explicit prompting and fallback heuristics
- Model download size (~5GB): mitigate with progress UI and resume support
