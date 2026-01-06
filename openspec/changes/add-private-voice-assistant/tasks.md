# Tasks: Private Voice Assistant

## Phase 1: Project Foundation

### 1.1 Project Setup
- [ ] 1.1.1 Initialize Tauri v2 project with React + TypeScript template
- [ ] 1.1.2 Configure Vite with path aliases (`@/`)
- [ ] 1.1.3 Set up TailwindCSS
- [ ] 1.1.4 Configure ESLint + Prettier
- [ ] 1.1.5 Set up Zustand for state management
- [ ] 1.1.6 Create base project structure (components, hooks, stores, services)

### 1.2 Database Setup
- [ ] 1.2.1 Add rusqlite dependency to Tauri
- [ ] 1.2.2 Create database initialization on app start
- [ ] 1.2.3 Create schema migrations for: settings, personas, projects, contexts, conversations, messages
- [ ] 1.2.4 Create Tauri commands for CRUD operations
- [ ] 1.2.5 Create TypeScript types matching Rust structs

## Phase 2: Core Desktop Features

### 2.1 System Tray & Global Hotkey
- [ ] 2.1.1 Configure system tray with icon and menu
- [ ] 2.1.2 Implement global hotkey registration (Ctrl+Space default)
- [ ] 2.1.3 Add settings for custom hotkey configuration
- [ ] 2.1.4 Implement minimize to tray behavior
- [ ] 2.1.5 Add tray menu: Show, Settings, Quit

### 2.2 Basic Chat UI
- [ ] 2.2.1 Install and configure chat UI library (@chatscope or @nlux)
- [ ] 2.2.2 Create ChatWindow component with message list
- [ ] 2.2.3 Create message input with send button
- [ ] 2.2.4 Implement message bubbles with markdown rendering
- [ ] 2.2.5 Add typing indicator for AI responses
- [ ] 2.2.6 Implement auto-scroll to latest message

## Phase 3: LLM Integration

### 3.1 Nebius API Client
- [ ] 3.1.1 Create Nebius API client with OpenAI-compatible interface
- [ ] 3.1.2 Implement streaming response handling
- [ ] 3.1.3 Add API key configuration in settings
- [ ] 3.1.4 Create model selection dropdown
- [ ] 3.1.5 Implement token counting (tiktoken or approximation)
- [ ] 3.1.6 Add error handling and retry logic

### 3.2 Chat Functionality
- [ ] 3.2.1 Connect chat UI to Nebius API
- [ ] 3.2.2 Implement conversation history management
- [ ] 3.2.3 Add message streaming display
- [ ] 3.2.4 Store conversations in SQLite
- [ ] 3.2.5 Implement conversation list sidebar
- [ ] 3.2.6 Add new conversation / delete conversation

## Phase 4: Voice Pipeline

### 4.1 Audio Capture
- [ ] 4.1.1 Add cpal dependency for audio capture
- [ ] 4.1.2 Implement microphone enumeration and selection
- [ ] 4.1.3 Create audio capture stream (16kHz mono)
- [ ] 4.1.4 Implement push-to-talk activation via global hotkey
- [ ] 4.1.5 Add visual indicator when recording

### 4.2 Voice Activity Detection
- [ ] 4.2.1 Add ort (ONNX Runtime) dependency
- [ ] 4.2.2 Bundle Silero VAD model
- [ ] 4.2.3 Implement VAD inference on audio chunks
- [ ] 4.2.4 Create speech start/end detection logic
- [ ] 4.2.5 Buffer audio during speech

### 4.3 Speech-to-Text
- [ ] 4.3.1 Add whisper-rs or whisper.cpp bindings
- [ ] 4.3.2 Download and bundle Whisper small model on first run
- [ ] 4.3.3 Implement transcription pipeline
- [ ] 4.3.4 Add GPU acceleration configuration
- [ ] 4.3.5 Create transcription progress indicator
- [ ] 4.3.6 Handle transcription errors gracefully

### 4.4 Text-to-Speech
- [ ] 4.4.1 Add piper-rs or piper bindings
- [ ] 4.4.2 Download and bundle default Piper voice on first run
- [ ] 4.4.3 Implement TTS pipeline
- [ ] 4.4.4 Create audio playback queue
- [ ] 4.4.5 Implement sentence-by-sentence streaming
- [ ] 4.4.6 Add voice selection in settings
- [ ] 4.4.7 Implement interruption (stop playback on new input)

### 4.5 Voice Integration
- [ ] 4.5.1 Connect full pipeline: Record → VAD → STT → LLM → TTS → Play
- [ ] 4.5.2 Add voice mode toggle in UI
- [ ] 4.5.3 Show transcription in chat as user message
- [ ] 4.5.4 Implement seamless voice/text switching

## Phase 5: Persona System

### 5.1 Persona Management
- [ ] 5.1.1 Create Persona data model and SQLite table
- [ ] 5.1.2 Seed default personas (Psychologist, Life Coach, Career Coach)
- [ ] 5.1.3 Create persona selection UI (cards/list)
- [ ] 5.1.4 Implement persona CRUD operations
- [ ] 5.1.5 Create persona editor (name, description, system prompt, voice, model)

### 5.2 Persona Features
- [ ] 5.2.1 Apply persona system prompt to LLM calls
- [ ] 5.2.2 Remember last-used persona
- [ ] 5.2.3 Allow per-conversation persona override
- [ ] 5.2.4 Add persona-specific default model selection

## Phase 6: Context Management

### 6.1 Projects
- [ ] 6.1.1 Create Project data model and SQLite table
- [ ] 6.1.2 Implement project CRUD UI
- [ ] 6.1.3 Assign conversations to projects
- [ ] 6.1.4 Create project sidebar with conversation grouping
- [ ] 6.1.5 Add project-specific default persona

### 6.2 Personal Contexts
- [ ] 6.2.1 Create PersonalContext data model and SQLite table
- [ ] 6.2.2 Create context editor (markdown content)
- [ ] 6.2.3 Implement multi-select context UI
- [ ] 6.2.4 Calculate and display token counts per context
- [ ] 6.2.5 Include selected contexts in LLM prompt
- [ ] 6.2.6 Show total token estimate in UI

### 6.3 Context Selection Panel
- [ ] 6.3.1 Create unified context selection sidebar
- [ ] 6.3.2 Add persona selector (single select)
- [ ] 6.3.3 Add project selector (single select)
- [ ] 6.3.4 Add context multi-select with checkboxes
- [ ] 6.3.5 Add model selector (single select)
- [ ] 6.3.6 Show cost estimate based on selections

## Phase 7: RAG System

### 7.1 Document Processing
- [ ] 7.1.1 Add document parsing libraries (PDF, EPUB, DOCX)
- [ ] 7.1.2 Implement markdown conversion pipeline
- [ ] 7.1.3 Create semantic chunking (by headers + size limit)
- [ ] 7.1.4 Add document upload UI
- [ ] 7.1.5 Show processing progress

### 7.2 Vector Storage
- [ ] 7.2.1 Add Qdrant embedded dependency
- [ ] 7.2.2 Initialize Qdrant on app start
- [ ] 7.2.3 Add BGE embedding model (candle or ort)
- [ ] 7.2.4 Implement document indexing pipeline
- [ ] 7.2.5 Create collections per knowledge base

### 7.3 Knowledge Bases
- [ ] 7.3.1 Create KnowledgeBase data model and SQLite table
- [ ] 7.3.2 Implement KB CRUD UI
- [ ] 7.3.3 Associate KBs with personas
- [ ] 7.3.4 Create shared KB option (cross-persona)
- [ ] 7.3.5 Add KB multi-select in context panel

### 7.4 RAG Integration
- [ ] 7.4.1 Implement similarity search on user query
- [ ] 7.4.2 Add retrieved context to LLM prompt
- [ ] 7.4.3 Show retrieved sources in UI (collapsible)
- [ ] 7.4.4 Configure retrieval parameters (top-k, threshold)

## Phase 8: Settings & Analytics

### 8.1 Settings Panel
- [ ] 8.1.1 Create settings UI with tabs
- [ ] 8.1.2 API settings (Nebius key, endpoint)
- [ ] 8.1.3 Model settings (enable/disable models, set default)
- [ ] 8.1.4 Voice settings (input device, output device, voice selection, speech rate)
- [ ] 8.1.5 Hotkey settings (customize push-to-talk key)
- [ ] 8.1.6 Privacy settings (save audio recordings toggle, encryption toggle)
- [ ] 8.1.7 Appearance settings (theme: light/dark/system)

### 8.2 Usage Tracking
- [ ] 8.2.1 Create UsageStats data model and SQLite table
- [ ] 8.2.2 Track tokens per request (input/output)
- [ ] 8.2.3 Track latency per request
- [ ] 8.2.4 Create usage dashboard (today, this month, by model)
- [ ] 8.2.5 Show estimated cost based on model pricing
- [ ] 8.2.6 Add usage warnings (approaching budget)

## Phase 9: Polish & Testing

### 9.1 Error Handling
- [ ] 9.1.1 Add global error boundary in React
- [ ] 9.1.2 Create user-friendly error messages
- [ ] 9.1.3 Add retry mechanisms for API calls
- [ ] 9.1.4 Handle offline gracefully
- [ ] 9.1.5 Add logging for debugging

### 9.2 Performance
- [ ] 9.2.1 Profile and optimize model loading time
- [ ] 9.2.2 Implement lazy loading for models
- [ ] 9.2.3 Optimize SQLite queries
- [ ] 9.2.4 Add loading states throughout UI

### 9.3 Testing
- [ ] 9.3.1 Set up Vitest for frontend
- [ ] 9.3.2 Add unit tests for core utilities
- [ ] 9.3.3 Set up cargo test for Rust
- [ ] 9.3.4 Add integration tests for Tauri commands
- [ ] 9.3.5 Manual testing checklist for voice pipeline

### 9.4 Documentation
- [ ] 9.4.1 Create README with setup instructions
- [ ] 9.4.2 Document keyboard shortcuts
- [ ] 9.4.3 Create first-run onboarding flow
- [ ] 9.4.4 Add tooltips for complex UI elements

## Phase 10: Build & Distribution

### 10.1 Build Configuration
- [ ] 10.1.1 Configure Tauri build for Windows
- [ ] 10.1.2 Bundle required models and assets
- [ ] 10.1.3 Set up code signing (optional)
- [ ] 10.1.4 Configure auto-updater (optional)

### 10.2 First Release
- [ ] 10.2.1 Create installer (MSI or NSIS)
- [ ] 10.2.2 Test on clean Windows machine
- [ ] 10.2.3 Create GitHub release
- [ ] 10.2.4 Document known issues and limitations
