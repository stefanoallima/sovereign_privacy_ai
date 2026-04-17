# Specs: Dynamic GPU Acceleration

## Current State (already implemented)
- `gpu_detect.rs`: nvidia-smi GPU detection, VRAM reporting, recommended_gpu_layers()
- `llama_backend.rs`: auto GPU layer offload on model load (line 644-662)
- `Cargo.toml`: `llama-cpp-2/cuda` feature enabled (statically linked)
- `inference.rs`: `ModelStatus.gpu_layers` already exposed
- `inference_commands.rs`: `get_gpu_info` Tauri command exists
- `ModelSettings.tsx`: GPU status bar with name/VRAM/backend display
- `.cargo/config.toml`: CRT static fix for esaxx-rs + llama-cpp-sys-2
- CUDA Toolkit 13.2 installed, `cargo check --features cuda` passes
- AILOCALMIND_GPU_LAYERS env var override works

## Remaining Requirements

### R1: CUDA Runtime DLL Bundling
The binary links against CUDA shared libs (cublas64, cudart64, cublasLt64).
On machines without CUDA Toolkit, these DLLs must ship alongside the EXE.
- Tauri `resources` field in tauri.conf.json bundles files into app dir
- Need to copy ~5 DLLs from CUDA Toolkit install

### R2: Graceful CPU Fallback
If CUDA DLLs are missing at runtime (CPU-only machine), the app must still work.
- Currently: if CUDA DLL missing, entire binary may fail to start
- Needed: build with CUDA as optional feature, or catch load failure
- Simplest: feature-gate CUDA in Cargo.toml; build two variants; OR
- Better: llama.cpp itself handles missing CUDA gracefully when n_gpu_layers=0

### R3: GPU Toggle in Settings
User should be able to force CPU mode even on GPU machines.
- Persist setting in SQLite (existing `settings` table)
- On toggle: set gpu_layers=0 and reload model
- Frontend: toggle switch in GPU status bar

### R4: VRAM-Aware Model Recommendations
Don't suggest models that won't fit in VRAM.
- Use `recommended_gpu_layers()` to check if full offload is possible
- Show "May not fit in GPU" warning for large models on small VRAM GPUs
- Show estimated VRAM usage per model

### R5: Inference Speed Display
Show tok/s during/after generation so user can verify GPU acceleration.
- Backend already logs tok/s to stderr
- Need to surface this in ModelStatus or as separate event
- Frontend: show speed in chat message footer

## Out of Scope (Phase 2+)
- Vulkan backend (AMD/Intel GPU support)
- Optional GPU DLL download post-install
- macOS Metal support
- Multi-GPU support

## User's Hardware
- RTX 2060 6GB VRAM, CUDA 12.1 driver
- CUDA Toolkit 13.2 installed (build machine = target machine for now)
- 1.7B model: full offload → ~80-120 tok/s expected
- 4B model: full offload → ~40-60 tok/s expected
- 8B model: partial offload only (5.5GB model, 6GB VRAM)
