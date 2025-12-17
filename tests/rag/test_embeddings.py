"""
Tests for embedding provider factory.

Tests cover:
- Local embedding creation
- OpenAI embedding creation
- Error handling
- Type safety
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from langchain_core.embeddings import Embeddings
from pydantic import SecretStr

from cycling_ai.rag.embeddings import EmbeddingFactory


class TestEmbeddingFactoryLocal:
    """Test local embedding provider creation."""

    def test_create_local_default_model(self) -> None:
        """Test creating local embeddings with default model."""
        embeddings = EmbeddingFactory.create_local()

        # Verify it's a LangChain Embeddings instance
        assert isinstance(embeddings, Embeddings)

        # Verify embed_query works (this will download model on first run)
        vector = embeddings.embed_query("test query")
        assert isinstance(vector, list)
        assert len(vector) == 384  # all-MiniLM-L6-v2 dimension
        assert all(isinstance(x, float) for x in vector)

    def test_create_local_custom_model(self) -> None:
        """Test creating local embeddings with custom model."""
        # Use same model for test speed (already downloaded)
        custom_model = "sentence-transformers/all-MiniLM-L6-v2"
        embeddings = EmbeddingFactory.create_local(model_name=custom_model)

        assert isinstance(embeddings, Embeddings)
        vector = embeddings.embed_query("test")
        assert len(vector) == 384

    def test_create_local_embed_documents(self) -> None:
        """Test embedding multiple documents."""
        embeddings = EmbeddingFactory.create_local()
        texts = ["document one", "document two", "document three"]

        vectors = embeddings.embed_documents(texts)

        assert len(vectors) == 3
        assert all(len(v) == 384 for v in vectors)
        assert all(isinstance(v, list) for v in vectors)

    def test_local_embeddings_are_normalized(self) -> None:
        """Test that embeddings are L2 normalized."""
        embeddings = EmbeddingFactory.create_local()
        vector = embeddings.embed_query("test")

        # Calculate L2 norm
        import math
        norm = math.sqrt(sum(x**2 for x in vector))

        # Should be approximately 1.0 (normalized)
        assert abs(norm - 1.0) < 0.01


class TestEmbeddingFactoryOpenAI:
    """Test OpenAI embedding provider creation."""

    def test_create_openai_with_api_key(self) -> None:
        """Test creating OpenAI embeddings with explicit API key."""
        # Mock to avoid actual API call
        with patch("langchain_openai.OpenAIEmbeddings") as mock_class:
            mock_instance = mock_class.return_value

            embeddings = EmbeddingFactory.create_openai(api_key="sk-test-key")

            # Verify factory called LangChain constructor with SecretStr
            mock_class.assert_called_once_with(
                api_key=SecretStr("sk-test-key"),
                model="text-embedding-3-small"
            )
            assert embeddings == mock_instance

    def test_create_openai_with_env_var(self) -> None:
        """Test creating OpenAI embeddings with env var."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-env-key"}):
            with patch("langchain_openai.OpenAIEmbeddings") as mock_class:
                mock_instance = mock_class.return_value

                embeddings = EmbeddingFactory.create_openai()

                mock_class.assert_called_once_with(
                    api_key=SecretStr("sk-env-key"),
                    model="text-embedding-3-small"
                )
                assert embeddings == mock_instance

    def test_create_openai_custom_model(self) -> None:
        """Test creating OpenAI embeddings with custom model."""
        with patch("langchain_openai.OpenAIEmbeddings") as mock_class:
            mock_instance = mock_class.return_value

            embeddings = EmbeddingFactory.create_openai(
                api_key="sk-test",
                model="text-embedding-3-large"
            )

            mock_class.assert_called_once_with(
                api_key=SecretStr("sk-test"),
                model="text-embedding-3-large"
            )
            assert embeddings == mock_instance

    def test_create_openai_no_api_key_raises(self) -> None:
        """Test that missing API key raises ValueError."""
        # Clear env var
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError) as exc_info:
                EmbeddingFactory.create_openai()

            assert "OpenAI API key required" in str(exc_info.value)
            assert "OPENAI_API_KEY" in str(exc_info.value)


class TestEmbeddingFactoryTypesSafety:
    """Test type safety of factory methods."""

    def test_local_returns_embeddings_protocol(self) -> None:
        """Test that create_local returns Embeddings protocol."""
        embeddings = EmbeddingFactory.create_local()

        # Verify protocol methods exist
        assert hasattr(embeddings, "embed_query")
        assert hasattr(embeddings, "embed_documents")
        assert callable(embeddings.embed_query)
        assert callable(embeddings.embed_documents)

    def test_openai_returns_embeddings_protocol(self) -> None:
        """Test that create_openai returns Embeddings protocol."""
        with patch("langchain_openai.OpenAIEmbeddings") as mock_class:
            mock_instance = mock_class.return_value
            mock_instance.embed_query = lambda x: [0.1] * 1536
            mock_instance.embed_documents = lambda x: [[0.1] * 1536] * len(x)

            embeddings = EmbeddingFactory.create_openai(api_key="sk-test")

            assert hasattr(embeddings, "embed_query")
            assert hasattr(embeddings, "embed_documents")
