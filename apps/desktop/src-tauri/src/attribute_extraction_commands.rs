/**
 * Attribute Extraction Tauri Commands
 * Exposes privacy-first attribute extraction to the frontend
 *
 * These commands allow the frontend to:
 * 1. Extract tax attributes from user text (locally via embedded LLM)
 * 2. Generate privacy-safe prompts for cloud LLM
 * 3. Process chat messages with attribute-only mode
 */

use crate::attribute_extraction::{AttributeExtractor, TaxAttributes, extract_question_only};
use crate::inference::LocalInference;
use crate::backend_routing::{make_routing_decision, ContentMode, BackendDecision};
use crate::db::Persona;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;
use log::info;

/// State for attribute extraction (uses shared inference backend)
pub struct AttributeExtractionState {
    pub inference: Arc<dyn LocalInference>,
    pub extractor: AttributeExtractor,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttributeExtractionResponse {
    pub success: bool,
    pub attributes: Option<TaxAttributesJson>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaxAttributesJson {
    pub income_bracket: Option<String>,
    pub employment_type: Option<String>,
    pub has_multiple_employers: Option<bool>,
    pub receives_benefits: Option<bool>,
    pub housing_situation: Option<String>,
    pub has_mortgage: Option<bool>,
    pub has_savings_above_threshold: Option<bool>,
    pub has_investments: Option<bool>,
    pub filing_status: Option<String>,
    pub has_dependents: Option<bool>,
    pub has_fiscal_partner: Option<bool>,
    pub has_30_percent_ruling: Option<bool>,
    pub is_entrepreneur: Option<bool>,
    pub has_foreign_income: Option<bool>,
    pub has_crypto_assets: Option<bool>,
    pub relevant_boxes: Vec<String>,
    pub deduction_categories: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrivacySafePromptResponse {
    pub success: bool,
    pub prompt: Option<String>,
    pub question_only: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedChatRequest {
    /// The prompt to send to the LLM (may be full text or attributes-only)
    pub prompt: String,
    /// Which backend to use
    pub backend: String,
    /// Model to use
    pub model: Option<String>,
    /// Whether the request is safe to proceed
    pub is_safe: bool,
    /// Processing mode used
    pub content_mode: String,
    /// Any warnings or info
    pub info: Option<String>,
    /// Number of attributes extracted (if attributes-only mode)
    pub attributes_count: Option<usize>,
}

/// Extract tax attributes from user text using local inference
/// This is the privacy-first approach: extract categorical data locally
#[tauri::command]
pub async fn extract_tax_attributes(
    text: String,
    state: State<'_, Mutex<AttributeExtractionState>>,
) -> Result<AttributeExtractionResponse, String> {
    info!("Extracting tax attributes from text (length: {} chars)", text.len());

    let (inference, extractor) = {
        let guard = state.lock().await;
        (guard.inference.clone(), AttributeExtractor::new())
    };

    // Check if local inference is available
    if !inference.is_available().await {
        return Ok(AttributeExtractionResponse {
            success: false,
            attributes: None,
            error: Some("Local inference is not available. Cannot extract attributes locally.".to_string()),
        });
    }

    // Extract attributes using local LLM
    match extractor.extract_attributes(&text, inference.as_ref()).await {
        Ok(attrs) => {
            let json_attrs = convert_attributes_to_json(&attrs);
            Ok(AttributeExtractionResponse {
                success: true,
                attributes: Some(json_attrs),
                error: None,
            })
        }
        Err(e) => {
            Ok(AttributeExtractionResponse {
                success: false,
                attributes: None,
                error: Some(format!("Failed to extract attributes: {}", e)),
            })
        }
    }
}

/// Generate a privacy-safe prompt from attributes
/// Use this when content_mode is 'attributes_only'
#[tauri::command]
pub fn generate_privacy_safe_prompt(
    attributes: TaxAttributesJson,
    question: String,
) -> Result<PrivacySafePromptResponse, String> {
    let extractor = AttributeExtractor::new();

    // Convert JSON to internal format
    let internal_attrs = convert_json_to_attributes(&attributes);

    // Extract just the question from user input
    let question_only = extract_question_only(&question);

    // Generate privacy-safe prompt
    let prompt = extractor.attributes_to_prompt(&internal_attrs, &question_only);

    Ok(PrivacySafePromptResponse {
        success: true,
        prompt: Some(prompt),
        question_only: Some(question_only),
        error: None,
    })
}

/// Process a chat message with privacy-first routing
/// This is the main entry point for privacy-aware chat
#[tauri::command]
pub async fn process_chat_with_privacy(
    text: String,
    persona: Persona,
    state: State<'_, Mutex<AttributeExtractionState>>,
) -> Result<ProcessedChatRequest, String> {
    info!("Processing chat with privacy-first routing for persona: {}", persona.name);

    let (inference, extractor) = {
        let guard = state.lock().await;
        (guard.inference.clone(), AttributeExtractor::new())
    };

    // Get backend routing decision
    let decision = make_routing_decision(&persona, inference.as_ref(), &text)
        .await
        .map_err(|e| e.to_string())?;

    // Check if request is blocked
    if !decision.is_safe {
        return Ok(ProcessedChatRequest {
            prompt: String::new(),
            backend: backend_type_to_string(&decision),
            model: decision.model,
            is_safe: false,
            content_mode: "blocked".to_string(),
            info: Some(decision.reason),
            attributes_count: None,
        });
    }

    // Process based on content mode
    match decision.content_mode {
        ContentMode::AttributesOnly => {
            // Privacy-first: extract attributes locally, only send attributes to cloud
            if !inference.is_available().await {
                return Ok(ProcessedChatRequest {
                    prompt: String::new(),
                    backend: backend_type_to_string(&decision),
                    model: decision.model,
                    is_safe: false,
                    content_mode: "blocked".to_string(),
                    info: Some("Attributes-only mode requires local inference but it is unavailable".to_string()),
                    attributes_count: None,
                });
            }

            // Extract attributes locally
            let attributes = extractor.extract_attributes(&text, inference.as_ref())
                .await
                .map_err(|e| format!("Attribute extraction failed: {}", e))?;

            // Extract just the question
            let question = extract_question_only(&text);

            // Generate privacy-safe prompt
            let prompt = extractor.attributes_to_prompt(&attributes, &question);

            // Count non-null attributes
            let attr_count = count_attributes(&attributes);

            Ok(ProcessedChatRequest {
                prompt,
                backend: backend_type_to_string(&decision),
                model: decision.model,
                is_safe: true,
                content_mode: "attributes_only".to_string(),
                info: Some(format!("Extracted {} attributes, sending privacy-safe prompt", attr_count)),
                attributes_count: Some(attr_count),
            })
        }
        ContentMode::FullText => {
            // Standard mode: may include anonymization
            let info_msg = if decision.anonymize {
                "Full text mode with anonymization enabled"
            } else {
                "Full text mode (direct to cloud)"
            };

            Ok(ProcessedChatRequest {
                prompt: text,
                backend: backend_type_to_string(&decision),
                model: decision.model,
                is_safe: true,
                content_mode: "full_text".to_string(),
                info: Some(info_msg.to_string()),
                attributes_count: None,
            })
        }
    }
}

/// Extract question only from text (strips context/PII)
#[tauri::command]
pub fn extract_question(text: String) -> Result<String, String> {
    Ok(extract_question_only(&text))
}

// Helper functions

fn backend_type_to_string(decision: &BackendDecision) -> String {
    match decision.backend {
        crate::backend_routing::BackendType::Nebius => "nebius".to_string(),
        crate::backend_routing::BackendType::Ollama => "ollama".to_string(),
        crate::backend_routing::BackendType::Hybrid => "hybrid".to_string(),
    }
}

fn convert_attributes_to_json(attrs: &TaxAttributes) -> TaxAttributesJson {
    TaxAttributesJson {
        income_bracket: attrs.income_bracket.as_ref().map(|b| format!("{:?}", b)),
        employment_type: attrs.employment_type.as_ref().map(|e| format!("{:?}", e)),
        has_multiple_employers: attrs.has_multiple_employers,
        receives_benefits: attrs.receives_benefits,
        housing_situation: attrs.housing_situation.as_ref().map(|h| format!("{:?}", h)),
        has_mortgage: attrs.has_mortgage,
        has_savings_above_threshold: attrs.has_savings_above_threshold,
        has_investments: attrs.has_investments,
        filing_status: attrs.filing_status.as_ref().map(|f| format!("{:?}", f)),
        has_dependents: attrs.has_dependents,
        has_fiscal_partner: attrs.has_fiscal_partner,
        has_30_percent_ruling: attrs.has_30_percent_ruling,
        is_entrepreneur: attrs.is_entrepreneur,
        has_foreign_income: attrs.has_foreign_income,
        has_crypto_assets: attrs.has_crypto_assets,
        relevant_boxes: attrs.relevant_boxes.clone(),
        deduction_categories: attrs.deduction_categories.clone(),
    }
}

fn convert_json_to_attributes(json: &TaxAttributesJson) -> TaxAttributes {
    use crate::attribute_extraction::*;

    TaxAttributes {
        income_bracket: json.income_bracket.as_ref().and_then(|s| match s.as_str() {
            "Below20k" => Some(IncomeBracket::Below20k),
            "Range20kTo40k" => Some(IncomeBracket::Range20kTo40k),
            "Range40kTo70k" => Some(IncomeBracket::Range40kTo70k),
            "Range70kTo100k" => Some(IncomeBracket::Range70kTo100k),
            "Above100k" => Some(IncomeBracket::Above100k),
            _ => Some(IncomeBracket::Unknown),
        }),
        employment_type: json.employment_type.as_ref().and_then(|s| match s.as_str() {
            "Employee" => Some(EmploymentType::Employee),
            "Freelancer" => Some(EmploymentType::Freelancer),
            "Entrepreneur" => Some(EmploymentType::Entrepreneur),
            "Director" => Some(EmploymentType::Director),
            "Retired" => Some(EmploymentType::Retired),
            "Student" => Some(EmploymentType::Student),
            "Unemployed" => Some(EmploymentType::Unemployed),
            "Mixed" => Some(EmploymentType::Mixed),
            _ => Some(EmploymentType::Unknown),
        }),
        has_multiple_employers: json.has_multiple_employers,
        receives_benefits: json.receives_benefits,
        housing_situation: json.housing_situation.as_ref().and_then(|s| match s.as_str() {
            "Owner" => Some(HousingSituation::Owner),
            "Renter" => Some(HousingSituation::Renter),
            "LivingWithParents" => Some(HousingSituation::LivingWithParents),
            "SocialHousing" => Some(HousingSituation::SocialHousing),
            _ => Some(HousingSituation::Unknown),
        }),
        has_mortgage: json.has_mortgage,
        has_savings_above_threshold: json.has_savings_above_threshold,
        has_investments: json.has_investments,
        filing_status: json.filing_status.as_ref().and_then(|s| match s.as_str() {
            "Single" => Some(FilingStatus::Single),
            "Married" => Some(FilingStatus::Married),
            "RegisteredPartner" => Some(FilingStatus::RegisteredPartner),
            "Cohabiting" => Some(FilingStatus::Cohabiting),
            "Divorced" => Some(FilingStatus::Divorced),
            "Widowed" => Some(FilingStatus::Widowed),
            _ => Some(FilingStatus::Unknown),
        }),
        has_dependents: json.has_dependents,
        has_fiscal_partner: json.has_fiscal_partner,
        has_30_percent_ruling: json.has_30_percent_ruling,
        is_entrepreneur: json.is_entrepreneur,
        has_foreign_income: json.has_foreign_income,
        has_crypto_assets: json.has_crypto_assets,
        relevant_boxes: json.relevant_boxes.clone(),
        deduction_categories: json.deduction_categories.clone(),
    }
}

fn count_attributes(attrs: &TaxAttributes) -> usize {
    let mut count = 0;
    if attrs.income_bracket.is_some() { count += 1; }
    if attrs.employment_type.is_some() { count += 1; }
    if attrs.has_multiple_employers.is_some() { count += 1; }
    if attrs.receives_benefits.is_some() { count += 1; }
    if attrs.housing_situation.is_some() { count += 1; }
    if attrs.has_mortgage.is_some() { count += 1; }
    if attrs.has_savings_above_threshold.is_some() { count += 1; }
    if attrs.has_investments.is_some() { count += 1; }
    if attrs.filing_status.is_some() { count += 1; }
    if attrs.has_dependents.is_some() { count += 1; }
    if attrs.has_fiscal_partner.is_some() { count += 1; }
    if attrs.has_30_percent_ruling.is_some() { count += 1; }
    if attrs.is_entrepreneur.is_some() { count += 1; }
    if attrs.has_foreign_income.is_some() { count += 1; }
    if attrs.has_crypto_assets.is_some() { count += 1; }
    count += attrs.relevant_boxes.len();
    count += attrs.deduction_categories.len();
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_attributes() {
        let attrs = TaxAttributes::default();
        assert_eq!(count_attributes(&attrs), 0);

        let mut attrs = TaxAttributes::default();
        attrs.has_mortgage = Some(true);
        attrs.relevant_boxes = vec!["Box 1".to_string()];
        assert_eq!(count_attributes(&attrs), 2);
    }

    #[test]
    fn test_extract_question() {
        let result = extract_question("I am Jan. Can I deduct mortgage interest?".to_string());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("mortgage"));
    }
}
