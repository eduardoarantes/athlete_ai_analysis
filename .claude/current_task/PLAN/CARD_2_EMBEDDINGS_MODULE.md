# CARD 2: Embeddings Module

**Status:** Pending
**Estimated Time:** 1.5 hours
**Dependencies:** Card 1 (Project Setup)

---

## Objective

Implement the embedding provider factory using LangChain's existing implementations.

**Key Principle:** Use LangChain's `HuggingFaceEmbeddings` and `OpenAIEmbeddings` directly. We only write a thin factory pattern.

---

## Implementation

### File: `src/cycling_ai/rag/embeddings.py`

```python
"""
Embedding provider factory using LangChain.

This module provides a factory for creating LangChain embedding providers.
Uses HuggingFaceEmbeddings for local embeddings and OpenAIEmbeddings for cloud.

Examples:
    >>> from cycling_ai.rag.embeddings import EmbeddingFactory
    >>>
    >>> # Create local embedding provider
    >>> local_embeddings = EmbeddingFactory.create_local()
    >>>
    >>> # Create OpenAI embedding provider
    >>> openai_embeddings = EmbeddingFactory.create_openai(api_key="sk-...")
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.embeddings import Embeddings


class EmbeddingFactory:
    """
    Factory for creating LangChain embedding providers.

    Supports:
    - Local embeddings via HuggingFace sentence-transformers
    - Cloud embeddings via OpenAI API
    """

    @staticmethod
    def create_local(
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
    ) -> Embeddings:
        """
        Create local HuggingFace embedding provider.

        Uses LangChain's HuggingFaceEmbeddings with sentence-transformers.
        Model is downloaded on first use (~90MB for all-MiniLM-L6-v2).

        Args:
            model_name: HuggingFace model identifier
                Default: all-MiniLM-L6-v2 (384 dimensions, fast, good quality)

        Returns:
            LangChain Embeddings instance

        Raises:
            ImportError: If sentence-transformers not installed

        Examples:
            >>> embeddings = EmbeddingFactory.create_local()
            >>> vector = embeddings.embed_query("Hello world")
            >>> len(vector)
            384
        """
        from langchain_community.embeddings import HuggingFaceEmbeddings

        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": "cpu"},  # CPU-only for portability
            encode_kwargs={"normalize_embeddings": True},  # L2 normalization
        )

    @staticmethod
    def create_openai(
        api_key: str | None = None,
        model: str = "text-embedding-3-small",
    ) -> Embeddings:
        """
        Create OpenAI embedding provider.

        Uses LangChain's OpenAIEmbeddings.

        Args:
            api_key: OpenAI API key. If None, reads from OPENAI_API_KEY env var
            model: OpenAI embedding model
                Default: text-embedding-3-small (1536 dimensions)
                Other options: text-embedding-3-large (3072 dimensions, slower)

        Returns:
            LangChain Embeddings instance

        Raises:
            ValueError: If api_key not provided and OPENAI_API_KEY not set
            ImportError: If openai package not installed

        Examples:
            >>> embeddings = EmbeddingFactory.create_openai()
            >>> vector = embeddings.embed_query("Hello world")
            >>> len(vector)
            1536
        """
        from langchain_openai import OpenAIEmbeddings

        # Validate API key
        effective_api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not effective_api_key:
            raise ValueError(
                "OpenAI API key required. "
                "Provide api_key parameter or set OPENAI_API_KEY environment variable."
            )

        return OpenAIEmbeddings(
            api_key=effective_api_key,  # type: ignore[arg-type]
            model=model,
        )
```

---

## Tests

### File: `tests/rag/test_embeddings.py`

```python
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

            # Verify factory called LangChain constructor
            mock_class.assert_called_once_with(
                api_key="sk-test-key",
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
                    api_key="sk-env-key",
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
                api_key="sk-test",
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
```

---

## Type Checking

Run mypy to verify type safety:

```bash
mypy src/cycling_ai/rag/embeddings.py --strict
```

Expected output: **No errors**

---

## Acceptance Criteria

- [ ] `embeddings.py` implemented with `EmbeddingFactory` class
- [ ] `create_local()` method uses `HuggingFaceEmbeddings`
- [ ] `create_openai()` method uses `OpenAIEmbeddings`
- [ ] All tests in `test_embeddings.py` pass
- [ ] Test coverage ≥95% for `embeddings.py`
- [ ] `mypy --strict` passes with zero errors
- [ ] Docstrings complete with examples
- [ ] Type hints on all functions

---

## Validation Commands

```bash
# Run tests
pytest tests/rag/test_embeddings.py -v

# Check coverage
pytest tests/rag/test_embeddings.py --cov=src/cycling_ai/rag/embeddings --cov-report=term-missing

# Type check
mypy src/cycling_ai/rag/embeddings.py --strict

# Verify imports work
python -c "from cycling_ai.rag.embeddings import EmbeddingFactory; print('OK')"
```

---

## Notes

### Model Download

On first run of `create_local()`, sentence-transformers will download the model:
- **all-MiniLM-L6-v2**: ~90MB
- Cached in `~/.cache/torch/sentence_transformers/`
- Subsequent runs use cached model (fast)

### Embedding Dimensions

- **Local (all-MiniLM-L6-v2):** 384 dimensions
- **OpenAI (text-embedding-3-small):** 1536 dimensions
- **OpenAI (text-embedding-3-large):** 3072 dimensions

### Performance

- **Local:** ~50-100 queries/sec on CPU (varies by hardware)
- **OpenAI:** ~500 queries/sec (rate limited by API)

---

## Time Estimate Breakdown

- Write `embeddings.py`: 20 min
- Write `test_embeddings.py`: 40 min
- Run tests (first run downloads model): 15 min
- Fix type errors: 10 min
- Documentation: 5 min

**Total: ~1.5 hours**
