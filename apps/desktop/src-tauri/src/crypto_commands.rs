//! Tauri commands exposing at-rest encryption to the JS layer, so sensitive
//! zustand stores (PII vault, redaction registry) can be encrypted in storage
//! with the OS-keychain-backed key. Thin wrappers over the already-tested
//! `PiiEncryption` (ChaCha20-Poly1305, see crypto.rs). Ciphertext crosses the
//! bridge as a byte array (Vec<u8>); the JS adapter base64-wraps it for storage.

use std::sync::Mutex;
use tauri::State;

use crate::crypto::{EncryptionKeyManager, PiiEncryption};

/// Encrypt an arbitrary UTF-8 string. Returns nonce-prefixed ciphertext bytes.
#[tauri::command]
pub fn encrypt_string(
    plaintext: String,
    key_state: State<'_, Mutex<EncryptionKeyManager>>,
) -> Result<Vec<u8>, String> {
    let key = key_state.lock().map_err(|e| e.to_string())?;
    PiiEncryption::encrypt(&plaintext, &key).map_err(|e| e.to_string())
}

/// Decrypt bytes produced by `encrypt_string` back to the original string.
#[tauri::command]
pub fn decrypt_string(
    ciphertext: Vec<u8>,
    key_state: State<'_, Mutex<EncryptionKeyManager>>,
) -> Result<String, String> {
    let key = key_state.lock().map_err(|e| e.to_string())?;
    PiiEncryption::decrypt(&ciphertext, &key).map_err(|e| e.to_string())
}
