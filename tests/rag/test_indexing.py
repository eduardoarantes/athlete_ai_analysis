"""
Tests for RAG knowledge indexing module.

Tests cover:
- ChunkConfig dataclass
- KnowledgeIndexer initialization
- Frontmatter parsing
- Markdown chunking with overlap
- Domain knowledge indexing
- Training template indexing
- Integration with RAGManager
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from langchain_core.documents import Document

from cycling_ai.rag.embeddings import EmbeddingFactory
from cycling_ai.rag.indexing import ChunkConfig, KnowledgeIndexer
from cycling_ai.rag.manager import RAGManager
from cycling_ai.rag.vectorstore import ChromaVectorStore


@pytest.fixture
def temp_vectorstore_dir(tmp_path: Path) -> Path:
    """Create temporary vectorstore directory."""
    vectorstore_dir = tmp_path / "vectorstore"
    vectorstore_dir.mkdir()
    return vectorstore_dir


@pytest.fixture
def rag_manager(temp_vectorstore_dir: Path) -> RAGManager:
    """Create RAGManager with temporary vectorstore."""
    return RAGManager(
        project_vectorstore_path=temp_vectorstore_dir,
        embedding_provider="local",
    )


@pytest.fixture
def indexer(rag_manager: RAGManager) -> KnowledgeIndexer:
    """Create KnowledgeIndexer with default config."""
    return KnowledgeIndexer(rag_manager=rag_manager)


@pytest.fixture
def custom_indexer(rag_manager: RAGManager) -> KnowledgeIndexer:
    """Create KnowledgeIndexer with custom config."""
    config = ChunkConfig(chunk_size=256, chunk_overlap=25, separator="\n")
    return KnowledgeIndexer(rag_manager=rag_manager, chunk_config=config)


@pytest.fixture
def sample_markdown() -> str:
    """Sample markdown with frontmatter."""
    return """---
category: testing
difficulty: beginner
source: sports_science
last_updated: 2025-11-07
---

# Test Document

## Overview

This is a test document with multiple paragraphs.

Each paragraph is separated by double newlines.

## Section 2

This section has more content to test chunking.

The chunking algorithm should split this appropriately.

## Conclusion

Final paragraph to complete the document.
"""


@pytest.fixture
def sample_markdown_no_frontmatter() -> str:
    """Sample markdown without frontmatter."""
    return """# Test Document

This is a test without frontmatter.

It should still be processed correctly.
"""


@pytest.fixture
def temp_knowledge_dir(tmp_path: Path) -> Path:
    """Create temporary knowledge directory with sample files."""
    knowledge_dir = tmp_path / "knowledge" / "domain"
    training_dir = knowledge_dir / "training_methodologies"
    testing_dir = knowledge_dir / "testing_protocols"

    training_dir.mkdir(parents=True)
    testing_dir.mkdir(parents=True)

    # Create sample markdown files
    training_file = training_dir / "polarized_training.md"
    training_file.write_text(
        """---
category: training_methodology
difficulty: intermediate
---

# Polarized Training

## Overview
Polarized training combines low and high intensity.

## Implementation
Follow the 80/20 rule for best results.
"""
    )

    testing_file = testing_dir / "ftp_testing.md"
    testing_file.write_text(
        """---
category: testing
difficulty: beginner
---

# FTP Testing

## Protocol
20-minute test protocol is most common.

## Analysis
Calculate FTP as 95% of 20-min average power.
"""
    )

    return knowledge_dir


@pytest.fixture
def temp_templates_file(tmp_path: Path) -> Path:
    """Create temporary training templates file."""
    templates_dir = tmp_path / "templates"
    templates_dir.mkdir()

    templates_file = templates_dir / "training_plans.json"
    templates_data = {
        "templates": [
            {
                "id": "12_week_base",
                "name": "12-Week Base Building",
                "description": "Aerobic foundation for 200-300W athletes",
                "goal": "base_building",
                "duration_weeks": 12,
                "ftp_range": [200, 300],
                "weekly_hours_range": [6, 10],
                "experience_level": "intermediate",
                "structure": {
                    "phase_1": {
                        "weeks": [1, 2, 3, 4],
                        "focus": "Aerobic Foundation",
                        "key_workouts": ["3hr endurance", "tempo intervals"],
                    }
                },
                "notes": "Suitable for time-crunched athletes",
            },
            {
                "id": "8_week_vo2max",
                "name": "8-Week VO2max Builder",
                "description": "High-intensity focus for experienced riders",
                "goal": "vo2max_improvement",
                "duration_weeks": 8,
                "ftp_range": [250, 350],
                "weekly_hours_range": [8, 12],
                "experience_level": "advanced",
                "structure": {
                    "phase_1": {
                        "weeks": [1, 2, 3, 4],
                        "focus": "VO2max Development",
                        "key_workouts": ["5x5min VO2max", "2x20 threshold"],
                    }
                },
                "notes": "Requires solid aerobic base",
            },
        ]
    }

    templates_file.write_text(json.dumps(templates_data, indent=2))
    return templates_file


class TestChunkConfig:
    """Tests for ChunkConfig dataclass."""

    def test_default_values(self) -> None:
        """Test ChunkConfig default values."""
        config = ChunkConfig()

        assert config.chunk_size == 512
        assert config.chunk_overlap == 50
        assert config.separator == "\n\n"

    def test_custom_values(self) -> None:
        """Test ChunkConfig with custom values."""
        config = ChunkConfig(chunk_size=256, chunk_overlap=25, separator="\n")

        assert config.chunk_size == 256
        assert config.chunk_overlap == 25
        assert config.separator == "\n"


class TestKnowledgeIndexerInit:
    """Tests for KnowledgeIndexer initialization."""

    def test_init_with_default_config(self, rag_manager: RAGManager) -> None:
        """Test initialization with default config."""
        indexer = KnowledgeIndexer(rag_manager=rag_manager)

        assert indexer.rag_manager is rag_manager
        assert indexer.chunk_config.chunk_size == 512
        assert indexer.chunk_config.chunk_overlap == 50

    def test_init_with_custom_config(self, rag_manager: RAGManager) -> None:
        """Test initialization with custom config."""
        config = ChunkConfig(chunk_size=256, chunk_overlap=25)
        indexer = KnowledgeIndexer(rag_manager=rag_manager, chunk_config=config)

        assert indexer.rag_manager is rag_manager
        assert indexer.chunk_config.chunk_size == 256
        assert indexer.chunk_config.chunk_overlap == 25


class TestParseFrontmatter:
    """Tests for YAML frontmatter parsing."""

    def test_parse_with_frontmatter(
        self, indexer: KnowledgeIndexer, sample_markdown: str
    ) -> None:
        """Test parsing markdown with frontmatter."""
        metadata, body = indexer._parse_frontmatter(sample_markdown)

        # Check metadata extracted correctly
        assert metadata["category"] == "testing"
        assert metadata["difficulty"] == "beginner"
        assert metadata["source"] == "sports_science"
        # YAML may parse date as date object or string
        assert str(metadata["last_updated"]) == "2025-11-07"

        # Check body doesn't include frontmatter
        assert "---" not in body
        assert body.startswith("# Test Document")

    def test_parse_without_frontmatter(
        self, indexer: KnowledgeIndexer, sample_markdown_no_frontmatter: str
    ) -> None:
        """Test parsing markdown without frontmatter."""
        metadata, body = indexer._parse_frontmatter(sample_markdown_no_frontmatter)

        # Should return empty metadata
        assert metadata == {}

        # Body should be unchanged
        assert body == sample_markdown_no_frontmatter

    def test_parse_malformed_frontmatter(self, indexer: KnowledgeIndexer) -> None:
        """Test parsing markdown with malformed YAML."""
        content = """---
invalid: yaml: content::
---

# Title
"""
        metadata, body = indexer._parse_frontmatter(content)

        # Should return empty metadata on parse error
        assert metadata == {}
        assert "# Title" in body


class TestEstimateTokens:
    """Tests for token estimation."""

    def test_short_text(self, indexer: KnowledgeIndexer) -> None:
        """Test token estimation for short text."""
        text = "This is a test"
        tokens = indexer._estimate_tokens(text)

        # Rule of thumb: 1 token ≈ 4 characters
        expected = len(text) // 4
        assert tokens == expected

    def test_long_text(self, indexer: KnowledgeIndexer) -> None:
        """Test token estimation for longer text."""
        text = "This is a longer test " * 100  # ~2200 characters
        tokens = indexer._estimate_tokens(text)

        assert tokens > 500  # Should estimate > 500 tokens

    def test_empty_text(self, indexer: KnowledgeIndexer) -> None:
        """Test token estimation for empty text."""
        tokens = indexer._estimate_tokens("")
        assert tokens == 0


class TestChunkMarkdown:
    """Tests for markdown chunking."""

    def test_small_document_single_chunk(self, indexer: KnowledgeIndexer) -> None:
        """Test that small documents create single chunk."""
        content = "# Title\n\nShort paragraph.\n\nAnother short paragraph."
        metadata = {"category": "test"}

        chunks = indexer._chunk_markdown(content, metadata)

        # Small content should be single chunk
        assert len(chunks) == 1
        assert chunks[0].page_content == content
        assert chunks[0].metadata["category"] == "test"
        assert chunks[0].metadata["chunk_index"] == 0

    def test_large_document_multiple_chunks(self, indexer: KnowledgeIndexer) -> None:
        """Test that large documents split into multiple chunks."""
        # Create content that will exceed chunk_size (512 tokens ~2048 chars)
        long_paragraph = "This is a long paragraph. " * 100  # ~2600 characters
        content = f"# Title\n\n{long_paragraph}\n\n{long_paragraph}"
        metadata = {"category": "test"}

        chunks = indexer._chunk_markdown(content, metadata)

        # Should create multiple chunks
        assert len(chunks) > 1

        # Each chunk should have metadata
        for i, chunk in enumerate(chunks):
            assert chunk.metadata["category"] == "test"
            assert chunk.metadata["chunk_index"] == i
            assert "chunk_tokens" in chunk.metadata

    def test_chunk_overlap(self, custom_indexer: KnowledgeIndexer) -> None:
        """Test that chunks have overlap."""
        # Create content with distinct paragraphs
        para1 = "Paragraph one with unique content alpha."
        para2 = "Paragraph two with unique content beta."
        para3 = "Paragraph three with unique content gamma."
        content = f"{para1}\n\n{para2}\n\n{para3}"

        # Force multiple chunks with small chunk size
        custom_indexer.chunk_config.chunk_size = 50  # Small for testing
        metadata = {"category": "test"}

        chunks = custom_indexer._chunk_markdown(content, metadata)

        if len(chunks) > 1:
            # Second chunk should contain overlap from first
            # (exact overlap depends on content length)
            assert len(chunks[1].page_content) > len(para3)

    def test_preserve_metadata_in_chunks(self, indexer: KnowledgeIndexer) -> None:
        """Test that all chunks preserve base metadata."""
        content = "# Title\n\n" + ("Long paragraph. " * 200)
        metadata = {"category": "training", "difficulty": "advanced", "source": "test"}

        chunks = indexer._chunk_markdown(content, metadata)

        for chunk in chunks:
            assert chunk.metadata["category"] == "training"
            assert chunk.metadata["difficulty"] == "advanced"
            assert chunk.metadata["source"] == "test"


class TestIndexDomainKnowledge:
    """Tests for domain knowledge indexing."""

    def test_index_success(
        self, indexer: KnowledgeIndexer, temp_knowledge_dir: Path
    ) -> None:
        """Test successful indexing of domain knowledge."""
        stats = indexer.index_domain_knowledge(temp_knowledge_dir)

        # Should have indexed both categories
        assert "training_methodologies" in stats
        assert "testing_protocols" in stats

        # Each file should have created at least one chunk
        assert stats["training_methodologies"] >= 1
        assert stats["testing_protocols"] >= 1

    def test_index_nonexistent_directory(self, indexer: KnowledgeIndexer) -> None:
        """Test indexing with nonexistent directory."""
        with pytest.raises(FileNotFoundError, match="Knowledge directory not found"):
            indexer.index_domain_knowledge(Path("/nonexistent/path"))

    def test_index_empty_directory(
        self, indexer: KnowledgeIndexer, tmp_path: Path
    ) -> None:
        """Test indexing with directory containing no markdown files."""
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        with pytest.raises(ValueError, match="No markdown files found"):
            indexer.index_domain_knowledge(empty_dir)

    def test_retrieve_indexed_content(
        self, indexer: KnowledgeIndexer, temp_knowledge_dir: Path
    ) -> None:
        """Test that indexed content can be retrieved."""
        # Index the content
        stats = indexer.index_domain_knowledge(temp_knowledge_dir)
        assert sum(stats.values()) > 0

        # Retrieve content
        result = indexer.rag_manager.retrieve(
            query="polarized training",
            collection="domain_knowledge",
            top_k=3,
        )

        # Should find relevant documents
        assert len(result.documents) > 0
        assert any("polarized" in doc.lower() for doc in result.documents)


class TestIndexTrainingTemplates:
    """Tests for training template indexing."""

    def test_index_success(
        self, indexer: KnowledgeIndexer, temp_templates_file: Path
    ) -> None:
        """Test successful indexing of training templates."""
        count = indexer.index_training_templates(temp_templates_file)

        # Should have indexed both templates
        assert count == 2

    def test_index_nonexistent_file(self, indexer: KnowledgeIndexer) -> None:
        """Test indexing with nonexistent file."""
        with pytest.raises(FileNotFoundError, match="Templates file not found"):
            indexer.index_training_templates(Path("/nonexistent/templates.json"))

    def test_index_invalid_json(
        self, indexer: KnowledgeIndexer, tmp_path: Path
    ) -> None:
        """Test indexing with invalid JSON."""
        invalid_file = tmp_path / "invalid.json"
        invalid_file.write_text("{ invalid json }")

        with pytest.raises(json.JSONDecodeError):
            indexer.index_training_templates(invalid_file)

    def test_index_missing_templates_key(
        self, indexer: KnowledgeIndexer, tmp_path: Path
    ) -> None:
        """Test indexing with JSON missing 'templates' key."""
        invalid_file = tmp_path / "missing_key.json"
        invalid_file.write_text(json.dumps({"plans": []}))

        with pytest.raises(ValueError, match="missing 'templates' key"):
            indexer.index_training_templates(invalid_file)

    def test_retrieve_indexed_templates(
        self, indexer: KnowledgeIndexer, temp_templates_file: Path
    ) -> None:
        """Test that indexed templates can be retrieved."""
        # Index templates
        count = indexer.index_training_templates(temp_templates_file)
        assert count == 2

        # Retrieve templates
        result = indexer.rag_manager.retrieve(
            query="base building training plan",
            collection="training_templates",
            top_k=2,
        )

        # Should find relevant templates
        assert len(result.documents) > 0
        assert any("base" in doc.lower() for doc in result.documents)

    def test_template_metadata(
        self, indexer: KnowledgeIndexer, temp_templates_file: Path
    ) -> None:
        """Test that template metadata is preserved."""
        # Index templates
        indexer.index_training_templates(temp_templates_file)

        # Retrieve templates
        result = indexer.rag_manager.retrieve(
            query="vo2max improvement",
            collection="training_templates",
            top_k=2,
        )

        # Check metadata is present
        assert len(result.metadata) > 0
        found_vo2max = False
        for meta in result.metadata:
            if "template_id" in meta and meta["template_id"] == "8_week_vo2max":
                found_vo2max = True
                assert meta["template_name"] == "8-Week VO2max Builder"
                assert meta["goal"] == "vo2max_improvement"
                assert meta["experience_level"] == "advanced"

        assert found_vo2max, "Should find VO2max template in results"


class TestTemplateToText:
    """Tests for template to text conversion."""

    def test_basic_template(self, indexer: KnowledgeIndexer) -> None:
        """Test conversion of basic template."""
        template = {
            "name": "Test Plan",
            "description": "Test description",
            "goal": "testing",
            "duration_weeks": 8,
            "experience_level": "beginner",
        }

        text = indexer._template_to_text(template)

        assert "Test Plan" in text
        assert "Test description" in text
        assert "testing" in text
        assert "8 weeks" in text
        assert "beginner" in text

    def test_template_with_ranges(self, indexer: KnowledgeIndexer) -> None:
        """Test conversion of template with FTP and hours ranges."""
        template = {
            "name": "Test Plan",
            "ftp_range": [200, 300],
            "weekly_hours_range": [6, 10],
        }

        text = indexer._template_to_text(template)

        assert "200-300W" in text
        assert "6-10 hours" in text

    def test_template_with_structure(self, indexer: KnowledgeIndexer) -> None:
        """Test conversion of template with phase structure."""
        template = {
            "name": "Test Plan",
            "structure": {
                "phase_1": {
                    "focus": "Base Building",
                    "key_workouts": ["Long ride", "Tempo"],
                }
            },
        }

        text = indexer._template_to_text(template)

        assert "Phase 1" in text
        assert "Base Building" in text
        assert "Long ride" in text
        assert "Tempo" in text


class TestIntegration:
    """Integration tests for full indexing workflow."""

    def test_full_workflow(
        self,
        indexer: KnowledgeIndexer,
        temp_knowledge_dir: Path,
        temp_templates_file: Path,
    ) -> None:
        """Test complete indexing and retrieval workflow."""
        # Index domain knowledge
        domain_stats = indexer.index_domain_knowledge(temp_knowledge_dir)
        assert sum(domain_stats.values()) > 0

        # Index templates
        template_count = indexer.index_training_templates(temp_templates_file)
        assert template_count == 2

        # Retrieve from domain knowledge
        domain_result = indexer.rag_manager.retrieve(
            query="training methodology polarized",
            collection="domain_knowledge",
            top_k=3,
        )
        assert len(domain_result.documents) > 0

        # Retrieve from templates
        template_result = indexer.rag_manager.retrieve(
            query="base building plan",
            collection="training_templates",
            top_k=2,
        )
        assert len(template_result.documents) > 0

        # Results should be from correct collections
        assert domain_result.collection == "domain_knowledge"
        assert template_result.collection == "training_templates"
