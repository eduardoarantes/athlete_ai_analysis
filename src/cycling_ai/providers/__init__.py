"""
Provider adapters for LLM models.

This module provides adapters for multiple LLM providers including OpenAI,
Anthropic, Google Gemini, and Ollama. All providers implement a common interface
defined in base.py.
"""
from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.factory import ProviderFactory

# Import provider implementations (will be registered automatically)
try:
    from cycling_ai.providers.anthropic_provider import AnthropicProvider
except ImportError:
    AnthropicProvider = None  # type: ignore[assignment,misc]

try:
    from cycling_ai.providers.gemini_provider import GeminiProvider
except ImportError:
    GeminiProvider = None  # type: ignore[assignment,misc]

try:
    from cycling_ai.providers.ollama_provider import OllamaProvider
except ImportError:
    OllamaProvider = None  # type: ignore[assignment,misc]

try:
    from cycling_ai.providers.openai_provider import OpenAIProvider
except ImportError:
    OpenAIProvider = None  # type: ignore[assignment,misc]

__all__ = [
    # Base classes
    "BaseProvider",
    "ProviderConfig",
    "ProviderMessage",
    "CompletionResponse",
    # Factory
    "ProviderFactory",
    # Provider implementations
    "OpenAIProvider",
    "AnthropicProvider",
    "GeminiProvider",
    "OllamaProvider",
]
