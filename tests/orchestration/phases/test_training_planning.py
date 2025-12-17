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
        import json

        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=12,
            generate_training_plan=True,
        )

        # Create athlete profile file
        profile_data = {
            "FTP": 260,
            "max_hr": 186,
            "weight": "70kg",
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
        provider.config.provider_name = "mock"
        prompts_manager = Mock()
        prompts_manager.get_training_planning_overview_prompt.return_value = "System prompt"
        prompts_manager.get_training_planning_overview_user_prompt.return_value = "User prompt"

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

    @patch("cycling_ai.orchestration.phases.training_planning.AgentFactory")
    def test_execute_overview_subphase_success(self, mock_agent_factory, mock_context):
        """Phase 3a should successfully create plan overview."""
        import json

        # Mock agent
        mock_agent = Mock()
        mock_agent_factory.create_agent.return_value = mock_agent
        mock_agent.process_message.return_value = "Plan overview created"

        # Create mock session with proper tool result structure
        mock_message = Mock()
        mock_message.role = "tool"
        mock_message.content = json.dumps({"plan_id": "test_plan_123"})
        mock_message.tool_results = [{"success": True, "tool_name": "create_plan_overview"}]

        mock_session = Mock(spec=ConversationSession)
        mock_session.messages = [mock_message]
        mock_session.get_total_tokens.return_value = 1000
        mock_context.session_manager.create_session.return_value = mock_session

        phase = TrainingPlanningPhase()
        result = phase._execute_phase_3a_overview(mock_context)

        assert result.phase_name == "training_planning_overview"
        assert result.status == PhaseStatus.COMPLETED
        assert "plan_id" in result.extracted_data
        assert result.extracted_data["plan_id"] == "test_plan_123"

    def test_execute_overview_missing_ftp(self, mock_context):
        """Phase 3a should fail if FTP missing from profile."""
        # Mock athlete profile without FTP
        mock_profile = Mock()
        mock_profile.ftp = None  # Missing FTP!
        mock_profile.get_training_days.return_value = ["Monday", "Wednesday", "Friday"]
        mock_profile.get_weekly_training_hours.return_value = 8.0

        phase = TrainingPlanningPhase()

        # Patch at source module since import is local within the function
        with patch(
            "cycling_ai.core.athlete.load_athlete_profile",
            return_value=mock_profile,
        ):
            with pytest.raises(ValueError, match="(does not have a valid FTP|FTP.*required)"):
                phase._execute_phase_3a_overview(mock_context)

    def test_execute_overview_missing_training_days(self, mock_context):
        """Phase 3a should fail if no training days specified."""
        # Mock athlete profile with no available days
        mock_profile = Mock()
        mock_profile.ftp = 260
        mock_profile.get_training_days.return_value = []  # No days!
        mock_profile.get_weekly_training_hours.return_value = 8.0

        phase = TrainingPlanningPhase()

        # Patch at source module since import is local within the function
        with patch(
            "cycling_ai.core.athlete.load_athlete_profile",
            return_value=mock_profile,
        ):
            with pytest.raises(ValueError, match="(does not specify available training days|training days|available days)"):
                phase._execute_phase_3a_overview(mock_context)


class TestPhase3bWeeksSubphase:
    """Test Phase 3b: Weekly workout details generation."""

    @pytest.fixture
    def mock_context_with_plan_id(self, tmp_path):
        """Create context with plan_id from Phase 3a."""
        import json

        plan_id = "test_plan_123"

        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=2,  # Small number for testing
            generate_training_plan=True,
        )

        # Create athlete profile
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

        # Create the overview file that Phase 3b expects
        overview_data = {
            "weekly_overview": [
                {
                    "week_number": 1,
                    "phase": "Base",
                    "total_hours": 6.0,
                    "target_tss": 300,
                    "training_days": [
                        {"weekday": "Monday", "workout_types": ["endurance"]},
                        {"weekday": "Tuesday", "workout_types": ["rest"]},
                        {"weekday": "Wednesday", "workout_types": ["sweetspot"]},
                        {"weekday": "Thursday", "workout_types": ["rest"]},
                        {"weekday": "Friday", "workout_types": ["recovery"]},
                        {"weekday": "Saturday", "workout_types": ["rest"]},
                        {"weekday": "Sunday", "workout_types": ["rest"]},
                    ],
                },
                {
                    "week_number": 2,
                    "phase": "Base",
                    "total_hours": 6.5,
                    "target_tss": 320,
                    "training_days": [
                        {"weekday": "Monday", "workout_types": ["endurance"]},
                        {"weekday": "Tuesday", "workout_types": ["rest"]},
                        {"weekday": "Wednesday", "workout_types": ["sweetspot"]},
                        {"weekday": "Thursday", "workout_types": ["rest"]},
                        {"weekday": "Friday", "workout_types": ["recovery"]},
                        {"weekday": "Saturday", "workout_types": ["rest"]},
                        {"weekday": "Sunday", "workout_types": ["rest"]},
                    ],
                },
            ]
        }
        overview_file = Path("/tmp") / f"{plan_id}_overview.json"
        with open(overview_file, "w") as f:
            json.dump(overview_data, f)

        session_manager = Mock(spec=SessionManager)
        provider = Mock()
        provider.config.provider_name = "mock"
        prompts_manager = Mock()
        prompts_manager.get_training_planning_weeks_prompt.return_value = "System prompt"
        prompts_manager.get_training_planning_weeks_user_prompt.return_value = "User prompt"

        context = PhaseContext(
            config=config,
            previous_phase_data={
                "plan_id": plan_id,
                "athlete_profile_path": str(config.athlete_profile_path),
            },
            session_manager=session_manager,
            provider=provider,
            prompts_manager=prompts_manager,
            progress_callback=None,
        )

        yield context

        # Cleanup
        if overview_file.exists():
            overview_file.unlink()

    @patch("cycling_ai.orchestration.phases.training_planning.AgentFactory")
    def test_execute_weeks_subphase_success(self, mock_agent_factory, mock_context_with_plan_id):
        """Phase 3b should successfully add weekly details."""
        import json

        # Mock agent
        mock_agent = Mock()
        mock_agent_factory.create_agent.return_value = mock_agent
        mock_agent.process_message.return_value = "Week details added"

        # Create mock session with proper tool result structure for each week
        def create_week_session(week_num):
            mock_message = Mock()
            mock_message.role = "tool"
            mock_message.content = json.dumps({"week_number": week_num})
            mock_message.tool_results = [{"success": True, "tool_name": "add_week_details"}]

            mock_session = Mock(spec=ConversationSession)
            mock_session.messages = [mock_message]
            mock_session.get_total_tokens.return_value = 500
            return mock_session

        # Return fresh session for each week
        session_count = [0]

        def create_session_side_effect(*args, **kwargs):
            session_count[0] += 1
            return create_week_session(session_count[0])

        mock_context_with_plan_id.session_manager.create_session.side_effect = create_session_side_effect

        phase = TrainingPlanningPhase()
        result = phase._execute_phase_3b_weeks(mock_context_with_plan_id)

        assert result.phase_name == "training_planning_weeks"
        assert result.status == PhaseStatus.COMPLETED
        assert "weeks_added" in result.extracted_data
        assert len(result.extracted_data["weeks_added"]) == 2

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
        import json

        plan_id = "test_full_plan"

        config = WorkflowConfig(
            athlete_profile_path=tmp_path / "athlete_profile.json",
            csv_file_path=tmp_path / "activities.csv",
            output_dir=tmp_path / "output",
            training_plan_weeks=2,  # Small for testing
            generate_training_plan=True,
            workout_source="llm",  # Use LLM-based path for this test
        )

        # Create athlete profile
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

        # Set up prompts_manager with all required methods
        prompts_manager = Mock()
        prompts_manager.get_training_planning_overview_prompt.return_value = "System"
        prompts_manager.get_training_planning_overview_user_prompt.return_value = "User"
        prompts_manager.get_training_planning_weeks_prompt.return_value = "System"
        prompts_manager.get_training_planning_weeks_user_prompt.return_value = "User"

        # Set up provider
        provider = Mock()
        provider.config.provider_name = "mock"

        context = PhaseContext(
            config=config,
            previous_phase_data={
                "athlete_profile_path": str(config.athlete_profile_path),
                "performance_data": {},
            },
            session_manager=Mock(spec=SessionManager),
            provider=provider,
            prompts_manager=prompts_manager,
            progress_callback=None,
        )

        # Store plan_id for use in tests
        context._test_plan_id = plan_id

        yield context

        # Cleanup any overview files
        overview_file = Path("/tmp") / f"{plan_id}_overview.json"
        if overview_file.exists():
            overview_file.unlink()

    @patch("cycling_ai.orchestration.phases.training_planning.FinalizePlanTool")
    @patch("cycling_ai.orchestration.phases.training_planning.AgentFactory")
    def test_execute_all_subphases_success(
        self, mock_agent_factory, mock_finalize_tool, full_mock_context
    ):
        """Test successful execution of all 3 sub-phases."""
        import json

        plan_id = full_mock_context._test_plan_id

        # Mock agent
        mock_agent = Mock()
        mock_agent_factory.create_agent.return_value = mock_agent
        mock_agent.process_message.return_value = "Success"

        # Create session factory to return different sessions
        session_call_count = [0]

        def create_session_side_effect(*args, **kwargs):
            session_call_count[0] += 1
            mock_session = Mock(spec=ConversationSession)
            mock_session.get_total_tokens.return_value = 500

            if session_call_count[0] == 1:
                # Phase 3a session - return plan_id
                mock_message = Mock()
                mock_message.role = "tool"
                mock_message.content = json.dumps({"plan_id": plan_id})
                mock_message.tool_results = [{"success": True, "tool_name": "create_plan_overview"}]
                mock_session.messages = [mock_message]

                # Create overview file for Phase 3b
                overview_data = {
                    "weekly_overview": [
                        {
                            "week_number": 1,
                            "phase": "Base",
                            "total_hours": 6.0,
                            "target_tss": 300,
                            "training_days": [
                                {"weekday": "Monday", "workout_types": ["endurance"]},
                                {"weekday": "Tuesday", "workout_types": ["rest"]},
                                {"weekday": "Wednesday", "workout_types": ["sweetspot"]},
                                {"weekday": "Thursday", "workout_types": ["rest"]},
                                {"weekday": "Friday", "workout_types": ["recovery"]},
                                {"weekday": "Saturday", "workout_types": ["rest"]},
                                {"weekday": "Sunday", "workout_types": ["rest"]},
                            ],
                        },
                        {
                            "week_number": 2,
                            "phase": "Base",
                            "total_hours": 6.5,
                            "target_tss": 320,
                            "training_days": [
                                {"weekday": "Monday", "workout_types": ["endurance"]},
                                {"weekday": "Tuesday", "workout_types": ["rest"]},
                                {"weekday": "Wednesday", "workout_types": ["sweetspot"]},
                                {"weekday": "Thursday", "workout_types": ["rest"]},
                                {"weekday": "Friday", "workout_types": ["recovery"]},
                                {"weekday": "Saturday", "workout_types": ["rest"]},
                                {"weekday": "Sunday", "workout_types": ["rest"]},
                            ],
                        },
                    ]
                }
                overview_file = Path("/tmp") / f"{plan_id}_overview.json"
                with open(overview_file, "w") as f:
                    json.dump(overview_data, f)
            else:
                # Phase 3b sessions - return week numbers
                week_num = session_call_count[0] - 1
                mock_message = Mock()
                mock_message.role = "tool"
                mock_message.content = json.dumps({"week_number": week_num})
                mock_message.tool_results = [{"success": True, "tool_name": "add_week_details"}]
                mock_session.messages = [mock_message]

            return mock_session

        full_mock_context.session_manager.create_session.side_effect = create_session_side_effect

        # Mock Phase 3c (finalize)
        mock_tool = Mock()
        mock_finalize_tool.return_value = mock_tool
        mock_tool.execute.return_value = ToolExecutionResult(
            success=True,
            data={"plan_id": plan_id, "weeks": 2},
            format="json",
            metadata={"output_path": "/path/to/plan.json"},
        )

        phase = TrainingPlanningPhase()
        result = phase.execute(full_mock_context)

        assert result.status == PhaseStatus.COMPLETED
        assert result.phase_name == "training_planning"
        assert "training_plan" in result.extracted_data
        assert result.execution_time_seconds > 0

    @patch("cycling_ai.orchestration.phases.training_planning.AgentFactory")
    def test_execute_overview_fails_stops_workflow(self, mock_agent_factory, full_mock_context):
        """If Phase 3a fails, should stop and not execute 3b/3c."""
        # Mock Phase 3a failure
        mock_agent = Mock()
        mock_agent_factory.create_agent.return_value = mock_agent
        mock_agent.process_message.side_effect = Exception("LLM error")

        # Mock session
        mock_session = Mock(spec=ConversationSession)
        mock_session.messages = []
        mock_session.get_total_tokens.return_value = 100
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
