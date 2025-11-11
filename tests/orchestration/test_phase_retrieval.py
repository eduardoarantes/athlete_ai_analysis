"""
Tests for phase-specific RAG retrieval methods.

Tests that each phase implements custom retrieval queries and collection routing.
"""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import Mock

from cycling_ai.orchestration.base import WorkflowConfig, PhaseContext
from cycling_ai.orchestration.phases import (
    DataPreparationPhase,
    PerformanceAnalysisPhase,
    TrainingPlanningPhase,
    ReportPreparationPhase,
)


def _create_mock_context(config, previous_data):
    """Create mock PhaseContext for testing."""
    return PhaseContext(
        config=config,
        previous_phase_data=previous_data,
        session_manager=Mock(),
        provider=Mock(),
        prompts_manager=Mock(),
        rag_manager=None,
    )


class TestDataPreparationRetrieval:
    """Test DataPreparationPhase retrieval methods."""

    def test_data_prep_retrieval_query(self, tmp_path):
        """Test data preparation retrieval query."""
        phase = DataPreparationPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        context = _create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should mention data validation and file types
        assert "data validation" in query.lower() or "validation" in query.lower()
        assert "fit" in query.lower() or "csv" in query.lower()

    def test_data_prep_retrieval_collection(self):
        """Test data preparation uses domain_knowledge collection."""
        phase = DataPreparationPhase()

        collection = phase._get_retrieval_collection()

        assert collection == "domain_knowledge"


class TestPerformanceAnalysisRetrieval:
    """Test PerformanceAnalysisPhase retrieval methods."""

    def test_performance_retrieval_query_basic(self, tmp_path):
        """Test performance analysis retrieval query."""
        phase = PerformanceAnalysisPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            period_months=6,
        )

        context = _create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should mention performance analysis and period
        assert "performance" in query.lower()
        assert "zones" in query.lower() or "ftp" in query.lower()
        assert "6" in query  # period_months

    def test_performance_retrieval_query_with_cross_training(self, tmp_path):
        """Test performance query includes cross-training when applicable."""
        phase = PerformanceAnalysisPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            period_months=6,
        )

        # Simulate cache info with cross-training
        previous_data = {
            "cache_info": {
                "has_cross_training_activities": True
            }
        }

        context = _create_mock_context(config, previous_data)

        query = phase._get_retrieval_query(context)

        # Should mention cross-training
        assert "cross-training" in query.lower() or "cross training" in query.lower()

    def test_performance_retrieval_collection(self):
        """Test performance analysis uses domain_knowledge collection."""
        phase = PerformanceAnalysisPhase()

        collection = phase._get_retrieval_collection()

        assert collection == "domain_knowledge"


class TestTrainingPlanningRetrieval:
    """Test TrainingPlanningPhase retrieval methods."""

    def test_training_retrieval_query_with_ftp(self, tmp_path):
        """Test training planning query includes FTP from performance data."""
        phase = TrainingPlanningPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        # Simulate performance analysis result with FTP
        previous_data = {
            "performance_analysis": {
                "current_ftp": 265
            }
        }

        context = _create_mock_context(config, previous_data)

        query = phase._get_retrieval_query(context)

        # Should include weeks and FTP
        assert "12" in query  # weeks
        assert "265" in query  # FTP

    def test_training_retrieval_query_default_ftp(self, tmp_path):
        """Test training planning uses default FTP if not available."""
        phase = TrainingPlanningPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        # No performance data
        context = _create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should use default FTP (250W)
        assert "250" in query

    def test_training_retrieval_collection_is_templates(self):
        """Test training planning uses training_templates collection."""
        phase = TrainingPlanningPhase()

        collection = phase._get_retrieval_collection()

        # CRITICAL: Only phase that uses templates!
        assert collection == "training_templates"


class TestReportPreparationRetrieval:
    """Test ReportPreparationPhase retrieval methods."""

    def test_report_prep_retrieval_query(self, tmp_path):
        """Test report preparation retrieval query."""
        phase = ReportPreparationPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        context = _create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should mention report generation
        assert "report" in query.lower()
        assert "insights" in query.lower() or "recommendations" in query.lower()

    def test_report_prep_retrieval_collection(self):
        """Test report preparation uses domain_knowledge collection."""
        phase = ReportPreparationPhase()

        collection = phase._get_retrieval_collection()

        assert collection == "domain_knowledge"
