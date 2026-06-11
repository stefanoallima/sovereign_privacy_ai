use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Nonce,
};
use std::error::Error;
use uuid::Uuid;
use log::{info, warn, error};
use zeroize::Zeroize;

const NONCE_SIZE: usize = 12; // 96 bits for ChaCha20-Poly1305
const KEY_SIZE: usize = 32; // 256 bits
const TAG_SIZE: usize = 16; // 128 bits

/// Encryption key stored in Windows Credential Manager
/// On other platforms, falls back to a local file
#[derive(Clone)]
pub struct EncryptionKeyManager {
    key: Vec<u8>,
}

impl EncryptionKeyManager {
    /// Initialize encryption key from Windows Credential Manager or create new one
    pub fn new() -> Result<Self, Box<dyn Error>> {
        info!("Initializing encryption key manager");

        #[cfg(target_os = "windows")]
        {
            match Self::load_key_from_windows_credential_manager() {
                Ok(key) => {
                    info!("Loaded encryption key from Windows Credential Manager");
                    Ok(EncryptionKeyManager { key })
                }
                Err(_) => {
                    info!("No existing key found, generating new one");
                    let key = Self::generate_new_key()?;
                    Self::save_key_to_windows_credential_manager(&key)?;
                    Ok(EncryptionKeyManager { key })
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            match Self::load_key_from_file() {
                Ok(key) => {
                    info!("Loaded encryption key from file");
                    Ok(EncryptionKeyManager { key })
                }
                Err(_) => {
                    info!("No existing key found, generating new one");
                    let key = Self::generate_new_key()?;
                    Self::save_key_to_file(&key)?;
                    Ok(EncryptionKeyManager { key })
                }
            }
        }
    }

    /// Generate a new random encryption key
    fn generate_new_key() -> Result<Vec<u8>, Box<dyn Error>> {
        use rand::RngCore;
        let mut key = vec![0u8; KEY_SIZE];
        rand::thread_rng().fill_bytes(&mut key);
        Ok(key)
    }

    /// Windows credential target for the encryption key (generic credential).
    #[cfg(target_os = "windows")]
    const CRED_TARGET: &'static str = "PrivateAssistant/encryption-key";

    /// Load the key, preferring the OS credential store, then the legacy key
    /// file (migrating it into the store on the way), then signalling
    /// "not found" so the caller generates a fresh key.
    /// ADDITIVE: the key file is read but never deleted — no lockout possible.
    #[cfg(target_os = "windows")]
    fn load_key_from_windows_credential_manager() -> Result<Vec<u8>, Box<dyn Error>> {
        // 1. OS credential store (primary, secure).
        match Self::cred_read() {
            Ok(key) if key.len() == KEY_SIZE => return Ok(key),
            Ok(key) => warn!(
                "Ignoring credential-store key with unexpected length {} (want {})",
                key.len(),
                KEY_SIZE
            ),
            Err(_) => { /* fall through to file fallback */ }
        }

        // 2. Legacy plaintext key file — honor it AND migrate into the store.
        let key_path = Self::get_key_path()?;
        if key_path.exists() {
            let key = std::fs::read(&key_path)?;
            match Self::cred_write(&key) {
                Ok(()) => info!(
                    "Migrated encryption key from file into Windows Credential Manager"
                ),
                Err(e) => warn!("Could not migrate key into credential store: {}", e),
            }
            return Ok(key);
        }

        // 3. Nothing found — let new() generate and save a fresh key.
        Err("No encryption key in credential store or key file".into())
    }

    /// Persist the key to the OS credential store AND keep the file fallback.
    /// ADDITIVE: the file is (re)written so a machine without a credential
    /// entry can still load the key; the file is never deleted.
    #[cfg(target_os = "windows")]
    fn save_key_to_windows_credential_manager(key: &[u8]) -> Result<(), Box<dyn Error>> {
        Self::cred_write(key)?;
        if let Err(e) = Self::write_key_file(key) {
            warn!(
                "Wrote key to credential store but failed to write file fallback: {}",
                e
            );
        }
        Ok(())
    }

    /// Read the key blob from the Windows Credential Manager.
    #[cfg(target_os = "windows")]
    fn cred_read() -> Result<Vec<u8>, Box<dyn Error>> {
        use winapi::um::wincred::{CredFree, CredReadW, CRED_TYPE_GENERIC, PCREDENTIALW};
        let target = Self::wide_null(Self::CRED_TARGET);
        let mut pcred: PCREDENTIALW = std::ptr::null_mut();
        let ok = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut pcred) };
        if ok == 0 || pcred.is_null() {
            return Err("CredReadW: credential not found".into());
        }
        // SAFETY: CredReadW succeeded, so pcred points to a valid CREDENTIALW.
        // Guard against a null or zero-size blob before from_raw_parts (which is
        // UB with a null/dangling pointer), and always free the credential.
        let blob = unsafe {
            let cred = &*pcred;
            let size = cred.CredentialBlobSize as usize;
            let bytes = if cred.CredentialBlob.is_null() || size == 0 {
                Vec::new()
            } else {
                std::slice::from_raw_parts(cred.CredentialBlob, size).to_vec()
            };
            CredFree(pcred as *mut _);
            bytes
        };
        if blob.is_empty() {
            return Err("CredReadW: credential blob was empty".into());
        }
        Ok(blob)
    }

    /// Write the key blob into the Windows Credential Manager (generic, local machine).
    #[cfg(target_os = "windows")]
    fn cred_write(key: &[u8]) -> Result<(), Box<dyn Error>> {
        use winapi::um::wincred::{
            CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
        };
        let mut target = Self::wide_null(Self::CRED_TARGET);
        // SAFETY: zeroed CREDENTIALW is valid; we set every field CredWriteW reads
        // for a CRED_TYPE_GENERIC credential and leave the rest null/zero.
        let mut cred: CREDENTIALW = unsafe { std::mem::zeroed() };
        cred.Type = CRED_TYPE_GENERIC;
        cred.TargetName = target.as_mut_ptr();
        cred.CredentialBlobSize = key.len() as u32;
        cred.CredentialBlob = key.as_ptr() as *mut u8;
        cred.Persist = CRED_PERSIST_LOCAL_MACHINE;
        let ok = unsafe { CredWriteW(&mut cred as *mut CREDENTIALW, 0) };
        if ok == 0 {
            return Err("CredWriteW failed".into());
        }
        Ok(())
    }

    /// UTF-16, null-terminated wide string for Win32 APIs.
    #[cfg(target_os = "windows")]
    fn wide_null(s: &str) -> Vec<u16> {
        use std::os::windows::ffi::OsStrExt;
        std::ffi::OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    #[cfg(not(target_os = "windows"))]
    fn load_key_from_file() -> Result<Vec<u8>, Box<dyn Error>> {
        let key_path = Self::get_key_path()?;
        if key_path.exists() {
            std::fs::read(&key_path).map_err(|e| Box::new(e) as Box<dyn Error>)
        } else {
            Err("Key file not found".into())
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn save_key_to_file(key: &[u8]) -> Result<(), Box<dyn Error>> {
        Self::write_key_file(key)
    }

    /// Write the key to the local key file (fallback store on Windows, primary
    /// store elsewhere). Restrictive 0600 permissions on Unix. The file is
    /// never deleted by any code path — it is the lockout-proof fallback.
    fn write_key_file(key: &[u8]) -> Result<(), Box<dyn Error>> {
        let key_path = Self::get_key_path()?;
        if let Some(parent) = key_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&key_path, key)?;

        // Set restrictive permissions on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&key_path, perms)?;
        }

        Ok(())
    }

    fn get_key_path() -> Result<std::path::PathBuf, Box<dyn Error>> {
        let data_dir = directories::ProjectDirs::from("", "", "PrivateAssistant")
            .ok_or("Could not determine data directory")?
            .data_dir()
            .to_path_buf();

        Ok(data_dir.join(".encryption.key"))
    }

    pub fn get_key(&self) -> &[u8] {
        &self.key
    }

    /// Construct a key manager directly from raw key bytes. Test-only: tests
    /// must NOT call `new()` because writing a random key into the real OS
    /// credential store would lock out the user's existing encrypted data.
    #[cfg(test)]
    pub fn from_raw_key(key: Vec<u8>) -> Self {
        EncryptionKeyManager { key }
    }
}

/// PII encryption/decryption service
pub struct PiiEncryption;

impl PiiEncryption {
    /// Encrypt PII value using ChaCha20-Poly1305
    pub fn encrypt(plaintext: &str, key_manager: &EncryptionKeyManager) -> Result<Vec<u8>, Box<dyn Error>> {
        info!("Encrypting PII value");

        let key = key_manager.get_key();
        let cipher = ChaCha20Poly1305::new(key.into());

        // Generate random nonce
        let uuid = Uuid::new_v4();
        let nonce_bytes = uuid.as_bytes();
        let nonce = Nonce::from_slice(&nonce_bytes[..NONCE_SIZE]);

        // Encrypt
        let ciphertext = cipher.encrypt(nonce, Payload::from(plaintext.as_bytes()))
            .map_err(|e| {
                error!("Encryption failed: {}", e);
                format!("Encryption failed: {}", e)
            })?;

        // Prepend nonce to ciphertext
        let mut encrypted = nonce_bytes[..NONCE_SIZE].to_vec();
        encrypted.extend_from_slice(&ciphertext);

        Ok(encrypted)
    }

    /// Decrypt PII value using ChaCha20-Poly1305
    pub fn decrypt(encrypted: &[u8], key_manager: &EncryptionKeyManager) -> Result<String, Box<dyn Error>> {
        info!("Decrypting PII value");

        if encrypted.len() < NONCE_SIZE {
            return Err("Encrypted data too short".into());
        }

        let key = key_manager.get_key();
        let cipher = ChaCha20Poly1305::new(key.into());

        // Extract nonce and ciphertext
        let nonce = Nonce::from_slice(&encrypted[..NONCE_SIZE]);
        let ciphertext = &encrypted[NONCE_SIZE..];

        // Decrypt
        let plaintext_bytes = cipher.decrypt(nonce, Payload::from(ciphertext))
            .map_err(|e| {
                error!("Decryption failed: {}", e);
                format!("Decryption failed: {}", e)
            })?;

        let plaintext = String::from_utf8(plaintext_bytes)
            .map_err(|e| Box::new(e) as Box<dyn Error>)?;

        Ok(plaintext)
    }

    /// Encrypt a batch of PII values
    pub fn encrypt_batch(
        values: &[&str],
        key_manager: &EncryptionKeyManager,
    ) -> Result<Vec<Vec<u8>>, Box<dyn Error>> {
        values
            .iter()
            .map(|v| Self::encrypt(v, key_manager))
            .collect()
    }

    /// Decrypt a batch of PII values
    pub fn decrypt_batch(
        encrypted_values: &[Vec<u8>],
        key_manager: &EncryptionKeyManager,
    ) -> Result<Vec<String>, Box<dyn Error>> {
        encrypted_values
            .iter()
            .map(|v| Self::decrypt(v, key_manager))
            .collect()
    }
}

impl Drop for EncryptionKeyManager {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key_manager() -> EncryptionKeyManager {
        // Fixed key — keeps tests hermetic (no OS credential store / file I/O).
        EncryptionKeyManager::from_raw_key(vec![0x42u8; KEY_SIZE])
    }

    #[test]
    fn test_encryption_decryption() -> Result<(), Box<dyn Error>> {
        let key_manager = test_key_manager();
        let plaintext = "123456789"; // BSN example

        let encrypted = PiiEncryption::encrypt(plaintext, &key_manager)?;
        let decrypted = PiiEncryption::decrypt(&encrypted, &key_manager)?;

        assert_eq!(plaintext, decrypted);
        Ok(())
    }

    #[test]
    fn test_encryption_produces_different_ciphertexts() -> Result<(), Box<dyn Error>> {
        let key_manager = test_key_manager();
        let plaintext = "Jan Jansen";

        let encrypted1 = PiiEncryption::encrypt(plaintext, &key_manager)?;
        let encrypted2 = PiiEncryption::encrypt(plaintext, &key_manager)?;

        // Different nonces should produce different ciphertexts
        assert_ne!(encrypted1, encrypted2);

        // But both should decrypt to the same plaintext
        let decrypted1 = PiiEncryption::decrypt(&encrypted1, &key_manager)?;
        let decrypted2 = PiiEncryption::decrypt(&encrypted2, &key_manager)?;

        assert_eq!(plaintext, decrypted1);
        assert_eq!(plaintext, decrypted2);

        Ok(())
    }

    #[test]
    fn test_batch_encryption_decryption() -> Result<(), Box<dyn Error>> {
        let key_manager = test_key_manager();
        let plaintexts = vec!["123456789", "Jan", "Jansen", "+31612345678"];

        let encrypted = PiiEncryption::encrypt_batch(&plaintexts, &key_manager)?;
        let decrypted = PiiEncryption::decrypt_batch(&encrypted, &key_manager)?;

        assert_eq!(plaintexts.len(), decrypted.len());
        for (original, result) in plaintexts.iter().zip(decrypted.iter()) {
            assert_eq!(*original, result);
        }

        Ok(())
    }
}
