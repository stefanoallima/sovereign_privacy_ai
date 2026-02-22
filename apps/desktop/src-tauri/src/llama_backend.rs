use crate::inference::{InferenceError, LocalInference, ModelStatus};
use async_trait::async_trait;
use directories::ProjectDirs;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel, Special};
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::llama_backend::LlamaBackend as LlamaBackendInit;
use log::info;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::num::NonZeroU32;
use std::path::PathBuf;
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
            ctx_size: 1024,       // small model → small context = fast prefill
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
            ctx_size: 1024,       // keep small for CPU speed
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
            ctx_size: 2048,
            description: "Higher quality responses. Needs ~4 GB RAM.".into(),
            speed_tier: "medium".into(),
            intelligence_tier: "high".into(),
            is_downloaded: false,
            local_path: None,
        },
        LocalModelInfo {
            id: "qwen3-8b".into(),
            name: "Qwen3 8B (Full)".into(),
            filename: "Qwen3-8B-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/6a569868d07d3bd59e8b97fb001bf8c0b254bb20/Qwen3-8B-Q4_K_M.gguf".into(),
            size_bytes: 5_030_000_000,
            ctx_size: 2048,
            description: "Best quality. Needs ~7 GB RAM. Slower on CPU.".into(),
            speed_tier: "slow".into(),
            intelligence_tier: "very-high".into(),
            is_downloaded: false,
            local_path: None,
        },
    ]
}

/// Max tokens to generate. 512 is plenty for chat; keeps CPU time reasonable.
const MAX_TOKENS: usize = 512;

/// Max CPU threads for inference. More threads can hurt due to memory-bandwidth
/// contention on most consumer CPUs.
const MAX_THREADS: u32 = 4;

/// Batch size for prompt prefill. Smaller = less peak memory on CPU.
const N_BATCH: u32 = 256;

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

struct LoadedModel {
    model: LlamaModel,
    backend: LlamaBackendInit,
    model_id: String,
    ctx_size: u32,
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
    pub fn list_models(&self) -> Vec<LocalModelInfo> {
        local_model_registry().into_iter().map(|mut m| {
            let path = self.model_path(&m.filename);
            m.is_downloaded = path.exists() && path.metadata().map(|md| md.len() > 1_000_000).unwrap_or(false);
            if m.is_downloaded {
                m.local_path = Some(path.to_string_lossy().into_owned());
            }
            m
        }).collect()
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
        let registry = local_model_registry();
        if !registry.iter().any(|m| m.id == model_id) {
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
        let registry = local_model_registry();
        let info = registry.iter().find(|m| m.id == model_id)
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
        let registry = local_model_registry();
        let info = registry.iter().find(|m| m.id == model_id)
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

    fn get_active_model_info_sync(active_id: &str) -> Option<LocalModelInfo> {
        local_model_registry().into_iter().find(|m| m.id == active_id)
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
        result
    }

    async fn do_load_model(&self, model_id: &str) -> Result<(), InferenceError> {
        let info = Self::get_active_model_info_sync(model_id)
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

        let n_gpu_layers = std::env::var("AILOCALMIND_GPU_LAYERS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0);

        if n_gpu_layers > 0 {
            info!("GPU offloading enabled: {} layers → VRAM", n_gpu_layers);
        }

        let loaded = tokio::task::spawn_blocking(move || -> Result<LoadedModel, InferenceError> {
            let backend = LlamaBackendInit::init().map_err(|e| {
                InferenceError::ModelLoadFailed(format!("Failed to init llama backend: {}", e))
            })?;

            let model_params = LlamaModelParams::default()
                .with_n_gpu_layers(n_gpu_layers);

            let model =
                LlamaModel::load_from_file(&backend, &path_clone, &model_params).map_err(|e| {
                    InferenceError::ModelLoadFailed(format!("Failed to load model: {}", e))
                })?;

            eprintln!("[llama] model {} loaded successfully", model_id_owned);

            Ok(LoadedModel {
                model,
                backend,
                model_id: model_id_owned,
                ctx_size,
            })
        })
        .await
        .map_err(|e| InferenceError::ModelLoadFailed(format!("Task join error: {}", e)))??;

        let mut guard = self.loaded_model.lock().await;
        *guard = Some(loaded);
        Ok(())
    }

    /// Run inference and return generated text
    async fn run_inference(
        &self,
        prompt: &str,
        json_mode: bool,
    ) -> Result<String, InferenceError> {
        self.load_model_if_needed().await?;

        let prompt_owned = prompt.to_string();
        let loaded_model = self.loaded_model.clone();

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
                .with_n_batch(N_BATCH)
                .with_n_threads(n_threads)
                .with_n_threads_batch(n_threads);

            let mut ctx =
                loaded
                    .model
                    .new_context(&loaded.backend, ctx_params)
                    .map_err(|e| {
                        InferenceError::InferenceFailed(format!(
                            "Failed to create context: {}", e
                        ))
                    })?;

            // Qwen3: always disable thinking mode for faster responses
            let effective_prompt = format!("{}\n/no_think", prompt_owned);

            let tokens_list = loaded
                .model
                .str_to_token(&effective_prompt, AddBos::Always)
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
            let mut batch = LlamaBatch::new(N_BATCH as usize, 1);

            for (i, chunk) in tokens_list.chunks(N_BATCH as usize).enumerate() {
                batch.clear();
                let offset = i * N_BATCH as usize;
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
            let mut n_cur = batch.n_tokens();
            let eos_token = loaded.model.token_eos();
            let max_gen = (ctx_size as usize - token_count).min(MAX_TOKENS);
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
            eprintln!("[llama] generation: {} tokens in {}ms ({:.1} tok/s), total: {}ms",
                n_gen, gen_ms,
                if gen_ms > 0 { n_gen as f64 / (gen_ms as f64 / 1000.0) } else { 0.0 },
                total_ms);

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
        let registry = local_model_registry();
        registry.iter().any(|m| self.is_file_downloaded(&m.filename))
    }

    async fn generate(&self, prompt: &str, _model: &str) -> Result<String, InferenceError> {
        self.run_inference(prompt, false).await
    }

    async fn generate_json(&self, prompt: &str) -> Result<String, InferenceError> {
        self.run_inference(prompt, true).await
    }

    async fn ensure_model(&self, model_name: &str) -> Result<(), InferenceError> {
        let registry = local_model_registry();
        let info = registry.iter()
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
        let info = Self::get_active_model_info_sync(&active_id);

        let (is_downloaded, model_name, model_size) = if let Some(info) = &info {
            (self.is_file_downloaded(&info.filename), info.filename.clone(), info.size_bytes)
        } else {
            (false, active_id.clone(), 0)
        };

        let is_loaded = self.loaded_model.try_lock()
            .map(|g| g.as_ref().map(|l| l.model_id == active_id).unwrap_or(false))
            .unwrap_or(true);

        let progress = self.download_progress.load(Ordering::Relaxed);

        ModelStatus {
            is_downloaded,
            is_loaded,
            download_progress: progress,
            model_name,
            model_size_bytes: model_size,
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
        assert!(registry.len() >= 4);
        assert!(registry.iter().any(|m| m.id == "qwen3-0.6b"));
        assert!(registry.iter().any(|m| m.id == "qwen3-8b"));
    }
}
