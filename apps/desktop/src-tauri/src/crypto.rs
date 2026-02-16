use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Nonce,
};
use std::error::Error;
use uuid::Uuid;
use log::{info, error};
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

    #[cfg(target_os = "windows")]
    fn load_key_from_windows_credential_manager() -> Result<Vec<u8>, Box<dyn Error>> {
        // This is a placeholder implementation
        // In production, use the `windows-rs` crate to interact with Credential Manager
        // For now, we'll use a file-based fallback
        let key_path = Self::get_key_path()?;
        if key_path.exists() {
            std::fs::read(&key_path).map_err(|e| Box::new(e) as Box<dyn Error>)
        } else {
            Err("Key file not found".into())
        }
    }

    #[cfg(target_os = "windows")]
    fn save_key_to_windows_credential_manager(key: &[u8]) -> Result<(), Box<dyn Error>> {
        // This is a placeholder implementation
        // In production, use the `windows-rs` crate to store in Credential Manager
        // For now, we'll use a file-based fallback
        let key_path = Self::get_key_path()?;
        if let Some(parent) = key_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&key_path, key)?;
        Ok(())
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

    #[test]
    fn test_encryption_decryption() -> Result<(), Box<dyn Error>> {
        let key_manager = EncryptionKeyManager::new()?;
        let plaintext = "123456789"; // BSN example

        let encrypted = PiiEncryption::encrypt(plaintext, &key_manager)?;
        let decrypted = PiiEncryption::decrypt(&encrypted, &key_manager)?;

        assert_eq!(plaintext, decrypted);
        Ok(())
    }

    #[test]
    fn test_encryption_produces_different_ciphertexts() -> Result<(), Box<dyn Error>> {
        let key_manager = EncryptionKeyManager::new()?;
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
        let key_manager = EncryptionKeyManager::new()?;
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
