# Log: green_dynamic-gpu_01

## 2026-03-29 — Proposal Created
- User has RTX 2060 6GB, CUDA 12.1 driver, no CUDA Toolkit
- Goal: single EXE with runtime GPU detection
- Phase 1: CUDA (NVIDIA), Phase 2: Vulkan (AMD+Intel), Phase 3: optional download

## 2026-03-29 — Foundation Test PASSED
- CUDA Toolkit 13.2 installed via `winget install NVIDIA.CUDA`
- `nvcc --version`: V13.2.51, release 13.2
- `cargo check --features llama-cpp-2/cuda`: PASSED (66 min first build, cached now)
- Corrupt .obj from interrupted build required full clean rebuild
- Environment vars needed: CUDA_PATH, CUDACXX, CudaToolkitDir
- Next: Implement runtime GPU detection + conditional CUDA feature

## 2026-04-15 — Brown Mode Implementation
- Mode: brown (specs/design/tasks were empty, existing code had GPU support)
- Assessed current state: gpu_detect.rs, llama_backend.rs GPU offload, get_gpu_info command all existed
- Filled specs.md, design.md, tasks.md based on gap analysis

### T01: CUDA DLL Bundling
- Added `resources` to tauri.conf.json for cublas64_13, cublasLt64_13, cudart64_13 DLLs
- DLLs located at CUDA v13.2/bin/x64/

### T02: GPU Toggle
- Added `gpu_enabled` AtomicBool to LlamaCppBackend
- `set_gpu_enabled()` clears loaded model to force reload with new GPU settings
- `do_load_model()` checks gpu_enabled before computing GPU layers
- New commands: `set_gpu_enabled`, `is_gpu_enabled`
- Frontend: Toggle switch in GPU status bar with "GPU On" / "CPU Only" label

### T03: VRAM Warnings
- Frontend computes estimated VRAM per model (65% of file size heuristic)
- Shows "PARTIAL GPU" badge when model won't fully offload to GPU
- Tooltip shows exact VRAM needed vs available

### T04: Inference Speed
- Added `last_gen_speed_tps` AtomicU32 to LlamaCppBackend (stores f32 bits)
- Records tok/s after each generation in run_inference_capped()
- Added to ModelStatus struct (gpu_enabled + last_gen_speed_tps fields)
- Frontend shows "Last: X.X tok/s" in GPU status bar

### T05: Verification
- Fixed gpu_detect partial offload test (8GB model on 6GB GPU actually fits at 65% heuristic — used 14GB model instead)
- cargo test: 158 passed, 2 pre-existing failures (file_parsers — unrelated)
- cargo check: clean compile with CUDA feature
- TypeScript: npx tsc --noEmit passes clean
