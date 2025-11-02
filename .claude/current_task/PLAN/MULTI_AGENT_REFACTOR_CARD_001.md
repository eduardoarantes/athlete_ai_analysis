# CARD_001: Extract Base Classes

**Status:** Ready for Implementation
**Estimated Time:** 1 hour
**Priority:** Critical (Foundation)
**Dependencies:** None

---

## Objective

Extract shared data classes from `multi_agent.py` into `orchestration/base.py` to establish the foundation for phase extraction. This creates a clean separation between data structures and execution logic.

---

## Changes Required

### 1. Create New File: `src/cycling_ai/orchestration/base.py`

Extract the following classes from `multi_agent.py`:

```python
"""
Base classes for multi-agent orchestration.

Shared data structures used across phases and workflows.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable

# Re-export classes that are part of public API
__all__ = [
    "PhaseStatus",
    "PhaseResult",
    "WorkflowConfig",
    "WorkflowResult",
    "PhaseContext",
]


class PhaseStatus(Enum):
    """
    Status of a workflow phase.

    A phase progresses through states:
    PENDING → IN_PROGRESS → (COMPLETED | FAILED | SKIPPED)
    """
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class PhaseResult:
    """
    Result from executing a single workflow phase.

    Contains both the agent's response and extracted structured data
    that can be passed to subsequent phases.

    Attributes:
        phase_name: Identifier for this phase (e.g., "data_preparation")
        status: Execution status of the phase
        agent_response: Natural language response from the agent
        extracted_data: Structured data extracted from tool results
        errors: List of error messages (if any)
        execution_time_seconds: Time taken to execute this phase
        tokens_used: Estimated token count for cost tracking
    """
    phase_name: str
    status: PhaseStatus
    agent_response: str
    extracted_data: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    execution_time_seconds: float = 0.0
    tokens_used: int = 0

    @property
    def success(self) -> bool:
        """Whether phase completed successfully."""
        return self.status == PhaseStatus.COMPLETED

    def to_dict(self) -> dict[str, Any]:
        """
        Convert to dictionary for serialization.

        Returns:
            Dictionary representation suitable for JSON serialization
        """
        return {
            "phase_name": self.phase_name,
            "status": self.status.value,
            "agent_response": self.agent_response,
            "extracted_data": self.extracted_data,
            "errors": self.errors,
            "execution_time_seconds": self.execution_time_seconds,
            "tokens_used": self.tokens_used,
        }


@dataclass
class WorkflowConfig:
    """
    Configuration for multi-agent workflow.

    Defines inputs, outputs, and execution parameters for the workflow.

    Attributes:
        csv_file_path: Path to Strava activities CSV export (optional)
        athlete_profile_path: Path to athlete profile JSON
        fit_dir_path: Optional path to directory containing FIT files
        output_dir: Directory for generated reports
        period_months: Number of months for performance comparison
        generate_training_plan: Whether to generate training plan (Phase 3)
        training_plan_weeks: Number of weeks for training plan
        fit_only_mode: If True, build activities DataFrame from FIT files
        analyze_cross_training: Whether to analyze cross-training impact
        provider: LLM provider instance
        max_iterations_per_phase: Maximum tool execution loops per phase
        prompts_dir: Optional directory with custom prompt files
    """
    # Input paths (required fields first)
    csv_file_path: Path | None
    athlete_profile_path: Path
    training_plan_weeks: int

    # Input paths (with defaults)
    fit_dir_path: Path | None = None

    # Output paths
    output_dir: Path = field(default_factory=lambda: Path("./reports"))

    # Execution parameters
    period_months: int = 6
    generate_training_plan: bool = True
    fit_only_mode: bool = False
    skip_data_prep: bool = False

    # Cross-training analysis
    analyze_cross_training: bool | None = None

    # Provider configuration
    provider: Any = None  # BaseProvider, but avoid circular import
    max_iterations_per_phase: int = 5

    # Prompts configuration
    prompts_dir: Path | None = None

    def validate(self) -> None:
        """
        Validate configuration.

        Raises:
            ValueError: If configuration is invalid
        """
        # Validate that we have either CSV or FIT directory
        if self.csv_file_path is None and self.fit_dir_path is None:
            raise ValueError("Either csv_file_path or fit_dir_path must be provided")

        # Validate CSV file if provided
        if self.csv_file_path is not None and not self.csv_file_path.exists():
            raise ValueError(f"CSV file not found: {self.csv_file_path}")

        # Validate athlete profile
        if not self.athlete_profile_path.exists():
            raise ValueError(f"Athlete profile not found: {self.athlete_profile_path}")

        # Validate FIT directory if provided
        if self.fit_dir_path and not self.fit_dir_path.is_dir():
            raise ValueError(f"FIT directory not found: {self.fit_dir_path}")

        # Validate FIT-only mode requirements
        if self.fit_only_mode and self.csv_file_path is not None:
            raise ValueError("fit_only_mode=True but csv_file_path was provided")

        if self.fit_only_mode and self.fit_dir_path is None:
            raise ValueError("fit_only_mode=True requires fit_dir_path")

        # Validate numeric parameters
        if self.period_months < 1 or self.period_months > 24:
            raise ValueError("period_months must be between 1 and 24")

        if self.training_plan_weeks < 1 or self.training_plan_weeks > 52:
            raise ValueError("training_plan_weeks must be between 1 and 52")

        if self.max_iterations_per_phase < 1:
            raise ValueError("max_iterations_per_phase must be positive")

        # Validate skip_data_prep requirements
        if self.skip_data_prep:
            cache_path = self.output_dir / "cache" / "activities_processed.parquet"
            if not cache_path.exists():
                raise ValueError(
                    f"Cache file not found: {cache_path}\n"
                    f"The --skip-data-prep flag requires an existing cache file."
                )


@dataclass
class WorkflowResult:
    """
    Complete result from workflow execution.

    Contains results from all phases and metadata about the workflow run.

    Attributes:
        phase_results: Results from each executed phase
        total_execution_time_seconds: Total workflow execution time
        total_tokens_used: Total tokens across all phases
        output_files: List of generated output files (reports)
    """
    phase_results: list[PhaseResult]
    total_execution_time_seconds: float
    total_tokens_used: int
    output_files: list[Path] = field(default_factory=list)

    @property
    def success(self) -> bool:
        """
        Whether entire workflow completed successfully.

        Workflow is successful if all non-skipped phases completed.
        """
        return all(
            r.success for r in self.phase_results if r.status != PhaseStatus.SKIPPED
        )

    def get_phase_result(self, phase_name: str) -> PhaseResult | None:
        """
        Get result for specific phase.

        Args:
            phase_name: Name of phase to retrieve

        Returns:
            PhaseResult if found, None otherwise
        """
        for result in self.phase_results:
            if result.phase_name == phase_name:
                return result
        return None

    def to_dict(self) -> dict[str, Any]:
        """
        Convert to dictionary for serialization.

        Returns:
            Dictionary representation suitable for JSON serialization
        """
        return {
            "phase_results": [r.to_dict() for r in self.phase_results],
            "total_execution_time_seconds": self.total_execution_time_seconds,
            "total_tokens_used": self.total_tokens_used,
            "output_files": [str(f) for f in self.output_files],
            "success": self.success,
        }


@dataclass
class PhaseContext:
    """
    Context for phase execution.

    Contains configuration and data from previous phases.
    Passed to each phase's execute() method.

    Attributes:
        config: Workflow configuration
        previous_phase_data: Data extracted from previous phases
        session_manager: Session manager for creating isolated sessions
        provider: LLM provider
        prompts_manager: Agent prompts manager
        progress_callback: Optional callback for progress updates
    """
    config: WorkflowConfig
    previous_phase_data: dict[str, Any]
    session_manager: Any  # SessionManager (avoid circular import)
    provider: Any  # BaseProvider (avoid circular import)
    prompts_manager: Any  # AgentPromptsManager (avoid circular import)
    progress_callback: Callable[[str, PhaseStatus], None] | None = None
```

### 2. Update `src/cycling_ai/orchestration/multi_agent.py`

Remove the extracted classes and import from base:

```python
"""
Multi-agent workflow orchestrator.

Coordinates sequential execution of specialized agents across multiple phases,
with data handoffs between phases and comprehensive error handling.
"""
from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)
from cycling_ai.orchestration.agent import AgentFactory
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.orchestration.session import (
    ConversationSession,
    SessionManager,
)
from cycling_ai.providers.base import BaseProvider

logger = logging.getLogger(__name__)

# Phase name constants
PHASE_DATA_PREPARATION = "data_preparation"
PHASE_PERFORMANCE_ANALYSIS = "performance_analysis"
PHASE_TRAINING_PLANNING = "training_planning"
PHASE_REPORT_DATA_PREPARATION = "report_data_preparation"

# Rest of multi_agent.py unchanged...
```

### 3. Update All Imports

Update any files that import these classes:

```bash
# Files to check and update imports:
tests/orchestration/test_cross_training_detection.py
tests/orchestration/test_weekly_hours_validation.py
src/cycling_ai/cli/commands/generate.py
```

Change:
```python
from cycling_ai.orchestration.multi_agent import PhaseResult, PhaseStatus, WorkflowConfig, WorkflowResult
```

To:
```python
from cycling_ai.orchestration.base import PhaseResult, PhaseStatus, WorkflowConfig, WorkflowResult
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
```

---

## Test Requirements (TDD)

### Unit Tests

Create `tests/orchestration/test_base.py`:

```python
"""Tests for orchestration base classes."""
import pytest
from pathlib import Path

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)


class TestPhaseStatus:
    """Test PhaseStatus enum."""

    def test_phase_status_values(self):
        """Test all phase status values are defined."""
        assert PhaseStatus.PENDING.value == "pending"
        assert PhaseStatus.IN_PROGRESS.value == "in_progress"
        assert PhaseStatus.COMPLETED.value == "completed"
        assert PhaseStatus.FAILED.value == "failed"
        assert PhaseStatus.SKIPPED.value == "skipped"


class TestPhaseResult:
    """Test PhaseResult dataclass."""

    def test_phase_result_creation(self):
        """Test creating a phase result."""
        result = PhaseResult(
            phase_name="test_phase",
            status=PhaseStatus.COMPLETED,
            agent_response="Test response",
            extracted_data={"key": "value"},
            execution_time_seconds=1.5,
            tokens_used=100,
        )

        assert result.phase_name == "test_phase"
        assert result.status == PhaseStatus.COMPLETED
        assert result.success is True
        assert result.agent_response == "Test response"
        assert result.extracted_data == {"key": "value"}
        assert result.execution_time_seconds == 1.5
        assert result.tokens_used == 100

    def test_phase_result_success_property(self):
        """Test success property for different statuses."""
        completed_result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.COMPLETED,
            agent_response="",
        )
        assert completed_result.success is True

        failed_result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.FAILED,
            agent_response="",
        )
        assert failed_result.success is False

        skipped_result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.SKIPPED,
            agent_response="",
        )
        assert skipped_result.success is False

    def test_phase_result_to_dict(self):
        """Test serialization to dictionary."""
        result = PhaseResult(
            phase_name="test_phase",
            status=PhaseStatus.COMPLETED,
            agent_response="Response",
            extracted_data={"data": "value"},
            errors=[],
            execution_time_seconds=2.0,
            tokens_used=200,
        )

        result_dict = result.to_dict()

        assert result_dict["phase_name"] == "test_phase"
        assert result_dict["status"] == "completed"
        assert result_dict["agent_response"] == "Response"
        assert result_dict["extracted_data"] == {"data": "value"}
        assert result_dict["errors"] == []
        assert result_dict["execution_time_seconds"] == 2.0
        assert result_dict["tokens_used"] == 200


class TestWorkflowConfig:
    """Test WorkflowConfig dataclass."""

    def test_workflow_config_creation_minimal(self):
        """Test creating config with minimal required fields."""
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=Path("/path/to/profile.json"),
            training_plan_weeks=12,
            fit_dir_path=Path("/path/to/fit"),
        )

        assert config.csv_file_path is None
        assert config.athlete_profile_path == Path("/path/to/profile.json")
        assert config.training_plan_weeks == 12
        assert config.period_months == 6  # default
        assert config.generate_training_plan is True  # default

    def test_workflow_config_validation_no_input_files(self, tmp_path):
        """Test validation fails when no input files provided."""
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            fit_dir_path=None,
        )

        with pytest.raises(ValueError, match="Either csv_file_path or fit_dir_path"):
            config.validate()

    def test_workflow_config_validation_csv_not_found(self, tmp_path):
        """Test validation fails when CSV file doesn't exist."""
        config = WorkflowConfig(
            csv_file_path=tmp_path / "nonexistent.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        with pytest.raises(ValueError, match="CSV file not found"):
            config.validate()

    def test_workflow_config_validation_profile_not_found(self, tmp_path):
        """Test validation fails when profile doesn't exist."""
        csv_file = tmp_path / "activities.csv"
        csv_file.touch()

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=tmp_path / "nonexistent.json",
            training_plan_weeks=12,
        )

        with pytest.raises(ValueError, match="Athlete profile not found"):
            config.validate()

    def test_workflow_config_validation_invalid_period_months(self, tmp_path):
        """Test validation fails for invalid period_months."""
        csv_file = tmp_path / "activities.csv"
        csv_file.touch()
        profile_file = tmp_path / "profile.json"
        profile_file.touch()

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            training_plan_weeks=12,
            period_months=0,
        )

        with pytest.raises(ValueError, match="period_months must be between"):
            config.validate()

    def test_workflow_config_validation_success(self, tmp_path):
        """Test validation succeeds with valid configuration."""
        csv_file = tmp_path / "activities.csv"
        csv_file.touch()
        profile_file = tmp_path / "profile.json"
        profile_file.touch()

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            training_plan_weeks=12,
        )

        # Should not raise
        config.validate()


class TestWorkflowResult:
    """Test WorkflowResult dataclass."""

    def test_workflow_result_success_all_completed(self):
        """Test workflow is successful when all phases completed."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
            PhaseResult("phase2", PhaseStatus.COMPLETED, "response2"),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=5.0,
            total_tokens_used=500,
        )

        assert result.success is True

    def test_workflow_result_success_with_skipped(self):
        """Test workflow is successful when some phases skipped."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
            PhaseResult("phase2", PhaseStatus.SKIPPED, "skipped"),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=3.0,
            total_tokens_used=300,
        )

        assert result.success is True

    def test_workflow_result_failure_when_phase_failed(self):
        """Test workflow fails when any non-skipped phase failed."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
            PhaseResult("phase2", PhaseStatus.FAILED, "error", errors=["Error occurred"]),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=2.0,
            total_tokens_used=200,
        )

        assert result.success is False

    def test_workflow_result_get_phase_result(self):
        """Test retrieving specific phase result."""
        phase1 = PhaseResult("phase1", PhaseStatus.COMPLETED, "response1")
        phase2 = PhaseResult("phase2", PhaseStatus.COMPLETED, "response2")

        result = WorkflowResult(
            phase_results=[phase1, phase2],
            total_execution_time_seconds=5.0,
            total_tokens_used=500,
        )

        assert result.get_phase_result("phase1") == phase1
        assert result.get_phase_result("phase2") == phase2
        assert result.get_phase_result("nonexistent") is None

    def test_workflow_result_to_dict(self):
        """Test serialization to dictionary."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=3.5,
            total_tokens_used=350,
            output_files=[Path("/path/to/output.json")],
        )

        result_dict = result.to_dict()

        assert result_dict["total_execution_time_seconds"] == 3.5
        assert result_dict["total_tokens_used"] == 350
        assert result_dict["output_files"] == ["/path/to/output.json"]
        assert result_dict["success"] is True
        assert len(result_dict["phase_results"]) == 1


class TestPhaseContext:
    """Test PhaseContext dataclass."""

    def test_phase_context_creation(self):
        """Test creating a phase context."""
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=Path("/path/to/profile.json"),
            training_plan_weeks=12,
            fit_dir_path=Path("/path/to/fit"),
        )

        context = PhaseContext(
            config=config,
            previous_phase_data={"key": "value"},
            session_manager=None,
            provider=None,
            prompts_manager=None,
        )

        assert context.config == config
        assert context.previous_phase_data == {"key": "value"}
        assert context.progress_callback is None
```

### Integration Tests

Update existing tests to use new imports:

```python
# tests/orchestration/test_cross_training_detection.py
# tests/orchestration/test_weekly_hours_validation.py

# Change imports to:
from cycling_ai.orchestration.base import WorkflowConfig, PhaseResult, PhaseStatus
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
```

---

## Acceptance Criteria

- [ ] `orchestration/base.py` created with all extracted classes
- [ ] `multi_agent.py` updated to import from base.py
- [ ] All existing imports updated throughout codebase
- [ ] Unit tests for base classes pass (100% coverage)
- [ ] All existing tests continue to pass (backward compatible)
- [ ] Type checking passes (`mypy src/cycling_ai/orchestration/base.py --strict`)
- [ ] No code duplication between base.py and multi_agent.py

---

## Verification Steps

```bash
# 1. Run new unit tests
pytest tests/orchestration/test_base.py -v

# 2. Run existing tests (should all pass)
pytest tests/orchestration/ -v

# 3. Type checking
mypy src/cycling_ai/orchestration/base.py --strict

# 4. Code formatting
ruff format src/cycling_ai/orchestration/base.py
ruff check src/cycling_ai/orchestration/base.py

# 5. Check no broken imports
python -c "from cycling_ai.orchestration.base import PhaseResult, PhaseStatus, WorkflowConfig, WorkflowResult, PhaseContext; print('✓ Imports work')"
```

---

## Notes

- This is a pure refactoring - no behavior changes
- All tests must continue to pass
- Focus on clean extraction without introducing new logic
- Ensure backward compatibility for all consuming code

---

**Status:** ✅ Ready for TDD Implementation
