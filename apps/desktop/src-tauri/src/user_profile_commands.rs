use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::Mutex;

use log::info;
use tauri::State;

use crate::crypto::EncryptionKeyManager;
use crate::user_profile::{UserProfile, UserProfileStore};

/// Tauri-managed state for the encrypted user-profile store.
///
/// `key_manager` is shared (Arc) with the global EncryptionKeyManager managed
/// by Tauri so that key rotation immediately propagates to every reader.
pub struct UserProfileState {
    pub store: UserProfileStore,
    pub key_manager: Arc<StdMutex<EncryptionKeyManager>>,
}

#[tauri::command]
pub async fn save_user_profile(
    profile: UserProfile,
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<(), String> {
    info!("Saving user profile (id={})", profile.id);
    let guard = state.lock().await;
    let km = guard.key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
    guard.store.save(&profile, &km)
}

#[tauri::command]
pub async fn load_user_profile(
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<UserProfile, String> {
    info!("Loading user profile");
    let guard = state.lock().await;
    let km = guard.key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
    guard.store.load(&km)
}

#[tauri::command]
pub async fn backup_redaction_terms(
    terms: Vec<crate::user_profile::CustomRedactTerm>,
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<(), String> {
    info!("Backing up {} custom redaction terms", terms.len());
    let guard = state.lock().await;
    let km = guard.key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
    let mut profile = guard.store.load(&km)?;
    profile.custom_redact_terms = terms;
    guard.store.save(&profile, &km)
}

#[tauri::command]
pub async fn restore_redaction_terms(
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<Vec<crate::user_profile::CustomRedactTerm>, String> {
    info!("Restoring custom redaction terms from backup");
    let guard = state.lock().await;
    let km = guard.key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
    let profile = guard.store.load(&km)?;
    Ok(profile.custom_redact_terms)
}
