/**
 * Re-hydration Tauri Commands
 *
 * Exposes template filling functionality to the frontend.
 */

use crate::rehydration::{
    analyze_template, rehydrate_template, build_template_prompt,
    PIIValues, TemplateAnalysis, RehydrationResult,
};
use serde::{Deserialize, Serialize};
use log::info;

/// Analyze a template for placeholders
#[tauri::command]
pub fn analyze_template_command(
    template: String,
    pii_values: PIIValues,
) -> Result<TemplateAnalysis, String> {
    info!("Analyzing template (length: {} chars)", template.len());
    Ok(analyze_template(&template, &pii_values))
}

/// Re-hydrate a template with PII values
#[tauri::command]
pub fn rehydrate_template_command(
    template: String,
    pii_values: PIIValues,
) -> Result<RehydrationResult, String> {
    info!("Re-hydrating template (length: {} chars)", template.len());
    let result = rehydrate_template(&template, &pii_values);
    info!(
        "Re-hydration complete: {} filled, {} unfilled, complete={}",
        result.filled_placeholders.len(),
        result.unfilled_placeholders.len(),
        result.is_complete
    );
    Ok(result)
}

/// Build a prompt for cloud LLM to generate a template
#[tauri::command]
pub fn build_template_prompt_command(
    user_request: String,
    template_type: String,
) -> Result<String, String> {
    info!("Building template prompt for type: {}", template_type);
    Ok(build_template_prompt(&user_request, &template_type))
}

/// Get list of available placeholder types
#[tauri::command]
pub fn get_placeholder_types() -> Result<Vec<PlaceholderTypeInfo>, String> {
    use crate::rehydration::PLACEHOLDERS;

    let types: Vec<PlaceholderTypeInfo> = PLACEHOLDERS
        .iter()
        .map(|(key, placeholder)| PlaceholderTypeInfo {
            key: key.to_string(),
            placeholder: placeholder.to_string(),
            category: get_placeholder_category(key),
            is_sensitive: is_sensitive_placeholder(key),
        })
        .collect();

    Ok(types)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaceholderTypeInfo {
    pub key: String,
    pub placeholder: String,
    pub category: String,
    pub is_sensitive: bool,
}

fn get_placeholder_category(key: &str) -> String {
    match key {
        "BSN" | "NAME" | "SURNAME" | "FULL_NAME" | "DATE_OF_BIRTH" => "personal",
        "EMAIL" | "PHONE" | "ADDRESS" | "POSTCODE" | "CITY" => "contact",
        "INCOME" | "SALARY" | "IBAN" | "BANK_ACCOUNT" => "financial",
        "TAX_NUMBER" | "TAX_YEAR" => "tax",
        "ACCOUNTANT_NAME" | "ACCOUNTANT_EMAIL" | "EMPLOYER_NAME" => "third_party",
        "CURRENT_DATE" => "dynamic",
        _ => "custom",
    }.to_string()
}

fn is_sensitive_placeholder(key: &str) -> bool {
    matches!(key, "BSN" | "IBAN" | "BANK_ACCOUNT" | "INCOME" | "SALARY" | "TAX_NUMBER" | "DATE_OF_BIRTH" | "PHONE")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_analyze_command() {
        let template = "BSN: [BSN], Name: [NAME]".to_string();
        let pii = PIIValues {
            bsn: Some("123456789".to_string()),
            ..Default::default()
        };

        let result = analyze_template_command(template, pii).unwrap();
        assert_eq!(result.placeholders.len(), 2);
    }

    #[test]
    fn test_rehydrate_command() {
        let template = "Hello [NAME]!".to_string();
        let pii = PIIValues {
            name: Some("Jan".to_string()),
            ..Default::default()
        };

        let result = rehydrate_template_command(template, pii).unwrap();
        assert_eq!(result.content, "Hello Jan!");
        assert!(result.is_complete);
    }

    #[test]
    fn test_placeholder_types() {
        let types = get_placeholder_types().unwrap();
        assert!(!types.is_empty());

        let bsn_type = types.iter().find(|t| t.key == "BSN").unwrap();
        assert_eq!(bsn_type.category, "personal");
        assert!(bsn_type.is_sensitive);
    }
}
