# Desktop App Specification

## ADDED Requirements

### Requirement: System Tray
The system SHALL run in the Windows system tray.

#### Scenario: Minimize to tray
- **WHEN** user closes the main window
- **THEN** the app minimizes to the system tray
- **AND** continues running in the background

#### Scenario: Tray icon menu
- **WHEN** user right-clicks the tray icon
- **THEN** the system displays a menu with: Show, New Conversation, Settings, Quit

#### Scenario: Tray icon click
- **WHEN** user left-clicks the tray icon
- **THEN** the main window is shown and focused

#### Scenario: Tray notification
- **WHEN** push-to-talk is activated from background
- **THEN** the tray icon indicates recording status
- **AND** optionally shows a small overlay

### Requirement: Global Hotkey
The system SHALL support global hotkeys that work from any application.

#### Scenario: Push-to-talk hotkey
- **WHEN** user presses the configured hotkey (default: Ctrl+Space)
- **AND** any application is focused
- **THEN** the assistant begins recording audio
- **AND** shows a visual indicator

#### Scenario: Configure hotkey
- **WHEN** user opens hotkey settings
- **THEN** they can record a new key combination
- **AND** the system validates it doesn't conflict with common shortcuts

#### Scenario: Show/hide window hotkey
- **WHEN** user presses a secondary hotkey (e.g., Ctrl+Shift+Space)
- **THEN** the main window toggles visibility

### Requirement: Chat Interface
The system SHALL provide a chat interface for text and voice interaction.

#### Scenario: Message display
- **WHEN** messages are in a conversation
- **THEN** the system displays them as bubbles with: user messages on the right, AI messages on the left, timestamps, markdown rendering

#### Scenario: Message input
- **WHEN** user types in the input field
- **THEN** they can send with Enter key
- **AND** Shift+Enter creates a new line

#### Scenario: Voice indicator
- **WHEN** voice mode is active
- **THEN** the input area shows a microphone button
- **AND** indicates recording status (idle, recording, processing)

#### Scenario: AI typing indicator
- **WHEN** AI is generating a response
- **THEN** the system shows a typing indicator
- **AND** streaming tokens appear in real-time

### Requirement: Conversation Management
The system SHALL manage multiple conversations.

#### Scenario: Conversation list
- **WHEN** user views the sidebar
- **THEN** they see conversations grouped by project
- **AND** sorted by last activity

#### Scenario: New conversation
- **WHEN** user clicks "New Conversation"
- **THEN** a new conversation is created with current context selections
- **AND** becomes the active conversation

#### Scenario: Delete conversation
- **WHEN** user deletes a conversation
- **THEN** all messages are removed
- **AND** the conversation is removed from the list

#### Scenario: Search conversations
- **WHEN** user types in the search box
- **THEN** the system filters conversations by title and message content
- **AND** highlights matching text

### Requirement: Settings Management
The system SHALL provide a settings interface.

#### Scenario: Settings tabs
- **WHEN** user opens settings
- **THEN** they see tabs for: General, Voice, Models, API, Privacy, Appearance

#### Scenario: Save settings
- **WHEN** user changes a setting
- **THEN** it is saved immediately to SQLite
- **AND** takes effect without restart (where possible)

#### Scenario: Reset to defaults
- **WHEN** user clicks "Reset to Defaults"
- **THEN** all settings return to initial values
- **AND** user confirms before reset

### Requirement: First-Run Experience
The system SHALL guide new users through setup.

#### Scenario: Welcome screen
- **WHEN** user launches the app for the first time
- **THEN** the system displays a welcome wizard with: API key configuration, voice setup, persona introduction

#### Scenario: Model download
- **WHEN** voice features are first used
- **THEN** the system downloads required models (Whisper, Piper)
- **AND** shows download progress

#### Scenario: Test voice
- **WHEN** user completes voice setup
- **THEN** the system offers a test recording
- **AND** plays back the transcription and TTS

### Requirement: Appearance
The system SHALL support visual customization.

#### Scenario: Theme selection
- **WHEN** user selects a theme (light, dark, system)
- **THEN** the UI updates immediately
- **AND** system theme follows OS setting

#### Scenario: Window state
- **WHEN** user resizes or moves the window
- **THEN** the position and size are saved
- **AND** restored on next launch

### Requirement: Keyboard Navigation
The system SHALL support keyboard-only operation.

#### Scenario: Tab navigation
- **WHEN** user presses Tab
- **THEN** focus moves between interactive elements
- **AND** focus is visible

#### Scenario: Keyboard shortcuts
- **WHEN** user presses common shortcuts
- **THEN** the system responds: Ctrl+N (new conversation), Ctrl+, (settings), Escape (close panel/dialog)

### Requirement: Accessibility
The system SHALL be accessible to users with disabilities.

#### Scenario: Screen reader support
- **WHEN** a screen reader is active
- **THEN** all UI elements have appropriate labels
- **AND** dynamic content is announced

#### Scenario: High contrast
- **WHEN** Windows high contrast mode is active
- **THEN** the app respects the system colors
- **AND** remains usable
