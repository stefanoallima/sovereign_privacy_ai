use crate::inference::{InferenceError, LocalInference, ModelStatus};
use crate::gpu_detect;
use async_trait::async_trait;
use directories::ProjectDirs;
use llama_cpp_2::context::params::{KvCacheType, LlamaContextParams};
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel, Special};
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::llama_backend::LlamaBackend as LlamaBackendInit;
use log::info;
use std::sync::OnceLock;

// Global backend singleton — llama.cpp only allows one init per process
static LLAMA_BACKEND: OnceLock<LlamaBackendInit> = OnceLock::new();
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Model registry — all available local GGUF models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub url: String,
    pub size_bytes: u64,
    pub ctx_size: u32,
    pub description: String,
    pub speed_tier: String,
    pub intelligence_tier: String,
    /// Whether this model file exists on disk
    #[serde(default)]
    pub is_downloaded: bool,
    /// Absolute path when downloaded
    #[serde(default)]
    pub local_path: Option<String>,
}

/// Static registry of available models (smallest → largest).
pub fn local_model_registry() -> Vec<LocalModelInfo> {
    vec![
        LocalModelInfo {
            id: "qwen3-0.6b".into(),
            name: "Qwen3 0.6B (Ultra-Light)".into(),
            filename: "Qwen3-0.6B-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf".into(),
            size_bytes: 530_000_000,
            ctx_size: 4096,       // 0.6B can handle 4K easily with Q4 quant
            description: "Fastest, lowest RAM. Good for simple Q&A.".into(),
            speed_tier: "very-fast".into(),
            intelligence_tier: "good".into(),
            is_downloaded: false,
            local_path: None,
        },
        LocalModelInfo {
            id: "qwen3-1.7b".into(),
            name: "Qwen3 1.7B (Light)".into(),
            filename: "Qwen3-1.7B-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf".into(),
            size_bytes: 1_200_000_000,
            ctx_size: 8192,
            description: "Good balance of speed and quality. Recommended for most users.".into(),
            speed_tier: "fast".into(),
            intelligence_tier: "high".into(),
            is_downloaded: false,
            local_path: None,
        },
        LocalModelInfo {
            id: "qwen3-4b".into(),
            name: "Qwen3 4B (Medium)".into(),
            filename: "Qwen3-4B-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf".into(),
            size_bytes: 2_700_000_000,
            ctx_size: 8192,
            description: "Higher quality responses. Needs ~4 GB RAM.".into(),
            speed_tier: "medium".into(),
            intelligence_tier: "high".into(),
            is_downloaded: false,
            local_path: None,
        },
        // NOTE: Qwen3.5 uses a novel SSM+attention hybrid architecture ('qwen35')
        // that is NOT yet supported by llama-cpp-2 v0.1.x. Disabled until crate update.
        // LocalModelInfo {
        //     id: "qwen3.5-4b".into(),
        //     name: "Qwen3.5 4B (Recommended)".into(),
        //     ...
        // },
        LocalModelInfo {
            id: "gemma4-e2b".into(),
            name: "Gemma 4 E2B (Compact)".into(),
            filename: "gemma-4-e2b-it-Q8_0.gguf".into(),
            url: "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-e2b-it-Q8_0.gguf".into(),
            size_bytes: 4_970_000_000,
            ctx_size: 32768,
            description: "Gemma 4 compact. 128K capable, 32K default. Fast multimodal.".into(),
            speed_tier: "fast".into(),
            intelligence_tier: "high".into(),
            is_downloaded: false,
            local_path: None,
        },
        LocalModelInfo {
            id: "gemma4-e4b".into(),
            name: "Gemma 4 E4B (Recommended)".into(),
            filename: "gemma-4-e4b-it-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf".into(),
            size_bytes: 5_340_000_000,
            ctx_size: 32768,
            description: "Best local model. 128K capable, 32K default. Multimodal ready.".into(),
            speed_tier: "medium".into(),
            intelligence_tier: "very-high".into(),
            is_downloaded: false,
            local_path: None,
        },
        LocalModelInfo {
            id: "qwen3-8b".into(),
            name: "Qwen3 8B (Full)".into(),
            filename: "Qwen3-8B-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/6a569868d07d3bd59e8b97fb001bf8c0b254bb20/Qwen3-8B-Q4_K_M.gguf".into(),
            size_bytes: 5_030_000_000,
            ctx_size: 16384,
            description: "Best quality. Needs ~7 GB RAM. Slower on CPU.".into(),
            speed_tier: "slow".into(),
            intelligence_tier: "very-high".into(),
            is_downloaded: false,
            local_path: None,
        },
    ]
}

// ---------------------------------------------------------------------------
// Custom model storage — user-added GGUF models from HuggingFace
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomModelFile {
    custom_models: Vec<LocalModelInfo>,
}

pub struct CustomModelStore;

impl CustomModelStore {
    fn path(models_dir: &Path) -> PathBuf {
        models_dir.join("custom_models.json")
    }

    pub fn load(models_dir: &Path) -> Result<Vec<LocalModelInfo>, String> {
        let path = Self::path(models_dir);
        if !path.exists() {
            return Ok(Vec::new());
        }
        let data = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read custom models: {}", e))?;
        let file: CustomModelFile = serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse custom models JSON: {}", e))?;
        Ok(file.custom_models)
    }

    pub fn save(models_dir: &Path, models: &[LocalModelInfo]) -> Result<(), String> {
        let file = CustomModelFile {
            custom_models: models.to_vec(),
        };
        let json = serde_json::to_string_pretty(&file)
            .map_err(|e| format!("Failed to serialize custom models: {}", e))?;
        std::fs::write(Self::path(models_dir), json)
            .map_err(|e| format!("Failed to write custom models: {}", e))
    }
}

// ---------------------------------------------------------------------------
// HuggingFace integration — URL parsing and metadata fetching
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfModelMetadata {
    pub repo_id: String,
    pub filename: String,
    pub name: String,
    pub description: String,
    pub inferred_ctx_size: u32,
}

/// Parse a HuggingFace URL or repo ID into (repo_id, filename).
///
/// Supported formats:
/// - Full URL: `https://huggingface.co/{owner}/{repo}/resolve/main/{filename}`
/// - Blob URL: `https://huggingface.co/{owner}/{repo}/blob/main/{filename}`
/// - Short repo ID: `{owner}/{repo}` (filename defaults to first .gguf found)
pub fn parse_hf_url(url: &str) -> Result<(String, String), String> {
    let url = url.trim();

    // Full URL format
    if url.starts_with("https://huggingface.co/") || url.starts_with("http://huggingface.co/") {
        let path = url
            .trim_start_matches("https://huggingface.co/")
            .trim_start_matches("http://huggingface.co/");

        // Expected: {owner}/{repo}/resolve/main/{filename}
        // or:       {owner}/{repo}/blob/main/{filename}
        let parts: Vec<&str> = path.splitn(5, '/').collect();
        if parts.len() >= 5 && (parts[2] == "resolve" || parts[2] == "blob") {
            let repo_id = format!("{}/{}", parts[0], parts[1]);
            let filename = parts[4].to_string();
            if filename.is_empty() {
                return Err("URL has no filename".into());
            }
            return Ok((repo_id, filename));
        }

        // Might be just https://huggingface.co/{owner}/{repo}
        if parts.len() >= 2 && !parts[0].is_empty() && !parts[1].is_empty() {
            let repo_id = format!("{}/{}", parts[0], parts[1]);
            return Ok((repo_id, String::new()));
        }

        return Err(format!("Could not parse HuggingFace URL: {}", url));
    }

    // Short format: owner/repo or owner/repo/filename
    if url.contains('/') && !url.contains("://") {
        let parts: Vec<&str> = url.splitn(3, '/').collect();
        if parts.len() >= 2 && !parts[0].is_empty() && !parts[1].is_empty() {
            let repo_id = format!("{}/{}", parts[0], parts[1]);
            let filename = if parts.len() == 3 && !parts[2].is_empty() {
                parts[2].to_string()
            } else {
                String::new()
            };
            return Ok((repo_id, filename));
        }
    }

    Err(format!("Invalid HuggingFace URL or repo ID: {}", url))
}

/// Fetch model metadata from the HuggingFace API.
pub async fn fetch_hf_metadata(repo_id: &str) -> Result<HfModelMetadata, String> {
    let api_url = format!("https://huggingface.co/api/models/{}", repo_id);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Couldn't reach HuggingFace. Check your connection.".to_string()
            } else {
                format!("Network error: {}", e)
            }
        })?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("Model not found on HuggingFace. Check the URL.".into());
    }
    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Too many requests. Try again later.".into());
    }
    if !response.status().is_success() {
        return Err(format!("HuggingFace error: HTTP {}", response.status()));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse HF API response: {}", e))?;

    let model_id = body["modelId"]
        .as_str()
        .unwrap_or(repo_id)
        .to_string();

    // Derive a friendly name from the model ID
    let name = model_id
        .split('/')
        .last()
        .unwrap_or(&model_id)
        .to_string();

    let description = body["description"]
        .as_str()
        .map(|d| d.chars().take(200).collect::<String>())
        .unwrap_or_default();

    // Try to find a .gguf filename from siblings
    let filename = body["siblings"]
        .as_array()
        .and_then(|siblings| {
            siblings.iter().find_map(|s| {
                let fname = s["rfilename"].as_str()?;
                if fname.ends_with(".gguf") {
                    Some(fname.to_string())
                } else {
                    None
                }
            })
        })
        .unwrap_or_default();

    Ok(HfModelMetadata {
        repo_id: model_id,
        filename,
        name,
        description,
        inferred_ctx_size: 8192,
    })
}

/// Max generation tokens, scaled by context size.
/// Larger context → more room for the model to think and respond.
fn max_gen_tokens(ctx_size: u32) -> usize {
    match ctx_size {
        0..=2048 => 512,
        2049..=4096 => 1024,
        4097..=8192 => 2048,
        8193..=16384 => 4096,
        16385..=65536 => 4096,
        _ => 8192, // 64K+ context gets 8K generation budget
    }
}

/// Max CPU threads for inference. More threads can hurt due to memory-bandwidth
/// contention on most consumer CPUs.
const MAX_THREADS: u32 = 4;

/// Batch size for prompt prefill, scaled by context size.
/// Larger context models benefit from bigger batches during prefill.
fn batch_size(ctx_size: u32) -> u32 {
    if ctx_size >= 32768 { 512 } else { 256 }
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

struct LoadedModel {
    model: LlamaModel,
    model_id: String,
    ctx_size: u32,
    gpu_layers: u32,
}

// Safety: LlamaModel and LlamaBackendInit are internally managed by llama.cpp
// and we only access them from spawn_blocking contexts behind a mutex.
unsafe impl Send for LoadedModel {}
unsafe impl Sync for LoadedModel {}

pub struct LlamaCppBackend {
    models_dir: PathBuf,
    loaded_model: Arc<Mutex<Option<LoadedModel>>>,
    download_progress: Arc<AtomicU8>,
    is_loading: Arc<AtomicBool>,
    /// Which model ID should be loaded / is active
    active_model_id: Arc<Mutex<String>>,
    /// Whether GPU acceleration is enabled (user toggle)
    gpu_enabled: Arc<AtomicBool>,
    /// Last generation speed in tokens/second
    last_gen_speed_tps: Arc<std::sync::atomic::AtomicU32>,
}

impl LlamaCppBackend {
    pub fn new() -> Result<Self, InferenceError> {
        let project_dirs = ProjectDirs::from("com", "private-assistant", "PrivateAssistant")
            .ok_or_else(|| {
                InferenceError::ModelLoadFailed("Could not find project directories".to_string())
            })?;

        let models_dir = project_dirs.data_dir().join("llm-models");
        std::fs::create_dir_all(&models_dir).map_err(|e| {
            InferenceError::ModelLoadFailed(format!("Failed to create models directory: {}", e))
        })?;

        info!("LlamaCppBackend initialized, models_dir={}", models_dir.display());

        // Determine initial active model: pick the first downloaded model, or default to qwen3-1.7b
        let registry = local_model_registry();
        let initial_model = registry.iter()
            .find(|m| {
                let p = models_dir.join(&m.filename);
                p.exists() && p.metadata().map(|md| md.len() > 1_000_000).unwrap_or(false)
            })
            .map(|m| m.id.clone())
            .unwrap_or_else(|| "qwen3-1.7b".into());

        Ok(LlamaCppBackend {
            models_dir,
            loaded_model: Arc::new(Mutex::new(None)),
            download_progress: Arc::new(AtomicU8::new(0)),
            is_loading: Arc::new(AtomicBool::new(false)),
            active_model_id: Arc::new(Mutex::new(initial_model)),
            gpu_enabled: Arc::new(AtomicBool::new(true)),
            last_gen_speed_tps: Arc::new(std::sync::atomic::AtomicU32::new(0)),
        })
    }

    fn model_path(&self, filename: &str) -> PathBuf {
        self.models_dir.join(filename)
    }

    fn is_file_downloaded(&self, filename: &str) -> bool {
        let path = self.model_path(filename);
        path.exists() && path.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false)
    }

    /// List all models with their download status populated.
    /// Merges hardcoded registry with user-added custom models.
    pub fn list_models(&self) -> Vec<LocalModelInfo> {
        let mut models: Vec<LocalModelInfo> = local_model_registry().into_iter().map(|mut m| {
            let path = self.model_path(&m.filename);
            m.is_downloaded = path.exists() && path.metadata().map(|md| md.len() > 1_000_000).unwrap_or(false);
            if m.is_downloaded {
                m.local_path = Some(path.to_string_lossy().into_owned());
            }
            m
        }).collect();

        // Append custom models
        if let Ok(custom) = CustomModelStore::load(&self.models_dir) {
            for mut m in custom {
                let path = self.model_path(&m.filename);
                m.is_downloaded = path.exists() && path.metadata().map(|md| md.len() > 1_000_000).unwrap_or(false);
                if m.is_downloaded {
                    m.local_path = Some(path.to_string_lossy().into_owned());
                }
                models.push(m);
            }
        }

        models
    }

    /// Get the models directory path.
    pub fn models_dir(&self) -> &Path {
        &self.models_dir
    }

    pub fn models_dir_string(&self) -> String {
        self.models_dir.to_string_lossy().into_owned()
    }

    /// Get the active model ID.
    pub async fn get_active_model_id(&self) -> String {
        self.active_model_id.lock().await.clone()
    }

    /// Set the active model. The actual load/unload happens lazily in load_model_if_needed().
    pub async fn set_active_model(&self, model_id: &str) -> Result<(), InferenceError> {
        if !self.list_models().iter().any(|m| m.id == model_id) {
            return Err(InferenceError::ModelNotFound(format!("Unknown model: {}", model_id)));
        }
        let mut active = self.active_model_id.lock().await;
        if *active != model_id {
            eprintln!("[llama] set_active_model: {} → {}", *active, model_id);
            *active = model_id.to_string();
        }
        Ok(())
    }

    /// Download a specific model by ID.
    pub async fn download_model_by_id(&self, model_id: &str) -> Result<(), InferenceError> {
        let all_models = self.list_models();
        let info = all_models.iter().find(|m| m.id == model_id)
            .ok_or_else(|| InferenceError::ModelNotFound(format!("Unknown model: {}", model_id)))?;

        let path = self.model_path(&info.filename);
        if path.exists() && path.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false) {
            info!("Model {} already downloaded", model_id);
            return Ok(());
        }

        let url = info.url.clone();
        let expected_size = info.size_bytes;
        let progress = self.download_progress.clone();
        let path_clone = path.clone();

        eprintln!("[llama] downloading model {} from {}", model_id, url);
        progress.store(0, Ordering::Relaxed);

        tokio::task::spawn_blocking(move || -> Result<(), InferenceError> {
            let client = reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(7200))
                .build()
                .map_err(|e| InferenceError::DownloadFailed(format!("HTTP client error: {}", e)))?;

            let response = client
                .get(&url)
                .send()
                .map_err(|e| InferenceError::DownloadFailed(format!("Download request failed: {}", e)))?;

            if !response.status().is_success() {
                return Err(InferenceError::DownloadFailed(format!(
                    "HTTP {} from {}", response.status(), url
                )));
            }

            let total_size = response.content_length().unwrap_or(expected_size);
            let mut downloaded: u64 = 0;

            let temp_path = path_clone.with_extension("gguf.downloading");
            let mut file = std::fs::File::create(&temp_path).map_err(|e| {
                InferenceError::DownloadFailed(format!("Failed to create temp file: {}", e))
            })?;

            let mut hasher = Sha256::new();
            let mut reader = std::io::BufReader::new(response);
            let mut buf = [0u8; 65536];

            loop {
                use std::io::Read;
                let n = reader.read(&mut buf).map_err(|e| {
                    InferenceError::DownloadFailed(format!("Read error: {}", e))
                })?;
                if n == 0 { break; }
                use std::io::Write;
                file.write_all(&buf[..n]).map_err(|e| {
                    InferenceError::DownloadFailed(format!("Write error: {}", e))
                })?;
                hasher.update(&buf[..n]);
                downloaded += n as u64;
                let pct = ((downloaded as f64 / total_size as f64) * 100.0).min(99.0) as u8;
                progress.store(pct, Ordering::Relaxed);
            }

            let result = format!("{:x}", hasher.finalize());
            info!("Model SHA-256: {} (informational)", result);

            std::fs::rename(&temp_path, &path_clone).map_err(|e| {
                InferenceError::DownloadFailed(format!("Failed to rename temp file: {}", e))
            })?;

            progress.store(100, Ordering::Relaxed);
            info!("Model download complete: {}", path_clone.display());
            Ok(())
        })
        .await
        .map_err(|e| InferenceError::DownloadFailed(format!("Task join error: {}", e)))??;

        Ok(())
    }

    /// Delete a downloaded model.
    pub fn delete_model(&self, model_id: &str) -> Result<(), InferenceError> {
        let all_models = self.list_models();
        let info = all_models.iter().find(|m| m.id == model_id)
            .ok_or_else(|| InferenceError::ModelNotFound(format!("Unknown model: {}", model_id)))?;

        let path = self.model_path(&info.filename);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| {
                InferenceError::DownloadFailed(format!("Failed to delete model: {}", e))
            })?;
            eprintln!("[llama] deleted model {}", model_id);
        }
        Ok(())
    }

    pub fn get_download_progress(&self) -> u8 {
        self.download_progress.load(Ordering::Relaxed)
    }

    /// Get whether GPU acceleration is enabled.
    pub fn is_gpu_enabled(&self) -> bool {
        self.gpu_enabled.load(Ordering::Relaxed)
    }

    /// Toggle GPU acceleration. Unloads the current model so it reloads
    /// with the new GPU layer count on next inference.
    pub async fn set_gpu_enabled(&self, enabled: bool) {
        let prev = self.gpu_enabled.swap(enabled, Ordering::Relaxed);
        if prev != enabled {
            eprintln!("[llama] GPU enabled: {} → {}", prev, enabled);
            // Force model reload with new GPU settings
            let mut guard = self.loaded_model.lock().await;
            *guard = None;
        }
    }

    /// Last generation speed in tokens/second.
    pub fn last_gen_speed_tps(&self) -> f32 {
        f32::from_bits(self.last_gen_speed_tps.load(Ordering::Relaxed))
    }

    fn get_active_model_info_sync(active_id: &str, models_dir: &Path) -> Option<LocalModelInfo> {
        // Check hardcoded registry first
        if let Some(m) = local_model_registry().into_iter().find(|m| m.id == active_id) {
            return Some(m);
        }
        // Check custom models
        CustomModelStore::load(models_dir)
            .ok()
            .and_then(|custom| custom.into_iter().find(|m| m.id == active_id))
    }

    async fn load_model_if_needed(&self) -> Result<(), InferenceError> {
        let active_id = self.active_model_id.lock().await.clone();

        // Quick check: if correct model is already loaded, return immediately
        {
            let guard = self.loaded_model.lock().await;
            if let Some(loaded) = guard.as_ref() {
                if loaded.model_id == active_id {
                    return Ok(());
                }
                eprintln!("[llama] loaded model is {}, but active is {} — will reload", loaded.model_id, active_id);
            }
        }
        eprintln!("[llama] loading model {}…", active_id);

        // If another task is already loading, wait for it to finish
        if self.is_loading.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
            info!("Model is being loaded by another task — waiting…");
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                if !self.is_loading.load(Ordering::SeqCst) {
                    let guard = self.loaded_model.lock().await;
                    if guard.as_ref().map(|l| l.model_id == active_id).unwrap_or(false) {
                        return Ok(());
                    }
                    break;
                }
            }
            if self.is_loading.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
                return Err(InferenceError::ModelLoadFailed("Model is still loading".to_string()));
            }
        }

        let result = self.do_load_model(&active_id).await;
        self.is_loading.store(false, Ordering::SeqCst);

        // On failure, revert active_model_id to whatever is still loaded
        if result.is_err() {
            let guard = self.loaded_model.lock().await;
            if let Some(loaded) = guard.as_ref() {
                let mut active = self.active_model_id.lock().await;
                eprintln!("[llama] model load failed, reverting active model to {}", loaded.model_id);
                *active = loaded.model_id.clone();
            }
        }

        result
    }

    async fn do_load_model(&self, model_id: &str) -> Result<(), InferenceError> {
        let info = Self::get_active_model_info_sync(model_id, &self.models_dir)
            .ok_or_else(|| InferenceError::ModelNotFound(format!("Unknown model: {}", model_id)))?;

        let model_path = self.model_path(&info.filename);
        if !model_path.exists() {
            return Err(InferenceError::ModelNotFound(format!(
                "Model file not found: {}. Download it first.", model_path.display()
            )));
        }

        eprintln!("[llama] loading model {} from {}", model_id, model_path.display());

        let path_clone = model_path.clone();
        let ctx_size = info.ctx_size;
        let model_id_owned = model_id.to_string();

        // GPU auto-detection: check user toggle, env override, or auto-detect
        let gpu_user_enabled = self.gpu_enabled.load(Ordering::Relaxed);
        let model_size_for_gpu = info.size_bytes;
        let n_gpu_layers = if !gpu_user_enabled {
            eprintln!("[llama] GPU disabled by user toggle — using CPU only");
            0
        } else {
            match std::env::var("AILOCALMIND_GPU_LAYERS")
                .ok()
                .and_then(|v| v.parse::<u32>().ok())
            {
                Some(manual) => {
                    eprintln!("[llama] GPU layers override via AILOCALMIND_GPU_LAYERS={}", manual);
                    manual
                }
                None => {
                    let gpu = gpu_detect::detect_gpu();
                    let layers = gpu_detect::recommended_gpu_layers(&gpu, model_size_for_gpu);
                    eprintln!(
                        "[llama] GPU: {} ({}MB VRAM, backend={}), offloading {} layers",
                        gpu.name, gpu.vram_mb, gpu.backend, layers
                    );
                    layers
                }
            }
        };

        let loaded = tokio::task::spawn_blocking(move || -> Result<LoadedModel, InferenceError> {
            // Use global backend singleton — init once, reuse forever
            let backend = LLAMA_BACKEND.get_or_init(|| {
                eprintln!("[llama] initializing llama backend (one-time)");
                LlamaBackendInit::init().expect("Failed to init llama backend")
            });

            let model_params = LlamaModelParams::default()
                .with_n_gpu_layers(n_gpu_layers);

            let model =
                LlamaModel::load_from_file(&backend, &path_clone, &model_params).map_err(|e| {
                    InferenceError::ModelLoadFailed(format!("Failed to load model: {}", e))
                })?;

            eprintln!("[llama] model {} loaded successfully", model_id_owned);

            Ok(LoadedModel {
                model,
                model_id: model_id_owned,
                ctx_size,
                gpu_layers: n_gpu_layers,
            })
        })
        .await
        .map_err(|e| InferenceError::ModelLoadFailed(format!("Task join error: {}", e)))??;

        let mut guard = self.loaded_model.lock().await;
        *guard = Some(loaded);
        Ok(())
    }

    /// Run inference and return generated text.
    /// If `max_tokens_cap` is Some, it overrides the default max generation length.
    async fn run_inference(
        &self,
        prompt: &str,
        json_mode: bool,
    ) -> Result<String, InferenceError> {
        self.run_inference_capped(prompt, json_mode, None).await
    }

    /// Run inference with an optional hard cap on generated tokens.
    async fn run_inference_capped(
        &self,
        prompt: &str,
        json_mode: bool,
        max_tokens_cap: Option<usize>,
    ) -> Result<String, InferenceError> {
        self.load_model_if_needed().await?;

        let prompt_owned = prompt.to_string();
        let loaded_model = self.loaded_model.clone();
        let speed_tps = self.last_gen_speed_tps.clone();

        tokio::task::spawn_blocking(move || -> Result<String, InferenceError> {
            let start = std::time::Instant::now();

            let rt = tokio::runtime::Handle::current();
            let guard = rt.block_on(loaded_model.lock());
            let loaded = guard.as_ref().ok_or_else(|| {
                InferenceError::InferenceFailed("Model not loaded".to_string())
            })?;

            let ctx_size = loaded.ctx_size;

            // Cap threads for CPU inference
            let n_cpus = std::thread::available_parallelism()
                .map(|p| p.get() as u32)
                .unwrap_or(4);
            let n_threads = n_cpus.min(MAX_THREADS) as i32;

            let ctx_params = LlamaContextParams::default()
                .with_n_ctx(Some(NonZeroU32::new(ctx_size).unwrap()))
                .with_n_batch(batch_size(ctx_size))
                .with_n_threads(n_threads)
                .with_n_threads_batch(n_threads)
                .with_type_k(KvCacheType::Q8_0)   // quantize K cache — ~50% VRAM saving
                .with_type_v(KvCacheType::Q8_0);   // quantize V cache — negligible quality loss

            let mut ctx =
                loaded
                    .model
                    .new_context(LLAMA_BACKEND.get().expect("backend not initialized"), ctx_params)
                    .map_err(|e| {
                        InferenceError::InferenceFailed(format!(
                            "Failed to create context: {}", e
                        ))
                    })?;

            // /no_think is now placed in the user message by the frontend
            let tokens_list = loaded
                .model
                .str_to_token(&prompt_owned, AddBos::Always)
                .map_err(|e| {
                    InferenceError::InferenceFailed(format!("Tokenization failed: {}", e))
                })?;

            let token_count = tokens_list.len();
            eprintln!("[llama] prompt tokenized: {} tokens (ctx_size={})", token_count, ctx_size);

            // Truncate prompt if too long (keep last tokens = most recent context)
            let max_prompt = ctx_size as usize - 64; // leave room for generation
            let tokens_list = if token_count > max_prompt {
                eprintln!("[llama] prompt too long, truncating {} → {}", token_count, max_prompt);
                tokens_list[token_count - max_prompt..].to_vec()
            } else {
                tokens_list
            };
            let token_count = tokens_list.len();

            if tokens_list.is_empty() {
                return Err(InferenceError::InferenceFailed("Empty prompt after tokenization".to_string()));
            }

            // Evaluate prompt in smaller batches for better CPU performance
            let prefill_start = std::time::Instant::now();
            let n_batch = batch_size(ctx_size) as usize;
            let mut batch = LlamaBatch::new(n_batch, 1);

            for (i, chunk) in tokens_list.chunks(n_batch).enumerate() {
                batch.clear();
                let offset = i * n_batch;
                for (j, &token) in chunk.iter().enumerate() {
                    let pos = (offset + j) as i32;
                    let is_last = offset + j == token_count - 1;
                    batch.add(token, pos, &[0], is_last).map_err(|e| {
                        InferenceError::InferenceFailed(format!("Batch add failed: {}", e))
                    })?;
                }
                ctx.decode(&mut batch).map_err(|e| {
                    InferenceError::InferenceFailed(format!("Prompt decode failed: {}", e))
                })?;
            }

            let prefill_ms = prefill_start.elapsed().as_millis();
            eprintln!("[llama] prefill: {} tokens in {}ms ({:.0} tok/s)",
                token_count, prefill_ms,
                if prefill_ms > 0 { token_count as f64 / (prefill_ms as f64 / 1000.0) } else { 0.0 });

            // Set up sampler
            let mut sampler = if json_mode {
                LlamaSampler::chain_simple([
                    LlamaSampler::temp(0.1),
                    LlamaSampler::dist(42),
                ])
            } else {
                LlamaSampler::chain_simple([
                    LlamaSampler::temp(0.7),
                    LlamaSampler::top_p(0.9, 1),
                    LlamaSampler::dist(1234),
                ])
            };

            let mut output_bytes: Vec<u8> = Vec::new();
            // n_cur tracks the KV cache position for the next token.
            // Must use total token_count, NOT batch.n_tokens() which only
            // reflects the last prefill chunk size when prompt spans multiple batches.
            let mut n_cur = token_count as i32;
            let eos_token = loaded.model.token_eos();
            let default_max = max_gen_tokens(ctx_size);
            let capped = match max_tokens_cap {
                Some(cap) => default_max.min(cap),
                None => default_max,
            };
            let max_gen = (ctx_size as usize - token_count).min(capped);
            eprintln!("[llama] generating up to {} tokens…", max_gen);

            // Repetition detection
            let rep_window: usize = 40;
            let mut rep_count: usize = 0;
            let gen_start = std::time::Instant::now();

            for token_idx in 0..max_gen {
                let token = sampler.sample(&ctx, -1);
                sampler.accept(token);

                if token == eos_token || loaded.model.is_eog_token(token) {
                    eprintln!("[llama] stop token at position {}", token_idx);
                    break;
                }

                let bytes = loaded
                    .model
                    .token_to_bytes(token, Special::Tokenize)
                    .map_err(|e| {
                        InferenceError::InferenceFailed(format!(
                            "Token to bytes failed: {}", e
                        ))
                    })?;

                output_bytes.extend_from_slice(&bytes);

                // Check for repetition
                if output_bytes.len() >= rep_window * 2 {
                    let len = output_bytes.len();
                    let last = &output_bytes[len - rep_window..];
                    let prev = &output_bytes[len - rep_window * 2..len - rep_window];
                    if last == prev {
                        rep_count += 1;
                        if rep_count >= 3 {
                            eprintln!("[llama] repetition detected at token {}, stopping", token_idx);
                            output_bytes.truncate(len - rep_window * 2);
                            break;
                        }
                    } else {
                        rep_count = 0;
                    }
                }

                // Prepare next batch
                batch.clear();
                batch.add(token, n_cur, &[0], true).map_err(|e| {
                    InferenceError::InferenceFailed(format!("Batch add failed: {}", e))
                })?;

                ctx.decode(&mut batch).map_err(|e| {
                    InferenceError::InferenceFailed(format!("Decode failed: {}", e))
                })?;

                n_cur += 1;
            }

            let gen_ms = gen_start.elapsed().as_millis();
            let n_gen = n_cur as usize - token_count;
            let total_ms = start.elapsed().as_millis();
            let tps = if gen_ms > 0 { n_gen as f64 / (gen_ms as f64 / 1000.0) } else { 0.0 };
            eprintln!("[llama] generation: {} tokens in {}ms ({:.1} tok/s), total: {}ms",
                n_gen, gen_ms, tps, total_ms);

            // Record speed for frontend display
            speed_tps.store((tps as f32).to_bits(), Ordering::Relaxed);

            let output = String::from_utf8_lossy(&output_bytes).into_owned();

            // For JSON mode, try to extract just the JSON object
            if json_mode {
                if let Some(json_str) = extract_json_object(&output) {
                    return Ok(json_str);
                }
            }

            Ok(output.trim().to_string())
        })
        .await
        .map_err(|e| InferenceError::InferenceFailed(format!("Task join error: {}", e)))?
    }
}

/// Extract the first complete JSON object from text
fn extract_json_object(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let mut depth = 0;
    let mut in_string = false;
    let mut escape = false;

    for (i, ch) in text[start..].char_indices() {
        if escape {
            escape = false;
            continue;
        }
        match ch {
            '\\' if in_string => escape = true,
            '"' => in_string = !in_string,
            '{' if !in_string => depth += 1,
            '}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    return Some(text[start..start + i + 1].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

#[async_trait]
impl LocalInference for LlamaCppBackend {
    async fn is_available(&self) -> bool {
        self.list_models().iter().any(|m| self.is_file_downloaded(&m.filename))
    }

    async fn generate(&self, prompt: &str, _model: &str) -> Result<String, InferenceError> {
        self.run_inference(prompt, false).await
    }

    async fn generate_json(&self, prompt: &str) -> Result<String, InferenceError> {
        self.run_inference(prompt, true).await
    }

    async fn generate_json_short(&self, prompt: &str, max_tokens: usize) -> Result<String, InferenceError> {
        self.run_inference_capped(prompt, true, Some(max_tokens)).await
    }

    async fn ensure_model(&self, model_name: &str) -> Result<(), InferenceError> {
        let all_models = self.list_models();
        let info = all_models.iter()
            .find(|m| m.id == model_name || m.filename == model_name)
            .cloned();

        if let Some(info) = info {
            if self.is_file_downloaded(&info.filename) {
                return Ok(());
            }
            self.download_model_by_id(&info.id).await
        } else {
            if model_name.is_empty() || model_name == "Qwen3-8B-Q4_K_M.gguf" {
                self.download_model_by_id("qwen3-8b").await
            } else {
                Err(InferenceError::ModelNotFound(format!("Unknown model: {}", model_name)))
            }
        }
    }

    fn default_model(&self) -> &str {
        "qwen3-1.7b"
    }

    async fn preload(&self) -> Result<(), InferenceError> {
        if self.is_available().await {
            self.load_model_if_needed().await
        } else {
            Ok(())
        }
    }

    async fn get_model_status(&self) -> ModelStatus {
        let active_id = self.active_model_id.lock().await.clone();
        let info = Self::get_active_model_info_sync(&active_id, &self.models_dir);

        let (is_downloaded, model_name, model_size) = if let Some(info) = &info {
            (self.is_file_downloaded(&info.filename), info.filename.clone(), info.size_bytes)
        } else {
            (false, active_id.clone(), 0)
        };

        let (is_loaded, gpu_layers) = self.loaded_model.try_lock()
            .map(|g| match g.as_ref() {
                Some(l) if l.model_id == active_id => (true, l.gpu_layers),
                _ => (false, 0),
            })
            .unwrap_or((true, 0));

        let progress = self.download_progress.load(Ordering::Relaxed);

        ModelStatus {
            is_downloaded,
            is_loaded,
            download_progress: progress,
            model_name,
            model_size_bytes: model_size,
            gpu_layers,
            gpu_enabled: self.gpu_enabled.load(Ordering::Relaxed),
            last_gen_speed_tps: self.last_gen_speed_tps(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_object() {
        let text = r#"Here is the result: {"name": "test", "value": 42} done"#;
        let json = extract_json_object(text);
        assert_eq!(json, Some(r#"{"name": "test", "value": 42}"#.to_string()));
    }

    #[test]
    fn test_extract_nested_json() {
        let text = r#"{"outer": {"inner": "value"}, "arr": [1,2]}"#;
        let json = extract_json_object(text);
        assert_eq!(
            json,
            Some(r#"{"outer": {"inner": "value"}, "arr": [1,2]}"#.to_string())
        );
    }

    #[test]
    fn test_extract_json_with_escaped_braces() {
        let text = r#"{"msg": "hello \"world\""}"#;
        let json = extract_json_object(text);
        assert!(json.is_some());
    }

    #[test]
    fn test_no_json() {
        assert_eq!(extract_json_object("no json here"), None);
    }

    #[test]
    fn test_model_path() {
        let backend = LlamaCppBackend::new().unwrap();
        let path = backend.model_path("test.gguf");
        assert!(path.to_string_lossy().contains("test.gguf"));
    }

    #[test]
    fn test_model_registry_has_entries() {
        let registry = local_model_registry();
        assert!(registry.len() >= 6);
        assert!(registry.iter().any(|m| m.id == "qwen3-0.6b"));
        assert!(registry.iter().any(|m| m.id == "qwen3-8b"));
        assert!(registry.iter().any(|m| m.id == "gemma4-e2b"));
        assert!(registry.iter().any(|m| m.id == "gemma4-e4b"));
    }

    #[test]
    fn test_gemma4_context_size() {
        let registry = local_model_registry();
        let e4b = registry.iter().find(|m| m.id == "gemma4-e4b").unwrap();
        assert_eq!(e4b.ctx_size, 32768);
        assert_eq!(max_gen_tokens(e4b.ctx_size), 4096);
    }

    #[test]
    fn test_max_gen_tokens_large_context() {
        assert_eq!(max_gen_tokens(32768), 4096);
        assert_eq!(max_gen_tokens(65536), 4096);
        assert_eq!(max_gen_tokens(131072), 8192);
    }

    #[test]
    fn test_batch_size_scaling() {
        assert_eq!(batch_size(8192), 256);
        assert_eq!(batch_size(16384), 256);
        assert_eq!(batch_size(32768), 512);
        assert_eq!(batch_size(131072), 512);
    }

    // -----------------------------------------------------------------------
    // Custom model tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_hf_url_full() {
        let (repo, file) = parse_hf_url(
            "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf"
        ).unwrap();
        assert_eq!(repo, "ggml-org/gemma-4-E4B-it-GGUF");
        assert_eq!(file, "gemma-4-e4b-it-Q4_K_M.gguf");
    }

    #[test]
    fn test_parse_hf_url_blob() {
        let (repo, file) = parse_hf_url(
            "https://huggingface.co/TheBloke/Llama-2-7B-GGUF/blob/main/llama-2-7b.Q4_K_M.gguf"
        ).unwrap();
        assert_eq!(repo, "TheBloke/Llama-2-7B-GGUF");
        assert_eq!(file, "llama-2-7b.Q4_K_M.gguf");
    }

    #[test]
    fn test_parse_hf_url_short_repo() {
        let (repo, file) = parse_hf_url("ggml-org/gemma-4-E4B-it-GGUF").unwrap();
        assert_eq!(repo, "ggml-org/gemma-4-E4B-it-GGUF");
        assert_eq!(file, "");
    }

    #[test]
    fn test_parse_hf_url_invalid() {
        assert!(parse_hf_url("not-a-url").is_err());
        assert!(parse_hf_url("").is_err());
    }

    #[test]
    fn test_custom_model_store_roundtrip() {
        let dir = std::env::temp_dir().join("ailocalmind_test_custom");
        std::fs::create_dir_all(&dir).unwrap();

        // Clean up any previous test file
        let path = CustomModelStore::path(&dir);
        let _ = std::fs::remove_file(&path);

        // Load from non-existent file should return empty
        let models = CustomModelStore::load(&dir).unwrap();
        assert!(models.is_empty());

        // Save and reload
        let test_models = vec![LocalModelInfo {
            id: "custom-test-model".into(),
            name: "Test Model".into(),
            filename: "test.gguf".into(),
            url: "https://example.com/test.gguf".into(),
            size_bytes: 1000,
            ctx_size: 4096,
            description: "Test".into(),
            speed_tier: "fast".into(),
            intelligence_tier: "high".into(),
            is_downloaded: false,
            local_path: None,
        }];
        CustomModelStore::save(&dir, &test_models).unwrap();

        let loaded = CustomModelStore::load(&dir).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "custom-test-model");
        assert_eq!(loaded[0].name, "Test Model");

        // Cleanup
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn test_custom_model_id_prefix() {
        // Verify that custom model IDs always start with "custom-"
        let repo_id = "ggml-org/gemma-4-E4B-it-GGUF";
        let id = format!("custom-{}", repo_id.replace('/', "-").to_lowercase());
        assert!(id.starts_with("custom-"));
        assert_eq!(id, "custom-ggml-org-gemma-4-e4b-it-gguf");
    }
}
