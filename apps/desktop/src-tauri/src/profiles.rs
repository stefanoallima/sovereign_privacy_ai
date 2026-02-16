use crate::db::{Household, Person, PiiValue};
use crate::crypto::{EncryptionKeyManager, PiiEncryption};
use std::error::Error;
use chrono::Utc;
use uuid::Uuid;
use log::{info, error};

/// Profile data aggregation and retrieval
pub struct PersonProfile {
    pub person: Person,
    pub pii_values: Vec<PiiValueDecrypted>,
}

#[derive(Debug, Clone)]
pub struct PiiValueDecrypted {
    pub id: String,
    pub category: String,
    pub value: String, // Decrypted
    pub source_document: Option<String>,
    pub confidence_score: f32,
}

pub struct HouseholdProfile {
    pub household: Household,
    pub persons: Vec<PersonProfile>,
}

/// Profile repository for managing household and personal data
pub struct ProfileRepository;

impl ProfileRepository {
    /// Get aggregated profile for a person (with decrypted PII)
    pub fn get_person_profile(
        person: Person,
        pii_values: &[PiiValue],
        encryption_key: &EncryptionKeyManager,
    ) -> Result<PersonProfile, Box<dyn Error>> {
        info!("Building profile for person: {}", person.name);

        let mut decrypted_pii = Vec::new();

        for pii_value in pii_values {
            let value = if pii_value.is_encrypted {
                match PiiEncryption::decrypt(&pii_value.value_encrypted, encryption_key) {
                    Ok(v) => v,
                    Err(e) => {
                        error!("Failed to decrypt PII value: {}", e);
                        "[DECRYPTION_FAILED]".to_string()
                    }
                }
            } else {
                String::from_utf8_lossy(&pii_value.value_encrypted).to_string()
            };

            decrypted_pii.push(PiiValueDecrypted {
                id: pii_value.id.clone(),
                category: pii_value.category.clone(),
                value,
                source_document: pii_value.source_document.clone(),
                confidence_score: pii_value.confidence_score,
            });
        }

        Ok(PersonProfile {
            person,
            pii_values: decrypted_pii,
        })
    }

    /// Check which PII categories are present for a person
    pub fn get_pii_summary(
        pii_values: &[PiiValueDecrypted],
    ) -> PiiSummary {
        let mut summary = PiiSummary {
            bsn: false,
            name: false,
            phone: false,
            address: false,
            email: false,
            income: false,
            categories_count: 0,
        };

        for pii in pii_values {
            match pii.category.as_str() {
                "bsn" => summary.bsn = true,
                "name" => summary.name = true,
                "phone" => summary.phone = true,
                "address" => summary.address = true,
                "email" => summary.email = true,
                "income" => summary.income = true,
                _ => {}
            }
        }

        summary.categories_count = vec![
            summary.bsn, summary.name, summary.phone,
            summary.address, summary.email, summary.income
        ]
        .iter()
        .filter(|&&b| b)
        .count();

        summary
    }

    /// Create a new PII value (encrypted)
    pub fn create_pii_value(
        person_id: &str,
        category: &str,
        value: &str,
        source_document: Option<String>,
        confidence_score: f32,
        encryption_key: &EncryptionKeyManager,
    ) -> Result<PiiValue, Box<dyn Error>> {
        info!("Creating PII value for person: {} (category: {})", person_id, category);

        let encrypted_value = PiiEncryption::encrypt(value, encryption_key)?;

        Ok(PiiValue {
            id: Uuid::new_v4().to_string(),
            person_id: person_id.to_string(),
            category: category.to_string(),
            value_encrypted: encrypted_value,
            source_document,
            confidence_score,
            is_encrypted: true,
            created_at: Utc::now().to_rfc3339(),
        })
    }

    /// Validate that required PII fields are present
    pub fn validate_pii_completeness(
        pii_values: &[PiiValueDecrypted],
        required_fields: &[&str],
    ) -> ValidationResult {
        let present_categories: std::collections::HashSet<_> =
            pii_values.iter().map(|p| p.category.as_str()).collect();

        let mut missing = Vec::new();
        for required in required_fields {
            if !present_categories.contains(required) {
                missing.push(required.to_string());
            }
        }

        ValidationResult {
            is_complete: missing.is_empty(),
            missing_fields: missing,
        }
    }

    /// Get PII value masked for display (show only last 4 chars)
    pub fn mask_pii_value(category: &str, value: &str) -> String {
        match category {
            "bsn" | "phone" => {
                // Show as ●●●●●-12345
                let visible_chars = value.len().saturating_sub(4);
                let masks = "●".repeat(visible_chars.min(6));
                let visible = &value[visible_chars.max(0)..];
                format!("{}-{}", masks, visible)
            }
            "email" => {
                // Show as j***@example.com
                let parts: Vec<&str> = value.split('@').collect();
                if parts.len() == 2 {
                    let name = parts[0];
                    let domain = parts[1];
                    let visible = if name.len() > 0 {
                        &name[0..1]
                    } else {
                        ""
                    };
                    format!("{}***@{}", visible, domain)
                } else {
                    "***@***".to_string()
                }
            }
            "address" => {
                // Show first word + ...
                let words: Vec<&str> = value.split_whitespace().collect();
                if !words.is_empty() {
                    format!("{}... ({})", words[0], words.len())
                } else {
                    "●●●●●●".to_string()
                }
            }
            _ => {
                // For name, income, etc. - show as is
                value.to_string()
            }
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PiiSummary {
    pub bsn: bool,
    pub name: bool,
    pub phone: bool,
    pub address: bool,
    pub email: bool,
    pub income: bool,
    pub categories_count: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ValidationResult {
    pub is_complete: bool,
    pub missing_fields: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pii_summary_creation() {
        let pii_values = vec![
            PiiValueDecrypted {
                id: "1".to_string(),
                category: "bsn".to_string(),
                value: "123456789".to_string(),
                source_document: None,
                confidence_score: 1.0,
            },
            PiiValueDecrypted {
                id: "2".to_string(),
                category: "name".to_string(),
                value: "Jan".to_string(),
                source_document: None,
                confidence_score: 1.0,
            },
        ];

        let summary = ProfileRepository::get_pii_summary(&pii_values);
        assert!(summary.bsn);
        assert!(summary.name);
        assert!(!summary.phone);
        assert_eq!(summary.categories_count, 2);
    }

    #[test]
    fn test_pii_validation_completeness() {
        let pii_values = vec![
            PiiValueDecrypted {
                id: "1".to_string(),
                category: "bsn".to_string(),
                value: "123456789".to_string(),
                source_document: None,
                confidence_score: 1.0,
            },
        ];

        let required = vec!["bsn", "name"];
        let result = ProfileRepository::validate_pii_completeness(&pii_values, &required);

        assert!(!result.is_complete);
        assert_eq!(result.missing_fields, vec!["name"]);
    }

    #[test]
    fn test_pii_masking() {
        assert_eq!(
            ProfileRepository::mask_pii_value("bsn", "123456789"),
            "●●●●●-6789"
        );

        assert_eq!(
            ProfileRepository::mask_pii_value("email", "jan@example.com"),
            "j***@example.com"
        );

        let address_masked = ProfileRepository::mask_pii_value("address", "Straat 123 Amsterdam");
        assert!(address_masked.contains("Straat"));
        assert!(address_masked.contains("..."));
    }
}
