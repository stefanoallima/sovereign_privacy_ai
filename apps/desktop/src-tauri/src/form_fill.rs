/**
 * Form Fill Module
 *
 * LLM-powered form field extraction and profile matching.
 * Extracts form structure using the local LLM, then matches fields against the
 * user's encrypted profile -- PII never leaves the machine.
 *
 * Pipeline:
 *   1. OCR / parsed form text -> build_field_extraction_prompt -> LLM -> parse_field_extraction_response
 *   2. Extracted fields + UserProfile -> match_profile_fields -> FieldMatchResult
 *   3. Reasoning fields -> build_reasoning_prompt (placeholders only) -> LLM -> rehydrate_reasoning_field
 */

use serde::{Deserialize, Serialize};

use crate::user_profile::UserProfile;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormField {
    #[serde(default)]
    pub id: String,
    pub label: String,
    pub category: String,
    #[serde(rename = "type")]
    pub field_type: String, // "simple" or "reasoning"
    pub hint: Option<String>,
    pub value: Option<String>,
    pub source: Option<String>, // "profile", "user-input", "llm-composed"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMatchResult {
    pub matched: Vec<FormField>,   // fields with values from profile
    pub gaps: Vec<FormField>,      // fields needing user input
    pub reasoning: Vec<FormField>, // fields needing LLM composition
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/// Build the system prompt for field extraction.
/// This prompt tells the LLM to analyze a blank form and return JSON.
pub fn build_field_extraction_prompt(form_text: &str) -> String {
    // Truncate to ~8000 chars (~2-3 pages) to fit in LLM context window
    let text = if form_text.len() > 8000 {
        let mut end = 8000;
        while end > 0 && !form_text.is_char_boundary(end) {
            end -= 1;
        }
        &form_text[..end]
    } else {
        form_text
    };
    format!(
        r#"You are a form analyzer. Analyze the following form template and identify all fillable fields.

For each field, determine:
- "label": the field name as shown in the form
- "category": map to one of these standard categories if applicable: full_name, date_of_birth, bsn, nationality, email, phone, address, employer_name, employment_type, job_title, income_bracket, bank_name, iban, or "custom" if none match
- "type": "simple" if it's a direct value (name, date, number), "reasoning" if it requires composed text (descriptions, explanations, reasons)
- "hint": for reasoning fields, describe what kind of text is expected

Return ONLY a JSON array. No other text.

Example output:
[
  {{"label": "Full Name", "category": "full_name", "type": "simple"}},
  {{"label": "Reason for application", "category": "custom", "type": "reasoning", "hint": "Brief explanation of why you are applying"}}
]

FORM TEMPLATE:
---
{}
---

Return the JSON array of fields:"#,
        text
    )
}

/// Build a prompt for the LLM to compose a reasoning field using placeholders.
/// The LLM never sees real PII -- only placeholder tokens.
pub fn build_reasoning_prompt(field: &FormField, profile: &UserProfile) -> String {
    let mut context_parts = Vec::new();

    if profile.employment_type.is_some() {
        context_parts.push("employment type: [EMPLOYMENT_TYPE]".to_string());
    }
    if profile.job_title.is_some() {
        context_parts.push("job title: [JOB_TITLE]".to_string());
    }
    if profile.employer_name.is_some() {
        context_parts.push("employer: [EMPLOYER_NAME]".to_string());
    }
    if profile.nationality.is_some() {
        context_parts.push("nationality: [NATIONALITY]".to_string());
    }

    let context = if context_parts.is_empty() {
        "No specific context available.".to_string()
    } else {
        context_parts.join(", ")
    };

    let hint = field.hint.as_deref().unwrap_or("Provide appropriate text");

    format!(
        r#"Write text for a form field labeled "{}".
Instructions: {}

Available context (use these placeholder tokens exactly as shown): {}

Write 1-3 sentences using the placeholder tokens. Do NOT use real names or personal information.
Use ONLY the bracket placeholders like [EMPLOYMENT_TYPE], [JOB_TITLE], etc.

Output ONLY the field text, nothing else."#,
        field.label, hint, context
    )
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/// Parse the LLM response into a Vec<FormField>.
/// Handles common LLM quirks (markdown code blocks, extra text).
pub fn parse_field_extraction_response(response: &str) -> Result<Vec<FormField>, String> {
    let trimmed = response.trim();

    // Find the JSON array boundaries, handling markdown fences and extra text
    let start = trimmed
        .find('[')
        .ok_or_else(|| "No JSON array found in response".to_string())?;
    let end = trimmed
        .rfind(']')
        .ok_or_else(|| "No closing bracket found in response".to_string())?
        + 1;

    let json_str = &trimmed[start..end];

    let mut fields: Vec<FormField> = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse fields JSON: {}. Raw: {}", e, json_str))?;

    // Assign unique IDs to fields that do not have one
    for (i, field) in fields.iter_mut().enumerate() {
        if field.id.is_empty() {
            field.id = format!("field_{}", i);
        }
    }

    Ok(fields)
}

// ---------------------------------------------------------------------------
// Profile matching
// ---------------------------------------------------------------------------

/// Match extracted fields against the user's profile.
/// Returns which fields are filled, which need user input, which need LLM composition.
pub fn match_profile_fields(fields: Vec<FormField>, profile: &UserProfile) -> FieldMatchResult {
    let mut matched = Vec::new();
    let mut gaps = Vec::new();
    let mut reasoning = Vec::new();

    for mut field in fields {
        if field.field_type == "reasoning" {
            reasoning.push(field);
            continue;
        }

        // Try to match category to a profile field
        let value = match field.category.as_str() {
            "full_name" => profile.full_name.clone(),
            "date_of_birth" => profile.date_of_birth.clone(),
            "bsn" => profile.bsn.clone(),
            "nationality" => profile.nationality.clone(),
            "email" => profile.email.clone(),
            "phone" => profile.phone.clone(),
            "address" => profile.address.as_ref().map(|a| {
                format!("{}, {} {}, {}", a.street, a.postal_code, a.city, a.country)
            }),
            "employer_name" => profile.employer_name.clone(),
            "employment_type" => profile.employment_type.clone(),
            "job_title" => profile.job_title.clone(),
            "income_bracket" => profile.income_bracket.clone(),
            "bank_name" => profile.bank_name.clone(),
            "iban" => profile.iban.clone(),
            "custom" => profile.custom_fields.get(&field.label).cloned(),
            _ => profile.custom_fields.get(&field.category).cloned(),
        };

        if let Some(v) = value {
            field.value = Some(v);
            field.source = Some("profile".to_string());
            matched.push(field);
        } else {
            gaps.push(field);
        }
    }

    FieldMatchResult {
        matched,
        gaps,
        reasoning,
    }
}

// ---------------------------------------------------------------------------
// Rehydration of reasoning fields
// ---------------------------------------------------------------------------

/// Rehydrate a reasoning field's composed text by replacing placeholders with real values.
pub fn rehydrate_reasoning_field(text: &str, profile: &UserProfile) -> String {
    let mut result = text.to_string();

    if let Some(ref v) = profile.full_name {
        result = result.replace("[FULL_NAME]", v).replace("[NAME]", v);
    }
    if let Some(ref v) = profile.employment_type {
        result = result.replace("[EMPLOYMENT_TYPE]", v);
    }
    if let Some(ref v) = profile.job_title {
        result = result.replace("[JOB_TITLE]", v);
    }
    if let Some(ref v) = profile.employer_name {
        result = result.replace("[EMPLOYER_NAME]", v);
    }
    if let Some(ref v) = profile.nationality {
        result = result.replace("[NATIONALITY]", v);
    }
    if let Some(ref v) = profile.email {
        result = result.replace("[EMAIL]", v);
    }
    if let Some(ref v) = profile.phone {
        result = result.replace("[PHONE]", v);
    }
    if let Some(ref v) = profile.bsn {
        result = result.replace("[BSN]", v);
    }
    if let Some(ref v) = profile.iban {
        result = result.replace("[IBAN]", v);
    }
    if let Some(ref v) = profile.date_of_birth {
        result = result.replace("[DATE_OF_BIRTH]", v);
    }
    if let Some(ref v) = profile.income_bracket {
        result = result.replace("[INCOME]", v);
    }
    if let Some(ref v) = profile.address {
        let addr = format!("{}, {} {}, {}", v.street, v.postal_code, v.city, v.country);
        result = result.replace("[ADDRESS]", &addr);
    }

    // Custom fields
    for (key, val) in &profile.custom_fields {
        let placeholder = format!("[{}]", key.to_uppercase().replace(' ', "_"));
        result = result.replace(&placeholder, val);
    }

    result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::user_profile::UserProfileAddress;

    #[test]
    fn test_parse_field_extraction_clean_json() {
        let response = r#"[{"label": "Full Name", "category": "full_name", "type": "simple"}]"#;
        let fields = parse_field_extraction_response(response).unwrap();
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].label, "Full Name");
        assert_eq!(fields[0].category, "full_name");
    }

    #[test]
    fn test_parse_field_extraction_with_markdown() {
        let response = "```json\n[{\"label\": \"Email\", \"category\": \"email\", \"type\": \"simple\"}]\n```";
        let fields = parse_field_extraction_response(response).unwrap();
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].category, "email");
    }

    #[test]
    fn test_parse_field_extraction_no_array() {
        let response = "I could not find any fields.";
        let result = parse_field_extraction_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_match_profile_fields() {
        let fields = vec![
            FormField {
                id: String::new(),
                label: "Full Name".into(),
                category: "full_name".into(),
                field_type: "simple".into(),
                hint: None,
                value: None,
                source: None,
            },
            FormField {
                id: String::new(),
                label: "BSN".into(),
                category: "bsn".into(),
                field_type: "simple".into(),
                hint: None,
                value: None,
                source: None,
            },
            FormField {
                id: String::new(),
                label: "Phone".into(),
                category: "phone".into(),
                field_type: "simple".into(),
                hint: None,
                value: None,
                source: None,
            },
        ];
        let profile = UserProfile {
            id: "default".into(),
            full_name: Some("Test User".into()),
            bsn: None,
            phone: Some("+31612345678".into()),
            ..Default::default()
        };
        let result = match_profile_fields(fields, &profile);
        assert_eq!(result.matched.len(), 2);
        assert_eq!(result.gaps.len(), 1);
        assert_eq!(result.reasoning.len(), 0);
    }

    #[test]
    fn test_rehydrate_reasoning() {
        let profile = UserProfile {
            id: "default".into(),
            employment_type: Some("freelancer".into()),
            job_title: Some("software engineer".into()),
            ..Default::default()
        };
        let text = "I am a [EMPLOYMENT_TYPE] working as [JOB_TITLE].";
        let result = rehydrate_reasoning_field(text, &profile);
        assert_eq!(result, "I am a freelancer working as software engineer.");
    }

    #[test]
    fn test_rehydrate_reasoning_with_address() {
        let profile = UserProfile {
            id: "default".into(),
            full_name: Some("Jan Jansen".into()),
            address: Some(UserProfileAddress {
                street: "Herengracht 10".into(),
                city: "Amsterdam".into(),
                postal_code: "1015 BN".into(),
                country: "NL".into(),
            }),
            ..Default::default()
        };
        let text = "My name is [FULL_NAME] and I live at [ADDRESS].";
        let result = rehydrate_reasoning_field(text, &profile);
        assert_eq!(
            result,
            "My name is Jan Jansen and I live at Herengracht 10, 1015 BN Amsterdam, NL."
        );
    }

    #[test]
    fn test_rehydrate_custom_fields() {
        let mut custom = HashMap::new();
        custom.insert("company name".to_string(), "Acme Corp".to_string());
        let profile = UserProfile {
            id: "default".into(),
            custom_fields: custom,
            ..Default::default()
        };
        let text = "I work at [COMPANY_NAME].";
        let result = rehydrate_reasoning_field(text, &profile);
        assert_eq!(result, "I work at Acme Corp.");
    }

    #[test]
    fn test_build_field_extraction_prompt_contains_form_text() {
        let prompt = build_field_extraction_prompt("Name: ___\nEmail: ___");
        assert!(prompt.contains("Name: ___"));
        assert!(prompt.contains("Email: ___"));
        assert!(prompt.contains("JSON array"));
    }

    #[test]
    fn test_build_reasoning_prompt_no_context() {
        let field = FormField {
            id: String::new(),
            label: "Notes".into(),
            category: "custom".into(),
            field_type: "reasoning".into(),
            hint: None,
            value: None,
            source: None,
        };
        let profile = UserProfile {
            id: "default".into(),
            ..Default::default()
        };
        let prompt = build_reasoning_prompt(&field, &profile);
        assert!(prompt.contains("No specific context available"));
    }

    #[test]
    fn test_parse_with_extra_text() {
        let response = "Here are fields:\n[{\"label\": \"Name\", \"category\": \"full_name\", \"type\": \"simple\"}, {\"label\": \"Reason\", \"category\": \"custom\", \"type\": \"reasoning\", \"hint\": \"Why?\"}]\nEnd.";
        let fields = parse_field_extraction_response(response).unwrap();
        assert_eq!(fields.len(), 2);
        assert_eq!(fields[0].label, "Name");
        assert_eq!(fields[0].category, "full_name");
        assert_eq!(fields[1].label, "Reason");
        assert_eq!(fields[1].field_type, "reasoning");
        assert_eq!(fields[1].hint.as_deref(), Some("Why?"));
    }

    #[test]
    fn test_parse_empty_array() {
        let response = "[]";
        let fields = parse_field_extraction_response(response).unwrap();
        assert!(fields.is_empty());
    }

    #[test]
    fn test_parse_invalid_json() {
        let response = "[{invalid json}]";
        let result = parse_field_extraction_response(response);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse"));
    }

    #[test]
    fn test_match_with_address() {
        let fields = vec![FormField {
            id: String::new(),
            label: "Address".into(),
            category: "address".into(),
            field_type: "simple".into(),
            hint: None,
            value: None,
            source: None,
        }];
        let profile = UserProfile {
            id: "default".into(),
            address: Some(UserProfileAddress {
                street: "Damrak 1".into(),
                city: "Amsterdam".into(),
                postal_code: "1012 LG".into(),
                country: "NL".into(),
            }),
            ..Default::default()
        };
        let result = match_profile_fields(fields, &profile);
        assert_eq!(result.matched.len(), 1);
        assert_eq!(result.gaps.len(), 0);
        let val = result.matched[0].value.as_deref().unwrap();
        assert!(val.contains("Damrak 1"));
        assert!(val.contains("Amsterdam"));
        assert!(val.contains("1012 LG"));
        assert!(val.contains("NL"));
    }

    #[test]
    fn test_match_custom_fields() {
        let mut custom = HashMap::new();
        custom.insert("Tax ID".to_string(), "NL123456".to_string());
        let fields = vec![FormField {
            id: String::new(),
            label: "Tax ID".into(),
            category: "custom".into(),
            field_type: "simple".into(),
            hint: None,
            value: None,
            source: None,
        }];
        let profile = UserProfile {
            id: "default".into(),
            custom_fields: custom,
            ..Default::default()
        };
        let result = match_profile_fields(fields, &profile);
        assert_eq!(result.matched.len(), 1);
        assert_eq!(result.matched[0].value.as_deref(), Some("NL123456"));
        assert_eq!(result.matched[0].source.as_deref(), Some("profile"));
    }

    #[test]
    fn test_reasoning_fields_separated() {
        let fields = vec![
            FormField {
                id: String::new(),
                label: "Name".into(),
                category: "full_name".into(),
                field_type: "simple".into(),
                hint: None, value: None, source: None,
            },
            FormField {
                id: String::new(),
                label: "Motivation".into(),
                category: "custom".into(),
                field_type: "reasoning".into(),
                hint: Some("Why do you want this?".into()),
                value: None, source: None,
            },
            FormField {
                id: String::new(),
                label: "Cover Letter".into(),
                category: "custom".into(),
                field_type: "reasoning".into(),
                hint: Some("Brief introduction".into()),
                value: None, source: None,
            },
        ];
        let profile = UserProfile {
            id: "default".into(),
            full_name: Some("Test".into()),
            ..Default::default()
        };
        let result = match_profile_fields(fields, &profile);
        assert_eq!(result.matched.len(), 1);
        assert_eq!(result.reasoning.len(), 2);
        assert_eq!(result.reasoning[0].label, "Motivation");
        assert_eq!(result.reasoning[1].label, "Cover Letter");
    }

    #[test]
    fn test_build_extraction_prompt_contains_form_text2() {
        let form_text = "Applicant Name: ___\nDate of Birth: ___\nReason for Visit: ___";
        let prompt = build_field_extraction_prompt(form_text);
        assert!(prompt.contains("Applicant Name: ___"));
        assert!(prompt.contains("Date of Birth: ___"));
        assert!(prompt.contains("Reason for Visit: ___"));
        assert!(prompt.contains("FORM TEMPLATE"));
        assert!(prompt.contains("JSON array"));
    }

    #[test]
    fn test_build_reasoning_prompt_with_placeholders() {
        let field = FormField {
            id: String::new(),
            label: "Why are you applying?".into(),
            category: "custom".into(),
            field_type: "reasoning".into(),
            hint: Some("Explain your motivation".into()),
            value: None, source: None,
        };
        let profile = UserProfile {
            id: "default".into(),
            employment_type: Some("full-time".into()),
            job_title: Some("engineer".into()),
            employer_name: Some("Acme".into()),
            nationality: Some("Dutch".into()),
            ..Default::default()
        };
        let prompt = build_reasoning_prompt(&field, &profile);
        assert!(prompt.contains("[EMPLOYMENT_TYPE]"));
        assert!(prompt.contains("[JOB_TITLE]"));
        assert!(prompt.contains("[EMPLOYER_NAME]"));
        assert!(prompt.contains("[NATIONALITY]"));
        assert!(prompt.contains("Explain your motivation"));
        // Real values must NOT appear in the prompt
        assert!(!prompt.contains("full-time"));
        assert!(!prompt.contains("engineer"));
        assert!(!prompt.contains("Acme"));
        assert!(!prompt.contains("Dutch"));
    }

    #[test]
    fn test_rehydrate_all_placeholders() {
        let profile = UserProfile {
            id: "default".into(),
            full_name: Some("Jan Jansen".into()),
            date_of_birth: Some("1990-01-15".into()),
            bsn: Some("123456789".into()),
            nationality: Some("Dutch".into()),
            email: Some("jan@example.nl".into()),
            phone: Some("+31612345678".into()),
            employment_type: Some("full-time".into()),
            job_title: Some("Developer".into()),
            employer_name: Some("TechCorp".into()),
            income_bracket: Some("40k-60k".into()),
            iban: Some("NL91ABNA0417164300".into()),
            address: Some(UserProfileAddress {
                street: "Kalverstraat 1".into(),
                city: "Amsterdam".into(),
                postal_code: "1012 NX".into(),
                country: "NL".into(),
            }),
            ..Default::default()
        };
        let text = "[FULL_NAME] born [DATE_OF_BIRTH], BSN [BSN], [NATIONALITY], email [EMAIL], phone [PHONE], [EMPLOYMENT_TYPE] [JOB_TITLE] at [EMPLOYER_NAME], income [INCOME], IBAN [IBAN], lives at [ADDRESS].";
        let result = rehydrate_reasoning_field(text, &profile);
        assert!(result.contains("Jan Jansen"));
        assert!(result.contains("1990-01-15"));
        assert!(result.contains("123456789"));
        assert!(result.contains("Dutch"));
        assert!(result.contains("jan@example.nl"));
        assert!(result.contains("+31612345678"));
        assert!(result.contains("full-time"));
        assert!(result.contains("Developer"));
        assert!(result.contains("TechCorp"));
        assert!(result.contains("40k-60k"));
        assert!(result.contains("NL91ABNA0417164300"));
        assert!(result.contains("Kalverstraat 1, 1012 NX Amsterdam, NL"));
        // No placeholders should remain
        assert!(!result.contains("["));
        assert!(!result.contains("]"));
    }

    #[test]
    fn test_rehydrate_custom_fields_multiple() {
        let mut custom = HashMap::new();
        custom.insert("department".to_string(), "Engineering".to_string());
        custom.insert("badge number".to_string(), "B-4242".to_string());
        let profile = UserProfile {
            id: "default".into(),
            custom_fields: custom,
            ..Default::default()
        };
        let text = "Works in [DEPARTMENT] with badge [BADGE_NUMBER].";
        let result = rehydrate_reasoning_field(text, &profile);
        assert_eq!(result, "Works in Engineering with badge B-4242.");
    }

}
