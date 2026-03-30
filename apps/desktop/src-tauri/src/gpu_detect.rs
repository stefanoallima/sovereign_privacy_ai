use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub available: bool,
    pub name: String,
    pub vram_mb: u64,
    pub backend: String,  // "cuda", "vulkan", "cpu"
}

/// Detect NVIDIA GPU using nvidia-smi
pub fn detect_gpu() -> GpuInfo {
    // Try nvidia-smi from common paths (PATH may not include it in Tauri context)
    let nvidia_smi_paths = [
        "nvidia-smi".to_string(),
        "C:\\Windows\\System32\\nvidia-smi.exe".to_string(),
        "C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe".to_string(),
    ];

    for smi_path in &nvidia_smi_paths {
        if let Some(info) = try_nvidia_smi(smi_path) {
            return info;
        }
    }

    GpuInfo { available: false, name: "None".into(), vram_mb: 0, backend: "cpu".into() }
}

fn try_nvidia_smi(path: &str) -> Option<GpuInfo> {
    match std::process::Command::new(path)
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let line = stdout.trim();
            if let Some((name, vram)) = line.split_once(',') {
                let vram_mb = vram.trim().parse::<u64>().unwrap_or(0);
                return Some(GpuInfo {
                    available: true,
                    name: name.trim().to_string(),
                    vram_mb,
                    backend: "cuda".to_string(),
                });
            }
            None
        }
        _ => None,
    }
}

/// Calculate how many layers to offload to GPU based on model size and available VRAM.
/// Returns 0 if no GPU or insufficient VRAM.
pub fn recommended_gpu_layers(gpu: &GpuInfo, model_size_bytes: u64) -> u32 {
    if !gpu.available || gpu.vram_mb == 0 {
        return 0;
    }

    // Reserve 512MB for OS/display, use the rest for the model
    let available_vram_mb = gpu.vram_mb.saturating_sub(512);
    let model_size_mb = model_size_bytes / (1024 * 1024);

    if model_size_mb == 0 {
        return 0;
    }

    // Rough heuristic: if model fits in VRAM, offload all layers (use 999 = all)
    // If partial fit, offload proportionally
    // GGUF Q4_K_M model VRAM usage is roughly 60-70% of file size
    let estimated_vram_usage_mb = (model_size_mb as f64 * 0.65) as u64;

    if estimated_vram_usage_mb <= available_vram_mb {
        // Full offload
        999 // llama.cpp treats large values as "all layers"
    } else {
        // Partial offload — roughly proportional
        let ratio = available_vram_mb as f64 / estimated_vram_usage_mb as f64;
        let layers = (ratio * 35.0) as u32; // ~35 layers for typical model
        layers.max(1) // At least 1 layer on GPU
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_gpu_returns_info() {
        let info = detect_gpu();
        // Just verify it doesn't panic and returns valid structure
        assert!(!info.backend.is_empty());
    }

    #[test]
    fn test_recommended_gpu_layers_no_gpu() {
        let gpu = GpuInfo {
            available: false,
            name: "None".into(),
            vram_mb: 0,
            backend: "cpu".into(),
        };
        assert_eq!(recommended_gpu_layers(&gpu, 5_000_000_000), 0);
    }

    #[test]
    fn test_recommended_gpu_layers_full_offload() {
        let gpu = GpuInfo {
            available: true,
            name: "RTX 4090".into(),
            vram_mb: 24576,
            backend: "cuda".into(),
        };
        // 5GB model, 24GB VRAM → full offload
        assert_eq!(recommended_gpu_layers(&gpu, 5_000_000_000), 999);
    }

    #[test]
    fn test_recommended_gpu_layers_partial_offload() {
        let gpu = GpuInfo {
            available: true,
            name: "RTX 2060".into(),
            vram_mb: 6144,
            backend: "cuda".into(),
        };
        // 8GB model → partial offload on 6GB GPU
        let layers = recommended_gpu_layers(&gpu, 8_000_000_000);
        assert!(layers > 0);
        assert!(layers < 999);
    }

    #[test]
    fn test_recommended_gpu_layers_zero_model_size() {
        let gpu = GpuInfo {
            available: true,
            name: "RTX 2060".into(),
            vram_mb: 6144,
            backend: "cuda".into(),
        };
        assert_eq!(recommended_gpu_layers(&gpu, 0), 0);
    }
}
