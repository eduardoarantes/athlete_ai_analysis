"""Tests for cross-training Pydantic models."""
import pytest
from pydantic import ValidationError

from cycling_ai.models.performance_analysis import (
    ActivityDistribution,
    CrossTrainingAnalysis,
    InterferenceEvent,
    LoadBalance,
    PerformanceAnalysis,
    Recommendation,
)


class TestActivityDistribution:
    """Test ActivityDistribution model validation."""

    def test_valid_activity_distribution(self):
        """Test creating a valid activity distribution."""
        dist = ActivityDistribution(
            category="Cycling",
            count=45,
            percentage=65.2
        )

        assert dist.category == "Cycling"
        assert dist.count == 45
        assert dist.percentage == 65.2

    def test_percentage_bounds(self):
        """Test that percentage is constrained to 0-100."""
        # Valid at boundaries
        ActivityDistribution(category="Test", count=10, percentage=0.0)
        ActivityDistribution(category="Test", count=10, percentage=100.0)

        # Invalid - exceeds bounds
        with pytest.raises(ValidationError):
            ActivityDistribution(category="Test", count=10, percentage=-0.1)

        with pytest.raises(ValidationError):
            ActivityDistribution(category="Test", count=10, percentage=100.1)

    def test_count_non_negative(self):
        """Test that count must be non-negative."""
        # Valid
        ActivityDistribution(category="Test", count=0, percentage=0.0)

        # Invalid
        with pytest.raises(ValidationError):
            ActivityDistribution(category="Test", count=-1, percentage=50.0)


class TestLoadBalance:
    """Test LoadBalance model validation."""

    def test_valid_load_balance(self):
        """Test creating a valid load balance."""
        balance = LoadBalance(
            cycling_percent=68.5,
            strength_percent=22.3,
            cardio_percent=9.2,
            assessment="Good balance for endurance cyclist"
        )

        assert balance.cycling_percent == 68.5
        assert balance.strength_percent == 22.3
        assert balance.cardio_percent == 9.2
        assert "Good balance" in balance.assessment

    def test_percentage_bounds(self):
        """Test that all percentages are constrained to 0-100."""
        # Valid at boundaries
        LoadBalance(
            cycling_percent=0.0,
            strength_percent=0.0,
            cardio_percent=100.0,
            assessment="Edge case"
        )

        # Invalid - cycling exceeds bounds
        with pytest.raises(ValidationError):
            LoadBalance(
                cycling_percent=101.0,
                strength_percent=0.0,
                cardio_percent=0.0,
                assessment="Test"
            )


class TestInterferenceEvent:
    """Test InterferenceEvent model validation."""

    def test_valid_interference_event(self):
        """Test creating a valid interference event."""
        event = InterferenceEvent(
            date="2025-10-15",
            activity1="Heavy Squats",
            activity2="Threshold Intervals",
            hours_between=18.5,
            score=6,
            explanation="Leg-focused strength < 24h before hard cycling"
        )

        assert event.date == "2025-10-15"
        assert event.activity1 == "Heavy Squats"
        assert event.activity2 == "Threshold Intervals"
        assert event.hours_between == 18.5
        assert event.score == 6
        assert "< 24h" in event.explanation

    def test_score_bounds(self):
        """Test that score is constrained to 0-10."""
        # Valid at boundaries
        InterferenceEvent(
            date="2025-01-01",
            activity1="A",
            activity2="B",
            hours_between=12.0,
            score=0,
            explanation="No interference"
        )

        InterferenceEvent(
            date="2025-01-01",
            activity1="A",
            activity2="B",
            hours_between=1.0,
            score=10,
            explanation="Severe interference"
        )

        # Invalid - exceeds bounds
        with pytest.raises(ValidationError):
            InterferenceEvent(
                date="2025-01-01",
                activity1="A",
                activity2="B",
                hours_between=1.0,
                score=11,
                explanation="Invalid"
            )

    def test_hours_between_non_negative(self):
        """Test that hours_between must be non-negative."""
        # Valid
        InterferenceEvent(
            date="2025-01-01",
            activity1="A",
            activity2="B",
            hours_between=0.0,
            score=5,
            explanation="Same time"
        )

        # Invalid
        with pytest.raises(ValidationError):
            InterferenceEvent(
                date="2025-01-01",
                activity1="A",
                activity2="B",
                hours_between=-1.0,
                score=5,
                explanation="Invalid"
            )


class TestCrossTrainingAnalysis:
    """Test CrossTrainingAnalysis model validation."""

    def test_minimal_cross_training_analysis(self):
        """Test creating cross-training analysis with minimal required fields."""
        analysis = CrossTrainingAnalysis(analyzed=False)

        assert analysis.analyzed is False
        assert analysis.activity_distribution == []
        assert analysis.load_balance is None
        assert analysis.interference_events == []
        assert analysis.recommendations == []

    def test_complete_cross_training_analysis(self):
        """Test creating complete cross-training analysis with all fields."""
        analysis = CrossTrainingAnalysis(
            analyzed=True,
            activity_distribution=[
                ActivityDistribution(category="Cycling", count=45, percentage=65.0),
                ActivityDistribution(category="Strength", count=20, percentage=29.0),
            ],
            load_balance=LoadBalance(
                cycling_percent=68.5,
                strength_percent=22.3,
                cardio_percent=9.2,
                assessment="Good balance"
            ),
            interference_events=[
                InterferenceEvent(
                    date="2025-10-15",
                    activity1="Squats",
                    activity2="Intervals",
                    hours_between=18.5,
                    score=6,
                    explanation="Too close"
                )
            ],
            recommendations=[
                Recommendation(text="Schedule strength 48+ hours before hard cycling")
            ]
        )

        assert analysis.analyzed is True
        assert len(analysis.activity_distribution) == 2
        assert analysis.load_balance is not None
        assert len(analysis.interference_events) == 1
        assert len(analysis.recommendations) == 1

    def test_analyzed_false_with_empty_data(self):
        """Test that analyzed=False works with empty data arrays."""
        analysis = CrossTrainingAnalysis(
            analyzed=False,
            activity_distribution=[],
            load_balance=None,
            interference_events=[],
            recommendations=[]
        )

        assert analysis.analyzed is False


class TestPerformanceAnalysisWithCrossTraining:
    """Test PerformanceAnalysis model with optional cross_training field."""

    def test_performance_analysis_without_cross_training(self):
        """Test creating PerformanceAnalysis without cross_training field."""
        from cycling_ai.models.performance_analysis import (
            AthleteProfile,
            PerformanceMetric,
            ZoneDistribution,
            KeyTrend,
            Insight,
            RecommendationCategories,
        )

        analysis = PerformanceAnalysis(
            athlete_profile=AthleteProfile(
                name="Test Athlete",
                current_ftp=260,
                weight=75.0,
                w_kg=3.47
            ),
            performance_comparison=[
                PerformanceMetric(
                    metric="Power",
                    previous="250W",
                    current="260W",
                    change="+10W",
                    trend="up"
                )
            ],
            time_in_zones=[
                ZoneDistribution(zone=1, name="Recovery", percentage=35.0, hours=42.0)
            ],
            key_trends=[
                KeyTrend(title="Improvement", description="FTP increased")
            ],
            insights=[
                Insight(title="Good progress", description="Keep it up")
            ],
            recommendations=RecommendationCategories(
                short_term=[Recommendation(text="Maintain volume")],
                long_term=[Recommendation(text="Target higher FTP")],
                recovery_nutrition=[Recommendation(text="Sleep 8+ hours")]
            )
        )

        assert analysis.cross_training is None

    def test_performance_analysis_with_cross_training(self):
        """Test creating PerformanceAnalysis with cross_training field."""
        from cycling_ai.models.performance_analysis import (
            AthleteProfile,
            PerformanceMetric,
            ZoneDistribution,
            KeyTrend,
            Insight,
            RecommendationCategories,
        )

        analysis = PerformanceAnalysis(
            athlete_profile=AthleteProfile(
                name="Test Athlete",
                current_ftp=260,
                weight=75.0,
                w_kg=3.47
            ),
            performance_comparison=[
                PerformanceMetric(
                    metric="Power",
                    previous="250W",
                    current="260W",
                    change="+10W",
                    trend="up"
                )
            ],
            time_in_zones=[
                ZoneDistribution(zone=1, name="Recovery", percentage=35.0, hours=42.0)
            ],
            key_trends=[
                KeyTrend(title="Improvement", description="FTP increased")
            ],
            insights=[
                Insight(title="Good progress", description="Keep it up")
            ],
            recommendations=RecommendationCategories(
                short_term=[Recommendation(text="Maintain volume")],
                long_term=[Recommendation(text="Target higher FTP")],
                recovery_nutrition=[Recommendation(text="Sleep 8+ hours")]
            ),
            cross_training=CrossTrainingAnalysis(
                analyzed=True,
                activity_distribution=[
                    ActivityDistribution(category="Cycling", count=60, percentage=60.0),
                    ActivityDistribution(category="Strength", count=30, percentage=30.0),
                ],
                load_balance=LoadBalance(
                    cycling_percent=70.0,
                    strength_percent=25.0,
                    cardio_percent=5.0,
                    assessment="Good balance for cyclist"
                )
            )
        )

        assert analysis.cross_training is not None
        assert analysis.cross_training.analyzed is True
        assert len(analysis.cross_training.activity_distribution) == 2

    def test_json_serialization_with_cross_training(self):
        """Test that PerformanceAnalysis with cross_training serializes correctly."""
        from cycling_ai.models.performance_analysis import (
            AthleteProfile,
            PerformanceMetric,
            ZoneDistribution,
            KeyTrend,
            Insight,
            RecommendationCategories,
        )

        analysis = PerformanceAnalysis(
            athlete_profile=AthleteProfile(
                name="Test",
                current_ftp=260,
                weight=75.0,
                w_kg=3.47
            ),
            performance_comparison=[
                PerformanceMetric(
                    metric="Power",
                    previous="250W",
                    current="260W",
                    change="+10W",
                    trend="up"
                )
            ],
            time_in_zones=[],
            key_trends=[],
            insights=[],
            recommendations=RecommendationCategories(),
            cross_training=CrossTrainingAnalysis(analyzed=True)
        )

        # Should serialize without error
        json_data = analysis.model_dump()

        assert "cross_training" in json_data
        assert json_data["cross_training"]["analyzed"] is True

    def test_json_deserialization_with_cross_training(self):
        """Test that JSON with cross_training deserializes correctly."""
        json_data = {
            "athlete_profile": {
                "name": "Test",
                "current_ftp": 260,
                "weight": 75.0,
                "w_kg": 3.47
            },
            "performance_comparison": [],
            "time_in_zones": [],
            "key_trends": [],
            "insights": [],
            "recommendations": {
                "short_term": [],
                "long_term": [],
                "recovery_nutrition": []
            },
            "cross_training": {
                "analyzed": True,
                "activity_distribution": [
                    {"category": "Cycling", "count": 60, "percentage": 60.0}
                ],
                "load_balance": {
                    "cycling_percent": 70.0,
                    "strength_percent": 25.0,
                    "cardio_percent": 5.0,
                    "assessment": "Good"
                },
                "interference_events": [],
                "recommendations": []
            }
        }

        analysis = PerformanceAnalysis.model_validate(json_data)

        assert analysis.cross_training is not None
        assert analysis.cross_training.analyzed is True
        assert len(analysis.cross_training.activity_distribution) == 1
