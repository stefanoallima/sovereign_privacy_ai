//! Whisper STT module for local speech-to-text transcription
//!
//! Uses whisper.cpp (https://github.com/ggerganov/whisper.cpp) for high-quality local STT.
//! Downloads the Whisper binary and model on first use.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use directories::ProjectDirs;
use std::fs::{self, File};
use std::io::{Cursor, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SttError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("Whisper not initialized")]
    NotInitialized,
    #[error("Whisper process failed: {0}")]
    WhisperFailed(String),
    #[error("Invalid audio data: {0}")]
    InvalidAudio(String),
    #[error("Download failed: {0}")]
    Download(String),
    #[error("Base64 decode error: {0}")]
    Base64(#[from] base64::DecodeError),
}

impl serde::Serialize for SttError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// STT configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SttConfig {
    pub model_name: String,
    pub language: String,
    pub translate: bool,
}

impl Default for SttConfig {
    fn default() -> Self {
        Self {
            model_name: "ggml-base.en".to_string(),
            language: "en".to_string(),
            translate: false,
        }
    }
}

/// Whisper STT engine
pub struct WhisperStt {
    whisper_path: PathBuf,
    models_dir: PathBuf,
    pub config: SttConfig,
    is_transcribing: std::sync::atomic::AtomicBool,
}

impl WhisperStt {
    /// Create a new Whisper STT instance
    pub fn new() -> Result<Self, SttError> {
        let project_dirs = ProjectDirs::from("com", "private-assistant", "PrivateAssistant")
            .ok_or_else(|| SttError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not find project directories",
            )))?;

        let data_dir = project_dirs.data_dir();
        let whisper_dir = data_dir.join("whisper");
        let models_dir = data_dir.join("whisper-models");

        fs::create_dir_all(&whisper_dir)?;
        fs::create_dir_all(&models_dir)?;

        #[cfg(target_os = "windows")]
        let whisper_path = whisper_dir.join("main.exe");
        #[cfg(not(target_os = "windows"))]
        let whisper_path = whisper_dir.join("main");

        Ok(Self {
            whisper_path,
            models_dir,
            config: SttConfig::default(),
            is_transcribing: std::sync::atomic::AtomicBool::new(false),
        })
    }

    /// Get the whisper executable path
    pub fn whisper_path(&self) -> PathBuf {
        self.whisper_path.clone()
    }

    /// Get the models directory
    pub fn models_dir(&self) -> PathBuf {
        self.models_dir.clone()
    }

    /// Check if Whisper is installed
    pub fn is_installed(&self) -> bool {
        self.whisper_path.exists()
    }

    /// Check if a model is installed
    pub fn is_model_installed(&self, model_name: &str) -> bool {
        let model_path = self.models_dir.join(format!("{}.bin", model_name));
        model_path.exists()
    }

    /// Download and install Whisper (static method for use without holding lock)
    pub async fn download_whisper(whisper_path: &PathBuf) -> Result<(), SttError> {
        if whisper_path.exists() {
            println!("Whisper already installed at {:?}", whisper_path);
            return Ok(());
        }

        println!("Downloading Whisper...");

        // whisper.cpp releases - using pre-built binaries
        #[cfg(target_os = "windows")]
        let whisper_url = "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-bin-x64.zip";
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        let whisper_url = "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-bin-linux-x64.zip";
        #[cfg(target_os = "macos")]
        let whisper_url = "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-bin-macos-arm64.zip";

        let response = reqwest::get(whisper_url).await?;

        if !response.status().is_success() {
            return Err(SttError::Download(format!(
                "Failed to download Whisper: HTTP {}",
                response.status()
            )));
        }

        let bytes = response.bytes().await?;
        let whisper_dir = whisper_path.parent().unwrap();

        // Extract ZIP
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = whisper_dir.join(file.name());

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut outfile = File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Make executable on Unix
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&whisper_path)?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&whisper_path, perms)?;
        }

        println!("Whisper installed at {:?}", whisper_path);
        Ok(())
    }

    /// Download and install a model (static method)
    pub async fn download_model(models_dir: &PathBuf, model_name: &str) -> Result<(), SttError> {
        let model_path = models_dir.join(format!("{}.bin", model_name));

        if model_path.exists() {
            println!("Model {} already installed", model_name);
            return Ok(());
        }

        println!("Downloading Whisper model: {}", model_name);

        // Whisper models from Hugging Face
        let model_url = format!(
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}.bin",
            model_name
        );

        let response = reqwest::get(&model_url).await?;

        if !response.status().is_success() {
            return Err(SttError::Download(format!(
                "Failed to download model: HTTP {}",
                response.status()
            )));
        }

        let bytes = response.bytes().await?;

        let mut file = File::create(&model_path)?;
        file.write_all(&bytes)?;

        println!("Model {} installed at {:?}", model_name, model_path);
        Ok(())
    }

    /// Set STT configuration
    pub fn set_config(&mut self, config: SttConfig) {
        self.config = config;
    }

    /// Transcribe audio (static method for use without holding lock)
    pub async fn transcribe_audio(
        whisper_path: &PathBuf,
        models_dir: &PathBuf,
        config: &SttConfig,
        audio_base64: &str,
    ) -> Result<String, SttError> {
        // Decode base64 audio
        let audio_bytes = BASE64.decode(audio_base64)?;

        // Save to temp WAV file
        let temp_dir = tempfile::tempdir()?;
        let input_path = temp_dir.path().join("input.wav");
        let mut file = File::create(&input_path)?;
        file.write_all(&audio_bytes)?;
        drop(file);

        let model_path = models_dir.join(format!("{}.bin", config.model_name));

        // Build Whisper command
        let mut cmd = Command::new(whisper_path);
        cmd.arg("-m").arg(&model_path)
            .arg("-f").arg(&input_path)
            .arg("-l").arg(&config.language)
            .arg("--no-timestamps")
            .arg("-otxt");

        if config.translate {
            cmd.arg("--translate");
        }

        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = cmd.output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(SttError::WhisperFailed(stderr.to_string()));
        }

        // Read the output text file
        let txt_path = input_path.with_extension("wav.txt");
        let transcription = if txt_path.exists() {
            fs::read_to_string(&txt_path)
                .unwrap_or_default()
                .trim()
                .to_string()
        } else {
            // Try to parse from stdout
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        };

        Ok(transcription)
    }

    /// Check if currently transcribing
    pub fn is_transcribing(&self) -> bool {
        use std::sync::atomic::Ordering;
        self.is_transcribing.load(Ordering::SeqCst)
    }

    /// Get installation status
    pub fn get_status(&self) -> SttStatus {
        SttStatus {
            whisper_installed: self.is_installed(),
            model_installed: self.is_model_installed(&self.config.model_name),
            current_config: self.config.clone(),
            is_transcribing: self.is_transcribing(),
        }
    }
}

/// STT status for frontend
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SttStatus {
    pub whisper_installed: bool,
    pub model_installed: bool,
    pub current_config: SttConfig,
    pub is_transcribing: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = SttConfig::default();
        assert_eq!(config.model_name, "ggml-base.en");
        assert_eq!(config.language, "en");
        assert!(!config.translate);
    }
}
