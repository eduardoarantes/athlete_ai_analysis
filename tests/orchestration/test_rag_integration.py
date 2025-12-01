"""
Tests for RAG integration with orchestration layer.

Tests PromptAugmenter and RAG configuration.
"""

from __future__ import annotations

import pytest
from pathlib import Path

from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig, PhaseContext
from cycling_ai.orchestration.rag_integration import PromptAugmenter
from cycling_ai.rag.manager import RetrievalResult


class TestRAGConfig:
    """Test RAGConfig dataclass."""

    def test_rag_config_defaults(self):
        """Test RAGConfig has sensible defaults."""
        config = RAGConfig()

        assert config.enabled is False
        assert config.top_k == 3
        assert config.min_score == 0.5
        assert config.embedding_provider == "local"
        assert config.embedding_model is None

    def test_rag_config_custom_values(self):
        """Test RAGConfig accepts custom values."""
        config = RAGConfig(
            enabled=True,
            top_k=5,
            min_score=0.7,
            embedding_provider="openai",
            embedding_model="text-embedding-3-small"
        )

        assert config.enabled is True
        assert config.top_k == 5
        assert config.min_score == 0.7
        assert config.embedding_provider == "openai"
        assert config.embedding_model == "text-embedding-3-small"

    def test_rag_config_in_workflow_config(self):
        """Test RAGConfig integrates with WorkflowConfig."""
        workflow_config = WorkflowConfig(
            csv_file_path=Path("test.csv"),
            athlete_profile_path=Path("profile.json"),
            training_plan_weeks=12,
            rag_config=RAGConfig(enabled=True, top_k=5)
        )

        assert workflow_config.rag_config.enabled is True
        assert workflow_config.rag_config.top_k == 5


class TestPromptAugmenter:
    """Test PromptAugmenter class."""

    def test_augment_with_empty_results(self):
        """Test augmentation with no retrieved documents."""
        augmenter = PromptAugmenter()
        base_prompt = "You are a cycling performance analyst."

        retrieval_result = RetrievalResult(
            documents=[],
            metadata=[],
            scores=[],
            query="test query",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt(base_prompt, retrieval_result)

        # With no documents, should return base prompt unchanged
        assert augmented == base_prompt

    def test_augment_with_single_document(self):
        """Test augmentation with one document."""
        augmenter = PromptAugmenter()
        base_prompt = "You are a cycling coach."

        retrieval_result = RetrievalResult(
            documents=["Polarized training is 80% low intensity, 20% high intensity."],
            metadata=[{"category": "training_methodology", "source": "sports_science"}],
            scores=[0.85],
            query="polarized training",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt(base_prompt, retrieval_result)

        # Should contain base prompt
        assert "You are a cycling coach." in augmented

        # Should contain retrieved knowledge section
        assert "## Retrieved Knowledge Base" in augmented

        # Should contain document content
        assert "Polarized training" in augmented

        # Should contain score
        assert "0.85" in augmented

    def test_augment_with_multiple_documents(self):
        """Test augmentation with multiple documents."""
        augmenter = PromptAugmenter()
        base_prompt = "Analyze performance."

        retrieval_result = RetrievalResult(
            documents=[
                "Document 1 content",
                "Document 2 content",
                "Document 3 content"
            ],
            metadata=[
                {"title": "Doc 1"},
                {"title": "Doc 2"},
                {"title": "Doc 3"}
            ],
            scores=[0.90, 0.80, 0.70],
            query="test",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt(base_prompt, retrieval_result)

        assert "Document 1 content" in augmented
        assert "Document 2 content" in augmented
        assert "Document 3 content" in augmented
        assert "0.90" in augmented
        assert "0.80" in augmented
        assert "0.70" in augmented

    def test_token_budget_enforcement(self):
        """Test that augmentation respects max token budget."""
        # Create large documents that exceed budget
        augmenter = PromptAugmenter(max_context_tokens=100)  # Very small budget

        large_doc = "x" * 1000  # 1000 chars = ~250 tokens
        retrieval_result = RetrievalResult(
            documents=[large_doc, large_doc, large_doc],
            metadata=[{}, {}, {}],
            scores=[0.9, 0.8, 0.7],
            query="test",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt("Base prompt", retrieval_result)

        # Count approximate tokens (4 chars per token)
        augmented_tokens = len(augmented) // 4

        # Should be roughly within budget (allow some overhead for formatting)
        assert augmented_tokens < 200  # Small multiple of max_context_tokens

    def test_formatting_consistency(self):
        """Test that formatted output has consistent structure."""
        augmenter = PromptAugmenter()

        retrieval_result = RetrievalResult(
            documents=["Content here"],
            metadata=[{"title": "Test Doc"}],
            scores=[0.85],
            query="test",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt("Base", retrieval_result)

        # Check structure
        lines = augmented.split("\n")

        # Should have base prompt first
        assert lines[0] == "Base"

        # Should have section header
        assert any("Retrieved Knowledge Base" in line for line in lines)

    def test_special_characters_handling(self):
        """Test that special characters are handled correctly."""
        augmenter = PromptAugmenter()

        retrieval_result = RetrievalResult(
            documents=[
                "Content with \"quotes\" and 'apostrophes'",
                "Content with\nnewlines\nand\ttabs"
            ],
            metadata=[{}, {}],
            scores=[0.9, 0.8],
            query="test",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt("Base", retrieval_result)

        # Should not crash and should contain the content
        assert "quotes" in augmented
        assert "newlines" in augmented

    def test_source_attribution(self):
        """Test that sources are properly attributed."""
        augmenter = PromptAugmenter()

        retrieval_result = RetrievalResult(
            documents=["Training content"],
            metadata=[{
                "title": "Polarized Training",
                "category": "training_methodology",
                "source_file": "polarized_training.md"
            }],
            scores=[0.85],
            query="training",
            collection="domain_knowledge"
        )

        augmented = augmenter.augment_system_prompt("Base", retrieval_result)

        # Should show collection name
        assert "domain_knowledge" in augmented.lower()

    def test_multiple_retrievals_combined(self):
        """Test combining multiple retrieval results."""
        augmenter = PromptAugmenter()

        result1 = RetrievalResult(
            documents=["Domain doc"],
            metadata=[{}],
            scores=[0.9],
            query="test1",
            collection="domain_knowledge"
        )

        result2 = RetrievalResult(
            documents=["Template doc"],
            metadata=[{}],
            scores=[0.8],
            query="test2",
            collection="training_templates"
        )

        # Augment with first result
        augmented = augmenter.augment_system_prompt("Base", result1)

        # Then augment with second result
        augmented2 = augmenter.augment_system_prompt(augmented, result2)

        # Both should be present
        assert "Domain doc" in augmented2
        assert "Template doc" in augmented2


class TestPhaseContextWithRAG:
    """Test PhaseContext with RAG manager."""

    def test_phase_context_with_rag_manager(self, tmp_path):
        """Test PhaseContext accepts rag_manager field."""
        from cycling_ai.rag.manager import RAGManager
        from cycling_ai.orchestration.session import SessionManager
        from unittest.mock import Mock

        # Create RAGManager
        rag_manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user"
        )

        # Create WorkflowConfig with RAG enabled
        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            rag_config=RAGConfig(enabled=True)
        )

        # Create PhaseContext with rag_manager (use mocks for prompts_manager)
        context = PhaseContext(
            config=config,
            previous_phase_data={},
            session_manager=SessionManager(tmp_path / "sessions"),
            provider=None,  # Mock provider
            prompts_manager=Mock(),  # Mock prompts manager
            rag_manager=rag_manager
        )

        # Should have rag_manager
        assert context.rag_manager is not None
        assert context.rag_manager == rag_manager

    def test_phase_context_without_rag_manager(self, tmp_path):
        """Test PhaseContext works without rag_manager (backward compatibility)."""
        from cycling_ai.orchestration.session import SessionManager
        from unittest.mock import Mock

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12
        )

        context = PhaseContext(
            config=config,
            previous_phase_data={},
            session_manager=SessionManager(tmp_path / "sessions"),
            provider=None,
            prompts_manager=Mock(),  # Mock prompts manager
            rag_manager=None  # No RAG
        )

        # Should work with None
        assert context.rag_manager is None
