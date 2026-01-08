"""
Text-to-Speech using Piper TTS

Piper is a fast, local neural TTS system that runs on CPU.
It produces high-quality speech with low latency.
"""

import io
import logging
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class TTS:
    """Text-to-speech using Piper TTS."""

    def __init__(self, model_path: str, use_cuda: bool = False):
        """
        Initialize the TTS engine.

        Args:
            model_path: Path to Piper ONNX model file
            use_cuda: Whether to use CUDA acceleration (requires onnxruntime-gpu)
        """
        self.model_path = Path(model_path)
        self.use_cuda = use_cuda

        # Verify model exists
        if not self.model_path.exists():
            logger.warning(f"Piper model not found at {model_path}. TTS will fail until model is provided.")

        # Check for piper executable
        self.piper_path = self._find_piper()
        if self.piper_path:
            logger.info(f"Piper TTS initialized with model: {model_path}")
        else:
            logger.warning("Piper executable not found. Falling back to piper-tts Python package.")

    def _find_piper(self) -> Optional[str]:
        """Find the piper executable."""
        import shutil

        # Check common locations
        piper_path = shutil.which("piper")
        if piper_path:
            return piper_path

        # Check in /app/bin (Docker)
        docker_path = Path("/app/bin/piper")
        if docker_path.exists():
            return str(docker_path)

        return None

    def synthesize(self, text: str) -> bytes:
        """
        Synthesize text to audio.

        Args:
            text: Text to synthesize

        Returns:
            WAV audio bytes
        """
        if not text or not text.strip():
            return b""

        text = self._clean_text(text)

        try:
            if self.piper_path:
                return self._synthesize_with_cli(text)
            else:
                return self._synthesize_with_python(text)
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            return b""

    def _clean_text(self, text: str) -> str:
        """Clean text for TTS synthesis."""
        # Remove markdown
        import re

        # Remove code blocks
        text = re.sub(r'```[\s\S]*?```', '', text)
        text = re.sub(r'`[^`]+`', '', text)

        # Remove URLs
        text = re.sub(r'https?://\S+', '', text)

        # Remove special characters that cause issues
        text = re.sub(r'[*#_~|]', '', text)

        # Normalize whitespace
        text = ' '.join(text.split())

        return text.strip()

    def _synthesize_with_cli(self, text: str) -> bytes:
        """Synthesize using piper CLI."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            output_path = f.name

        try:
            # Run piper
            cmd = [
                self.piper_path,
                "--model", str(self.model_path),
                "--output_file", output_path
            ]

            if self.use_cuda:
                cmd.extend(["--cuda"])

            result = subprocess.run(
                cmd,
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=30
            )

            if result.returncode != 0:
                logger.error(f"Piper CLI error: {result.stderr.decode()}")
                return b""

            # Read the output file
            with open(output_path, "rb") as f:
                return f.read()

        finally:
            import os
            try:
                os.unlink(output_path)
            except Exception:
                pass

    def _synthesize_with_python(self, text: str) -> bytes:
        """Synthesize using piper-tts Python package."""
        try:
            from piper import PiperVoice

            voice = PiperVoice.load(str(self.model_path))

            # Create in-memory WAV
            buffer = io.BytesIO()
            with wave.open(buffer, "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)  # 16-bit
                wav.setframerate(voice.config.sample_rate)

                for audio_bytes in voice.synthesize_stream_raw(text):
                    wav.writeframes(audio_bytes)

            return buffer.getvalue()

        except ImportError:
            logger.error("piper-tts package not installed")
            return b""
        except Exception as e:
            logger.error(f"Piper Python error: {e}")
            return b""

    def synthesize_to_file(self, text: str, output_path: str) -> bool:
        """
        Synthesize text to audio file.

        Args:
            text: Text to synthesize
            output_path: Path for output WAV file

        Returns:
            True if successful
        """
        audio_data = self.synthesize(text)
        if audio_data:
            with open(output_path, "wb") as f:
                f.write(audio_data)
            return True
        return False
