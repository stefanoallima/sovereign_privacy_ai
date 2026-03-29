/**
 * Form Fill Commands
 *
 * Tauri commands that expose form-fill functionality to the frontend.
 * Uses the local LLM for field extraction and reasoning composition,
 * ensuring PII never leaves the device.
 */

use log::{error, info};
use std::sync::Arc;
use tauri::State;

use crate::form_fill::{self, FieldMatchResult, FormField};
use crate::inference_commands::InferenceState;
use crate::user_profile::UserProfile;

/// Helper: clone the inference Arc out of the Tauri state.
async fn get_inference(
    state: &State<'_, InferenceState>,
) -> Arc<dyn crate::inference::LocalInference> {
    let guard = state.0.lock().await;
    guard.clone()
}

/// Extract form fields from document text using the local LLM.
///
/// The LLM receives only the blank form template (no PII).
/// Returns a list of `FormField` structs describing the detected fields.
#[tauri::command]
pub async fn extract_form_fields(
    form_text: String,
    state: State<'_, InferenceState>,
) -> Result<Vec<FormField>, String> {
    info!(
        "extract_form_fields: analyzing form ({} chars)",
        form_text.len()
    );

    let prompt = form_fill::build_field_extraction_prompt(&form_text);
    let inference = get_inference(&state).await;
    let model_name = inference.default_model().to_string();

    let response = inference
        .generate(&prompt, &model_name)
        .await
        .map_err(|e| {
            error!("LLM field extraction failed: {}", e);
            format!("LLM error: {}", e)
        })?;

    form_fill::parse_field_extraction_response(&response)
}

/// Match extracted form fields against the user's local profile.
///
/// Pure local operation -- no LLM call, no network.
/// Splits fields into matched (have values), gaps (need user input),
/// and reasoning (need LLM composition).
#[tauri::command]
pub async fn match_form_fields_to_profile(
    fields: Vec<FormField>,
    profile: UserProfile,
) -> Result<FieldMatchResult, String> {
    info!(
        "match_form_fields_to_profile: {} fields against profile id={}",
        fields.len(),
        profile.id
    );
    Ok(form_fill::match_profile_fields(fields, &profile))
}

/// Compose text for a "reasoning" form field using the LLM.
///
/// The LLM receives a prompt with placeholder tokens only (e.g. [JOB_TITLE]).
/// After the LLM responds, placeholders are rehydrated locally with real PII values.
#[tauri::command]
pub async fn compose_reasoning_field(
    field: FormField,
    profile: UserProfile,
    state: State<'_, InferenceState>,
) -> Result<String, String> {
    info!(
        "compose_reasoning_field: label=\"{}\"",
        field.label
    );

    let prompt = form_fill::build_reasoning_prompt(&field, &profile);

    // Safety check: ensure no PII leaked into the prompt
    let sensitive_fields: Vec<(&str, Option<&String>)> = vec![
        ("full_name", profile.full_name.as_ref()),
        ("bsn", profile.bsn.as_ref()),
        ("email", profile.email.as_ref()),
        ("phone", profile.phone.as_ref()),
        ("iban", profile.iban.as_ref()),
        ("employer_name", profile.employer_name.as_ref()),
        ("date_of_birth", profile.date_of_birth.as_ref()),
        ("bank_name", profile.bank_name.as_ref()),
    ];
    for (field_name, field_value) in &sensitive_fields {
        if let Some(val) = field_value {
            if !val.is_empty() && val.len() >= 3 && prompt.contains(val.as_str()) {
                return Err(format!("Privacy violation: {} detected in LLM prompt", field_name));
            }
        }
    }
    // Also check address
    if let Some(ref addr) = profile.address {
        if !addr.street.is_empty() && addr.street.len() >= 3 && prompt.contains(addr.street.as_str()) {
            return Err("Privacy violation: address detected in LLM prompt".to_string());
        }
    }

    let inference = get_inference(&state).await;
    let model_name = inference.default_model().to_string();

    let response = inference
        .generate(&prompt, &model_name)
        .await
        .map_err(|e| {
            error!("LLM reasoning composition failed: {}", e);
            format!("LLM error: {}", e)
        })?;

    // Rehydrate placeholders with real values locally
    Ok(form_fill::rehydrate_reasoning_field(&response, &profile))
}
