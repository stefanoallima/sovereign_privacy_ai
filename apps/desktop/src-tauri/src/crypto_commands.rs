use std::sync::{Arc, Mutex as StdMutex};

use log::info;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};

use crate::commands::DbState;
use crate::crypto::{EncryptionKeyManager, PiiEncryption};
use crate::key_rotation::{KeyRotator, RotationResult};
use crate::user_profile::UserProfileStore;

// ---- At-rest encryption for JS stores (PII vault, redaction registry) ----
// Thin wrappers over `PiiEncryption` (ChaCha20-Poly1305). Ciphertext crosses
// the bridge as a byte array (Vec<u8>); the JS adapter base64-wraps it.

/// Encrypt an arbitrary UTF-8 string. Returns nonce-prefixed ciphertext bytes.
#[tauri::command]
pub fn encrypt_string(
    plaintext: String,
    key_manager: State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
) -> Result<Vec<u8>, String> {
    let km = key_manager.lock().map_err(|e| e.to_string())?;
    PiiEncryption::encrypt(&plaintext, &km).map_err(|e| e.to_string())
}

/// Decrypt bytes produced by `encrypt_string` back to the original string.
#[tauri::command]
pub fn decrypt_string(
    ciphertext: Vec<u8>,
    key_manager: State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
) -> Result<String, String> {
    let km = key_manager.lock().map_err(|e| e.to_string())?;
    PiiEncryption::decrypt(&ciphertext, &km).map_err(|e| e.to_string())
}

// ---- Key custody status, rotation, import/export ----

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptionStatus {
    pub custody: String,
    pub key_fingerprint: String,
    pub keychain_service: Option<String>,
    pub keychain_account: Option<String>,
    pub cipher: String,
}

#[tauri::command]
pub async fn get_encryption_status(
    key_manager: State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
) -> Result<EncryptionStatus, String> {
    let km = key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
    Ok(EncryptionStatus {
        custody: km.custody().kind_label().to_string(),
        key_fingerprint: km.fingerprint(),
        keychain_service: km.custody().keychain_service().map(|s| s.to_string()),
        keychain_account: km.custody().keychain_account().map(|s| s.to_string()),
        cipher: "ChaCha20-Poly1305".to_string(),
    })
}

#[tauri::command]
pub async fn rotate_encryption_key(
    app: tauri::AppHandle,
    key_manager: State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
    db_state: State<'_, DbState>,
) -> Result<RotationResult, String> {
    info!("rotate_encryption_key invoked");
    let new_key = generate_random_key();
    perform_rotation(&app, &key_manager, &db_state, new_key).await
}

#[tauri::command]
pub async fn import_encryption_key(
    app: tauri::AppHandle,
    hex_key: String,
    key_manager: State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
    db_state: State<'_, DbState>,
) -> Result<RotationResult, String> {
    info!("import_encryption_key invoked (hex_key.len={})", hex_key.len());
    let trimmed = hex_key.trim();
    if trimmed.len() != 64 {
        return Err("Key must be 64 hex characters (32 bytes).".to_string());
    }
    let bytes = hex::decode(trimmed)
        .map_err(|e| format!("Key contains non-hex characters: {e}"))?;
    if bytes.len() != 32 {
        return Err(format!("Decoded key is {} bytes, expected 32.", bytes.len()));
    }
    let mut new_key = [0u8; 32];
    new_key.copy_from_slice(&bytes);
    perform_rotation(&app, &key_manager, &db_state, new_key).await
}

#[tauri::command]
pub async fn export_encryption_key(
    key_manager: State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
) -> Result<String, String> {
    info!("export_encryption_key invoked");
    let km = key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
    Ok(hex::encode(km.get_key()))
}

async fn perform_rotation(
    app: &tauri::AppHandle,
    key_manager: &State<'_, Arc<StdMutex<EncryptionKeyManager>>>,
    db_state: &State<'_, DbState>,
    new_key: [u8; 32],
) -> Result<RotationResult, String> {
    // Determine the data dir up-front so the worker thread does not need to
    // touch the (TokioMutex-guarded) UserProfileState.
    let profile_data_dir = directories::ProjectDirs::from("", "", "PrivateAssistant")
        .map(|d| d.data_dir().to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let store = UserProfileStore::new(&profile_data_dir);

    // Guards are taken synchronously and held for the duration of the rotation.
    // No `.await` happens between locking and unlocking, so neither guard
    // crosses a yield point. This keeps the future Send-clean.
    let mut km_guard = key_manager
        .lock()
        .map_err(|e| format!("Key manager mutex poisoned: {e}"))?;
    let mut db_guard = db_state
        .0
        .lock()
        .map_err(|e| format!("DB mutex poisoned: {e}"))?;

    let result = KeyRotator::rotate(
        &mut db_guard,
        &store,
        &profile_data_dir,
        &mut km_guard,
        new_key,
    )
    .map_err(|e| format!("Rotation failed: {e}"))?;

    drop(db_guard);
    drop(km_guard);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("encryption-key-rotated", &result);
    }
    Ok(result)
}

fn generate_random_key() -> [u8; 32] {
    use rand::RngCore;
    let mut k = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut k);
    k
}
