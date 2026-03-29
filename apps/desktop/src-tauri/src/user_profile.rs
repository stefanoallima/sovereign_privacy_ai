use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::crypto::{EncryptionKeyManager, PiiEncryption};

/// A custom redaction term that the user has defined for PII scrubbing.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CustomRedactTerm {
    pub label: String,
    pub value: String,
    pub replacement: String,
}

/// Physical address for a user profile.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileAddress {
    pub street: String,
    pub city: String,
    pub postal_code: String,
    pub country: String,
}

/// Core user profile containing PII fields that are encrypted at rest.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub full_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub bsn: Option<String>,
    pub nationality: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<UserProfileAddress>,
    pub employer_name: Option<String>,
    pub employment_type: Option<String>,
    pub job_title: Option<String>,
    pub income_bracket: Option<String>,
    pub bank_name: Option<String>,
    pub iban: Option<String>,
    pub custom_fields: HashMap<String, String>,
    #[serde(default)]
    pub custom_redact_terms: Vec<CustomRedactTerm>,
}

/// Encrypted-at-rest store for a single user profile.
pub struct UserProfileStore {
    profile_path: PathBuf,
}

impl UserProfileStore {
    /// Create a new store that persists to `<data_dir>/user_profile.enc`.
    pub fn new(data_dir: &PathBuf) -> Self {
        let profile_path = data_dir.join("user_profile.enc");
        Self { profile_path }
    }

    /// Serialize + encrypt + write the profile to disk.
    pub fn save(
        &self,
        profile: &UserProfile,
        key_manager: &EncryptionKeyManager,
    ) -> Result<(), String> {
        // Ensure the parent directory exists
        if let Some(parent) = self.profile_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create profile directory: {}", e))?;
        }

        let json = serde_json::to_string(profile)
            .map_err(|e| format!("Serialize error: {}", e))?;
        let encrypted = PiiEncryption::encrypt(&json, key_manager)
            .map_err(|e| format!("Encryption error: {}", e))?;
        fs::write(&self.profile_path, &encrypted)
            .map_err(|e| format!("Write error: {}", e))?;
        Ok(())
    }

    /// Read + decrypt + deserialize the profile from disk.
    /// Returns a default profile if the file does not exist yet.
    pub fn load(
        &self,
        key_manager: &EncryptionKeyManager,
    ) -> Result<UserProfile, String> {
        if !self.profile_path.exists() {
            return Ok(UserProfile {
                id: "default".to_string(),
                ..Default::default()
            });
        }
        let encrypted = fs::read(&self.profile_path)
            .map_err(|e| format!("Read error: {}", e))?;
        let json = PiiEncryption::decrypt(&encrypted, key_manager)
            .map_err(|e| format!("Decryption error: {}", e))?;
        let profile: UserProfile = serde_json::from_str(&json)
            .map_err(|e| format!("Deserialize error: {}", e))?;
        Ok(profile)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_save_and_load_roundtrip() {
        let tmp = TempDir::new().unwrap();
        let key_manager = EncryptionKeyManager::new().unwrap();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());

        let profile = UserProfile {
            id: "test-user".to_string(),
            full_name: Some("Jan Jansen".to_string()),
            bsn: Some("123456789".to_string()),
            email: Some("jan@example.nl".to_string()),
            address: Some(UserProfileAddress {
                street: "Keizersgracht 1".to_string(),
                city: "Amsterdam".to_string(),
                postal_code: "1015 AA".to_string(),
                country: "NL".to_string(),
            }),
            ..Default::default()
        };

        store.save(&profile, &key_manager).unwrap();
        let loaded = store.load(&key_manager).unwrap();

        assert_eq!(loaded.id, "test-user");
        assert_eq!(loaded.full_name.as_deref(), Some("Jan Jansen"));
        assert_eq!(loaded.bsn.as_deref(), Some("123456789"));
        assert_eq!(loaded.email.as_deref(), Some("jan@example.nl"));
        let addr = loaded.address.unwrap();
        assert_eq!(addr.city, "Amsterdam");
    }

    #[test]
    fn test_load_returns_default_when_no_file() {
        let tmp = TempDir::new().unwrap();
        let key_manager = EncryptionKeyManager::new().unwrap();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());

        let profile = store.load(&key_manager).unwrap();
        assert_eq!(profile.id, "default");
        assert!(profile.full_name.is_none());
    }

    #[test]
    fn test_save_load_round_trip_all_fields() {
        let tmp = TempDir::new().unwrap();
        let key_manager = EncryptionKeyManager::new().unwrap();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());

        let mut custom = HashMap::new();
        custom.insert("Tax ID".to_string(), "NL-12345".to_string());
        custom.insert("Favorite Color".to_string(), "Blue".to_string());

        let profile = UserProfile {
            id: "round-trip-user".to_string(),
            full_name: Some("Maria van der Berg".to_string()),
            date_of_birth: Some("1985-03-22".to_string()),
            bsn: Some("987654321".to_string()),
            nationality: Some("Dutch".to_string()),
            email: Some("maria@example.nl".to_string()),
            phone: Some("+31698765432".to_string()),
            address: Some(UserProfileAddress {
                street: "Prinsengracht 100".to_string(),
                city: "Amsterdam".to_string(),
                postal_code: "1015 DX".to_string(),
                country: "NL".to_string(),
            }),
            employer_name: Some("TechBV".to_string()),
            employment_type: Some("full-time".to_string()),
            job_title: Some("Data Scientist".to_string()),
            income_bracket: Some("60k-80k".to_string()),
            bank_name: Some("ING".to_string()),
            iban: Some("NL20INGB0001234567".to_string()),
            custom_fields: custom,
            ..Default::default()
        };

        store.save(&profile, &key_manager).unwrap();
        let loaded = store.load(&key_manager).unwrap();

        assert_eq!(loaded.id, "round-trip-user");
        assert_eq!(loaded.full_name.as_deref(), Some("Maria van der Berg"));
        assert_eq!(loaded.date_of_birth.as_deref(), Some("1985-03-22"));
        assert_eq!(loaded.bsn.as_deref(), Some("987654321"));
        assert_eq!(loaded.nationality.as_deref(), Some("Dutch"));
        assert_eq!(loaded.email.as_deref(), Some("maria@example.nl"));
        assert_eq!(loaded.phone.as_deref(), Some("+31698765432"));
        assert_eq!(loaded.employer_name.as_deref(), Some("TechBV"));
        assert_eq!(loaded.employment_type.as_deref(), Some("full-time"));
        assert_eq!(loaded.job_title.as_deref(), Some("Data Scientist"));
        assert_eq!(loaded.income_bracket.as_deref(), Some("60k-80k"));
        assert_eq!(loaded.bank_name.as_deref(), Some("ING"));
        assert_eq!(loaded.iban.as_deref(), Some("NL20INGB0001234567"));
    }

    #[test]
    fn test_load_nonexistent() {
        let tmp = TempDir::new().unwrap();
        let key_manager = EncryptionKeyManager::new().unwrap();
        // Point to a subdirectory that does not exist
        let sub = tmp.path().join("nonexistent_subdir");
        let store = UserProfileStore::new(&sub);

        let profile = store.load(&key_manager).unwrap();
        assert_eq!(profile.id, "default");
        assert!(profile.full_name.is_none());
        assert!(profile.bsn.is_none());
        assert!(profile.custom_fields.is_empty());
    }

    #[test]
    fn test_custom_fields_persist() {
        let tmp = TempDir::new().unwrap();
        let key_manager = EncryptionKeyManager::new().unwrap();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());

        let mut custom = HashMap::new();
        custom.insert("Hobby".to_string(), "Cycling".to_string());
        custom.insert("Pet Name".to_string(), "Buddy".to_string());
        custom.insert("Allergies".to_string(), "Peanuts".to_string());

        let profile = UserProfile {
            id: "custom-test".to_string(),
            custom_fields: custom,
            ..Default::default()
        };

        store.save(&profile, &key_manager).unwrap();
        let loaded = store.load(&key_manager).unwrap();

        assert_eq!(loaded.custom_fields.len(), 3);
        assert_eq!(loaded.custom_fields.get("Hobby").unwrap(), "Cycling");
        assert_eq!(loaded.custom_fields.get("Pet Name").unwrap(), "Buddy");
        assert_eq!(loaded.custom_fields.get("Allergies").unwrap(), "Peanuts");
    }

    #[test]
    fn test_address_round_trip() {
        let tmp = TempDir::new().unwrap();
        let key_manager = EncryptionKeyManager::new().unwrap();
        let store = UserProfileStore::new(&tmp.path().to_path_buf());

        let profile = UserProfile {
            id: "addr-test".to_string(),
            address: Some(UserProfileAddress {
                street: "Herengracht 555".to_string(),
                city: "Amsterdam".to_string(),
                postal_code: "1017 BW".to_string(),
                country: "NL".to_string(),
            }),
            ..Default::default()
        };

        store.save(&profile, &key_manager).unwrap();
        let loaded = store.load(&key_manager).unwrap();

        let addr = loaded.address.expect("address should be present");
        assert_eq!(addr.street, "Herengracht 555");
        assert_eq!(addr.city, "Amsterdam");
        assert_eq!(addr.postal_code, "1017 BW");
        assert_eq!(addr.country, "NL");
    }

}
