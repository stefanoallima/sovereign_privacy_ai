# Tasks: Dynamic GPU Acceleration

## T01: Bundle CUDA Runtime DLLs in Tauri
- [x] Add `resources` to `tauri.conf.json` to bundle cublas64_13.dll, cublasLt64_13.dll, cudart64_13.dll
- Effort: S
- Files: apps/desktop/src-tauri/tauri.conf.json

## T02: Add GPU Toggle in Settings
- [x] Add `set_gpu_enabled` / `is_gpu_enabled` Tauri commands
- [x] Read `gpu_enabled` flag on model load; if false, force n_gpu_layers=0
- [x] Add toggle switch in GPU status bar in ModelSettings.tsx
- Effort: M
- Files: inference_commands.rs, llama_backend.rs, ModelSettings.tsx

## T03: Add VRAM-Aware Model Warnings
- [x] Compute estimated VRAM per model using 65% heuristic
- [x] Show "PARTIAL GPU" badge per model when model won't fully fit in VRAM
- Effort: S
- Files: ModelSettings.tsx

## T04: Surface Inference Speed (tok/s) to Frontend
- [x] Add `last_gen_speed_tps` field to `ModelStatus` struct
- [x] Record tok/s after generation in `run_inference_capped()`
- [x] Display "Last: X.X tok/s" in GPU status bar
- Effort: S
- Files: inference.rs, llama_backend.rs, ModelSettings.tsx

## T05: Cargo Test + Build Verification
- [x] Fix gpu_detect partial offload test (wrong test model size)
- [x] Run `cargo test` — 158 passed, 2 pre-existing failures (file_parsers, unrelated)
- [x] Run `cargo check` — compiles clean with CUDA feature
- [x] TypeScript type check — passes clean
- Effort: S
