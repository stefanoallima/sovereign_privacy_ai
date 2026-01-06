# Change: Add Private Voice Assistant

## Why

Users need a private, voice-enabled AI assistant that can be used while working in other applications. Current solutions (ChatGPT, Gemini) send all data to cloud providers, creating privacy concerns for sensitive personal discussions. A self-hosted voice pipeline with cloud LLM API offers the best balance of privacy, intelligence, and cost (<50 EUR/month target, actual ~3-5 EUR/month).

## What Changes

### New Capabilities
- **Desktop Application**: Tauri-based app with global hotkey (Ctrl+Space) for push-to-talk from any Windows application
- **Voice Pipeline**: Local STT (Whisper), TTS (Piper), and VAD (Silero) for complete voice privacy
- **Persona System**: Multiple AI personas (psychologist, life coach, career coach) with custom system prompts and knowledge bases
- **Context Management**: Projects, personal contexts, and knowledge bases with multi-select UI for token optimization
- **LLM Integration**: Nebius AI Studio API with model selection (Qwen3-32B-fast, DeepSeek-V3, Llama, Mistral)
- **RAG System**: Local document processing and vector storage (Qdrant embedded) for persona-specific knowledge

### Key Privacy Features
- Voice audio processed locally only (never leaves machine)
- Documents stored and indexed locally (Qdrant embedded)
- Chat history stored locally (SQLite)
- Only text prompts sent to Nebius API

### Future Capabilities (not in this change)
- PWA for mobile access
- Android app via Play Store
- Multi-tenant SaaS with Clerk authentication

## Impact

### Affected Specs (New)
- `voice-pipeline` - STT, TTS, VAD components
- `personas` - Persona creation, management, defaults
- `context-management` - Projects, contexts, knowledge bases
- `llm-integration` - Nebius API, model selection, streaming
- `desktop-app` - Tauri app, global hotkeys, system tray

### Affected Code (New)
- `apps/desktop/src-tauri/` - Rust backend for audio, STT, TTS, VAD
- `apps/desktop/src/` - React frontend for chat UI
- `knowledge/` - Local document storage structure

### Dependencies
- Tauri v2
- whisper.cpp / whisper-rs
- Piper TTS
- Silero VAD (ONNX)
- Qdrant embedded
- Nebius AI Studio API

### Cost Analysis
| Component | Monthly Cost |
|-----------|--------------|
| Whisper (local) | FREE |
| Piper (local) | FREE |
| Qdrant (local) | FREE |
| SQLite (local) | FREE |
| Nebius API (~2M tokens) | ~3-5 EUR |
| **Total** | **~3-5 EUR** |
