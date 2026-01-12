"""
External prompt loader for multi-agent workflows.

Loads prompts from external files organized by model and version:
    prompts/{model}/{version}/performance_analysis.txt
    prompts/{model}/{version}/training_planning.txt
    prompts/{model}/{version}/report_generation.txt

Supports both plain text (.txt) and Jinja2 templates (.jinja2) for prompts.

Note: Phase 1 (data preparation) no longer uses LLM prompts.
Defaults to 'default' model. Version should be specified from .cycling-ai.yaml config.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, TemplateNotFound


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
        version: str | None = None,
    ):
        """
        Initialize prompt loader.

        Args:
            prompts_base_dir: Base directory containing prompts.
                             Defaults to ./prompts relative to project root
            model: Model name (e.g., "default", "gemini", "gpt4")
            version: Version string (e.g., "1.3", "1.2", "1.1")
        """
        if prompts_base_dir is None:
            # Default to prompts/ in project root
            prompts_base_dir = Path(__file__).parents[3] / "prompts"

        if version is None:
            raise ValueError(
                "Prompt version must be specified. This should come from the .cycling-ai.yaml config file."
            )

        self.prompts_base_dir = Path(prompts_base_dir)
        self.model = model
        self.version = version
        self.prompts_dir = self.prompts_base_dir / model / version

        self._prompts_cache: dict[str, str] = {}
        self._metadata: dict[str, Any] | None = None

        # Initialize Jinja2 environment
        self._jinja_env = Environment(
            loader=FileSystemLoader(str(self.prompts_dir)),
            autoescape=False,  # Prompts are plain text, not HTML
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def get_prompts_dir(self) -> Path:
        """Get the full path to the prompts directory."""
        return self.prompts_dir

    def get_version(self) -> str:
        """
        Get the prompt version string for logging.

        Returns:
            Version string (e.g., "1.3", "2.0")
        """
        return self.version

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
                f"Metadata file not found: {metadata_file}\nModel: {self.model}, Version: {self.version}"
            )

        with open(metadata_file, encoding="utf-8") as f:
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
        with open(prompt_file, encoding="utf-8") as f:
            prompt_text = f.read().strip()

        self._prompts_cache[agent_name] = prompt_text
        return prompt_text

    def render_prompt(self, agent_name: str, **template_vars: Any) -> str:
        """
        Load and render a prompt template with Jinja2 variables.

        Supports both plain .txt files (uses format()) and .jinja2 templates.

        Args:
            agent_name: Name of the agent/prompt
            **template_vars: Variables to pass to the template

        Returns:
            Rendered prompt text

        Raises:
            FileNotFoundError: If neither .jinja2 nor .txt file exists
        """
        # Try .jinja2 first
        jinja_file = f"{agent_name}.jinja2"
        txt_file = f"{agent_name}.txt"

        try:
            # Try loading as Jinja2 template
            template = self._jinja_env.get_template(jinja_file)
            return template.render(**template_vars)
        except TemplateNotFound as e:
            # Fall back to .txt with string formatting
            txt_path = self.prompts_dir / txt_file
            if not txt_path.exists():
                raise FileNotFoundError(
                    f"Prompt file not found: neither {jinja_file} nor {txt_file} exists\n"
                    f"Model: {self.model}, Version: {self.version}, Agent: {agent_name}"
                ) from e

            with open(txt_path, encoding="utf-8") as f:
                prompt_text = f.read().strip()

            # Use Python string formatting for .txt files
            return prompt_text.format(**template_vars)

    def load_all_prompts(self) -> dict[str, str]:
        """
        Load all prompts for the current model/version.

        Returns:
            Dictionary mapping agent names to prompt text
        """
        metadata = self.load_metadata()
        prompts = {}

        for agent_name in metadata.get("agents", {}):
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

    def get_training_planning_prompt(self, **kwargs: Any) -> str:
        """
        Get training planning agent prompt (system prompt with template variables).

        Args:
            **kwargs: Template variables for formatting the system prompt

        Returns:
            Formatted system prompt for training planning
        """
        # Load the prompt template
        prompt_template = self.load_prompt("training_planning")

        # Format with provided variables (v1.2 prompts use template variables)
        try:
            return prompt_template.format(**kwargs)
        except KeyError as e:
            # If template variable is missing, return unformatted
            # (for backward compatibility with v1.1 prompts that don't use variables)
            import logging

            logging.warning(f"Missing template variable in training_planning prompt: {e}")
            return prompt_template

    def get_report_generation_prompt(self) -> str:
        """Get report generation agent prompt."""
        return self.load_prompt("report_generation")

    def load_user_prompt(self, agent_name: str, **kwargs: Any) -> str:
        """
        Load and format a user prompt with template variables.

        Supports both .txt (Python format strings) and .jinja2 (Jinja2 templates).

        Args:
            agent_name: Name of the agent (e.g., "data_preparation")
            **kwargs: Template variables to format into the prompt

        Returns:
            Formatted user prompt text

        Raises:
            FileNotFoundError: If user prompt file doesn't exist
        """
        # Use the new render_prompt method which supports both .txt and .jinja2
        return self.render_prompt(f"{agent_name}_user", **kwargs)

    def get_performance_analysis_user_prompt(self, **kwargs: Any) -> str:
        """Get performance analysis user prompt with formatting."""
        return self.load_user_prompt("performance_analysis", **kwargs)

    def get_training_planning_overview_prompt(self, **kwargs: Any) -> str:
        """Get training planning overview system prompt (Phase 3a)."""
        prompt_template = self.load_prompt("training_planning_overview")
        try:
            return prompt_template.format(**kwargs)
        except KeyError as e:
            import logging

            logging.warning(f"Missing template variable in training_planning_overview prompt: {e}")
            return prompt_template

    def get_training_planning_overview_user_prompt(self, **kwargs: Any) -> str:
        """Get training planning overview user prompt (Phase 3a)."""
        return self.load_user_prompt("training_planning_overview", **kwargs)

    def get_training_planning_weeks_prompt(self, **kwargs: Any) -> str:
        """Get training planning weeks system prompt (Phase 3b)."""
        prompt_template = self.load_prompt("training_planning_weeks")
        try:
            return prompt_template.format(**kwargs)
        except KeyError as e:
            import logging

            logging.warning(f"Missing template variable in training_planning_weeks prompt: {e}")
            return prompt_template

    def get_training_planning_weeks_user_prompt(self, **kwargs: Any) -> str:
        """Get training planning weeks user prompt (Phase 3b)."""
        return self.load_user_prompt("training_planning_weeks", **kwargs)

    def get_training_planning_user_prompt(self, **kwargs: Any) -> str:
        """
        Get training planning user prompt with dynamic example generation.

        Generates a personalized example week based on athlete's available days
        and weekly time budget.
        """
        # Generate dynamic example workouts based on available days
        available_days_str = kwargs.get("available_days", "")
        weekly_hours = float(kwargs.get("weekly_time_budget_hours", 7))

        # Parse available days
        available_days = [day.strip() for day in available_days_str.split(",")]
        num_days = len(available_days)

        # Calculate example durations to hit ~90% of weekly budget
        target_minutes = int(weekly_hours * 60 * 0.9)  # Aim for 90% to leave margin

        # Distribute time across days (longer on weekends, shorter on weekdays)
        example_workouts_list = []
        total_minutes = 0

        # Count weekend vs weekday days
        weekend_days = [d for d in available_days if d in ["Saturday", "Sunday"]]
        weekday_days = [d for d in available_days if d not in ["Saturday", "Sunday"]]

        # Allocate 60% to weekends, 40% to weekdays (if both exist)
        if weekend_days and weekday_days:
            weekend_total = int(target_minutes * 0.60)
            weekday_total = target_minutes - weekend_total
            weekend_per_day = weekend_total // len(weekend_days)
            weekday_per_day = weekday_total // len(weekday_days)
        elif weekend_days:
            # Only weekends available
            weekend_per_day = target_minutes // len(weekend_days)
            weekday_per_day = 0
        else:
            # Only weekdays available
            weekday_per_day = target_minutes // len(weekday_days)
            weekend_per_day = 0

        for day in available_days:
            # Assign duration based on day type
            duration = weekend_per_day if day in ["Saturday", "Sunday"] else weekday_per_day

            # Round to nice numbers
            duration = max(40, min(240, duration))  # Between 40 and 240 minutes
            duration = int(duration / 10) * 10  # Round to nearest 10

            total_minutes += duration

            # Create workout example
            if duration >= 150:  # Long ride
                workout_json = f"""    {{
      "weekday": "{day}",
      "description": "Long endurance ride",
      "structure": {{
        "primaryIntensityMetric": "percentOfFtp",
        "primaryLengthMetric": "duration",
        "structure": [
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Z2 aerobic base",
                "intensityClass": "active",
                "length": {{"unit": "minute", "value": {duration}}},
                "targets": [{{"type": "power", "minValue": 56, "maxValue": 75, "unit": "percentOfFtp"}}]
              }}
            ]
          }}
        ]
      }}
    }}"""
            elif duration >= 70:  # Interval workout
                warmup = 15
                cooldown = 15
                work = duration - warmup - cooldown
                interval_time = work // 3
                recovery_time = work - (interval_time * 2)

                workout_json = f"""    {{
      "weekday": "{day}",
      "description": "Tempo intervals",
      "structure": {{
        "primaryIntensityMetric": "percentOfFtp",
        "primaryLengthMetric": "duration",
        "structure": [
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Easy spin",
                "intensityClass": "warmUp",
                "length": {{"unit": "minute", "value": {warmup}}},
                "targets": [{{"type": "power", "minValue": 50, "maxValue": 65, "unit": "percentOfFtp"}}]
              }}
            ]
          }},
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Z3 tempo",
                "intensityClass": "active",
                "length": {{"unit": "minute", "value": {interval_time}}},
                "targets": [{{"type": "power", "minValue": 76, "maxValue": 90, "unit": "percentOfFtp"}}]
              }}
            ]
          }},
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Easy spin",
                "intensityClass": "rest",
                "length": {{"unit": "minute", "value": {recovery_time}}},
                "targets": [{{"type": "power", "minValue": 50, "maxValue": 65, "unit": "percentOfFtp"}}]
              }}
            ]
          }},
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Z3 tempo",
                "intensityClass": "active",
                "length": {{"unit": "minute", "value": {interval_time}}},
                "targets": [{{"type": "power", "minValue": 76, "maxValue": 90, "unit": "percentOfFtp"}}]
              }}
            ]
          }},
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Cool down",
                "intensityClass": "coolDown",
                "length": {{"unit": "minute", "value": {cooldown}}},
                "targets": [{{"type": "power", "minValue": 50, "maxValue": 60, "unit": "percentOfFtp"}}]
              }}
            ]
          }}
        ]
      }}
    }}"""
            else:  # Recovery ride
                workout_json = f"""    {{
      "weekday": "{day}",
      "description": "Recovery ride",
      "structure": {{
        "primaryIntensityMetric": "percentOfFtp",
        "primaryLengthMetric": "duration",
        "structure": [
          {{
            "type": "step",
            "length": {{"unit": "repetition", "value": 1}},
            "steps": [
              {{
                "name": "Z1 recovery",
                "intensityClass": "active",
                "length": {{"unit": "minute", "value": {duration}}},
                "targets": [{{"type": "power", "minValue": 50, "maxValue": 55, "unit": "percentOfFtp"}}]
              }}
            ]
          }}
        ]
      }}
    }}"""

            example_workouts_list.append(workout_json)

        # Join workouts with commas
        example_workouts = ",\n".join(example_workouts_list)

        # Calculate totals
        example_total_hours = round(total_minutes / 60, 1)

        # Add generated fields to kwargs
        kwargs["num_available_days"] = num_days
        kwargs["example_workouts"] = example_workouts
        kwargs["example_total_minutes"] = total_minutes
        kwargs["example_total_hours"] = example_total_hours

        # Now load and format the prompt with all kwargs
        return self.load_user_prompt("training_planning", **kwargs)

    def get_report_generation_user_prompt(self, **kwargs: Any) -> str:
        """Get report generation user prompt with formatting."""
        return self.load_user_prompt("report_generation", **kwargs)

    def get_cross_training_instructions(self, **kwargs: Any) -> str:
        """
        Get cross-training addon instructions for performance analysis.

        Returns instructions for analyzing cross-training impact, or empty string
        if cross-training analysis is not needed.

        Args:
            **kwargs: Template variables (period_months)

        Returns:
            Formatted cross-training instructions or empty string
        """
        addon_file = self.prompts_dir / "performance_analysis_cross_training_addon.txt"

        if not addon_file.exists():
            # Graceful degradation - return empty string if addon doesn't exist
            import logging

            logging.warning(
                f"Cross-training addon file not found: {addon_file}. Cross-training analysis will not be available."
            )
            return ""

        # Load addon template
        with open(addon_file, encoding="utf-8") as f:
            template = f.read().strip()

        # Format with provided variables
        return template.format(**kwargs)

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
        return self.load_prompt("profile_onboarding")

    def get_compliance_coach_prompt(self) -> str:
        """
        Get compliance coach system prompt.

        Returns system prompt for analyzing workout compliance and
        generating personalized coaching feedback.

        Returns:
            System prompt for compliance coaching

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        return self.load_prompt("compliance_coach")

    def get_compliance_coach_user_prompt(self, **kwargs: Any) -> str:
        """
        Get compliance coach user prompt with workout compliance data.

        Args:
            **kwargs: Template variables including:
                - workout_name: Name of the workout
                - workout_type: Type of workout (endurance, intervals, etc.)
                - workout_date: Date of the workout
                - workout_description: Description of the workout
                - athlete_ftp: Athlete's FTP in watts
                - athlete_lthr: Athlete's LTHR in bpm (or "Not set")
                - overall_score: Compliance score (0-100)
                - overall_grade: Letter grade (A-F)
                - overall_summary: Text summary of compliance
                - segments_completed: Number of segments completed
                - segments_skipped: Number of segments skipped
                - segments_total: Total number of segments
                - power_data_quality: Quality assessment of power data
                - power_stream_length: Length of power stream in seconds
                - segment_details: Formatted string of segment-by-segment analysis

        Returns:
            Formatted user prompt with compliance data
        """
        return self.load_user_prompt("compliance_coach", **kwargs)

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

        return [d.name for d in model_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]


def get_prompt_loader(
    model: str | None = None,
    version: str | None = None,
    prompts_dir: Path | str | None = None,
) -> PromptLoader:
    """
    Create a PromptLoader with defaults.

    Args:
        model: Model name (defaults to "default")
        version: Version string (should be provided from .cycling-ai.yaml config)
        prompts_dir: Base directory (defaults to ./prompts)

    Returns:
        Configured PromptLoader

    Raises:
        ValueError: If version is not provided
    """
    if version is None:
        raise ValueError("Prompt version must be specified. This should come from the .cycling-ai.yaml config file.")

    return PromptLoader(
        prompts_base_dir=prompts_dir,
        model=model or "default",
        version=version,
    )
