"""
Unit tests for BaseWorkflow abstract class.

Tests the template method pattern and helper methods.
"""

from __future__ import annotations

import pytest
from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import Mock, MagicMock

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)
from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
from cycling_ai.orchestration.phases.base_phase import BasePhase


class ConcretePhase(BasePhase):
    """Concrete phase for testing."""

    def __init__(self, phase_name: str = "test_phase"):
        super().__init__(phase_name=phase_name, required_tools=["test_tool"])

    def _get_system_prompt(
        self, config: WorkflowConfig, previous_phase_data: dict[str, Any]
    ) -> str:
        return "Test system prompt"

    def _get_user_message(
        self, config: WorkflowConfig, previous_phase_data: dict[str, Any]
    ) -> str:
        return "Test user message"

    def _extract_data(self, session: Any) -> dict[str, Any]:
        return {"test_key": "test_value"}


class ConcreteWorkflow(BaseWorkflow):
    """Concrete workflow for testing."""

    def __init__(self, phases: list[BasePhase] | None = None, **kwargs):
        super().__init__(**kwargs)
        self._phases = phases or [ConcretePhase("phase1"), ConcretePhase("phase2")]

    def get_phases(self) -> list[BasePhase]:
        return self._phases

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """Test implementation of workflow execution."""
        config.validate()
        workflow_start = datetime.now()
        phase_results = []
        previous_data: dict[str, Any] = {}
        total_tokens = 0

        for phase in self.get_phases():
            # Create context with a copy to avoid mutation issues
            context = self._create_phase_context(config, previous_data.copy())
            result = phase.execute(context)
            phase_results.append(result)

            if not result.success:
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )

            previous_data.update(result.extracted_data)
            total_tokens += result.tokens_used

        total_time = (datetime.now() - workflow_start).total_seconds()
        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=[],
        )


class TestBaseWorkflowInitialization:
    """Test BaseWorkflow initialization."""

    def test_init_with_all_parameters(self, tmp_path: Path):
        """Test initialization with all parameters provided."""
        provider = Mock()
        prompts_manager = Mock()
        session_manager = Mock()
        progress_callback = Mock()

        workflow = ConcreteWorkflow(
            provider=provider,
            prompts_manager=prompts_manager,
            session_manager=session_manager,
            progress_callback=progress_callback,
        )

        assert workflow.provider == provider
        assert workflow.prompts_manager == prompts_manager
        assert workflow.session_manager == session_manager
        assert workflow.progress_callback == progress_callback

    def test_init_creates_default_managers(self):
        """Test that default managers are created if not provided."""
        provider = Mock()
        workflow = ConcreteWorkflow(provider=provider)

        assert workflow.provider == provider
        assert workflow.prompts_manager is not None
        assert workflow.session_manager is not None
        assert workflow.progress_callback is None


class TestCreatePhaseContext:
    """Test _create_phase_context helper method."""

    def test_create_phase_context_with_empty_previous_data(self, tmp_path: Path):
        """Test creating phase context with no previous phase data."""
        provider = Mock()
        prompts_manager = Mock()
        session_manager = Mock()

        workflow = ConcreteWorkflow(
            provider=provider,
            prompts_manager=prompts_manager,
            session_manager=session_manager,
        )

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        # Create profile file so validation passes
        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        previous_data: dict[str, Any] = {}
        context = workflow._create_phase_context(config, previous_data)

        assert isinstance(context, PhaseContext)
        assert context.config == config
        assert context.previous_phase_data == {}
        assert context.provider == provider
        assert context.prompts_manager == prompts_manager
        assert context.session_manager == session_manager
        assert context.progress_callback is None

    def test_create_phase_context_with_previous_data(self, tmp_path: Path):
        """Test creating phase context with previous phase data."""
        provider = Mock()
        workflow = ConcreteWorkflow(provider=provider)

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        # Create required files
        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        previous_data = {
            "cache_file_path": str(tmp_path / "cache.parquet"),
            "performance_data": {"metric": "value"},
        }

        context = workflow._create_phase_context(config, previous_data)

        assert context.previous_phase_data == previous_data
        assert "cache_file_path" in context.previous_phase_data
        assert "performance_data" in context.previous_phase_data

    def test_create_phase_context_with_progress_callback(self, tmp_path: Path):
        """Test that progress callback is passed to context."""
        provider = Mock()
        progress_callback = Mock()

        workflow = ConcreteWorkflow(
            provider=provider, progress_callback=progress_callback
        )

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        context = workflow._create_phase_context(config, {})

        assert context.progress_callback == progress_callback


class TestCreateFailedWorkflowResult:
    """Test _create_failed_workflow_result helper method."""

    def test_create_failed_workflow_result(self):
        """Test creating failed workflow result."""
        provider = Mock()
        workflow = ConcreteWorkflow(provider=provider)

        phase_results = [
            PhaseResult(
                phase_name="phase1",
                status=PhaseStatus.COMPLETED,
                agent_response="Success",
                extracted_data={"key": "value"},
                execution_time_seconds=1.5,
                tokens_used=100,
            ),
            PhaseResult(
                phase_name="phase2",
                status=PhaseStatus.FAILED,
                agent_response="",
                errors=["Test error"],
                execution_time_seconds=0.5,
                tokens_used=50,
            ),
        ]

        workflow_start = datetime.now()
        total_tokens = 150

        result = workflow._create_failed_workflow_result(
            phase_results, workflow_start, total_tokens
        )

        assert isinstance(result, WorkflowResult)
        assert len(result.phase_results) == 2
        assert result.total_tokens_used == total_tokens
        assert result.total_execution_time_seconds > 0
        assert result.output_files == []
        assert result.success is False  # Because phase2 failed

    def test_create_failed_workflow_result_single_failure(self):
        """Test failed result with single failing phase."""
        provider = Mock()
        workflow = ConcreteWorkflow(provider=provider)

        phase_results = [
            PhaseResult(
                phase_name="phase1",
                status=PhaseStatus.FAILED,
                agent_response="",
                errors=["Validation error"],
                execution_time_seconds=0.1,
                tokens_used=0,
            )
        ]

        result = workflow._create_failed_workflow_result(
            phase_results, datetime.now(), 0
        )

        assert not result.success
        assert len(result.phase_results) == 1
        assert result.phase_results[0].status == PhaseStatus.FAILED


class TestGetPhasesAbstractMethod:
    """Test that get_phases is abstract and must be implemented."""

    def test_cannot_instantiate_base_workflow_directly(self):
        """Test that BaseWorkflow cannot be instantiated directly."""
        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            BaseWorkflow(provider=Mock())  # type: ignore


class TestConcreteWorkflowImplementation:
    """Test concrete workflow implementation."""

    def test_get_phases_returns_phase_list(self):
        """Test that get_phases returns list of phases."""
        phase1 = ConcretePhase("phase1")
        phase2 = ConcretePhase("phase2")

        workflow = ConcreteWorkflow(phases=[phase1, phase2], provider=Mock())

        phases = workflow.get_phases()

        assert len(phases) == 2
        assert phases[0] == phase1
        assert phases[1] == phase2

    def test_execute_workflow_runs_all_phases(self, tmp_path: Path):
        """Test that execute_workflow runs all phases in sequence."""
        # Create mock phases that succeed
        phase1 = Mock(spec=BasePhase)
        phase1.execute.return_value = PhaseResult(
            phase_name="phase1",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 1 complete",
            extracted_data={"phase1_data": "value1"},
            tokens_used=100,
        )

        phase2 = Mock(spec=BasePhase)
        phase2.execute.return_value = PhaseResult(
            phase_name="phase2",
            status=PhaseStatus.COMPLETED,
            agent_response="Phase 2 complete",
            extracted_data={"phase2_data": "value2"},
            tokens_used=150,
        )

        workflow = ConcreteWorkflow(phases=[phase1, phase2], provider=Mock())

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        result = workflow.execute_workflow(config)

        # Verify both phases were executed
        assert phase1.execute.called
        assert phase2.execute.called

        # Verify workflow result
        assert result.success
        assert len(result.phase_results) == 2
        assert result.total_tokens_used == 250

    def test_execute_workflow_stops_on_first_failure(self, tmp_path: Path):
        """Test that workflow stops when a phase fails."""
        # Phase 1 fails
        phase1 = Mock(spec=BasePhase)
        phase1.execute.return_value = PhaseResult(
            phase_name="phase1",
            status=PhaseStatus.FAILED,
            agent_response="",
            errors=["Phase 1 failed"],
            tokens_used=50,
        )

        # Phase 2 should not be executed
        phase2 = Mock(spec=BasePhase)

        workflow = ConcreteWorkflow(phases=[phase1, phase2], provider=Mock())

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        result = workflow.execute_workflow(config)

        # Phase 1 executed
        assert phase1.execute.called

        # Phase 2 NOT executed
        assert not phase2.execute.called

        # Workflow failed
        assert not result.success
        assert len(result.phase_results) == 1


class TestContextAccumulation:
    """Test that data accumulates correctly between phases."""

    def test_data_flows_from_phase1_to_phase2(self, tmp_path: Path):
        """Test that phase 2 receives data from phase 1."""
        phase1_context = None
        phase2_context = None

        # Phase 1 returns some data
        phase1 = Mock(spec=BasePhase)

        def phase1_execute(ctx):
            nonlocal phase1_context
            phase1_context = ctx
            return PhaseResult(
                phase_name="phase1",
                status=PhaseStatus.COMPLETED,
                agent_response="Phase 1 complete",
                extracted_data={"cache_path": "/tmp/cache.parquet"},
                tokens_used=100,
            )

        phase1.execute.side_effect = phase1_execute

        # Phase 2 should receive phase 1 data
        phase2 = Mock(spec=BasePhase)

        def phase2_execute(ctx):
            nonlocal phase2_context
            phase2_context = ctx
            return PhaseResult(
                phase_name="phase2",
                status=PhaseStatus.COMPLETED,
                agent_response="Phase 2 complete",
                extracted_data={"analysis": {"metric": "value"}},
                tokens_used=150,
            )

        phase2.execute.side_effect = phase2_execute

        workflow = ConcreteWorkflow(phases=[phase1, phase2], provider=Mock())

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=tmp_path / "fit",
        )

        config.athlete_profile_path.write_text("{}")
        (tmp_path / "fit").mkdir()

        workflow.execute_workflow(config)

        # Phase 1 context should have empty previous data
        assert phase1_context is not None
        assert phase1_context.previous_phase_data == {}

        # Phase 2 context should have phase 1 data
        assert phase2_context is not None
        assert "cache_path" in phase2_context.previous_phase_data
        assert phase2_context.previous_phase_data["cache_path"] == "/tmp/cache.parquet"
