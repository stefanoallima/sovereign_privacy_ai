//! Piper TTS module for local text-to-speech synthesis
//!
//! Uses Piper (https://github.com/rhasspy/piper) for high-quality neural TTS.
//! Downloads the Piper binary and voice models on first use.

use directories::ProjectDirs;
use rodio::{Decoder, OutputStream, Sink};
use std::fs::{self, File};
use std::io::{BufReader, Cursor, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TtsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("Piper not initialized")]
    NotInitialized,
    #[error("Piper process failed: {0}")]
    PiperFailed(String),
    #[error("Audio playback error: {0}")]
    Playback(String),
    #[error("Download failed: {0}")]
    Download(String),
}

impl serde::Serialize for TtsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Voice configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VoiceConfig {
    pub model_name: String,
    pub speaker_id: Option<u32>,
    pub speed: f32,
}

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            model_name: "en_US-libritts-high".to_string(),
            speaker_id: Some(3922),
            speed: 1.0,
        }
    }
}

/// Piper TTS engine
pub struct PiperTts {
    piper_path: PathBuf,
    models_dir: PathBuf,
    voice_config: VoiceConfig,
    is_speaking: Arc<AtomicBool>,
    current_sink: Option<Arc<std::sync::Mutex<Option<Sink>>>>,
}

impl PiperTts {
    /// Create a new Piper TTS instance
    pub fn new() -> Result<Self, TtsError> {
        let project_dirs = ProjectDirs::from("com", "private-assistant", "PrivateAssistant")
            .ok_or_else(|| TtsError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not find project directories",
            )))?;

        let data_dir = project_dirs.data_dir();
        let piper_dir = data_dir.join("piper");
        let models_dir = data_dir.join("voices");

        fs::create_dir_all(&piper_dir)?;
        fs::create_dir_all(&models_dir)?;

        #[cfg(target_os = "windows")]
        let piper_path = piper_dir.join("piper.exe");
        #[cfg(not(target_os = "windows"))]
        let piper_path = piper_dir.join("piper");

        Ok(Self {
            piper_path,
            models_dir,
            voice_config: VoiceConfig::default(),
            is_speaking: Arc::new(AtomicBool::new(false)),
            current_sink: None,
        })
    }

    /// Check if Piper is installed
    pub fn is_installed(&self) -> bool {
        self.piper_path.exists()
    }

    /// Check if a voice model is installed
    pub fn is_voice_installed(&self, model_name: &str) -> bool {
        let onnx_path = self.models_dir.join(format!("{}.onnx", model_name));
        let json_path = self.models_dir.join(format!("{}.onnx.json", model_name));
        onnx_path.exists() && json_path.exists()
    }

    /// Download and install Piper
    pub async fn install_piper(&self) -> Result<(), TtsError> {
        if self.is_installed() {
            println!("Piper already installed at {:?}", self.piper_path);
            return Ok(());
        }

        println!("Downloading Piper...");

        // Piper release URL for Windows
        #[cfg(target_os = "windows")]
        let piper_url = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";
        #[cfg(target_os = "linux")]
        let piper_url = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz";
        #[cfg(target_os = "macos")]
        let piper_url = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz";

        let response = reqwest::get(piper_url).await?;

        if !response.status().is_success() {
            return Err(TtsError::Download(format!(
                "Failed to download Piper: HTTP {}",
                response.status()
            )));
        }

        let bytes = response.bytes().await?;
        let piper_dir = self.piper_path.parent().unwrap();

        #[cfg(target_os = "windows")]
        {
            // Extract ZIP for Windows
            let cursor = Cursor::new(bytes);
            let mut archive = zip::ZipArchive::new(cursor)?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                let outpath = piper_dir.join(file.name());

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

            // Move files from piper subdirectory to piper_dir
            let inner_dir = piper_dir.join("piper");
            if inner_dir.exists() {
                for entry in fs::read_dir(&inner_dir)? {
                    let entry = entry?;
                    let dest = piper_dir.join(entry.file_name());
                    fs::rename(entry.path(), dest)?;
                }
                fs::remove_dir(&inner_dir)?;
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Extract tar.gz for Linux/macOS
            use std::process::Command;
            let temp_file = piper_dir.join("piper.tar.gz");
            fs::write(&temp_file, &bytes)?;

            Command::new("tar")
                .args(["-xzf", temp_file.to_str().unwrap()])
                .current_dir(piper_dir)
                .output()?;

            fs::remove_file(temp_file)?;

            // Make executable
            Command::new("chmod")
                .args(["+x", self.piper_path.to_str().unwrap()])
                .output()?;
        }

        println!("Piper installed at {:?}", self.piper_path);
        Ok(())
    }

    /// Download and install a voice model
    pub async fn install_voice(&self, model_name: &str) -> Result<(), TtsError> {
        if self.is_voice_installed(model_name) {
            println!("Voice {} already installed", model_name);
            return Ok(());
        }

        println!("Downloading voice model: {}", model_name);

        // Piper voices are hosted on Hugging Face
        let base_url = format!(
            "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/{}",
            model_name
        );

        // Download ONNX model
        let onnx_url = format!("{}.onnx", base_url);
        let onnx_response = reqwest::get(&onnx_url).await?;

        if !onnx_response.status().is_success() {
            // Try alternative URL structure
            let alt_onnx_url = format!(
                "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/{}.onnx",
                model_name
            );
            let alt_response = reqwest::get(&alt_onnx_url).await?;

            if !alt_response.status().is_success() {
                return Err(TtsError::Download(format!(
                    "Failed to download voice model ONNX: {}",
                    model_name
                )));
            }

            let onnx_bytes = alt_response.bytes().await?;
            let onnx_path = self.models_dir.join(format!("{}.onnx", model_name));
            let mut file = File::create(&onnx_path)?;
            file.write_all(&onnx_bytes)?;
        } else {
            let onnx_bytes = onnx_response.bytes().await?;
            let onnx_path = self.models_dir.join(format!("{}.onnx", model_name));
            let mut file = File::create(&onnx_path)?;
            file.write_all(&onnx_bytes)?;
        }

        // Download JSON config
        let json_url = format!("{}.onnx.json", base_url);
        let json_response = reqwest::get(&json_url).await?;

        if !json_response.status().is_success() {
            let alt_json_url = format!(
                "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/{}.onnx.json",
                model_name
            );
            let alt_response = reqwest::get(&alt_json_url).await?;

            if !alt_response.status().is_success() {
                return Err(TtsError::Download(format!(
                    "Failed to download voice model JSON: {}",
                    model_name
                )));
            }

            let json_bytes = alt_response.bytes().await?;
            let json_path = self.models_dir.join(format!("{}.onnx.json", model_name));
            let mut file = File::create(&json_path)?;
            file.write_all(&json_bytes)?;
        } else {
            let json_bytes = json_response.bytes().await?;
            let json_path = self.models_dir.join(format!("{}.onnx.json", model_name));
            let mut file = File::create(&json_path)?;
            file.write_all(&json_bytes)?;
        }

        println!("Voice {} installed", model_name);
        Ok(())
    }

    /// Set voice configuration
    pub fn set_voice(&mut self, config: VoiceConfig) {
        self.voice_config = config;
    }

    /// Synthesize text to speech and play it
    pub async fn speak(&mut self, text: &str) -> Result<(), TtsError> {
        if !self.is_installed() {
            return Err(TtsError::NotInitialized);
        }

        // Clone config values to avoid borrow conflicts
        let model_name = self.voice_config.model_name.clone();
        let speaker_id = self.voice_config.speaker_id;
        let speed = self.voice_config.speed;

        if !self.is_voice_installed(&model_name) {
            return Err(TtsError::NotInitialized);
        }

        // Stop any current speech
        self.stop();

        self.is_speaking.store(true, Ordering::SeqCst);

        let model_path = self.models_dir.join(format!("{}.onnx", model_name));

        // Clean text for TTS
        let clean_text = clean_text_for_tts(text);

        if clean_text.is_empty() {
            self.is_speaking.store(false, Ordering::SeqCst);
            return Ok(());
        }

        // Create temp file for output
        let temp_dir = tempfile::tempdir()?;
        let output_path = temp_dir.path().join("output.wav");

        // Build Piper command
        let mut cmd = Command::new(&self.piper_path);
        cmd.arg("--model")
            .arg(&model_path)
            .arg("--output_file")
            .arg(&output_path);

        // Add speaker ID if specified
        if let Some(sid) = speaker_id {
            cmd.arg("--speaker").arg(sid.to_string());
        }

        // Add length scale (inverse of speed)
        let length_scale = 1.0 / speed;
        cmd.arg("--length_scale").arg(length_scale.to_string());

        // Pipe text to stdin
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()?;

        // Write text to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(clean_text.as_bytes())?;
        }

        // Wait for Piper to finish
        let output = child.wait_with_output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            self.is_speaking.store(false, Ordering::SeqCst);
            return Err(TtsError::PiperFailed(stderr.to_string()));
        }

        // Play the audio
        if output_path.exists() {
            self.play_audio(&output_path)?;
        }

        // Keep temp dir alive until playback completes
        // (the Sink holds a reference to the file)
        std::mem::forget(temp_dir);

        Ok(())
    }

    /// Play audio file
    fn play_audio(&mut self, path: &PathBuf) -> Result<(), TtsError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        let (_stream, stream_handle) = OutputStream::try_default()
            .map_err(|e| TtsError::Playback(e.to_string()))?;

        let sink = Sink::try_new(&stream_handle)
            .map_err(|e| TtsError::Playback(e.to_string()))?;

        let source = Decoder::new(reader)
            .map_err(|e| TtsError::Playback(e.to_string()))?;

        sink.append(source);

        // Store sink for later control
        let sink_arc = Arc::new(std::sync::Mutex::new(Some(sink)));
        self.current_sink = Some(sink_arc.clone());

        // Wait for playback in a separate task
        let is_speaking = self.is_speaking.clone();
        std::thread::spawn(move || {
            if let Ok(guard) = sink_arc.lock() {
                if let Some(ref sink) = *guard {
                    sink.sleep_until_end();
                }
            }
            is_speaking.store(false, Ordering::SeqCst);
        });

        Ok(())
    }

    /// Stop current speech
    pub fn stop(&mut self) {
        if let Some(ref sink_arc) = self.current_sink {
            if let Ok(mut guard) = sink_arc.lock() {
                if let Some(sink) = guard.take() {
                    sink.stop();
                }
            }
        }
        self.is_speaking.store(false, Ordering::SeqCst);
        self.current_sink = None;
    }

    /// Check if currently speaking
    pub fn is_speaking(&self) -> bool {
        self.is_speaking.load(Ordering::SeqCst)
    }

    /// Get installation status
    pub fn get_status(&self) -> TtsStatus {
        TtsStatus {
            piper_installed: self.is_installed(),
            voice_installed: self.is_voice_installed(&self.voice_config.model_name),
            current_voice: self.voice_config.clone(),
            is_speaking: self.is_speaking(),
        }
    }
}

/// TTS status for frontend
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TtsStatus {
    pub piper_installed: bool,
    pub voice_installed: bool,
    pub current_voice: VoiceConfig,
    pub is_speaking: bool,
}

/// Clean text for TTS (remove markdown, code blocks, etc.)
fn clean_text_for_tts(text: &str) -> String {
    let mut result = text.to_string();

    // Remove code blocks
    let code_block_re = regex_lite::Regex::new(r"```[\s\S]*?```").unwrap();
    result = code_block_re.replace_all(&result, " code block ").to_string();

    // Remove inline code
    let inline_code_re = regex_lite::Regex::new(r"`([^`]+)`").unwrap();
    result = inline_code_re.replace_all(&result, "$1").to_string();

    // Remove markdown bold
    let bold_re = regex_lite::Regex::new(r"\*\*([^*]+)\*\*").unwrap();
    result = bold_re.replace_all(&result, "$1").to_string();

    // Remove markdown italic
    let italic_re = regex_lite::Regex::new(r"\*([^*]+)\*").unwrap();
    result = italic_re.replace_all(&result, "$1").to_string();

    // Remove headers
    let header_re = regex_lite::Regex::new(r"#{1,6}\s").unwrap();
    result = header_re.replace_all(&result, "").to_string();

    // Remove links, keep text
    let link_re = regex_lite::Regex::new(r"\[([^\]]+)\]\([^)]+\)").unwrap();
    result = link_re.replace_all(&result, "$1").to_string();

    // Remove HTML tags
    let html_re = regex_lite::Regex::new(r"<[^>]+>").unwrap();
    result = html_re.replace_all(&result, "").to_string();

    // Replace multiple newlines with period
    let newline_re = regex_lite::Regex::new(r"\n{2,}").unwrap();
    result = newline_re.replace_all(&result, ". ").to_string();

    // Replace single newlines with space
    result = result.replace('\n', " ");

    // Collapse multiple spaces
    let space_re = regex_lite::Regex::new(r"\s{2,}").unwrap();
    result = space_re.replace_all(&result, " ").to_string();

    result.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_text() {
        let input = "# Hello\n\nThis is **bold** and *italic*.\n\n```rust\ncode\n```\n\nEnd.";
        let output = clean_text_for_tts(input);
        assert!(!output.contains("**"));
        assert!(!output.contains("```"));
        assert!(!output.contains("#"));
    }
}
