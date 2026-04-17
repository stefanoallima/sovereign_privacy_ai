# Design: green_gemma4-orchestration_01

## Architecture Overview

```
User Message
    │
    ▼
┌──────────────┐
│ Backend      │ (existing — picks local/cloud/hybrid per persona)
│ Router       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Local LLM    │ ← Gemma 4 E4B (128K ctx) or Qwen3
│ (llama.cpp)  │
└──────┬───────┘
       │ response
       ▼
┌──────────────┐
│ Orchestrator │ NEW — analyzes response confidence
│              │
│  confident?  │──yes──▶ Return response directly
│              │
│  uncertain?  │──▶ Extract question
│              │    ──▶ Anonymize (existing pipeline)
│              │    ──▶ Send to Cloud (Nebius)
│              │    ──▶ Merge cloud answer
│              │    ──▶ Return enhanced response
└──────────────┘
```

## D1: Model Registry Changes (llama_backend.rs)

Add two Gemma 4 entries to `local_model_registry()`:

```rust
LocalModelInfo {
    id: "gemma4-e2b",
    name: "Gemma 4 E2B (Compact)",
    filename: "gemma-4-e2b-it-Q8_0.gguf",
    url: "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-e2b-it-Q8_0.gguf",
    size_bytes: 4_970_000_000,  // 4.97 GB Q8_0 (no Q4_K_M available)
    ctx_size: 32768,
    description: "Compact multimodal. 128K capable, 32K default. Good quality, fast.",
    speed_tier: "fast",
    intelligence_tier: "high",
}

LocalModelInfo {
    id: "gemma4-e4b",
    name: "Gemma 4 E4B (Recommended)",
    filename: "gemma-4-e4b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf",
    size_bytes: 5_340_000_000,  // 5.34 GB Q4_K_M
    ctx_size: 32768,
    description: "Best local model. 128K capable, 32K default. Multimodal ready.",
    speed_tier: "medium",
    intelligence_tier: "very-high",
}
```

**Key design decisions:**
- Default ctx_size = 32768 (not 128K) to avoid OOM on typical hardware
- Users can increase via settings if they have enough VRAM
- Sorted by size in registry (E2B between qwen3-4b and qwen3-8b, E4B after qwen3-8b)

## D2: Context Size Scaling

Update `max_gen_tokens()`:
```rust
fn max_gen_tokens(ctx_size: u32) -> usize {
    match ctx_size {
        0..=2048 => 512,
        2049..=4096 => 1024,
        4097..=8192 => 2048,
        8193..=16384 => 4096,
        16385..=65536 => 4096,   // NEW
        _ => 8192,               // NEW: 64K+ gets 8K gen
    }
}
```

Increase N_BATCH for large context models:
```rust
fn batch_size(ctx_size: u32) -> u32 {
    if ctx_size >= 32768 { 512 } else { 256 }
}
```

## D3: Orchestration Module (NEW: orchestration.rs)

### Uncertainty Detection

```rust
pub struct UncertaintySignal {
    pub is_uncertain: bool,
    pub confidence: f32,       // 0.0 = very uncertain, 1.0 = very confident
    pub reason: String,
    pub extracted_question: Option<String>,
}

pub fn detect_uncertainty(response: &str) -> UncertaintySignal {
    // 1. Check for explicit uncertainty phrases
    // 2. Check response length (very short = likely uncertain)
    // 3. Check for hedging language
    // 4. Check for repetition (sign of model struggling)
}
```

### Cloud Delegation Pipeline

```rust
pub async fn delegate_to_cloud(
    original_question: &str,
    local_response: &str,
    anonymization_service: &AnonymizationService,
    cloud_api_key: &str,
    cloud_model: &str,
) -> Result<String, OrchestrationError> {
    // 1. Extract the core question (what the user actually needs answered)
    // 2. Anonymize the question using existing pipeline
    // 3. Send to Nebius API
    // 4. Return cloud response
}
```

### Integration Point

The orchestration hooks into the existing `ollama_generate` flow:
1. Local model generates response
2. Orchestrator checks confidence
3. If uncertain AND orchestration enabled for persona → delegate to cloud
4. Return either local response or enhanced cloud response

**NOT changing**: backend_routing.rs stays as-is. Orchestration is a post-processing layer on the local model's output, not a replacement for the routing decision.

## D4: Persona Configuration Extension

Add to Persona struct (via DB migration):
```sql
ALTER TABLE personas ADD COLUMN enable_cloud_delegation INTEGER DEFAULT 0;
ALTER TABLE personas ADD COLUMN cloud_delegation_threshold REAL DEFAULT 0.5;
```

Frontend sends these with persona creation/update.

## D5: Frontend Changes

### Model List
- Gemma 4 models appear in Settings → Privacy & Local → Model Download
- Show context window size, speed tier, intelligence tier per model
- Recommended badge on Gemma 4 E4B

### Chat Messages
- When cloud delegation occurs, show subtle indicator:
  `[cloud-assisted]` badge on message
- Tooltip: "This response was enhanced with cloud AI (your data was anonymized)"

### Persona Settings
- New checkbox: "Enable smart cloud delegation"
- Only visible when backend is "hybrid" or "ollama"
