# Design: Private Voice Assistant

## Context

Building a privacy-focused voice assistant for personal use on Windows. The user wants to discuss sensitive topics (therapy, coaching, personal matters) without data leaving their control. Budget constraint of <50 EUR/month, with target of ~5 EUR/month.

### Constraints
- Hardware: MSI GF65 with 6GB GPU (GTX 1660 Ti)
- Budget: <50 EUR/month (target: <10 EUR)
- Platform: Windows desktop primary, mobile PWA future
- Privacy: Voice and documents must stay local

### Stakeholders
- Primary user: Single user (developer) for personal use
- Future: Potential SaaS offering for privacy-conscious users

## Goals / Non-Goals

### Goals
- Push-to-talk voice interaction from any Windows application
- Natural conversation latency (<5 seconds to first audio response)
- Multiple AI personas with RAG-powered knowledge bases
- User-controlled context selection for token optimization
- Model selection for speed/intelligence/cost trade-offs
- Cost tracking and usage analytics

### Non-Goals (this phase)
- Multi-user / SaaS functionality
- Mobile app (PWA or native)
- Real-time streaming STT (batch transcription acceptable)
- Voice cloning or custom TTS training
- Offline LLM (requires too much VRAM)

## Decisions

### D1: Desktop Framework - Tauri v2

**Decision**: Use Tauri v2 with React frontend

**Rationale**:
- Tiny bundle size (3-10MB vs Electron's 150MB+)
- Low memory footprint (~50MB vs Electron's 200MB+)
- Native Rust backend for audio processing
- Same React frontend can be reused for PWA
- Global hotkey and system tray support built-in

**Alternatives Considered**:
- Electron: Too heavy, high memory usage
- Flutter: Different language (Dart), not web-reusable
- Neutralino: Less mature, smaller ecosystem

### D2: Speech-to-Text - whisper.cpp

**Decision**: Use whisper.cpp with Whisper small model

**Rationale**:
- Runs on user's 6GB GPU (needs ~2GB VRAM)
- Completely local - voice never leaves machine
- ~2-3 seconds for 10 seconds of audio
- whisper.cpp is optimized C++ with Rust bindings available

**Alternatives Considered**:
- Cloud STT (Deepgram, Google): Privacy concern, ongoing cost
- faster-whisper (Python): Harder to integrate with Tauri
- OpenAI Whisper API: Privacy concern

**Model Choice**: Whisper small (244M params)
- Fits in 6GB GPU alongside other work
- Good accuracy for English
- Acceptable latency

### D3: Text-to-Speech - Piper

**Decision**: Use Piper TTS

**Rationale**:
- Runs on CPU (no GPU needed)
- Very fast (~50ms per sentence)
- Good voice quality
- Multiple voice options
- MIT license, actively maintained

**Alternatives Considered**:
- Coqui XTTS: Better quality but needs GPU
- Edge TTS: Free but sends to Microsoft
- StyleTTS2: Better quality but GPU-heavy

### D4: Voice Activity Detection - Silero VAD

**Decision**: Use Silero VAD via ONNX runtime

**Rationale**:
- Tiny model (~2MB)
- Runs on CPU with <10ms latency
- Accurate speech detection
- Can run in Rust via ort (ONNX Runtime)

### D5: LLM Integration - Nebius AI Studio API

**Decision**: Use Nebius AI Studio with OpenAI-compatible API

**Rationale**:
- Pay-per-token (no idle costs)
- No cold starts (always warm)
- Multiple model options (Qwen, DeepSeek, Llama, Mistral)
- OpenAI-compatible API (easy integration)
- ~$0.10-0.35 per 1M tokens (very affordable)
- User has 25 EUR credit

**Privacy Trade-off**: Text prompts go to Nebius, but:
- Voice stays local (main privacy concern)
- Documents stay local (RAG)
- Smaller provider than OpenAI/Google

**Alternatives Considered**:
- Modal serverless: Cold starts (10-15s first message)
- Self-hosted on Nebius VM: ~$300/month minimum
- Local LLM: 6GB GPU too small for good models

### D6: Vector Database - Qdrant Embedded

**Decision**: Use Qdrant in embedded mode

**Rationale**:
- Runs inside the application
- No separate process to manage
- Documents never leave the machine
- Fast similarity search
- Supports namespaces for user/persona isolation

**Alternatives Considered**:
- ChromaDB: Less mature, Python-focused
- LanceDB: Newer, less proven
- Qdrant Cloud: Privacy concern, adds cost

### D7: Local Database - SQLite

**Decision**: Use SQLite for chat history and settings

**Rationale**:
- Single file, no server
- Built into Tauri ecosystem
- Good enough for single-user app
- Can encrypt with SQLCipher if needed

### D8: Embedding Model - BGE-small-en

**Decision**: Use BAAI/bge-small-en-v1.5 for document embeddings

**Rationale**:
- Small model (~130MB)
- Runs on CPU
- Good quality embeddings
- Can run in Rust via candle or ort

### D9: State Management - Zustand

**Decision**: Use Zustand for React state management

**Rationale**:
- Lightweight (~1KB)
- Simple API
- Works well with Tauri IPC
- Easy to persist to SQLite

**Alternatives Considered**:
- Redux Toolkit: Heavier, more boilerplate
- Jotai: Similar simplicity, less adoption
- Context API: Insufficient for complex state

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAURI DESKTOP APP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐     ┌─────────────────────────────┐   │
│  │     Rust Backend    │     │      React Frontend          │   │
│  │                     │     │                              │   │
│  │  ┌───────────────┐  │     │  ┌────────────────────────┐ │   │
│  │  │ Audio Capture │  │ IPC │  │     Chat Window        │ │   │
│  │  │ (cpal)        │◄─┼─────┼─►│     - Messages         │ │   │
│  │  └───────────────┘  │     │  │     - Voice Button     │ │   │
│  │         │           │     │  │     - Model Selector   │ │   │
│  │         ▼           │     │  └────────────────────────┘ │   │
│  │  ┌───────────────┐  │     │                              │   │
│  │  │  Silero VAD   │  │     │  ┌────────────────────────┐ │   │
│  │  │  (ort/ONNX)   │  │     │  │   Context Sidebar      │ │   │
│  │  └───────────────┘  │     │  │   - Persona Select     │ │   │
│  │         │           │     │  │   - Project Select     │ │   │
│  │         ▼           │     │  │   - Context Multi-sel  │ │   │
│  │  ┌───────────────┐  │     │  │   - KB Multi-select    │ │   │
│  │  │ Whisper STT   │  │     │  │   - Token Estimate     │ │   │
│  │  │ (whisper.cpp) │  │     │  └────────────────────────┘ │   │
│  │  └───────────────┘  │     │                              │   │
│  │         │           │     │  ┌────────────────────────┐ │   │
│  │         ▼           │     │  │   Settings Panel       │ │   │
│  │  ┌───────────────┐  │     │  │   - API Key            │ │   │
│  │  │  Piper TTS    │  │     │  │   - Model Config       │ │   │
│  │  │  (piper-rs)   │  │     │  │   - Voice Config       │ │   │
│  │  └───────────────┘  │     │  │   - Usage Stats        │ │   │
│  │         │           │     │  └────────────────────────┘ │   │
│  │         ▼           │     │                              │   │
│  │  ┌───────────────┐  │     └─────────────────────────────┘   │
│  │  │ Audio Playback│  │                                        │
│  │  │ (cpal)        │  │                                        │
│  │  └───────────────┘  │                                        │
│  │                     │                                        │
│  │  ┌───────────────┐  │                                        │
│  │  │ Qdrant (RAG)  │  │                                        │
│  │  │ (embedded)    │  │                                        │
│  │  └───────────────┘  │                                        │
│  │                     │                                        │
│  │  ┌───────────────┐  │                                        │
│  │  │ SQLite (DB)   │  │                                        │
│  │  │ (rusqlite)    │  │                                        │
│  │  └───────────────┘  │                                        │
│  │                     │                                        │
│  └─────────────────────┘                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS (text only)
                               ▼
                    ┌─────────────────────┐
                    │  Nebius AI Studio   │
                    │  (LLM Inference)    │
                    │                     │
                    │  - Qwen3-32B-fast   │
                    │  - DeepSeek-V3      │
                    │  - Llama-3.1-70B    │
                    │  - Mistral-Nemo     │
                    └─────────────────────┘
```

### Voice Pipeline Flow

```
1. User presses Ctrl+Space (global hotkey)
2. Tauri activates microphone capture (cpal)
3. Audio chunks flow to Silero VAD
4. VAD buffers speech, detects end-of-speech
5. User releases key OR VAD detects silence
6. Buffered audio sent to Whisper
7. Whisper transcribes (~2-3s for 10s audio)
8. Text + contexts assembled into prompt
9. RAG retrieval from Qdrant (~100ms)
10. Prompt sent to Nebius API (streaming)
11. Tokens stream back, buffered into sentences
12. Each sentence sent to Piper TTS (~50ms)
13. Audio played back immediately
14. User can interrupt by pressing hotkey again
```

### Data Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Documents  │    │   Personal   │    │   Persona    │
│   (PDF, MD)  │    │   Contexts   │    │   System     │
│              │    │   (MD files) │    │   Prompts    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       ▼                   ▼                   │
┌──────────────┐    ┌──────────────┐           │
│  BGE Embed   │    │   Stored as  │           │
│  → Qdrant    │    │   Markdown   │           │
└──────────────┘    └──────────────┘           │
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Prompt     │
                    │   Assembly   │
                    │              │
                    │ [System]     │
                    │ [Contexts]   │
                    │ [RAG Results]│
                    │ [History]    │
                    │ [User Msg]   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Nebius API   │
                    │ (streaming)  │
                    └──────────────┘
```

## Risks / Trade-offs

### R1: Whisper Latency on 6GB GPU
- **Risk**: Transcription might be slower than expected
- **Mitigation**: Use Whisper small model; upgrade to base if too slow
- **Fallback**: Consider cloud STT for speed-critical use cases

### R2: Nebius API Availability
- **Risk**: API downtime or deprecation
- **Mitigation**: OpenAI-compatible API makes switching easy
- **Fallback**: Can switch to Together.ai, Groq, or other providers

### R3: Tauri v2 Maturity
- **Risk**: Tauri v2 is relatively new
- **Mitigation**: Large community, active development
- **Fallback**: Core features are stable; edge cases can be worked around

### R4: Text Goes to Cloud
- **Risk**: Conversation content visible to Nebius
- **Mitigation**: Voice (main privacy concern) stays local; Nebius is smaller/EU-focused
- **Acceptance**: User accepts this trade-off for cost/intelligence benefits

### R5: Model Loading Time
- **Risk**: First use might be slow (loading Whisper, Piper, embeddings)
- **Mitigation**: Load models on app startup; show loading indicator
- **Optimization**: Keep models in memory while app is running

## Migration Plan

Not applicable - this is a greenfield project.

## Open Questions

### Q1: Whisper Model Size
Should we start with `small` or `base`?
- **small**: Better accuracy, ~2GB VRAM, ~2-3s latency
- **base**: Faster, ~1GB VRAM, ~1-2s latency, lower accuracy
- **Decision**: Start with `small`, downgrade if latency is an issue

### Q2: Audio Format
What format for audio capture and playback?
- **Proposed**: 16kHz mono for STT (Whisper native), 22kHz for TTS (Piper native)
- **Decision**: Match native formats for each component

### Q3: Context Window Management
How to handle conversations exceeding model context?
- **Options**: Sliding window, summarization, truncate oldest
- **Decision**: Start with sliding window + token counting UI; add summarization later

### Q4: Document Chunking Strategy
How to chunk documents for RAG?
- **Options**: Fixed size, semantic (by section), sliding window
- **Decision**: Semantic chunking by markdown headers + fixed size fallback
