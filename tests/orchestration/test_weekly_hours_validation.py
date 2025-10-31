"""Tests for weekly hours validation with 10% tolerance."""
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


class TestWeeklyHoursValidation:
    """Test suite for weekly hours validation."""

    def test_within_guideline_no_violations(self, mock_provider):
        """Test that plan within guideline produces no violations."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 60},  # 1 hour
                        {"duration_minutes": 90},  # 1.5 hours
                        {"duration_minutes": 120}, # 2 hours
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7  # Guideline: 7 hours
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        # Total: 4.5 hours < 7.7 hours (7 * 1.1)
        assert violations == [], "Should have no violations when within guideline"

    def test_within_10_percent_tolerance_no_violations(self, mock_provider):
        """Test that plan within 10% tolerance produces no violations."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 120},  # 2 hours
                        {"duration_minutes": 150},  # 2.5 hours
                        {"duration_minutes": 180},  # 3 hours
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7  # Guideline: 7 hours
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        # Total: 7.5 hours < 7.7 hours (7 * 1.1) - within tolerance
        assert violations == [], "Should have no violations within 10% tolerance"

    def test_exactly_at_10_percent_no_violations(self, mock_provider):
        """Test that exactly 10% over guideline produces no violation."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 462},  # 7.7 hours exactly
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7  # Max allowed: 7.7 hours
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        assert violations == [], "Should have no violations at exactly 10% tolerance"

    def test_exceeds_tolerance_has_violation(self, mock_provider):
        """Test that exceeding 10% tolerance produces violation."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 180},  # 3 hours
                        {"duration_minutes": 180},  # 3 hours
                        {"duration_minutes": 180},  # 3 hours
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7  # Max allowed: 7.7 hours
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        # Total: 9 hours > 7.7 hours - violation!
        assert len(violations) == 1, "Should have 1 violation"
        assert violations[0]["week"] == 1
        assert violations[0]["actual_hours"] == 9.0
        assert violations[0]["max_allowed"] == pytest.approx(7.7, abs=0.01)
        assert violations[0]["exceeds_by"] == pytest.approx(1.3, abs=0.1)

    def test_multiple_weeks_with_violations(self, mock_provider):
        """Test multiple weeks with some violations."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 180},  # 3 hours - OK
                    ]
                },
                {
                    "week": 2,
                    "workouts": [
                        {"duration_minutes": 300},  # 5 hours
                        {"duration_minutes": 300},  # 5 hours - VIOLATION (10h > 7.7h)
                    ]
                },
                {
                    "week": 3,
                    "workouts": [
                        {"duration_minutes": 420},  # 7 hours - OK
                    ]
                },
                {
                    "week": 4,
                    "workouts": [
                        {"duration_minutes": 240},  # 4 hours
                        {"duration_minutes": 240},  # 4 hours - VIOLATION (8h > 7.7h)
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        assert len(violations) == 2, "Should have 2 violations"
        assert violations[0]["week"] == 2
        assert violations[1]["week"] == 4

    def test_no_guideline_no_validation(self, mock_provider):
        """Test that missing guideline skips validation."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 1000},  # Way over any reasonable limit
                    ]
                }
            ]
        }
        plan_metadata = {}  # No weekly_training_hours

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        assert violations == [], "Should skip validation when no guideline provided"

    def test_empty_weekly_plan_no_violations(self, mock_provider):
        """Test empty weekly plan produces no violations."""
        training_plan = {
            "weekly_plan": []
        }
        plan_metadata = {
            "weekly_training_hours": 7
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        assert violations == [], "Empty plan should have no violations"

    def test_week_with_no_workouts_no_violation(self, mock_provider):
        """Test week with no workouts produces no violation."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": []  # Recovery week
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        assert violations == [], "Week with no workouts should have no violations"

    def test_custom_tolerance_5_percent(self, mock_provider):
        """Test with custom 5% tolerance instead of 10%."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": 450},  # 7.5 hours
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7  # With 5% tolerance: max 7.35 hours
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)

        # Should pass with 10% tolerance (default)
        violations_10pct = orchestrator._validate_weekly_hours(training_plan, plan_metadata)
        assert len(violations_10pct) == 0

        # Should fail with 5% tolerance
        violations_5pct = orchestrator._validate_weekly_hours(training_plan, plan_metadata, tolerance_pct=0.05)
        assert len(violations_5pct) == 1

    def test_invalid_duration_skipped_gracefully(self, mock_provider):
        """Test that invalid duration values are skipped gracefully."""
        training_plan = {
            "weekly_plan": [
                {
                    "week": 1,
                    "workouts": [
                        {"duration_minutes": "invalid"},  # Invalid
                        {"duration_minutes": 180},        # Valid: 3 hours
                        {"duration_minutes": None},       # Invalid
                    ]
                }
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        # Should only count the valid 180 minutes (3 hours)
        assert violations == [], "Should skip invalid durations and not crash"

    def test_real_world_scenario_8_week_plan(self, mock_provider):
        """Test realistic 8-week training plan scenario."""
        training_plan = {
            "weekly_plan": [
                # Week 1: Base building (6.5h - OK)
                {"week": 1, "workouts": [{"duration_minutes": 90}, {"duration_minutes": 90}, {"duration_minutes": 90}, {"duration_minutes": 120}]},
                # Week 2: Build (7.5h - OK, within tolerance)
                {"week": 2, "workouts": [{"duration_minutes": 90}, {"duration_minutes": 120}, {"duration_minutes": 90}, {"duration_minutes": 150}]},
                # Week 3: Overreach (8.5h - VIOLATION!)
                {"week": 3, "workouts": [{"duration_minutes": 120}, {"duration_minutes": 120}, {"duration_minutes": 120}, {"duration_minutes": 150}]},
                # Week 4: Recovery (4h - OK)
                {"week": 4, "workouts": [{"duration_minutes": 60}, {"duration_minutes": 60}, {"duration_minutes": 120}]},
                # Week 5: Build again (7h - OK)
                {"week": 5, "workouts": [{"duration_minutes": 90}, {"duration_minutes": 120}, {"duration_minutes": 90}, {"duration_minutes": 120}]},
                # Week 6: Peak (7.7h - OK, exactly at limit)
                {"week": 6, "workouts": [{"duration_minutes": 120}, {"duration_minutes": 120}, {"duration_minutes": 102}, {"duration_minutes": 120}]},
                # Week 7: Taper (5h - OK)
                {"week": 7, "workouts": [{"duration_minutes": 60}, {"duration_minutes": 90}, {"duration_minutes": 150}]},
                # Week 8: Race week (3h - OK)
                {"week": 8, "workouts": [{"duration_minutes": 60}, {"duration_minutes": 120}]},
            ]
        }
        plan_metadata = {
            "weekly_training_hours": 7
        }

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        violations = orchestrator._validate_weekly_hours(training_plan, plan_metadata)

        # Should only flag week 3 (8.5h > 7.7h)
        assert len(violations) == 1, "Should have exactly 1 violation"
        assert violations[0]["week"] == 3
        assert violations[0]["actual_hours"] == pytest.approx(8.5, abs=0.1)
