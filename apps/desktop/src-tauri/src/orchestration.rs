/**
 * Smart Orchestration Module
 *
 * Analyzes local model responses for uncertainty and delegates to cloud
 * when the local model lacks confidence. Preserves privacy by:
 * 1. Running local model first (PII stays local)
 * 2. Extracting only the core question (stripping PII context)
 * 3. Redacting any remaining PII before cloud send
 * 4. Merging cloud expertise back into conversation
 */

use crate::redaction::{self, RedactTerm, RedactResult};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

/// Shared HTTP client — avoids creating a new connection pool per request.
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("Failed to build HTTP client")
    })
}

// ---------------------------------------------------------------------------
// Uncertainty detection
// ---------------------------------------------------------------------------

/// Signals extracted from analyzing a local model's response.
///
/// `threshold` semantics: confidence values *below* the threshold trigger
/// cloud delegation. A threshold of 0.5 means "delegate when the model is
/// less than 50 % confident." Higher threshold = delegate more often.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UncertaintySignal {
    /// Whether the response is considered uncertain
    pub is_uncertain: bool,
    /// Confidence score: 0.0 = very uncertain, 1.0 = very confident
    pub confidence: f32,
    /// Human-readable reason for the assessment
    pub reason: String,
    /// The core question extracted from the prompt (for cloud delegation)
    pub extracted_question: Option<String>,
}

/// Phrases that indicate the model is explicitly uncertain
const UNCERTAINTY_PHRASES: &[&str] = &[
    "i don't know",
    "i do not know",
    "i'm not sure",
    "i am not sure",
    "i cannot answer",
    "i can't answer",
    "i don't have enough information",
    "i do not have enough information",
    "i'm unable to",
    "i am unable to",
    "beyond my knowledge",
    "outside my training",
    "i would recommend consulting",
    "i'd suggest asking",
    "i cannot provide specific",
    "i can't provide specific",
    "please consult a",
    "you should consult",
    "not qualified to",
    "unable to determine",
    "difficult to say",
    "hard to say",
];

/// Phrases that indicate hedging / low confidence
const HEDGING_PHRASES: &[&str] = &[
    "i think",
    "i believe",
    "it might be",
    "it could be",
    "possibly",
    "perhaps",
    "not entirely sure",
    "may or may not",
    "it's possible that",
    "to the best of my knowledge",
    "as far as i know",
    "i'm not certain",
    "i am not certain",
];

/// Analyze a local model's response for uncertainty signals.
pub fn detect_uncertainty(response: &str, threshold: f32) -> UncertaintySignal {
    let response_lower = response.to_lowercase();
    let response_len = response.trim().len();

    // 1. Very short response (< 30 chars non-whitespace) = likely uncertain
    if response_len < 30 {
        return UncertaintySignal {
            is_uncertain: true,
            confidence: 0.1,
            reason: "Response is very short, suggesting model couldn't formulate an answer".into(),
            extracted_question: None,
        };
    }

    // 2. Check for explicit uncertainty phrases
    let explicit_count = UNCERTAINTY_PHRASES
        .iter()
        .filter(|p| response_lower.contains(**p))
        .count();

    if explicit_count >= 2 {
        return UncertaintySignal {
            is_uncertain: true,
            confidence: 0.1,
            reason: format!("Found {} explicit uncertainty phrases", explicit_count),
            extracted_question: None,
        };
    }

    if explicit_count == 1 {
        return UncertaintySignal {
            is_uncertain: threshold <= 0.6,
            confidence: 0.3,
            reason: "Found explicit uncertainty phrase".into(),
            extracted_question: None,
        };
    }

    // 3. Check for hedging language
    let hedging_count = HEDGING_PHRASES
        .iter()
        .filter(|p| response_lower.contains(**p))
        .count();

    if hedging_count >= 3 {
        return UncertaintySignal {
            is_uncertain: threshold <= 0.5,
            confidence: 0.4,
            reason: format!("Heavy hedging language ({} phrases)", hedging_count),
            extracted_question: None,
        };
    }

    // 4. Check for repetition (consecutive repeated segments)
    let has_repetition = detect_repetition(&response_lower);
    if has_repetition {
        return UncertaintySignal {
            is_uncertain: true,
            confidence: 0.15,
            reason: "Repetitive output detected (model struggling)".into(),
            extracted_question: None,
        };
    }

    // 5. If hedging is mild, slightly reduce confidence
    let confidence = if hedging_count > 0 {
        0.7 - (hedging_count as f32 * 0.1)
    } else {
        0.9
    };

    UncertaintySignal {
        is_uncertain: confidence < threshold,
        confidence,
        reason: if hedging_count > 0 {
            format!("Some hedging ({} phrases), but generally confident", hedging_count)
        } else {
            "Response appears confident".into()
        },
        extracted_question: None,
    }
}

/// Check for repeated text segments (sign of model struggling).
/// Uses a hash-based approach: build a set of 5-word window hashes, then
/// check for any hash that appears 3+ times. O(n) instead of O(n^3).
fn detect_repetition(text: &str) -> bool {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() < 20 {
        return false;
    }

    let window = 5;
    let mut counts: HashMap<u64, u32> = HashMap::new();

    for i in 0..=words.len().saturating_sub(window) {
        let hash = simple_hash(&words[i..i + window]);
        let count = counts.entry(hash).or_insert(0);
        *count += 1;
        if *count >= 3 {
            return true;
        }
    }
    false
}

/// Fast non-crypto hash for a slice of words.
fn simple_hash(words: &[&str]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325; // FNV offset basis
    for w in words {
        for b in w.bytes() {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3); // FNV prime
        }
        h ^= 0xff; // separator
    }
    h
}

// ---------------------------------------------------------------------------
// Question extraction
// ---------------------------------------------------------------------------

/// Extract the core question from a chat prompt, stripping system prompts,
/// context preambles, and instruction boilerplate. Returns the last
/// user-facing question/sentence block.
pub fn extract_question(prompt: &str) -> String {
    // Chat prompts typically end with the user's actual question after
    // a series of system/context blocks. We look for common delimiters.
    let delimiters = [
        "\nUser:", "\nuser:", "\nHuman:", "\nhuman:",
        "\n### User", "\n### Human",
        "\n<|user|>", "\n<|im_start|>user",
        "\n<start_of_turn>user",
    ];

    // Find the last user turn
    let mut last_user_pos = None;
    for delim in delimiters {
        if let Some(pos) = prompt.rfind(delim) {
            let candidate = pos + delim.len();
            if last_user_pos.map_or(true, |prev| candidate > prev) {
                last_user_pos = Some(candidate);
            }
        }
    }

    let question_block = if let Some(pos) = last_user_pos {
        prompt[pos..].trim()
    } else {
        // No delimiter found — take the last paragraph
        let trimmed = prompt.trim();
        trimmed
            .rsplit("\n\n")
            .next()
            .unwrap_or(trimmed)
            .trim()
    };

    // Strip chat template markup that may have leaked into the extracted text
    let cleaned = strip_chat_markup(question_block);

    // Truncate to reasonable length (cloud doesn't need the full prompt)
    let max_len = 1000;
    if cleaned.len() > max_len {
        let mut end = max_len;
        while end > 0 && !cleaned.is_char_boundary(end) {
            end -= 1;
        }
        cleaned[..end].to_string()
    } else {
        cleaned
    }
}

/// Remove chat template tokens and model-specific directives from extracted text.
fn strip_chat_markup(text: &str) -> String {
    let mut s = text.to_string();
    // ChatML (Qwen)
    for tag in ["<|im_end|>", "<|im_start|>assistant", "<|im_start|>user", "<|im_start|>system"] {
        if let Some(pos) = s.find(tag) {
            s.truncate(pos);
        }
    }
    // Gemma
    for tag in ["<end_of_turn>", "<start_of_turn>model", "<start_of_turn>user"] {
        if let Some(pos) = s.find(tag) {
            s.truncate(pos);
        }
    }
    // Qwen3-specific /no_think directive
    s = s.replace("/no_think", "");
    s.trim().to_string()
}

// ---------------------------------------------------------------------------
// PII redaction for cloud delegation
// ---------------------------------------------------------------------------

/// Redact the question using the user's redaction terms before sending to cloud.
/// Returns the redacted text and the redaction result (for logging/audit).
pub fn redact_for_cloud(text: &str, redaction_terms: &[RedactTerm]) -> RedactResult {
    if redaction_terms.is_empty() {
        return RedactResult {
            text: text.to_string(),
            mappings: HashMap::new(),
            redaction_count: 0,
        };
    }
    redaction::redact_text(text, redaction_terms)
}

// ---------------------------------------------------------------------------
// Cloud delegation
// ---------------------------------------------------------------------------

/// Result of cloud delegation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudDelegationResult {
    /// The cloud model's response
    pub cloud_response: String,
    /// Whether delegation was successful
    pub success: bool,
    /// Which cloud model was used
    pub model_used: String,
    /// Error message if delegation failed
    pub error: Option<String>,
    /// Number of PII fields redacted before sending
    pub pii_redacted: usize,
}

/// Send a redacted question to the cloud API (OpenAI-compatible endpoint).
/// The question MUST be redacted before calling this — this function does
/// NOT perform any PII processing.
pub async fn delegate_to_cloud(
    redacted_question: &str,
    api_key: &str,
    api_base_url: &str,
    model: &str,
) -> CloudDelegationResult {
    if api_key.is_empty() {
        return CloudDelegationResult {
            cloud_response: String::new(),
            success: false,
            model_used: model.into(),
            error: Some("No API key configured for cloud delegation".into()),
            pii_redacted: 0,
        };
    }

    let url = format!("{}/chat/completions", api_base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are an expert assistant. Answer the question accurately and concisely. The question may contain anonymized placeholders like [REDACTED_NAME] — answer based on the general topic, not the specific identifiers."
            },
            {
                "role": "user",
                "content": redacted_question
            }
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
        "stream": false
    });

    info!("[orchestration] delegating to cloud: model={}, url={}", model, url);

    let client = http_client();
    let response = match client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!("[orchestration] cloud request failed: {}", e);
            return CloudDelegationResult {
                cloud_response: String::new(),
                success: false,
                model_used: model.into(),
                error: Some(format!("Cloud API request failed: {}", e)),
                pii_redacted: 0,
            };
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        warn!("[orchestration] cloud API error: {} - {}", status, error_text);
        return CloudDelegationResult {
            cloud_response: String::new(),
            success: false,
            model_used: model.into(),
            error: Some(format!("Cloud API returned {}: {}", status, error_text)),
            pii_redacted: 0,
        };
    }

    // Parse OpenAI-compatible response
    #[derive(Deserialize)]
    struct Choice {
        message: ChoiceMessage,
    }
    #[derive(Deserialize)]
    struct ChoiceMessage {
        content: Option<String>,
    }
    #[derive(Deserialize)]
    struct CompletionResponse {
        choices: Vec<Choice>,
    }

    match response.json::<CompletionResponse>().await {
        Ok(parsed) => {
            let content = parsed
                .choices
                .first()
                .and_then(|c| c.message.content.clone())
                .unwrap_or_default();

            info!("[orchestration] cloud response received: {} chars", content.len());

            CloudDelegationResult {
                cloud_response: content,
                success: true,
                model_used: model.into(),
                error: None,
                pii_redacted: 0,
            }
        }
        Err(e) => {
            warn!("[orchestration] failed to parse cloud response: {}", e);
            CloudDelegationResult {
                cloud_response: String::new(),
                success: false,
                model_used: model.into(),
                error: Some(format!("Failed to parse cloud response: {}", e)),
                pii_redacted: 0,
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Orchestrated response
// ---------------------------------------------------------------------------

/// The full orchestrated response returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestratedResponse {
    /// The final response text to show the user
    pub response: String,
    /// Whether the response was enhanced by cloud
    pub cloud_assisted: bool,
    /// Uncertainty analysis of the local response
    pub uncertainty: UncertaintySignal,
    /// Cloud delegation details (if attempted)
    pub cloud_result: Option<CloudDelegationResult>,
    /// The original local model response
    pub local_response: String,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_confident_response() {
        let response = "The Dutch income tax system uses a box system. Box 1 covers income from work and home ownership, taxed at progressive rates from 36.93% to 49.50%. Box 2 covers substantial shareholdings at 24.5% up to €67,000 and 33% above. Box 3 covers savings and investments with a deemed return taxed at 36%.";
        let signal = detect_uncertainty(response, 0.5);
        assert!(!signal.is_uncertain);
        assert!(signal.confidence > 0.7);
    }

    #[test]
    fn test_uncertain_response_explicit() {
        let response = "I'm not sure about the specific tax rates. I don't have enough information about your situation to give a definitive answer.";
        let signal = detect_uncertainty(response, 0.5);
        assert!(signal.is_uncertain);
        assert!(signal.confidence < 0.4);
    }

    #[test]
    fn test_uncertain_response_short() {
        let response = "I don't know.";
        let signal = detect_uncertainty(response, 0.5);
        assert!(signal.is_uncertain);
        assert!(signal.confidence < 0.2);
    }

    #[test]
    fn test_hedging_response() {
        let response = "I think the tax rate might be around 30%. It could be different for your case. Perhaps you should check with the Belastingdienst. Possibly there are deductions available.";
        let signal = detect_uncertainty(response, 0.5);
        assert!(signal.is_uncertain);
        assert!(signal.confidence < 0.5);
    }

    #[test]
    fn test_threshold_effect() {
        let response = "I believe the standard deduction is €2,000 for healthcare costs.";
        let signal_low = detect_uncertainty(response, 0.2);
        assert!(!signal_low.is_uncertain);
        let signal_high = detect_uncertainty(response, 0.8);
        assert!(signal_high.is_uncertain);
    }

    #[test]
    fn test_repetition_detection() {
        let repeated = "we need to consider the tax rate for income which is the tax rate for income which is the tax rate for income which is important for your filing status and deductions";
        assert!(detect_repetition(repeated));
    }

    #[test]
    fn test_no_repetition() {
        let normal = "the tax rate for box one is progressive starting at thirty six percent and going up to forty nine percent for high earners";
        assert!(!detect_repetition(normal));
    }

    #[test]
    fn test_empty_response() {
        let signal = detect_uncertainty("", 0.5);
        assert!(signal.is_uncertain);
    }

    // --- Question extraction tests ---

    #[test]
    fn test_strip_chat_markup_chatml() {
        let text = "What is the box 3 rate? /no_think<|im_end|>\n<|im_start|>assistant\n";
        let cleaned = strip_chat_markup(text);
        assert_eq!(cleaned, "What is the box 3 rate?");
    }

    #[test]
    fn test_strip_chat_markup_gemma() {
        let text = "What is the box 3 rate?<end_of_turn>\n<start_of_turn>model\n";
        let cleaned = strip_chat_markup(text);
        assert_eq!(cleaned, "What is the box 3 rate?");
    }

    #[test]
    fn test_extract_question_with_delimiter() {
        let prompt = "System: You are a tax assistant.\n\nContext: Dutch tax law.\n\nUser: What is the box 3 rate for 2025?";
        let q = extract_question(prompt);
        assert_eq!(q, "What is the box 3 rate for 2025?");
    }

    #[test]
    fn test_extract_question_no_delimiter() {
        let prompt = "Some background context about taxes.\n\nHow much tax do I owe on savings?";
        let q = extract_question(prompt);
        assert_eq!(q, "How much tax do I owe on savings?");
    }

    #[test]
    fn test_extract_question_truncates() {
        let long = "x ".repeat(600);
        let prompt = format!("User: {}", long);
        let q = extract_question(&prompt);
        assert!(q.len() <= 1000);
    }

    // --- Redaction tests ---

    #[test]
    fn test_redact_for_cloud() {
        let terms = vec![
            RedactTerm { label: "name".into(), value: "Stefano".into(), replacement: "[REDACTED_NAME]".into() },
            RedactTerm { label: "bsn".into(), value: "123456789".into(), replacement: "[REDACTED_BSN]".into() },
        ];
        let result = redact_for_cloud("My name is Stefano and my BSN is 123456789", &terms);
        assert!(!result.text.contains("Stefano"));
        assert!(!result.text.contains("123456789"));
        assert!(result.text.contains("[REDACTED_NAME]"));
        assert!(result.text.contains("[REDACTED_BSN]"));
        assert_eq!(result.redaction_count, 2);
    }

    #[test]
    fn test_redact_empty_terms() {
        let result = redact_for_cloud("Hello world", &[]);
        assert_eq!(result.text, "Hello world");
        assert_eq!(result.redaction_count, 0);
    }
}
