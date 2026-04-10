use crate::orchestration::{self, OrchestratedResponse, UncertaintySignal, CloudDelegationResult};
use crate::redaction::RedactTerm;
use crate::inference_commands::InferenceState;
use std::sync::Arc;
use tauri::State;
use log::info;

/// Run orchestrated inference: local model first, then optionally delegate to cloud.
///
/// Privacy-safe flow:
/// 1. Generate response from local model
/// 2. Analyze response for uncertainty
/// 3. If uncertain AND cloud delegation enabled:
///    a. Extract the core question from the prompt
///    b. Redact PII using the caller-supplied redaction terms
///    c. Send redacted question to cloud
/// 4. Return orchestrated response with metadata
#[tauri::command]
pub async fn orchestrated_generate(
    prompt: String,
    enable_cloud_delegation: bool,
    cloud_delegation_threshold: f64,
    api_key: Option<String>,
    api_base_url: Option<String>,
    cloud_model: Option<String>,
    redaction_terms: Option<Vec<RedactTerm>>,
    state: State<'_, InferenceState>,
) -> Result<OrchestratedResponse, String> {
    let inference = {
        let guard = state.0.lock().await;
        guard.clone()
    };

    info!("[orchestration] starting orchestrated generate, cloud_delegation={}", enable_cloud_delegation);

    // Step 1: Generate local response
    let local_response = inference
        .generate(&prompt, inference.default_model())
        .await
        .map_err(|e| format!("Local inference failed: {}", e))?;

    // Step 2: Analyze uncertainty
    let threshold = cloud_delegation_threshold as f32;
    let mut uncertainty = orchestration::detect_uncertainty(&local_response, threshold);

    info!(
        "[orchestration] uncertainty: is_uncertain={}, confidence={:.2}, reason={}",
        uncertainty.is_uncertain, uncertainty.confidence, uncertainty.reason
    );

    // Step 3: If uncertain and delegation is enabled, delegate to cloud
    if uncertainty.is_uncertain && enable_cloud_delegation {
        let key = api_key.unwrap_or_default();
        let base_url = api_base_url.unwrap_or_else(|| "https://api.studio.nebius.ai/v1".into());
        let model = cloud_model.unwrap_or_else(|| "Qwen/Qwen3-32B".into());

        if key.is_empty() {
            return Ok(OrchestratedResponse {
                response: local_response.clone(),
                cloud_assisted: false,
                uncertainty,
                cloud_result: Some(CloudDelegationResult {
                    cloud_response: String::new(),
                    success: false,
                    model_used: model,
                    error: Some("Cloud delegation enabled but no API key configured".into()),
                    pii_redacted: 0,
                }),
                local_response,
            });
        }

        // Step 3a: Extract the core question (strip system prompt / context boilerplate)
        let core_question = orchestration::extract_question(&prompt);
        uncertainty.extracted_question = Some(core_question.clone());

        // Step 3b: Redact PII from the question using caller-supplied terms
        let terms = redaction_terms.unwrap_or_default();
        let redacted = orchestration::redact_for_cloud(&core_question, &terms);

        info!(
            "[orchestration] redacted {} PII fields before cloud delegation",
            redacted.redaction_count
        );

        // Step 3c: Send redacted question to cloud
        let mut cloud_result = orchestration::delegate_to_cloud(
            &redacted.text,
            &key,
            &base_url,
            &model,
        )
        .await;
        cloud_result.pii_redacted = redacted.redaction_count;

        if cloud_result.success && !cloud_result.cloud_response.is_empty() {
            return Ok(OrchestratedResponse {
                response: cloud_result.cloud_response.clone(),
                cloud_assisted: true,
                uncertainty,
                cloud_result: Some(cloud_result),
                local_response,
            });
        }

        // Cloud failed — fall back to local response
        return Ok(OrchestratedResponse {
            response: local_response.clone(),
            cloud_assisted: false,
            uncertainty,
            cloud_result: Some(cloud_result),
            local_response,
        });
    }

    // Local model is confident — return directly
    Ok(OrchestratedResponse {
        response: local_response.clone(),
        cloud_assisted: false,
        uncertainty,
        cloud_result: None,
        local_response,
    })
}

/// Check uncertainty of a response without delegating to cloud.
/// Useful for frontend to display confidence indicators.
#[tauri::command]
pub async fn check_response_uncertainty(
    response: String,
    threshold: f64,
) -> Result<UncertaintySignal, String> {
    Ok(orchestration::detect_uncertainty(&response, threshold as f32))
}
