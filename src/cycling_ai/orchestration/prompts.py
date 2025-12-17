"""
Agent prompts manager for multi-agent workflow.

Loads specialized system prompts for each workflow phase from external files.
All prompts are stored in the /prompts directory with model/version organization.

Uses PromptLoader for prompt management - no hardcoded prompts.
"""

from __future__ import annotations

from pathlib import Path

from cycling_ai.orchestration.prompt_loader import get_prompt_loader


class AgentPromptsManager:
    """
    Manages specialized system prompts for workflow agents.

    Loads all prompts from external files using PromptLoader.
    No embedded/hardcoded prompts - forces proper prompt file organization.
    """

    def __init__(
        self,
        prompts_dir: Path | None = None,
        model: str | None = None,
        version: str | None = None,
    ):
        """
        Initialize prompts manager.

        Args:
            prompts_dir: Optional custom directory with prompts (legacy mode)
            model: Model name for PromptLoader (e.g., "default", "gemini")
            version: Version string for PromptLoader (e.g., "1.0", "2.0")

        Raises:
            FileNotFoundError: If prompt files cannot be found
        """
        self._prompt_loader = get_prompt_loader(prompts_dir=prompts_dir, model=model, version=version)

        # Verify prompts exist
        if not self._prompt_loader.exists():
            raise FileNotFoundError(
                f"Prompt files not found at {self._prompt_loader.prompts_dir}. "
                f"Model: {self._prompt_loader.model}, Version: {self._prompt_loader.version}"
            )

    def get_performance_analysis_prompt(self) -> str:
        """
        Get performance analysis agent system prompt.

        Returns:
            System prompt for performance analysis phase

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_performance_analysis_prompt()

    def get_training_planning_prompt(self, **kwargs: str) -> str:
        """
        Get training planning agent system prompt with optional template formatting.

        Args:
            **kwargs: Optional template variables for formatting (available_days, weekly_time_budget_hours, etc.)

        Returns:
            System prompt for training planning phase (formatted if kwargs provided)

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_training_planning_prompt(**kwargs)

    def get_report_generation_prompt(self) -> str:
        """
        Get report generation agent system prompt.

        Returns:
            System prompt for report generation phase

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_report_generation_prompt()

    def get_performance_analysis_user_prompt(self, **kwargs: str) -> str:
        """
        Get performance analysis user prompt with template formatting.

        Args:
            **kwargs: Template variables (period_months)

        Returns:
            Formatted user prompt

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_performance_analysis_user_prompt(**kwargs)

    def get_training_planning_user_prompt(self, **kwargs: str) -> str:
        """
        Get training planning user prompt with template formatting.

        Args:
            **kwargs: Template variables (training_plan_weeks)

        Returns:
            Formatted user prompt

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_training_planning_user_prompt(**kwargs)

    def get_training_planning_overview_prompt(self, **kwargs: str) -> str:
        """
        Get training planning overview system prompt (Phase 3a).

        Args:
            **kwargs: Template variables

        Returns:
            Formatted system prompt
        """
        return self._prompt_loader.get_training_planning_overview_prompt(**kwargs)

    def get_training_planning_overview_user_prompt(self, **kwargs: str) -> str:
        """
        Get training planning overview user prompt (Phase 3a).

        Args:
            **kwargs: Template variables

        Returns:
            Formatted user prompt
        """
        return self._prompt_loader.get_training_planning_overview_user_prompt(**kwargs)

    def get_training_planning_weeks_prompt(self, **kwargs: str) -> str:
        """
        Get training planning weeks system prompt (Phase 3b).

        Args:
            **kwargs: Template variables

        Returns:
            Formatted system prompt
        """
        return self._prompt_loader.get_training_planning_weeks_prompt(**kwargs)

    def get_training_planning_weeks_user_prompt(self, **kwargs: str) -> str:
        """
        Get training planning weeks user prompt (Phase 3b).

        Args:
            **kwargs: Template variables

        Returns:
            Formatted user prompt
        """
        return self._prompt_loader.get_training_planning_weeks_user_prompt(**kwargs)

    def get_report_generation_user_prompt(self, **kwargs: str) -> str:
        """
        Get report generation user prompt with template formatting.

        Args:
            **kwargs: Template variables (output_dir)

        Returns:
            Formatted user prompt

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_report_generation_user_prompt(**kwargs)

    def get_cross_training_instructions(self, **kwargs: str) -> str:
        """
        Get cross-training addon instructions for performance analysis.

        Returns formatted cross-training instructions if needed, or empty string
        if cross-training analysis should not be performed.

        Args:
            **kwargs: Template variables (period_months)

        Returns:
            Formatted cross-training instructions or empty string
        """
        return self._prompt_loader.get_cross_training_instructions(**kwargs)

    def get_profile_onboarding_prompt(self) -> str:
        """
        Get profile onboarding system prompt for chat sessions.

        Returns system prompt that guides the LLM to collect athlete profile
        information conversationally and create the profile using tools.

        Returns:
            System prompt for profile onboarding mode

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_profile_onboarding_prompt()
