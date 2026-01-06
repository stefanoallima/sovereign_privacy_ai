# LLM Integration Specification

## ADDED Requirements

### Requirement: Nebius API Integration
The system SHALL integrate with Nebius AI Studio using their OpenAI-compatible API.

#### Scenario: Configure API credentials
- **WHEN** user enters their Nebius API key in settings
- **THEN** the system validates the key with a test request
- **AND** stores the key securely (encrypted in SQLite)

#### Scenario: Send chat completion request
- **WHEN** user sends a message
- **THEN** the system constructs a prompt with: system prompt, contexts, RAG results, conversation history, user message
- **AND** sends it to the Nebius API

#### Scenario: Handle API errors
- **WHEN** the API returns an error (rate limit, invalid key, server error)
- **THEN** the system displays a user-friendly error message
- **AND** offers retry for transient errors

### Requirement: Streaming Responses
The system SHALL support streaming LLM responses.

#### Scenario: Stream tokens to UI
- **WHEN** the API streams response tokens
- **THEN** the system displays tokens in real-time in the chat
- **AND** shows a typing indicator until complete

#### Scenario: Stream tokens to TTS
- **WHEN** voice mode is enabled
- **THEN** complete sentences are sent to TTS as they arrive
- **AND** spoken without waiting for full response

#### Scenario: Cancel streaming
- **WHEN** user sends a new message before response completes
- **THEN** the system cancels the current stream
- **AND** starts processing the new message

### Requirement: Model Selection
The system SHALL support multiple LLM models.

#### Scenario: List available models
- **WHEN** user opens model settings
- **THEN** the system displays available Nebius models with: name, context window, speed tier, intelligence tier, cost per 1M tokens

#### Scenario: Select model for conversation
- **WHEN** user selects a model from the context panel
- **THEN** subsequent messages use that model
- **AND** cost estimates update accordingly

#### Scenario: Enable/disable models
- **WHEN** user disables a model in settings
- **THEN** it no longer appears in the model selector
- **AND** existing conversations using it continue to work

#### Scenario: Set default model
- **WHEN** user sets a model as default
- **THEN** new conversations use that model
- **AND** the setting persists across app restarts

### Requirement: Model Configuration
The system SHALL support per-model configuration.

#### Scenario: Configure model pricing
- **WHEN** Nebius updates their pricing
- **THEN** user can update cost values in settings
- **AND** cost estimates use the new values

#### Scenario: Add custom model
- **WHEN** Nebius adds a new model
- **THEN** user can add it manually with: API model ID, display name, context window, costs
- **AND** it appears in the model selector

### Requirement: Prompt Construction
The system SHALL construct prompts from multiple sources.

#### Scenario: Prompt assembly order
- **WHEN** constructing a prompt
- **THEN** the system assembles in order: system prompt (from persona), personal contexts (selected), RAG results (retrieved), conversation history (recent messages), user message (current)

#### Scenario: Context window management
- **WHEN** total prompt exceeds model's context window
- **THEN** the system truncates conversation history (oldest first)
- **AND** preserves system prompt, contexts, and recent messages

#### Scenario: History sliding window
- **WHEN** conversation history is too long
- **THEN** the system keeps the most recent N messages that fit
- **AND** optionally prepends a summary of older messages (future feature)

### Requirement: Usage Tracking
The system SHALL track API usage for cost monitoring.

#### Scenario: Track tokens per request
- **WHEN** a request completes
- **THEN** the system records: input tokens, output tokens, model used, timestamp, latency

#### Scenario: Display daily usage
- **WHEN** user views usage dashboard
- **THEN** the system shows: today's tokens (in/out), today's estimated cost, breakdown by model

#### Scenario: Display monthly usage
- **WHEN** user views monthly statistics
- **THEN** the system shows: total tokens this month, total cost, daily averages, busiest days

#### Scenario: Usage warning
- **WHEN** daily usage exceeds a configurable threshold
- **THEN** the system displays a notification
- **AND** continues to function normally

### Requirement: Retry and Resilience
The system SHALL handle transient failures gracefully.

#### Scenario: Retry on timeout
- **WHEN** a request times out
- **THEN** the system retries up to 3 times with exponential backoff
- **AND** shows a "retrying" indicator

#### Scenario: Offline handling
- **WHEN** the network is unavailable
- **THEN** the system queues the message
- **AND** displays an offline indicator
- **AND** sends when connection is restored
