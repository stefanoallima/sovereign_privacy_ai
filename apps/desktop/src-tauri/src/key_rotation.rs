use std::error::Error;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use log::{info, warn};
use serde::{Deserialize, Serialize};

use crate::crypto::{EncryptionKeyManager, PiiEncryption};
use crate::db;
use crate::user_profile::UserProfileStore;

const PENDING_SWAP_FILENAME: &str = ".key_pending_swap";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RotationResult {
    pub old_fingerprint: String,
    pub new_fingerprint: String,
    pub records_re_encrypted: u64,
    pub elapsed_ms: u64,
}

pub struct KeyRotator;

impl KeyRotator {
    /// Re-encrypt every record in the vault from the current key to `new_key`,
    /// then swap the key in custody. Atomicity strategy:
    ///
    /// 1. Single SQLite tx wraps all `pii_values` + `pii_mappings` updates.
    /// 2. user_profile.enc is rewritten to a tmp file then atomically renamed.
    /// 3. A pending-swap file is written BEFORE the keychain swap so that a
    ///    crash between vault rewrite and keychain swap is recoverable on
    ///    next startup via `recover_pending_swap`.
    ///
    /// The lock order in callers (Tauri commands) MUST be: key_manager → db →
    /// profile_store. This function expects the caller to hold all three.
    pub fn rotate(
        conn: &mut rusqlite::Connection,
        profile_store: &UserProfileStore,
        profile_data_dir: &Path,
        key_manager: &mut EncryptionKeyManager,
        new_key: [u8; 32],
    ) -> Result<RotationResult, Box<dyn Error>> {
        let start = Instant::now();
        let old_key = key_manager.get_key().to_vec();
        let old_fp = key_manager.fingerprint();

        if old_key == new_key {
            return Err("New key is identical to current key — refusing to rotate".into());
        }

        info!("Beginning key rotation (old fp={})", old_fp);

        // ---- Vault re-encryption inside a single transaction ----
        let mut records: u64 = 0;
        {
            let tx = conn.transaction()?;

            for (id, blob) in db::iter_pii_values(&tx)? {
                let pt = PiiEncryption::decrypt_with_key(&blob, &old_key)?;
                let new_blob = PiiEncryption::encrypt_with_key(&pt, &new_key)?;
                db::update_pii_value_blob(&tx, &id, &new_blob)?;
                records += 1;
            }

            for (id, blob) in db::iter_pii_mappings(&tx)? {
                let pt = PiiEncryption::decrypt_with_key(&blob, &old_key)?;
                let new_blob = PiiEncryption::encrypt_with_key(&pt, &new_key)?;
                db::update_pii_mapping_blob(&tx, &id, &new_blob)?;
                records += 1;
            }

            // The user_profile.enc rewrite is also part of the all-or-nothing
            // pre-swap state. We do it BEFORE committing the tx so that if it
            // fails the tx rolls back and the keychain is untouched.
            Self::rewrite_user_profile(profile_store, profile_data_dir, &old_key, &new_key)?;

            // Pending-swap marker — written BEFORE we commit the tx so that
            // if a crash happens between commit and keychain swap, recovery
            // can finish the swap. If the tx itself fails, we delete the
            // marker before bubbling the error up.
            let pending_path = profile_data_dir.join(PENDING_SWAP_FILENAME);
            if let Some(parent) = pending_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&pending_path, &new_key)?;

            // Commit the DB tx. If commit fails, drop the pending file.
            if let Err(e) = tx.commit() {
                let _ = std::fs::remove_file(&pending_path);
                return Err(Box::new(e));
            }
        }

        // ---- Swap key in custody (keychain or file fallback) ----
        let pending_path = profile_data_dir.join(PENDING_SWAP_FILENAME);
        match key_manager.replace_key(new_key.to_vec()) {
            Ok(_) => {
                if pending_path.exists() {
                    if let Err(e) = std::fs::remove_file(&pending_path) {
                        warn!("Could not remove pending-swap marker: {}", e);
                    }
                }
            }
            Err(e) => {
                // Vault is on new_key but custody still has old. The pending
                // file holds the new key; recover_pending_swap will retry
                // on next startup.
                warn!(
                    "Vault rewritten but custody swap failed: {}. Pending-swap marker left at {:?} for recovery.",
                    e, pending_path
                );
                return Err(e);
            }
        }

        let new_fp = key_manager.fingerprint();
        let elapsed_ms = start.elapsed().as_millis() as u64;

        info!(
            "Key rotation complete: old_fp={} new_fp={} records={} elapsed_ms={}",
            old_fp, new_fp, records, elapsed_ms
        );

        Ok(RotationResult {
            old_fingerprint: old_fp,
            new_fingerprint: new_fp,
            records_re_encrypted: records,
            elapsed_ms,
        })
    }

    /// Read user_profile.enc with old key, write it back encrypted with new key
    /// using a temp file + atomic rename. If the file does not exist, no-op.
    fn rewrite_user_profile(
        profile_store: &UserProfileStore,
        profile_data_dir: &Path,
        old_key: &[u8],
        new_key: &[u8],
    ) -> Result<(), Box<dyn Error>> {
        let path = profile_store.profile_path();
        if !path.exists() {
            return Ok(());
        }
        let blob = std::fs::read(path)?;
        let plaintext = PiiEncryption::decrypt_with_key(&blob, old_key)?;
        let new_blob = PiiEncryption::encrypt_with_key(&plaintext, new_key)?;
        let tmp_path: PathBuf = profile_data_dir.join("user_profile.enc.tmp");
        std::fs::write(&tmp_path, &new_blob)?;
        std::fs::rename(&tmp_path, path)?;
        Ok(())
    }

    /// On startup: if a pending-swap file exists, the previous run finished
    /// re-encrypting the vault but did not finish persisting the new key in
    /// custody. Try to finish that swap now.
    ///
    /// Returns Ok(true) if a swap was completed, Ok(false) if no marker existed,
    /// Err if the marker was malformed and we could not recover.
    pub fn recover_pending_swap(
        profile_data_dir: &Path,
        key_manager: &Arc<Mutex<EncryptionKeyManager>>,
    ) -> Result<bool, Box<dyn Error>> {
        let pending_path = profile_data_dir.join(PENDING_SWAP_FILENAME);
        if !pending_path.exists() {
            return Ok(false);
        }

        let bytes = std::fs::read(&pending_path)?;
        if bytes.len() != 32 {
            return Err(format!(
                "Pending-swap file has {} bytes, expected 32. Refusing to recover; manual intervention required.",
                bytes.len()
            )
            .into());
        }

        let mut km = key_manager.lock().map_err(|e| format!("Mutex poisoned: {e}"))?;
        info!("Pending key swap detected; completing custody swap.");
        km.replace_key(bytes)?;
        // Best effort; remove marker.
        if let Err(e) = std::fs::remove_file(&pending_path) {
            warn!("Could not remove pending-swap marker after recovery: {}", e);
        }
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::KeyCustody;
    use crate::user_profile::{UserProfile, UserProfileStore};
    use rusqlite::Connection;
    use tempfile::tempdir;

    fn make_km(tmp: &Path, file_name: &str) -> EncryptionKeyManager {
        let custody = KeyCustody::FileFallback {
            path: tmp.join(file_name),
        };
        let key = (0..32).map(|i| i as u8).collect::<Vec<u8>>();
        custody.store(&key).unwrap();
        EncryptionKeyManager::from_parts(key, custody).unwrap()
    }

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::create_schema(&conn).unwrap();
        // run_migrations is idempotent; safe to call after schema creation.
        let _ = crate::db::run_migrations(&conn);
        conn
    }

    fn random_key() -> [u8; 32] {
        use rand::RngCore;
        let mut k = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut k);
        k
    }

    #[test]
    fn rotation_re_encrypts_user_profile() {
        let tmp = tempdir().unwrap();
        let mut conn = open_test_db();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());
        let mut km = make_km(tmp.path(), "rot1.key");

        // Save a profile with the original key.
        let profile = UserProfile {
            id: "u".into(),
            full_name: Some("Jan Jansen".into()),
            bsn: Some("123456789".into()),
            ..Default::default()
        };
        store.save(&profile, &km).unwrap();

        // Rotate.
        let new_key = random_key();
        let result = KeyRotator::rotate(&mut conn, &store, tmp.path(), &mut km, new_key).unwrap();
        assert_ne!(result.old_fingerprint, result.new_fingerprint);

        // Loading with the rotated manager must still succeed.
        let loaded = store.load(&km).unwrap();
        assert_eq!(loaded.full_name.as_deref(), Some("Jan Jansen"));
        assert_eq!(loaded.bsn.as_deref(), Some("123456789"));
    }

    #[test]
    fn rotation_re_encrypts_pii_values() {
        let tmp = tempdir().unwrap();
        let mut conn = open_test_db();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());
        let mut km = make_km(tmp.path(), "rot2.key");

        // Insert a household + person + pii_value (encrypted with the original key).
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::create_household(
            &conn,
            &crate::db::Household {
                id: "h".into(),
                name: "h".into(),
                primary_person_id: "p".into(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .unwrap();
        crate::db::create_person(
            &conn,
            &crate::db::Person {
                id: "p".into(),
                household_id: "h".into(),
                name: "Jan".into(),
                relationship: "self".into(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .unwrap();
        let blob = PiiEncryption::encrypt("123456789", &km).unwrap();
        crate::db::add_pii_value(
            &conn,
            &crate::db::PiiValue {
                id: "v1".into(),
                person_id: "p".into(),
                category: "bsn".into(),
                value_encrypted: blob,
                source_document: None,
                confidence_score: 1.0,
                is_encrypted: true,
                created_at: now,
            },
        )
        .unwrap();

        // Rotate.
        let new_key = random_key();
        let result = KeyRotator::rotate(&mut conn, &store, tmp.path(), &mut km, new_key).unwrap();
        assert!(result.records_re_encrypted >= 1);

        // Decryption with the rotated manager works for the original plaintext.
        let pii = crate::db::get_pii_values_for_person(&conn, "p").unwrap();
        assert_eq!(pii.len(), 1);
        let pt = PiiEncryption::decrypt(&pii[0].value_encrypted, &km).unwrap();
        assert_eq!(pt, "123456789");
    }

    #[test]
    fn rotation_refuses_identical_key() {
        let tmp = tempdir().unwrap();
        let mut conn = open_test_db();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());
        let mut km = make_km(tmp.path(), "rot3.key");

        let same: [u8; 32] = km.get_key().try_into().unwrap();
        let res = KeyRotator::rotate(&mut conn, &store, tmp.path(), &mut km, same);
        assert!(res.is_err(), "identical-key rotation must be rejected");
    }

    #[test]
    fn pending_swap_recovery_completes_swap() {
        let tmp = tempdir().unwrap();
        let km = make_km(tmp.path(), "rot4.key");
        let arc_km = Arc::new(Mutex::new(km));

        // No marker → returns Ok(false), no change.
        assert!(!KeyRotator::recover_pending_swap(tmp.path(), &arc_km).unwrap());

        // Write a marker with a known fresh key; recovery should swap.
        let new_key = (1u8..=32).collect::<Vec<u8>>();
        std::fs::write(tmp.path().join(PENDING_SWAP_FILENAME), &new_key).unwrap();
        let recovered = KeyRotator::recover_pending_swap(tmp.path(), &arc_km).unwrap();
        assert!(recovered);
        assert_eq!(arc_km.lock().unwrap().get_key(), new_key.as_slice());
        assert!(!tmp.path().join(PENDING_SWAP_FILENAME).exists());
    }

    #[test]
    fn pending_swap_recovery_rejects_malformed_marker() {
        let tmp = tempdir().unwrap();
        let km = make_km(tmp.path(), "rot5.key");
        let arc_km = Arc::new(Mutex::new(km));

        std::fs::write(tmp.path().join(PENDING_SWAP_FILENAME), b"too short").unwrap();
        let r = KeyRotator::recover_pending_swap(tmp.path(), &arc_km);
        assert!(r.is_err());
    }

    #[test]
    fn rotation_handles_empty_vault() {
        let tmp = tempdir().unwrap();
        let mut conn = open_test_db();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());
        let mut km = make_km(tmp.path(), "rot6.key");

        let new_key = random_key();
        let result = KeyRotator::rotate(&mut conn, &store, tmp.path(), &mut km, new_key).unwrap();
        assert_eq!(result.records_re_encrypted, 0);
        assert_ne!(result.old_fingerprint, result.new_fingerprint);
    }
}
