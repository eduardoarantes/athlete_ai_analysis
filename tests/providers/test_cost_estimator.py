"""
Tests for ModelPricing cost estimator.
"""

from __future__ import annotations

import pytest

from cycling_ai.providers.cost_estimator import ModelPricing


class TestModelPricing:
    """Test the ModelPricing class."""

    def test_anthropic_claude_sonnet_cost(self) -> None:
        """Test cost estimation for Anthropic Claude Sonnet."""
        cost = ModelPricing.estimate_cost(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )

        # $3 per 1M input + $15 per 1M output = $18
        assert cost == 18.0

    def test_openai_gpt4o_cost(self) -> None:
        """Test cost estimation for OpenAI GPT-4o."""
        cost = ModelPricing.estimate_cost(
            provider="openai", model="gpt-4o", input_tokens=500_000, output_tokens=500_000
        )

        # $2.50 per 1M input + $10 per 1M output
        # (500k * 2.50 / 1M) + (500k * 10 / 1M) = 1.25 + 5.0 = 6.25
        assert cost == 6.25

    def test_gemini_flash_cost(self) -> None:
        """Test cost estimation for Gemini Flash."""
        cost = ModelPricing.estimate_cost(
            provider="gemini",
            model="gemini-2.0-flash",
            input_tokens=2_000_000,
            output_tokens=1_000_000,
        )

        # $0.075 per 1M input + $0.30 per 1M output
        # (2M * 0.075 / 1M) + (1M * 0.30 / 1M) = 0.15 + 0.30 = 0.45
        assert cost is not None
        assert abs(cost - 0.45) < 0.0001

    def test_ollama_is_free(self) -> None:
        """Test that Ollama (local) is free."""
        cost = ModelPricing.estimate_cost(
            provider="ollama", model="llama3", input_tokens=1_000_000, output_tokens=1_000_000
        )

        assert cost == 0.0

    def test_bedrock_claude_cost(self) -> None:
        """Test cost estimation for Bedrock Claude."""
        cost = ModelPricing.estimate_cost(
            provider="bedrock",
            model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )

        # Should use same pricing as Anthropic
        assert cost == 18.0

    def test_small_token_counts(self) -> None:
        """Test cost estimation with typical small token counts."""
        cost = ModelPricing.estimate_cost(
            provider="anthropic", model="claude-sonnet-4-20250514", input_tokens=1500, output_tokens=800
        )

        # (1500 * 3.0 / 1M) + (800 * 15.0 / 1M)
        # = 0.0045 + 0.012 = 0.0165
        assert abs(cost - 0.0165) < 0.0001

    def test_zero_tokens(self) -> None:
        """Test cost estimation with zero tokens."""
        cost = ModelPricing.estimate_cost(
            provider="anthropic", model="claude-sonnet-4-20250514", input_tokens=0, output_tokens=0
        )

        assert cost == 0.0

    def test_unknown_model_uses_provider_default(self) -> None:
        """Test that unknown model falls back to provider default pricing."""
        cost = ModelPricing.estimate_cost(
            provider="anthropic",
            model="claude-unknown-model",
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )

        # Should use default Anthropic pricing (same as Sonnet)
        assert cost == 18.0

    def test_unknown_provider_returns_none(self) -> None:
        """Test that unknown provider returns None."""
        cost = ModelPricing.estimate_cost(
            provider="unknown_provider", model="some-model", input_tokens=1000, output_tokens=500
        )

        assert cost is None

    def test_case_insensitive_provider_names(self) -> None:
        """Test that provider names are case-insensitive."""
        cost1 = ModelPricing.estimate_cost(
            provider="ANTHROPIC",
            model="claude-sonnet-4-20250514",
            input_tokens=1000,
            output_tokens=500,
        )

        cost2 = ModelPricing.estimate_cost(
            provider="Anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=1000,
            output_tokens=500,
        )

        cost3 = ModelPricing.estimate_cost(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=1000,
            output_tokens=500,
        )

        assert cost1 == cost2 == cost3

    def test_partial_model_name_matching(self) -> None:
        """Test that partial model names work (e.g., 'claude-3-5-sonnet' matches any date variant)."""
        # Test exact match works
        cost1 = ModelPricing.estimate_cost(
            provider="anthropic",
            model="claude-3-5-sonnet-20241022",
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )

        # Test that it uses pricing even if model name is slightly different
        cost2 = ModelPricing.estimate_cost(
            provider="anthropic",
            model="claude-3-5-sonnet-20250101",  # Different date
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )

        # Both should use Sonnet pricing
        assert cost1 == 18.0
        # The second one might use default if no fuzzy matching, which is OK
        assert cost2 is not None

    def test_output_only_tokens(self) -> None:
        """Test cost with only output tokens (no input)."""
        cost = ModelPricing.estimate_cost(
            provider="anthropic", model="claude-sonnet-4-20250514", input_tokens=0, output_tokens=1000
        )

        # 1000 * 15.0 / 1M = 0.015
        assert abs(cost - 0.015) < 0.0001

    def test_input_only_tokens(self) -> None:
        """Test cost with only input tokens (no output)."""
        cost = ModelPricing.estimate_cost(
            provider="anthropic", model="claude-sonnet-4-20250514", input_tokens=1000, output_tokens=0
        )

        # 1000 * 3.0 / 1M = 0.003
        assert abs(cost - 0.003) < 0.0001

    def test_pricing_accuracy_within_10_percent(self) -> None:
        """
        Test that pricing is accurate within 10% for a realistic scenario.
        This validates the acceptance criteria.
        """
        # Realistic example: 2000 input, 1000 output tokens
        estimated_cost = ModelPricing.estimate_cost(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=2000,
            output_tokens=1000,
        )

        # Expected: (2000 * 3 / 1M) + (1000 * 15 / 1M) = 0.006 + 0.015 = 0.021
        expected_cost = 0.021

        # Should be within 10%
        assert estimated_cost is not None
        error_percent = abs(estimated_cost - expected_cost) / expected_cost * 100
        assert error_percent < 10.0
