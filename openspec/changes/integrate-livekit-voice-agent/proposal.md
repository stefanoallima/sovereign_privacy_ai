# Change: Integrate LiveKit Voice Agent

## Why

The current voice implementation has several limitations:

1. **No Voice Activity Detection (VAD)**: Users must manually stop recording after a fixed timeout (8 seconds), making conversation unnatural
2. **High TTS Latency**: Piper must process the entire response before playback starts, causing noticeable delays for verbose LLM responses
3. **No Turn-Taking**: The system doesn't naturally detect when the user finishes speaking or when to interrupt
4. **Sequential Processing**: STT and TTS are blocking operations in the Tauri Rust backend

LiveKit Agents provides a production-grade solution for real-time voice AI with:
- Automatic VAD (Voice Activity Detection) using Silero
- Streaming TTS with sentence-by-sentence playback
- Natural turn-taking and interruption handling
- Support for faster-whisper (faster than whisper.cpp)

## What Changes

### Architecture Change

**Current**: Tauri Rust backend directly handles STT/TTS
```
Tauri App (Rust) → Whisper.cpp → Piper → Audio
```

**Proposed**: LiveKit Agent runs as a local service
```
Tauri App (React) ←WebRTC→ LiveKit Server (localhost) ←→ LiveKit Agent (Python)
                                                            ├── faster-whisper (STT)
                                                            ├── Silero VAD
                                                            ├── Piper TTS
                                                            └── Nebius LLM
```

### New Components

1. **LiveKit Server** (localhost:7880)
   - Open-source WebRTC SFU
   - Runs locally via Docker or binary
   - Handles audio/video routing

2. **LiveKit Python Agent** (new `apps/voice-agent/`)
   - Uses livekit-agents SDK
   - Integrates faster-whisper for STT
   - Integrates Piper for TTS
   - Connects to Nebius API for LLM
   - Runs as background process

3. **Tauri WebRTC Integration** (modified `apps/desktop/`)
   - Replace direct STT/TTS calls with LiveKit room connection
   - Use livekit-client-sdk-js for WebRTC
   - Audio flows through WebRTC instead of local processing

### Removed Components

- Direct Whisper.cpp integration in Rust (moved to Python agent)
- Direct Piper integration in Rust (moved to Python agent)
- Manual recording timeout logic
- Sentence-by-sentence TTS processing in Rust

## Impact

### Affected Specs
- `voice-pipeline` - Major changes to STT/TTS flow
- `desktop-app` - New WebRTC integration, removed Rust audio processing

### Affected Code

**Modified:**
- `apps/desktop/src/` - Replace voice hooks with LiveKit client
- `apps/desktop/src-tauri/` - Remove STT/TTS Rust modules (optional, can keep as fallback)

**New:**
- `apps/voice-agent/` - Python LiveKit agent
- `apps/voice-agent/agent.py` - Main agent code
- `apps/voice-agent/requirements.txt` - Python dependencies
- `docker-compose.yml` - LiveKit server configuration

### Dependencies

**New Dependencies:**
| Component | Purpose | License |
|-----------|---------|---------|
| LiveKit Server | WebRTC SFU | Apache 2.0 |
| livekit-agents | Python agent SDK | Apache 2.0 |
| faster-whisper | STT (CTranslate2) | MIT |
| Silero VAD | Voice activity detection | MIT |
| livekit-client-sdk-js | Frontend WebRTC | Apache 2.0 |

**Removed Dependencies:**
- whisper.cpp / whisper-rs (Rust)
- piper-rs (can keep as fallback)

### Cost Analysis

| Component | Monthly Cost |
|-----------|--------------|
| LiveKit Server (local) | FREE |
| faster-whisper (local) | FREE |
| Piper TTS (local) | FREE |
| Silero VAD (local) | FREE |
| Nebius API | ~3-5 EUR |
| **Total** | **~3-5 EUR** (unchanged) |

## Trade-offs

### Advantages
1. **Better UX**: Natural conversation with automatic turn detection
2. **Lower Latency**: Streaming TTS plays audio as it's generated
3. **Production-Grade**: LiveKit is used by major companies for voice AI
4. **Faster STT**: faster-whisper is 4x faster than whisper.cpp
5. **Interruption Support**: User can interrupt AI mid-sentence
6. **Extensible**: Easy to swap STT/TTS providers

### Disadvantages
1. **Additional Complexity**: Requires running LiveKit server + Python agent
2. **Python Dependency**: Agent requires Python environment
3. **More Processes**: Three processes instead of one (Tauri + LiveKit + Agent)
4. **Setup Overhead**: First-time setup is more involved

### Mitigations
- Provide Docker Compose for one-command startup
- Include startup scripts for non-Docker users
- Keep Rust STT/TTS as fallback option
- Auto-start services with Tauri app

## Open Questions

### Q1: Process Management
How should the LiveKit server and Python agent be started?

**Options:**
1. Docker Compose (recommended for simplicity)
2. Tauri spawns child processes on startup
3. Separate Windows services
4. Manual start by user

**Recommendation:** Docker Compose with fallback to manual start

### Q2: Fallback Mode
Should we keep the current Rust STT/TTS as a fallback?

**Options:**
1. Remove entirely (simpler codebase)
2. Keep as fallback when LiveKit unavailable
3. User-configurable mode

**Recommendation:** Keep as fallback for reliability

### Q3: LLM Integration Location
Where should the Nebius API call happen?

**Options:**
1. In Python agent (cleaner, all voice logic together)
2. In Tauri (current location, agent just handles voice)

**Recommendation:** Move to Python agent for simpler conversation flow
