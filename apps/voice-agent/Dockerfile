FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (for layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Piper TTS binary and model
RUN mkdir -p /app/bin /app/models

# Download Piper binary (Linux x64)
RUN wget -q https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz -O /tmp/piper.tar.gz \
    && tar -xzf /tmp/piper.tar.gz -C /app/bin --strip-components=1 \
    && rm /tmp/piper.tar.gz \
    && chmod +x /app/bin/piper

# Download default English voice model
RUN wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx -O /app/models/en_US-lessac-medium.onnx \
    && wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json -O /app/models/en_US-lessac-medium.onnx.json

# Add piper to PATH
ENV PATH="/app/bin:${PATH}"

# Copy agent code
COPY . .

# Pre-download Whisper model (optional - can be commented out for faster builds)
# RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu')"

# Environment defaults
ENV LIVEKIT_URL=ws://livekit:7880
ENV LIVEKIT_API_KEY=devkey
ENV LIVEKIT_API_SECRET=secret
ENV PIPER_MODEL_PATH=/app/models/en_US-lessac-medium.onnx
ENV WHISPER_MODEL=small

# Run the agent
CMD ["python", "agent.py", "start"]
