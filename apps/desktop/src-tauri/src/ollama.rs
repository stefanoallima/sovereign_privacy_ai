use serde::{Deserialize, Serialize};
use std::error::Error;
use reqwest::Client;
use log::{info, warn, error};

/// Ollama model configuration
const DEFAULT_OLLAMA_HOST: &str = "http://localhost:11434";
const PII_EXTRACTION_MODEL: &str = "mistral:7b-instruct-q5_K_M";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PIIExtraction {
    pub bsn: Option<String>,
    pub name: Option<String>,
    pub surname: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub income: Option<String>,
    pub confidence_scores: PIIConfidenceScores,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PIIConfidenceScores {
    pub bsn: f32,
    pub name: f32,
    pub surname: f32,
    pub phone: f32,
    pub address: f32,
    pub email: f32,
    pub income: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
    #[serde(default)]
    done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
    format: Option<String>,
}

/// Ollama client for local LLM inference
#[derive(Clone)]
pub struct OllamaClient {
    host: String,
    client: Client,
    model: String,
}

impl OllamaClient {
    /// Create a new Ollama client
    pub fn new(host: Option<String>, model: Option<String>) -> Self {
        OllamaClient {
            host: host.unwrap_or_else(|| DEFAULT_OLLAMA_HOST.to_string()),
            client: Client::new(),
            model: model.unwrap_or_else(|| PII_EXTRACTION_MODEL.to_string()),
        }
    }

    /// Check if Ollama is available
    pub async fn is_available(&self) -> bool {
        let url = format!("{}/api/tags", self.host);
        match self.client.get(&url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(response) => response.status().is_success(),
            Err(e) => {
                warn!("Ollama health check failed: {}", e);
                false
            }
        }
    }

    /// Extract PII from text using Ollama
    pub async fn extract_pii(&self, text: &str) -> Result<PIIExtraction, Box<dyn Error>> {
        info!("Starting PII extraction from text (length: {} chars)", text.len());

        let prompt = self.build_pii_extraction_prompt(text);

        let request = OllamaGenerateRequest {
            model: self.model.clone(),
            prompt,
            stream: false,
            format: Some("json".to_string()),
        };

        let url = format!("{}/api/generate", self.host);

        let response = self.client
            .post(&url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await?;

        if !response.status().is_success() {
            error!("Ollama API error: {}", response.status());
            return Err("Ollama API request failed".into());
        }

        let ollama_response: OllamaResponse = response.json().await?;

        // Parse JSON response
        let extraction = self.parse_pii_extraction(&ollama_response.response)?;

        info!("PII extraction completed. Found: BSN={}, name={}, phone={}",
            extraction.bsn.is_some(),
            extraction.name.is_some(),
            extraction.phone.is_some()
        );

        Ok(extraction)
    }

    /// Build the prompt for PII extraction
    fn build_pii_extraction_prompt(&self, text: &str) -> String {
        format!(
            r#"Extract personally identifiable information from the following Dutch text.
Return a JSON object with the following fields (use null for missing values):
- bsn: Dutch tax ID / BSN (9 digits)
- name: First name(s)
- surname: Last name
- phone: Phone number
- address: Full address
- email: Email address
- income: Annual income if mentioned

Text to analyze:
{}

Return ONLY valid JSON, no markdown, no extra text."#,
            text
        )
    }

    /// Parse the PII extraction response from Ollama
    fn parse_pii_extraction(&self, response: &str) -> Result<PIIExtraction, Box<dyn Error>> {
        // Try to extract JSON from the response (it might contain extra text)
        let json_str = response.trim();

        let extraction: PIIExtraction = serde_json::from_str(json_str)
            .map_err(|e| {
                error!("Failed to parse Ollama response as JSON: {}", e);
                Box::new(e) as Box<dyn Error>
            })?;

        Ok(extraction)
    }

    /// Generate generic text (for future use)
    pub async fn generate(&self, prompt: &str) -> Result<String, Box<dyn Error>> {
        self.generate_with_model(prompt, &self.model).await
    }

    /// Generate text with a specific model
    pub async fn generate_with_model(&self, prompt: &str, model: &str) -> Result<String, Box<dyn Error>> {
        info!("Generating text with Ollama model: {}", model);

        let request = OllamaGenerateRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            stream: false,
            format: None,
        };

        let url = format!("{}/api/generate", self.host);

        let response = self.client
            .post(&url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(120)) // 2 minutes for longer responses
            .send()
            .await?;

        if !response.status().is_success() {
            error!("Ollama API error: {}", response.status());
            return Err("Ollama API request failed".into());
        }

        let ollama_response: OllamaResponse = response.json().await?;

        Ok(ollama_response.response)
    }

    /// Generate JSON response (for structured extraction)
    pub async fn generate_json(&self, prompt: &str) -> Result<String, Box<dyn Error + Send + Sync>> {
        info!("Generating JSON with Ollama");

        let request = OllamaGenerateRequest {
            model: self.model.clone(),
            prompt: prompt.to_string(),
            stream: false,
            format: Some("json".to_string()),
        };

        let url = format!("{}/api/generate", self.host);

        let response = self.client
            .post(&url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(90))
            .send()
            .await?;

        if !response.status().is_success() {
            error!("Ollama API error: {}", response.status());
            return Err("Ollama API request failed".into());
        }

        let ollama_response: OllamaResponse = response.json().await?;

        Ok(ollama_response.response)
    }

    /// Pull a model from Ollama registry (for initialization)
    pub async fn pull_model(&self, model_name: &str) -> Result<(), Box<dyn Error>> {
        info!("Pulling model: {}", model_name);

        let url = format!("{}/api/pull", self.host);

        let payload = serde_json::json!({
            "name": model_name,
            "stream": false
        });

        let response = self.client
            .post(&url)
            .json(&payload)
            .timeout(std::time::Duration::from_secs(600)) // 10 minutes for download
            .send()
            .await?;

        if !response.status().is_success() {
            error!("Failed to pull model: {}", response.status());
            return Err("Failed to pull model from Ollama".into());
        }

        info!("Model {} pulled successfully", model_name);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pii_extraction_prompt_building() {
        let client = OllamaClient::new(None, None);
        let text = "My name is Jan Jansen, BSN 123456789";
        let prompt = client.build_pii_extraction_prompt(text);

        assert!(prompt.contains("Extract personally identifiable information"));
        assert!(prompt.contains("Jan Jansen"));
        assert!(prompt.contains("bsn"));
        assert!(prompt.contains("name"));
    }

    #[test]
    fn test_pii_extraction_parsing() {
        let client = OllamaClient::new(None, None);
        let json_response = r#"{
            "bsn": "123456789",
            "name": "Jan",
            "surname": "Jansen",
            "phone": "+31612345678",
            "address": "Straat 1, Amsterdam",
            "email": "jan@example.com",
            "income": "50000",
            "confidence_scores": {
                "bsn": 0.95,
                "name": 0.98,
                "surname": 0.97,
                "phone": 0.92,
                "address": 0.88,
                "email": 0.94,
                "income": 0.85
            }
        }"#;

        let result = client.parse_pii_extraction(json_response);
        assert!(result.is_ok());

        let extraction = result.unwrap();
        assert_eq!(extraction.bsn, Some("123456789".to_string()));
        assert_eq!(extraction.name, Some("Jan".to_string()));
    }
}
