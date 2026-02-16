/**
 * Re-hydration Module
 *
 * Handles template filling with PII values from local storage.
 * Cloud LLM generates templates with placeholders → This module fills in real values.
 *
 * Security: PII values are stored encrypted and only decrypted for re-hydration.
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;
use chrono::{Local, Datelike};
use log::info;

/// Standard placeholder types
pub const PLACEHOLDERS: &[(&str, &str)] = &[
    // Personal
    ("BSN", "[BSN]"),
    ("NAME", "[NAME]"),
    ("SURNAME", "[SURNAME]"),
    ("FULL_NAME", "[FULL_NAME]"),
    ("DATE_OF_BIRTH", "[DATE_OF_BIRTH]"),
    // Contact
    ("EMAIL", "[EMAIL]"),
    ("PHONE", "[PHONE]"),
    ("ADDRESS", "[ADDRESS]"),
    ("POSTCODE", "[POSTCODE]"),
    ("CITY", "[CITY]"),
    // Financial
    ("INCOME", "[INCOME]"),
    ("SALARY", "[SALARY]"),
    ("IBAN", "[IBAN]"),
    ("BANK_ACCOUNT", "[BANK_ACCOUNT]"),
    // Tax
    ("TAX_NUMBER", "[TAX_NUMBER]"),
    ("TAX_YEAR", "[TAX_YEAR]"),
    // Third parties
    ("ACCOUNTANT_NAME", "[ACCOUNTANT_NAME]"),
    ("ACCOUNTANT_EMAIL", "[ACCOUNTANT_EMAIL]"),
    ("EMPLOYER_NAME", "[EMPLOYER_NAME]"),
    // Dynamic
    ("CURRENT_DATE", "[CURRENT_DATE]"),
];

/// PII values for re-hydration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PIIValues {
    // Personal
    pub bsn: Option<String>,
    pub name: Option<String>,
    pub surname: Option<String>,
    pub date_of_birth: Option<String>,
    // Contact
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub postcode: Option<String>,
    pub city: Option<String>,
    // Financial
    pub income: Option<String>,
    pub salary: Option<String>,
    pub iban: Option<String>,
    // Tax
    pub tax_number: Option<String>,
    pub tax_year: Option<String>,
    // Third parties
    pub accountant_name: Option<String>,
    pub accountant_email: Option<String>,
    pub employer_name: Option<String>,
    // Custom
    #[serde(default)]
    pub custom: HashMap<String, String>,
}

/// Information about a found placeholder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceholderInfo {
    pub placeholder: String,
    pub placeholder_type: String,
    pub position: usize,
    pub has_value: bool,
}

/// Result of template analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateAnalysis {
    pub placeholders: Vec<PlaceholderInfo>,
    pub can_fully_hydrate: bool,
    pub missing_values: Vec<String>,
}

/// Information about a filled placeholder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilledPlaceholder {
    pub placeholder: String,
    pub placeholder_type: String,
    pub masked_value: String,
    pub is_sensitive: bool,
}

/// Result of re-hydration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RehydrationResult {
    pub content: String,
    pub filled_placeholders: Vec<FilledPlaceholder>,
    pub unfilled_placeholders: Vec<String>,
    pub is_complete: bool,
}

/// Analyze a template for placeholders
pub fn analyze_template(template: &str, pii_values: &PIIValues) -> TemplateAnalysis {
    let placeholder_regex = Regex::new(r"\[([A-Z_]+)\]").unwrap();
    let mut placeholders = Vec::new();
    let mut missing_values = Vec::new();

    for cap in placeholder_regex.captures_iter(template) {
        let placeholder_text = cap.get(0).unwrap().as_str().to_string();
        let placeholder_key = cap.get(1).unwrap().as_str();
        let has_value = has_value_for_placeholder(placeholder_key, pii_values);

        placeholders.push(PlaceholderInfo {
            placeholder: placeholder_text.clone(),
            placeholder_type: placeholder_key.to_string(),
            position: cap.get(0).unwrap().start(),
            has_value,
        });

        if !has_value && !is_dynamic_placeholder(placeholder_key) {
            missing_values.push(placeholder_key.to_string());
        }
    }

    // Deduplicate missing values
    missing_values.sort();
    missing_values.dedup();

    TemplateAnalysis {
        placeholders,
        can_fully_hydrate: missing_values.is_empty(),
        missing_values,
    }
}

/// Re-hydrate a template with PII values
pub fn rehydrate_template(template: &str, pii_values: &PIIValues) -> RehydrationResult {
    let mut result = template.to_string();
    let mut filled_placeholders = Vec::new();
    let mut unfilled_placeholders = Vec::new();

    // Define all replacements
    let replacements: Vec<(&str, Option<String>, bool)> = vec![
        // Personal
        ("[BSN]", pii_values.bsn.clone(), true),
        ("[NAME]", pii_values.name.clone(), false),
        ("[SURNAME]", pii_values.surname.clone(), false),
        ("[FULL_NAME]", combine_full_name(pii_values), false),
        ("[DATE_OF_BIRTH]", pii_values.date_of_birth.clone(), true),
        // Contact
        ("[EMAIL]", pii_values.email.clone(), false),
        ("[PHONE]", pii_values.phone.clone(), true),
        ("[ADDRESS]", pii_values.address.clone(), false),
        ("[POSTCODE]", pii_values.postcode.clone(), false),
        ("[CITY]", pii_values.city.clone(), false),
        // Financial
        ("[INCOME]", pii_values.income.clone(), true),
        ("[SALARY]", pii_values.salary.clone(), true),
        ("[IBAN]", pii_values.iban.clone(), true),
        ("[BANK_ACCOUNT]", pii_values.iban.clone(), true),
        // Tax
        ("[TAX_NUMBER]", pii_values.tax_number.clone().or_else(|| pii_values.bsn.clone()), true),
        ("[TAX_YEAR]", pii_values.tax_year.clone().or_else(|| Some(get_current_tax_year())), false),
        // Third parties
        ("[ACCOUNTANT_NAME]", pii_values.accountant_name.clone(), false),
        ("[ACCOUNTANT_EMAIL]", pii_values.accountant_email.clone(), false),
        ("[EMPLOYER_NAME]", pii_values.employer_name.clone(), false),
        // Dynamic
        ("[CURRENT_DATE]", Some(get_current_date()), false),
    ];

    for (placeholder, value, is_sensitive) in replacements {
        if result.contains(placeholder) {
            if let Some(val) = value {
                result = result.replace(placeholder, &val);
                filled_placeholders.push(FilledPlaceholder {
                    placeholder: placeholder.to_string(),
                    placeholder_type: placeholder.trim_matches(|c| c == '[' || c == ']').to_string(),
                    masked_value: mask_value(&val, placeholder),
                    is_sensitive,
                });
            } else {
                unfilled_placeholders.push(placeholder.to_string());
            }
        }
    }

    // Handle custom placeholders
    for (key, value) in &pii_values.custom {
        let placeholder = format!("[{}]", key);
        if result.contains(&placeholder) {
            result = result.replace(&placeholder, value);
            filled_placeholders.push(FilledPlaceholder {
                placeholder: placeholder.clone(),
                placeholder_type: key.clone(),
                masked_value: if value.len() > 10 {
                    format!("{}...", &value[..10])
                } else {
                    value.clone()
                },
                is_sensitive: false,
            });
        }
    }

    // Deduplicate unfilled placeholders
    let unique_unfilled: Vec<String> = unfilled_placeholders
        .into_iter()
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    let is_complete = unique_unfilled.is_empty();

    RehydrationResult {
        content: result,
        filled_placeholders,
        unfilled_placeholders: unique_unfilled,
        is_complete,
    }
}

/// Build a prompt for cloud LLM that instructs it to use placeholders
pub fn build_template_prompt(user_request: &str, template_type: &str) -> String {
    let placeholder_list: Vec<&str> = PLACEHOLDERS.iter().map(|(_, p)| *p).collect();

    format!(
        r#"Generate a {} based on the user's request.

IMPORTANT: Use these placeholders for any personal information:
{}

Never include actual personal data - only use placeholders.
The user will fill in the real values locally.

User request: {}

Generate the {} with appropriate placeholders:"#,
        template_type,
        placeholder_list.join(", "),
        user_request,
        template_type
    )
}

// Helper functions

fn has_value_for_placeholder(key: &str, pii: &PIIValues) -> bool {
    match key {
        "BSN" => pii.bsn.is_some(),
        "NAME" => pii.name.is_some(),
        "SURNAME" => pii.surname.is_some(),
        "FULL_NAME" => pii.name.is_some() || pii.surname.is_some(),
        "DATE_OF_BIRTH" => pii.date_of_birth.is_some(),
        "EMAIL" => pii.email.is_some(),
        "PHONE" => pii.phone.is_some(),
        "ADDRESS" => pii.address.is_some(),
        "POSTCODE" => pii.postcode.is_some(),
        "CITY" => pii.city.is_some(),
        "INCOME" => pii.income.is_some(),
        "SALARY" => pii.salary.is_some(),
        "IBAN" | "BANK_ACCOUNT" => pii.iban.is_some(),
        "TAX_NUMBER" => pii.tax_number.is_some() || pii.bsn.is_some(),
        "TAX_YEAR" => pii.tax_year.is_some() || true, // Can always generate
        "ACCOUNTANT_NAME" => pii.accountant_name.is_some(),
        "ACCOUNTANT_EMAIL" => pii.accountant_email.is_some(),
        "EMPLOYER_NAME" => pii.employer_name.is_some(),
        "CURRENT_DATE" => true, // Always available
        _ => pii.custom.contains_key(key),
    }
}

fn is_dynamic_placeholder(key: &str) -> bool {
    matches!(key, "CURRENT_DATE" | "TAX_YEAR")
}

fn combine_full_name(pii: &PIIValues) -> Option<String> {
    let parts: Vec<&str> = [pii.name.as_deref(), pii.surname.as_deref()]
        .into_iter()
        .flatten()
        .collect();

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

fn get_current_tax_year() -> String {
    let now = Local::now();
    let year = if now.month() < 4 {
        now.year() - 1
    } else {
        now.year()
    };
    year.to_string()
}

fn get_current_date() -> String {
    Local::now().format("%d-%m-%Y").to_string()
}

fn mask_value(value: &str, placeholder: &str) -> String {
    match placeholder {
        "[BSN]" => {
            if value.len() > 3 {
                format!("***{}", &value[value.len()-3..])
            } else {
                "***".to_string()
            }
        }
        "[IBAN]" | "[BANK_ACCOUNT]" => {
            if value.len() > 4 {
                format!("****{}", &value[value.len()-4..])
            } else {
                "****".to_string()
            }
        }
        "[INCOME]" | "[SALARY]" => "€***".to_string(),
        "[PHONE]" => {
            let digits: String = value.chars().filter(|c| c.is_ascii_digit()).collect();
            if digits.len() > 4 {
                format!("****{}", &digits[digits.len()-4..])
            } else {
                "****".to_string()
            }
        }
        "[EMAIL]" => {
            if let Some(at_pos) = value.find('@') {
                let local = &value[..at_pos];
                let domain = &value[at_pos..];
                if local.len() > 2 {
                    format!("{}***{}", &local[..2], domain)
                } else {
                    format!("***{}", domain)
                }
            } else {
                "***@***".to_string()
            }
        }
        _ => {
            if value.len() > 20 {
                format!("{}...", &value[..20])
            } else {
                value.to_string()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_template() {
        let template = "Dear [ACCOUNTANT_NAME], my BSN is [BSN].";
        let pii = PIIValues {
            bsn: Some("123456789".to_string()),
            ..Default::default()
        };

        let analysis = analyze_template(template, &pii);
        assert_eq!(analysis.placeholders.len(), 2);
        assert!(!analysis.can_fully_hydrate);
        assert!(analysis.missing_values.contains(&"ACCOUNTANT_NAME".to_string()));
    }

    #[test]
    fn test_rehydrate_template() {
        let template = "Name: [FULL_NAME], BSN: [BSN]";
        let pii = PIIValues {
            name: Some("Jan".to_string()),
            surname: Some("Jansen".to_string()),
            bsn: Some("123456789".to_string()),
            ..Default::default()
        };

        let result = rehydrate_template(template, &pii);
        assert!(result.is_complete);
        assert_eq!(result.content, "Name: Jan Jansen, BSN: 123456789");
        assert_eq!(result.filled_placeholders.len(), 2);
    }

    #[test]
    fn test_mask_values() {
        assert_eq!(mask_value("123456789", "[BSN]"), "***789");
        assert_eq!(mask_value("NL91ABNA0417164300", "[IBAN]"), "****4300");
        assert_eq!(mask_value("jan@example.com", "[EMAIL]"), "ja***@example.com");
    }

    #[test]
    fn test_build_template_prompt() {
        let prompt = build_template_prompt("Write an email to my accountant", "email");
        assert!(prompt.contains("[BSN]"));
        assert!(prompt.contains("[ACCOUNTANT_NAME]"));
        assert!(prompt.contains("email"));
    }
}
