"""
LLM Client for Nebius API

Uses OpenAI-compatible API to interact with Nebius AI Studio.
Supports streaming responses for low-latency TTS.
"""

import logging
from typing import AsyncGenerator, Optional

from openai import AsyncOpenAI, OpenAI

logger = logging.getLogger(__name__)

# Default system prompt for voice assistant
DEFAULT_SYSTEM_PROMPT = """You are a helpful, conversational AI assistant.
Keep your responses concise and natural for voice conversation.
Avoid using markdown, code blocks, or special formatting.
Speak naturally as if having a conversation."""


class LLM:
    """LLM client for Nebius API with streaming support."""

    def __init__(
        self,
        api_key: str,
        model: str = "Qwen/Qwen3-235B-A22B",
        base_url: str = "https://api.studio.nebius.ai/v1",
        system_prompt: Optional[str] = None
    ):
        """
        Initialize the LLM client.

        Args:
            api_key: Nebius API key
            model: Model identifier
            base_url: Nebius API base URL
            system_prompt: System prompt for the assistant
        """
        if not api_key:
            raise ValueError("NEBIUS_API_KEY is required")

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.sync_client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.model = model
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT

        logger.info(f"LLM client initialized with model: {model}")

    async def generate(
        self,
        messages: list[dict],
        stream: bool = True,
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """
        Generate a response from the LLM.

        Args:
            messages: Conversation history
            stream: Whether to stream the response
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature

        Yields:
            Response text chunks (if streaming)
        """
        # Prepare messages with system prompt
        full_messages = [
            {"role": "system", "content": self.system_prompt}
        ] + messages

        try:
            if stream:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=full_messages,
                    stream=True,
                    max_tokens=max_tokens,
                    temperature=temperature
                )

                async for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content

            else:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=full_messages,
                    stream=False,
                    max_tokens=max_tokens,
                    temperature=temperature
                )

                if response.choices:
                    yield response.choices[0].message.content

        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            yield "I'm sorry, I encountered an error generating a response."

    def generate_sync(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> str:
        """
        Generate a response synchronously (blocking).

        Args:
            messages: Conversation history
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature

        Returns:
            Complete response text
        """
        full_messages = [
            {"role": "system", "content": self.system_prompt}
        ] + messages

        try:
            response = self.sync_client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=False,
                max_tokens=max_tokens,
                temperature=temperature
            )

            if response.choices:
                return response.choices[0].message.content
            return ""

        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            return "I'm sorry, I encountered an error generating a response."

    def set_system_prompt(self, prompt: str):
        """Update the system prompt."""
        self.system_prompt = prompt

    def set_persona(self, persona_name: str, persona_prompt: str):
        """
        Set a persona for the assistant.

        Args:
            persona_name: Name of the persona
            persona_prompt: Persona description/prompt
        """
        self.system_prompt = f"""You are {persona_name}, a voice assistant.
{persona_prompt}
Keep your responses concise and natural for voice conversation.
Avoid using markdown, code blocks, or special formatting.
Speak naturally as if having a conversation."""
        logger.info(f"Persona set to: {persona_name}")
