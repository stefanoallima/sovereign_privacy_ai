"""
Speech-to-Text using faster-whisper (CTranslate2)

faster-whisper provides 4x speedup over whisper.cpp with the same accuracy.
Uses GPU acceleration when available.
"""

import io
import logging
import tempfile
from typing import Optional

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class STT:
    """Speech-to-text using faster-whisper."""

    def __init__(self, model_size: str = "small", device: str = "auto", compute_type: str = "auto"):
        """
        Initialize the STT engine.

        Args:
            model_size: Whisper model size (tiny, base, small, medium, large-v2, large-v3)
            device: Device to use (auto, cuda, cpu)
            compute_type: Compute type (auto, float16, int8, int8_float16)
        """
        logger.info(f"Loading Whisper model: {model_size} on {device}")

        # Auto-detect device and compute type
        if device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                device = "cpu"

        if compute_type == "auto":
            compute_type = "float16" if device == "cuda" else "int8"

        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type
        )
        self.device = device
        logger.info(f"Whisper model loaded on {device} with {compute_type}")

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> str:
        """
        Transcribe audio file to text.

        Args:
            audio_path: Path to audio file (WAV, MP3, etc.)
            language: Language code (e.g., "en", "es") or None for auto-detect

        Returns:
            Transcribed text
        """
        try:
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                beam_size=5,
                vad_filter=True,  # Use VAD to filter out non-speech
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=400
                )
            )

            # Combine all segments
            text = " ".join([segment.text.strip() for segment in segments])

            logger.info(f"Transcribed ({info.language}, {info.duration:.1f}s): {text[:100]}...")
            return text

        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""

    def transcribe_bytes(self, audio_data: bytes, language: Optional[str] = None) -> str:
        """
        Transcribe audio bytes to text.

        Args:
            audio_data: Raw audio bytes (WAV format)
            language: Language code or None for auto-detect

        Returns:
            Transcribed text
        """
        # Write to temporary file (faster-whisper requires file path)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name

        try:
            return self.transcribe(temp_path, language)
        finally:
            import os
            try:
                os.unlink(temp_path)
            except Exception:
                pass

    def transcribe_stream(self, audio_stream: io.BytesIO, language: Optional[str] = None) -> str:
        """
        Transcribe audio stream to text.

        Args:
            audio_stream: BytesIO stream with audio data
            language: Language code or None for auto-detect

        Returns:
            Transcribed text
        """
        return self.transcribe_bytes(audio_stream.read(), language)
