"""
Base classes for multi-agent orchestration.

Shared data structures used across phases and workflows.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

# Re-export classes that are part of public API
__all__ = [
    "PhaseStatus",
    "PhaseResult",
    "WorkflowConfig",
    "WorkflowResult",
    "PhaseContext",
    "RAGConfig",
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
class RAGConfig:
    """
    Configuration for RAG (Retrieval-Augmented Generation) enhancement.

    Controls retrieval behavior across all workflow phases.

    Attributes:
        enabled: Whether RAG enhancement is enabled (default: False)
        top_k: Number of documents to retrieve per phase (default: 3)
        min_score: Minimum similarity score for retrieval (0-1, default: 0.5)
        embedding_provider: Embedding provider ("local" or "openai", default: "local")
        embedding_model: Optional embedding model name (uses provider defaults if None)
        project_vectorstore_path: Path to project vectorstore (shared knowledge)
        user_vectorstore_path: Path to user vectorstore (athlete history, optional)

    Examples:
        >>> # Disabled by default (backward compatible)
        >>> config = RAGConfig()
        >>> assert config.enabled is False
        >>>
        >>> # Enable with custom settings
        >>> config = RAGConfig(enabled=True, top_k=5, min_score=0.7)
    """

    enabled: bool = False
    top_k: int = 3
    min_score: float = 0.5
    embedding_provider: str = "local"
    embedding_model: str | None = None

    # Vectorstore paths (defaults set by workflow initialization)
    project_vectorstore_path: Path | None = None
    user_vectorstore_path: Path | None = None


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
        workout_source: Source for training plan workouts ("library" or "llm")
        provider: LLM provider instance
        max_iterations_per_phase: Maximum tool execution loops per phase
        prompts_dir: Optional directory with custom prompt files
        rag_config: RAG configuration (default: disabled)
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

    # Training plan workout source
    workout_source: str = "library"  # "library" (fast, deterministic) or "llm" (flexible)

    # Provider configuration
    provider: Any = None  # BaseProvider, but avoid circular import
    max_iterations_per_phase: int = 5

    # Prompts configuration
    prompts_dir: Path | None = None

    # RAG configuration
    rag_config: RAGConfig = field(default_factory=RAGConfig)

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
            raise ValueError(
                "fit_only_mode=True but csv_file_path was provided. "
                "Remove CSV or set fit_only_mode=False"
            )

        if self.fit_only_mode and self.fit_dir_path is None:
            raise ValueError("fit_only_mode=True requires fit_dir_path to be provided")

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
                    f"The --skip-data-prep flag requires an existing cache file.\n"
                    f"Run without this flag first to create the cache, "
                    f"or check the output directory path."
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
        rag_manager: Optional RAG manager for retrieval-augmented generation
    """

    config: WorkflowConfig
    previous_phase_data: dict[str, Any]
    session_manager: Any  # SessionManager (avoid circular import)
    provider: Any  # BaseProvider (avoid circular import)
    prompts_manager: Any  # AgentPromptsManager (avoid circular import)
    progress_callback: Callable[[str, PhaseStatus], None] | None = None
    rag_manager: Any | None = None  # RAGManager (avoid circular import)
