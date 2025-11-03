"""
Performance Analysis Phase Implementation.

Orchestrates LLM-driven performance analysis with optional cross-training detection.
This is Phase 2 of the multi-agent workflow.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.base import PhaseContext, PhaseResult, PhaseStatus
from cycling_ai.orchestration.phases.base_phase import BasePhase
from cycling_ai.orchestration.session import ConversationSession

logger = logging.getLogger(__name__)


class PerformanceAnalysisPhase(BasePhase):
    """
    Phase 2: Performance Analysis.

    Orchestrates LLM agent to analyze cycling performance data with optional
    cross-training impact analysis. Uses conditional tool calling based on
    activity distribution in the cache.

    This phase:
    1. Auto-detects if cross-training analysis is warranted
    2. Builds context-aware user prompt with conditional sections
    3. Orchestrates LLM to call analyze_performance (required) and
       analyze_cross_training_impact (conditional)
    4. Extracts performance_analysis_json and optional cross_training_analysis

    Required previous phase data:
    - cache_file_path: Path to Parquet cache from Phase 1
    - athlete_profile_path: Path to athlete profile

    Extracted data:
    - performance_analysis_json: Performance analysis results
    - cross_training_analysis: Cross-training impact (if applicable)
    """

    def __init__(self) -> None:
        """Initialize PerformanceAnalysisPhase."""
        super().__init__(
            phase_name="performance_analysis",
            required_tools=["analyze_performance"],
            max_iterations=3,  # Reduced from default (10) to prevent loops: call tool, get result, synthesize
        )

    def _get_required_tools(self, context: PhaseContext) -> list[str]:
        """
        Get context-aware required tools list.

        Determines tools based on cross-training auto-detection.

        Args:
            context: Phase context with config and previous data

        Returns:
            List of tool names (analyze_performance + optional cross-training)
        """
        tools = ["analyze_performance"]

        # Determine if cross-training analysis should be performed
        cache_file_path = context.previous_phase_data.get("cache_file_path", "")

        should_analyze_ct = False
        if context.config.analyze_cross_training is None:
            # Auto-detect based on cache content
            should_analyze_ct = self._should_analyze_cross_training(cache_file_path)
        else:
            # Explicit override from config
            should_analyze_ct = context.config.analyze_cross_training

        if should_analyze_ct:
            tools.append("analyze_cross_training_impact")
            logger.info("[PHASE 2] Cross-training analysis ENABLED")
        else:
            logger.info("[PHASE 2] Cross-training analysis DISABLED")

        return tools

    def _validate_context(self, context: PhaseContext) -> None:
        """
        Validate required context data from Phase 1.

        Args:
            context: Phase context to validate

        Raises:
            ValueError: If required data is missing
        """
        required_fields = ["cache_file_path", "athlete_profile_path"]

        for field in required_fields:
            if field not in context.previous_phase_data:
                raise ValueError(
                    f"[PHASE 2] Missing required field from Phase 1: {field}. "
                    f"Available fields: {list(context.previous_phase_data.keys())}"
                )

    def _get_system_prompt(
        self, config: dict[str, Any], context: PhaseContext
    ) -> str:
        """
        Get system prompt for performance analysis.

        Args:
            config: Configuration dictionary
            context: Phase context

        Returns:
            System prompt string
        """
        prompt: str = context.prompts_manager.get_performance_analysis_prompt()
        return prompt

    def _get_user_message(
        self, config: dict[str, Any], context: PhaseContext
    ) -> str:
        """
        Build user message with conditional cross-training section.

        Args:
            config: Configuration dictionary
            context: Phase context with config and previous data

        Returns:
            User message string with instructions
        """
        # Extract file paths from Phase 1
        cache_file_path = context.previous_phase_data.get("cache_file_path", "Not available")
        athlete_profile_path = context.previous_phase_data.get(
            "athlete_profile_path", str(context.config.athlete_profile_path)
        )

        # Determine if cross-training analysis should be performed
        should_analyze_ct = False
        if context.config.analyze_cross_training is None:
            # Auto-detect
            should_analyze_ct = self._should_analyze_cross_training(cache_file_path)
        else:
            # Explicit override
            should_analyze_ct = context.config.analyze_cross_training

        # Build cross-training instructions (empty if not needed)
        if should_analyze_ct:
            cross_training_instructions = context.prompts_manager.get_cross_training_instructions(
                period_months=str(context.config.period_months)
            )
        else:
            cross_training_instructions = ""

        # Build user message with conditional cross-training section
        user_message: str = context.prompts_manager.get_performance_analysis_user_prompt(
            period_months=str(context.config.period_months),
            cache_file_path=cache_file_path,
            athlete_profile_path=athlete_profile_path,
            cross_training_instructions=cross_training_instructions,
        )

        return user_message

    def _extract_data(self, session: ConversationSession) -> dict[str, Any]:
        """
        Extract performance analysis and cross-training data from session.

        Looks for tool results from:
        - analyze_performance: Required, returns performance_analysis_json
        - analyze_cross_training_impact: Optional, returns cross_training_analysis

        Args:
            session: Conversation session with tool results

        Returns:
            Dictionary with extracted data
        """
        extracted: dict[str, Any] = {}

        for message in session.messages:
            if message.role == "tool" and message.tool_results:
                for tool_result in message.tool_results:
                    if not tool_result.get("success"):
                        continue

                    tool_name = tool_result["tool_name"]

                    try:
                        data = json.loads(message.content)

                        if tool_name == "analyze_performance":
                            extracted["performance_analysis_json"] = data
                            logger.debug("[PHASE 2] Extracted performance_analysis_json")

                        elif tool_name == "analyze_cross_training_impact":
                            extracted["cross_training_analysis"] = data
                            logger.debug("[PHASE 2] Extracted cross_training_analysis")

                    except json.JSONDecodeError:
                        logger.warning(
                            f"[PHASE 2] Failed to parse JSON from tool {tool_name}"
                        )
                        continue

        return extracted

    def _should_analyze_cross_training(
        self,
        cache_file_path: str,
        threshold_pct: float = 0.10,
        min_activities: int = 20,
    ) -> bool:
        """
        Auto-detect if cross-training analysis is warranted.

        Analyzes activity distribution in cache to determine if athlete
        participates in multiple sports at a meaningful level.

        Args:
            cache_file_path: Path to Parquet cache file
            threshold_pct: Minimum percentage of non-cycling activities (default: 10%)
            min_activities: Minimum total activities required for analysis (default: 20)

        Returns:
            True if cross-training analysis should be performed, False otherwise

        Criteria for cross-training analysis:
        - At least min_activities total activities in cache
        - At least 2 different activity categories
        - At least threshold_pct of activities are non-cycling
        """
        try:
            import pandas as pd  # type: ignore[import-untyped]

            # Load cache
            cache_path = Path(cache_file_path)
            if not cache_path.exists():
                logger.warning(
                    f"Cache file not found for cross-training detection: {cache_file_path}"
                )
                return False

            df = pd.read_parquet(cache_path)

            # Check minimum activity count
            if len(df) < min_activities:
                logger.info(
                    f"Cross-training analysis skipped: only {len(df)} activities "
                    f"(minimum {min_activities} required)"
                )
                return False

            # Check for activity_category column (added by cache preparation)
            if "activity_category" not in df.columns:
                logger.warning(
                    "Cache missing 'activity_category' column - "
                    "cross-training analysis not available"
                )
                return False

            # Count activities by category
            category_counts = df["activity_category"].value_counts()

            # Need at least 2 categories
            if len(category_counts) < 2:
                logger.info("Cross-training analysis skipped: only 1 activity category detected")
                return False

            # Calculate non-cycling percentage
            non_cycling_count = (df["activity_category"] != "Cycling").sum()
            non_cycling_pct = non_cycling_count / len(df)

            if non_cycling_pct >= threshold_pct:
                logger.info(
                    f"Cross-training analysis enabled: {non_cycling_pct:.1%} non-cycling activities "
                    f"({non_cycling_count}/{len(df)} activities)"
                )
                return True
            else:
                logger.info(
                    f"Cross-training analysis skipped: only {non_cycling_pct:.1%} non-cycling activities "
                    f"(threshold: {threshold_pct:.1%})"
                )
                return False

        except Exception as e:
            logger.error(f"Error during cross-training auto-detection: {str(e)}")
            return False
