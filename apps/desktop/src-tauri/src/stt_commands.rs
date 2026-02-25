//! Tauri commands for Speech-to-Text functionality

use crate::stt::{SttConfig, SttError, SttStatus, WhisperStt};
use std::sync::Mutex;
use tauri::State;

/// State wrapper for STT
pub struct SttState(pub Mutex<Option<WhisperStt>>);

/// Get STT status
#[tauri::command]
pub fn stt_get_status(state: State<SttState>) -> Result<SttStatus, SttError> {
    let guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    let stt = guard.as_ref().ok_or(SttError::NotInitialized)?;
    Ok(stt.get_status())
}

/// Initialize STT (download Whisper and model if needed)
#[tauri::command]
pub async fn stt_initialize(state: State<'_, SttState>) -> Result<SttStatus, SttError> {
    let (is_installed, is_model_installed, model_name, whisper_path, models_dir) = {
        let guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
        let stt = guard.as_ref().ok_or(SttError::NotInitialized)?;
        (
            stt.is_installed(),
            stt.is_model_installed(&stt.config.model_name),
            stt.config.model_name.clone(),
            stt.whisper_path(),
            stt.models_dir(),
        )
    };

    if !is_installed {
        WhisperStt::download_whisper(&whisper_path).await?;
    }

    if !is_model_installed {
        WhisperStt::download_model(&models_dir, &model_name).await?;
    }

    let guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    let stt = guard.as_ref().ok_or(SttError::NotInitialized)?;
    Ok(stt.get_status())
}

/// Transcribe audio (base64 encoded WAV)
#[tauri::command]
pub async fn stt_transcribe(
    state: State<'_, SttState>,
    audio_base64: String,
) -> Result<String, SttError> {
    let (whisper_path, models_dir, config) = {
        let guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
        let stt = guard.as_ref().ok_or(SttError::NotInitialized)?;

        if !stt.is_installed() {
            return Err(SttError::NotInitialized);
        }
        if !stt.is_model_installed(&stt.config.model_name) {
            return Err(SttError::NotInitialized);
        }

        (stt.whisper_path(), stt.models_dir(), stt.config.clone())
    };

    WhisperStt::transcribe_audio(&whisper_path, &models_dir, &config, &audio_base64).await
}

/// Check if currently transcribing
#[tauri::command]
pub fn stt_is_transcribing(state: State<SttState>) -> Result<bool, SttError> {
    let guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    let stt = guard.as_ref().ok_or(SttError::NotInitialized)?;
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
    let mut guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
    let stt = guard.as_mut().ok_or(SttError::NotInitialized)?;
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
    let models_dir = {
        let guard = state.0.lock().map_err(|e| SttError::WhisperFailed(e.to_string()))?;
        let stt = guard.as_ref().ok_or(SttError::NotInitialized)?;
        stt.models_dir()
    };

    WhisperStt::download_model(&models_dir, &model_name).await
}
