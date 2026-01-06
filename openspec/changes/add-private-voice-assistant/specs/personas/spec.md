# Personas Specification

## ADDED Requirements

### Requirement: Persona Definition
The system SHALL support AI personas that define personality, expertise, and behavior.

#### Scenario: Persona attributes
- **WHEN** a persona is defined
- **THEN** it includes: name, description, system prompt, preferred voice, preferred model, associated knowledge bases, temperature, and max tokens

#### Scenario: Built-in personas
- **WHEN** the app is first installed
- **THEN** the system provides default personas: Psychologist, Life Coach, and Career Coach
- **AND** these personas cannot be deleted (only modified)

### Requirement: Persona Selection
The system SHALL allow users to select which persona to use for conversations.

#### Scenario: Select persona for conversation
- **WHEN** user selects a persona from the context panel
- **THEN** subsequent messages use that persona's system prompt
- **AND** the persona's preferred model is suggested (but can be overridden)

#### Scenario: Persona per conversation
- **WHEN** user starts a new conversation with a persona
- **THEN** the persona is saved with the conversation
- **AND** reloading the conversation uses the same persona

#### Scenario: Change persona mid-conversation
- **WHEN** user changes persona during an active conversation
- **THEN** new messages use the new persona's system prompt
- **AND** conversation history is preserved

### Requirement: Custom Persona Creation
The system SHALL allow users to create custom personas.

#### Scenario: Create new persona
- **WHEN** user clicks "Create New Persona"
- **THEN** the system displays a form with: name, description, system prompt, voice selection, model selection, knowledge base selection, temperature slider, max tokens input

#### Scenario: Edit persona
- **WHEN** user edits an existing persona
- **THEN** changes apply to new conversations using that persona
- **AND** existing conversations retain their original persona settings

#### Scenario: Delete custom persona
- **WHEN** user deletes a custom persona
- **THEN** the persona is removed from the selection list
- **AND** existing conversations using it retain their saved settings

#### Scenario: Duplicate persona
- **WHEN** user duplicates a persona
- **THEN** a copy is created with "(Copy)" appended to the name
- **AND** user can edit the copy independently

### Requirement: Persona System Prompt
The system SHALL apply persona system prompts to LLM requests.

#### Scenario: Apply system prompt
- **WHEN** sending a message to the LLM
- **THEN** the persona's system prompt is included at the start of the prompt
- **AND** precedes any personal contexts or RAG content

#### Scenario: System prompt variables
- **WHEN** a system prompt contains placeholders like {user_name}
- **THEN** the system replaces them with actual values from settings

### Requirement: Persona-Specific Settings
The system SHALL support persona-specific configuration.

#### Scenario: Persona preferred model
- **WHEN** a persona has a preferred model set
- **THEN** the model selector defaults to that model when persona is selected
- **AND** user can still override the model

#### Scenario: Persona preferred voice
- **WHEN** a persona has a preferred voice set
- **THEN** TTS uses that voice when speaking responses from that persona

#### Scenario: Persona temperature
- **WHEN** a persona has a specific temperature set
- **THEN** LLM requests use that temperature instead of the default
