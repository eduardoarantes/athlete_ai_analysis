"""
Complete training plan generation tool wrapper.

Wraps the full multi-agent workflow orchestrator to enable chat users to generate
comprehensive training plans through all 4 phases (data preparation, performance
analysis, training planning, report data preparation).

This tool enables the chat interface to execute the same complete workflow that
the `cycling-ai generate` command uses, producing detailed training plans with
workouts from the library.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

# Import WorkflowConfig at module level (no circular dependency)
from cycling_ai.orchestration.base import WorkflowConfig

# Delay imports that cause circular dependencies (imported in execute() method):
# - MultiAgentOrchestrator
# - AgentPromptsManager
# - SessionManager
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool

logger = logging.getLogger(__name__)


class GenerateTrainingPlanTool(BaseTool):
    """
    Tool for generating complete training plans via multi-agent workflow.

    Executes all 4 phases of the multi-agent orchestration:
    1. Data Preparation - Validates CSV/FIT files, creates cache
    2. Performance Analysis - Analyzes performance trends and power zones
    3. Training Planning - Creates periodized plan with detailed workouts
    4. Report Data Preparation - Consolidates all data into report format

    This is the same workflow used by `cycling-ai generate` command, enabling
    chat users to request comprehensive training plans conversationally.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="generate_complete_training_plan",
            description=(
                "Generate a complete, comprehensive training plan using the full multi-agent "
                "workflow (all 4 phases). This executes the same process as the `cycling-ai generate` "
                "command, producing: 1) Performance analysis comparing recent training periods, "
                "2) Power zone distribution analysis, 3) Periodized training plan with detailed "
                "workouts from the library (warm-up, intervals, recovery, cool-down segments), "
                "4) Consolidated report data with coaching insights. "
                "Use this when the user wants a complete training plan with specific workouts, "
                "not just an overview. This is a comprehensive operation that may take 2-5 minutes. "
                "The result includes a report_data.json file with all plan details."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description=(
                        "Path to Strava activities CSV export file. Required unless using fit_only_mode. "
                        "The CSV should contain columns: Activity Date, Activity Name, Activity Type, "
                        "Distance, Moving Time."
                    ),
                    required=False,  # Can be None if fit_only_mode or fit_dir provided
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description=(
                        "Path to athlete_profile.json file. This file should contain: "
                        "ftp (current FTP in watts), max_hr (maximum heart rate), "
                        "weight_kg, age, goals, training_days, and training_hours. "
                        "If not provided, will attempt to use profile_path from session context."
                    ),
                    required=False,  # Can come from session context
                ),
                ToolParameter(
                    name="fit_dir_path",
                    type="string",
                    description=(
                        "Optional path to directory containing FIT files from cycling computer. "
                        "FIT files provide detailed power data for more accurate analysis. "
                        "If provided along with CSV, both data sources will be used."
                    ),
                    required=False,
                ),
                ToolParameter(
                    name="output_dir",
                    type="string",
                    description=(
                        "Directory where generated report files should be saved. "
                        "Defaults to './reports' if not specified. The tool will create "
                        "report_data.json and other output files in this directory."
                    ),
                    required=False,
                ),
                ToolParameter(
                    name="training_plan_weeks",
                    type="integer",
                    description=(
                        "Number of weeks for the training plan (4-24 weeks). "
                        "Typical values: 12 weeks for Gran Fondo, 16 weeks for longer events, "
                        "8 weeks for shorter focused blocks. Defaults to 12 weeks."
                    ),
                    required=False,
                    min_value=4,
                    max_value=24,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description=(
                        "Number of months for performance comparison analysis (1-24 months). "
                        "This determines how far back to look when comparing recent vs historical "
                        "performance. Defaults to 6 months."
                    ),
                    required=False,
                    min_value=1,
                    max_value=24,
                ),
                ToolParameter(
                    name="workout_source",
                    type="string",
                    description=(
                        "Source for training plan workouts. Options: "
                        "'library' (recommended, fast, uses curated workout library), "
                        "'llm' (flexible, LLM designs custom workouts). "
                        "Library source is faster and more deterministic. Defaults to 'library'."
                    ),
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "Complete workflow result with: "
                    "success (boolean), phase_results (array of results from each phase), "
                    "report_json_path (path to generated report_data.json), "
                    "output_files (list of generated files), "
                    "total_execution_time (seconds), total_tokens (token usage)."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute complete training plan generation workflow.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with workflow result or errors
        """
        logger.info("[GENERATE PLAN TOOL] Starting execution")
        logger.debug(f"[GENERATE PLAN TOOL] Received kwargs keys: {list(kwargs.keys())}")

        # Import here to avoid circular dependency
        # (MultiAgentOrchestrator → workflows → phases → agent → executor → tools)
        from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
        from cycling_ai.orchestration.prompts import AgentPromptsManager
        from cycling_ai.orchestration.session import SessionManager

        try:
            # Extract session context if provided
            session_context = kwargs.get("session_context", {})
            logger.debug(
                f"[GENERATE PLAN TOOL] Session context keys: {list(session_context.keys())}"
            )

            # Extract parameters with defaults
            csv_file_path = kwargs.get("csv_file_path")
            athlete_profile_path = kwargs.get("athlete_profile_path")
            fit_dir_path = kwargs.get("fit_dir_path")
            output_dir = kwargs.get("output_dir", "./reports")
            training_plan_weeks = int(kwargs.get("training_plan_weeks", 12))
            period_months = int(kwargs.get("period_months", 6))
            workout_source = kwargs.get("workout_source", "library")

            logger.info("[GENERATE PLAN TOOL] Parameters:")
            logger.info(f"[GENERATE PLAN TOOL]   - csv_file: {csv_file_path}")
            logger.info(f"[GENERATE PLAN TOOL]   - profile: {athlete_profile_path}")
            logger.info(f"[GENERATE PLAN TOOL]   - fit_dir: {fit_dir_path}")
            logger.info(f"[GENERATE PLAN TOOL]   - output_dir: {output_dir}")
            logger.info(f"[GENERATE PLAN TOOL]   - weeks: {training_plan_weeks}")
            logger.info(f"[GENERATE PLAN TOOL]   - period_months: {period_months}")
            logger.info(f"[GENERATE PLAN TOOL]   - workout_source: {workout_source}")

            # Get athlete profile path from session context if not provided
            if not athlete_profile_path and "profile_path" in session_context:
                athlete_profile_path = session_context["profile_path"]
                logger.info(
                    f"[GENERATE PLAN TOOL] Using profile from session: {athlete_profile_path}"
                )

            # Get provider from session context (required for orchestrator)
            provider = session_context.get("provider")
            if not provider:
                logger.error("[GENERATE PLAN TOOL] No provider in session context")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[
                        "Provider not available in session context. "
                        "This tool requires an active LLM provider to execute the workflow."
                    ],
                )

            # Validate required paths
            if not athlete_profile_path:
                logger.error("[GENERATE PLAN TOOL] Missing athlete_profile_path")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[
                        "athlete_profile_path is required. "
                        "Either provide it as a parameter or ensure it's in session context."
                    ],
                )

            if not csv_file_path and not fit_dir_path:
                logger.error("[GENERATE PLAN TOOL] Missing data source")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[
                        "At least one data source is required: csv_file_path or fit_dir_path. "
                        "Provide path to Strava CSV export or FIT files directory."
                    ],
                )

            # Convert paths to Path objects
            csv_path = Path(csv_file_path) if csv_file_path else None
            profile_path = Path(athlete_profile_path)
            fit_dir = Path(fit_dir_path) if fit_dir_path else None
            output_path = Path(output_dir)

            # Validate file existence
            if csv_path and not csv_path.exists():
                logger.error(f"[GENERATE PLAN TOOL] CSV file not found: {csv_path}")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"CSV file not found: {csv_file_path}"],
                )

            if not profile_path.exists():
                logger.error(f"[GENERATE PLAN TOOL] Profile file not found: {profile_path}")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile not found: {athlete_profile_path}"],
                )

            if fit_dir and not fit_dir.exists():
                logger.error(f"[GENERATE PLAN TOOL] FIT directory not found: {fit_dir}")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"FIT directory not found: {fit_dir_path}"],
                )

            # Create workflow configuration
            logger.info("[GENERATE PLAN TOOL] Creating workflow configuration...")
            config = WorkflowConfig(
                csv_file_path=csv_path,
                athlete_profile_path=profile_path,
                fit_dir_path=fit_dir,
                output_dir=output_path,
                period_months=period_months,
                generate_training_plan=True,
                training_plan_weeks=training_plan_weeks,
                workout_source=workout_source,
                provider=provider,
            )

            # Validate configuration
            try:
                config.validate()
                logger.info("[GENERATE PLAN TOOL] Configuration validated successfully")
            except ValueError as e:
                logger.error(f"[GENERATE PLAN TOOL] Configuration validation failed: {e}")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Configuration validation failed: {str(e)}"],
                )

            # Create orchestrator
            logger.info("[GENERATE PLAN TOOL] Initializing multi-agent orchestrator...")
            prompts_manager = AgentPromptsManager()
            session_manager = SessionManager(
                storage_dir=Path.home() / ".cycling-ai" / "workflow_sessions"
            )

            orchestrator = MultiAgentOrchestrator(
                provider=provider,
                prompts_manager=prompts_manager,
                session_manager=session_manager,
                progress_callback=None,  # Could add progress tracking later
            )

            # Execute workflow
            logger.info("[GENERATE PLAN TOOL] Executing full 4-phase workflow...")
            logger.info("[GENERATE PLAN TOOL] This may take 2-5 minutes...")
            workflow_result = orchestrator.execute_workflow(config)

            logger.info(
                f"[GENERATE PLAN TOOL] Workflow completed: success={workflow_result.success}"
            )
            logger.info(
                f"[GENERATE PLAN TOOL] Phases executed: {len(workflow_result.phase_results)}"
            )

            # Extract result data
            if not workflow_result.success:
                # Collect errors from failed phases
                errors = []
                for phase_result in workflow_result.phase_results:
                    if phase_result.errors:
                        errors.extend(phase_result.errors)

                logger.error(f"[GENERATE PLAN TOOL] Workflow failed with {len(errors)} errors")
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=errors if errors else ["Workflow execution failed"],
                )

            # Find report_json_path from Phase 4 results
            report_json_path = None
            for phase_result in workflow_result.phase_results:
                if "report_json_path" in phase_result.extracted_data:
                    report_json_path = phase_result.extracted_data["report_json_path"]
                    break

            if not report_json_path:
                logger.warning("[GENERATE PLAN TOOL] No report_json_path found in phase results")

            # Calculate total execution time and tokens
            total_execution_time = sum(
                p.execution_time_seconds for p in workflow_result.phase_results
            )
            total_tokens = sum(p.tokens_used for p in workflow_result.phase_results)

            # Build success result
            result_data = {
                "success": True,
                "report_json_path": report_json_path,
                "output_files": workflow_result.output_files,
                "phase_results": [
                    {
                        "phase_name": p.phase_name,
                        "status": p.status.value,
                        "execution_time": p.execution_time_seconds,
                        "tokens_used": p.tokens_used,
                    }
                    for p in workflow_result.phase_results
                ],
                "total_execution_time": total_execution_time,
                "total_tokens": total_tokens,
            }

            logger.info(f"[GENERATE PLAN TOOL] Success! Report saved to: {report_json_path}")
            logger.info(f"[GENERATE PLAN TOOL] Total execution time: {total_execution_time:.1f}s")
            logger.info(f"[GENERATE PLAN TOOL] Total tokens used: {total_tokens}")

            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "execution_time_seconds": total_execution_time,
                    "tokens_used": total_tokens,
                    "phases_completed": len(workflow_result.phase_results),
                    "workflow_source": workout_source,
                },
            )

        except Exception as e:
            logger.error(f"[GENERATE PLAN TOOL] Unexpected error: {str(e)}", exc_info=True)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during workflow execution: {str(e)}"],
            )


# Register tool on module import
register_tool(GenerateTrainingPlanTool())
