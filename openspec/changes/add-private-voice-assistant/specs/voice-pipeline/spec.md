# Voice Pipeline Specification

## ADDED Requirements

### Requirement: Audio Capture
The system SHALL capture audio from the user's microphone when push-to-talk is activated.

#### Scenario: Start recording on hotkey press
- **WHEN** user presses the push-to-talk hotkey (default: Ctrl+Space)
- **THEN** the system begins capturing audio from the selected input device
- **AND** displays a visual recording indicator

#### Scenario: Stop recording on hotkey release
- **WHEN** user releases the push-to-talk hotkey
- **THEN** the system stops audio capture
- **AND** passes the audio buffer to the transcription pipeline

#### Scenario: Select audio input device
- **WHEN** user opens voice settings
- **THEN** the system displays all available microphone devices
- **AND** allows selection of the preferred input device

### Requirement: Voice Activity Detection
The system SHALL detect speech boundaries within captured audio using Silero VAD.

#### Scenario: Detect speech start
- **WHEN** audio capture is active
- **AND** VAD detects speech onset
- **THEN** the system begins buffering audio for transcription

#### Scenario: Detect speech end
- **WHEN** VAD detects silence after speech
- **OR** user releases push-to-talk key
- **THEN** the system finalizes the audio buffer
- **AND** triggers transcription

#### Scenario: Filter non-speech audio
- **WHEN** VAD detects non-speech audio (noise, silence)
- **THEN** the system excludes this audio from the transcription buffer

### Requirement: Speech-to-Text Transcription
The system SHALL transcribe audio to text using Whisper running locally on the user's GPU.

#### Scenario: Transcribe speech
- **WHEN** audio buffer is finalized
- **THEN** the system processes audio through Whisper small model
- **AND** returns transcribed text within 3 seconds for 10 seconds of audio

#### Scenario: Display transcription
- **WHEN** transcription completes
- **THEN** the system displays the transcribed text as a user message in the chat
- **AND** sends the text to the LLM for response

#### Scenario: Handle transcription error
- **WHEN** transcription fails (model error, invalid audio)
- **THEN** the system displays an error message to the user
- **AND** allows retry without restarting the app

#### Scenario: First-run model download
- **WHEN** user first uses voice features
- **AND** Whisper model is not present
- **THEN** the system downloads the model with progress indication
- **AND** caches it for future use

### Requirement: Text-to-Speech Synthesis
The system SHALL convert AI responses to speech using Piper TTS running locally on CPU.

#### Scenario: Speak AI response
- **WHEN** AI generates a response
- **AND** voice mode is enabled
- **THEN** the system converts text to speech sentence-by-sentence
- **AND** plays audio through the selected output device

#### Scenario: Stream TTS output
- **WHEN** AI response is streaming
- **THEN** the system speaks each complete sentence as it arrives
- **AND** does not wait for the full response

#### Scenario: Interrupt playback
- **WHEN** user activates push-to-talk during AI speech
- **THEN** the system immediately stops audio playback
- **AND** begins recording new user input

#### Scenario: Select voice
- **WHEN** user opens voice settings
- **THEN** the system displays available Piper voices
- **AND** allows selection and preview of voices

#### Scenario: Adjust speech rate
- **WHEN** user adjusts speech rate in settings
- **THEN** the system applies the rate (0.5x to 2.0x) to TTS output

### Requirement: Voice Mode Toggle
The system SHALL allow users to enable or disable voice input/output independently.

#### Scenario: Enable voice mode
- **WHEN** user enables voice mode
- **THEN** push-to-talk becomes active
- **AND** AI responses are spoken aloud

#### Scenario: Text-only mode
- **WHEN** user disables voice mode
- **THEN** push-to-talk is disabled
- **AND** AI responses are text-only

#### Scenario: Voice input only
- **WHEN** user enables voice input but disables voice output
- **THEN** push-to-talk transcribes to text
- **AND** AI responses are text-only (not spoken)
