use tauri::command;

#[derive(serde::Deserialize)]
pub struct SupportIssue {
    pub title: String,
    pub body: String,
    pub labels: Vec<String>,
}

#[command]
pub async fn submit_support_issue(issue: SupportIssue) -> Result<String, String> {
    let token = option_env!("GITHUB_SUPPORT_PAT").unwrap_or("");
    if token.is_empty() {
        return Err("Support issue submission is not configured (no PAT).".to_string());
    }

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.github.com/repos/stefanoallima/private_personal_assistant/issues")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "SovereignAI")
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({
            "title": issue.title,
            "body": issue.body,
            "labels": issue.labels,
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json["html_url"].as_str().unwrap_or("").to_string())
}
