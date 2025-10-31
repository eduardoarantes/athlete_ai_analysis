"""
External prompt loader for multi-agent workflows.

Loads prompts from external files organized by model and version:
    prompts/{model}/{version}/performance_analysis.txt
    prompts/{model}/{version}/training_planning.txt
    prompts/{model}/{version}/report_generation.txt

Note: Phase 1 (data preparation) no longer uses LLM prompts.
Defaults to 'default' model and '1.1' version if not specified.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class PromptLoader:
    """
    Loads prompts from external files with model/version organization.

    Directory structure:
        prompts/
            default/
                1.1/
                    metadata.json
                    performance_analysis.txt
                    training_planning.txt
                    report_generation.txt
            gemini/
                1.0/
                    ...
            gpt4/
                2.0/
                    ...
    """

    def __init__(
        self,
        prompts_base_dir: Path | str | None = None,
        model: str = "default",
        version: str = "1.1",
    ):
        """
        Initialize prompt loader.

        Args:
            prompts_base_dir: Base directory containing prompts.
                             Defaults to ./prompts relative to project root
            model: Model name (e.g., "default", "gemini", "gpt4")
            version: Version string (e.g., "1.0", "2.0")
        """
        if prompts_base_dir is None:
            # Default to prompts/ in project root
            prompts_base_dir = Path(__file__).parents[3] / "prompts"

        self.prompts_base_dir = Path(prompts_base_dir)
        self.model = model
        self.version = version
        self.prompts_dir = self.prompts_base_dir / model / version

        self._prompts_cache: dict[str, str] = {}
        self._metadata: dict[str, Any] | None = None

    def get_prompts_dir(self) -> Path:
        """Get the full path to the prompts directory."""
        return self.prompts_dir

    def exists(self) -> bool:
        """Check if the prompts directory exists."""
        return self.prompts_dir.exists() and self.prompts_dir.is_dir()

    def load_metadata(self) -> dict[str, Any]:
        """
        Load metadata.json for the current model/version.

        Returns:
            Metadata dictionary

        Raises:
            FileNotFoundError: If metadata.json doesn't exist
        """
        if self._metadata is not None:
            return self._metadata

        metadata_file = self.prompts_dir / "metadata.json"
        if not metadata_file.exists():
            raise FileNotFoundError(
                f"Metadata file not found: {metadata_file}\n"
                f"Model: {self.model}, Version: {self.version}"
            )

        with open(metadata_file, "r", encoding="utf-8") as f:
            self._metadata = json.load(f)

        return self._metadata

    def load_prompt(self, agent_name: str) -> str:
        """
        Load a specific prompt file.

        Args:
            agent_name: Name of the agent (e.g., "data_preparation")

        Returns:
            Prompt text

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        # Check cache first
        if agent_name in self._prompts_cache:
            return self._prompts_cache[agent_name]

        # Determine filename
        prompt_file = self.prompts_dir / f"{agent_name}.txt"

        if not prompt_file.exists():
            raise FileNotFoundError(
                f"Prompt file not found: {prompt_file}\n"
                f"Model: {self.model}, Version: {self.version}, Agent: {agent_name}"
            )

        # Load and cache
        with open(prompt_file, "r", encoding="utf-8") as f:
            prompt_text = f.read().strip()

        self._prompts_cache[agent_name] = prompt_text
        return prompt_text

    def load_all_prompts(self) -> dict[str, str]:
        """
        Load all prompts for the current model/version.

        Returns:
            Dictionary mapping agent names to prompt text
        """
        metadata = self.load_metadata()
        prompts = {}

        for agent_name in metadata.get("agents", {}).keys():
            try:
                prompts[agent_name] = self.load_prompt(agent_name)
            except FileNotFoundError as e:
                # Log warning but don't fail
                import logging
                logging.warning(f"Failed to load prompt for {agent_name}: {e}")

        return prompts

    def get_performance_analysis_prompt(self) -> str:
        """Get performance analysis agent prompt."""
        return self.load_prompt("performance_analysis")

    def get_training_planning_prompt(self) -> str:
        """Get training planning agent prompt."""
        return self.load_prompt("training_planning")

    def get_report_generation_prompt(self) -> str:
        """Get report generation agent prompt."""
        return self.load_prompt("report_generation")

    def load_user_prompt(self, agent_name: str, **kwargs: Any) -> str:
        """
        Load and format a user prompt with template variables.

        Args:
            agent_name: Name of the agent (e.g., "data_preparation")
            **kwargs: Template variables to format into the prompt

        Returns:
            Formatted user prompt text

        Raises:
            FileNotFoundError: If user prompt file doesn't exist
        """
        # Check cache first
        cache_key = f"{agent_name}_user"
        if cache_key in self._prompts_cache:
            template = self._prompts_cache[cache_key]
        else:
            # Determine filename
            prompt_file = self.prompts_dir / f"{agent_name}_user.txt"

            if not prompt_file.exists():
                raise FileNotFoundError(
                    f"User prompt file not found: {prompt_file}\n"
                    f"Model: {self.model}, Version: {self.version}, Agent: {agent_name}"
                )

            # Load and cache
            with open(prompt_file, "r", encoding="utf-8") as f:
                template = f.read().strip()

            self._prompts_cache[cache_key] = template

        # Format with provided variables
        return template.format(**kwargs)

    def get_performance_analysis_user_prompt(self, **kwargs: Any) -> str:
        """Get performance analysis user prompt with formatting."""
        return self.load_user_prompt("performance_analysis", **kwargs)

    def get_training_planning_user_prompt(self, **kwargs: Any) -> str:
        """Get training planning user prompt with formatting."""
        return self.load_user_prompt("training_planning", **kwargs)

    def get_report_generation_user_prompt(self, **kwargs: Any) -> str:
        """Get report generation user prompt with formatting."""
        return self.load_user_prompt("report_generation", **kwargs)

    @staticmethod
    def list_available_models(prompts_base_dir: Path | str | None = None) -> list[str]:
        """
        List all available model directories.

        Args:
            prompts_base_dir: Base directory containing prompts

        Returns:
            List of model names
        """
        if prompts_base_dir is None:
            prompts_base_dir = Path(__file__).parents[3] / "prompts"

        base_dir = Path(prompts_base_dir)
        if not base_dir.exists():
            return []

        return [d.name for d in base_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]

    @staticmethod
    def list_available_versions(
        model: str,
        prompts_base_dir: Path | str | None = None,
    ) -> list[str]:
        """
        List all available versions for a model.

        Args:
            model: Model name
            prompts_base_dir: Base directory containing prompts

        Returns:
            List of version strings
        """
        if prompts_base_dir is None:
            prompts_base_dir = Path(__file__).parents[3] / "prompts"

        model_dir = Path(prompts_base_dir) / model
        if not model_dir.exists():
            return []

        return [
            d.name
            for d in model_dir.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        ]


def get_prompt_loader(
    model: str | None = None,
    version: str | None = None,
    prompts_dir: Path | str | None = None,
) -> PromptLoader:
    """
    Create a PromptLoader with defaults.

    Args:
        model: Model name (defaults to "default")
        version: Version string (defaults to "1.0")
        prompts_dir: Base directory (defaults to ./prompts)

    Returns:
        Configured PromptLoader
    """
    return PromptLoader(
        prompts_base_dir=prompts_dir,
        model=model or "default",
        version=version or "1.1",
    )
