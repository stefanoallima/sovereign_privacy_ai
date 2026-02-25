//! Tauri commands for TTS functionality

use crate::tts::{PiperTts, TtsError, TtsStatus, VoiceConfig};
use std::sync::Mutex;
use tauri::State;

pub struct TtsState(pub Mutex<Option<PiperTts>>);

/// Get TTS status
#[tauri::command]
pub fn tts_get_status(state: State<TtsState>) -> Result<TtsStatus, TtsError> {
    let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
    let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
    Ok(tts.get_status())
}

/// Initialize TTS (download Piper and voice model if needed)
#[tauri::command]
pub async fn tts_initialize(state: State<'_, TtsState>) -> Result<TtsStatus, TtsError> {
    let (is_installed, voice_config) = {
        let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
        let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
        (tts.is_installed(), tts.get_status().current_voice)
    };

    if !is_installed {
        let temp_tts = PiperTts::new()?;
        temp_tts.install_piper().await?;
    }

    let voice_installed = {
        let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
        let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
        tts.is_voice_installed(&voice_config.model_name)
    };

    if !voice_installed {
        let temp_tts = PiperTts::new()?;
        temp_tts.install_voice(&voice_config.model_name).await?;
    }

    let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
    let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
    Ok(tts.get_status())
}

/// Speak text
#[tauri::command]
pub async fn tts_speak(state: State<'_, TtsState>, text: String) -> Result<(), TtsError> {
    let voice_config = {
        let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
        let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
        if !tts.is_installed() {
            return Err(TtsError::NotInitialized);
        }
        tts.get_status().current_voice
    };

    let mut speak_tts = PiperTts::new()?;
    speak_tts.set_voice(voice_config);
    speak_tts.speak(&text).await?;
    Ok(())
}

/// Stop speaking
#[tauri::command]
pub fn tts_stop(state: State<TtsState>) -> Result<(), TtsError> {
    let mut guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
    let tts = guard.as_mut().ok_or(TtsError::NotInitialized)?;
    tts.stop();
    Ok(())
}

/// Check if currently speaking
#[tauri::command]
pub fn tts_is_speaking(state: State<TtsState>) -> Result<bool, TtsError> {
    let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
    let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
    Ok(tts.is_speaking())
}

/// Set voice configuration
#[tauri::command]
pub fn tts_set_voice(
    state: State<TtsState>,
    model_name: String,
    speaker_id: Option<u32>,
    speed: Option<f32>,
) -> Result<(), TtsError> {
    let mut guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
    let tts = guard.as_mut().ok_or(TtsError::NotInitialized)?;
    tts.set_voice(VoiceConfig {
        model_name,
        speaker_id,
        speed: speed.unwrap_or(1.0),
    });
    Ok(())
}

/// Download a specific voice model
#[tauri::command]
pub async fn tts_download_voice(
    state: State<'_, TtsState>,
    model_name: String,
) -> Result<(), TtsError> {
    let voice_installed = {
        let guard = state.0.lock().map_err(|_| TtsError::NotInitialized)?;
        let tts = guard.as_ref().ok_or(TtsError::NotInitialized)?;
        tts.is_voice_installed(&model_name)
    };

    if !voice_installed {
        let temp_tts = PiperTts::new()?;
        temp_tts.install_voice(&model_name).await?;
    }

    Ok(())
}
