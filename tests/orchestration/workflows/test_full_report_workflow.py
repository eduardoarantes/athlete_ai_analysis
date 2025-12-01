"""
Unit and integration tests for FullReportWorkflow.

Tests the complete 4-phase workflow orchestration.
"""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
)
from cycling_ai.orchestration.workflows.full_report import FullReportWorkflow


class TestFullReportWorkflowInitialization:
    """Test FullReportWorkflow initialization."""

    def test_init_with_provider(self):
        """Test initialization with minimal provider."""
        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        assert workflow.provider == provider
        assert workflow.prompts_manager is not None
        assert workflow.session_manager is not None
        assert workflow.progress_callback is None

    def test_init_with_all_parameters(self):
        """Test initialization with all parameters."""
        provider = Mock()
        prompts_manager = Mock()
        session_manager = Mock()
        progress_callback = Mock()

        workflow = FullReportWorkflow(
            provider=provider,
            prompts_manager=prompts_manager,
            session_manager=session_manager,
            progress_callback=progress_callback,
        )

        assert workflow.provider == provider
        assert workflow.prompts_manager == prompts_manager
        assert workflow.session_manager == session_manager
        assert workflow.progress_callback == progress_callback


class TestGetPhases:
    """Test get_phases method."""

    def test_get_phases_returns_all_4_phases(self):
        """Test that get_phases returns all 4 phases in order."""
        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        phases = workflow.get_phases()

        assert len(phases) == 4
        assert phases[0].phase_name == "data_preparation"
        assert phases[1].phase_name == "performance_analysis"
        assert phases[2].phase_name == "training_planning"
        assert phases[3].phase_name == "report_data_preparation"


class TestExecuteWorkflowPhaseSequence:
    """Test that execute_workflow runs phases in correct sequence."""

    @patch("cycling_ai.orchestration.workflows.full_report.DataPreparationPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.PerformanceAnalysisPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.TrainingPlanningPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.ReportPreparationPhase")
    def test_execute_all_phases_success(
        self,
        mock_phase4_class,
        mock_phase3_class,
        mock_phase2_class,
        mock_phase1_class,
        tmp_path: Path,
    ):
        """Test successful execution of all 4 phases."""
        # Setup mock phases
        phase1 = Mock()
        phase1.execute.return_value = PhaseResult(
            phase_name="data_preparation",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 1 complete",
            extracted_data={"cache_file_path": str(tmp_path / "cache.parquet")},
            tokens_used=0,
        )
        mock_phase1_class.return_value = phase1

        phase2 = Mock()
        phase2.execute.return_value = PhaseResult(
            phase_name="performance_analysis",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 2 complete",
            extracted_data={"performance_analysis_json": {"metric": "value"}},
            tokens_used=100,
        )
        mock_phase2_class.return_value = phase2

        phase3 = Mock()
        phase3.execute.return_value = PhaseResult(
            phase_name="training_planning",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 3 complete",
            extracted_data={"training_plan": {"plan_id": "test"}},
            tokens_used=200,
        )
        mock_phase3_class.return_value = phase3

        phase4 = Mock()
        phase4.execute.return_value = PhaseResult(
            phase_name="report_preparation",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 4 complete",
            extracted_data={"report_data_path": str(tmp_path / "report_data.json")},
            tokens_used=0,
        )
        mock_phase4_class.return_value = phase4

        # Create workflow
        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        # Create config
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
            generate_training_plan=True,
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        # Execute workflow
        result = workflow.execute_workflow(config)

        # Verify all phases executed
        assert phase1.execute.called
        assert phase2.execute.called
        assert phase3.execute.called
        assert phase4.execute.called

        # Verify result
        assert result.success
        assert len(result.phase_results) == 4
        assert result.total_tokens_used == 300  # 0 + 100 + 200 + 0

    @patch("cycling_ai.orchestration.workflows.full_report.DataPreparationPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.PerformanceAnalysisPhase")
    def test_execute_stops_on_phase2_failure(
        self, mock_phase2_class, mock_phase1_class, tmp_path: Path
    ):
        """Test that workflow stops when phase 2 fails."""
        # Phase 1 succeeds
        phase1 = Mock()
        phase1.execute.return_value = PhaseResult(
            phase_name="data_preparation",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 1 complete",
            extracted_data={"cache_file_path": str(tmp_path / "cache.parquet")},
            tokens_used=0,
        )
        mock_phase1_class.return_value = phase1

        # Phase 2 fails
        phase2 = Mock()
        phase2.execute.return_value = PhaseResult(
            phase_name="performance_analysis",
            status=PhaseStatus.FAILED,
            agent_response="",
            errors=["Analysis failed"],
            tokens_used=50,
        )
        mock_phase2_class.return_value = phase2

        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        result = workflow.execute_workflow(config)

        # Only 2 phases executed
        assert phase1.execute.called
        assert phase2.execute.called

        # Workflow failed
        assert not result.success
        assert len(result.phase_results) == 2
        assert result.total_tokens_used == 50


class TestSkipDataPrep:
    """Test skip_data_prep configuration option."""

    @patch("cycling_ai.orchestration.workflows.full_report.PerformanceAnalysisPhase")
    def test_skip_data_prep_creates_skipped_result(
        self, mock_phase2_class, tmp_path: Path
    ):
        """Test that skip_data_prep creates a SKIPPED result for phase 1."""
        # Create cache file so validation passes
        cache_dir = tmp_path / "reports" / "cache"
        cache_dir.mkdir(parents=True)
        cache_path = cache_dir / "activities_processed.parquet"
        cache_path.write_text("dummy")

        # Phase 2 succeeds
        phase2 = Mock()
        phase2.execute.return_value = PhaseResult(
            phase_name="performance_analysis",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 2 complete",
            extracted_data={"performance_analysis_json": {}},
            tokens_used=100,
        )
        mock_phase2_class.return_value = phase2

        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
            output_dir=tmp_path / "reports",
            skip_data_prep=True,
            generate_training_plan=False,  # Skip phase 3 for this test
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        result = workflow.execute_workflow(config)

        # Phase 1 skipped
        assert result.phase_results[0].status == PhaseStatus.SKIPPED
        assert result.phase_results[0].phase_name == "data_preparation"

        # Phase 2 executed
        assert phase2.execute.called
        assert result.phase_results[1].status == PhaseStatus.COMPLETED


class TestOptionalTrainingPlan:
    """Test generate_training_plan=False skips phase 3 and 4."""

    @patch("cycling_ai.orchestration.workflows.full_report.DataPreparationPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.PerformanceAnalysisPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.TrainingPlanningPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.ReportPreparationPhase")
    def test_skip_training_plan_skips_phase3_and_phase4(
        self,
        mock_phase4_class,
        mock_phase3_class,
        mock_phase2_class,
        mock_phase1_class,
        tmp_path: Path,
    ):
        """Test that generate_training_plan=False skips phases 3 and 4."""
        # Phase 1 succeeds
        phase1 = Mock()
        phase1.execute.return_value = PhaseResult(
            phase_name="data_preparation",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 1 complete",
            extracted_data={"cache_file_path": str(tmp_path / "cache.parquet")},
            tokens_used=0,
        )
        mock_phase1_class.return_value = phase1

        # Phase 2 succeeds
        phase2 = Mock()
        phase2.execute.return_value = PhaseResult(
            phase_name="performance_analysis",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 2 complete",
            extracted_data={"performance_analysis_json": {}},
            tokens_used=100,
        )
        mock_phase2_class.return_value = phase2

        # Phase 3 and 4 should not be called
        phase3 = Mock()
        mock_phase3_class.return_value = phase3

        phase4 = Mock()
        mock_phase4_class.return_value = phase4

        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
            generate_training_plan=False,  # Skip training plan
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        result = workflow.execute_workflow(config)

        # Only 2 phases executed
        assert phase1.execute.called
        assert phase2.execute.called
        assert not phase3.execute.called
        assert not phase4.execute.called

        # Workflow success with only 2 phases
        assert result.success
        assert len(result.phase_results) == 2


class TestDataAccumulation:
    """Test that data accumulates correctly between phases."""

    @patch("cycling_ai.orchestration.workflows.full_report.DataPreparationPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.PerformanceAnalysisPhase")
    @patch("cycling_ai.orchestration.workflows.full_report.TrainingPlanningPhase")
    def test_data_flows_through_phases(
        self, mock_phase3_class, mock_phase2_class, mock_phase1_class, tmp_path: Path
    ):
        """Test that extracted data flows from phase to phase."""
        captured_contexts = []

        # Phase 1
        phase1 = Mock()

        def phase1_execute(ctx):
            captured_contexts.append(("phase1", ctx))
            return PhaseResult(
                phase_name="data_preparation",
                status=PhaseStatus.COMPLETED,
                agent_response="",
                extracted_data={"cache_file_path": "/tmp/cache.parquet"},
                tokens_used=0,
            )

        phase1.execute.side_effect = phase1_execute
        mock_phase1_class.return_value = phase1

        # Phase 2
        phase2 = Mock()

        def phase2_execute(ctx):
            captured_contexts.append(("phase2", ctx))
            return PhaseResult(
                phase_name="performance_analysis",
                status=PhaseStatus.COMPLETED,
                agent_response="",
                extracted_data={"performance_analysis_json": {"ftp": 260}},
                tokens_used=100,
            )

        phase2.execute.side_effect = phase2_execute
        mock_phase2_class.return_value = phase2

        # Phase 3
        phase3 = Mock()

        def phase3_execute(ctx):
            captured_contexts.append(("phase3", ctx))
            return PhaseResult(
                phase_name="training_planning",
                status=PhaseStatus.COMPLETED,
                agent_response="",
                extracted_data={"training_plan": {"plan_id": "test"}},
                tokens_used=200,
            )

        phase3.execute.side_effect = phase3_execute
        mock_phase3_class.return_value = phase3

        provider = Mock()
        workflow = FullReportWorkflow(provider=provider)

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
            generate_training_plan=True,
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        workflow.execute_workflow(config)

        # Phase 1 has empty previous data
        assert captured_contexts[0][0] == "phase1"
        assert captured_contexts[0][1].previous_phase_data == {}

        # Phase 2 has phase 1 data
        assert captured_contexts[1][0] == "phase2"
        assert "cache_file_path" in captured_contexts[1][1].previous_phase_data

        # Phase 3 has phase 1 + 2 data
        assert captured_contexts[2][0] == "phase3"
        assert "cache_file_path" in captured_contexts[2][1].previous_phase_data
        assert "performance_analysis_json" in captured_contexts[2][1].previous_phase_data
