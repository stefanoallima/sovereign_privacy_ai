use directories::ProjectDirs;
use log::info;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingModelInfo {
    pub id: String,
    pub name: String,
    pub dim: usize,
    pub size_bytes: u64,
    pub repo: String,
    /// Files to download from HuggingFace (relative to repo root)
    pub files: Vec<EmbeddingModelFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingModelFile {
    pub remote_path: String,
    pub local_name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingModelInfoWithStatus {
    #[serde(flatten)]
    pub info: EmbeddingModelInfo,
    pub is_downloaded: bool,
    pub local_path: Option<String>,
    pub source_url: String,
}

/// Static registry of available embedding models.
pub fn available_models() -> Vec<EmbeddingModelInfo> {
    vec![EmbeddingModelInfo {
        id: "all-minilm-l6-v2".into(),
        name: "all-MiniLM-L6-v2 (Fast, 384-dim)".into(),
        dim: 384,
        size_bytes: 91_000_000, // ~91 MB (model.onnx ~ 80 MB + tokenizer ~ 700 KB)
        repo: "sentence-transformers/all-MiniLM-L6-v2".into(),
        files: vec![
            EmbeddingModelFile {
                remote_path: "onnx/model.onnx".into(),
                local_name: "model.onnx".into(),
                size_bytes: 80_000_000,
            },
            EmbeddingModelFile {
                remote_path: "tokenizer.json".into(),
                local_name: "tokenizer.json".into(),
                size_bytes: 700_000,
            },
        ],
    }]
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

pub struct EmbeddingBackend {
    models_dir: PathBuf,
}

impl EmbeddingBackend {
    pub fn new() -> Result<Self, String> {
        let project_dirs = ProjectDirs::from("com", "private-assistant", "PrivateAssistant")
            .ok_or("Could not find project directories")?;

        let models_dir = project_dirs.data_dir().join("embedding-models");
        std::fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create embedding-models directory: {}", e))?;

        info!(
            "EmbeddingBackend initialized, models_dir={}",
            models_dir.display()
        );

        Ok(EmbeddingBackend { models_dir })
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
    pub fn list_models(&self) -> Vec<EmbeddingModelInfoWithStatus> {
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
                EmbeddingModelInfoWithStatus {
                    info,
                    is_downloaded: downloaded,
                    local_path,
                    source_url,
                }
            })
            .collect()
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
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "all-minilm-l6-v2");
        assert_eq!(models[0].dim, 384);
    }

    #[test]
    fn test_backend_creation() {
        let backend = EmbeddingBackend::new();
        assert!(backend.is_ok());
        let backend = backend.unwrap();
        assert!(backend.models_dir().exists());
    }

    #[test]
    fn test_list_models_returns_all() {
        let backend = EmbeddingBackend::new().unwrap();
        let models = backend.list_models();
        assert_eq!(models.len(), 1);
        for m in &models {
            assert!(m.source_url.starts_with("https://huggingface.co/"));
        }
    }
}
