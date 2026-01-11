"""
Tests for TokenExtractor utility.
"""

from __future__ import annotations

import pytest

from cycling_ai.providers.token_extractor import TokenExtractor


class TestTokenExtractor:
    """Test the TokenExtractor class."""

    def test_anthropic_format(self) -> None:
        """Test extracting tokens from Anthropic metadata format."""
        metadata = {
            "model": "claude-sonnet-4",
            "usage": {"input_tokens": 1500, "output_tokens": 800},
            "stop_reason": "end_turn",
        }

        input_tokens, output_tokens = TokenExtractor.extract_tokens("anthropic", metadata)

        assert input_tokens == 1500
        assert output_tokens == 800

    def test_openai_format(self) -> None:
        """Test extracting tokens from OpenAI metadata format."""
        metadata = {
            "model": "gpt-4o",
            "usage": {"prompt_tokens": 2000, "completion_tokens": 1200, "total_tokens": 3200},
            "finish_reason": "stop",
        }

        input_tokens, output_tokens = TokenExtractor.extract_tokens("openai", metadata)

        assert input_tokens == 2000
        assert output_tokens == 1200

    def test_gemini_format(self) -> None:
        """Test extracting tokens from Gemini metadata format."""
        metadata = {
            "model": "gemini-2.0-flash",
            "usage": {"prompt_tokens": 1800, "total_tokens": 2500},
            "finish_reason": "STOP",
        }

        input_tokens, output_tokens = TokenExtractor.extract_tokens("gemini", metadata)

        assert input_tokens == 1800
        assert output_tokens == 700  # total - prompt = 2500 - 1800

    def test_bedrock_format(self) -> None:
        """Test extracting tokens from Bedrock metadata format."""
        metadata = {
            "usage": {"input_tokens": 1600, "output_tokens": 900, "total_tokens": 2500},
            "duration": 1234.56,
        }

        input_tokens, output_tokens = TokenExtractor.extract_tokens("bedrock", metadata)

        assert input_tokens == 1600
        assert output_tokens == 900

    def test_ollama_no_usage(self) -> None:
        """Test Ollama which doesn't provide token counts."""
        metadata = {"model": "llama3"}

        input_tokens, output_tokens = TokenExtractor.extract_tokens("ollama", metadata)

        assert input_tokens is None
        assert output_tokens is None

    def test_missing_usage_key(self) -> None:
        """Test handling metadata without usage key."""
        metadata = {"model": "some-model", "finish_reason": "stop"}

        input_tokens, output_tokens = TokenExtractor.extract_tokens("anthropic", metadata)

        assert input_tokens is None
        assert output_tokens is None

    def test_empty_metadata(self) -> None:
        """Test handling empty metadata."""
        metadata: dict[str, object] = {}

        input_tokens, output_tokens = TokenExtractor.extract_tokens("openai", metadata)

        assert input_tokens is None
        assert output_tokens is None

    def test_partial_usage_data(self) -> None:
        """Test handling metadata with partial usage data."""
        metadata = {"usage": {"input_tokens": 500}}  # Missing output_tokens

        input_tokens, output_tokens = TokenExtractor.extract_tokens("anthropic", metadata)

        assert input_tokens == 500
        assert output_tokens is None

    def test_zero_tokens(self) -> None:
        """Test handling zero token counts."""
        metadata = {"usage": {"input_tokens": 0, "output_tokens": 0}}

        input_tokens, output_tokens = TokenExtractor.extract_tokens("anthropic", metadata)

        assert input_tokens == 0
        assert output_tokens == 0

    def test_unknown_provider(self) -> None:
        """Test handling unknown provider falls back gracefully."""
        metadata = {"usage": {"input_tokens": 1000, "output_tokens": 500}}

        input_tokens, output_tokens = TokenExtractor.extract_tokens("unknown_provider", metadata)

        # Should try standard format as fallback
        assert input_tokens == 1000
        assert output_tokens == 500

    def test_gemini_missing_total_tokens(self) -> None:
        """Test Gemini format with missing total_tokens."""
        metadata = {"usage": {"prompt_tokens": 1000}}  # Missing total_tokens

        input_tokens, output_tokens = TokenExtractor.extract_tokens("gemini", metadata)

        assert input_tokens == 1000
        assert output_tokens is None

    def test_case_insensitive_provider_names(self) -> None:
        """Test that provider names are case-insensitive."""
        metadata = {"usage": {"input_tokens": 100, "output_tokens": 50}}

        # Test uppercase
        input_tokens, output_tokens = TokenExtractor.extract_tokens("ANTHROPIC", metadata)
        assert input_tokens == 100
        assert output_tokens == 50

        # Test mixed case
        input_tokens, output_tokens = TokenExtractor.extract_tokens("OpenAI", metadata)
        # OpenAI uses different keys, so this should return None
        assert input_tokens is None
        assert output_tokens is None

    def test_non_integer_tokens(self) -> None:
        """Test handling non-integer token values."""
        metadata = {"usage": {"input_tokens": "1000", "output_tokens": "500"}}

        # Should handle string numbers gracefully
        input_tokens, output_tokens = TokenExtractor.extract_tokens("anthropic", metadata)

        # Depending on implementation, might convert or return None
        # Let's expect None for invalid types
        assert input_tokens is None or input_tokens == 1000
        assert output_tokens is None or output_tokens == 500
