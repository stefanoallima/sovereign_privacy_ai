# Change: green_dynamic-gpu_01

## Status
proposed

## Summary
Ship a single EXE that auto-detects GPU at runtime and loads CUDA/Vulkan acceleration dynamically. CPU users see no difference; GPU users get 10-50x faster LLM inference automatically.

## Motivation
The local LLM runs on CPU at ~8 tok/s (1.7B model). Users with NVIDIA or AMD GPUs could run at 80-120 tok/s but currently can't because the backend is compiled for CPU only. Building separate GPU EXEs fragments distribution. Dynamic loading solves this — one EXE, automatic GPU detection.

## User's GPU: RTX 2060 6GB (CUDA 12.1 driver, no CUDA Toolkit installed)
- 1.7B model fits in VRAM (~1.5GB) → expected ~80-120 tok/s
- 4B model fits (~3GB) → expected ~40-60 tok/s
- 8B model does NOT fit (needs ~5.5GB + overhead)

## Scope
What's included:
- Build llama.cpp as a shared library (DLL) with CUDA backend
- Ship `llama_cuda.dll` alongside the EXE in the NSIS/MSI bundle
- Runtime detection: check for NVIDIA GPU → load CUDA DLL → fall back to CPU
- Settings UI: show detected GPU, allow manual CPU/GPU toggle
- Vulkan backend as second DLL option (covers AMD + Intel GPUs)
- VRAM-aware model recommendations (don't suggest 8B on 6GB card)

What's NOT included:
- macOS Metal support (separate future change)
- Multi-GPU / distributed inference
- GPU-accelerated GLiNER (stays on CPU/ONNX)
- Model quantization selection UI (keep current Q4_K_M)

## Success Criteria
- [ ] Single EXE installer works on machines with and without GPU
- [ ] GPU detected automatically on first launch — no user action needed
- [ ] LLM inference 10x+ faster on supported GPUs
- [ ] No regression on CPU-only machines
- [ ] Settings shows "GPU: RTX 2060 (CUDA)" or "GPU: None (CPU mode)"
- [ ] VRAM usage stays under GPU memory limit

## Dependencies
- CUDA Toolkit 12.x (build-time only, not needed on user's machine)
- Vulkan SDK (build-time only for Vulkan DLL)
- NVIDIA driver 525+ on user's machine (already standard)

## Risks
- **CRT mismatch**: CUDA DLL may require different CRT than the main EXE (known issue with esaxx-rs). Mitigation: build DLL with matching `/MT` flags.
- **DLL size**: CUDA DLL is ~200-400MB. Mitigation: optional download post-install, not bundled by default.
- **Driver compatibility**: Old NVIDIA drivers may not support CUDA 12. Mitigation: fall back to CPU gracefully.
- **CI complexity**: Need CUDA Toolkit in CI to build the DLL. Mitigation: build GPU DLLs in separate CI job, attach as release artifacts.

## Architecture Sketch
```
app startup
  → detect_gpu() (Rust: check nvidia-smi or NVML API)
  → if NVIDIA GPU found:
      → try LoadLibrary("llama_cuda.dll")
      → if success: use CUDA backend
      → if fail: log warning, use CPU backend
  → if AMD/Intel GPU found:
      → try LoadLibrary("llama_vulkan.dll")
      → if success: use Vulkan backend
      → if fail: use CPU backend
  → else: use CPU backend (statically linked, always available)
```

## Estimated Effort
- Build system changes (Cargo, CMake, CI): L
- Runtime DLL loading in Rust: M
- GPU detection (NVML or nvidia-smi): S
- Settings UI for GPU status: S
- VRAM-aware model suggestions: S
- Testing across GPU/CPU machines: M
- Vulkan DLL build: M (can be Phase 2)

## Phased Delivery
**Phase 1**: CUDA dynamic loading (NVIDIA only)
**Phase 2**: Vulkan dynamic loading (AMD + Intel)
**Phase 3**: Optional GPU DLL download from settings (not bundled in installer)
