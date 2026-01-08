"""
LiveKit Voice Agent for Private Personal Assistant

Uses local STT (faster-whisper) and TTS (Piper) with Nebius LLM.
Simple amplitude-based VAD for turn detection.
"""

import asyncio
import os
import logging
import io
import wave

import numpy as np
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe

from openai import OpenAI
from tts import TTS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment
NEBIUS_API_KEY = os.environ.get("NEBIUS_API_KEY")
NEBIUS_BASE_URL = "https://api.studio.nebius.ai/v1"
LLM_MODEL = os.environ.get("LLM_MODEL", "Qwen/Qwen3-235B-A22B")
PIPER_MODEL_PATH = os.environ.get("PIPER_MODEL_PATH", "/app/models/en_US-lessac-medium.onnx")

# Audio configuration
LIVEKIT_SAMPLE_RATE = 48000  # LiveKit expects 48kHz

# VAD configuration
VAD_THRESHOLD = 100  # Amplitude threshold for speech detection (lowered for sensitivity)
SILENCE_DURATION = 1.0  # Seconds of silence before end of speech
MIN_SPEECH_DURATION = 0.3  # Minimum seconds of speech to process

# System prompt for the assistant
SYSTEM_PROMPT = """You are a helpful, friendly voice assistant.
Keep your responses concise and conversational since they will be spoken aloud.
Be natural and engaging. Limit responses to 2-3 sentences."""


class SimpleVoiceAgent:
    """Simple voice agent with local STT/TTS and cloud LLM."""

    def __init__(self):
        # Initialize LLM client
        self.llm = OpenAI(
            api_key=NEBIUS_API_KEY,
            base_url=NEBIUS_BASE_URL,
        )
        self.conversation_history = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        # Initialize TTS
        logger.info(f"Loading Piper TTS from: {PIPER_MODEL_PATH}")
        self.tts = TTS(model_path=PIPER_MODEL_PATH)
        logger.info("Piper TTS initialized")

        # Try to import faster-whisper
        try:
            from faster_whisper import WhisperModel
            logger.info("Loading Whisper model...")
            self.whisper = WhisperModel("small", device="cpu", compute_type="int8")
            logger.info("Whisper model loaded")
        except Exception as e:
            logger.warning(f"Could not load Whisper: {e}")
            self.whisper = None

    def transcribe_sync(self, audio_frames: list) -> str:
        """Transcribe audio frames to text using faster-whisper."""
        if not self.whisper or not audio_frames:
            return ""

        try:
            all_samples = []
            for frame in audio_frames:
                samples = np.frombuffer(frame.data, dtype=np.int16)
                all_samples.extend(samples)

            if not all_samples:
                return ""

            audio_array = np.array(all_samples, dtype=np.float32) / 32768.0

            segments, info = self.whisper.transcribe(
                audio_array,
                language="en",
                beam_size=5,
                vad_filter=True,
            )

            text = " ".join([seg.text for seg in segments])
            return text.strip()

        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""

    def generate_response_sync(self, user_text: str) -> str:
        """Generate response using Nebius LLM."""
        import re

        self.conversation_history.append({
            "role": "user",
            "content": user_text
        })

        try:
            response = self.llm.chat.completions.create(
                model=LLM_MODEL,
                messages=self.conversation_history,
                max_tokens=200,
                temperature=0.7,
            )

            assistant_message = response.choices[0].message.content
            assistant_message = re.sub(r'<[Tt]hink>.*?</[Tt]hink>', '', assistant_message, flags=re.DOTALL)
            assistant_message = assistant_message.strip()

            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message
            })

            return assistant_message

        except Exception as e:
            logger.error(f"LLM error: {e}")
            return "I'm sorry, I had trouble generating a response."

    def synthesize_speech(self, text: str) -> np.ndarray:
        """Synthesize text to audio and resample for LiveKit."""
        if not text or not text.strip():
            return np.array([], dtype=np.int16)

        try:
            wav_bytes = self.tts.synthesize(text)
            if not wav_bytes:
                logger.warning("TTS returned empty audio")
                return np.array([], dtype=np.int16)

            with io.BytesIO(wav_bytes) as wav_buffer:
                with wave.open(wav_buffer, 'rb') as wav_file:
                    sample_rate = wav_file.getframerate()
                    n_channels = wav_file.getnchannels()
                    sample_width = wav_file.getsampwidth()
                    n_frames = wav_file.getnframes()
                    raw_data = wav_file.readframes(n_frames)

            if sample_width == 2:
                audio = np.frombuffer(raw_data, dtype=np.int16)
            else:
                logger.warning(f"Unexpected sample width: {sample_width}")
                return np.array([], dtype=np.int16)

            if n_channels == 2:
                audio = audio.reshape(-1, 2).mean(axis=1).astype(np.int16)

            if sample_rate != LIVEKIT_SAMPLE_RATE:
                duration = len(audio) / sample_rate
                target_length = int(duration * LIVEKIT_SAMPLE_RATE)
                original_indices = np.linspace(0, len(audio) - 1, len(audio))
                target_indices = np.linspace(0, len(audio) - 1, target_length)
                audio_resampled = np.interp(target_indices, original_indices, audio.astype(np.float32))
                audio = audio_resampled.astype(np.int16)

            logger.info(f"Synthesized {len(audio)} samples ({len(audio) / LIVEKIT_SAMPLE_RATE:.2f}s)")
            return audio

        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            return np.array([], dtype=np.int16)


def get_audio_energy(frame) -> float:
    """Calculate RMS energy of audio frame."""
    samples = np.frombuffer(frame.data, dtype=np.int16)
    if len(samples) == 0:
        return 0
    return np.sqrt(np.mean(samples.astype(np.float32) ** 2))


async def publish_audio(audio_source: rtc.AudioSource, audio_samples: np.ndarray):
    """Publish audio samples to LiveKit in chunks."""
    if len(audio_samples) == 0:
        return

    FRAME_SIZE = 480  # 10ms at 48kHz

    for i in range(0, len(audio_samples), FRAME_SIZE):
        chunk = audio_samples[i:i + FRAME_SIZE]

        if len(chunk) < FRAME_SIZE:
            chunk = np.pad(chunk, (0, FRAME_SIZE - len(chunk)), mode='constant')

        frame = rtc.AudioFrame(
            data=chunk.tobytes(),
            sample_rate=LIVEKIT_SAMPLE_RATE,
            num_channels=1,
            samples_per_channel=FRAME_SIZE,
        )

        await audio_source.capture_frame(frame)
        await asyncio.sleep(FRAME_SIZE / LIVEKIT_SAMPLE_RATE * 0.9)


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""
    logger.info(f"Connecting to room: {ctx.room.name if ctx.room else 'unknown'}")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Connected to room: {ctx.room.name}")

    # Initialize the voice agent
    agent = SimpleVoiceAgent()

    # Audio source for publishing TTS output
    audio_source = rtc.AudioSource(LIVEKIT_SAMPLE_RATE, 1)
    track = rtc.LocalAudioTrack.create_audio_track("agent-audio", audio_source)

    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_MICROPHONE

    await ctx.room.local_participant.publish_track(track, options)
    logger.info("Audio track published")

    # Processing state
    is_processing = False

    async def process_speech(speech_frames: list):
        """Process captured speech frames."""
        nonlocal is_processing

        if is_processing:
            logger.info("Already processing, skipping...")
            return

        is_processing = True

        try:
            logger.info(f"Transcribing {len(speech_frames)} frames...")
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, agent.transcribe_sync, speech_frames)

            if text:
                logger.info(f"User said: {text}")

                logger.info("Generating response...")
                response = await loop.run_in_executor(None, agent.generate_response_sync, text)
                logger.info(f"Agent response: {response}")

                logger.info("Synthesizing speech...")
                audio_samples = await loop.run_in_executor(None, agent.synthesize_speech, response)

                if len(audio_samples) > 0:
                    logger.info("Publishing audio to LiveKit...")
                    await publish_audio(audio_source, audio_samples)
                    logger.info("Audio playback complete")
                else:
                    logger.warning("No audio generated from TTS")
            else:
                logger.info("No speech detected in audio")
        except Exception as e:
            logger.error(f"Error processing speech: {e}")
        finally:
            is_processing = False

    async def process_audio_track(incoming_track: rtc.Track):
        """Process incoming audio track with simple amplitude VAD."""
        logger.info("Starting audio processing...")

        audio_stream = rtc.AudioStream(incoming_track)

        speech_frames = []
        is_speaking = False
        silence_frames = 0
        frames_per_second = LIVEKIT_SAMPLE_RATE / 480  # Assuming 480 samples per frame
        silence_threshold_frames = int(SILENCE_DURATION * frames_per_second)
        min_speech_frames = int(MIN_SPEECH_DURATION * frames_per_second)

        try:
            async for event in audio_stream:
                frame = event.frame
                energy = get_audio_energy(frame)

                if energy > VAD_THRESHOLD:
                    # Speech detected
                    if not is_speaking:
                        logger.info(f"Speech started (energy: {energy:.0f})")
                        is_speaking = True
                        speech_frames = []

                    speech_frames.append(frame)
                    silence_frames = 0

                else:
                    # Silence
                    if is_speaking:
                        speech_frames.append(frame)  # Keep trailing silence
                        silence_frames += 1

                        if silence_frames >= silence_threshold_frames:
                            # End of speech
                            logger.info(f"Speech ended, {len(speech_frames)} frames captured")
                            is_speaking = False

                            if len(speech_frames) >= min_speech_frames:
                                frames_copy = speech_frames.copy()
                                speech_frames = []
                                asyncio.create_task(process_speech(frames_copy))
                            else:
                                logger.info("Speech too short, ignoring")
                                speech_frames = []

        except Exception as e:
            logger.error(f"Audio stream error: {e}")

    # Handle track subscription
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Subscribed to audio track from {participant.identity}")
            asyncio.create_task(process_audio_track(track))

    @ctx.room.on("track_unsubscribed")
    def on_track_unsubscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Unsubscribed from audio track from {participant.identity}")

    logger.info("Agent is ready and waiting for audio...")

    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
