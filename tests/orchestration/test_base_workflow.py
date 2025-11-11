"""
Tests for BaseWorkflow RAG manager initialization.

Tests that RAGManager is properly created and integrated into phase context.
"""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import Mock

from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig
from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow


# Concrete implementation for testing abstract BaseWorkflow
class TestWorkflow(BaseWorkflow):
    """Minimal concrete implementation of BaseWorkflow for testing."""

    def get_phases(self):
        """Return empty list of phases."""
        return []

    def execute_workflow(self, config: WorkflowConfig):
        """Minimal implementation."""
        pass


class TestRAGManagerInitialization:
    """Test RAG manager initialization in BaseWorkflow."""

    def test_create_phase_context_with_rag_enabled(self, tmp_path):
        """Test that RAGManager is created when RAG enabled."""
        # Create populated vectorstore directory
        vectorstore_path = tmp_path / "vectorstore"
        vectorstore_path.mkdir()
        (vectorstore_path / "chroma.sqlite3").touch()  # Mock DB file

        # Create RAG config with enabled=True
        rag_config = RAGConfig(
            enabled=True,
            project_vectorstore_path=vectorstore_path,
        )

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            rag_config=rag_config,
        )

        # Create workflow with mocked prompts_manager
        provider = Mock()
        prompts_manager = Mock()
        workflow = TestWorkflow(provider=provider, prompts_manager=prompts_manager)

        # Create phase context
        context = workflow._create_phase_context(config, {})

        # RAGManager should be initialized
        assert context.rag_manager is not None
        assert context.config.rag_config.enabled is True

    def test_create_phase_context_with_rag_disabled(self, tmp_path):
        """Test that RAGManager is NOT created when RAG disabled."""
        # RAG config with enabled=False (default)
        rag_config = RAGConfig(enabled=False)

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            rag_config=rag_config,
        )

        provider = Mock()
        prompts_manager = Mock()
        workflow = TestWorkflow(provider=provider, prompts_manager=prompts_manager)

        context = workflow._create_phase_context(config, {})

        # RAGManager should be None
        assert context.rag_manager is None
        assert context.config.rag_config.enabled is False

    def test_create_phase_context_rag_missing_vectorstore(self, tmp_path, caplog):
        """Test graceful degradation when vectorstore missing."""
        import logging
        caplog.set_level(logging.WARNING)

        # Point to non-existent vectorstore
        missing_path = tmp_path / "nonexistent"

        rag_config = RAGConfig(
            enabled=True,
            project_vectorstore_path=missing_path,
        )

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            rag_config=rag_config,
        )

        provider = Mock()
        prompts_manager = Mock()
        workflow = TestWorkflow(provider=provider, prompts_manager=prompts_manager)

        context = workflow._create_phase_context(config, {})

        # Should degrade gracefully
        assert context.rag_manager is None
        assert "not found" in caplog.text.lower()

    def test_rag_config_propagates_to_context(self, tmp_path):
        """Test that RAGConfig is accessible in PhaseContext."""
        rag_config = RAGConfig(
            enabled=True,
            top_k=5,
            min_score=0.7,
        )

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            rag_config=rag_config,
        )

        provider = Mock()
        prompts_manager = Mock()
        workflow = TestWorkflow(provider=provider, prompts_manager=prompts_manager)

        context = workflow._create_phase_context(config, {})

        # Config should be accessible
        assert context.config.rag_config.enabled is True
        assert context.config.rag_config.top_k == 5
        assert context.config.rag_config.min_score == 0.7

    def test_backward_compatibility_no_rag(self, tmp_path):
        """Test that workflow works without RAG (backward compatibility)."""
        # No RAGConfig specified (uses default)
        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            # rag_config uses default (enabled=False)
        )

        provider = Mock()
        prompts_manager = Mock()
        workflow = TestWorkflow(provider=provider, prompts_manager=prompts_manager)

        context = workflow._create_phase_context(config, {})

        # Should work with None RAG manager
        assert context.rag_manager is None
        assert context.config.rag_config.enabled is False
