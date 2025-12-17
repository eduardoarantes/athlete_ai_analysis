"""
Workout comparison business logic.

This module provides algorithms for comparing planned training workouts
against actual executed workouts, calculating compliance scores, and
identifying patterns in workout adherence.

The core components:
- Data models for planned/actual workouts and comparison results
- ComplianceScorer for calculating weighted compliance scores
- WorkoutMatcher for matching planned workouts to actual activities
- PatternDetector for identifying weekly adherence patterns
- DeviationDetector for identifying specific workout deviations
- RecommendationEngine for generating coaching recommendations
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

# =============================================================================
# Data Models
# =============================================================================


@dataclass
class PlannedWorkout:
    """
    Planned workout extracted from training plan JSON.

    Attributes:
        date: Workout date
        weekday: Day name (e.g., "Monday")
        workout_type: Type derived from segments
            ("endurance", "threshold", "vo2max", "recovery", "tempo")
        total_duration_minutes: Total planned duration
        planned_tss: Planned Training Stress Score
        segments: Raw segment data from plan
        description: Workout description
        zone_distribution: Minutes in each power zone (auto-calculated if not provided)
        target_avg_power_pct: Average target power across segments (auto-calculated if not provided)
    """

    date: datetime
    weekday: str
    workout_type: str
    total_duration_minutes: float
    planned_tss: float
    segments: list[dict[str, Any]]
    description: str

    zone_distribution: dict[str, float] = field(default_factory=dict)
    target_avg_power_pct: float | None = None

    def __post_init__(self) -> None:
        """Calculate derived fields after initialization."""
        if not self.zone_distribution:
            self.zone_distribution = self._calculate_zone_distribution()
        if self.target_avg_power_pct is None:
            self.target_avg_power_pct = self._calculate_avg_power_pct()

    def _calculate_zone_distribution(self) -> dict[str, float]:
        """
        Calculate time in each zone from segments.

        Zone mapping (% of FTP):
        - Z1: 0-55%
        - Z2: 56-75%
        - Z3: 76-90%
        - Z4: 91-105%
        - Z5: 106%+

        Returns:
            Dictionary mapping zone name to minutes in that zone.
        """
        zones: dict[str, float] = {}

        for segment in self.segments:
            duration = segment.get("duration_min", 0)
            power_low = segment.get("power_low_pct", 0)
            power_high = segment.get("power_high_pct", power_low)

            # Use average power for zone classification
            avg_power = (power_low + power_high) / 2.0

            # Map to zone
            if avg_power <= 55:
                zone = "Z1"
            elif avg_power <= 75:
                zone = "Z2"
            elif avg_power <= 90:
                zone = "Z3"
            elif avg_power <= 105:
                zone = "Z4"
            else:
                zone = "Z5"

            zones[zone] = zones.get(zone, 0) + duration

        return zones

    def _calculate_avg_power_pct(self) -> float:
        """
        Calculate weighted average target power across segments.

        Returns:
            Weighted average power as percentage of FTP, rounded to 1 decimal.
        """
        if not self.segments:
            return 0.0

        total_power_weighted = 0.0
        total_duration = 0.0

        for segment in self.segments:
            duration = segment.get("duration_min", 0)
            power_low = segment.get("power_low_pct", 0)
            power_high = segment.get("power_high_pct", power_low)

            avg_power = (power_low + power_high) / 2.0
            total_power_weighted += avg_power * duration
            total_duration += duration

        if total_duration == 0:
            return 0.0

        return round(total_power_weighted / total_duration, 1)


@dataclass
class ActualWorkout:
    """
    Actual workout from activities CSV/Parquet.

    Attributes:
        date: Activity date
        activity_name: Activity name/title
        activity_type: Activity type ("Ride", "Virtual Ride", etc.)
        duration_minutes: Moving time in minutes
        distance_km: Distance in kilometers (optional)
        average_power: Average power in watts (optional)
        normalized_power: Normalized power in watts (optional)
        actual_tss: Actual Training Stress Score (optional)
        intensity_factor: Intensity Factor (optional)
        average_hr: Average heart rate in bpm (optional)
        max_hr: Maximum heart rate in bpm (optional)
        zone_distribution: Minutes in each power zone (optional)
    """

    date: datetime
    activity_name: str
    activity_type: str
    duration_minutes: float

    distance_km: float | None = None
    average_power: int | None = None
    normalized_power: int | None = None
    actual_tss: float | None = None
    intensity_factor: float | None = None
    average_hr: int | None = None
    max_hr: int | None = None
    zone_distribution: dict[str, float] = field(default_factory=dict)


@dataclass
class ComplianceMetrics:
    """
    Detailed compliance metrics for a single workout comparison.

    Scoring Framework:
    - Completion: 40% weight (100 if completed, 0 if skipped)
    - Duration: 25% weight (actual/planned ratio, capped at 100)
    - Intensity: 25% weight (zone distribution match, 0-100)
    - TSS: 10% weight (actual/planned TSS ratio, capped at 100)

    Attributes:
        completed: Whether workout was completed
        completion_score: Completion score (0 or 100)
        duration_score: Duration match score (0-100)
        intensity_score: Zone distribution match score (0-100)
        tss_score: TSS match score (0-100)
        compliance_score: Overall weighted compliance score (0-100)
        duration_compliance_pct: Duration as percentage of planned
        tss_compliance_pct: TSS as percentage of planned (None if TSS unavailable)
        zone_match_scores: Per-zone match scores (optional detailed breakdown)
    """

    completed: bool

    # Component scores (0-100)
    completion_score: float
    duration_score: float
    intensity_score: float
    tss_score: float

    # Overall weighted score (0-100)
    compliance_score: float

    # Detailed breakdowns
    duration_compliance_pct: float
    tss_compliance_pct: float | None
    zone_match_scores: dict[str, float] = field(default_factory=dict)


@dataclass
class WorkoutComparison:
    """
    Result of comparing one planned workout against actual execution.

    Attributes:
        date: Workout date
        planned: Planned workout details
        actual: Actual workout details (None if skipped)
        metrics: Compliance metrics
        deviations: List of human-readable deviation descriptions
        recommendation: Coaching recommendation based on comparison
    """

    date: datetime
    planned: PlannedWorkout
    actual: ActualWorkout | None

    # Metrics
    metrics: ComplianceMetrics

    # Insights (generated by business logic)
    deviations: list[str] = field(default_factory=list)
    recommendation: str = ""


@dataclass
class WeeklyPattern:
    """
    Identified pattern in weekly workout compliance.

    Attributes:
        pattern_type: Pattern type identifier ("skipped_hard_workouts", "short_duration", etc.)
        description: Human-readable pattern description
        severity: Pattern severity ("low", "medium", "high")
        affected_workouts: List of workout dates affected by this pattern
    """

    pattern_type: str
    description: str
    severity: str
    affected_workouts: list[datetime] = field(default_factory=list)


@dataclass
class WeeklyComparison:
    """
    Aggregated comparison for an entire week.

    Attributes:
        week_number: Week number in training plan
        week_start_date: Monday of the week
        week_end_date: Sunday of the week
        daily_comparisons: List of daily workout comparisons
        workouts_planned: Number of workouts planned
        workouts_completed: Number of workouts completed
        completion_rate_pct: Completion rate as percentage
        total_planned_tss: Total planned TSS for week
        total_actual_tss: Total actual TSS for week
        tss_compliance_pct: TSS compliance as percentage
        total_planned_duration_minutes: Total planned duration
        total_actual_duration_minutes: Total actual duration
        duration_compliance_pct: Duration compliance as percentage
        avg_compliance_score: Average compliance score across completed workouts
        patterns: Identified weekly patterns
        weekly_recommendation: Overall weekly coaching recommendation
    """

    week_number: int
    week_start_date: datetime
    week_end_date: datetime

    # Daily comparisons
    daily_comparisons: list[WorkoutComparison] = field(default_factory=list)

    # Aggregated metrics
    workouts_planned: int = 0
    workouts_completed: int = 0
    completion_rate_pct: float = 0.0

    total_planned_tss: float = 0.0
    total_actual_tss: float = 0.0
    tss_compliance_pct: float = 0.0

    total_planned_duration_minutes: float = 0.0
    total_actual_duration_minutes: float = 0.0
    duration_compliance_pct: float = 0.0

    avg_compliance_score: float = 0.0

    # Patterns
    patterns: list[WeeklyPattern] = field(default_factory=list)
    weekly_recommendation: str = ""


# =============================================================================
# ComplianceScorer
# =============================================================================


class ComplianceScorer:
    """
    Calculate compliance scores for workout comparisons.

    Scoring framework:
    - Completion: 40% weight (binary: completed or not)
    - Duration: 25% weight (actual/planned ratio, capped at 100)
    - Intensity: 25% weight (zone distribution match)
    - TSS: 10% weight (actual/planned TSS ratio, capped at 100)
    """

    def calculate_compliance_score(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout | None,
        ftp: int,
    ) -> ComplianceMetrics:
        """
        Calculate multi-factor compliance score.

        Args:
            planned: Planned workout
            actual: Actual workout (None if skipped)
            ftp: Athlete's FTP

        Returns:
            ComplianceMetrics with detailed breakdown
        """
        if actual is None:
            return ComplianceMetrics(
                completed=False,
                completion_score=0.0,
                duration_score=0.0,
                intensity_score=0.0,
                tss_score=0.0,
                compliance_score=0.0,
                duration_compliance_pct=0.0,
                tss_compliance_pct=None,
            )

        # 1. Completion score (40% weight)
        completion_score = 100.0

        # 2. Duration score (25% weight)
        duration_score, duration_pct = self.score_duration(planned, actual)

        # 3. Intensity score (25% weight)
        intensity_score = self.score_intensity(planned, actual)

        # 4. TSS score (10% weight)
        tss_score, tss_pct = self.score_tss(planned, actual)

        # Weighted average
        compliance_score = completion_score * 0.40 + duration_score * 0.25 + intensity_score * 0.25 + tss_score * 0.10

        return ComplianceMetrics(
            completed=True,
            completion_score=completion_score,
            duration_score=duration_score,
            intensity_score=intensity_score,
            tss_score=tss_score,
            compliance_score=round(compliance_score, 1),
            duration_compliance_pct=round(duration_pct, 1),
            tss_compliance_pct=round(tss_pct, 1) if tss_pct is not None else None,
        )

    def score_duration(self, planned: PlannedWorkout, actual: ActualWorkout) -> tuple[float, float]:
        """
        Score duration compliance.

        Args:
            planned: Planned workout
            actual: Actual workout

        Returns:
            Tuple of (score 0-100, compliance percentage)
        """
        if planned.total_duration_minutes == 0:
            return 100.0, 100.0

        ratio = actual.duration_minutes / planned.total_duration_minutes
        compliance_pct = ratio * 100
        score = min(100.0, compliance_pct)  # Cap at 100

        return score, compliance_pct

    def score_intensity(self, planned: PlannedWorkout, actual: ActualWorkout) -> float:
        """
        Score intensity compliance via zone distribution match.

        Args:
            planned: Planned workout
            actual: Actual workout

        Returns:
            Score 0-100
        """
        return self.calculate_zone_match_score(planned.zone_distribution, actual.zone_distribution)

    def score_tss(self, planned: PlannedWorkout, actual: ActualWorkout) -> tuple[float, float | None]:
        """
        Score TSS compliance.

        Args:
            planned: Planned workout
            actual: Actual workout

        Returns:
            Tuple of (score 0-100, compliance percentage or None)
        """
        if actual.actual_tss is None or planned.planned_tss == 0:
            return 100.0, None  # Default when TSS unavailable

        ratio = actual.actual_tss / planned.planned_tss
        compliance_pct = ratio * 100
        score = min(100.0, compliance_pct)  # Cap at 100

        return score, compliance_pct

    def calculate_zone_match_score(
        self,
        planned_zones: dict[str, float],
        actual_zones: dict[str, float],
    ) -> float:
        """
        Calculate 0-100 score for zone distribution match.

        Algorithm:
        1. Calculate total time deviation across all zones
        2. Express as percentage of total planned time
        3. Convert to score: 100 - deviation_pct

        Args:
            planned_zones: Planned zone distribution (zone -> minutes)
            actual_zones: Actual zone distribution (zone -> minutes)

        Returns:
            Score from 0-100 (100 = perfect match)
        """
        if not planned_zones:
            return 100.0

        total_deviation = 0.0
        total_planned_time = sum(planned_zones.values())

        # Get all zones (union of planned and actual)
        all_zones = set(planned_zones.keys()) | set(actual_zones.keys())

        for zone in all_zones:
            planned_minutes = planned_zones.get(zone, 0.0)
            actual_minutes = actual_zones.get(zone, 0.0)
            deviation = abs(planned_minutes - actual_minutes)
            total_deviation += deviation

        if total_planned_time == 0:
            return 100.0

        deviation_pct = (total_deviation / total_planned_time) * 100
        score = max(0.0, 100.0 - deviation_pct)

        return round(score, 1)


# =============================================================================
# WorkoutMatcher
# =============================================================================


class WorkoutMatcher:
    """
    Match planned workouts to actual activities.

    Matching strategies:
    1. Exact date match (primary)
    2. Fuzzy match within ±N days with similarity scoring (fallback)
    3. Handle multiple activities per day (select best match)
    """

    def match_workouts(
        self,
        planned_workouts: list[PlannedWorkout],
        actual_activities: list[ActualWorkout],
        fuzzy_match_days: int = 1,
    ) -> list[tuple[PlannedWorkout, ActualWorkout | None]]:
        """
        Match planned workouts to actual activities.

        Matching strategy:
        1. Primary: Exact date match
        2. Fallback: Fuzzy match within ±N days with type similarity
        3. Handle multiple activities per day (combine or select best match)

        Args:
            planned_workouts: List of planned workouts
            actual_activities: List of actual activities
            fuzzy_match_days: Number of days to allow for fuzzy matching (default: 1)

        Returns:
            List of (PlannedWorkout, ActualWorkout | None) tuples.
            None indicates workout was skipped.
        """
        matched_pairs: list[tuple[PlannedWorkout, ActualWorkout | None]] = []
        used_actual_indices: set[int] = set()

        for planned in planned_workouts:
            planned_date = planned.date.date()

            # Strategy 1: Exact date match
            exact_matches: list[tuple[int, ActualWorkout]] = [
                (i, actual)
                for i, actual in enumerate(actual_activities)
                if actual.date.date() == planned_date and i not in used_actual_indices
            ]

            if exact_matches:
                # If multiple activities on same day, select longest duration
                if len(exact_matches) == 1:
                    best_idx, best_match = exact_matches[0]
                else:
                    best_idx, best_match = max(exact_matches, key=lambda x: x[1].duration_minutes)

                matched_pairs.append((planned, best_match))
                used_actual_indices.add(best_idx)
                continue

            # Strategy 2: Fuzzy match (±N days)
            if fuzzy_match_days > 0:
                fuzzy_matches: list[tuple[int, ActualWorkout, float]] = []

                for i, actual in enumerate(actual_activities):
                    if i in used_actual_indices:
                        continue

                    day_diff = abs((actual.date.date() - planned_date).days)
                    if day_diff <= fuzzy_match_days:
                        # Calculate similarity score
                        similarity = self._calculate_workout_similarity(planned, actual)
                        if similarity > 0.5:  # Threshold for considering a match
                            fuzzy_matches.append((i, actual, similarity))

                if fuzzy_matches:
                    # Select best fuzzy match (highest similarity)
                    best_idx, best_match, _ = max(fuzzy_matches, key=lambda x: x[2])
                    matched_pairs.append((planned, best_match))
                    used_actual_indices.add(best_idx)
                else:
                    # No match found - workout was skipped
                    matched_pairs.append((planned, None))
            else:
                # Fuzzy matching disabled - workout was skipped
                matched_pairs.append((planned, None))

        return matched_pairs

    def _calculate_workout_similarity(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout,
    ) -> float:
        """
        Calculate similarity score between planned and actual workout.

        Factors:
        - Duration similarity (0-1)
        - Type match (0-1)

        Args:
            planned: Planned workout
            actual: Actual workout

        Returns:
            Similarity score 0-1 (1 = perfect match)
        """
        if planned.total_duration_minutes == 0:
            return 0.5  # Default neutral score

        # Duration similarity (closer durations = higher score)
        duration_ratio = min(
            actual.duration_minutes / planned.total_duration_minutes,
            planned.total_duration_minutes / actual.duration_minutes,
        )
        duration_similarity = duration_ratio

        # Type match (basic heuristic - cycling activities match)
        type_match = 1.0 if actual.activity_type in ["Ride", "Virtual Ride", "VirtualRide"] else 0.5

        # Weighted average (duration more important)
        similarity = duration_similarity * 0.7 + type_match * 0.3

        return similarity


# =============================================================================
# DeviationDetector
# =============================================================================


class DeviationDetector:
    """
    Detect specific deviations between planned and actual workouts.

    Deviation categories:
    1. Completion: Workout skipped entirely
    2. Duration: Too short (< 90%) or too long (> 110%)
    3. Intensity: Wrong power zones
    4. TSS: Significantly different training stress
    """

    def detect_deviations(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout | None,
        metrics: ComplianceMetrics,
    ) -> list[str]:
        """
        Detect all deviations between planned and actual workout.

        Args:
            planned: Planned workout
            actual: Actual workout (None if skipped)
            metrics: Compliance metrics

        Returns:
            List of human-readable deviation descriptions
        """
        deviations: list[str] = []

        # 1. Completion deviation
        if not metrics.completed:
            deviations.append(
                f"Workout skipped entirely ({planned.workout_type}, "
                f"{planned.total_duration_minutes:.0f} min, "
                f"{planned.planned_tss:.0f} TSS)"
            )
            return deviations  # No other deviations to detect

        # 2. Duration deviations
        if actual and metrics.duration_compliance_pct < 90:
            shortfall = 100 - metrics.duration_compliance_pct
            deviations.append(
                f"Duration {shortfall:.0f}% shorter than planned "
                f"({actual.duration_minutes:.0f} min vs "
                f"{planned.total_duration_minutes:.0f} min planned)"
            )
        elif actual and metrics.duration_compliance_pct > 110:
            excess = metrics.duration_compliance_pct - 100
            deviations.append(
                f"Duration {excess:.0f}% longer than planned "
                f"({actual.duration_minutes:.0f} min vs "
                f"{planned.total_duration_minutes:.0f} min planned)"
            )

        # 3. Intensity deviations
        if metrics.intensity_score < 70:
            deviations.append(f"Intensity deviated from plan (zone match score: {metrics.intensity_score:.0f}/100)")

        # 4. TSS deviations
        if metrics.tss_compliance_pct is not None and metrics.tss_compliance_pct < 85:
            shortfall = 100 - metrics.tss_compliance_pct
            if actual and actual.actual_tss:
                deviations.append(
                    f"TSS {shortfall:.0f}% lower than planned "
                    f"({actual.actual_tss:.0f} vs "
                    f"{planned.planned_tss:.0f} TSS planned)"
                )

        return deviations


# =============================================================================
# RecommendationEngine
# =============================================================================


class RecommendationEngine:
    """
    Generate coaching recommendations based on workout compliance.

    Recommendations are context-aware and supportive, focusing on
    actionable next steps rather than criticism.
    """

    def generate_recommendation(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout | None,
        metrics: ComplianceMetrics,
        deviations: list[str],
    ) -> str:
        """
        Generate coaching recommendation based on compliance.

        Args:
            planned: Planned workout
            actual: Actual workout (None if skipped)
            metrics: Compliance metrics
            deviations: List of detected deviations

        Returns:
            Human-readable coaching recommendation
        """
        score = metrics.compliance_score

        # Excellent compliance (90-100)
        if score >= 90:
            if score == 100:
                return "Excellent execution! Workout completed exactly as planned. Continue this level of consistency."
            else:
                return (
                    f"Great execution ({score:.0f}% compliance). "
                    f"Minor deviations are perfectly normal. Keep up the excellent work!"
                )

        # Good compliance (70-89)
        elif score >= 70:
            if len(deviations) == 0:
                return (
                    f"Good compliance ({score:.0f}%). Workout completed with minor "
                    f"modifications. This level of adherence supports consistent training progress."
                )
            else:
                main_issue = deviations[0] if deviations else "some modifications"
                return (
                    f"Good compliance ({score:.0f}%) despite modifications ({main_issue}). "
                    f"If this was due to fatigue or time constraints, it was appropriate. "
                    f"If recurring, consider adjusting the plan."
                )

        # Moderate compliance (50-69)
        elif score >= 50:
            if not metrics.completed:
                workout_type_desc = f"{planned.workout_type} workout"
                return (
                    f"Workout skipped. If this was a one-time occurrence, consider "
                    f"rescheduling this {workout_type_desc} for tomorrow. If skipping "
                    f"workouts is becoming a pattern, review your weekly schedule to "
                    f"protect key training days."
                )
            else:
                return (
                    f"Moderate compliance ({score:.0f}%). Significant modifications were made. "
                    f"If this was due to fatigue, it may have been the right call for recovery. "
                    f"If due to time constraints, consider whether the plan needs adjustment to "
                    f"fit your schedule better."
                )

        # Poor compliance (0-49)
        else:
            if not metrics.completed:
                if planned.workout_type in ["threshold", "vo2max", "tempo"]:
                    return (
                        f"High-intensity {planned.workout_type} workout skipped. "
                        f"These are critical for fitness gains. Try to reschedule within "
                        f"the next 2 days if possible. If consistently unable to complete "
                        f"hard workouts, the plan may need adjustment."
                    )
                else:
                    return (
                        f"{planned.workout_type.capitalize()} workout skipped. While missing one "
                        f"workout isn't critical, consistent completion is important for progress. "
                        f"Review your schedule to identify and protect your training time."
                    )
            else:
                return (
                    f"Low compliance ({score:.0f}%). The workout completed was quite different "
                    f"from planned. This may indicate the plan doesn't match your current fitness "
                    f"level, available time, or recovery needs. Consider discussing plan "
                    f"modifications with a coach."
                )


# =============================================================================
# PatternDetector
# =============================================================================


class PatternDetector:
    """
    Detect patterns in weekly workout compliance.

    Identifies recurring issues like:
    - Consistently skipping hard workouts
    - Consistently cutting workouts short
    - Weekend warrior pattern
    - Scheduling conflicts on specific days
    - Intensity avoidance
    """

    def identify_weekly_patterns(
        self,
        daily_comparisons: list[WorkoutComparison],
        min_occurrences: int = 2,
    ) -> list[WeeklyPattern]:
        """
        Identify patterns across multiple workout comparisons.

        Args:
            daily_comparisons: List of workout comparisons
            min_occurrences: Minimum number of occurrences to trigger a pattern

        Returns:
            List of identified patterns
        """
        patterns: list[WeeklyPattern] = []

        # Detect each pattern type
        patterns.extend(self._detect_skipped_hard_workouts(daily_comparisons, min_occurrences))
        patterns.extend(self._detect_short_duration_pattern(daily_comparisons, min_occurrences))
        patterns.extend(self._detect_weekend_warrior(daily_comparisons))
        patterns.extend(self._detect_scheduling_conflicts(daily_comparisons, min_occurrences))
        patterns.extend(self._detect_intensity_avoidance(daily_comparisons, min_occurrences))

        return patterns

    def _detect_skipped_hard_workouts(
        self,
        comparisons: list[WorkoutComparison],
        min_occurrences: int,
    ) -> list[WeeklyPattern]:
        """
        Detect if hard workouts (threshold, VO2max, tempo) are consistently skipped.

        Args:
            comparisons: List of workout comparisons
            min_occurrences: Minimum number of skipped hard workouts to trigger pattern

        Returns:
            List containing pattern if detected, empty list otherwise
        """
        hard_workout_types = ["threshold", "vo2max", "tempo"]
        skipped_hard: list[datetime] = []
        total_hard = 0

        for comp in comparisons:
            if comp.planned.workout_type in hard_workout_types:
                total_hard += 1
                if not comp.metrics.completed:
                    skipped_hard.append(comp.date)

        if len(skipped_hard) < min_occurrences:
            return []

        # Determine severity
        if total_hard > 0 and len(skipped_hard) == total_hard:
            severity = "high"  # All hard workouts skipped
        elif len(skipped_hard) >= 2:
            severity = "medium"
        else:
            return []

        pattern = WeeklyPattern(
            pattern_type="skipped_hard_workouts",
            description=(
                f"High-intensity workouts (threshold/VO2max/tempo) consistently skipped "
                f"({len(skipped_hard)} of {total_hard} planned)"
            ),
            severity=severity,
            affected_workouts=skipped_hard,
        )

        return [pattern]

    def _detect_short_duration_pattern(
        self,
        comparisons: list[WorkoutComparison],
        min_occurrences: int,
    ) -> list[WeeklyPattern]:
        """
        Detect if workouts are consistently cut short.

        Args:
            comparisons: List of workout comparisons
            min_occurrences: Minimum number of short workouts to trigger pattern

        Returns:
            List containing pattern if detected, empty list otherwise
        """
        short_workouts: list[datetime] = []
        duration_percentages: list[float] = []

        for comp in comparisons:
            if comp.metrics.completed and comp.metrics.duration_compliance_pct < 80:
                short_workouts.append(comp.date)
                duration_percentages.append(comp.metrics.duration_compliance_pct)

        if len(short_workouts) < min_occurrences:
            return []

        # Calculate average duration compliance
        avg_duration_pct = sum(duration_percentages) / len(duration_percentages)

        # Determine severity
        if avg_duration_pct < 70:
            severity = "high"
        elif avg_duration_pct < 80:
            severity = "medium"
        else:
            return []

        pattern = WeeklyPattern(
            pattern_type="short_duration",
            description=(
                f"Workouts consistently cut short (avg {avg_duration_pct:.0f}% of planned "
                f"duration, {len(short_workouts)} workouts affected)"
            ),
            severity=severity,
            affected_workouts=short_workouts,
        )

        return [pattern]

    def _detect_weekend_warrior(
        self,
        comparisons: list[WorkoutComparison],
    ) -> list[WeeklyPattern]:
        """
        Detect weekend warrior pattern (high weekend compliance, low weekday).

        Args:
            comparisons: List of workout comparisons

        Returns:
            List containing pattern if detected, empty list otherwise
        """
        weekday_scores: list[float] = []
        weekend_scores: list[float] = []

        for comp in comparisons:
            day_of_week = comp.date.weekday()
            score = comp.metrics.compliance_score

            if day_of_week >= 5:  # Saturday=5, Sunday=6
                weekend_scores.append(score)
            else:  # Monday-Friday
                weekday_scores.append(score)

        # Need data for both weekday and weekend
        if not weekday_scores or not weekend_scores:
            return []

        avg_weekday = sum(weekday_scores) / len(weekday_scores)
        avg_weekend = sum(weekend_scores) / len(weekend_scores)

        # Pattern: weekend compliance >20% higher than weekday
        if avg_weekend - avg_weekday > 20:
            pattern = WeeklyPattern(
                pattern_type="weekend_warrior",
                description=(
                    f"Weekend compliance ({avg_weekend:.0f}%) significantly higher than weekday "
                    f"({avg_weekday:.0f}%). Consider shifting key workouts to weekends or "
                    f"adjusting weekday availability."
                ),
                severity="low",
                affected_workouts=[],
            )
            return [pattern]

        return []

    def _detect_scheduling_conflicts(
        self,
        comparisons: list[WorkoutComparison],
        min_occurrences: int,
    ) -> list[WeeklyPattern]:
        """
        Detect if specific days are always skipped (scheduling conflict).

        Args:
            comparisons: List of workout comparisons
            min_occurrences: Minimum number of times day must be skipped

        Returns:
            List containing patterns if detected, empty list otherwise
        """
        # Track skipped workouts by weekday name
        skipped_by_day: dict[str, list[datetime]] = {}

        for comp in comparisons:
            if not comp.metrics.completed:
                weekday = comp.planned.weekday
                if weekday not in skipped_by_day:
                    skipped_by_day[weekday] = []
                skipped_by_day[weekday].append(comp.date)

        patterns: list[WeeklyPattern] = []

        for weekday, dates in skipped_by_day.items():
            if len(dates) >= min_occurrences:
                pattern = WeeklyPattern(
                    pattern_type="scheduling_conflict",
                    description=(
                        f"{weekday} workouts consistently skipped ({len(dates)} times). "
                        f"This may indicate a scheduling conflict on this day."
                    ),
                    severity="medium",
                    affected_workouts=dates,
                )
                patterns.append(pattern)

        return patterns

    def _detect_intensity_avoidance(
        self,
        comparisons: list[WorkoutComparison],
        min_occurrences: int,
    ) -> list[WeeklyPattern]:
        """
        Detect if athlete consistently trains at lower intensity than planned.

        Args:
            comparisons: List of workout comparisons
            min_occurrences: Minimum number of low-intensity workouts to trigger pattern

        Returns:
            List containing pattern if detected, empty list otherwise
        """
        low_intensity_workouts: list[datetime] = []
        intensity_scores: list[float] = []

        for comp in comparisons:
            # Only consider completed workouts
            if comp.metrics.completed and comp.metrics.intensity_score < 70:
                low_intensity_workouts.append(comp.date)
                intensity_scores.append(comp.metrics.intensity_score)

        if len(low_intensity_workouts) < min_occurrences:
            return []

        avg_intensity = sum(intensity_scores) / len(intensity_scores)

        pattern = WeeklyPattern(
            pattern_type="intensity_avoidance",
            description=(
                f"Consistently training at lower intensity than planned (avg zone match score: "
                f"{avg_intensity:.0f}/100, {len(low_intensity_workouts)} workouts affected)"
            ),
            severity="medium",
            affected_workouts=low_intensity_workouts,
        )

        return [pattern]


# =============================================================================
# WorkoutComparer - Main Facade
# =============================================================================


class WorkoutComparer:
    """
    Main facade for comparing planned training workouts against actual workouts.

    Coordinates all comparison components:
    - Loads planned workouts from training plan JSON
    - Loads actual workouts from activities CSV/Parquet
    - Matches workouts using WorkoutMatcher
    - Scores compliance using ComplianceScorer
    - Detects deviations using DeviationDetector
    - Generates recommendations using RecommendationEngine
    - Identifies patterns using PatternDetector
    """

    def __init__(
        self,
        plan_path: Path | str,
        activities_path: Path | str,
        ftp: int,
    ):
        """
        Initialize WorkoutComparer with data sources.

        Args:
            plan_path: Path to training plan JSON file
            activities_path: Path to activities CSV or Parquet file
            ftp: Athlete's FTP in watts
        """
        self.plan_path = Path(plan_path)
        self.activities_path = Path(activities_path)
        self.ftp = ftp

        # Initialize components
        self._matcher = WorkoutMatcher()
        self._scorer = ComplianceScorer()
        self._deviation_detector = DeviationDetector()
        self._recommendation_engine = RecommendationEngine()
        self._pattern_detector = PatternDetector()

        # Load data
        self._planned_workouts = self._load_planned_workouts()
        self._actual_workouts = self._load_actual_workouts()

    def compare_daily_workout(self, date: str) -> WorkoutComparison | None:
        """
        Compare planned workout against actual execution for a single day.

        Args:
            date: Date in YYYY-MM-DD format

        Returns:
            WorkoutComparison object, or None if no workout planned for that date
        """
        target_date = datetime.strptime(date, "%Y-%m-%d")

        # Find planned workout for this date
        planned = None
        for workout in self._planned_workouts:
            if workout.date.date() == target_date.date():
                planned = workout
                break

        if not planned:
            return None

        # Find actual workout(s) for this date
        actuals_on_date = [actual for actual in self._actual_workouts if actual.date.date() == target_date.date()]

        # Match planned to actual (select longest if multiple)
        actual = None
        if actuals_on_date:
            if len(actuals_on_date) == 1:
                actual = actuals_on_date[0]
            else:
                # Multiple activities - select longest
                actual = max(actuals_on_date, key=lambda a: a.duration_minutes)

        # Calculate compliance metrics
        metrics = self._scorer.calculate_compliance_score(planned, actual, self.ftp)

        # Detect deviations
        deviations = self._deviation_detector.detect_deviations(planned, actual, metrics)

        # Generate recommendation
        recommendation = self._recommendation_engine.generate_recommendation(planned, actual, metrics, deviations)

        return WorkoutComparison(
            date=target_date,
            planned=planned,
            actual=actual,
            metrics=metrics,
            deviations=deviations,
            recommendation=recommendation,
        )

    def compare_weekly_workouts(self, week_start: str) -> WeeklyComparison:
        """
        Compare planned workouts against actual execution for an entire week.

        Args:
            week_start: Week start date (Monday) in YYYY-MM-DD format

        Returns:
            WeeklyComparison with aggregated metrics and patterns
        """
        week_start_date = datetime.strptime(week_start, "%Y-%m-%d")
        week_end_date = week_start_date + timedelta(days=6)  # Sunday

        # Find week number from planned workouts
        week_number = 1
        for workout in self._planned_workouts:
            if workout.date.date() == week_start_date.date():
                # Extract week number from segments if available
                # For now, calculate based on position in plan
                break

        # Get all planned workouts for this week
        weekly_planned = [
            workout
            for workout in self._planned_workouts
            if week_start_date.date() <= workout.date.date() <= week_end_date.date()
        ]

        # Compare each day
        daily_comparisons: list[WorkoutComparison] = []
        for planned_workout in weekly_planned:
            date_str = planned_workout.date.strftime("%Y-%m-%d")
            comparison = self.compare_daily_workout(date_str)
            if comparison:
                daily_comparisons.append(comparison)

        # Aggregate metrics
        workouts_planned = len(weekly_planned)
        workouts_completed = sum(1 for c in daily_comparisons if c.metrics.completed)
        completion_rate_pct = (workouts_completed / workouts_planned * 100) if workouts_planned > 0 else 0.0

        total_planned_tss = sum(p.planned_tss for p in weekly_planned)
        total_actual_tss = sum(c.actual.actual_tss for c in daily_comparisons if c.actual and c.actual.actual_tss)
        tss_compliance_pct = (total_actual_tss / total_planned_tss * 100) if total_planned_tss > 0 else 0.0

        total_planned_duration = sum(p.total_duration_minutes for p in weekly_planned)
        total_actual_duration = sum(c.actual.duration_minutes for c in daily_comparisons if c.actual)
        duration_compliance_pct = (
            (total_actual_duration / total_planned_duration * 100) if total_planned_duration > 0 else 0.0
        )

        # Calculate average compliance score (only for completed workouts)
        completed_scores = [c.metrics.compliance_score for c in daily_comparisons if c.metrics.completed]
        avg_compliance_score = sum(completed_scores) / len(completed_scores) if completed_scores else 0.0

        # Detect patterns
        patterns = self._pattern_detector.identify_weekly_patterns(daily_comparisons)

        # Generate weekly recommendation
        if completion_rate_pct == 100 and avg_compliance_score >= 90:
            weekly_recommendation = (
                "Excellent week! All workouts completed with high compliance. "
                "Continue this consistency for optimal training adaptation."
            )
        elif completion_rate_pct >= 80:
            weekly_recommendation = (
                f"Good week with {completion_rate_pct:.0f}% completion rate. "
                f"Focus on maintaining consistency and addressing any identified patterns."
            )
        elif completion_rate_pct >= 60:
            weekly_recommendation = (
                f"Moderate week with {completion_rate_pct:.0f}% completion rate. "
                f"Review the identified patterns and consider adjusting your schedule or plan "
                f"to improve adherence."
            )
        else:
            weekly_recommendation = (
                f"Challenging week with only {completion_rate_pct:.0f}% completion rate. "
                f"Review patterns and consider whether the plan aligns with your current "
                f"availability and recovery needs."
            )

        return WeeklyComparison(
            week_number=week_number,
            week_start_date=week_start_date,
            week_end_date=week_end_date,
            daily_comparisons=daily_comparisons,
            workouts_planned=workouts_planned,
            workouts_completed=workouts_completed,
            completion_rate_pct=round(completion_rate_pct, 1),
            total_planned_tss=round(total_planned_tss, 1),
            total_actual_tss=round(total_actual_tss, 1),
            tss_compliance_pct=round(tss_compliance_pct, 1),
            total_planned_duration_minutes=round(total_planned_duration, 1),
            total_actual_duration_minutes=round(total_actual_duration, 1),
            duration_compliance_pct=round(duration_compliance_pct, 1),
            avg_compliance_score=round(avg_compliance_score, 1),
            patterns=patterns,
            weekly_recommendation=weekly_recommendation,
        )

    def _load_planned_workouts(self) -> list[PlannedWorkout]:
        """
        Load planned workouts from training plan JSON.

        Returns:
            List of PlannedWorkout objects
        """
        import json

        with open(self.plan_path) as f:
            plan_data = json.load(f)

        planned_workouts: list[PlannedWorkout] = []

        for week in plan_data.get("weekly_plan", []):
            for workout_data in week.get("workouts", []):
                planned_workout = self._parse_planned_workout(workout_data)
                planned_workouts.append(planned_workout)

        return planned_workouts

    def _parse_planned_workout(self, workout_data: dict[str, Any]) -> PlannedWorkout:
        """
        Parse a single planned workout from JSON data.

        Args:
            workout_data: Workout dictionary from training plan JSON

        Returns:
            PlannedWorkout object
        """
        date = datetime.strptime(workout_data["date"], "%Y-%m-%d")

        return PlannedWorkout(
            date=date,
            weekday=workout_data["weekday"],
            workout_type=workout_data["workout_type"],
            total_duration_minutes=float(workout_data["total_duration_minutes"]),
            planned_tss=float(workout_data["planned_tss"]),
            segments=workout_data.get("segments", []),
            description=workout_data.get("description", ""),
        )

    def _load_actual_workouts(self) -> list[ActualWorkout]:
        """
        Load actual workouts from activities CSV or Parquet.

        Returns:
            List of ActualWorkout objects
        """
        import csv

        activities: list[ActualWorkout] = []

        # Determine file type
        if self.activities_path.suffix == ".csv":
            with open(self.activities_path) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    activity = self._parse_actual_workout(row)
                    activities.append(activity)
        elif self.activities_path.suffix == ".parquet":
            # TODO: Add Parquet support when needed
            raise NotImplementedError("Parquet support not yet implemented")
        else:
            raise ValueError(f"Unsupported file type: {self.activities_path.suffix}")

        return activities

    def _parse_actual_workout(self, row: dict[str, str]) -> ActualWorkout:
        """
        Parse a single actual workout from CSV row.

        Args:
            row: CSV row as dictionary

        Returns:
            ActualWorkout object
        """
        # Parse date
        date = datetime.strptime(row["Activity Date"], "%Y-%m-%d")

        # Parse zone distribution from columns
        zone_distribution: dict[str, float] = {}
        zone_columns = [
            "zone1_minutes",
            "zone2_minutes",
            "zone3_minutes",
            "zone4_minutes",
            "zone5_minutes",
        ]
        for zone in zone_columns:
            if zone in row and row[zone]:
                zone_name = f"Z{zone[4]}"  # Extract zone number
                zone_distribution[zone_name] = float(row[zone])

        # Parse optional numeric fields
        def parse_optional_float(value: str | None) -> float | None:
            if value and value.strip():
                return float(value)
            return None

        def parse_optional_int(value: str | None) -> int | None:
            if value and value.strip():
                return int(float(value))
            return None

        return ActualWorkout(
            date=date,
            activity_name=row["Activity Name"],
            activity_type=row["Activity Type"],
            duration_minutes=float(row["Moving Time"]),
            distance_km=parse_optional_float(row.get("Distance")),
            average_power=parse_optional_int(row.get("Average Power")),
            normalized_power=parse_optional_int(row.get("Normalized Power")),
            actual_tss=parse_optional_float(row.get("TSS")),
            zone_distribution=zone_distribution,
        )
