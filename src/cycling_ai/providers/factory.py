"""
Provider factory for creating LLM provider instances.

Provides a centralized registry and factory pattern for instantiating
provider adapters from configuration.
"""
from __future__ import annotations

from cycling_ai.providers.base import BaseProvider, ProviderConfig


class ProviderFactory:
    """
    Factory for creating and managing provider instances.

    Provides a registry-based system for registering provider classes
    and creating instances from configuration.

    Example:
        >>> ProviderFactory.register_provider("openai", OpenAIProvider)
        >>> config = ProviderConfig(provider_name="openai", ...)
        >>> provider = ProviderFactory.create_provider(config)
    """

    _providers: dict[str, type[BaseProvider]] = {}

    @classmethod
    def register_provider(cls, name: str, provider_class: type[BaseProvider]) -> None:
        """
        Register a provider class with the factory.

        Args:
            name: Provider name (e.g., "openai", "anthropic")
            provider_class: Provider class that extends BaseProvider

        Example:
            >>> ProviderFactory.register_provider("openai", OpenAIProvider)
        """
        cls._providers[name.lower()] = provider_class

    @classmethod
    def create_provider(cls, config: ProviderConfig) -> BaseProvider:
        """
        Create a provider instance from configuration.

        Args:
            config: Provider configuration including name, API key, model, etc.

        Returns:
            Initialized provider instance

        Raises:
            ValueError: If provider name is unknown

        Example:
            >>> config = ProviderConfig(
            ...     provider_name="openai",
            ...     api_key="sk-...",
            ...     model="gpt-4"
            ... )
            >>> provider = ProviderFactory.create_provider(config)
        """
        provider_name = config.provider_name.lower()

        if provider_name not in cls._providers:
            available = ", ".join(sorted(cls._providers.keys()))
            raise ValueError(
                f"Unknown provider '{config.provider_name}'. "
                f"Available providers: {available}"
            )

        provider_class = cls._providers[provider_name]
        return provider_class(config)

    @classmethod
    def list_providers(cls) -> list[str]:
        """
        List all registered providers.

        Returns:
            Sorted list of provider names

        Example:
            >>> ProviderFactory.list_providers()
            ['anthropic', 'gemini', 'ollama', 'openai']
        """
        return sorted(cls._providers.keys())


# Auto-register all providers on import
try:
    from cycling_ai.providers.openai_provider import OpenAIProvider

    ProviderFactory.register_provider("openai", OpenAIProvider)
except ImportError:
    pass

try:
    from cycling_ai.providers.anthropic_provider import AnthropicProvider

    ProviderFactory.register_provider("anthropic", AnthropicProvider)
except ImportError:
    pass

try:
    from cycling_ai.providers.gemini_provider import GeminiProvider

    ProviderFactory.register_provider("gemini", GeminiProvider)
except ImportError:
    pass

try:
    from cycling_ai.providers.ollama_provider import OllamaProvider

    ProviderFactory.register_provider("ollama", OllamaProvider)
except ImportError:
    pass

try:
    from cycling_ai.providers.bedrock_provider import BedrockProvider

    ProviderFactory.register_provider("bedrock", BedrockProvider)
except ImportError:
    pass
