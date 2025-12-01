"""
Tests for TrainingPlanningPhase.

This phase has 3 sub-phases that execute sequentially:
- Phase 3a: Overview generation (LLM + tool call)
- Phase 3b: Weekly details (LLM + iterative tool calls)
- Phase 3c: Finalization (Python only, no LLM)
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
)
from cycling_ai.orchestration.phases.training_planning import TrainingPlanningPhase
from cycling_ai.orchestration.session import ConversationSession, SessionManager
from cycling_ai.tools.base import ToolExecutionResult


class TestTrainingPlanningPhaseMetadata:
    """Test phase metadata and configuration."""

    def test_phase_name(self):
        """Phase name should be 'training_planning'."""
        phase = TrainingPlanningPhase()
        assert phase.phase_name == "training_planning"

    def test_required_tools(self):
        """Phase requires all 3 sub-phase tools."""
        phase = TrainingPlanningPhase()
        assert "create_plan_overview" in phase.required_tools
        assert "add_week_details" in phase.required_tools
        assert "finalize_training_plan" in phase.required_tools


class TestPerformanceSummaryGeneration:
    """Test performance summary generation."""

    def test_generate_performance_summary_empty_data(self):
        """Should return message when no data available."""
        phase = TrainingPlanningPhase()
        summary = phase._generate_performance_summary({})
        assert "No performance data available" in summary

    def test_generate_performance_summary_with_data(self):
        """Should format performance data into summary."""
        phase = TrainingPlanningPhase()
        phase2_data = {
            "performance_data": {
                "current_period_stats": {
                    "avg_power": 250.5,
                    "avg_speed": 32.4,
                    "total_distance": 450.0,
                    "total_time": 18000,  # 5 hours
                },
                "trends": {
                    "power_trend": "Increasing (+5%)",
                    "speed_trend": "Stable",
                },
            },
            "zones_data": {
                "zone_distribution": {
                    "z2": {"percentage": 60.0, "zone_name": "Endurance"},
                    "z3": {"percentage": 25.0, "zone_name": "Tempo"},
                    "z4": {"percentage": 10.0, "zone_name": "Threshold"},
                }
            },
        }

        summary = phase._generate_performance_summary(phase2_data)

        assert "Average Power: 250W" in summary
        assert "Average Speed: 32.4 km/h" in summary
        assert "Total Distance: 450 km" in summary
        assert "Total Time: 5.0 hours" in summary
        assert "Power: Increasing (+5%)" in summary
        assert "Endurance: 60.0%" in summary
        assert "Tempo: 25.0%" in summary


class TestPhase3aOverviewSubphase:
    """Test Phase 3a: Training plan overview generation."""

    @pytest.fixture
    def mock_context(self, tmp_path):
        """Create mock PhaseContext."""
        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=12,
            generate_training_plan=True,
        )

        # Create athlete profile file
        import json
        profile_data = {
            "FTP": 260,
            "max_hr": 186,
            "weight": "70kg",  # weight should be string with kg
            "age": 35,
            "goals": ["Improve FTP"],
            "training_availability": {
                "week_days": "Monday, Wednesday, Friday, Saturday",
                "hours_per_week": 8.0,
            },
        }
        with open(config.athlete_profile_path, "w") as f:
            json.dump(profile_data, f)

        session_manager = Mock(spec=SessionManager)
        provider = Mock()
        prompts_manager = Mock()

        context = PhaseContext(
            config=config,
            previous_phase_data={
                "athlete_profile_path": str(config.athlete_profile_path),
                "performance_data": {},
            },
            session_manager=session_manager,
            provider=provider,
            prompts_manager=prompts_manager,
            progress_callback=None,
        )

        return context

    @patch("cycling_ai.orchestration.phases.training_planning.LLMAgent")
    def test_execute_overview_subphase_success(self, mock_agent_class, mock_context):
        """Phase 3a should successfully create plan overview."""
        # Mock agent and tool call
        mock_agent = Mock()
        mock_agent_class.return_value = mock_agent
        mock_agent.process_message.return_value = "Plan overview created with plan_id: test_plan_123"

        # Mock session
        mock_session = Mock(spec=ConversationSession)
        mock_session.messages = []
        mock_context.session_manager.create_session.return_value = mock_session

        phase = TrainingPlanningPhase()
        result = phase._execute_phase_3a_overview(mock_context)

        assert result.phase_name == "training_planning_overview"
        assert result.status == PhaseStatus.COMPLETED
        assert "plan_id" in result.extracted_data

    def test_execute_overview_missing_ftp(self, mock_context, tmp_path):
        """Phase 3a should fail if FTP missing from profile."""
        # Overwrite profile without FTP
        import json
        profile_data = {
            "max_hr": 186,
            "weight": "70kg",
            "training_availability": {
                "week_days": "Monday",
                "hours_per_week": 8.0,
            },
        }
        with open(mock_context.config.athlete_profile_path, "w") as f:
            json.dump(profile_data, f)

        phase = TrainingPlanningPhase()

        with pytest.raises(ValueError, match="does not have a valid FTP"):
            phase._execute_phase_3a_overview(mock_context)

    def test_execute_overview_missing_training_days(self, mock_context):
        """Phase 3a should fail if no training days specified."""
        # Overwrite profile without training days
        import json
        profile_data = {
            "FTP": 260,
            "max_hr": 186,
            "weight": "70kg",
            "training_availability": {
                "week_days": "",  # Empty - no training days
                "hours_per_week": 8.0,
            },
        }
        with open(mock_context.config.athlete_profile_path, "w") as f:
            json.dump(profile_data, f)

        phase = TrainingPlanningPhase()

        with pytest.raises(ValueError, match="does not specify available training days"):
            phase._execute_phase_3a_overview(mock_context)


class TestPhase3bWeeksSubphase:
    """Test Phase 3b: Weekly workout details generation."""

    @pytest.fixture
    def mock_context_with_plan_id(self, tmp_path):
        """Create context with plan_id from Phase 3a."""
        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=3,  # Small number for testing
            generate_training_plan=True,
        )

        # Create athlete profile
        import json
        profile_data = {
            "FTP": 260,
            "max_hr": 186,
            "weight": "70kg",
            "age": 35,
            "goals": ["Improve FTP"],
            "training_availability": {
                "week_days": "Monday, Wednesday, Friday",
                "hours_per_week": 6.0,
            },
        }
        with open(config.athlete_profile_path, "w") as f:
            json.dump(profile_data, f)

        session_manager = Mock(spec=SessionManager)
        provider = Mock()
        prompts_manager = Mock()

        context = PhaseContext(
            config=config,
            previous_phase_data={
                "plan_id": "test_plan_123",
                "athlete_profile_path": str(config.athlete_profile_path),
            },
            session_manager=session_manager,
            provider=provider,
            prompts_manager=prompts_manager,
            progress_callback=None,
        )

        return context

    @patch("cycling_ai.orchestration.phases.training_planning.LLMAgent")
    def test_execute_weeks_subphase_success(self, mock_agent_class, mock_context_with_plan_id):
        """Phase 3b should successfully add weekly details."""
        # Mock agent
        mock_agent = Mock()
        mock_agent_class.return_value = mock_agent
        mock_agent.process_message.return_value = "Week details added for all weeks"

        # Mock session
        mock_session = Mock(spec=ConversationSession)
        mock_session.messages = []
        mock_context_with_plan_id.session_manager.create_session.return_value = mock_session

        phase = TrainingPlanningPhase()
        result = phase._execute_phase_3b_weeks(mock_context_with_plan_id)

        assert result.phase_name == "training_planning_weeks"
        assert result.status == PhaseStatus.COMPLETED

    def test_execute_weeks_missing_plan_id(self, mock_context_with_plan_id):
        """Phase 3b should fail if plan_id missing."""
        # Remove plan_id from context
        mock_context_with_plan_id.previous_phase_data.pop("plan_id")

        phase = TrainingPlanningPhase()

        with pytest.raises(ValueError, match="No plan_id found"):
            phase._execute_phase_3b_weeks(mock_context_with_plan_id)


class TestPhase3cFinalizeSubphase:
    """Test Phase 3c: Training plan finalization (Python only)."""

    @pytest.fixture
    def mock_context_with_plan_id(self, tmp_path):
        """Create context with plan_id."""
        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=12,
            generate_training_plan=True,
        )

        context = PhaseContext(
            config=config,
            previous_phase_data={
                "plan_id": "test_plan_123",
            },
            session_manager=Mock(),
            provider=Mock(),
            prompts_manager=Mock(),
            progress_callback=None,
        )

        return context

    @patch("cycling_ai.orchestration.phases.training_planning.FinalizePlanTool")
    def test_execute_finalize_subphase_success(self, mock_tool_class, mock_context_with_plan_id):
        """Phase 3c should successfully finalize plan."""
        # Mock tool execution
        mock_tool = Mock()
        mock_tool_class.return_value = mock_tool

        mock_result = ToolExecutionResult(
            success=True,
            data={"plan_id": "test_plan_123", "weeks": 12},
            format="json",
            metadata={"output_path": "/path/to/plan.json"},
        )
        mock_tool.execute.return_value = mock_result

        phase = TrainingPlanningPhase()
        result = phase._execute_phase_3c_finalize(mock_context_with_plan_id)

        assert result.phase_name == "training_planning_finalize"
        assert result.status == PhaseStatus.COMPLETED
        assert "training_plan" in result.extracted_data
        assert result.extracted_data["training_plan"] == mock_result.data

    @patch("cycling_ai.orchestration.phases.training_planning.FinalizePlanTool")
    def test_execute_finalize_tool_failure(self, mock_tool_class, mock_context_with_plan_id):
        """Phase 3c should handle tool execution failure."""
        # Mock tool failure
        mock_tool = Mock()
        mock_tool_class.return_value = mock_tool

        mock_result = ToolExecutionResult(
            success=False,
            data=None,
            format="text",
            errors=["Validation failed"],
        )
        mock_tool.execute.return_value = mock_result

        phase = TrainingPlanningPhase()
        result = phase._execute_phase_3c_finalize(mock_context_with_plan_id)

        assert result.status == PhaseStatus.FAILED
        assert "Validation failed" in result.errors

    def test_execute_finalize_missing_plan_id(self, mock_context_with_plan_id):
        """Phase 3c should fail if plan_id missing."""
        # Remove plan_id
        mock_context_with_plan_id.previous_phase_data.pop("plan_id")

        phase = TrainingPlanningPhase()

        with pytest.raises(ValueError, match="No plan_id found"):
            phase._execute_phase_3c_finalize(mock_context_with_plan_id)


class TestFullPhaseExecution:
    """Test full Phase 3 execution (all 3 sub-phases)."""

    @pytest.fixture
    def full_mock_context(self, tmp_path):
        """Create complete mock context for full execution."""
        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=2,  # Small for testing
            generate_training_plan=True,
        )

        # Create athlete profile
        import json
        profile_data = {
            "FTP": 260,
            "max_hr": 186,
            "weight": "70kg",
            "age": 35,
            "goals": ["Improve FTP"],
            "training_availability": {
                "week_days": "Monday, Wednesday, Friday",
                "hours_per_week": 6.0,
            },
        }
        with open(config.athlete_profile_path, "w") as f:
            json.dump(profile_data, f)

        context = PhaseContext(
            config=config,
            previous_phase_data={
                "athlete_profile_path": str(config.athlete_profile_path),
                "performance_data": {},
            },
            session_manager=Mock(),
            provider=Mock(),
            prompts_manager=Mock(),
            progress_callback=None,
        )

        return context

    @patch("cycling_ai.orchestration.phases.training_planning.FinalizePlanTool")
    @patch("cycling_ai.orchestration.phases.training_planning.LLMAgent")
    def test_execute_all_subphases_success(
        self, mock_agent_class, mock_finalize_tool, full_mock_context
    ):
        """Test successful execution of all 3 sub-phases."""
        # Mock Phase 3a (overview)
        mock_agent_3a = Mock()
        mock_agent_3b = Mock()

        def agent_side_effect(*args, **kwargs):
            # Return different agent instances for 3a and 3b
            if not hasattr(agent_side_effect, "call_count"):
                agent_side_effect.call_count = 0
            agent_side_effect.call_count += 1

            if agent_side_effect.call_count == 1:
                return mock_agent_3a
            else:
                return mock_agent_3b

        mock_agent_class.side_effect = agent_side_effect

        mock_agent_3a.process_message.return_value = "Overview created"
        mock_agent_3b.process_message.return_value = "Weeks added"

        # Mock sessions
        mock_session = Mock(spec=ConversationSession)
        mock_session.messages = []
        full_mock_context.session_manager.create_session.return_value = mock_session

        # Mock Phase 3c (finalize)
        mock_tool = Mock()
        mock_finalize_tool.return_value = mock_tool
        mock_tool.execute.return_value = ToolExecutionResult(
            success=True,
            data={"plan_id": "test_plan", "weeks": 2},
            format="json",
            metadata={"output_path": "/path/to/plan.json"},
        )

        phase = TrainingPlanningPhase()
        result = phase.execute(full_mock_context)

        assert result.status == PhaseStatus.COMPLETED
        assert result.phase_name == "training_planning"
        assert "training_plan" in result.extracted_data
        assert result.execution_time_seconds > 0

    @patch("cycling_ai.orchestration.phases.training_planning.LLMAgent")
    def test_execute_overview_fails_stops_workflow(self, mock_agent_class, full_mock_context):
        """If Phase 3a fails, should stop and not execute 3b/3c."""
        # Mock Phase 3a failure
        mock_agent = Mock()
        mock_agent_class.return_value = mock_agent
        mock_agent.process_message.side_effect = Exception("LLM error")

        # Mock session
        mock_session = Mock(spec=ConversationSession)
        mock_session.messages = []
        full_mock_context.session_manager.create_session.return_value = mock_session

        phase = TrainingPlanningPhase()
        result = phase.execute(full_mock_context)

        assert result.status == PhaseStatus.FAILED
        assert "error" in result.agent_response.lower() or len(result.errors) > 0

    def test_execute_missing_profile_fails(self, full_mock_context):
        """Phase should fail if athlete profile missing."""
        # Remove profile file
        full_mock_context.config.athlete_profile_path.unlink(missing_ok=True)

        phase = TrainingPlanningPhase()
        result = phase.execute(full_mock_context)

        assert result.status == PhaseStatus.FAILED


class TestContextValidation:
    """Test context validation."""

    def test_validate_context_success(self, tmp_path):
        """Should pass validation with valid context."""
        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=12,
            generate_training_plan=True,
        )

        # Create valid profile
        import json
        with open(config.athlete_profile_path, "w") as f:
            json.dump({
                "FTP": 260,
                "weight": "70kg",
                "training_availability": {
                    "week_days": "Monday",
                    "hours_per_week": 6.0,
                }
            }, f)

        context = PhaseContext(
            config=config,
            previous_phase_data={"athlete_profile_path": str(config.athlete_profile_path)},
            session_manager=Mock(),
            provider=Mock(),
            prompts_manager=Mock(),
            progress_callback=None,
        )

        phase = TrainingPlanningPhase()
        # Should not raise
        phase._validate_context(context)

    def test_validate_context_missing_profile_path(self):
        """Should fail if athlete_profile_path missing from context."""
        mock_config = Mock()
        mock_config.athlete_profile_path = Path("/nonexistent/profile.json")
        mock_config.generate_training_plan = True

        context = PhaseContext(
            config=mock_config,
            previous_phase_data={},  # Missing athlete_profile_path
            session_manager=Mock(),
            provider=Mock(),
            prompts_manager=Mock(),
            progress_callback=None,
        )

        phase = TrainingPlanningPhase()

        with pytest.raises(ValueError, match="athlete_profile_path"):
            phase._validate_context(context)
