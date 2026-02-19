use directories::ProjectDirs;
use gliner::model::pipeline::span::SpanMode;
use gliner::model::input::text::TextInput;
use gliner::model::params::Parameters;
use gliner::model::GLiNER;
use log::info;
use orp::params::RuntimeParameters;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlinerModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub languages: String,
    pub size_bytes: u64,
    pub repo: String,
    /// Files to download from HuggingFace (relative to repo root)
    pub files: Vec<GlinerModelFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlinerModelFile {
    pub remote_path: String,
    pub local_name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlinerModelInfoWithStatus {
    #[serde(flatten)]
    pub info: GlinerModelInfo,
    pub is_downloaded: bool,
    pub local_path: Option<String>,
    pub source_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedEntity {
    pub text: String,
    pub label: String,
    pub confidence: f32,
    pub start: usize,
    pub end: usize,
}

/// Static registry of available GLiNER models.
pub fn available_models() -> Vec<GlinerModelInfo> {
    vec![
        GlinerModelInfo {
            id: "gliner-small".into(),
            name: "GLiNER Small v2.1".into(),
            description: "English - Fast - DeBERTa backbone".into(),
            languages: "English".into(),
            size_bytes: 611_000_000,
            repo: "onnx-community/gliner_small-v2.1".into(),
            files: vec![
                GlinerModelFile {
                    remote_path: "onnx/model.onnx".into(),
                    local_name: "model.onnx".into(),
                    size_bytes: 611_000_000,
                },
                GlinerModelFile {
                    remote_path: "tokenizer.json".into(),
                    local_name: "tokenizer.json".into(),
                    size_bytes: 2_000_000,
                },
                GlinerModelFile {
                    remote_path: "gliner_config.json".into(),
                    local_name: "gliner_config.json".into(),
                    size_bytes: 1_000,
                },
            ],
        },
        GlinerModelInfo {
            id: "gliner-multi".into(),
            name: "GLiNER Multi v2.1".into(),
            description: "20+ languages - Balanced - DeBERTa backbone".into(),
            languages: "20+ languages".into(),
            size_bytes: 1_160_000_000,
            repo: "onnx-community/gliner_multi-v2.1".into(),
            files: vec![
                GlinerModelFile {
                    remote_path: "onnx/model.onnx".into(),
                    local_name: "model.onnx".into(),
                    size_bytes: 1_160_000_000,
                },
                GlinerModelFile {
                    remote_path: "tokenizer.json".into(),
                    local_name: "tokenizer.json".into(),
                    size_bytes: 2_000_000,
                },
                GlinerModelFile {
                    remote_path: "gliner_config.json".into(),
                    local_name: "gliner_config.json".into(),
                    size_bytes: 1_000,
                },
            ],
        },
        GlinerModelInfo {
            id: "gliner-large".into(),
            name: "GLiNER Large v2.1".into(),
            description: "English - Best accuracy - DeBERTa backbone".into(),
            languages: "English".into(),
            size_bytes: 1_780_000_000,
            repo: "onnx-community/gliner_large-v2.1".into(),
            files: vec![
                GlinerModelFile {
                    remote_path: "onnx/model.onnx".into(),
                    local_name: "model.onnx".into(),
                    size_bytes: 1_780_000_000,
                },
                GlinerModelFile {
                    remote_path: "tokenizer.json".into(),
                    local_name: "tokenizer.json".into(),
                    size_bytes: 2_000_000,
                },
                GlinerModelFile {
                    remote_path: "gliner_config.json".into(),
                    local_name: "gliner_config.json".into(),
                    size_bytes: 1_000,
                },
            ],
        },
        GlinerModelInfo {
            id: "gliner-large-q8".into(),
            name: "GLiNER Large v2.1 (int8)".into(),
            description: "English - Quantized - 50% smaller".into(),
            languages: "English".into(),
            size_bytes: 653_000_000,
            repo: "onnx-community/gliner_large-v2.1".into(),
            files: vec![
                GlinerModelFile {
                    remote_path: "onnx/model_quantized.onnx".into(),
                    local_name: "model.onnx".into(),
                    size_bytes: 653_000_000,
                },
                GlinerModelFile {
                    remote_path: "tokenizer.json".into(),
                    local_name: "tokenizer.json".into(),
                    size_bytes: 2_000_000,
                },
                GlinerModelFile {
                    remote_path: "gliner_config.json".into(),
                    local_name: "gliner_config.json".into(),
                    size_bytes: 1_000,
                },
            ],
        },
    ]
}

/// PII labels used for zero-shot NER detection.
const PII_LABELS: &[&str] = &[
    "person name",
    "phone number",
    "email address",
    "physical address",
    "bank account",
    "social security number",
    "date of birth",
    "passport number",
    "credit card number",
    "tax identification number",
    "income amount",
    "salary",
    "medical condition",
];

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

pub struct GlinerBackend {
    models_dir: PathBuf,
    download_progress: Arc<AtomicU8>,
    loaded_model: Arc<Mutex<Option<LoadedGliner>>>,
    loaded_model_id: Arc<Mutex<Option<String>>>,
}

struct LoadedGliner {
    model: GLiNER<SpanMode>,
}

// GLiNER + ort are internally thread-safe behind their own synchronization.
unsafe impl Send for LoadedGliner {}
unsafe impl Sync for LoadedGliner {}

impl GlinerBackend {
    pub fn new() -> Result<Self, String> {
        let project_dirs = ProjectDirs::from("com", "private-assistant", "PrivateAssistant")
            .ok_or("Could not find project directories")?;

        let models_dir = project_dirs.data_dir().join("gliner-models");
        std::fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create gliner-models directory: {}", e))?;

        info!("GlinerBackend initialized, models_dir={}", models_dir.display());

        Ok(GlinerBackend {
            models_dir,
            download_progress: Arc::new(AtomicU8::new(0)),
            loaded_model: Arc::new(Mutex::new(None)),
            loaded_model_id: Arc::new(Mutex::new(None)),
        })
    }

    pub fn models_dir(&self) -> &PathBuf {
        &self.models_dir
    }

    fn model_dir(&self, model_id: &str) -> PathBuf {
        self.models_dir.join(model_id)
    }

    fn is_model_downloaded(&self, model_id: &str) -> bool {
        let dir = self.model_dir(model_id);
        let onnx = dir.join("model.onnx");
        let tokenizer = dir.join("tokenizer.json");
        onnx.exists()
            && tokenizer.exists()
            && onnx.metadata().map(|m| m.len() > 1_000).unwrap_or(false)
    }

    /// List all available models with their download status.
    pub fn list_models(&self) -> Vec<GlinerModelInfoWithStatus> {
        available_models()
            .into_iter()
            .map(|info| {
                let downloaded = self.is_model_downloaded(&info.id);
                let local_path = if downloaded {
                    Some(self.model_dir(&info.id).to_string_lossy().to_string())
                } else {
                    None
                };
                let source_url = format!("https://huggingface.co/{}", info.repo);
                GlinerModelInfoWithStatus {
                    info,
                    is_downloaded: downloaded,
                    local_path,
                    source_url,
                }
            })
            .collect()
    }

    /// Download a GLiNER model from HuggingFace.
    pub async fn download_model(&self, model_id: &str) -> Result<(), String> {
        let registry = available_models();
        let model_info = registry
            .iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("Unknown model: {}", model_id))?
            .clone();

        let model_dir = self.model_dir(model_id);
        std::fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Failed to create model directory: {}", e))?;

        self.download_progress.store(0, Ordering::Relaxed);

        let progress = self.download_progress.clone();
        let total_files = model_info.files.len();

        for (i, file) in model_info.files.iter().enumerate() {
            let url = format!(
                "https://huggingface.co/{}/resolve/main/{}",
                model_info.repo, file.remote_path
            );
            let dest = model_dir.join(&file.local_name);
            let file_size = file.size_bytes;
            let progress = progress.clone();
            let base_pct = (i as f64 / total_files as f64 * 100.0) as u8;
            let file_pct_range = (100.0 / total_files as f64) as u8;

            info!("Downloading {} from {}", file.local_name, url);

            let url_clone = url.clone();
            let dest_clone = dest.clone();

            tokio::task::spawn_blocking(move || -> Result<(), String> {
                let client = reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_secs(7200))
                    .build()
                    .map_err(|e| format!("HTTP client error: {}", e))?;

                let response = client
                    .get(&url_clone)
                    .send()
                    .map_err(|e| format!("Download request failed: {}", e))?;

                if !response.status().is_success() {
                    return Err(format!("HTTP {} from {}", response.status(), url_clone));
                }

                let total = response.content_length().unwrap_or(file_size);
                let mut downloaded: u64 = 0;

                let temp_path = dest_clone.with_extension("downloading");
                let mut out = std::fs::File::create(&temp_path)
                    .map_err(|e| format!("Failed to create temp file: {}", e))?;

                let mut reader = std::io::BufReader::new(response);
                let mut buf = [0u8; 65536];

                loop {
                    use std::io::Read;
                    let n = reader
                        .read(&mut buf)
                        .map_err(|e| format!("Read error: {}", e))?;
                    if n == 0 {
                        break;
                    }
                    use std::io::Write;
                    out.write_all(&buf[..n])
                        .map_err(|e| format!("Write error: {}", e))?;
                    downloaded += n as u64;

                    let file_pct =
                        ((downloaded as f64 / total as f64) * file_pct_range as f64) as u8;
                    progress.store((base_pct + file_pct).min(99), Ordering::Relaxed);
                }

                std::fs::rename(&temp_path, &dest_clone)
                    .map_err(|e| format!("Failed to rename temp file: {}", e))?;

                Ok(())
            })
            .await
            .map_err(|e| format!("Task join error: {}", e))??;
        }

        self.download_progress.store(100, Ordering::Relaxed);
        info!("GLiNER model {} download complete", model_id);
        Ok(())
    }

    /// Get current download progress (0-100).
    pub fn get_download_progress(&self) -> u8 {
        self.download_progress.load(Ordering::Relaxed)
    }

    /// Delete a downloaded model.
    pub fn delete_model(&self, model_id: &str) -> Result<(), String> {
        // Unload if this model is currently loaded
        {
            let rt = tokio::runtime::Handle::current();
            let mut id_guard = rt.block_on(self.loaded_model_id.lock());
            if id_guard.as_deref() == Some(model_id) {
                let mut model_guard = rt.block_on(self.loaded_model.lock());
                *model_guard = None;
                *id_guard = None;
                info!("Unloaded GLiNER model {} before deletion", model_id);
            }
        }

        let dir = self.model_dir(model_id);
        if dir.exists() {
            std::fs::remove_dir_all(&dir)
                .map_err(|e| format!("Failed to delete model directory: {}", e))?;
            info!("Deleted GLiNER model: {}", model_id);
        }
        Ok(())
    }

    /// Load a model into memory for inference.
    async fn load_model(&self, model_id: &str) -> Result<(), String> {
        // Check if already loaded
        {
            let id_guard = self.loaded_model_id.lock().await;
            if id_guard.as_deref() == Some(model_id) {
                return Ok(());
            }
        }

        if !self.is_model_downloaded(model_id) {
            return Err(format!("Model {} is not downloaded", model_id));
        }

        let model_dir = self.model_dir(model_id);
        let tokenizer_path = model_dir.join("tokenizer.json");
        let onnx_path = model_dir.join("model.onnx");

        let model_id_owned = model_id.to_string();
        let loaded_model = self.loaded_model.clone();
        let loaded_model_id = self.loaded_model_id.clone();

        info!("Loading GLiNER model {} from {}", model_id, model_dir.display());

        tokio::task::spawn_blocking(move || -> Result<(), String> {
            let tokenizer_str = tokenizer_path.to_string_lossy().to_string();
            let onnx_str = onnx_path.to_string_lossy().to_string();

            let model = GLiNER::<SpanMode>::new(
                Parameters::default(),
                RuntimeParameters::default(),
                &tokenizer_str,
                &onnx_str,
            )
            .map_err(|e| format!("Failed to load GLiNER model: {}", e))?;

            let rt = tokio::runtime::Handle::current();
            let mut guard = rt.block_on(loaded_model.lock());
            *guard = Some(LoadedGliner { model });

            let mut id_guard = rt.block_on(loaded_model_id.lock());
            *id_guard = Some(model_id_owned.clone());

            info!("GLiNER model {} loaded successfully", model_id_owned);
            Ok(())
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Find the first downloaded model (prefer small for speed).
    fn first_downloaded_model_id(&self) -> Option<String> {
        let preference = ["gliner-small", "gliner-large-q8", "gliner-multi", "gliner-large"];
        for id in preference {
            if self.is_model_downloaded(id) {
                return Some(id.to_string());
            }
        }
        None
    }

    /// Detect PII entities in text using GLiNER zero-shot NER.
    pub async fn detect_pii(&self, text: &str) -> Result<Vec<DetectedEntity>, String> {
        let model_id = self
            .first_downloaded_model_id()
            .ok_or("No GLiNER model downloaded. Please download one in Settings.")?;

        self.load_model(&model_id).await?;

        let text_owned = text.to_string();
        let loaded_model = self.loaded_model.clone();

        tokio::task::spawn_blocking(move || -> Result<Vec<DetectedEntity>, String> {
            let rt = tokio::runtime::Handle::current();
            let guard = rt.block_on(loaded_model.lock());
            let loaded = guard
                .as_ref()
                .ok_or("GLiNER model not loaded")?;

            let input = TextInput::from_str(&[&text_owned], PII_LABELS)
                .map_err(|e| format!("Failed to create TextInput: {}", e))?;

            let output = loaded
                .model
                .inference(input)
                .map_err(|e| format!("GLiNER inference failed: {}", e))?;

            let mut entities = Vec::new();
            for spans in output.spans {
                for span in spans {
                    entities.push(DetectedEntity {
                        text: span.text().to_string(),
                        label: span.class().to_string(),
                        confidence: span.probability() as f32,
                        start: span.sequence(),
                        end: span.sequence() + span.text().len(),
                    });
                }
            }

            Ok(entities)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Get the absolute path to the models directory (for "Open Folder").
    pub fn get_models_directory(&self) -> String {
        self.models_dir.to_string_lossy().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_available_models_registry() {
        let models = available_models();
        assert_eq!(models.len(), 4);
        assert_eq!(models[0].id, "gliner-small");
        assert_eq!(models[1].id, "gliner-multi");
        assert_eq!(models[2].id, "gliner-large");
        assert_eq!(models[3].id, "gliner-large-q8");
    }

    #[test]
    fn test_pii_labels() {
        assert!(PII_LABELS.len() >= 10);
        assert!(PII_LABELS.contains(&"person name"));
        assert!(PII_LABELS.contains(&"email address"));
    }

    #[test]
    fn test_backend_creation() {
        let backend = GlinerBackend::new();
        assert!(backend.is_ok());
        let backend = backend.unwrap();
        assert!(backend.models_dir().exists());
    }

    #[test]
    fn test_list_models_returns_all() {
        let backend = GlinerBackend::new().unwrap();
        let models = backend.list_models();
        assert_eq!(models.len(), 4);
        for m in &models {
            assert!(m.source_url.starts_with("https://huggingface.co/"));
        }
    }
}
