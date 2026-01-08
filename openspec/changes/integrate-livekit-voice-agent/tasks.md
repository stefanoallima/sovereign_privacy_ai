# Tasks: Integrate LiveKit Voice Agent

## Overview

This task list implements the LiveKit voice agent integration for improved conversation quality with automatic VAD, streaming TTS, and natural turn-taking.

**Estimated Complexity**: Medium-High
**Dependencies**: Docker, Python 3.10+, Node.js
**Status**: Phase 1-3 Complete

---

## Phase 1: Infrastructure Setup

### Task 1.1: Create Docker Compose Configuration - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Small

Create `docker-compose.yml` at project root:

```yaml
version: '3.8'
services:
  livekit:
    image: livekit/livekit-server:latest
    command: --dev --bind 0.0.0.0
    ports:
      - "7880:7880"   # HTTP/WebSocket
      - "7881:7881"   # RTC (UDP)
      - "7882:7882"   # RTC (TCP)
    environment:
      - LIVEKIT_KEYS=devkey:secret

  voice-agent:
    build: ./apps/voice-agent
    depends_on:
      - livekit
    environment:
      - LIVEKIT_URL=ws://livekit:7880
      - LIVEKIT_API_KEY=devkey
      - LIVEKIT_API_SECRET=secret
      - NEBIUS_API_KEY=${NEBIUS_API_KEY}
    volumes:
      - ./models:/app/models  # Shared model cache
```

**Validation**: `docker-compose config` passes without errors

---

### Task 1.2: Create Voice Agent Directory Structure - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Small

Create directory structure:
```
apps/voice-agent/
├── Dockerfile
├── requirements.txt
├── agent.py
├── stt.py
├── tts.py
├── llm.py
└── README.md
```

**Validation**: Directory exists with all files (can be stubs initially)

---

### Task 1.3: Create Python Agent Dockerfile - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Small

Create `apps/voice-agent/Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for audio
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY . .

# Download models on build (optional, can be lazy-loaded)
# RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small')"

CMD ["python", "agent.py"]
```

**Validation**: `docker build -t voice-agent ./apps/voice-agent` succeeds

---

### Task 1.4: Create Requirements File - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Small

Create `apps/voice-agent/requirements.txt`:

```
livekit-agents>=0.8.0
livekit-plugins-silero>=0.6.0
faster-whisper>=1.0.0
piper-tts>=1.2.0
openai>=1.0.0
python-dotenv>=1.0.0
numpy>=1.24.0
```

**Validation**: `pip install -r requirements.txt` in a venv succeeds

---

## Phase 2: Python Voice Agent Implementation

### Task 2.1: Implement Basic LiveKit Agent - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Medium
**Depends on**: 1.1, 1.2, 1.3, 1.4

Create `apps/voice-agent/agent.py`:

```python
import asyncio
from livekit import agents
from livekit.agents import JobContext, WorkerOptions, cli

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    print(f"Connected to room: {ctx.room.name}")

    # Agent will be expanded in subsequent tasks

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

**Validation**:
- Agent starts without errors
- Agent connects to LiveKit room
- `docker-compose up` shows agent connected

---

### Task 2.2: Integrate Silero VAD - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Medium
**Depends on**: 2.1

Add VAD to agent for automatic speech detection:

```python
from livekit.agents import AutoSubscribe
from livekit.plugins import silero

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    vad = silero.VAD.load()
    # VAD will trigger on speech start/end
```

**Validation**:
- VAD detects speech when user talks
- VAD detects silence when user stops
- Console logs show speech start/end events

---

### Task 2.3: Integrate faster-whisper STT - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Medium
**Depends on**: 2.2

Create `apps/voice-agent/stt.py`:

```python
from faster_whisper import WhisperModel

class STT:
    def __init__(self, model_size="small"):
        self.model = WhisperModel(model_size, device="cuda", compute_type="float16")

    def transcribe(self, audio_path: str) -> str:
        segments, info = self.model.transcribe(audio_path)
        return " ".join([seg.text for seg in segments])
```

Integrate in agent:
```python
from stt import STT

stt = STT()
# On VAD speech end, transcribe buffered audio
```

**Validation**:
- STT transcribes audio correctly
- Transcription latency < 1 second for 10s audio
- GPU is utilized (check nvidia-smi)

---

### Task 2.4: Integrate Piper TTS - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Medium
**Depends on**: 2.3

Create `apps/voice-agent/tts.py`:

```python
import subprocess
import tempfile

class TTS:
    def __init__(self, model_path: str):
        self.model_path = model_path

    def synthesize(self, text: str) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            subprocess.run([
                "piper",
                "--model", self.model_path,
                "--output_file", f.name
            ], input=text.encode(), check=True)
            return open(f.name, "rb").read()
```

**Validation**:
- TTS generates audio from text
- Audio plays correctly
- Synthesis latency < 500ms per sentence

---

### Task 2.5: Integrate Nebius LLM - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Medium
**Depends on**: 2.4

Create `apps/voice-agent/llm.py`:

```python
from openai import OpenAI

class LLM:
    def __init__(self, api_key: str, model: str = "Qwen/Qwen3-235B-A22B"):
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.studio.nebius.ai/v1"
        )
        self.model = model

    async def generate(self, messages: list, stream: bool = True):
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=stream
        )
        if stream:
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            return response.choices[0].message.content
```

**Validation**:
- LLM generates responses
- Streaming works correctly
- Responses are coherent

---

### Task 2.6: Implement Full Conversation Loop - [x] DONE
**Priority**: P0 (Blocking)
**Effort**: Large
**Depends on**: 2.2, 2.3, 2.4, 2.5

Complete the agent with full conversation flow:

```python
async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    vad = silero.VAD.load()
    stt = STT()
    tts = TTS(model_path="/app/models/en_US-lessac-medium.onnx")
    llm = LLM(api_key=os.environ["NEBIUS_API_KEY"])

    conversation_history = []

    # Main conversation loop
    async for event in ctx.room.events:
        if event.type == "speech_end":
            # 1. Transcribe
            text = stt.transcribe(event.audio)
            conversation_history.append({"role": "user", "content": text})

            # 2. Generate response
            async for chunk in llm.generate(conversation_history):
                # 3. TTS and stream back
                audio = tts.synthesize(chunk)
                await ctx.room.local_participant.publish_audio(audio)

            conversation_history.append({"role": "assistant", "content": response})
```

**Validation**:
- Full conversation works end-to-end
- User speaks → AI responds with voice
- Turn-taking feels natural
- Interruption works

---

## Phase 3: Tauri Frontend Integration

### Task 3.1: Install LiveKit Client SDK - [x] DONE
**Priority**: P1
**Effort**: Small
**Depends on**: Phase 2 complete

Add to `apps/desktop/package.json`:

```json
{
  "dependencies": {
    "livekit-client": "^2.0.0"
  }
}
```

Run: `pnpm install`

**Validation**: Package installs without errors

---

### Task 3.2: Create LiveKit Service - [x] DONE
**Priority**: P1
**Effort**: Medium
**Depends on**: 3.1

Create `apps/desktop/src/services/livekit.ts`:

```typescript
import { Room, RoomEvent, Track } from 'livekit-client';

export class LiveKitService {
  private room: Room | null = null;

  async connect(url: string, token: string): Promise<void> {
    this.room = new Room();
    await this.room.connect(url, token);
  }

  async enableMicrophone(): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(true);
  }

  async disableMicrophone(): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(false);
  }

  onAudioReceived(callback: (track: Track) => void): void {
    this.room?.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        callback(track);
      }
    });
  }

  disconnect(): void {
    this.room?.disconnect();
    this.room = null;
  }
}
```

**Validation**: Service compiles without TypeScript errors

---

### Task 3.3: Create useLiveKit Hook - [x] DONE
**Priority**: P1
**Effort**: Medium
**Depends on**: 3.2

Create `apps/desktop/src/hooks/useLiveKit.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react';
import { LiveKitService } from '@/services/livekit';

export function useLiveKit() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [service] = useState(() => new LiveKitService());

  const connect = useCallback(async () => {
    await service.connect('ws://localhost:7880', 'dev-token');
    setIsConnected(true);
  }, [service]);

  const startSpeaking = useCallback(async () => {
    await service.enableMicrophone();
    setIsSpeaking(true);
  }, [service]);

  const stopSpeaking = useCallback(async () => {
    await service.disableMicrophone();
    setIsSpeaking(false);
  }, [service]);

  return { isConnected, isSpeaking, connect, startSpeaking, stopSpeaking };
}
```

**Validation**: Hook works in React component

---

### Task 3.4: Create Voice Conversation Component - [x] DONE
**Priority**: P1
**Effort**: Medium
**Depends on**: 3.3

Create `apps/desktop/src/components/chat/VoiceConversation.tsx`:

```typescript
export function VoiceConversation() {
  const { isConnected, isSpeaking, connect, startSpeaking, stopSpeaking } = useLiveKit();

  return (
    <div>
      {!isConnected ? (
        <button onClick={connect}>Start Voice Chat</button>
      ) : (
        <button
          onMouseDown={startSpeaking}
          onMouseUp={stopSpeaking}
        >
          {isSpeaking ? 'Speaking...' : 'Hold to Talk'}
        </button>
      )}
    </div>
  );
}
```

**Validation**: Component renders and connects to LiveKit

---

### Task 3.5: Integrate with Existing Chat UI - [x] DONE
**Priority**: P1
**Effort**: Medium
**Depends on**: 3.4

Modify `ChatWindow.tsx` to support LiveKit mode alongside existing voice:

- Add toggle between "LiveKit" and "Local" voice modes
- When LiveKit mode, use new VoiceConversation component
- When Local mode, use existing useVoice hook

**Validation**: Both modes work, user can switch between them

---

## Phase 4: Testing & Polish

### Task 4.1: End-to-End Testing
**Priority**: P1
**Effort**: Medium
**Depends on**: Phase 3 complete

Test scenarios:
1. Start conversation, speak, hear response
2. Interrupt AI mid-sentence
3. Long conversation (10+ turns)
4. Network disconnection/reconnection
5. Multiple rapid utterances

**Validation**: All scenarios pass manual testing

---

### Task 4.2: Latency Optimization
**Priority**: P2
**Effort**: Medium
**Depends on**: 4.1

Measure and optimize:
- Time from speech end to first audio response
- Target: < 2 seconds

Optimizations:
- Pre-load models at startup
- Use GPU for Whisper
- Sentence-level TTS streaming

**Validation**: Latency meets target

---

### Task 4.3: Error Handling
**Priority**: P2
**Effort**: Medium
**Depends on**: 4.1

Handle errors gracefully:
- LiveKit connection failure → Show reconnect option
- STT failure → Retry or fallback message
- LLM timeout → Graceful error to user
- TTS failure → Skip audio, show text

**Validation**: Errors are handled without crashes

---

### Task 4.4: Documentation
**Priority**: P2
**Effort**: Small
**Depends on**: 4.1

Create/update:
- `apps/voice-agent/README.md` - Setup and usage
- `CLAUDE.md` - Add LiveKit startup instructions
- `.env.example` - Document required env vars

**Validation**: New user can set up from docs

---

## Summary

| Phase | Tasks | Effort | Dependencies | Status |
|-------|-------|--------|--------------|--------|
| 1. Infrastructure | 4 | Small-Medium | None | **COMPLETE** |
| 2. Python Agent | 6 | Medium-Large | Phase 1 | **COMPLETE** |
| 3. Frontend | 5 | Medium | Phase 2 | **COMPLETE** |
| 4. Testing | 4 | Medium | Phase 3 | Pending |

**Total Tasks**: 19
**Completed Tasks**: 15 (Phase 1-3)
**Remaining Tasks**: 4 (Phase 4: Testing & Polish)
**Critical Path**: 1.1 → 2.1 → 2.6 → 3.3 → 3.5 → 4.1
