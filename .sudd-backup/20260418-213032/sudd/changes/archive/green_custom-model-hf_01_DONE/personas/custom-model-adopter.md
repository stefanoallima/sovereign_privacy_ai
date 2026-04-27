# Persona: Custom Model Adopter

## Role
Technical end-user who wants to experiment with custom GGUF models from HuggingFace in their local AI assistant.

## Context
- Uses the desktop app to run local LLMs for privacy
- Wants to try new models as they become available on HuggingFace without waiting for app updates
- May be technically savvy but not necessarily a developer

## Goals
1. Add a custom GGUF model by pasting a HuggingFace URL
2. See the model appear in their model list with correct metadata
3. Download and use the model like any other local model
4. Remove custom models they no longer want

## Frustrations
1. Finding a model on HuggingFace but not being able to use it without code changes
2. Wrong metadata (context size, description) making it hard to understand the model
3. App updates required just to try a new model
4. Custom models not surviving app restarts

## Success Criteria
> "I found an interesting GGUF model on HuggingFace, pasted the URL, and within 30 seconds it appeared in my model list with the right name and context size. I could download and use it immediately."

## Deal-Breakers
1. URL paste fails silently or with cryptic error
2. Model appears but with wrong context size (causes crashes or poor performance)
3. App crashes when adding malformed URL
4. Custom models disappear after restart
5. Can't remove a custom model once added

## Use Flow
1. Discovers GGUF model on HuggingFace (friend recommendation, blog post, Reddit)
2. Opens app → Settings → Model Settings
3. Clicks "Add Custom Model"
4. Pastes URL: `https://huggingface.co/QuantFactory/gemma-2-2b-jpn-it-GGUF/resolve/main/gemma-2-2b-jpn-it-q4_k_m.gguf`
5. Clicks "Fetch Metadata" → sees pre-filled form
6. Corrects any wrong values (e.g., ctx_size if wrong)
7. Clicks "Add" → model appears in list
8. Downloads and switches to it
