"""Tests for cross-training auto-detection logic."""
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
from cycling_ai.providers.base import ProviderConfig
from cycling_ai.providers.openai_provider import OpenAIProvider


@pytest.fixture
def mock_provider():
    """Create a mock provider for testing."""
    config = ProviderConfig(
        provider_name="openai",
        api_key="test-key",
        model="gpt-4",
    )
    return OpenAIProvider(config)


@pytest.fixture
def temp_cache_dir():
    """Create temporary directory for cache files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def create_test_cache(cache_path: Path, activities: list[dict]) -> str:
    """Create a test Parquet cache file with activity data."""
    df = pd.DataFrame(activities)
    cache_file = cache_path / "activities_processed.parquet"
    df.to_parquet(cache_file)
    return str(cache_file)


class TestCrossTrainingAutoDetection:
    """Test suite for cross-training auto-detection."""

    def test_multi_sport_athlete_detected(self, mock_provider, temp_cache_dir):
        """Test that multi-sport athlete is correctly detected."""
        # Create cache with 60% cycling, 30% strength, 10% running
        activities = (
            [{"activity_category": "Cycling"}] * 60
            + [{"activity_category": "Strength"}] * 30
            + [{"activity_category": "Cardio"}] * 10
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is True, "Should detect multi-sport athlete with 40% non-cycling"

    def test_cycling_only_athlete_not_detected(self, mock_provider, temp_cache_dir):
        """Test that cycling-only athlete is not flagged for cross-training."""
        # Create cache with 100% cycling
        activities = [{"activity_category": "Cycling"}] * 50
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is False, "Should not detect cross-training for cycling-only athlete"

    def test_threshold_boundary_10_percent(self, mock_provider, temp_cache_dir):
        """Test detection at exactly 10% non-cycling threshold."""
        # Create cache with 90% cycling, 10% strength (exactly at threshold)
        activities = (
            [{"activity_category": "Cycling"}] * 90
            + [{"activity_category": "Strength"}] * 10
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is True, "Should detect at exactly 10% threshold"

    def test_below_threshold_9_percent(self, mock_provider, temp_cache_dir):
        """Test no detection just below 10% threshold."""
        # Create cache with 91% cycling, 9% strength (below threshold)
        activities = (
            [{"activity_category": "Cycling"}] * 91
            + [{"activity_category": "Strength"}] * 9
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is False, "Should not detect below 10% threshold"

    def test_minimum_activity_count_20(self, mock_provider, temp_cache_dir):
        """Test that minimum 20 activities is required."""
        # Create cache with 19 activities (below minimum)
        activities = (
            [{"activity_category": "Cycling"}] * 10
            + [{"activity_category": "Strength"}] * 9
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is False, "Should not detect with less than 20 activities"

    def test_exactly_20_activities_at_threshold(self, mock_provider, temp_cache_dir):
        """Test detection with exactly 20 activities at threshold."""
        # Create cache with 20 activities: 18 cycling (90%), 2 strength (10%)
        activities = (
            [{"activity_category": "Cycling"}] * 18
            + [{"activity_category": "Strength"}] * 2
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is True, "Should detect with exactly 20 activities at threshold"

    def test_requires_at_least_2_categories(self, mock_provider, temp_cache_dir):
        """Test that at least 2 different activity categories are required."""
        # Create cache with 50 cycling activities (only 1 category)
        activities = [{"activity_category": "Cycling"}] * 50
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is False, "Should not detect with only 1 category"

    def test_triathlete_detected(self, mock_provider, temp_cache_dir):
        """Test detection of triathlete with 3 sport categories."""
        # Create cache with cycling, running, swimming
        activities = (
            [{"activity_category": "Cycling"}] * 30
            + [{"activity_category": "Cardio"}] * 20  # Running
            + [{"activity_category": "Cardio"}] * 10  # Swimming
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is True, "Should detect triathlete with 50% non-cycling"

    def test_cache_file_not_found(self, mock_provider, temp_cache_dir):
        """Test graceful handling of missing cache file."""
        non_existent_cache = str(temp_cache_dir / "nonexistent.parquet")

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(non_existent_cache)

        assert result is False, "Should return False for missing cache file"

    def test_cache_missing_activity_category_column(self, mock_provider, temp_cache_dir):
        """Test graceful handling of cache without activity_category column."""
        # Create cache without activity_category column
        activities = [{"some_other_column": "value"}] * 30
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is False, "Should return False for cache without activity_category"

    def test_custom_threshold_15_percent(self, mock_provider, temp_cache_dir):
        """Test with custom threshold of 15%."""
        # Create cache with 86% cycling, 14% strength
        activities = (
            [{"activity_category": "Cycling"}] * 86
            + [{"activity_category": "Strength"}] * 14
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)

        # Should pass with default 10% threshold
        assert orchestrator._should_analyze_cross_training(cache_file) is True

        # Should fail with 15% threshold
        assert orchestrator._should_analyze_cross_training(cache_file, threshold_pct=0.15) is False

    def test_custom_min_activities_50(self, mock_provider, temp_cache_dir):
        """Test with custom minimum activity count of 50."""
        # Create cache with 40 activities (below custom minimum)
        activities = (
            [{"activity_category": "Cycling"}] * 28
            + [{"activity_category": "Strength"}] * 12
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)

        # Should pass with default 20 minimum
        assert orchestrator._should_analyze_cross_training(cache_file) is True

        # Should fail with 50 minimum
        assert orchestrator._should_analyze_cross_training(cache_file, min_activities=50) is False

    def test_real_world_casual_cross_trainer(self, mock_provider, temp_cache_dir):
        """Test realistic scenario: cyclist who does occasional gym work."""
        # 75% cycling, 25% strength
        activities = (
            [{"activity_category": "Cycling"}] * 75
            + [{"activity_category": "Strength"}] * 25
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is True, "Should detect casual cross-trainer with 25% non-cycling"

    def test_real_world_dedicated_cyclist_with_yoga(self, mock_provider, temp_cache_dir):
        """Test realistic scenario: dedicated cyclist with occasional yoga."""
        # 95% cycling, 5% other (yoga/stretching)
        activities = (
            [{"activity_category": "Cycling"}] * 95
            + [{"activity_category": "Other"}] * 5
        )
        cache_file = create_test_cache(temp_cache_dir, activities)

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator._should_analyze_cross_training(cache_file)

        assert result is False, "Should not flag 5% supplemental work as cross-training"
