//! Tauri commands for Speech-to-Text functionality

use crate::stt::{SttConfig, SttError, SttStatus, WhisperStt};
use std::sync::Mutex;
use tauri::State;

/// State wrapper for STT
pub struct SttState(pub Mutex<WhisperStt>);

/// Get STT status
#[tauri::command]
pub fn stt_get_status(state: State<SttState>) -> Result<SttStatus, SttError> {
    let stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    Ok(stt.get_status())
}

/// Initialize STT (download Whisper and model if needed)
#[tauri::command]
pub async fn stt_initialize(state: State<'_, SttState>) -> Result<SttStatus, SttError> {
    // Check if Whisper is installed
    let (is_installed, is_model_installed, model_name, whisper_path, models_dir) = {
        let stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
        (
            stt.is_installed(),
            stt.is_model_installed(&stt.config.model_name),
            stt.config.model_name.clone(),
            stt.whisper_path(),
            stt.models_dir(),
        )
    };

    // Install Whisper if needed (without holding the lock)
    if !is_installed {
        WhisperStt::download_whisper(&whisper_path).await?;
    }

    // Install model if needed (without holding the lock)
    if !is_model_installed {
        WhisperStt::download_model(&models_dir, &model_name).await?;
    }

    // Return final status
    let stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    Ok(stt.get_status())
}

/// Transcribe audio (base64 encoded WAV)
#[tauri::command]
pub async fn stt_transcribe(
    state: State<'_, SttState>,
    audio_base64: String,
) -> Result<String, SttError> {
    // Get necessary paths and config without holding lock across await
    let (whisper_path, models_dir, config) = {
        let stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;

        if !stt.is_installed() {
            return Err(SttError::NotInitialized);
        }

        if !stt.is_model_installed(&stt.config.model_name) {
            return Err(SttError::NotInitialized);
        }

        (stt.whisper_path(), stt.models_dir(), stt.config.clone())
    };

    // Perform transcription without holding the lock
    WhisperStt::transcribe_audio(&whisper_path, &models_dir, &config, &audio_base64).await
}

/// Check if currently transcribing
#[tauri::command]
pub fn stt_is_transcribing(state: State<SttState>) -> Result<bool, SttError> {
    let stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    Ok(stt.is_transcribing())
}

/// Set STT configuration
#[tauri::command]
pub fn stt_set_config(
    state: State<SttState>,
    model_name: String,
    language: String,
    translate: bool,
) -> Result<(), SttError> {
    let mut stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    stt.set_config(SttConfig {
        model_name,
        language,
        translate,
    });
    Ok(())
}

/// Download a specific model
#[tauri::command]
pub async fn stt_download_model(
    state: State<'_, SttState>,
    model_name: String,
) -> Result<(), SttError> {
    // Get models_dir without holding the lock across await
    let models_dir = {
        let stt = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
        stt.models_dir()
    };

    // Download without holding the lock
    WhisperStt::download_model(&models_dir, &model_name).await
}
