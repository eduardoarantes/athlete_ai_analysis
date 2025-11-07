"""
Unit tests for DataPreparationPhase.

Tests Phase 1 execution: data validation and cache creation.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import Mock, MagicMock, patch

import pytest

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
)
from cycling_ai.orchestration.phases.data_preparation import DataPreparationPhase
from cycling_ai.tools.base import ToolExecutionResult


class TestDataPreparationPhase:
    """Test suite for DataPreparationPhase."""

    @pytest.fixture
    def mock_context(self, tmp_path: Path) -> PhaseContext:
        """Create mock phase context."""
        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "profile.json",
            csv_file_path=tmp_path / "activities.csv",
            fit_dir_path=tmp_path / "fit_files",
            output_dir=tmp_path / "output",
            period_months=6,
            training_plan_weeks=12,
        )

        return PhaseContext(
            config=config,
            previous_phase_data={},
            session_manager=Mock(),
            provider=Mock(),
            prompts_manager=Mock(),
            progress_callback=None,
        )

    @pytest.fixture
    def data_prep_phase(self) -> DataPreparationPhase:
        """Create DataPreparationPhase instance."""
        return DataPreparationPhase()

    def test_phase_name(self, data_prep_phase: DataPreparationPhase) -> None:
        """Test phase name is correct."""
        assert data_prep_phase.phase_name == "data_preparation"

    def test_required_tools(self, data_prep_phase: DataPreparationPhase) -> None:
        """Test correct tools are required."""
        tools = data_prep_phase.required_tools
        assert "validate_data" in tools
        assert "prepare_cache" in tools
        assert len(tools) == 2

    def test_validate_context_success(
        self, data_prep_phase: DataPreparationPhase, mock_context: PhaseContext
    ) -> None:
        """Test context validation succeeds with valid config."""
        # Should not raise
        data_prep_phase._validate_context(mock_context)

    def test_validate_context_missing_profile(
        self, data_prep_phase: DataPreparationPhase, mock_context: PhaseContext
    ) -> None:
        """Test context validation fails with missing profile path."""
        mock_context.config.athlete_profile_path = None  # type: ignore

        with pytest.raises(ValueError, match="athlete_profile_path is required"):
            data_prep_phase._validate_context(mock_context)

    def test_validate_context_missing_data_sources(
        self, data_prep_phase: DataPreparationPhase, mock_context: PhaseContext
    ) -> None:
        """Test context validation fails when both CSV and FIT dir are missing."""
        mock_context.config.csv_file_path = None
        mock_context.config.fit_dir_path = None

        with pytest.raises(ValueError, match="At least one data source required"):
            data_prep_phase._validate_context(mock_context)

    @patch("cycling_ai.orchestration.phases.data_preparation.DataValidationTool")
    @patch("cycling_ai.orchestration.phases.data_preparation.CachePreparationTool")
    def test_execute_phase_success(
        self,
        mock_cache_tool_class: Mock,
        mock_validation_tool_class: Mock,
        data_prep_phase: DataPreparationPhase,
        mock_context: PhaseContext,
    ) -> None:
        """Test successful phase execution."""
        # Mock validation tool
        mock_validation_tool = Mock()
        mock_validation_result = ToolExecutionResult(
            success=True,
            data={"message": "Validation passed", "issues": []},
            format="json",
        )
        mock_validation_tool.execute.return_value = mock_validation_result
        mock_validation_tool_class.return_value = mock_validation_tool

        # Mock cache tool
        mock_cache_tool = Mock()
        mock_cache_result = ToolExecutionResult(
            success=True,
            data={
                "cache_path": "/tmp/cache.parquet",
                "metadata_path": "/tmp/metadata.json",
                "message": "Cache created",
                "zone_enriched": True,
            },
            format="json",
        )
        mock_cache_tool.execute.return_value = mock_cache_result
        mock_cache_tool_class.return_value = mock_cache_tool

        # Execute phase
        result = data_prep_phase._execute_phase(mock_context)

        # Verify result
        assert result.status == PhaseStatus.COMPLETED
        assert result.phase_name == "data_preparation"
        assert result.tokens_used == 0  # No LLM calls
        assert "Validation passed" in result.agent_response
        assert "Cache created" in result.agent_response

        # Verify extracted data
        assert result.extracted_data["cache_file_path"] == "/tmp/cache.parquet"
        assert result.extracted_data["cache_metadata_path"] == "/tmp/metadata.json"
        assert (
            result.extracted_data["athlete_profile_path"]
            == str(mock_context.config.athlete_profile_path)
        )
        assert result.extracted_data["zone_enriched"] is True

        # Verify tools were called
        mock_validation_tool.execute.assert_called_once()
        mock_cache_tool.execute.assert_called_once()

    @patch("cycling_ai.orchestration.phases.data_preparation.DataValidationTool")
    def test_execute_phase_validation_fails(
        self,
        mock_validation_tool_class: Mock,
        data_prep_phase: DataPreparationPhase,
        mock_context: PhaseContext,
    ) -> None:
        """Test phase execution when validation fails."""
        # Mock validation tool to fail
        mock_validation_tool = Mock()
        mock_validation_result = ToolExecutionResult(
            success=False,
            data={
                "message": "Validation failed",
                "issues": ["File not found", "Invalid format"],
            },
            format="json",
            errors=["File not found", "Invalid format"],  # Required for failed results
        )
        mock_validation_tool.execute.return_value = mock_validation_result
        mock_validation_tool_class.return_value = mock_validation_tool

        # Execute phase
        result = data_prep_phase._execute_phase(mock_context)

        # Verify result
        assert result.status == PhaseStatus.FAILED
        assert result.phase_name == "data_preparation"
        assert "File not found" in result.errors
        assert "Invalid format" in result.errors
        assert "Data validation failed" in result.agent_response

    @patch("cycling_ai.orchestration.phases.data_preparation.DataValidationTool")
    @patch("cycling_ai.orchestration.phases.data_preparation.CachePreparationTool")
    def test_execute_phase_cache_fails(
        self,
        mock_cache_tool_class: Mock,
        mock_validation_tool_class: Mock,
        data_prep_phase: DataPreparationPhase,
        mock_context: PhaseContext,
    ) -> None:
        """Test phase execution when cache creation fails."""
        # Mock validation tool to succeed
        mock_validation_tool = Mock()
        mock_validation_result = ToolExecutionResult(
            success=True,
            data={"message": "Validation passed"},
            format="json",
        )
        mock_validation_tool.execute.return_value = mock_validation_result
        mock_validation_tool_class.return_value = mock_validation_tool

        # Mock cache tool to fail
        mock_cache_tool = Mock()
        mock_cache_result = ToolExecutionResult(
            success=False,
            data={},
            format="json",
            errors=["Disk full", "Permission denied"],
        )
        mock_cache_tool.execute.return_value = mock_cache_result
        mock_cache_tool_class.return_value = mock_cache_tool

        # Execute phase
        result = data_prep_phase._execute_phase(mock_context)

        # Verify result
        assert result.status == PhaseStatus.FAILED
        assert result.phase_name == "data_preparation"
        assert "Disk full" in result.errors
        assert "Permission denied" in result.errors
        assert "Cache creation failed" in result.agent_response

    @patch("cycling_ai.orchestration.phases.data_preparation.DataValidationTool")
    @patch("cycling_ai.orchestration.phases.data_preparation.CachePreparationTool")
    def test_execute_phase_with_fit_only_mode(
        self,
        mock_cache_tool_class: Mock,
        mock_validation_tool_class: Mock,
        data_prep_phase: DataPreparationPhase,
        mock_context: PhaseContext,
    ) -> None:
        """Test phase execution in FIT-only mode."""
        # Configure for FIT-only mode
        mock_context.config.csv_file_path = None
        mock_context.config.fit_only_mode = True

        # Mock tools
        mock_validation_tool = Mock()
        mock_validation_result = ToolExecutionResult(
            success=True,
            data={"message": "Validation passed"},
            format="json",
        )
        mock_validation_tool.execute.return_value = mock_validation_result
        mock_validation_tool_class.return_value = mock_validation_tool

        mock_cache_tool = Mock()
        mock_cache_result = ToolExecutionResult(
            success=True,
            data={
                "cache_path": "/tmp/cache.parquet",
                "metadata_path": "/tmp/metadata.json",
            },
            format="json",
        )
        mock_cache_tool.execute.return_value = mock_cache_result
        mock_cache_tool_class.return_value = mock_cache_tool

        # Execute phase
        result = data_prep_phase._execute_phase(mock_context)

        # Verify result
        assert result.status == PhaseStatus.COMPLETED

        # Verify cache tool was called with output_dir_path (FIT-only mode requirement)
        cache_call_kwargs = mock_cache_tool.execute.call_args.kwargs
        assert "output_dir_path" in cache_call_kwargs
        assert cache_call_kwargs["output_dir_path"] == str(mock_context.config.output_dir)

    @patch("cycling_ai.orchestration.phases.data_preparation.DataValidationTool")
    @patch("cycling_ai.orchestration.phases.data_preparation.CachePreparationTool")
    def test_execute_with_progress_callback(
        self,
        mock_cache_tool_class: Mock,
        mock_validation_tool_class: Mock,
        data_prep_phase: DataPreparationPhase,
        mock_context: PhaseContext,
    ) -> None:
        """Test phase execution calls progress callback."""
        progress_calls: list[tuple[str, PhaseStatus]] = []

        def progress_callback(phase_name: str, status: PhaseStatus) -> None:
            progress_calls.append((phase_name, status))

        mock_context.progress_callback = progress_callback

        # Mock validation tool
        mock_validation_tool = Mock()
        mock_validation_result = ToolExecutionResult(
            success=True,
            data={"message": "Validation passed"},
            format="json",
        )
        mock_validation_tool.execute.return_value = mock_validation_result
        mock_validation_tool_class.return_value = mock_validation_tool

        # Mock cache tool
        mock_cache_tool = Mock()
        mock_cache_result = ToolExecutionResult(
            success=True,
            data={
                "cache_path": "/tmp/cache.parquet",
                "metadata_path": "/tmp/metadata.json",
            },
            format="json",
        )
        mock_cache_tool.execute.return_value = mock_cache_result
        mock_cache_tool_class.return_value = mock_cache_tool

        # Execute using the template method (which should call progress callback)
        result = data_prep_phase.execute(mock_context)

        # Verify result success
        assert result.status == PhaseStatus.COMPLETED

        # Verify progress callback was called
        assert len(progress_calls) >= 1  # At least completion callback
        # Last call should be completion
        assert progress_calls[-1] == ("data_preparation", PhaseStatus.COMPLETED)

    @patch("cycling_ai.orchestration.phases.data_preparation.DataValidationTool")
    def test_execute_with_exception(
        self,
        mock_validation_tool_class: Mock,
        data_prep_phase: DataPreparationPhase,
        mock_context: PhaseContext,
    ) -> None:
        """Test phase execution handles exceptions gracefully."""
        # Mock validation tool to raise exception
        mock_validation_tool = Mock()
        mock_validation_tool.execute.side_effect = RuntimeError("Unexpected error")
        mock_validation_tool_class.return_value = mock_validation_tool

        # Execute phase using template method (which has error handling)
        result = data_prep_phase.execute(mock_context)

        # Verify result indicates failure
        assert result.status == PhaseStatus.FAILED
        assert result.phase_name == "data_preparation"
        # BasePhase wraps exception as "RuntimeError: Unexpected error"
        assert len(result.errors) > 0
        assert "Unexpected error" in result.errors[0]

    def test_extract_phase_data_not_applicable(
        self, data_prep_phase: DataPreparationPhase
    ) -> None:
        """Test _extract_phase_data returns empty dict (not used in Phase 1)."""
        # Phase 1 doesn't use LLM or sessions, so this method returns empty dict
        mock_session = Mock()
        mock_session.messages = []

        extracted = data_prep_phase._extract_phase_data("response", mock_session)

        assert extracted == {}
        assert isinstance(extracted, dict)
