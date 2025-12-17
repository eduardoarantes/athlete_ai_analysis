"""
Data Preparation Phase (Phase 1).

Validates data files and creates optimized Parquet cache.
This phase does NOT use LLM - it executes tools directly.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
)
from cycling_ai.orchestration.phases.base_phase import BasePhase
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.tools.wrappers.cache_preparation_tool import CachePreparationTool
from cycling_ai.tools.wrappers.data_validation_tool import DataValidationTool

logger = logging.getLogger(__name__)


class DataPreparationPhase(BasePhase):
    """
    Phase 1: Data Preparation.

    Validates athlete profile, CSV data, and FIT files, then creates
    an optimized Parquet cache for subsequent analysis phases.

    This phase executes tools directly without LLM orchestration.

    Key Responsibilities:
    - Validate athlete profile exists and has required fields
    - Validate CSV data format (if provided)
    - Validate FIT files directory (if provided)
    - Create Parquet cache with zone enrichment
    - Extract cache metadata for Phase 2+

    Extracted Data:
    - cache_file_path: Path to Parquet cache
    - cache_metadata_path: Path to cache metadata JSON
    - athlete_profile_path: Path to athlete profile
    - zone_enriched: Whether cache includes zone data
    - cache_info: Full cache metadata

    Example:
        >>> phase = DataPreparationPhase()
        >>> context = PhaseContext(config=workflow_config, ...)
        >>> result = phase.execute(context)
        >>> print(result.extracted_data["cache_file_path"])
        /output/activities_processed.parquet
    """

    def __init__(self) -> None:
        """Initialize DataPreparationPhase."""
        super().__init__(
            phase_name="data_preparation",
            required_tools=["validate_data", "prepare_cache"],
            max_iterations=None,  # No iterations - direct execution
        )

    def execute(self, context: PhaseContext) -> PhaseResult:
        """
        Execute data preparation phase (overrides BasePhase.execute()).

        Phase 1 doesn't use LLM, so we override execute() to skip session/agent creation.

        Args:
            context: Phase execution context

        Returns:
            PhaseResult with validation and cache creation status
        """
        phase_start = datetime.now()

        # Notify progress callback
        if context.progress_callback:
            context.progress_callback(self.phase_name, PhaseStatus.IN_PROGRESS)

        try:
            # Validate context
            self._validate_context(context)

            # Execute phase logic
            result = self._execute_phase(context)

            # Update execution time if not already set
            if result.execution_time_seconds == 0:
                result.execution_time_seconds = (datetime.now() - phase_start).total_seconds()

            # Notify completion or failure
            if context.progress_callback:
                context.progress_callback(self.phase_name, result.status)

            return result

        except Exception as e:
            # Handle any errors
            execution_time = (datetime.now() - phase_start).total_seconds()
            error_msg = f"{type(e).__name__}: {str(e)}"

            logger.error(f"Phase {self.phase_name} failed after {execution_time:.2f}s: {error_msg}")

            result = PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.FAILED,
                agent_response="",
                extracted_data={},
                errors=[error_msg],
                execution_time_seconds=execution_time,
                tokens_used=0,
            )

            # Notify failure
            if context.progress_callback:
                context.progress_callback(self.phase_name, PhaseStatus.FAILED)

            return result

    def _validate_context(self, context: PhaseContext) -> None:
        """
        Validate context has required configuration.

        Args:
            context: Phase execution context

        Raises:
            ValueError: If required config fields are missing
        """
        config = context.config

        # Athlete profile is required
        if not config.athlete_profile_path:
            raise ValueError("athlete_profile_path is required for data preparation phase")

        # At least one data source is required
        if not config.csv_file_path and not config.fit_dir_path:
            raise ValueError("At least one data source required: csv_file_path or fit_dir_path")

    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        """
        Execute data preparation phase.

        Validates data files and creates Parquet cache directly (no LLM).

        Args:
            context: Phase execution context

        Returns:
            PhaseResult with cache paths and validation status
        """
        phase_start = datetime.now()
        config = context.config

        logger.info("[PHASE DATA_PREPARATION] Starting direct execution (no LLM)")

        try:
            # Step 1: Validate data files
            logger.info("[PHASE DATA_PREPARATION] Validating data files...")
            validation_result = self._execute_validation(config)

            if not validation_result.success:
                errors = validation_result.data.get("issues", ["Validation failed"])
                logger.error(f"[PHASE DATA_PREPARATION] Validation failed: {errors}")
                return PhaseResult(
                    phase_name=self.phase_name,
                    status=PhaseStatus.FAILED,
                    agent_response="Data validation failed",
                    errors=errors,
                    execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
                    tokens_used=0,
                )

            logger.info("[PHASE DATA_PREPARATION] Validation passed")

            # Step 2: Create cache
            logger.info("[PHASE DATA_PREPARATION] Creating optimized cache...")
            cache_result = self._execute_cache_creation(config)

            if not cache_result.success:
                errors = cache_result.errors or ["Cache creation failed"]
                logger.error(f"[PHASE DATA_PREPARATION] Cache creation failed: {errors}")
                return PhaseResult(
                    phase_name=self.phase_name,
                    status=PhaseStatus.FAILED,
                    agent_response="Cache creation failed",
                    errors=errors,
                    execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
                    tokens_used=0,
                )

            logger.info("[PHASE DATA_PREPARATION] Cache created successfully")

            # Build response message
            validation_msg = validation_result.data.get("message", "Validation passed")
            cache_msg = cache_result.data.get("message", "Cache created")
            response = f"{validation_msg}\n\n{cache_msg}\n\nData preparation complete. Ready for analysis."

            # Extract data for Phase 2+
            extracted_data = {
                "cache_file_path": cache_result.data.get("cache_path"),
                "cache_metadata_path": cache_result.data.get("metadata_path"),
                "athlete_profile_path": str(config.athlete_profile_path),
                "zone_enriched": cache_result.data.get("zone_enriched", False),
                "cache_info": cache_result.data,
            }

            execution_time = (datetime.now() - phase_start).total_seconds()
            logger.info(f"[PHASE DATA_PREPARATION] Completed in {execution_time:.2f}s (no tokens used)")

            return PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.COMPLETED,
                agent_response=response,
                extracted_data=extracted_data,
                execution_time_seconds=execution_time,
                tokens_used=0,  # No LLM calls
            )

        except Exception as e:
            execution_time = (datetime.now() - phase_start).total_seconds()
            logger.error(f"[PHASE DATA_PREPARATION] Failed with exception: {e}", exc_info=True)

            return PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.FAILED,
                agent_response=f"Data preparation failed: {str(e)}",
                errors=[str(e)],
                execution_time_seconds=execution_time,
                tokens_used=0,
            )

    def _execute_validation(self, config: Any) -> Any:
        """
        Execute data validation tool.

        Args:
            config: Workflow configuration

        Returns:
            ToolExecutionResult from validation
        """
        validation_tool = DataValidationTool()
        validation_params: dict[str, str] = {
            "athlete_profile_path": str(config.athlete_profile_path),
        }

        if config.csv_file_path:
            validation_params["csv_file_path"] = str(config.csv_file_path)
        if config.fit_dir_path:
            validation_params["fit_dir_path"] = str(config.fit_dir_path)

        return validation_tool.execute(**validation_params)

    def _execute_cache_creation(self, config: Any) -> Any:
        """
        Execute cache preparation tool.

        Args:
            config: Workflow configuration

        Returns:
            ToolExecutionResult from cache creation
        """
        cache_tool = CachePreparationTool()
        cache_params: dict[str, str] = {
            "athlete_profile_path": str(config.athlete_profile_path),
        }

        if config.csv_file_path:
            cache_params["csv_file_path"] = str(config.csv_file_path)
        if config.fit_dir_path:
            cache_params["fit_dir_path"] = str(config.fit_dir_path)

        # FIT-only mode requires output_dir_path
        if config.fit_only_mode or not config.csv_file_path:
            cache_params["output_dir_path"] = str(config.output_dir)

        return cache_tool.execute(**cache_params)

    def _extract_phase_data(self, response: str, session: ConversationSession) -> dict[str, Any]:
        """
        Extract structured data from phase execution.

        Phase 1 doesn't use LLM/sessions, so this returns empty dict.
        Data extraction happens directly in _execute_phase.

        Args:
            response: Agent response (unused)
            session: Conversation session (unused)

        Returns:
            Empty dictionary (data extracted directly in _execute_phase)
        """
        return {}

    def _get_system_prompt(self, config: dict[str, Any], context: PhaseContext) -> str:
        """
        Get system prompt for LLM.

        Phase 1 doesn't use LLM, so this returns empty string.

        Args:
            config: Configuration dictionary (unused)
            context: Phase execution context (unused)

        Returns:
            Empty string (no LLM used)
        """
        return ""

    def _get_user_message(self, config: dict[str, Any], context: PhaseContext) -> str:
        """
        Get user message for LLM.

        Phase 1 doesn't use LLM, so this returns empty string.

        Args:
            config: Configuration dictionary (unused)
            context: Phase execution context (unused)

        Returns:
            Empty string (no LLM used)
        """
        return ""

    def _extract_data(self, session: ConversationSession) -> dict[str, Any]:
        """
        Extract data from conversation session.

        Phase 1 doesn't use LLM/sessions, so this returns empty dict.
        Data extraction happens directly in _execute_phase.

        Args:
            session: Conversation session (unused)

        Returns:
            Empty dictionary (data extracted directly in _execute_phase)
        """
        return {}

    def _get_retrieval_query(self, context: PhaseContext) -> str:
        """
        Build retrieval query for data validation best practices.

        Phase 1 validates data files, so retrieve guidance on:
        - Data validation best practices
        - FIT file processing
        - CSV data quality checks

        Args:
            context: Phase execution context

        Returns:
            Query string for domain knowledge retrieval
        """
        return "data validation best practices cycling FIT file CSV processing quality checks"

    def _get_retrieval_collection(self) -> str:
        """
        Get collection name for data preparation retrieval.

        Returns:
            "domain_knowledge" - Use cycling science knowledge
        """
        return "domain_knowledge"
