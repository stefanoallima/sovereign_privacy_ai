/**
 * Attribute Extraction Module
 *
 * Privacy-first approach: Instead of sending anonymized text to cloud,
 * extract only non-identifying attributes (income bracket, employment type, etc.)
 *
 * This reduces:
 * 1. Token count (cost savings)
 * 2. Context leakage (rare job + city = identifiable)
 * 3. Attack surface for PII extraction
 */

use crate::ollama::OllamaClient;
use serde::{Deserialize, Serialize};
use log::info;
use std::error::Error;

/// Privacy-safe attributes extracted from user context
/// These are categorical/bucketed values that cannot identify an individual
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaxAttributes {
    // Income & Employment
    pub income_bracket: Option<IncomeBracket>,
    pub employment_type: Option<EmploymentType>,
    pub has_multiple_employers: Option<bool>,
    pub receives_benefits: Option<bool>,

    // Housing & Assets
    pub housing_situation: Option<HousingSituation>,
    pub has_mortgage: Option<bool>,
    pub has_savings_above_threshold: Option<bool>,  // >€57k (Box 3 threshold)
    pub has_investments: Option<bool>,

    // Family & Filing
    pub filing_status: Option<FilingStatus>,
    pub has_dependents: Option<bool>,
    pub has_fiscal_partner: Option<bool>,

    // Special Situations
    pub has_30_percent_ruling: Option<bool>,
    pub is_entrepreneur: Option<bool>,
    pub has_foreign_income: Option<bool>,
    pub has_crypto_assets: Option<bool>,

    // Tax-specific
    pub relevant_boxes: Vec<String>,  // ["Box 1", "Box 3"]
    pub deduction_categories: Vec<String>,  // ["mortgage_interest", "healthcare"]
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IncomeBracket {
    Below20k,
    Range20kTo40k,
    Range40kTo70k,
    Range70kTo100k,
    Above100k,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EmploymentType {
    Employee,
    Freelancer,
    Entrepreneur,  // ZZP/Eenmanszaak
    Director,      // DGA
    Retired,
    Student,
    Unemployed,
    Mixed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HousingSituation {
    Owner,
    Renter,
    LivingWithParents,
    SocialHousing,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FilingStatus {
    Single,
    Married,
    RegisteredPartner,
    Cohabiting,
    Divorced,
    Widowed,
    Unknown,
}

/// Attribute extractor using local Ollama
pub struct AttributeExtractor {
    confidence_threshold: f32,
}

impl AttributeExtractor {
    pub fn new() -> Self {
        AttributeExtractor {
            confidence_threshold: 0.7,
        }
    }

    pub fn with_threshold(threshold: f32) -> Self {
        AttributeExtractor {
            confidence_threshold: threshold,
        }
    }

    /// Extract privacy-safe attributes from text using local LLM
    pub async fn extract_attributes(
        &self,
        text: &str,
        ollama_client: &OllamaClient,
    ) -> Result<TaxAttributes, Box<dyn Error + Send + Sync>> {
        info!("Extracting tax attributes from text (length: {} chars)", text.len());

        let prompt = self.build_extraction_prompt(text);

        // Use Ollama locally to extract attributes
        let response = ollama_client.generate_json(&prompt).await?;

        // Parse the JSON response into TaxAttributes
        let attributes: TaxAttributes = serde_json::from_str(&response)
            .unwrap_or_else(|e| {
                info!("Failed to parse attributes JSON: {}, using defaults", e);
                TaxAttributes::default()
            });

        info!("Extracted attributes: {:?}", attributes);
        Ok(attributes)
    }

    /// Build prompt for attribute extraction (local LLM)
    fn build_extraction_prompt(&self, text: &str) -> String {
        format!(r#"Analyze the following text about a Dutch taxpayer and extract ONLY categorical attributes.
DO NOT extract any names, addresses, specific amounts, or identifying information.

Text to analyze:
---
{}
---

Output a JSON object with these fields (use null if unknown):
{{
  "income_bracket": "below_20k" | "20k_to_40k" | "40k_to_70k" | "70k_to_100k" | "above_100k" | null,
  "employment_type": "employee" | "freelancer" | "entrepreneur" | "director" | "retired" | "student" | "unemployed" | "mixed" | null,
  "has_multiple_employers": true | false | null,
  "receives_benefits": true | false | null,
  "housing_situation": "owner" | "renter" | "living_with_parents" | "social_housing" | null,
  "has_mortgage": true | false | null,
  "has_savings_above_threshold": true | false | null,
  "has_investments": true | false | null,
  "filing_status": "single" | "married" | "registered_partner" | "cohabiting" | "divorced" | "widowed" | null,
  "has_dependents": true | false | null,
  "has_fiscal_partner": true | false | null,
  "has_30_percent_ruling": true | false | null,
  "is_entrepreneur": true | false | null,
  "has_foreign_income": true | false | null,
  "has_crypto_assets": true | false | null,
  "relevant_boxes": ["Box 1", "Box 3"],
  "deduction_categories": ["mortgage_interest", "healthcare", "study_costs"]
}}

Output ONLY valid JSON, no explanation:"#, text)
    }

    /// Convert attributes to a privacy-safe prompt for cloud LLM
    pub fn attributes_to_prompt(&self, attributes: &TaxAttributes, question: &str) -> String {
        let mut context_parts = Vec::new();

        // Income & Employment
        if let Some(ref bracket) = attributes.income_bracket {
            context_parts.push(format!("income bracket: {:?}", bracket));
        }
        if let Some(ref emp_type) = attributes.employment_type {
            context_parts.push(format!("employment: {:?}", emp_type));
        }
        if attributes.has_multiple_employers == Some(true) {
            context_parts.push("has multiple employers".to_string());
        }
        if attributes.receives_benefits == Some(true) {
            context_parts.push("receives government benefits".to_string());
        }

        // Housing
        if let Some(ref housing) = attributes.housing_situation {
            context_parts.push(format!("housing: {:?}", housing));
        }
        if attributes.has_mortgage == Some(true) {
            context_parts.push("has mortgage".to_string());
        }
        if attributes.has_savings_above_threshold == Some(true) {
            context_parts.push("savings above Box 3 threshold".to_string());
        }
        if attributes.has_investments == Some(true) {
            context_parts.push("has investments".to_string());
        }

        // Family
        if let Some(ref status) = attributes.filing_status {
            context_parts.push(format!("filing status: {:?}", status));
        }
        if attributes.has_dependents == Some(true) {
            context_parts.push("has dependents".to_string());
        }
        if attributes.has_fiscal_partner == Some(true) {
            context_parts.push("has fiscal partner".to_string());
        }

        // Special
        if attributes.has_30_percent_ruling == Some(true) {
            context_parts.push("has 30% ruling".to_string());
        }
        if attributes.is_entrepreneur == Some(true) {
            context_parts.push("is entrepreneur/ZZP".to_string());
        }
        if attributes.has_foreign_income == Some(true) {
            context_parts.push("has foreign income".to_string());
        }
        if attributes.has_crypto_assets == Some(true) {
            context_parts.push("has cryptocurrency assets".to_string());
        }

        // Boxes
        if !attributes.relevant_boxes.is_empty() {
            context_parts.push(format!("relevant tax boxes: {}", attributes.relevant_boxes.join(", ")));
        }

        // Deductions
        if !attributes.deduction_categories.is_empty() {
            context_parts.push(format!("potential deductions: {}", attributes.deduction_categories.join(", ")));
        }

        let context = if context_parts.is_empty() {
            "a Dutch taxpayer".to_string()
        } else {
            format!("a Dutch taxpayer with the following profile:\n- {}", context_parts.join("\n- "))
        };

        format!(
            "Context: {}\n\nQuestion: {}\n\nProvide advice based on Dutch tax law (Belastingdienst rules). Be specific about which tax boxes apply and any relevant deductions or exemptions.",
            context,
            question
        )
    }
}

/// Extract just the question/intent from user input (strip context)
pub fn extract_question_only(text: &str) -> String {
    // Look for question patterns
    let question_indicators = ["?", "how", "what", "when", "where", "why", "can i", "should i", "do i", "is it"];

    let sentences: Vec<&str> = text.split(|c| c == '.' || c == '?' || c == '!').collect();

    // Find sentences that look like questions
    let questions: Vec<&str> = sentences
        .iter()
        .filter(|s| {
            let lower = s.to_lowercase();
            question_indicators.iter().any(|ind| lower.contains(ind))
        })
        .copied()
        .collect();

    if questions.is_empty() {
        // No clear question found, return last sentence as likely intent
        sentences.last().unwrap_or(&text).trim().to_string()
    } else {
        questions.join(". ").trim().to_string()
    }
}

/// Confidence levels for attribute extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttributeConfidence {
    pub overall: f32,
    pub income: f32,
    pub employment: f32,
    pub housing: f32,
    pub family: f32,
}

impl Default for AttributeConfidence {
    fn default() -> Self {
        AttributeConfidence {
            overall: 0.0,
            income: 0.0,
            employment: 0.0,
            housing: 0.0,
            family: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_question_only() {
        let input = "I am Jan from Amsterdam. I earn 50000 euros per year. Can I deduct my mortgage interest?";
        let question = extract_question_only(input);
        assert!(question.contains("mortgage interest"));
    }

    #[test]
    fn test_attributes_to_prompt() {
        let extractor = AttributeExtractor::new();
        let mut attrs = TaxAttributes::default();
        attrs.income_bracket = Some(IncomeBracket::Range40kTo70k);
        attrs.employment_type = Some(EmploymentType::Employee);
        attrs.has_mortgage = Some(true);

        let prompt = extractor.attributes_to_prompt(&attrs, "Can I deduct mortgage interest?");

        assert!(prompt.contains("40kTo70k") || prompt.contains("40k"));
        assert!(prompt.contains("Employee") || prompt.contains("employee"));
        assert!(prompt.contains("mortgage"));
        assert!(!prompt.contains("Jan")); // No names
        assert!(!prompt.contains("50000")); // No specific amounts
    }

    #[test]
    fn test_default_attributes() {
        let attrs = TaxAttributes::default();
        assert!(attrs.income_bracket.is_none());
        assert!(attrs.relevant_boxes.is_empty());
    }
}
