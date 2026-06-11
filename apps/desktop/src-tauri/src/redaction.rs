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

    // Sort by descending value length to prevent short matches corrupting longer ones
    let mut sorted_terms: Vec<&RedactTerm> = terms.iter()
        .filter(|t| t.value.len() >= 2)
        .collect();
    sorted_terms.sort_by(|a, b| b.value.len().cmp(&a.value.len()));

    for term in sorted_terms {
        // Build a whitespace-flexible, case-insensitive pattern: split the value
        // on whitespace, escape each word literally, and rejoin with `\s+` so a
        // run of whitespace in the value matches one-or-more whitespace chars in
        // the text. This keeps the SAME token for the same value across spacing
        // variants ("Mario Rossi" / "Mario  Rossi" / "Mario\nRossi") that
        // PDF-extracted documents routinely produce.
        let pattern = term
            .value
            .split_whitespace()
            .map(regex::escape)
            .collect::<Vec<_>>()
            .join(r"\s+");
        if pattern.is_empty() {
            continue; // value was whitespace-only — nothing to match
        }
        if let Ok(re) = Regex::new(&format!("(?i){}", pattern)) {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactMessagesResult {
    pub messages: Vec<String>,
    pub mappings: HashMap<String, String>,
    pub redaction_count: usize,
}

/// Redact PII from EVERY message in a conversation, not just the latest one,
/// merging all placeholder→value mappings so the response can be rehydrated.
///
/// This closes the privacy leak where only the current user message was
/// anonymized while conversation history was sent to the cloud in cleartext.
pub fn redact_messages(messages: &[String], terms: &[RedactTerm]) -> RedactMessagesResult {
    let mut out_messages = Vec::with_capacity(messages.len());
    let mut mappings: HashMap<String, String> = HashMap::new();
    let mut redaction_count = 0usize;

    for msg in messages {
        let result = redact_text(msg, terms);
        redaction_count += result.redaction_count;
        // Same terms across messages → consistent placeholder→value mapping.
        mappings.extend(result.mappings);
        out_messages.push(result.text);
    }

    RedactMessagesResult {
        messages: out_messages,
        mappings,
        redaction_count,
    }
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

    #[test]
    fn test_redact_substring_ordering() {
        let terms = vec![
            RedactTerm {
                label: "Name".into(),
                value: "Jane".into(),
                replacement: "nam2xxxx".into(),
            },
            RedactTerm {
                label: "Name".into(),
                value: "Jan".into(),
                replacement: "nam1xxx".into(),
            },
        ];
        let result = redact_text("Jan and Jane went home.", &terms);
        // "Jane" should be matched first (longer), then "Jan"
        assert!(result.text.contains("nam2xxxx"), "Jane should be replaced: {}", result.text);
        assert!(result.text.contains("nam1xxx"), "Jan should be replaced: {}", result.text);
        assert!(!result.text.contains("Jan"), "Raw Jan should be gone: {}", result.text);
    }

    #[test]
    fn test_redact_messages_covers_entire_conversation_not_just_last() {
        // Regression guard for the privacy leak: previously only the current
        // message was anonymized while conversation history was sent to the
        // cloud in cleartext. redact_messages must scrub EVERY message.
        let terms = vec![
            RedactTerm {
                label: "name".into(),
                value: "Alice".into(),
                replacement: "[NAME_1]".into(),
            },
            RedactTerm {
                label: "email".into(),
                value: "alice@example.com".into(),
                replacement: "[EMAIL_1]".into(),
            },
        ];
        let messages = vec![
            "My name is Alice".to_string(),                  // earlier history turn
            "You can reach me at alice@example.com".to_string(), // earlier history turn
            "What are my options?".to_string(),              // current message (no PII)
        ];

        let result = redact_messages(&messages, &terms);

        // Every message redacted — not just the last one.
        assert_eq!(result.messages[0], "My name is [NAME_1]");
        assert_eq!(result.messages[1], "You can reach me at [EMAIL_1]");
        assert_eq!(result.messages[2], "What are my options?");

        // No raw PII survives in ANY cloud-bound message.
        for m in &result.messages {
            assert!(!m.contains("Alice"), "raw name leaked: {m}");
            assert!(!m.contains("alice@example.com"), "raw email leaked: {m}");
        }

        // Merged mappings cover all turns and round-trip via rehydrate_text.
        assert_eq!(result.mappings.get("[NAME_1]"), Some(&"Alice".to_string()));
        assert_eq!(
            result.mappings.get("[EMAIL_1]"),
            Some(&"alice@example.com".to_string())
        );
        assert_eq!(result.redaction_count, 2);
    }

    #[test]
    fn test_redact_matches_internal_whitespace_variants() {
        // PDF-extracted legal documents routinely produce irregular spacing.
        // The SAME registered value must still be redacted — with the SAME
        // token — whether the text has one space or several between words,
        // otherwise the cloud model sees two different people.
        let terms = vec![RedactTerm {
            label: "Name".into(),
            value: "Mario Rossi".into(),
            replacement: "nam_1______".into(),
        }];
        let result = redact_text("Cliente: Mario  Rossi; ancora Mario Rossi.", &terms);
        assert!(
            !result.text.contains("Mario"),
            "raw name (incl. double-spaced) leaked: {}",
            result.text
        );
        assert_eq!(
            result.text.matches("nam_1______").count(),
            2,
            "both spacing variants must map to the same token: {}",
            result.text
        );
        assert_eq!(result.redaction_count, 2);
    }

    #[test]
    fn test_redact_matches_across_line_break() {
        // A name split across a line break (very common in extracted PDFs)
        // must still match the registered single-space value.
        let terms = vec![RedactTerm {
            label: "Name".into(),
            value: "Mario Rossi".into(),
            replacement: "nam_1______".into(),
        }];
        let result = redact_text("Egregio\nMario\nRossi,", &terms);
        assert!(!result.text.contains("Rossi"), "raw name leaked: {}", result.text);
        assert_eq!(result.redaction_count, 1);
    }
}