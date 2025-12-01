"""
Tests for ReportPreparationPhase (Phase 4).

Phase 4 consolidates all previous phase data into report_data.json format.
This is a Python-only phase (no LLM orchestration).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
)
from cycling_ai.orchestration.phases.report_preparation import ReportPreparationPhase


class TestReportPreparationPhaseBasics:
    """Test basic phase properties and initialization."""

    @pytest.fixture
    def report_phase(self):
        """Create ReportPreparationPhase instance."""
        return ReportPreparationPhase()

    def test_phase_name(self, report_phase):
        """Test phase name is correct."""
        assert report_phase.phase_name == "report_data_preparation"

    def test_required_tools(self, report_phase):
        """Test required tools are specified."""
        # Phase 4 doesn't use tools directly, but inherits from BasePhase
        assert report_phase.required_tools == []


class TestValidateContext:
    """Test context validation logic."""

    @pytest.fixture
    def report_phase(self):
        """Create ReportPreparationPhase instance."""
        return ReportPreparationPhase()

    @pytest.fixture
    def valid_context(self, tmp_path):
        """Create valid PhaseContext for Phase 4."""
        # Create test athlete profile
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text(
            json.dumps(
                {
                    "ftp": 260,
                    "max_hr": 186,
                    "weight_kg": 70,
                    "age": 35,
                    "goals": ["Improve FTP"],
                }
            )
        )

        config = WorkflowConfig(
            athlete_profile_path=profile_path,
            csv_file_path=None,
            fit_dir_path=None,
            output_dir=tmp_path / "output",
            period_months=6,
            generate_training_plan=True,
            training_plan_weeks=12,
        )

        # Create context with Phase 2 and Phase 3 data
        context = PhaseContext(
            config=config,
            previous_phase_data={
                "performance_data": {"power_profile": {}, "zone_distribution": {}},
                "zones_data": {"zones": []},
                "training_plan": {
                    "plan_id": "test_plan",
                    "weekly_plan": [{"week": 1, "workouts": []}],
                    "plan_metadata": {"target_ftp": 270},
                },
            },
            session_manager=MagicMock(),
            provider=MagicMock(),
            prompts_manager=MagicMock(),
        )

        return context

    def test_validate_context_success(self, report_phase, valid_context):
        """Test validation succeeds with all required data."""
        # Should not raise
        report_phase._validate_context(valid_context)

    def test_validate_context_missing_performance_data(
        self, report_phase, valid_context
    ):
        """Test validation fails when performance_data is missing."""
        # Remove performance_data
        del valid_context.previous_phase_data["performance_data"]

        with pytest.raises(ValueError, match="performance_data"):
            report_phase._validate_context(valid_context)

    def test_validate_context_missing_zones_data(self, report_phase, valid_context):
        """Test validation fails when zones_data is missing."""
        # Remove zones_data
        del valid_context.previous_phase_data["zones_data"]

        with pytest.raises(ValueError, match="zones_data"):
            report_phase._validate_context(valid_context)

    def test_validate_context_missing_training_plan(self, report_phase, valid_context):
        """Test validation fails when training_plan is missing."""
        # Remove training_plan
        del valid_context.previous_phase_data["training_plan"]

        with pytest.raises(ValueError, match="training_plan"):
            report_phase._validate_context(valid_context)


class TestExecutePhase:
    """Test phase execution logic."""

    @pytest.fixture
    def report_phase(self):
        """Create ReportPreparationPhase instance."""
        return ReportPreparationPhase()

    @pytest.fixture
    def valid_context(self, tmp_path):
        """Create valid PhaseContext with mock data."""
        # Create test athlete profile
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text(
            json.dumps(
                {
                    "ftp": 260,
                    "max_hr": 186,
                    "weight_kg": 70,
                    "age": 35,
                    "goals": ["Improve FTP"],
                }
            )
        )

        # Create output directory
        output_dir = tmp_path / "output"
        output_dir.mkdir(exist_ok=True)

        config = WorkflowConfig(
            athlete_profile_path=profile_path,
            csv_file_path=None,
            fit_dir_path=None,
            output_dir=output_dir,
            period_months=6,
            generate_training_plan=True,
            training_plan_weeks=12,
        )

        # Create context with complete phase data
        context = PhaseContext(
            config=config,
            previous_phase_data={
                "performance_data": {
                    "power_profile": {"ftp": 260},
                    "zone_distribution": {"Z2": 0.6},
                },
                "zones_data": {"zones": [{"name": "Z1", "min": 0, "max": 140}]},
                "training_plan": {
                    "plan_id": "test_plan_123",
                    "weekly_plan": [
                        {
                            "week": 1,
                            "workouts": [
                                {
                                    "day": "Monday",
                                    "workout": {
                                        "name": "Endurance",
                                        "duration_min": 60,
                                        "tss": 50,
                                    },
                                }
                            ],
                        }
                    ],
                    "plan_metadata": {
                        "target_ftp": 270,
                        "current_ftp": 260,
                        "weeks": 12,
                    },
                },
            },
            session_manager=MagicMock(),
            provider=MagicMock(),
            prompts_manager=MagicMock(),
        )

        return context

    @patch("cycling_ai.tools.report_data_extractor.load_athlete_profile")
    @patch("cycling_ai.tools.report_data_extractor.create_report_data")
    @patch("cycling_ai.tools.report_data_extractor.consolidate_athlete_data")
    def test_execute_success(
        self,
        mock_consolidate,
        mock_create_report,
        mock_load_profile,
        report_phase,
        valid_context,
    ):
        """Test successful phase execution."""
        # Mock load_athlete_profile
        mock_load_profile.return_value = {
            "ftp": 260,
            "max_hr": 186,
            "weight_kg": 70,
            "age": 35,
        }

        # Mock consolidate_athlete_data
        mock_consolidate.return_value = {
            "athlete_id": "test_athlete",
            "athlete_name": "Test Athlete",
            "training_plan": {
                "plan_metadata": {"target_ftp": 270},
                "weekly_plan": [],
            },
        }

        # Mock create_report_data
        mock_create_report.return_value = {
            "athletes": [{"athlete_id": "test_athlete"}],
            "generator_info": {},
        }

        # Execute phase
        result = report_phase.execute(valid_context)

        # Verify success
        assert result.success
        assert result.status == PhaseStatus.COMPLETED
        assert "report_data_path" in result.extracted_data
        assert result.extracted_data["report_data_path"].endswith("report_data.json")

        # Verify file was created
        output_path = Path(result.extracted_data["report_data_path"])
        assert output_path.exists()

        # Verify report data content
        with open(output_path) as f:
            report_data = json.load(f)
        assert "athletes" in report_data
        assert len(report_data["athletes"]) == 1

    def test_execute_validation_fails(self, report_phase, valid_context):
        """Test execution fails when context validation fails."""
        # Remove required data
        del valid_context.previous_phase_data["performance_data"]

        # Execute phase
        result = report_phase.execute(valid_context)

        # Verify failure
        assert not result.success
        assert result.status == PhaseStatus.FAILED
        assert len(result.errors) > 0
        assert "performance_data" in result.errors[0]

    @patch("cycling_ai.tools.report_data_extractor.load_athlete_profile")
    def test_execute_profile_load_fails(
        self, mock_load_profile, report_phase, valid_context
    ):
        """Test execution handles profile loading errors."""
        # Mock profile loading failure
        mock_load_profile.side_effect = ValueError("Invalid profile format")

        # Execute phase
        result = report_phase.execute(valid_context)

        # Verify failure
        assert not result.success
        assert result.status == PhaseStatus.FAILED
        assert len(result.errors) > 0

    @patch("cycling_ai.tools.report_data_extractor.load_athlete_profile")
    @patch("cycling_ai.tools.report_data_extractor.consolidate_athlete_data")
    def test_execute_consolidation_fails(
        self, mock_consolidate, mock_load_profile, report_phase, valid_context
    ):
        """Test execution handles consolidation errors."""
        # Mock successful profile load
        mock_load_profile.return_value = {"ftp": 260}

        # Mock consolidation failure
        mock_consolidate.side_effect = KeyError("Missing required field")

        # Execute phase
        result = report_phase.execute(valid_context)

        # Verify failure
        assert not result.success
        assert result.status == PhaseStatus.FAILED
        assert len(result.errors) > 0

    @patch("cycling_ai.tools.report_data_extractor.load_athlete_profile")
    @patch("cycling_ai.tools.report_data_extractor.create_report_data")
    @patch("cycling_ai.tools.report_data_extractor.consolidate_athlete_data")
    def test_execute_with_progress_callback(
        self,
        mock_consolidate,
        mock_create_report,
        mock_load_profile,
        report_phase,
        valid_context,
    ):
        """Test progress callback is invoked."""
        # Mock functions
        mock_load_profile.return_value = {"ftp": 260}
        mock_consolidate.return_value = {
            "athlete_id": "test",
            "training_plan": {"weekly_plan": []},
        }
        mock_create_report.return_value = {"athletes": []}

        # Add progress callback
        progress_calls = []

        def progress_callback(phase_name: str, status: PhaseStatus):
            progress_calls.append((phase_name, status))

        valid_context.progress_callback = progress_callback

        # Execute phase
        result = report_phase.execute(valid_context)

        # Verify progress callbacks
        assert len(progress_calls) >= 2  # IN_PROGRESS and COMPLETED (or FAILED)
        assert progress_calls[0] == ("report_data_preparation", PhaseStatus.IN_PROGRESS)
        assert progress_calls[-1][0] == "report_data_preparation"
        assert progress_calls[-1][1] in [PhaseStatus.COMPLETED, PhaseStatus.FAILED]


class TestAbstractMethodImplementations:
    """Test that abstract methods are implemented (required by BasePhase)."""

    @pytest.fixture
    def report_phase(self):
        """Create ReportPreparationPhase instance."""
        return ReportPreparationPhase()

    @pytest.fixture
    def dummy_context(self, tmp_path):
        """Create minimal context for testing abstract methods."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text(json.dumps({"ftp": 260}))

        config = WorkflowConfig(
            athlete_profile_path=profile_path,
            csv_file_path=None,
            fit_dir_path=None,
            output_dir=tmp_path,
            period_months=6,
            generate_training_plan=True,
            training_plan_weeks=12,
        )

        return PhaseContext(
            config=config,
            previous_phase_data={},
            session_manager=MagicMock(),
            provider=MagicMock(),
            prompts_manager=MagicMock(),
        )

    def test_get_system_prompt_returns_empty(self, report_phase, dummy_context):
        """Test _get_system_prompt returns empty string (not used by Phase 4)."""
        prompt = report_phase._get_system_prompt({}, dummy_context)
        assert prompt == ""

    def test_get_user_message_returns_empty(self, report_phase, dummy_context):
        """Test _get_user_message returns empty string (not used by Phase 4)."""
        message = report_phase._get_user_message({}, dummy_context)
        assert message == ""

    def test_extract_data_returns_empty(self, report_phase):
        """Test _extract_data returns empty dict (not used by Phase 4)."""
        session = MagicMock()
        data = report_phase._extract_data(session)
        assert data == {}
