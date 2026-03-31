use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactTerm {
    pub label: String,
    pub value: String,
    pub replacement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactResult {
    pub text: String,
    pub mappings: HashMap<String, String>,
    pub redaction_count: usize,
}

pub fn redact_text(text: &str, terms: &[RedactTerm]) -> RedactResult {
    let mut redacted = text.to_string();
    let mut mappings = HashMap::new();
    let mut total_matches: usize = 0;

    for term in terms {
        if term.value.len() < 2 {
            continue;
        }
        let escaped = regex::escape(&term.value);
        if let Ok(re) = Regex::new(&format!("(?i){}", escaped)) {
            let count = re.find_iter(&redacted).count();
            if count > 0 {
                mappings.insert(term.replacement.clone(), term.value.clone());
                redacted = re
                    .replace_all(&redacted, term.replacement.as_str())
                    .to_string();
                total_matches += count;
            }
        }
    }

    RedactResult {
        text: redacted,
        mappings,
        redaction_count: total_matches,
    }
}

pub fn rehydrate_text(redacted: &str, mappings: &HashMap<String, String>) -> String {
    let mut result = redacted.to_string();
    for (placeholder, original) in mappings {
        result = result.replace(placeholder, original);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        let terms = vec![RedactTerm {
            label: "name".into(),
            value: "Alice".into(),
            replacement: "[NAME]".into(),
        }];
        let result = redact_text("Hello Alice, welcome back.", &terms);
        assert_eq!(result.text, "Hello [NAME], welcome back.");
        assert_eq!(result.mappings.get("[NAME]"), Some(&"Alice".to_string()));
        assert_eq!(result.redaction_count, 1);
    }

    #[test]
    fn test_case_insensitive() {
        let terms = vec![RedactTerm {
            label: "city".into(),
            value: "Amsterdam".into(),
            replacement: "[CITY]".into(),
        }];
        let result = redact_text("I live in amsterdam and love Amsterdam.", &terms);
        assert_eq!(result.text, "I live in [CITY] and love [CITY].");
        assert_eq!(result.redaction_count, 2);
    }

    #[test]
    fn test_empty_terms() {
        let result = redact_text("No redaction here.", &[]);
        assert_eq!(result.text, "No redaction here.");
        assert!(result.mappings.is_empty());
        assert_eq!(result.redaction_count, 0);
    }

    #[test]
    fn test_skip_short_values() {
        let terms = vec![
            RedactTerm {
                label: "city".into(),
                value: "X".into(),
                replacement: "[CITY]".into(),
            },
            RedactTerm {
                label: "name".into(),
                value: "Bob".into(),
                replacement: "[NAME]".into(),
            },
        ];
        let result = redact_text("Go to X Bob", &terms);
        assert_eq!(result.text, "Go to X [NAME]");
        assert_eq!(result.mappings.len(), 1);
        assert_eq!(result.redaction_count, 1);
    }

    #[test]
    fn test_rehydrate() {
        let terms = vec![RedactTerm {
            label: "email".into(),
            value: "user@example.com".into(),
            replacement: "[EMAIL]".into(),
        }];
        let result = redact_text("Email: user@example.com", &terms);
        let rehydrated = rehydrate_text(&result.text, &result.mappings);
        assert_eq!(rehydrated, "Email: user@example.com");
    }

    #[test]
    fn test_special_chars() {
        let terms = vec![RedactTerm {
            label: "email".into(),
            value: "john.doe+test@mail.nl".into(),
            replacement: "[EMAIL]".into(),
        }];
        let result = redact_text("Send to john.doe+test@mail.nl please.", &terms);
        assert_eq!(result.text, "Send to [EMAIL] please.");
        assert_eq!(
            result.mappings.get("[EMAIL]"),
            Some(&"john.doe+test@mail.nl".to_string())
        );
        assert_eq!(result.redaction_count, 1);
    }

    #[test]
    fn test_multiple_terms_count() {
        let terms = vec![
            RedactTerm {
                label: "name".into(),
                value: "Jan".into(),
                replacement: "[NAME]".into(),
            },
            RedactTerm {
                label: "city".into(),
                value: "Utrecht".into(),
                replacement: "[CITY]".into(),
            },
        ];
        let result = redact_text("Jan lives in Utrecht. Jan loves Utrecht.", &terms);
        assert_eq!(result.text, "[NAME] lives in [CITY]. [NAME] loves [CITY].");
        assert_eq!(result.redaction_count, 4);
        assert_eq!(result.mappings.len(), 2);
    }
}
