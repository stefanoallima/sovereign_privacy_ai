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
use sha2::{Digest, Sha256};
use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

const DEFAULT_MODEL: &str = "Qwen3-8B-Q4_K_M.gguf";
const DEFAULT_MODEL_URL: &str = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/6a569868d07d3bd59e8b97fb001bf8c0b254bb20/Qwen3-8B-Q4_K_M.gguf";
const DEFAULT_MODEL_SIZE: u64 = 5_030_000_000;
// SHA-256 will be verified after first successful download; set to empty to skip initially
const DEFAULT_MODEL_SHA256: &str = "";

const CTX_SIZE: u32 = 4096;
const MAX_TOKENS: usize = 2048;

struct LoadedModel {
    model: LlamaModel,
    backend: LlamaBackendInit,
    model_name: String,
}

// Safety: LlamaModel and LlamaBackendInit are internally managed by llama.cpp
// and we only access them from spawn_blocking contexts behind a mutex.
unsafe impl Send for LoadedModel {}
unsafe impl Sync for LoadedModel {}

pub struct LlamaCppBackend {
    models_dir: PathBuf,
    loaded_model: Arc<Mutex<Option<LoadedModel>>>,
    download_progress: Arc<AtomicU8>,
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

        Ok(LlamaCppBackend {
            models_dir,
            loaded_model: Arc::new(Mutex::new(None)),
            download_progress: Arc::new(AtomicU8::new(0)),
        })
    }

    fn model_path(&self, model_name: &str) -> PathBuf {
        self.models_dir.join(model_name)
    }

    fn is_model_downloaded(&self, model_name: &str) -> bool {
        let path = self.model_path(model_name);
        path.exists() && path.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false)
    }

    async fn download_model(&self, model_name: &str) -> Result<(), InferenceError> {
        let url = if model_name == DEFAULT_MODEL {
            DEFAULT_MODEL_URL.to_string()
        } else {
            return Err(InferenceError::DownloadFailed(format!(
                "Unknown model: {}. Only {} is supported.",
                model_name, DEFAULT_MODEL
            )));
        };

        let path = self.model_path(model_name);
        info!("Downloading model {} from {}", model_name, url);
        self.download_progress.store(0, Ordering::Relaxed);

        let progress = self.download_progress.clone();
        let path_clone = path.clone();

        // Download in a blocking task to not block the async runtime
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
                    "HTTP {} from {}",
                    response.status(),
                    url
                )));
            }

            let total_size = response.content_length().unwrap_or(DEFAULT_MODEL_SIZE);
            let mut downloaded: u64 = 0;

            // Write to a temp file first, then rename
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
                if n == 0 {
                    break;
                }
                use std::io::Write;
                file.write_all(&buf[..n]).map_err(|e| {
                    InferenceError::DownloadFailed(format!("Write error: {}", e))
                })?;
                hasher.update(&buf[..n]);
                downloaded += n as u64;
                let pct = ((downloaded as f64 / total_size as f64) * 100.0).min(99.0) as u8;
                progress.store(pct, Ordering::Relaxed);
            }

            // Verify SHA-256 if configured
            if !DEFAULT_MODEL_SHA256.is_empty() {
                let result = format!("{:x}", hasher.finalize());
                if result != DEFAULT_MODEL_SHA256 {
                    let _ = std::fs::remove_file(&temp_path);
                    return Err(InferenceError::ChecksumMismatch);
                }
                info!("SHA-256 verification passed");
            } else {
                let result = format!("{:x}", hasher.finalize());
                info!("Model SHA-256: {} (not verified, no expected hash set)", result);
            }

            // Rename temp to final
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

    async fn load_model_if_needed(&self) -> Result<(), InferenceError> {
        let mut guard = self.loaded_model.lock().await;
        if guard.is_some() {
            return Ok(());
        }

        let model_path = self.model_path(DEFAULT_MODEL);
        if !model_path.exists() {
            return Err(InferenceError::ModelNotFound(format!(
                "Model file not found: {}",
                model_path.display()
            )));
        }

        info!("Loading model from {}", model_path.display());

        let path_clone = model_path.clone();
        let loaded = tokio::task::spawn_blocking(move || -> Result<LoadedModel, InferenceError> {
            let backend = LlamaBackendInit::init().map_err(|e| {
                InferenceError::ModelLoadFailed(format!("Failed to init llama backend: {}", e))
            })?;

            let model_params = LlamaModelParams::default();

            let model =
                LlamaModel::load_from_file(&backend, &path_clone, &model_params).map_err(|e| {
                    InferenceError::ModelLoadFailed(format!("Failed to load model: {}", e))
                })?;

            info!("Model loaded successfully");

            Ok(LoadedModel {
                model,
                backend,
                model_name: DEFAULT_MODEL.to_string(),
            })
        })
        .await
        .map_err(|e| InferenceError::ModelLoadFailed(format!("Task join error: {}", e)))??;

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
            // We need to access the model inside the blocking context
            let rt = tokio::runtime::Handle::current();
            let guard = rt.block_on(loaded_model.lock());
            let loaded = guard.as_ref().ok_or_else(|| {
                InferenceError::InferenceFailed("Model not loaded".to_string())
            })?;

            let ctx_params = LlamaContextParams::default()
                .with_n_ctx(Some(NonZeroU32::new(CTX_SIZE).unwrap()));

            let mut ctx =
                loaded
                    .model
                    .new_context(&loaded.backend, ctx_params)
                    .map_err(|e| {
                        InferenceError::InferenceFailed(format!(
                            "Failed to create context: {}",
                            e
                        ))
                    })?;

            // For Qwen3, use /no_think tag to disable thinking mode for faster structured output
            let effective_prompt = if json_mode {
                format!("{}\n/no_think", prompt_owned)
            } else {
                prompt_owned
            };

            let tokens_list = loaded
                .model
                .str_to_token(&effective_prompt, AddBos::Always)
                .map_err(|e| {
                    InferenceError::InferenceFailed(format!("Tokenization failed: {}", e))
                })?;

            // Create batch and fill with prompt tokens
            let mut batch = LlamaBatch::new(CTX_SIZE as usize, 1);

            let last_index = tokens_list.len() - 1;
            for (i, &token) in tokens_list.iter().enumerate() {
                batch.add(token, i as i32, &[0], i == last_index).map_err(|e| {
                    InferenceError::InferenceFailed(format!("Batch add failed: {}", e))
                })?;
            }

            // Decode prompt
            ctx.decode(&mut batch).map_err(|e| {
                InferenceError::InferenceFailed(format!("Prompt decode failed: {}", e))
            })?;

            // Set up sampler
            let mut sampler = if json_mode {
                // For JSON mode, use lower temperature for more deterministic output
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

            let mut output = String::new();
            let mut n_cur = batch.n_tokens();
            let eos_token = loaded.model.token_eos();

            for _ in 0..MAX_TOKENS {
                let token = sampler.sample(&ctx, n_cur - 1);
                sampler.accept(token);

                if token == eos_token {
                    break;
                }

                let text = loaded
                    .model
                    .token_to_str(token, Special::Tokenize)
                    .map_err(|e| {
                        InferenceError::InferenceFailed(format!(
                            "Token to string failed: {}",
                            e
                        ))
                    })?;

                output.push_str(&text);

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
        self.is_model_downloaded(DEFAULT_MODEL)
    }

    async fn generate(&self, prompt: &str, _model: &str) -> Result<String, InferenceError> {
        self.run_inference(prompt, false).await
    }

    async fn generate_json(&self, prompt: &str) -> Result<String, InferenceError> {
        self.run_inference(prompt, true).await
    }

    async fn ensure_model(&self, model_name: &str) -> Result<(), InferenceError> {
        let name = if model_name.is_empty() {
            DEFAULT_MODEL
        } else {
            model_name
        };

        if self.is_model_downloaded(name) {
            info!("Model {} already downloaded", name);
            return Ok(());
        }

        self.download_model(name).await
    }

    fn default_model(&self) -> &str {
        DEFAULT_MODEL
    }

    async fn get_model_status(&self) -> ModelStatus {
        let is_downloaded = self.is_model_downloaded(DEFAULT_MODEL);
        let is_loaded = self.loaded_model.lock().await.is_some();
        let progress = self.download_progress.load(Ordering::Relaxed);

        ModelStatus {
            is_downloaded,
            is_loaded,
            download_progress: progress,
            model_name: DEFAULT_MODEL.to_string(),
            model_size_bytes: DEFAULT_MODEL_SIZE,
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
}
