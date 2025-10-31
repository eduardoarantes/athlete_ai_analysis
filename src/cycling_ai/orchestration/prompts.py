"""
Agent prompts manager for multi-agent workflow.

Loads specialized system prompts for each workflow phase from external files.
All prompts are stored in the /prompts directory with model/version organization.

Uses PromptLoader for prompt management - no hardcoded prompts.
"""
from __future__ import annotations

from pathlib import Path

from cycling_ai.orchestration.prompt_loader import PromptLoader, get_prompt_loader


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
        self._prompt_loader = get_prompt_loader(
            prompts_dir=prompts_dir,
            model=model,
            version=version
        )

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

    def get_training_planning_prompt(self) -> str:
        """
        Get training planning agent system prompt.

        Returns:
            System prompt for training planning phase

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self._prompt_loader.get_training_planning_prompt()

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
