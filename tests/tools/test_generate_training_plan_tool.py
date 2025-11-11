"""
Unit tests for GenerateTrainingPlanTool.

Tests the tool that enables chat to execute the full multi-agent workflow
for comprehensive training plan generation (all 4 phases).
"""
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from cycling_ai.orchestration.base import PhaseResult, PhaseStatus, WorkflowResult
from cycling_ai.tools.wrappers.generate_training_plan_tool import (
    GenerateTrainingPlanTool,
)


class TestGenerateTrainingPlanToolDefinition:
    """Test suite for tool definition."""

    def test_tool_name(self) -> None:
        """Test tool has correct name."""
        tool = GenerateTrainingPlanTool()
        assert tool.definition.name == "generate_complete_training_plan"

    def test_tool_description(self) -> None:
        """Test tool has meaningful description."""
        tool = GenerateTrainingPlanTool()
        assert len(tool.definition.description) > 100
        assert "multi-agent" in tool.definition.description.lower()
        assert "4 phases" in tool.definition.description.lower()

    def test_required_parameters(self) -> None:
        """Test tool defines required parameters."""
        tool = GenerateTrainingPlanTool()
        param_names = {p.name for p in tool.definition.parameters}

        # Must have these essential parameters
        assert "csv_file_path" in param_names
        assert "athlete_profile_path" in param_names

    def test_optional_parameters(self) -> None:
        """Test tool defines optional parameters."""
        tool = GenerateTrainingPlanTool()
        param_names = {p.name for p in tool.definition.parameters}

        # Should have these optional parameters
        assert "fit_dir_path" in param_names
        assert "training_plan_weeks" in param_names
        assert "workout_source" in param_names
        assert "period_months" in param_names


class TestGenerateTrainingPlanToolExecution:
    """Test suite for tool execution."""

    def test_execute_with_minimal_parameters(self, tmp_path: Path) -> None:
        """Test execution with only required parameters."""
        # Create test files
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265, "max_hr": 186}')

        # Create mock provider
        mock_provider = Mock()

        # Mock the workflow execution
        mock_result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Data prepared",
                    extracted_data={"cache_file": "cache.parquet"},
                ),
                PhaseResult(
                    phase_name="performance_analysis",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Analysis complete",
                    extracted_data={"performance_data": {}},
                ),
                PhaseResult(
                    phase_name="training_planning",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Plan created",
                    extracted_data={"training_plan": {}},
                ),
                PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Report data ready",
                    extracted_data={"report_json_path": "report_data.json"},
                ),
            ],
            total_execution_time_seconds=120.0,
            total_tokens_used=5000,
            output_files=[],
        )

        with patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.MultiAgentOrchestrator"
        ) as mock_orchestrator_class, patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.AgentPromptsManager"
        ) as mock_prompts_class, patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.SessionManager"
        ) as mock_session_class:
            mock_orchestrator = Mock()
            mock_orchestrator.execute_workflow.return_value = mock_result
            mock_orchestrator_class.return_value = mock_orchestrator

            tool = GenerateTrainingPlanTool()
            result = tool.execute(
                csv_file_path=str(csv_file),
                athlete_profile_path=str(profile_file),
                session_context={"provider": mock_provider},
            )

            assert result.success is True
            assert "report_json_path" in result.data
            assert result.format == "json"

    def test_execute_with_all_parameters(self, tmp_path: Path) -> None:
        """Test execution with all parameters specified."""
        # Create test files
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265, "max_hr": 186}')

        fit_dir = tmp_path / "fit_files"
        fit_dir.mkdir()

        output_dir = tmp_path / "output"
        output_dir.mkdir()

        # Create mock provider
        mock_provider = Mock()

        # Mock the workflow execution
        mock_result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Data prepared",
                    extracted_data={},
                ),
                PhaseResult(
                    phase_name="performance_analysis",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Analysis complete",
                    extracted_data={},
                ),
                PhaseResult(
                    phase_name="training_planning",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Plan created",
                    extracted_data={},
                ),
                PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Report ready",
                    extracted_data={"report_json_path": "report_data.json"},
                ),
            ],
            total_execution_time_seconds=180.0,
            total_tokens_used=8000,
            output_files=[],
        )

        with patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.MultiAgentOrchestrator"
        ) as mock_orchestrator_class, patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.AgentPromptsManager"
        ), patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.SessionManager"
        ):
            mock_orchestrator = Mock()
            mock_orchestrator.execute_workflow.return_value = mock_result
            mock_orchestrator_class.return_value = mock_orchestrator

            tool = GenerateTrainingPlanTool()
            result = tool.execute(
                csv_file_path=str(csv_file),
                athlete_profile_path=str(profile_file),
                fit_dir_path=str(fit_dir),
                output_dir=str(output_dir),
                training_plan_weeks=16,
                workout_source="library",
                period_months=12,
                session_context={"provider": mock_provider},
            )

            assert result.success is True
            # Verify workflow config was created with correct parameters
            call_args = mock_orchestrator.execute_workflow.call_args
            config = call_args[0][0]
            assert config.training_plan_weeks == 16
            assert config.workout_source == "library"
            assert config.period_months == 12

    def test_execute_missing_csv_file(self, tmp_path: Path) -> None:
        """Test execution fails when CSV file doesn't exist."""
        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265}')

        # Create mock provider
        mock_provider = Mock()

        tool = GenerateTrainingPlanTool()
        result = tool.execute(
            csv_file_path="/nonexistent/file.csv",
            athlete_profile_path=str(profile_file),
            session_context={"provider": mock_provider},
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_execute_missing_profile(self, tmp_path: Path) -> None:
        """Test execution fails when profile doesn't exist."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        # Create mock provider
        mock_provider = Mock()

        tool = GenerateTrainingPlanTool()
        result = tool.execute(
            csv_file_path=str(csv_file),
            athlete_profile_path="/nonexistent/profile.json",
            session_context={"provider": mock_provider},
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_execute_workflow_failure(self, tmp_path: Path) -> None:
        """Test handles workflow execution failure gracefully."""
        # Create test files
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265, "max_hr": 186}')

        # Create mock provider
        mock_provider = Mock()

        # Mock workflow failure
        mock_result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="data_preparation",
                    status=PhaseStatus.FAILED,
                    agent_response="Failed",
                    errors=["Data preparation failed"],
                )
            ],
            total_execution_time_seconds=30.0,
            total_tokens_used=500,
            output_files=[],
        )

        with patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.MultiAgentOrchestrator"
        ) as mock_orchestrator_class:
            mock_orchestrator = Mock()
            mock_orchestrator.execute_workflow.return_value = mock_result
            mock_orchestrator_class.return_value = mock_orchestrator

            tool = GenerateTrainingPlanTool()
            result = tool.execute(
                csv_file_path=str(csv_file),
                athlete_profile_path=str(profile_file),
                session_context={"provider": mock_provider},
            )

            assert result.success is False
            assert len(result.errors) > 0

    def test_execute_uses_session_context_for_provider(
        self, tmp_path: Path
    ) -> None:
        """Test tool uses provider from session context if available."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265, "max_hr": 186}')

        # Create a mock provider
        mock_provider = Mock()

        # Mock successful workflow
        mock_result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Done",
                    extracted_data={"report_json_path": "report.json"},
                )
            ],
            total_execution_time_seconds=60.0,
            total_tokens_used=3000,
            output_files=[],
        )

        with patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.MultiAgentOrchestrator"
        ) as mock_orchestrator_class, patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.AgentPromptsManager"
        ), patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.SessionManager"
        ):
            mock_orchestrator = Mock()
            mock_orchestrator.execute_workflow.return_value = mock_result
            mock_orchestrator_class.return_value = mock_orchestrator

            tool = GenerateTrainingPlanTool()
            result = tool.execute(
                csv_file_path=str(csv_file),
                athlete_profile_path=str(profile_file),
                session_context={"provider": mock_provider},
            )

            # Verify orchestrator was created with the provider from session
            assert mock_orchestrator_class.called
            call_kwargs = mock_orchestrator_class.call_args[1]
            assert call_kwargs["provider"] == mock_provider

    def test_execute_defaults_training_plan_weeks(self, tmp_path: Path) -> None:
        """Test default value for training_plan_weeks parameter."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265, "max_hr": 186}')

        # Create mock provider
        mock_provider = Mock()

        mock_result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Done",
                    extracted_data={"report_json_path": "report.json"},
                )
            ],
            total_execution_time_seconds=90.0,
            total_tokens_used=4000,
            output_files=[],
        )

        with patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.MultiAgentOrchestrator"
        ) as mock_orchestrator_class, patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.AgentPromptsManager"
        ), patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.SessionManager"
        ):
            mock_orchestrator = Mock()
            mock_orchestrator.execute_workflow.return_value = mock_result
            mock_orchestrator_class.return_value = mock_orchestrator

            tool = GenerateTrainingPlanTool()
            result = tool.execute(
                csv_file_path=str(csv_file),
                athlete_profile_path=str(profile_file),
                session_context={"provider": mock_provider},
            )

            # Verify default weeks was used
            call_args = mock_orchestrator.execute_workflow.call_args
            config = call_args[0][0]
            assert config.training_plan_weeks == 12  # Default value


class TestGenerateTrainingPlanToolIntegration:
    """Integration tests with session context."""

    def test_tool_can_get_profile_from_session(self, tmp_path: Path) -> None:
        """Test tool can use profile_path from session context."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 265, "max_hr": 186}')

        # Create mock provider
        mock_provider = Mock()

        mock_result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.COMPLETED,
                    agent_response="Done",
                    extracted_data={"report_json_path": "report.json"},
                )
            ],
            total_execution_time_seconds=100.0,
            total_tokens_used=4500,
            output_files=[],
        )

        with patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.MultiAgentOrchestrator"
        ) as mock_orchestrator_class, patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.AgentPromptsManager"
        ), patch(
            "cycling_ai.tools.wrappers.generate_training_plan_tool.SessionManager"
        ):
            mock_orchestrator = Mock()
            mock_orchestrator.execute_workflow.return_value = mock_result
            mock_orchestrator_class.return_value = mock_orchestrator

            tool = GenerateTrainingPlanTool()

            # Profile path comes from session context
            result = tool.execute(
                csv_file_path=str(csv_file),
                session_context={
                    "profile_path": str(profile_file),
                    "provider": mock_provider,
                },
            )

            assert result.success is True
            # Verify profile was used from session
            call_args = mock_orchestrator.execute_workflow.call_args
            config = call_args[0][0]
            assert config.athlete_profile_path == profile_file
