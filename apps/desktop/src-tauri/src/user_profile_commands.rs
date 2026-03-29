use tokio::sync::Mutex;

use log::info;
use tauri::State;

use crate::crypto::EncryptionKeyManager;
use crate::user_profile::{UserProfile, UserProfileStore};

/// Tauri-managed state for the encrypted user-profile store.
pub struct UserProfileState {
    pub store: UserProfileStore,
    pub key_manager: EncryptionKeyManager,
}

/// Save (overwrite) the user profile to encrypted storage.
#[tauri::command]
pub async fn save_user_profile(
    profile: UserProfile,
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<(), String> {
    info!("Saving user profile (id={})", profile.id);
    let guard = state.lock().await;
    guard.store.save(&profile, &guard.key_manager)
}

/// Load the user profile from encrypted storage.
/// Returns a default (empty) profile if none has been saved yet.
#[tauri::command]
pub async fn load_user_profile(
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<UserProfile, String> {
    info!("Loading user profile");
    let guard = state.lock().await;
    guard.store.load(&guard.key_manager)
}

/// Backup custom redaction terms to encrypted storage.
#[tauri::command]
pub async fn backup_redaction_terms(
    terms: Vec<crate::user_profile::CustomRedactTerm>,
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<(), String> {
    info!("Backing up {} custom redaction terms", terms.len());
    let guard = state.lock().await;
    let mut profile = guard.store.load(&guard.key_manager)?;
    profile.custom_redact_terms = terms;
    guard.store.save(&profile, &guard.key_manager)
}

/// Restore custom redaction terms from encrypted storage.
#[tauri::command]
pub async fn restore_redaction_terms(
    state: State<'_, Mutex<UserProfileState>>,
) -> Result<Vec<crate::user_profile::CustomRedactTerm>, String> {
    info!("Restoring custom redaction terms from backup");
    let guard = state.lock().await;
    let profile = guard.store.load(&guard.key_manager)?;
    Ok(profile.custom_redact_terms)
}
