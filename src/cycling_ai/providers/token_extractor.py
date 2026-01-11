"""
Token extraction utility for LLM provider responses.

This module provides utilities to extract standardized token counts from
provider-specific metadata formats.
"""

from __future__ import annotations

from typing import Any


class TokenExtractor:
    """Extract standardized token counts from provider-specific metadata."""

    @staticmethod
    def extract_tokens(provider_name: str, metadata: dict[str, Any]) -> tuple[int | None, int | None]:
        """
        Extract input and output tokens from provider metadata.

        Different providers report token usage in different formats:
        - Anthropic: usage.input_tokens, usage.output_tokens
        - OpenAI: usage.prompt_tokens, usage.completion_tokens
        - Gemini: usage.prompt_tokens, usage.total_tokens (calculate output)
        - Bedrock: usage.input_tokens, usage.output_tokens
        - Ollama: No token reporting

        Args:
            provider_name: Name of the provider (case-insensitive)
            metadata: Provider-specific metadata dictionary

        Returns:
            Tuple of (input_tokens, output_tokens). Either value may be None if unavailable.
        """
        if not metadata:
            return None, None

        usage = metadata.get("usage")
        if not isinstance(usage, dict):
            return None, None

        # Normalize provider name to lowercase for comparison
        provider = provider_name.lower()

        # Provider-specific extraction
        if provider == "anthropic" or provider == "bedrock":
            return (
                TokenExtractor._safe_int(usage.get("input_tokens")),
                TokenExtractor._safe_int(usage.get("output_tokens")),
            )

        elif provider == "openai":
            return (
                TokenExtractor._safe_int(usage.get("prompt_tokens")),
                TokenExtractor._safe_int(usage.get("completion_tokens")),
            )

        elif provider == "gemini":
            prompt_tokens = TokenExtractor._safe_int(usage.get("prompt_tokens"))
            total_tokens = TokenExtractor._safe_int(usage.get("total_tokens"))

            # Calculate output tokens: total - prompt
            if prompt_tokens is not None and total_tokens is not None:
                output_tokens = total_tokens - prompt_tokens
                return prompt_tokens, output_tokens
            else:
                return prompt_tokens, None

        elif provider == "ollama":
            # Ollama doesn't report token counts
            return None, None

        else:
            # Unknown provider - try standard Anthropic format as fallback
            return (
                TokenExtractor._safe_int(usage.get("input_tokens")),
                TokenExtractor._safe_int(usage.get("output_tokens")),
            )

    @staticmethod
    def _safe_int(value: Any) -> int | None:
        """
        Safely convert a value to int, returning None if conversion fails.

        Args:
            value: Value to convert

        Returns:
            Integer value or None if conversion fails
        """
        if value is None:
            return None

        # Handle already-integer values
        if isinstance(value, int):
            return value

        # Try to convert strings or floats
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
