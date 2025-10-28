"""Tests for agent prompts manager."""
from pathlib import Path

import pytest

from cycling_ai.orchestration.prompts import AgentPromptsManager


class TestAgentPromptsManager:
    """Test AgentPromptsManager with external prompts."""

    def test_initialization_with_defaults(self) -> None:
        """Test creating manager with default prompts."""
        manager = AgentPromptsManager()

        # Should load from prompts/default/1.0/
        assert manager._prompt_loader is not None
        assert manager._prompt_loader.exists()

    def test_get_data_preparation_prompt_default(self) -> None:
        """Test getting data preparation prompt from default prompts."""
        manager = AgentPromptsManager()
        prompt = manager.get_data_preparation_prompt()

        assert prompt
        assert len(prompt) > 100
        assert "data" in prompt.lower() or "preparation" in prompt.lower()

    def test_get_performance_analysis_prompt_default(self) -> None:
        """Test getting performance analysis prompt from default prompts."""
        manager = AgentPromptsManager()
        prompt = manager.get_performance_analysis_prompt()

        assert prompt
        assert len(prompt) > 100
        assert "performance" in prompt.lower() or "analysis" in prompt.lower()

    def test_get_training_planning_prompt_default(self) -> None:
        """Test getting training planning prompt from default prompts."""
        manager = AgentPromptsManager()
        prompt = manager.get_training_planning_prompt()

        assert prompt
        assert len(prompt) > 100
        assert "training" in prompt.lower() or "plan" in prompt.lower()

    def test_get_report_generation_prompt_default(self) -> None:
        """Test getting report generation prompt from default prompts."""
        manager = AgentPromptsManager()
        prompt = manager.get_report_generation_prompt()

        assert prompt
        assert len(prompt) > 100
        assert "report" in prompt.lower()

    def test_get_data_preparation_user_prompt_with_formatting(self) -> None:
        """Test user prompt with template formatting."""
        manager = AgentPromptsManager()
        prompt = manager.get_data_preparation_user_prompt(
            csv_file_path="/path/to/data.csv",
            athlete_profile_path="/path/to/profile.json",
            fit_dir_path="/path/to/fit/",
            output_dir_path="/path/to/output",
            mode_specific_instructions="Test mode instructions"
        )

        assert prompt
        assert "/path/to/data.csv" in prompt or "data.csv" in prompt

    def test_get_performance_analysis_user_prompt_with_formatting(self) -> None:
        """Test performance analysis user prompt formatting."""
        manager = AgentPromptsManager()
        prompt = manager.get_performance_analysis_user_prompt(
            period_months=6
        )

        assert prompt
        assert "6" in prompt

    def test_get_training_planning_user_prompt_with_formatting(self) -> None:
        """Test training planning user prompt formatting."""
        manager = AgentPromptsManager()
        prompt = manager.get_training_planning_user_prompt(
            training_plan_weeks=12
        )

        assert prompt
        assert "12" in prompt

    def test_get_report_generation_user_prompt_with_formatting(self) -> None:
        """Test report generation user prompt formatting."""
        manager = AgentPromptsManager()
        prompt = manager.get_report_generation_user_prompt(
            output_dir="/path/to/output"
        )

        assert prompt
        assert "/path/to/output" in prompt or "output" in prompt

    def test_initialization_with_model_version(self) -> None:
        """Test creating manager with specific model and version."""
        manager = AgentPromptsManager(model="default", version="1.0")

        assert manager._prompt_loader is not None
        assert manager._prompt_loader.model == "default"
        assert manager._prompt_loader.version == "1.0"

    def test_missing_prompts_raises_error(self) -> None:
        """Test that missing prompt files raise an error."""
        with pytest.raises(FileNotFoundError):
            AgentPromptsManager(model="nonexistent", version="99.9")

    def test_all_prompts_have_content(self) -> None:
        """Test that all prompts can be loaded and have content."""
        manager = AgentPromptsManager()

        # Test all system prompts
        data_prep = manager.get_data_preparation_prompt()
        perf_analysis = manager.get_performance_analysis_prompt()
        training = manager.get_training_planning_prompt()
        report = manager.get_report_generation_prompt()

        assert data_prep and len(data_prep) > 50
        assert perf_analysis and len(perf_analysis) > 50
        assert training and len(training) > 50
        assert report and len(report) > 50

    def test_user_prompts_support_template_variables(self) -> None:
        """Test that user prompts support template variable substitution."""
        manager = AgentPromptsManager()

        # Test with various template variables
        data_prompt = manager.get_data_preparation_user_prompt(
            csv_file_path="test.csv",
            athlete_profile_path="profile.json",
            fit_dir_path="fits/",
            output_dir_path="output/",
            mode_specific_instructions="Test instructions"
        )
        assert data_prompt

        perf_prompt = manager.get_performance_analysis_user_prompt(period_months=3)
        assert perf_prompt

        training_prompt = manager.get_training_planning_user_prompt(training_plan_weeks=8)
        assert training_prompt

        report_prompt = manager.get_report_generation_user_prompt(output_dir="output/")
        assert report_prompt
