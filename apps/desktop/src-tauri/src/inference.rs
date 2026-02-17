use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum InferenceError {
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    #[error("Model loading failed: {0}")]
    ModelLoadFailed(String),
    #[error("Inference failed: {0}")]
    InferenceFailed(String),
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    #[error("Checksum mismatch")]
    ChecksumMismatch,
}

impl serde::Serialize for InferenceError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Model status reported to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub is_downloaded: bool,
    pub is_loaded: bool,
    pub download_progress: u8,
    pub model_name: String,
    pub model_size_bytes: u64,
}

/// Unified trait for local inference backends (llama.cpp or Ollama)
#[async_trait]
pub trait LocalInference: Send + Sync {
    /// Check if the backend is ready to serve requests
    async fn is_available(&self) -> bool;

    /// Generate text from a prompt using optional model name
    async fn generate(&self, prompt: &str, model: &str) -> Result<String, InferenceError>;

    /// Generate JSON-constrained output from a prompt
    async fn generate_json(&self, prompt: &str) -> Result<String, InferenceError>;

    /// Ensure a model is downloaded and ready
    async fn ensure_model(&self, model_name: &str) -> Result<(), InferenceError>;

    /// Get the default model name for this backend
    fn default_model(&self) -> &str;

    /// Get current model status (download progress, loaded state, etc.)
    async fn get_model_status(&self) -> ModelStatus;
}
