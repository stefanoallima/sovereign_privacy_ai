# Voice Agent

LiveKit-based voice agent for the Private Personal Assistant.

## Overview

This Python agent connects to a local LiveKit server and provides:
- **Silero VAD**: Automatic voice activity detection for natural turn-taking
- **faster-whisper STT**: Fast local speech-to-text using CTranslate2
- **Piper TTS**: Local neural network text-to-speech
- **Nebius LLM**: Streaming LLM responses via Nebius API

## Requirements

- Python 3.10+
- Docker (recommended) or local Python environment
- NVIDIA GPU with 6GB+ VRAM (for faster-whisper)
- Nebius API key

## Quick Start (Docker)

From the project root:

```bash
# Set your Nebius API key
export NEBIUS_API_KEY=your_key_here

# Start all services
docker-compose up
```

## Manual Start (No Docker)

1. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Download Piper voice model:
```bash
# Place model in ../models/
mkdir -p ../models
# Download from: https://github.com/rhasspy/piper/releases
```

4. Start LiveKit server separately:
```bash
docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882 \
  -e LIVEKIT_KEYS=devkey:secret livekit/livekit-server --dev
```

5. Run the agent:
```bash
export LIVEKIT_URL=ws://localhost:7880
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=secret
export NEBIUS_API_KEY=your_key_here
python agent.py
```

## Architecture

```
┌──────────────────┐     ┌───────────────┐     ┌──────────────┐
│   Tauri App      │────►│ LiveKit Server│◄───►│  Voice Agent │
│   (WebRTC)       │     │ (localhost)   │     │  (Python)    │
└──────────────────┘     └───────────────┘     └──────────────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │ Nebius API   │
                                               │ (LLM)        │
                                               └──────────────┘
```

## Configuration

Environment variables:
- `LIVEKIT_URL`: LiveKit server WebSocket URL (default: ws://livekit:7880)
- `LIVEKIT_API_KEY`: LiveKit API key (default: devkey)
- `LIVEKIT_API_SECRET`: LiveKit API secret (default: secret)
- `NEBIUS_API_KEY`: Nebius API key (required)
- `PIPER_MODEL_PATH`: Path to Piper voice model (default: /app/models/en_US-lessac-medium.onnx)
- `WHISPER_MODEL`: Whisper model size (default: small)

## Files

- `agent.py` - Main agent entrypoint
- `stt.py` - Speech-to-text using faster-whisper
- `tts.py` - Text-to-speech using Piper
- `llm.py` - LLM client for Nebius API
