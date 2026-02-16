use crate::db::PiiMapping;
use crate::ollama::PIIExtraction;
use uuid::Uuid;
use chrono::Utc;
use log::{info, warn};
use regex::Regex;

/// Minimum confidence score for PII to be considered valid
pub const DEFAULT_CONFIDENCE_THRESHOLD: f32 = 0.7;

/// Anonymization service for PII replacement
pub struct AnonymizationService {
    // Cache of regex patterns for common Dutch PII types
    bsn_pattern: Regex,
    phone_pattern: Regex,
    iban_pattern: Regex,
    postcode_pattern: Regex,
    email_pattern: Regex,
    // Amount patterns (for income, salary, etc.)
    euro_amount_pattern: Regex,
    // Confidence threshold for accepting LLM extractions
    confidence_threshold: f32,
}

impl AnonymizationService {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Self::with_confidence_threshold(DEFAULT_CONFIDENCE_THRESHOLD)
    }

    pub fn with_confidence_threshold(threshold: f32) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(AnonymizationService {
            // Dutch BSN pattern: 9 digits (with optional formatting)
            bsn_pattern: Regex::new(r"\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b")?,
            // Dutch phone patterns: +31, 0031, 06, 06-, etc.
            phone_pattern: Regex::new(r"(?:\+|00)31\s?[1-9][\s-]?\d{8}|0\s?[1-9][\s-]?\d{8}|06[\s-]?\d{8}")?,
            // Dutch IBAN pattern: NL followed by 16 characters
            iban_pattern: Regex::new(r"\bNL\s?\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2}\b")?,
            // Dutch postcode pattern: 4 digits + 2 letters
            postcode_pattern: Regex::new(r"\b\d{4}\s?[A-Z]{2}\b")?,
            // Email pattern
            email_pattern: Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")?,
            // Euro amounts with various formats
            euro_amount_pattern: Regex::new(r"€\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s?(?:euro|EUR)")?,
            confidence_threshold: threshold,
        })
    }

    /// Check if extraction confidence meets threshold
    fn meets_confidence_threshold(&self, confidence: f32) -> bool {
        confidence >= self.confidence_threshold
    }

    /// Check confidence and log warning if below threshold
    fn check_confidence(&self, field: &str, confidence: f32, value: &Option<String>) -> bool {
        if value.is_none() {
            return false;
        }
        if !self.meets_confidence_threshold(confidence) {
            warn!(
                "PII field '{}' confidence ({:.2}) below threshold ({:.2}), skipping extraction",
                field, confidence, self.confidence_threshold
            );
            return false;
        }
        true
    }

    /// Anonymize text by replacing PII with placeholders
    /// Only processes PII fields that meet the confidence threshold
    pub fn anonymize_text(
        &self,
        text: &str,
        pii_extraction: &PIIExtraction,
        conversation_id: &str,
    ) -> (String, Vec<PiiMapping>) {
        info!("Starting anonymization process for conversation: {}", conversation_id);

        let mut anonymized_text = text.to_string();
        let mut mappings = Vec::new();
        let confidence = &pii_extraction.confidence_scores;

        // Process each extracted PII field (only if confidence meets threshold)
        if self.check_confidence("bsn", confidence.bsn, &pii_extraction.bsn) {
            if let Some(bsn) = &pii_extraction.bsn {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, bsn, "bsn", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        if self.check_confidence("name", confidence.name, &pii_extraction.name) {
            if let Some(name) = &pii_extraction.name {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, name, "name", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        if self.check_confidence("surname", confidence.surname, &pii_extraction.surname) {
            if let Some(surname) = &pii_extraction.surname {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, surname, "surname", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        if self.check_confidence("phone", confidence.phone, &pii_extraction.phone) {
            if let Some(phone) = &pii_extraction.phone {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, phone, "phone", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        if self.check_confidence("address", confidence.address, &pii_extraction.address) {
            if let Some(address) = &pii_extraction.address {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, address, "address", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        if self.check_confidence("email", confidence.email, &pii_extraction.email) {
            if let Some(email) = &pii_extraction.email {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, email, "email", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        if self.check_confidence("income", confidence.income, &pii_extraction.income) {
            if let Some(income) = &pii_extraction.income {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &anonymized_text, income, "income", conversation_id,
                );
                anonymized_text = new_text;
                mappings.push(mapping);
            }
        }

        // Second pass: use regex to catch any PII missed by LLM
        let (final_text, regex_mappings) = self.regex_fallback_anonymization(&anonymized_text, conversation_id);
        anonymized_text = final_text;
        mappings.extend(regex_mappings);

        info!("Anonymization completed: {} mappings created", mappings.len());

        (anonymized_text, mappings)
    }

    /// Fallback: use regex patterns to catch any PII that the LLM missed
    fn regex_fallback_anonymization(&self, text: &str, conversation_id: &str) -> (String, Vec<PiiMapping>) {
        let mut result = text.to_string();
        let mut mappings = Vec::new();

        // Find and replace BSN patterns
        for capture in self.bsn_pattern.find_iter(text) {
            let value = capture.as_str();
            // Skip if it's already a placeholder
            if !text[..capture.start()].ends_with("[PLACEHOLDER_") {
                let (new_text, mapping) = self.create_mapping_and_replace(
                    &result, value, "bsn_regex", conversation_id,
                );
                result = new_text;
                mappings.push(mapping);
                info!("Regex fallback caught BSN pattern: [REDACTED]");
            }
        }

        // Find and replace IBAN patterns
        for capture in self.iban_pattern.find_iter(&result.clone()) {
            let value = capture.as_str();
            let (new_text, mapping) = self.create_mapping_and_replace(
                &result, value, "iban_regex", conversation_id,
            );
            result = new_text;
            mappings.push(mapping);
            info!("Regex fallback caught IBAN pattern: [REDACTED]");
        }

        // Find and replace euro amount patterns (only large amounts > €1000)
        for capture in self.euro_amount_pattern.find_iter(&result.clone()) {
            let value = capture.as_str();
            // Only anonymize amounts that look like income/salary (>1000)
            let amount_str = value.replace(['€', ' ', '.', ',', 'e', 'u', 'r', 'o', 'E', 'U', 'R'], "");
            if let Ok(amount) = amount_str.parse::<i64>() {
                if amount > 1000 {
                    let (new_text, mapping) = self.create_mapping_and_replace(
                        &result, value, "amount_regex", conversation_id,
                    );
                    result = new_text;
                    mappings.push(mapping);
                    info!("Regex fallback caught large euro amount: [REDACTED]");
                }
            }
        }

        (result, mappings)
    }

    /// De-anonymize text by replacing placeholders with original values
    pub fn deanonymize_text(
        &self,
        anonymized_text: &str,
        mappings: &[PiiMapping],
    ) -> String {
        let mut deanonymized_text = anonymized_text.to_string();

        for mapping in mappings {
            // Replace placeholder with [PII_CATEGORY] for now
            // In production, this would decrypt the PII value
            let placeholder_pattern = format!(r"\[PLACEHOLDER_{}_{}\]", mapping.pii_category.to_uppercase(), mapping.placeholder);
            deanonymized_text = deanonymized_text.replace(&placeholder_pattern, &format!("[{}]", mapping.pii_category));
        }

        deanonymized_text
    }

    /// Validate that anonymization was successful (no common PII patterns remain)
    /// This is a CRITICAL safety gate - fails closed (returns unsafe if any pattern found)
    pub fn validate_anonymization(&self, text: &str) -> AnonymizationValidation {
        let mut found_pii_patterns = Vec::new();
        let mut risk_level = RiskLevel::Safe;

        // HIGH RISK: BSN patterns (unique identifier)
        if self.bsn_pattern.is_match(text) {
            found_pii_patterns.push("Dutch BSN (9-digit number)");
            risk_level = RiskLevel::High;
        }

        // HIGH RISK: IBAN patterns (financial identifier)
        if self.iban_pattern.is_match(text) {
            found_pii_patterns.push("Dutch IBAN");
            risk_level = RiskLevel::High;
        }

        // MEDIUM RISK: Phone patterns
        if self.phone_pattern.is_match(text) {
            found_pii_patterns.push("Dutch phone number");
            if risk_level != RiskLevel::High {
                risk_level = RiskLevel::Medium;
            }
        }

        // MEDIUM RISK: Email patterns
        if self.email_pattern.is_match(text) {
            found_pii_patterns.push("Email address");
            if risk_level != RiskLevel::High {
                risk_level = RiskLevel::Medium;
            }
        }

        // LOW RISK: Postcode (common, less identifying)
        if self.postcode_pattern.is_match(text) {
            found_pii_patterns.push("Dutch postcode");
            if risk_level == RiskLevel::Safe {
                risk_level = RiskLevel::Low;
            }
        }

        // LOW RISK: Large euro amounts
        for capture in self.euro_amount_pattern.find_iter(text) {
            let value = capture.as_str();
            let amount_str = value.replace(['€', ' ', '.', ',', 'e', 'u', 'r', 'o', 'E', 'U', 'R'], "");
            if let Ok(amount) = amount_str.parse::<i64>() {
                if amount > 10000 {
                    found_pii_patterns.push("Large euro amount (>€10k)");
                    if risk_level == RiskLevel::Safe {
                        risk_level = RiskLevel::Low;
                    }
                    break;
                }
            }
        }

        AnonymizationValidation {
            is_safe: found_pii_patterns.is_empty(),
            found_patterns: found_pii_patterns,
            risk_level,
        }
    }

    /// Strict validation - fails if ANY identifiable pattern found
    /// Use this for "required" anonymization mode
    pub fn validate_strict(&self, text: &str) -> bool {
        let validation = self.validate_anonymization(text);
        validation.is_safe
    }

    /// Lenient validation - only fails for HIGH risk patterns
    /// Use this for "optional" anonymization mode
    pub fn validate_lenient(&self, text: &str) -> bool {
        let validation = self.validate_anonymization(text);
        validation.risk_level != RiskLevel::High
    }

    fn create_mapping_and_replace(
        &self,
        text: &str,
        pii_value: &str,
        pii_category: &str,
        conversation_id: &str,
    ) -> (String, PiiMapping) {
        let placeholder = Uuid::new_v4().to_string();
        let mapping_id = Uuid::new_v4().to_string();

        // For now, we'll use a simple placeholder format
        // In production, PII value would be encrypted
        let placeholder_text = format!("[PLACEHOLDER_{}_{}]", pii_category.to_uppercase(), placeholder);
        let new_text = text.replace(pii_value, &placeholder_text);

        let mapping = PiiMapping {
            id: mapping_id,
            conversation_id: conversation_id.to_string(),
            pii_category: pii_category.to_string(),
            pii_value_encrypted: Vec::new(), // Would be encrypted in production
            placeholder: placeholder.clone(),
            is_encrypted: false, // Would be true in production
            created_at: Utc::now().to_rfc3339(),
        };

        (new_text, mapping)
    }
}

/// Risk levels for PII detection
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RiskLevel {
    /// No PII patterns found
    Safe,
    /// Low-risk patterns (postcodes, small amounts)
    Low,
    /// Medium-risk patterns (phone, email)
    Medium,
    /// High-risk patterns (BSN, IBAN)
    High,
}

#[derive(Debug, Clone)]
pub struct AnonymizationValidation {
    pub is_safe: bool,
    pub found_patterns: Vec<&'static str>,
    pub risk_level: RiskLevel,
}

impl AnonymizationValidation {
    /// Can this text be sent to cloud with "optional" mode?
    pub fn is_acceptable_for_optional(&self) -> bool {
        self.risk_level != RiskLevel::High
    }

    /// Can this text be sent to cloud with "required" mode?
    pub fn is_acceptable_for_required(&self) -> bool {
        self.is_safe
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anonymization_service_creation() {
        let service = AnonymizationService::new();
        assert!(service.is_ok());
    }

    #[test]
    fn test_bsn_pattern_detection() {
        let service = AnonymizationService::new().unwrap();
        let text = "My BSN is 123456789 and my phone is 0612345678";
        let validation = service.validate_anonymization(text);
        assert!(!validation.is_safe);
        assert!(validation.found_patterns.contains(&"Dutch BSN (9-digit number)"));
    }

    #[test]
    fn test_email_pattern_detection() {
        let service = AnonymizationService::new().unwrap();
        let text = "Contact me at jan@example.com";
        let validation = service.validate_anonymization(text);
        assert!(!validation.is_safe);
        assert!(validation.found_patterns.contains(&"Email address"));
    }

    #[test]
    fn test_safe_text_validation() {
        let service = AnonymizationService::new().unwrap();
        let text = "This is a safe text with no personal information";
        let validation = service.validate_anonymization(text);
        assert!(validation.is_safe);
        assert!(validation.found_patterns.is_empty());
    }
}
