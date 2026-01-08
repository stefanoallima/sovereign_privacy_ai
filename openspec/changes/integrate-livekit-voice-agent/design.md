# Design: LiveKit Voice Agent Integration

## Context

The current voice implementation in the Tauri Rust backend has latency and UX issues:
- Fixed 8-second recording timeout (no VAD)
- TTS must process entire response before playback
- No natural turn-taking or interruption support

LiveKit Agents provides a production-grade framework for real-time voice AI, used by companies like Cartesia, ElevenLabs, and others for voice agent deployments.

### Constraints
- Must remain fully local (no cloud services except Nebius LLM)
- Must work on Windows with 6GB GPU
- Setup complexity should be manageable
- Should not significantly increase resource usage

### Stakeholders
- Primary user: Single developer for personal use
- Future: Potential SaaS offering

## Goals / Non-Goals

### Goals
- Natural conversation with automatic speech detection
- Streaming TTS for faster perceived response
- Support for interrupting AI mid-sentence
- Maintain full local privacy for voice processing
- One-command startup (Docker Compose)

### Non-Goals (this phase)
- Video support
- Multi-participant rooms
- Cloud LiveKit deployment
- Custom wake word detection

## Decisions

### D1: LiveKit Server Deployment - Local Docker

**Decision**: Run LiveKit server locally via Docker

**Rationale**:
- Official Docker image available
- Single command startup
- Isolated environment
- Same as production setup

**Alternatives Considered**:
- Binary download: Requires manual setup per OS
- LiveKit Cloud: Adds latency, cost, privacy concerns

### D2: STT Engine - faster-whisper

**Decision**: Use faster-whisper (CTranslate2) instead of whisper.cpp

**Rationale**:
- 4x faster than whisper.cpp
- Better GPU utilization
- Native Python integration with LiveKit
- Same accuracy as original Whisper

**Performance Comparison**:
| Engine | 10s Audio | VRAM |
|--------|-----------|------|
| whisper.cpp (small) | ~2.5s | 2GB |
| faster-whisper (small) | ~0.6s | 2GB |

### D3: VAD - Silero VAD (via LiveKit)

**Decision**: Use Silero VAD integrated in LiveKit agents

**Rationale**:
- Built into livekit-agents SDK
- Automatic turn detection
- Configurable silence thresholds
- No additional setup

### D4: TTS Engine - Piper (streaming)

**Decision**: Keep Piper TTS but integrate via LiveKit streaming

**Rationale**:
- Already working and tested
- Good quality for the size
- CPU-based (leaves GPU for Whisper)
- LiveKit handles sentence streaming

### D5: LLM Integration - In Python Agent

**Decision**: Move LLM calls from Tauri to Python agent

**Rationale**:
- Simpler conversation flow (all in one place)
- Agent can handle context, interruptions
- Reduces Tauri complexity
- LiveKit agents has built-in LLM support

**Trade-off**: Tauri becomes a "dumb" audio client, logic moves to Python

### D6: Process Management - Docker Compose

**Decision**: Use Docker Compose for all services

**Rationale**:
- One-command startup: `docker-compose up`
- Consistent environment
- Easy to stop/restart
- Network isolation

**Services in docker-compose.yml**:
```yaml
services:
  livekit:
    image: livekit/livekit-server
    ports: ["7880:7880", "7881:7881"]

  voice-agent:
    build: ./apps/voice-agent
    depends_on: [livekit]
    environment:
      - NEBIUS_API_KEY=${NEBIUS_API_KEY}
```

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S LAPTOP                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         DOCKER COMPOSE                              │ │
│  │                                                                     │ │
│  │  ┌─────────────────────┐      ┌─────────────────────────────────┐ │ │
│  │  │   LiveKit Server    │      │       Voice Agent (Python)      │ │ │
│  │  │   (localhost:7880)  │◄────►│                                 │ │ │
│  │  │                     │      │  ┌───────────────────────────┐  │ │ │
│  │  │  - WebRTC SFU       │      │  │  livekit-agents SDK       │  │ │ │
│  │  │  - Room management  │      │  │                           │  │ │ │
│  │  │  - Audio routing    │      │  │  ┌─────────────────────┐  │  │ │ │
│  │  │                     │      │  │  │   faster-whisper    │  │  │ │ │
│  │  └─────────────────────┘      │  │  │   (STT - GPU)       │  │  │ │ │
│  │           ▲                   │  │  └─────────────────────┘  │  │ │ │
│  │           │                   │  │                           │  │ │ │
│  │           │ WebRTC            │  │  ┌─────────────────────┐  │  │ │ │
│  │           │                   │  │  │   Silero VAD        │  │  │ │ │
│  │           │                   │  │  │   (Turn Detection)  │  │  │ │ │
│  └───────────┼───────────────────│  │  └─────────────────────┘  │  │ │ │
│              │                   │  │                           │  │ │ │
│              │                   │  │  ┌─────────────────────┐  │  │ │ │
│              │                   │  │  │   Piper TTS         │  │  │ │ │
│              │                   │  │  │   (Streaming)       │  │  │ │ │
│              │                   │  │  └─────────────────────┘  │  │ │ │
│              │                   │  │                           │  │ │ │
│              │                   │  └───────────────────────────┘  │ │ │
│              │                   │                                 │ │ │
│              │                   │  ┌───────────────────────────┐  │ │ │
│              │                   │  │   LLM Client              │  │ │ │
│              │                   │  │   (Nebius API)            │──┼─┼─┼──► Nebius
│              │                   │  └───────────────────────────┘  │ │ │    Cloud
│              │                   │                                 │ │ │
│              │                   └─────────────────────────────────┘ │ │
│              │                                                       │ │
│  ┌───────────┴────────────────────────────────────────────────────┐  │ │
│  │                    TAURI DESKTOP APP                            │  │ │
│  │                                                                 │  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │ │
│  │  │                   React Frontend                         │   │  │ │
│  │  │                                                          │   │  │ │
│  │  │  ┌────────────────┐  ┌────────────────────────────────┐ │   │  │ │
│  │  │  │ LiveKit Client │  │        Chat UI                  │ │   │  │ │
│  │  │  │ (WebRTC)       │  │  - Messages                     │ │   │  │ │
│  │  │  │                │  │  - Voice indicator              │ │   │  │ │
│  │  │  │ - Join room    │  │  - Persona selector             │ │   │  │ │
│  │  │  │ - Send audio   │  │  - Settings                     │ │   │  │ │
│  │  │  │ - Receive audio│  │                                 │ │   │  │ │
│  │  │  └────────────────┘  └────────────────────────────────┘ │   │  │ │
│  │  │                                                          │   │  │ │
│  │  └─────────────────────────────────────────────────────────┘   │  │ │
│  │                                                                 │  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │ │
│  │  │                   Rust Backend (Simplified)              │   │  │ │
│  │  │                                                          │   │  │ │
│  │  │  - SQLite (chat history, settings)                       │   │  │ │
│  │  │  - Qdrant (RAG - future)                                 │   │  │ │
│  │  │  - Global hotkey (optional)                              │   │  │ │
│  │  │  - Fallback STT/TTS (optional)                           │   │  │ │
│  │  │                                                          │   │  │ │
│  │  └─────────────────────────────────────────────────────────┘   │  │ │
│  │                                                                 │  │ │
│  └─────────────────────────────────────────────────────────────────┘  │ │
│                                                                        │ │
└────────────────────────────────────────────────────────────────────────┘ │
```

### Voice Pipeline Flow (New)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CONVERSATION FLOW                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. User clicks "Start Conversation" in Tauri                            │
│     └──► Tauri connects to LiveKit room via WebRTC                       │
│                                                                           │
│  2. User speaks (microphone audio)                                        │
│     └──► WebRTC streams audio to LiveKit server                          │
│         └──► LiveKit routes to Voice Agent                               │
│                                                                           │
│  3. Voice Agent processes audio                                           │
│     ├──► Silero VAD detects speech start                                 │
│     ├──► Audio buffers during speech                                     │
│     ├──► Silero VAD detects speech end (silence)                         │
│     └──► faster-whisper transcribes (~0.5s for 10s audio)                │
│                                                                           │
│  4. Agent builds prompt and calls LLM                                     │
│     ├──► System prompt + persona                                         │
│     ├──► Conversation history                                            │
│     ├──► User transcription                                              │
│     └──► Nebius API (streaming response)                                 │
│                                                                           │
│  5. Agent streams TTS response                                            │
│     ├──► LLM tokens buffer into sentences                                │
│     ├──► Each sentence → Piper TTS → audio chunk                         │
│     ├──► Audio streams back through LiveKit                              │
│     └──► User hears response (low latency, streaming)                    │
│                                                                           │
│  6. User can interrupt anytime                                            │
│     ├──► Silero VAD detects new speech                                   │
│     ├──► Agent stops current TTS                                         │
│     └──► New user input processed                                        │
│                                                                           │
│  7. Conversation continues until user disconnects                         │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Interactions

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tauri     │     │  LiveKit    │     │   Voice     │     │   Nebius    │
│   (React)   │     │   Server    │     │   Agent     │     │   API       │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  Connect to room  │                   │                   │
       │──────────────────►│                   │                   │
       │                   │  Agent joins room │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │  Audio stream     │                   │                   │
       │==================►│  Forward audio    │                   │
       │                   │==================►│                   │
       │                   │                   │                   │
       │                   │                   │  VAD: Speech end  │
       │                   │                   │──────┐            │
       │                   │                   │◄─────┘            │
       │                   │                   │                   │
       │                   │                   │  STT: Transcribe  │
       │                   │                   │──────┐            │
       │                   │                   │◄─────┘            │
       │                   │                   │                   │
       │                   │                   │  LLM: Generate    │
       │                   │                   │──────────────────►│
       │                   │                   │◄──────────────────│
       │                   │                   │  (streaming)      │
       │                   │                   │                   │
       │                   │                   │  TTS: Synthesize  │
       │                   │                   │──────┐            │
       │                   │                   │◄─────┘            │
       │                   │                   │                   │
       │                   │  Audio response   │                   │
       │◄==================│◄==================│                   │
       │                   │                   │                   │
```

## Risks / Trade-offs

### R1: Increased Complexity
- **Risk**: More moving parts (3 processes vs 1)
- **Mitigation**: Docker Compose handles orchestration
- **Fallback**: Keep Rust STT/TTS as single-process fallback

### R2: Python Dependency
- **Risk**: Users need Python environment
- **Mitigation**: Docker container includes all dependencies
- **Alternative**: Pre-built binaries (future)

### R3: Resource Usage
- **Risk**: More memory/CPU with multiple processes
- **Estimated Usage**:
  - LiveKit Server: ~50MB RAM
  - Python Agent: ~500MB RAM (with models loaded)
  - Total additional: ~550MB
- **Mitigation**: Acceptable for modern systems

### R4: Startup Time
- **Risk**: Longer startup with Docker containers
- **Mitigation**: Keep containers running in background
- **Optimization**: Lazy model loading in agent

### R5: Network Dependency (localhost)
- **Risk**: WebRTC requires network stack even for localhost
- **Mitigation**: All traffic stays on localhost (127.0.0.1)
- **Verification**: No external network calls except Nebius API

## File Structure

```
private-assistant/
├── apps/
│   ├── desktop/                    # Existing Tauri app (modified)
│   │   ├── src/
│   │   │   ├── hooks/
│   │   │   │   └── useLiveKit.ts   # NEW: LiveKit room connection
│   │   │   ├── services/
│   │   │   │   └── livekit.ts      # NEW: LiveKit client service
│   │   │   └── components/
│   │   │       └── VoiceRoom.tsx   # NEW: Voice conversation UI
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── stt.rs          # KEEP: Fallback STT
│   │           └── tts.rs          # KEEP: Fallback TTS
│   │
│   └── voice-agent/                # NEW: Python LiveKit agent
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── agent.py                # Main agent code
│       ├── stt.py                  # faster-whisper integration
│       ├── tts.py                  # Piper integration
│       └── llm.py                  # Nebius client
│
├── docker-compose.yml              # NEW: Orchestration
├── .env.example                    # NEW: Environment template
└── scripts/
    ├── start-voice.sh              # NEW: Non-Docker startup
    └── start-voice.ps1             # NEW: Windows startup
```

## Migration Plan

### Phase 1: Setup Infrastructure
1. Create `apps/voice-agent/` directory
2. Create Docker Compose configuration
3. Test LiveKit server connectivity

### Phase 2: Implement Python Agent
1. Create basic agent with Silero VAD
2. Integrate faster-whisper STT
3. Integrate Piper TTS
4. Connect Nebius LLM

### Phase 3: Modify Tauri Frontend
1. Add livekit-client-sdk-js
2. Create LiveKit room hooks
3. Create voice conversation UI
4. Keep existing voice code as fallback

### Phase 4: Testing & Polish
1. End-to-end conversation testing
2. Latency optimization
3. Error handling
4. Documentation

## Open Questions

### Q1: Conversation History Sync
How should chat history sync between Tauri (SQLite) and Python agent?

**Options**:
1. Agent sends transcripts to Tauri via WebSocket
2. Agent writes directly to SQLite
3. Shared message queue (Redis/RabbitMQ)

**Recommendation**: Option 1 - Agent sends events, Tauri persists

### Q2: Persona Configuration
How should persona settings reach the Python agent?

**Options**:
1. Pass via room metadata on connect
2. REST API on agent
3. Shared config file

**Recommendation**: Option 1 - Room metadata is simplest

### Q3: RAG Integration
Should RAG move to Python agent or stay in Tauri?

**Options**:
1. Keep in Tauri (Qdrant embedded), send context via metadata
2. Move to Python agent (qdrant-client)

**Recommendation**: Start with Option 1, migrate later if needed
