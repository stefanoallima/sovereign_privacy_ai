# Design: Dynamic GPU Acceleration

## Architecture Decision: Static CUDA Linking (Current Approach)

The codebase already compiles with `llama-cpp-2/cuda` feature. Rather than implementing
complex dynamic DLL loading, we keep the current approach and handle distribution:

1. **Build with CUDA statically linked** (already done)
2. **Bundle CUDA runtime DLLs** alongside the EXE via Tauri `resources`
3. **llama.cpp handles CPU fallback** — when n_gpu_layers=0, it runs CPU-only regardless of CUDA presence
4. **gpu_detect.rs** already detects GPU and computes optimal layer count

This is simpler and more reliable than dynamic loading. The tradeoff is a larger installer
(+200-400MB for CUDA DLLs), which is acceptable for a desktop app.

## Component Changes

### 1. Tauri Config (tauri.conf.json)
Add `resources` array to bundle CUDA DLLs from CUDA Toolkit:
```json
"bundle": {
  "resources": [
    { "from": "C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v13.2/bin/cublas64_12.dll", "to": "" },
    { "from": "C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v13.2/bin/cublasLt64_12.dll", "to": "" },
    { "from": "C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v13.2/bin/cudart64_12.dll", "to": "" }
  ]
}
```

### 2. GPU Toggle (Rust + Frontend)
- New setting key: `gpu_enabled` (boolean, default true)
- On model load: if `gpu_enabled=false`, force `n_gpu_layers=0`
- Frontend: toggle in GPU status bar → calls `set_setting` + triggers model reload
- New command: `set_gpu_enabled(enabled: bool)` → persists + reloads model

### 3. VRAM Warnings (Frontend)
- Call `get_gpu_info` on mount (already done)
- For each model in list: compute `recommended_gpu_layers(gpu, model.size_bytes)`
- If layers < 999: show "Partial GPU offload" or "CPU only" warning
- Show estimated VRAM usage: `model.size_bytes * 0.65 / 1024 / 1024` MB

### 4. Inference Speed (Rust → Frontend)
- Add `last_gen_speed_tps: f32` to `ModelStatus` struct
- Set it after each inference run in `run_inference_capped()`
- Frontend reads it via `get_model_status` and shows in chat footer

## Acceptance Criteria
- [ ] App starts on machines with CUDA GPU → uses GPU acceleration
- [ ] App starts on CPU-only machines → runs in CPU mode (no crash)
- [ ] Settings shows GPU name, VRAM, backend, and toggle
- [ ] Toggle to CPU mode persists and takes effect on next inference
- [ ] Models that won't fully fit in VRAM show a warning
- [ ] tok/s is visible in the UI after generation completes
- [ ] No regression in existing inference behavior
