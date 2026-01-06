# Context Management Specification

## ADDED Requirements

### Requirement: Project Organization
The system SHALL organize conversations into projects.

#### Scenario: Create project
- **WHEN** user creates a new project
- **THEN** they provide: name, description, color, optional default persona
- **AND** the project appears in the sidebar

#### Scenario: Assign conversation to project
- **WHEN** user starts a conversation within a project
- **THEN** the conversation is associated with that project
- **AND** appears under the project in the sidebar

#### Scenario: Move conversation between projects
- **WHEN** user moves a conversation to a different project
- **THEN** the conversation appears under the new project
- **AND** retains all its messages and settings

#### Scenario: Quick chat (no project)
- **WHEN** user starts a conversation without selecting a project
- **THEN** it appears under "Quick Chats" section
- **AND** can optionally be assigned to a project later

#### Scenario: Delete project
- **WHEN** user deletes a project
- **THEN** all conversations in the project are moved to "Quick Chats"
- **AND** the project is removed from the sidebar

### Requirement: Personal Contexts
The system SHALL support reusable personal context snippets.

#### Scenario: Create personal context
- **WHEN** user creates a personal context
- **THEN** they provide: name and markdown content
- **AND** the system calculates and displays the token count

#### Scenario: Edit personal context
- **WHEN** user edits a personal context
- **THEN** changes are saved immediately
- **AND** token count is recalculated

#### Scenario: Delete personal context
- **WHEN** user deletes a personal context
- **THEN** it is removed from the list
- **AND** no longer included in future conversations

### Requirement: Context Selection
The system SHALL allow users to select which contexts to include in conversations.

#### Scenario: Multi-select contexts
- **WHEN** user opens the context panel
- **THEN** they see checkboxes for each personal context
- **AND** can select multiple contexts to include

#### Scenario: Context persistence per conversation
- **WHEN** user selects contexts for a conversation
- **THEN** those selections are saved with the conversation
- **AND** restored when reopening the conversation

#### Scenario: Default contexts
- **WHEN** user marks contexts as "default"
- **THEN** new conversations automatically include those contexts
- **AND** user can still modify the selection

### Requirement: Knowledge Bases
The system SHALL support document-based knowledge bases for RAG.

#### Scenario: Create knowledge base
- **WHEN** user creates a knowledge base
- **THEN** they provide: name, description, optional persona association
- **AND** an empty collection is created in Qdrant

#### Scenario: Upload document to knowledge base
- **WHEN** user uploads a document (PDF, EPUB, MD, DOCX)
- **THEN** the system parses and chunks the document
- **AND** generates embeddings and stores in Qdrant
- **AND** shows processing progress

#### Scenario: Remove document from knowledge base
- **WHEN** user removes a document
- **THEN** its chunks are deleted from Qdrant
- **AND** the document is removed from the list

#### Scenario: Associate knowledge base with persona
- **WHEN** a knowledge base is associated with a persona
- **THEN** it is automatically selected when that persona is active
- **AND** can still be manually deselected

#### Scenario: Shared knowledge base
- **WHEN** a knowledge base has no persona association
- **THEN** it appears for all personas
- **AND** can be selected independently

### Requirement: Token Estimation
The system SHALL display token counts and cost estimates.

#### Scenario: Show context token count
- **WHEN** user views the context panel
- **THEN** each personal context shows its token count
- **AND** selected contexts show cumulative total

#### Scenario: Show total prompt estimate
- **WHEN** user has selected persona, contexts, and knowledge bases
- **THEN** the system estimates total tokens for the next message
- **AND** displays the estimated cost based on selected model

#### Scenario: Context budget warning
- **WHEN** selected contexts exceed 50% of model's context window
- **THEN** the system displays a warning
- **AND** suggests deselecting some contexts

### Requirement: Context Panel UI
The system SHALL provide a unified context selection interface.

#### Scenario: Context panel layout
- **WHEN** user opens the context panel
- **THEN** they see sections for: Persona (single select), Project (single select), Personal Contexts (multi-select), Knowledge Bases (multi-select), Model (single select)
- **AND** a summary showing total tokens and estimated cost

#### Scenario: Collapse/expand sections
- **WHEN** user clicks a section header
- **THEN** the section collapses or expands
- **AND** state is remembered between sessions

#### Scenario: Quick model switch
- **WHEN** user is in a conversation
- **THEN** they can quickly switch models from the chat header
- **AND** without opening the full context panel
