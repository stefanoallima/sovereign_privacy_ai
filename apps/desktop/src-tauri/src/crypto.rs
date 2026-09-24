use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Nonce,
};
use sha2::{Digest, Sha256};
use std::error::Error;
use std::path::PathBuf;
use uuid::Uuid;
use log::{info, warn, error};
use zeroize::Zeroize;

const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

const KEYCHAIN_SERVICE: &str = "ailocalmind";
const KEYCHAIN_ACCOUNT: &str = "pii_vault_master_key_v1";
const DEV_FALLBACK_ENV: &str = "AILOCALMIND_DEV_KEY_FILE_FALLBACK";

/// Where the master key lives. Default is the OS keychain; the file fallback
/// is dev-only and gated by an explicit env var.
#[derive(Clone, Debug)]
pub enum KeyCustody {
    Keychain {
        service: String,
        account: String,
    },
    FileFallback {
        path: PathBuf,
    },
}

impl KeyCustody {
    fn keychain_default() -> Self {
        KeyCustody::Keychain {
            service: KEYCHAIN_SERVICE.to_string(),
            account: KEYCHAIN_ACCOUNT.to_string(),
        }
    }

    fn file_fallback_default() -> Result<Self, Box<dyn Error>> {
        Ok(KeyCustody::FileFallback {
            path: legacy_key_path()?,
        })
    }

    fn load(&self) -> Result<Vec<u8>, Box<dyn Error>> {
        match self {
            KeyCustody::Keychain { service, account } => {
                let entry = keyring::Entry::new(service, account)?;
                let bytes = entry.get_secret()?;
                if bytes.len() != KEY_SIZE {
                    return Err(format!(
                        "Keychain returned {} bytes, expected {}",
                        bytes.len(),
                        KEY_SIZE
                    )
                    .into());
                }
                Ok(bytes)
            }
            KeyCustody::FileFallback { path } => {
                let bytes = std::fs::read(path)?;
                if bytes.len() != KEY_SIZE {
                    return Err(format!(
                        "Key file at {:?} has {} bytes, expected {}",
                        path,
                        bytes.len(),
                        KEY_SIZE
                    )
                    .into());
                }
                Ok(bytes)
            }
        }
    }

    pub(crate) fn store(&self, key: &[u8]) -> Result<(), Box<dyn Error>> {
        match self {
            KeyCustody::Keychain { service, account } => {
                let entry = keyring::Entry::new(service, account)?;
                entry.set_secret(key)?;
                Ok(())
            }
            KeyCustody::FileFallback { path } => {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(path, key)?;
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let perms = std::fs::Permissions::from_mode(0o600);
                    std::fs::set_permissions(path, perms)?;
                }
                Ok(())
            }
        }
    }

    pub fn kind_label(&self) -> &'static str {
        match self {
            KeyCustody::Keychain { .. } => "keychain",
            KeyCustody::FileFallback { .. } => "file_fallback",
        }
    }

    pub fn keychain_service(&self) -> Option<&str> {
        match self {
            KeyCustody::Keychain { service, .. } => Some(service),
            _ => None,
        }
    }

    pub fn keychain_account(&self) -> Option<&str> {
        match self {
            KeyCustody::Keychain { account, .. } => Some(account),
            _ => None,
        }
    }
}

fn legacy_key_path() -> Result<PathBuf, Box<dyn Error>> {
    let data_dir = directories::ProjectDirs::from("", "", "PrivateAssistant")
        .ok_or("Could not determine data directory")?
        .data_dir()
        .to_path_buf();
    Ok(data_dir.join(".encryption.key"))
}

/// Read the key from the generic Windows credential used by earlier builds
/// ("PrivateAssistant/encryption-key"). Migration source only; never written.
#[cfg(target_os = "windows")]
fn legacy_windows_cred_read() -> Result<Vec<u8>, Box<dyn Error>> {
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::wincred::{CredFree, CredReadW, CRED_TYPE_GENERIC, PCREDENTIALW};
    let target: Vec<u16> = std::ffi::OsStr::new("PrivateAssistant/encryption-key")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut pcred: PCREDENTIALW = std::ptr::null_mut();
    let ok = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut pcred) };
    if ok == 0 || pcred.is_null() {
        return Err("CredReadW: credential not found".into());
    }
    // SAFETY: CredReadW succeeded, so pcred points to a valid CREDENTIALW.
    // Guard a null/zero-size blob before from_raw_parts; always free.
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

fn dev_fallback_enabled() -> bool {
    std::env::var(DEV_FALLBACK_ENV).map(|v| v == "1").unwrap_or(false)
}

/// In-memory holder for the master key plus its custody metadata.
/// The key bytes are zeroized on drop.
#[derive(Clone)]
pub struct EncryptionKeyManager {
    key: Vec<u8>,
    custody: KeyCustody,
}

impl EncryptionKeyManager {
    /// Initialize: prefer keychain; migrate legacy file if present; fall back to
    /// file only when explicitly enabled by env var.
    pub fn new() -> Result<Self, Box<dyn Error>> {
        info!("Initializing encryption key manager");

        let keychain = KeyCustody::keychain_default();

        match keychain.load() {
            Ok(key) => {
                info!("Loaded encryption key from OS keychain");
                Self::maybe_remove_legacy_file();
                Ok(Self { key, custody: keychain })
            }
            Err(e_kc) => {
                let legacy_path = legacy_key_path().ok();
                let legacy_exists = legacy_path
                    .as_ref()
                    .map(|p| p.exists())
                    .unwrap_or(false);

                if legacy_exists {
                    let path = legacy_path.unwrap();
                    let raw = std::fs::read(&path)?;
                    if raw.len() != KEY_SIZE {
                        return Err(format!("Legacy key file at {:?} has {} bytes, expected {}",
                            path, raw.len(), KEY_SIZE).into());
                    }
                    match keychain.store(&raw) {
                        Ok(_) => {
                            info!("Migrated legacy file-based key into OS keychain (custody: keychain). Removing legacy file.");
                            let _ = std::fs::remove_file(&path);
                            return Ok(Self { key: raw, custody: keychain });
                        }
                        Err(e_store) => {
                            if dev_fallback_enabled() {
                                warn!("Keychain unavailable ({e_kc}); legacy file present; storing in keychain failed ({e_store}); falling back to file (DEV ONLY).");
                                return Ok(Self {
                                    key: raw,
                                    custody: KeyCustody::FileFallback { path },
                                });
                            }
                            return Err(format!(
                                "Keychain unavailable ({e_kc}); legacy file present but cannot be migrated ({e_store}). Set {DEV_FALLBACK_ENV}=1 to permit file-based custody (NOT for production)."
                            )
                            .into());
                        }
                    }
                }

                // Builds before keyring custody stored the key as a generic
                // Windows credential (and a key file, handled above). Migrate
                // it so those installs keep access to their encrypted data.
                #[cfg(target_os = "windows")]
                if let Ok(raw) = legacy_windows_cred_read() {
                    if raw.len() == KEY_SIZE {
                        keychain.store(&raw)?;
                        info!("Migrated legacy Windows credential key into OS keychain (custody: keychain).");
                        return Ok(Self { key: raw, custody: keychain });
                    }
                    warn!("Ignoring legacy Windows credential key with unexpected length {}", raw.len());
                }

                match keychain.store(&[0u8; KEY_SIZE]) {
                    Ok(_) => {
                        let _ = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
                            .and_then(|e| e.delete_credential());
                        info!("Keychain available; generating new master key");
                        let key = Self::generate_new_key()?;
                        keychain.store(&key)?;
                        Ok(Self { key, custody: keychain })
                    }
                    Err(e_store) => {
                        if dev_fallback_enabled() {
                            warn!("Keychain unavailable ({e_kc} / {e_store}); using file fallback (DEV ONLY).");
                            let custody = KeyCustody::file_fallback_default()?;
                            let key = Self::generate_new_key()?;
                            custody.store(&key)?;
                            return Ok(Self { key, custody });
                        }
                        Err(format!(
                            "Keychain unavailable ({e_kc} / {e_store}). Set {DEV_FALLBACK_ENV}=1 to permit file-based custody (NOT for production)."
                        )
                        .into())
                    }
                }
            }
        }
    }

    fn maybe_remove_legacy_file() {
        if let Ok(path) = legacy_key_path() {
            if path.exists() {
                if let Err(e) = std::fs::remove_file(&path) {
                    warn!("Could not remove stale legacy key file at {:?}: {}", path, e);
                } else {
                    info!("Removed stale legacy key file at {:?}", path);
                }
            }
        }
    }

    /// Generate a fresh 32-byte key. `pub(crate)` so callers in this crate
    /// (KeyRotator, tests) can reuse it without copy-paste.
    pub(crate) fn generate_new_key() -> Result<Vec<u8>, Box<dyn Error>> {
        use rand::RngCore;
        let mut key = vec![0u8; KEY_SIZE];
        rand::thread_rng().fill_bytes(&mut key);
        Ok(key)
    }

    pub fn get_key(&self) -> &[u8] {
        &self.key
    }

    pub fn custody(&self) -> &KeyCustody {
        &self.custody
    }

    /// 16-hex-char prefix of SHA-256 of the key. Safe to display: it identifies
    /// the key without leaking it.
    pub fn fingerprint(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(&self.key);
        let digest = hasher.finalize();
        hex::encode(&digest[..8])
    }

    /// Replace the in-memory key AND persist the new key in custody.
    /// On success the OLD key bytes are zeroized.
    /// On failure the OLD key remains intact.
    pub fn replace_key(&mut self, new_key: Vec<u8>) -> Result<(), Box<dyn Error>> {
        if new_key.len() != KEY_SIZE {
            return Err(format!("new_key must be {} bytes", KEY_SIZE).into());
        }
        self.custody.store(&new_key)?;
        let mut old = std::mem::replace(&mut self.key, new_key);
        old.zeroize();
        Ok(())
    }

    /// For tests + the rotation recovery path. Constructs a manager around an
    /// already-known key and a chosen custody.
    #[doc(hidden)]
    pub fn from_parts(key: Vec<u8>, custody: KeyCustody) -> Result<Self, Box<dyn Error>> {
        if key.len() != KEY_SIZE {
            return Err(format!("key must be {} bytes", KEY_SIZE).into());
        }
        Ok(Self { key, custody })
    }
}

/// PII encryption/decryption service
pub struct PiiEncryption;

impl PiiEncryption {
    pub fn encrypt(plaintext: &str, key_manager: &EncryptionKeyManager) -> Result<Vec<u8>, Box<dyn Error>> {
        Self::encrypt_with_key(plaintext.as_bytes(), key_manager.get_key())
    }

    pub fn decrypt(encrypted: &[u8], key_manager: &EncryptionKeyManager) -> Result<String, Box<dyn Error>> {
        let bytes = Self::decrypt_with_key(encrypted, key_manager.get_key())?;
        String::from_utf8(bytes).map_err(|e| Box::new(e) as Box<dyn Error>)
    }

    pub fn encrypt_batch(
        values: &[&str],
        key_manager: &EncryptionKeyManager,
    ) -> Result<Vec<Vec<u8>>, Box<dyn Error>> {
        values.iter().map(|v| Self::encrypt(v, key_manager)).collect()
    }

    pub fn decrypt_batch(
        encrypted_values: &[Vec<u8>],
        key_manager: &EncryptionKeyManager,
    ) -> Result<Vec<String>, Box<dyn Error>> {
        encrypted_values.iter().map(|v| Self::decrypt(v, key_manager)).collect()
    }

    /// Used by KeyRotator: encrypt with an explicit key (no manager).
    pub fn encrypt_with_key(plaintext: &[u8], key: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
        let cipher = ChaCha20Poly1305::new(key.into());
        let uuid = Uuid::new_v4();
        let nonce_bytes = uuid.as_bytes();
        let nonce = Nonce::from_slice(&nonce_bytes[..NONCE_SIZE]);
        let ciphertext = cipher.encrypt(nonce, Payload::from(plaintext))
            .map_err(|e| {
                error!("Encryption failed: {}", e);
                format!("Encryption failed: {}", e)
            })?;
        let mut out = nonce_bytes[..NONCE_SIZE].to_vec();
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    /// Used by KeyRotator: decrypt with an explicit key (no manager).
    pub fn decrypt_with_key(encrypted: &[u8], key: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
        if encrypted.len() < NONCE_SIZE {
            return Err("Encrypted data too short".into());
        }
        let cipher = ChaCha20Poly1305::new(key.into());
        let nonce = Nonce::from_slice(&encrypted[..NONCE_SIZE]);
        let ciphertext = &encrypted[NONCE_SIZE..];
        let plaintext = cipher.decrypt(nonce, Payload::from(ciphertext))
            .map_err(|e| {
                error!("Decryption failed: {}", e);
                format!("Decryption failed: {}", e)
            })?;
        Ok(plaintext)
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

    /// Build a manager whose custody is an in-process keychain mock substitute:
    /// we use the FileFallback variant pointed at a tempdir so tests don't
    /// depend on the real OS keychain (which requires UI prompts on macOS/Linux
    /// in CI). The cipher round-trip semantics are identical.
    fn test_manager(tmp: &std::path::Path) -> EncryptionKeyManager {
        let custody = KeyCustody::FileFallback { path: tmp.join("test.key") };
        let key = EncryptionKeyManager::generate_new_key().unwrap();
        custody.store(&key).unwrap();
        EncryptionKeyManager::from_parts(key, custody).unwrap()
    }

    #[test]
    fn test_encryption_decryption() {
        let dir = tempfile::tempdir().unwrap();
        let km = test_manager(dir.path());
        let plaintext = "123456789";

        let encrypted = PiiEncryption::encrypt(plaintext, &km).unwrap();
        let decrypted = PiiEncryption::decrypt(&encrypted, &km).unwrap();
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encryption_produces_different_ciphertexts() {
        let dir = tempfile::tempdir().unwrap();
        let km = test_manager(dir.path());
        let plaintext = "Jan Jansen";

        let e1 = PiiEncryption::encrypt(plaintext, &km).unwrap();
        let e2 = PiiEncryption::encrypt(plaintext, &km).unwrap();
        assert_ne!(e1, e2);
        assert_eq!(PiiEncryption::decrypt(&e1, &km).unwrap(), plaintext);
        assert_eq!(PiiEncryption::decrypt(&e2, &km).unwrap(), plaintext);
    }

    #[test]
    fn test_batch_encryption_decryption() {
        let dir = tempfile::tempdir().unwrap();
        let km = test_manager(dir.path());
        let plaintexts = vec!["123456789", "Jan", "Jansen", "+31612345678"];

        let encrypted = PiiEncryption::encrypt_batch(&plaintexts, &km).unwrap();
        let decrypted = PiiEncryption::decrypt_batch(&encrypted, &km).unwrap();
        assert_eq!(plaintexts.len(), decrypted.len());
        for (a, b) in plaintexts.iter().zip(decrypted.iter()) {
            assert_eq!(*a, b);
        }
    }

    #[test]
    fn test_fingerprint_changes_with_key() {
        let dir = tempfile::tempdir().unwrap();
        let km1 = test_manager(dir.path());
        let dir2 = tempfile::tempdir().unwrap();
        let km2 = test_manager(dir2.path());
        assert_ne!(km1.fingerprint(), km2.fingerprint());
        assert_eq!(km1.fingerprint().len(), 16);
    }

    #[test]
    fn test_replace_key_swaps_in_memory_and_custody() {
        let dir = tempfile::tempdir().unwrap();
        let mut km = test_manager(dir.path());
        let old_fp = km.fingerprint();
        let old_key = km.get_key().to_vec();

        let new_key = EncryptionKeyManager::generate_new_key().unwrap();
        km.replace_key(new_key.clone()).unwrap();

        assert_eq!(km.get_key(), new_key.as_slice());
        assert_ne!(km.fingerprint(), old_fp);

        // Custody (in this test, the file fallback) now contains the new key.
        let on_disk = std::fs::read(dir.path().join("test.key")).unwrap();
        assert_eq!(on_disk, new_key);
        assert_ne!(on_disk, old_key);
    }

    #[test]
    fn test_encrypt_decrypt_with_key_roundtrip() {
        let key = EncryptionKeyManager::generate_new_key().unwrap();
        let payload = b"audit-log entry with PII Jan Jansen 123456789";
        let ct = PiiEncryption::encrypt_with_key(payload, &key).unwrap();
        let pt = PiiEncryption::decrypt_with_key(&ct, &key).unwrap();
        assert_eq!(pt, payload);
    }

    #[test]
    fn test_decrypt_with_wrong_key_fails() {
        let k1 = EncryptionKeyManager::generate_new_key().unwrap();
        let k2 = EncryptionKeyManager::generate_new_key().unwrap();
        let ct = PiiEncryption::encrypt_with_key(b"hello", &k1).unwrap();
        assert!(PiiEncryption::decrypt_with_key(&ct, &k2).is_err());
    }

    #[test]
    fn test_replace_key_rejects_wrong_size() {
        let dir = tempfile::tempdir().unwrap();
        let mut km = test_manager(dir.path());
        let too_short = vec![0u8; 16];
        assert!(km.replace_key(too_short).is_err());
    }

    #[test]
    fn test_custody_kind_label() {
        let dir = tempfile::tempdir().unwrap();
        let km = test_manager(dir.path());
        assert_eq!(km.custody().kind_label(), "file_fallback");
    }
}
