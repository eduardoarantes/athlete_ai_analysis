"""
Cost estimation for LLM API calls.

This module provides pricing information and cost estimation utilities for
different LLM providers and models.
"""

from __future__ import annotations

from typing import Any


class ModelPricing:
    """
    Model pricing data and cost estimation.

    Pricing is based on per-million token rates as of January 2025.
    """

    # Pricing table: provider -> model -> {input_per_1m, output_per_1m}
    # All prices are in USD per 1 million tokens
    PRICING_TABLE: dict[str, dict[str, dict[str, float]]] = {
        "anthropic": {
            "claude-sonnet-4-20250514": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00,
            },
            "claude-3-5-sonnet-20241022": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00,
            },
            "claude-3-5-sonnet-20240620": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00,
            },
            "claude-3-opus-20240229": {
                "input_per_1m": 15.00,
                "output_per_1m": 75.00,
            },
            "claude-3-haiku-20240307": {
                "input_per_1m": 0.25,
                "output_per_1m": 1.25,
            },
            "_default": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00,
            },
        },
        "openai": {
            "gpt-4o": {
                "input_per_1m": 2.50,
                "output_per_1m": 10.00,
            },
            "gpt-4o-mini": {
                "input_per_1m": 0.15,
                "output_per_1m": 0.60,
            },
            "gpt-4-turbo": {
                "input_per_1m": 10.00,
                "output_per_1m": 30.00,
            },
            "gpt-4": {
                "input_per_1m": 30.00,
                "output_per_1m": 60.00,
            },
            "gpt-3.5-turbo": {
                "input_per_1m": 0.50,
                "output_per_1m": 1.50,
            },
            "_default": {
                "input_per_1m": 2.50,
                "output_per_1m": 10.00,
            },
        },
        "gemini": {
            "gemini-2.0-flash": {
                "input_per_1m": 0.075,
                "output_per_1m": 0.30,
            },
            "gemini-1.5-pro": {
                "input_per_1m": 1.25,
                "output_per_1m": 5.00,
            },
            "gemini-1.5-flash": {
                "input_per_1m": 0.075,
                "output_per_1m": 0.30,
            },
            "_default": {
                "input_per_1m": 0.075,
                "output_per_1m": 0.30,
            },
        },
        "bedrock": {
            "anthropic.claude-3-5-sonnet-20241022-v2:0": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00,
            },
            "anthropic.claude-3-opus-20240229-v1:0": {
                "input_per_1m": 15.00,
                "output_per_1m": 75.00,
            },
            "anthropic.claude-3-haiku-20240307-v1:0": {
                "input_per_1m": 0.25,
                "output_per_1m": 1.25,
            },
            "_default": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00,
            },
        },
        "ollama": {
            "_default": {
                "input_per_1m": 0.0,
                "output_per_1m": 0.0,
            },
        },
    }

    @staticmethod
    def estimate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> float | None:
        """
        Calculate estimated cost in USD based on token usage.

        Args:
            provider: Provider name (case-insensitive)
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Estimated cost in USD, or None if pricing unavailable for provider
        """
        # Normalize provider name
        provider_key = provider.lower()

        # Get provider pricing table
        provider_pricing = ModelPricing.PRICING_TABLE.get(provider_key)
        if not provider_pricing:
            return None

        # Try to find exact model match
        model_pricing = provider_pricing.get(model)

        # If not found, try fuzzy matching for common model name patterns
        if not model_pricing:
            model_pricing = ModelPricing._find_model_pricing(provider_key, model)

        # If still not found, use provider default
        if not model_pricing:
            model_pricing = provider_pricing.get("_default")

        # If no default, return None
        if not model_pricing:
            return None

        # Calculate cost
        input_cost = (input_tokens / 1_000_000) * model_pricing["input_per_1m"]
        output_cost = (output_tokens / 1_000_000) * model_pricing["output_per_1m"]

        return input_cost + output_cost

    @staticmethod
    def _find_model_pricing(provider: str, model: str) -> dict[str, float] | None:
        """
        Try to find pricing for a model using fuzzy matching.

        This handles cases like different date suffixes on model names.

        Args:
            provider: Provider name (normalized to lowercase)
            model: Model name

        Returns:
            Pricing dict or None if no match found
        """
        provider_pricing = ModelPricing.PRICING_TABLE.get(provider, {})

        # Try matching without date suffix (e.g., 'claude-3-5-sonnet-20250101' -> 'claude-3-5-sonnet')
        model_base = model.rsplit("-", 1)[0] if "-" in model else model

        for known_model, pricing in provider_pricing.items():
            if known_model == "_default":
                continue

            # Check if known model starts with the base name
            if known_model.startswith(model_base):
                return pricing

        return None
