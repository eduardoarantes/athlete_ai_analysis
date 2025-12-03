# Workout Comparison Agent - Detailed Architecture Plan

**Created:** 2025-11-01
**Status:** Architecture Planning
**Architecture Planner:** Claude Code
**Version:** 1.0

---

## Executive Summary

This document provides a comprehensive architectural analysis and implementation strategy for the **Workout Comparison Agent** feature. The goal is to create an AI-powered system that compares planned training workouts against actual executed workouts, providing insights on compliance, variations, and training plan adherence.

### Key Architecture Decisions

1. **Standalone-First Approach**: Implement as independent CLI commands before considering multi-agent integration
2. **Leverage Existing Patterns**: Follow established MCP-style tool architecture, PromptLoader system, and type-safe design
3. **Data Model Extension**: Extend existing training plan structure rather than creating new formats
4. **Compliance Scoring Framework**: Weighted multi-factor scoring (completion, duration, intensity, TSS)
5. **Session Management**: Use isolated sessions for each comparison operation (following multi-agent pattern)

---

## 1. Architecture Overview

### 1.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    Workout Comparison Feature                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 v                             v
    ┌────────────────────┐        ┌────────────────────┐
    │  CLI Commands      │        │  Chat Interface    │
    │  (Standalone)      │        │  (Conversational)  │
    └──────────┬─────────┘        └──────────┬─────────┘
               │                              │
               └──────────────┬───────────────┘
                              │
                              v
              ┌───────────────────────────────┐
              │  Workout Comparison Agent     │
              │  (Specialized LLM Agent)      │
              └──────────────┬────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
         v                                       v
┌────────────────────┐              ┌────────────────────┐
│  Comparison Tools  │              │  Prompt System     │
│  (MCP Pattern)     │              │  (PromptLoader)    │
└────────┬───────────┘              └────────────────────┘
         │
         v
┌────────────────────────────────────────────────────┐
│              Core Business Logic                    │
│  • WorkoutComparer (comparison algorithms)          │
│  • ComplianceScorer (scoring framework)             │
│  • PatternDetector (weekly pattern analysis)        │
│  • WorkoutMatcher (planned vs actual matching)      │
└────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Type |
|-----------|---------------|------|
| **WorkoutComparer** | Core comparison logic, coordinates sub-components | Business Logic |
| **ComplianceScorer** | Calculate compliance scores using weighted factors | Business Logic |
| **PatternDetector** | Identify weekly/monthly patterns in adherence | Business Logic |
| **WorkoutMatcher** | Match planned workouts to actual activities | Business Logic |
| **CompareWorkoutTool** | MCP-style tool wrapper for daily comparison | Tool Wrapper |
| **CompareWeeklyWorkoutsTool** | MCP-style tool wrapper for weekly comparison | Tool Wrapper |
| **WorkoutComparisonAgent** | Specialized LLM agent with custom prompt | Orchestration |
| **CLI Commands** | User-facing commands (`compare daily`, `compare weekly`) | Interface |

---

## 2. Data Architecture

### 2.1 Data Models

Based on the existing codebase pattern (no `core/models.py` - models defined in business logic modules), we'll define models in `core/workout_comparison.py`:

```python
# src/cycling_ai/core/workout_comparison.py

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass
class PlannedWorkout:
    """
    Planned workout extracted from training plan.

    Maps to existing training plan structure from core/training.py.
    """
    date: datetime
    weekday: str  # "Monday", "Tuesday", etc.
    workout_type: str  # Derived from segment types: "endurance", "threshold", "vo2max", "recovery"
    total_duration_minutes: float
    planned_tss: float  # Calculated from segments using core/tss.py
    segments: list[dict[str, Any]]  # Raw segment data from plan
    description: str  # Optional workout description

    # Derived fields for comparison
    zone_distribution: dict[str, float] = field(default_factory=dict)  # zone -> minutes
    target_avg_power_pct: float | None = None  # Average target power % across segments


@dataclass
class ActualWorkout:
    """
    Actual workout from activities CSV or Parquet cache.

    Maps to existing data structure from performance analysis.
    """
    date: datetime
    activity_name: str
    activity_type: str  # "Ride", "Virtual Ride", etc.
    duration_minutes: float
    distance_km: float | None = None

    # Power metrics (if available)
    average_power: int | None = None
    normalized_power: int | None = None
    actual_tss: float | None = None
    intensity_factor: float | None = None

    # Heart rate (if available)
    average_hr: int | None = None
    max_hr: int | None = None

    # Zone distribution (if available)
    zone_distribution: dict[str, float] = field(default_factory=dict)  # zone -> minutes


@dataclass
class ComplianceMetrics:
    """
    Detailed compliance metrics for a single workout comparison.

    Separate from WorkoutComparison to keep data clean.
    """
    completed: bool

    # Component scores (0-100)
    completion_score: float  # 100 if completed, 0 if skipped
    duration_score: float  # Based on actual/planned duration
    intensity_score: float  # Based on zone distribution match
    tss_score: float  # Based on actual/planned TSS

    # Overall weighted score
    compliance_score: float  # 0-100 weighted average

    # Detailed breakdowns
    duration_compliance_pct: float  # % of planned duration
    tss_compliance_pct: float | None  # % of planned TSS
    zone_match_scores: dict[str, float] = field(default_factory=dict)  # zone -> match score


@dataclass
class WorkoutComparison:
    """
    Result of comparing one planned workout against actual execution.
    """
    date: datetime
    planned: PlannedWorkout
    actual: ActualWorkout | None  # None if workout was skipped

    # Metrics
    metrics: ComplianceMetrics

    # Insights (generated by business logic, not LLM)
    deviations: list[str] = field(default_factory=list)  # Human-readable deviations
    recommendation: str = ""  # Actionable recommendation


@dataclass
class WeeklyPattern:
    """
    Identified pattern in weekly workout compliance.
    """
    pattern_type: str  # "skipped_hard_workouts", "short_duration", "weekend_warrior", etc.
    description: str  # Human-readable description
    severity: str  # "low", "medium", "high"
    affected_workouts: list[datetime] = field(default_factory=list)  # Dates of affected workouts


@dataclass
class WeeklyComparison:
    """
    Aggregated comparison for an entire week.
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

    # Patterns and insights
    patterns: list[WeeklyPattern] = field(default_factory=list)
    weekly_recommendation: str = ""
```

### 2.2 Data Flow

```
Training Plan JSON → PlannedWorkout extraction
        │
        ├─ Parse weekly_plan structure
        ├─ Extract segments per day
        ├─ Calculate planned TSS using core/tss.py
        └─ Derive zone distribution from segments

Activities CSV/Parquet → ActualWorkout extraction
        │
        ├─ Load from Parquet cache (if available)
        ├─ Filter by date range
        ├─ Extract power metrics
        └─ Extract zone distribution

PlannedWorkout + ActualWorkout → WorkoutComparison
        │
        ├─ WorkoutMatcher: Match by date (±1 day fuzzy match)
        ├─ ComplianceScorer: Calculate scores
        ├─ DeviationDetector: Identify specific deviations
        └─ RecommendationEngine: Generate actionable recommendations

List[WorkoutComparison] → WeeklyComparison
        │
        ├─ Aggregate metrics
        ├─ PatternDetector: Identify patterns
        └─ Generate weekly recommendation
```

### 2.3 Integration with Existing Data Structures

**Training Plan Format** (from `core/training.py`):

The existing training plan structure is:
```python
{
    "total_weeks": 12,
    "target_ftp": 280,
    "weekly_plan": [
        {
            "week_number": 1,
            "phase": "Base Building",
            "workouts": [
                {
                    "weekday": "Monday",
                    "segments": [
                        {
                            "type": "warmup",
                            "duration_min": 10,
                            "power_low_pct": 50,
                            "power_high_pct": 60,
                            "description": "Easy warmup"
                        },
                        ...
                    ]
                }
            ]
        }
    ]
}
```

**Activities Data** (from Parquet cache):

```python
# Columns: Activity Date, Activity Name, Activity Type, Duration,
#          Average Power, Normalized Power, TSS, zones
```

**Key Integration Points:**

1. **TSS Calculation**: Reuse `core/tss.calculate_workout_tss()` for planned TSS
2. **Zone Definitions**: Use existing `core/power_zones.py` for zone calculations
3. **Data Loading**: Leverage existing Parquet cache infrastructure
4. **Athlete Profile**: Use `core/athlete.load_athlete_profile()` for FTP and zones

---

## 3. Core Business Logic Architecture

### 3.1 Module Structure

```
src/cycling_ai/core/workout_comparison.py
│
├── Data Models (see section 2.1)
│
├── WorkoutMatcher
│   ├── match_by_date()          # Exact date match
│   ├── fuzzy_match()            # ±1 day with type similarity
│   └── combine_activities()     # Sum multiple activities on same day
│
├── ComplianceScorer
│   ├── calculate_compliance_score()      # Main weighted scoring
│   ├── score_completion()                # 100 or 0
│   ├── score_duration()                  # Compare durations
│   ├── score_intensity()                 # Zone distribution match
│   ├── score_tss()                       # TSS match
│   └── calculate_zone_match_score()      # Detailed zone comparison
│
├── DeviationDetector
│   ├── detect_deviations()               # Main entry point
│   ├── detect_duration_deviation()       # Too short/long
│   ├── detect_intensity_deviation()      # Wrong zones
│   └── detect_type_mismatch()           # Wrong workout type
│
├── RecommendationEngine
│   ├── generate_recommendation()         # Main entry point
│   └── recommendation_templates         # Template library
│
├── PatternDetector
│   ├── identify_weekly_patterns()        # Main entry point
│   ├── detect_skipped_hard_workouts()   # Specific pattern
│   ├── detect_short_duration_pattern()  # Specific pattern
│   ├── detect_weekend_warrior()         # Specific pattern
│   └── detect_scheduling_conflicts()    # Specific pattern
│
└── WorkoutComparer (Main Facade)
    ├── compare_daily_workout()           # Single day comparison
    ├── compare_weekly_workouts()         # Week comparison
    ├── load_planned_workout()            # Extract from plan JSON
    └── load_actual_workout()             # Extract from CSV/Parquet
```

### 3.2 Key Algorithms

#### 3.2.1 Compliance Scoring Algorithm

```python
def calculate_compliance_score(
    planned: PlannedWorkout,
    actual: ActualWorkout | None,
    ftp: int,
) -> ComplianceMetrics:
    """
    Calculate multi-factor compliance score.

    Scoring Framework:
    - Completion: 40% weight (binary: completed or not)
    - Duration: 25% weight (actual/planned ratio, capped at 100)
    - Intensity: 25% weight (zone distribution match)
    - TSS: 10% weight (actual/planned TSS ratio, capped at 100)

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
            tss_compliance_pct=0.0,
        )

    # 1. Completion score (40% weight)
    completion_score = 100.0

    # 2. Duration score (25% weight)
    duration_ratio = actual.duration_minutes / planned.total_duration_minutes
    duration_score = min(100.0, duration_ratio * 100)
    duration_compliance_pct = duration_ratio * 100

    # 3. Intensity score (25% weight)
    intensity_score = calculate_zone_match_score(
        planned.zone_distribution,
        actual.zone_distribution
    )

    # 4. TSS score (10% weight)
    tss_score = 100.0  # Default if no TSS data
    tss_compliance_pct = None
    if planned.planned_tss and actual.actual_tss:
        tss_ratio = actual.actual_tss / planned.planned_tss
        tss_score = min(100.0, tss_ratio * 100)
        tss_compliance_pct = tss_ratio * 100

    # Weighted average
    compliance_score = (
        completion_score * 0.40 +
        duration_score * 0.25 +
        intensity_score * 0.25 +
        tss_score * 0.10
    )

    return ComplianceMetrics(
        completed=True,
        completion_score=completion_score,
        duration_score=duration_score,
        intensity_score=intensity_score,
        tss_score=tss_score,
        compliance_score=compliance_score,
        duration_compliance_pct=duration_compliance_pct,
        tss_compliance_pct=tss_compliance_pct,
    )
```

#### 3.2.2 Zone Match Scoring Algorithm

```python
def calculate_zone_match_score(
    planned_zones: dict[str, float],
    actual_zones: dict[str, float]
) -> float:
    """
    Calculate 0-100 score for zone distribution match.

    Algorithm:
    1. Calculate total time deviation across all zones
    2. Express as percentage of total planned time
    3. Convert to 0-100 score (lower deviation = higher score)

    Example:
        Planned: Z2=60min, Z3=0min
        Actual:  Z2=40min, Z3=20min

        Total deviation = |60-40| + |0-20| = 40 minutes
        Total planned time = 60 minutes
        Deviation % = 40/60 = 66.7%
        Score = 100 - 66.7 = 33.3

    Returns:
        Score from 0-100 (100 = perfect match)
    """
    if not planned_zones:
        return 100.0  # No planned zones = perfect match

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
```

#### 3.2.3 Pattern Detection Algorithm

```python
def identify_weekly_patterns(
    daily_comparisons: list[WorkoutComparison],
    min_occurrences: int = 2,
) -> list[WeeklyPattern]:
    """
    Identify patterns in weekly workout compliance.

    Patterns Detected:
    1. Skipped hard workouts (threshold, VO2max consistently skipped)
    2. Short duration pattern (workouts consistently cut short)
    3. Weekend warrior (higher compliance on weekends)
    4. Scheduling conflicts (specific day consistently skipped)
    5. Intensity avoidance (consistently training at lower intensity)

    Args:
        daily_comparisons: List of daily workout comparisons
        min_occurrences: Minimum occurrences to constitute a pattern (default: 2)

    Returns:
        List of identified patterns with severity
    """
    patterns = []

    # Pattern 1: Skipping hard workouts
    hard_workouts = [
        c for c in daily_comparisons
        if c.planned.workout_type in ["threshold", "vo2max", "tempo"]
    ]
    if len(hard_workouts) >= min_occurrences:
        skipped_hard = [c for c in hard_workouts if not c.metrics.completed]
        if len(skipped_hard) >= min_occurrences:
            severity = "high" if len(skipped_hard) == len(hard_workouts) else "medium"
            patterns.append(WeeklyPattern(
                pattern_type="skipped_hard_workouts",
                description=f"Tendency to skip high-intensity workouts ({len(skipped_hard)}/{len(hard_workouts)})",
                severity=severity,
                affected_workouts=[c.date for c in skipped_hard]
            ))

    # Pattern 2: Short duration pattern
    completed = [c for c in daily_comparisons if c.metrics.completed]
    if len(completed) >= min_occurrences:
        avg_duration_compliance = sum(
            c.metrics.duration_compliance_pct for c in completed
        ) / len(completed)

        if avg_duration_compliance < 80:
            severity = "high" if avg_duration_compliance < 70 else "medium"
            patterns.append(WeeklyPattern(
                pattern_type="short_duration",
                description=f"Workouts consistently shorter than planned ({avg_duration_compliance:.0f}% avg)",
                severity=severity,
                affected_workouts=[c.date for c in completed]
            ))

    # Pattern 3: Weekend warrior
    weekend_workouts = [
        c for c in daily_comparisons
        if c.date.weekday() >= 5  # Saturday=5, Sunday=6
    ]
    weekday_workouts = [
        c for c in daily_comparisons
        if c.date.weekday() < 5
    ]

    if weekend_workouts and weekday_workouts:
        weekend_compliance = sum(
            c.metrics.compliance_score for c in weekend_workouts
        ) / len(weekend_workouts)

        weekday_compliance = sum(
            c.metrics.compliance_score for c in weekday_workouts
        ) / len(weekday_workouts)

        if weekend_compliance > weekday_compliance + 20:
            patterns.append(WeeklyPattern(
                pattern_type="weekend_warrior",
                description=f"Higher compliance on weekends (weekend: {weekend_compliance:.0f}, weekday: {weekday_compliance:.0f})",
                severity="low",
                affected_workouts=[c.date for c in weekday_workouts if c.metrics.compliance_score < 70]
            ))

    # Pattern 4: Specific day scheduling conflicts
    by_weekday: dict[int, list[WorkoutComparison]] = {}
    for c in daily_comparisons:
        weekday = c.date.weekday()
        if weekday not in by_weekday:
            by_weekday[weekday] = []
        by_weekday[weekday].append(c)

    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for weekday, workouts in by_weekday.items():
        if len(workouts) >= min_occurrences:
            skipped = [w for w in workouts if not w.metrics.completed]
            if len(skipped) >= min_occurrences and len(skipped) == len(workouts):
                patterns.append(WeeklyPattern(
                    pattern_type="scheduling_conflict",
                    description=f"{weekday_names[weekday]} workouts consistently skipped (possible scheduling conflict)",
                    severity="medium",
                    affected_workouts=[c.date for c in skipped]
                ))

    return patterns
```

#### 3.2.4 Workout Matching Algorithm

```python
def match_workouts(
    planned_workouts: list[PlannedWorkout],
    actual_activities: list[ActualWorkout],
    fuzzy_match_days: int = 1,
) -> list[tuple[PlannedWorkout, ActualWorkout | None]]:
    """
    Match planned workouts to actual activities.

    Matching Strategy:
    1. Primary: Exact date match
    2. Fallback: Fuzzy match within ±N days with type similarity
    3. Handle multiple activities per day (combine or select best match)

    Args:
        planned_workouts: List of planned workouts
        actual_activities: List of actual activities
        fuzzy_match_days: Number of days to allow for fuzzy matching (default: 1)

    Returns:
        List of (PlannedWorkout, ActualWorkout | None) tuples
    """
    matched_pairs = []
    used_actuals = set()

    for planned in planned_workouts:
        planned_date = planned.date.date()

        # Strategy 1: Exact date match
        exact_matches = [
            actual for actual in actual_activities
            if actual.date.date() == planned_date
            and actual not in used_actuals
        ]

        if exact_matches:
            # If multiple activities on same day, combine them or select best
            if len(exact_matches) == 1:
                matched_pairs.append((planned, exact_matches[0]))
                used_actuals.add(exact_matches[0])
            else:
                # Multiple activities: select longest duration as primary
                best_match = max(exact_matches, key=lambda a: a.duration_minutes)
                matched_pairs.append((planned, best_match))
                used_actuals.add(best_match)
            continue

        # Strategy 2: Fuzzy match (±N days)
        fuzzy_matches = []
        for actual in actual_activities:
            if actual in used_actuals:
                continue

            day_diff = abs((actual.date.date() - planned_date).days)
            if day_diff <= fuzzy_match_days:
                # Calculate similarity score based on type and duration
                similarity = calculate_workout_similarity(planned, actual)
                if similarity > 0.5:  # Threshold for considering a match
                    fuzzy_matches.append((actual, similarity))

        if fuzzy_matches:
            # Select best fuzzy match
            best_match = max(fuzzy_matches, key=lambda x: x[1])[0]
            matched_pairs.append((planned, best_match))
            used_actuals.add(best_match)
        else:
            # No match found - workout was skipped
            matched_pairs.append((planned, None))

    return matched_pairs


def calculate_workout_similarity(
    planned: PlannedWorkout,
    actual: ActualWorkout,
) -> float:
    """
    Calculate similarity score between planned and actual workout.

    Factors:
    - Duration similarity (0-1)
    - Type match (0-1)

    Returns:
        Similarity score 0-1 (1 = perfect match)
    """
    # Duration similarity
    duration_ratio = min(
        actual.duration_minutes / planned.total_duration_minutes,
        planned.total_duration_minutes / actual.duration_minutes
    )
    duration_similarity = duration_ratio

    # Type match (basic heuristic)
    type_match = 1.0 if actual.activity_type in ["Ride", "Virtual Ride"] else 0.5

    # Weighted average
    similarity = (duration_similarity * 0.7 + type_match * 0.3)

    return similarity
```

---

## 4. Tool Architecture

### 4.1 Tool Definitions

Following the existing pattern from `tools/wrappers/`, we'll create two tools:

```python
# src/cycling_ai/tools/wrappers/workout_comparison_tool.py

from dataclasses import dataclass
from pathlib import Path
import json
import logging

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool
from cycling_ai.core.workout_comparison import WorkoutComparer
from cycling_ai.core.athlete import load_athlete_profile

logger = logging.getLogger(__name__)


@register_tool
@dataclass
class CompareWorkoutTool(BaseTool):
    """
    Tool for comparing a single planned workout against actual execution.

    This tool analyzes how well an athlete executed a specific day's planned workout,
    providing compliance metrics, deviations, and actionable recommendations.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="compare_workout",
            description=(
                "Compare a planned workout against actual execution for a specific date. "
                "Analyzes compliance (completion, duration, intensity, TSS), identifies "
                "deviations, and provides coaching recommendations. Use this for daily "
                "workout compliance analysis."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="date",
                    type="string",
                    description="Date of workout to compare (YYYY-MM-DD format)",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_path",
                    type="string",
                    description="Path to training plan JSON file (output from finalize_training_plan)",
                    required=True,
                ),
                ToolParameter(
                    name="activities_csv_path",
                    type="string",
                    description="Path to activities CSV file or Parquet cache",
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description="Path to athlete_profile.json (for FTP and zone calculations)",
                    required=True,
                ),
            ],
        )

    def execute(
        self,
        date: str,
        training_plan_path: str,
        activities_csv_path: str,
        athlete_profile_path: str,
    ) -> ToolExecutionResult:
        """
        Execute workout comparison.

        Returns:
            ToolExecutionResult with WorkoutComparison as JSON
        """
        try:
            logger.info(f"Comparing workout for date: {date}")

            # Validate inputs
            plan_path = Path(training_plan_path)
            csv_path = Path(activities_csv_path)
            profile_path = Path(athlete_profile_path)

            if not plan_path.exists():
                return ToolExecutionResult(
                    success=False,
                    error=f"Training plan not found: {training_plan_path}",
                )

            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    error=f"Activities file not found: {activities_csv_path}",
                )

            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    error=f"Athlete profile not found: {athlete_profile_path}",
                )

            # Load athlete profile
            profile = load_athlete_profile(profile_path)

            # Initialize comparer
            comparer = WorkoutComparer(
                plan_path=plan_path,
                activities_path=csv_path,
                ftp=profile.ftp,
            )

            # Execute comparison
            comparison = comparer.compare_daily_workout(date)

            # Serialize to JSON
            result_data = {
                "date": comparison.date.isoformat(),
                "planned": {
                    "weekday": comparison.planned.weekday,
                    "type": comparison.planned.workout_type,
                    "duration_minutes": comparison.planned.total_duration_minutes,
                    "tss": comparison.planned.planned_tss,
                    "zone_distribution": comparison.planned.zone_distribution,
                },
                "actual": {
                    "completed": comparison.actual is not None,
                    "activity_name": comparison.actual.activity_name if comparison.actual else None,
                    "duration_minutes": comparison.actual.duration_minutes if comparison.actual else 0,
                    "tss": comparison.actual.actual_tss if comparison.actual else None,
                    "zone_distribution": comparison.actual.zone_distribution if comparison.actual else {},
                } if comparison.actual else None,
                "compliance": {
                    "completed": comparison.metrics.completed,
                    "compliance_score": comparison.metrics.compliance_score,
                    "completion_score": comparison.metrics.completion_score,
                    "duration_score": comparison.metrics.duration_score,
                    "intensity_score": comparison.metrics.intensity_score,
                    "tss_score": comparison.metrics.tss_score,
                    "duration_compliance_pct": comparison.metrics.duration_compliance_pct,
                    "tss_compliance_pct": comparison.metrics.tss_compliance_pct,
                },
                "deviations": comparison.deviations,
                "recommendation": comparison.recommendation,
            }

            return ToolExecutionResult(
                success=True,
                output=json.dumps(result_data, indent=2),
                format="json",
            )

        except Exception as e:
            logger.error(f"Error comparing workout: {e}", exc_info=True)
            return ToolExecutionResult(
                success=False,
                error=f"Failed to compare workout: {str(e)}",
            )


@register_tool
@dataclass
class CompareWeeklyWorkoutsTool(BaseTool):
    """
    Tool for comparing an entire week of planned vs actual workouts.

    Provides aggregated compliance metrics, pattern identification,
    and weekly coaching insights.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="compare_weekly_workouts",
            description=(
                "Compare an entire week of planned workouts against actual execution. "
                "Provides weekly compliance metrics, identifies patterns (e.g., skipping "
                "hard workouts, weekend warrior), and generates weekly coaching insights. "
                "Use this for weekly compliance analysis and pattern detection."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="week_start_date",
                    type="string",
                    description="Start date of week to analyze (Monday, YYYY-MM-DD format)",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_path",
                    type="string",
                    description="Path to training plan JSON file",
                    required=True,
                ),
                ToolParameter(
                    name="activities_csv_path",
                    type="string",
                    description="Path to activities CSV file or Parquet cache",
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description="Path to athlete_profile.json",
                    required=True,
                ),
            ],
        )

    def execute(
        self,
        week_start_date: str,
        training_plan_path: str,
        activities_csv_path: str,
        athlete_profile_path: str,
    ) -> ToolExecutionResult:
        """
        Execute weekly comparison.

        Returns:
            ToolExecutionResult with WeeklyComparison as JSON
        """
        # Similar structure to daily comparison
        # Returns WeeklyComparison serialized to JSON
        # (Full implementation follows same pattern)
        pass
```

### 4.2 Tool Registration

Tools use `@register_tool` decorator for auto-discovery via `ToolRegistry`. No manual registration needed.

---

## 5. Prompt Architecture

### 5.1 Prompt File Structure

Following the existing `PromptLoader` pattern:

```
prompts/
└── default/
    └── 1.0/
        ├── workout_comparison_agent.txt           # System prompt
        ├── workout_comparison_user_daily.txt      # User prompt template for daily
        └── workout_comparison_user_weekly.txt     # User prompt template for weekly
```

### 5.2 System Prompt Design

```markdown
# prompts/default/1.0/workout_comparison_agent.txt

You are a **Workout Compliance Analysis Specialist** for cycling training.

## Your Role

Analyze how well an athlete executed their planned workouts compared to the training plan. Provide objective, data-driven insights with actionable coaching recommendations.

## Available Tools

1. **compare_workout**: Compare a single day's planned vs actual workout
   - Use for: Daily compliance analysis
   - Returns: Compliance scores, deviations, recommendations

2. **compare_weekly_workouts**: Compare an entire week of workouts
   - Use for: Weekly patterns, trend analysis
   - Returns: Aggregated metrics, pattern identification, weekly insights

## Analysis Framework

### Compliance Scoring (0-100)

Weighted factors:
- **Completion (40%)**: Did the workout happen?
- **Duration (25%)**: How close to planned duration?
- **Intensity (25%)**: Time in correct zones?
- **TSS (10%)**: Overall training stress match?

### Compliance Interpretation

- **90-100**: Excellent compliance - workout executed as planned
- **70-89**: Good compliance - minor deviations acceptable
- **50-69**: Moderate compliance - significant modifications made
- **Below 50**: Poor compliance - workout substantially different or incomplete

### Deviation Categories

1. **Completion**: Skipped entirely
2. **Duration**: Too short (< 90%) or too long (> 110%)
3. **Intensity**: Wrong zones (e.g., Z3 instead of Z2)
4. **Type Mismatch**: Different workout type than planned

### Pattern Detection (Weekly Analysis)

Identify these patterns:
- Skipping high-intensity workouts (threshold, VO2max, tempo)
- Consistently cutting duration short
- Weekend warrior (higher compliance on weekends)
- Specific day scheduling conflicts
- Intensity avoidance (always training easier than planned)

## Coaching Approach

Be **objective but supportive**:

✅ **Good Practices:**
- Focus on facts and data
- Acknowledge valid reasons for modifications (fatigue, recovery, schedule)
- Provide actionable recommendations
- Recognize patterns without judgment
- Suggest plan adjustments if chronic non-compliance

❌ **Avoid:**
- Judgmental language
- Assuming reasons without data
- Overly rigid adherence expectations
- Ignoring context (athlete may need recovery)

## Response Format

### Daily Comparison

Provide:
1. **Compliance Summary**: Overall score with interpretation
2. **Detailed Breakdown**: Completion, duration, intensity, TSS scores
3. **Deviations Identified**: Specific differences from plan
4. **Recommendation**: Actionable next steps

### Weekly Comparison

Provide:
1. **Weekly Metrics**: Completion rate, avg compliance, total TSS
2. **Daily Breakdown**: Brief summary per day
3. **Patterns Identified**: Any recurring behaviors
4. **Weekly Recommendation**: Coaching insights for improvement

## Examples

### Example 1: Good Compliance

"Excellent compliance (95/100). Workout executed almost exactly as planned. Duration matched (90 minutes), intensity distribution correct (45 min Z2, 30 min Z4), TSS on target (85 vs 83 planned). Minor deviation: 2 minutes shorter on Z4 intervals. Recommendation: Continue current approach - execution is excellent."

### Example 2: Modified Workout

"Moderate compliance (68/100). Workout completed but significantly modified. Duration: 75 min vs 90 planned (83%). Intensity lower than planned: 30 min Z2 instead of Z4 intervals. Possible reasons: fatigue, recovery need, or scheduling constraints. Recommendation: If feeling fatigued, this was appropriate recovery. If schedule-driven, consider moving hard workouts to days with more time availability."

### Example 3: Skipped Workout

"No compliance (0/100). Workout skipped entirely. This was a planned threshold workout (85 TSS). Recommendation: If one-time occurrence, reschedule for tomorrow if possible. If recurring pattern, review weekly schedule to protect hard workout days."

## Remember

- Athletes modify workouts for valid reasons (recovery, fatigue, life constraints)
- Chronic modifications suggest plan adjustment needed
- 80%+ weekly compliance is good; 100% not always optimal
- Focus on patterns over individual deviations
```

### 5.3 User Prompt Templates

```markdown
# prompts/default/1.0/workout_comparison_user_daily.txt

Compare the workout on {date} from the training plan against actual execution.

Training plan: {training_plan_path}
Activities data: {activities_csv_path}
Athlete profile: {athlete_profile_path}

Provide:
1. Compliance summary with overall score
2. Detailed breakdown (completion, duration, intensity, TSS)
3. Specific deviations identified
4. Actionable recommendation
```

```markdown
# prompts/default/1.0/workout_comparison_user_weekly.txt

Compare the week starting {week_start_date} from the training plan against actual execution.

Training plan: {training_plan_path}
Activities data: {activities_csv_path}
Athlete profile: {athlete_profile_path}

Provide:
1. Weekly compliance metrics
2. Daily breakdown (brief summary per day)
3. Patterns identified (if any)
4. Weekly coaching recommendation
```

### 5.4 Prompt Loader Integration

Add methods to `src/cycling_ai/orchestration/prompts.py`:

```python
class AgentPromptsManager:
    # ... existing methods ...

    def get_workout_comparison_prompt(self) -> str:
        """Get workout comparison agent system prompt."""
        return self._prompt_loader.get_workout_comparison_prompt()

    def get_workout_comparison_user_prompt_daily(self, **kwargs: str) -> str:
        """Get daily comparison user prompt with formatting."""
        return self._prompt_loader.get_workout_comparison_user_prompt_daily(**kwargs)

    def get_workout_comparison_user_prompt_weekly(self, **kwargs: str) -> str:
        """Get weekly comparison user prompt with formatting."""
        return self._prompt_loader.get_workout_comparison_user_prompt_weekly(**kwargs)
```

Add loader methods to `src/cycling_ai/orchestration/prompt_loader.py`:

```python
class PromptLoader:
    # ... existing methods ...

    def get_workout_comparison_prompt(self) -> str:
        """Load workout comparison agent system prompt."""
        return self._load_prompt("workout_comparison_agent.txt")

    def get_workout_comparison_user_prompt_daily(self, **kwargs: str) -> str:
        """Load and format daily comparison user prompt."""
        template = self._load_prompt("workout_comparison_user_daily.txt")
        return template.format(**kwargs)

    def get_workout_comparison_user_prompt_weekly(self, **kwargs: str) -> str:
        """Load and format weekly comparison user prompt."""
        template = self._load_prompt("workout_comparison_user_weekly.txt")
        return template.format(**kwargs)
```

---

## 6. CLI Architecture

### 6.1 Command Structure

```bash
cycling-ai compare
├── daily          # Compare single day
└── weekly         # Compare entire week
```

### 6.2 Implementation

```python
# src/cycling_ai/cli/commands/compare.py

import click
from pathlib import Path
import logging
from datetime import datetime

from cycling_ai.orchestration.agent import LLMAgent, AgentFactory
from cycling_ai.orchestration.session import ConversationSession, SessionManager
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.tools.registry import ToolRegistry
from cycling_ai.providers.factory import ProviderFactory, ProviderConfig

logger = logging.getLogger(__name__)


@click.group()
def compare():
    """Compare planned vs actual workout execution."""
    pass


@compare.command()
@click.option(
    "--date",
    required=True,
    help="Workout date to compare (YYYY-MM-DD)",
)
@click.option(
    "--plan",
    "plan_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to training plan JSON file",
)
@click.option(
    "--csv",
    "csv_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to activities CSV or Parquet file",
)
@click.option(
    "--profile",
    "profile_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to athlete_profile.json",
)
@click.option(
    "--provider",
    default="anthropic",
    help="LLM provider (anthropic, openai, gemini, ollama)",
)
@click.option(
    "--model",
    default=None,
    help="Specific model to use (optional)",
)
@click.option(
    "--verbose",
    is_flag=True,
    help="Enable verbose output",
)
def daily(
    date: str,
    plan_path: Path,
    csv_path: Path,
    profile_path: Path,
    provider: str,
    model: str | None,
    verbose: bool,
):
    """
    Compare a single day's planned vs actual workout.

    Example:
        cycling-ai compare daily --date 2024-11-01 --plan plan.json --csv activities.csv --profile profile.json
    """
    if verbose:
        logging.basicConfig(level=logging.DEBUG)

    try:
        # Validate date format
        try:
            parsed_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            click.echo(f"❌ Invalid date format: {date}. Use YYYY-MM-DD", err=True)
            raise click.Abort()

        click.echo(f"🔍 Comparing workout for {date}...")
        click.echo()

        # Initialize provider
        provider_config = ProviderConfig(
            provider_name=provider,
            model_name=model,
        )
        llm_provider = ProviderFactory.create_provider(provider_config)

        # Initialize prompts manager
        prompts_manager = AgentPromptsManager()
        system_prompt = prompts_manager.get_workout_comparison_prompt()

        # Create session
        session = ConversationSession(
            provider_name=provider,
            system_prompt=system_prompt,
        )

        # Create agent with tools
        tool_registry = ToolRegistry()
        tools = tool_registry.get_tools_by_category("analysis")

        agent = LLMAgent(
            provider=llm_provider,
            session=session,
        )
        agent.register_tools(tools)

        # Format user message
        user_message = prompts_manager.get_workout_comparison_user_prompt_daily(
            date=date,
            training_plan_path=str(plan_path),
            activities_csv_path=str(csv_path),
            athlete_profile_path=str(profile_path),
        )

        # Execute comparison
        response = agent.process_message(user_message)

        # Display result
        click.echo("=" * 70)
        click.echo(f"WORKOUT COMPARISON - {date}")
        click.echo("=" * 70)
        click.echo()
        click.echo(response)
        click.echo()

    except Exception as e:
        logger.error(f"Error during daily comparison: {e}", exc_info=True)
        click.echo(f"❌ Error: {e}", err=True)
        raise click.Abort()


@compare.command()
@click.option(
    "--week-start",
    required=True,
    help="Week start date (Monday, YYYY-MM-DD)",
)
@click.option(
    "--plan",
    "plan_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to training plan JSON file",
)
@click.option(
    "--csv",
    "csv_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to activities CSV or Parquet file",
)
@click.option(
    "--profile",
    "profile_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to athlete_profile.json",
)
@click.option(
    "--provider",
    default="anthropic",
    help="LLM provider (anthropic, openai, gemini, ollama)",
)
@click.option(
    "--model",
    default=None,
    help="Specific model to use (optional)",
)
@click.option(
    "--verbose",
    is_flag=True,
    help="Enable verbose output",
)
def weekly(
    week_start: str,
    plan_path: Path,
    csv_path: Path,
    profile_path: Path,
    provider: str,
    model: str | None,
    verbose: bool,
):
    """
    Compare an entire week's planned vs actual workouts.

    Example:
        cycling-ai compare weekly --week-start 2024-10-28 --plan plan.json --csv activities.csv --profile profile.json
    """
    # Similar implementation to daily command
    # Uses compare_weekly_workouts tool instead
    pass
```

### 6.3 CLI Registration

Add to `src/cycling_ai/cli/main.py`:

```python
from cycling_ai.cli.commands.compare import compare

# ... existing imports and setup ...

# Add compare command group
cli.add_command(compare)
```

---

## 7. Testing Strategy

### 7.1 Test Structure

```
tests/
├── core/
│   └── test_workout_comparison.py          # Unit tests for business logic
├── tools/
│   └── wrappers/
│       └── test_workout_comparison_tool.py # Tool integration tests
├── orchestration/
│   └── test_workout_comparison_agent.py    # Agent e2e tests
├── cli/
│   └── test_compare_commands.py            # CLI tests
└── fixtures/
    ├── sample_training_plan.json           # Test plan with 2 weeks
    ├── sample_activities_perfect.csv       # Perfect compliance
    ├── sample_activities_partial.csv       # Partial compliance
    └── sample_athlete_profile.json         # Test athlete
```

### 7.2 Test Fixtures Design

**Sample Training Plan** (2 weeks, variety of workouts):

```json
{
  "total_weeks": 2,
  "target_ftp": 265,
  "weekly_plan": [
    {
      "week_number": 1,
      "phase": "Base Building",
      "workouts": [
        {
          "weekday": "Monday",
          "segments": [
            {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60},
            {"type": "steady", "duration_min": 60, "power_low_pct": 65, "power_high_pct": 75},
            {"type": "cooldown", "duration_min": 10, "power_low_pct": 45, "power_high_pct": 55}
          ]
        },
        {
          "weekday": "Wednesday",
          "segments": [
            {"type": "warmup", "duration_min": 15, "power_low_pct": 50, "power_high_pct": 60},
            {"type": "interval", "duration_min": 10, "power_low_pct": 95, "power_high_pct": 105},
            {"type": "recovery", "duration_min": 5, "power_low_pct": 45, "power_high_pct": 55},
            {"type": "interval", "duration_min": 10, "power_low_pct": 95, "power_high_pct": 105},
            {"type": "recovery", "duration_min": 5, "power_low_pct": 45, "power_high_pct": 55},
            {"type": "interval", "duration_min": 10, "power_low_pct": 95, "power_high_pct": 105},
            {"type": "cooldown", "duration_min": 10, "power_low_pct": 45, "power_high_pct": 55}
          ]
        },
        {
          "weekday": "Saturday",
          "segments": [
            {"type": "warmup", "duration_min": 15, "power_low_pct": 50, "power_high_pct": 60},
            {"type": "steady", "duration_min": 120, "power_low_pct": 65, "power_high_pct": 75},
            {"type": "cooldown", "duration_min": 15, "power_low_pct": 45, "power_high_pct": 55}
          ]
        }
      ]
    },
    {
      "week_number": 2,
      "phase": "Base Building",
      "workouts": [
        {
          "weekday": "Monday",
          "segments": [
            {"type": "recovery", "duration_min": 45, "power_low_pct": 45, "power_high_pct": 55}
          ]
        },
        {
          "weekday": "Thursday",
          "segments": [
            {"type": "warmup", "duration_min": 15, "power_low_pct": 50, "power_high_pct": 60},
            {"type": "tempo", "duration_min": 30, "power_low_pct": 85, "power_high_pct": 95},
            {"type": "cooldown", "duration_min": 15, "power_low_pct": 45, "power_high_pct": 55}
          ]
        }
      ]
    }
  ]
}
```

### 7.3 Key Test Cases

```python
# tests/core/test_workout_comparison.py

import pytest
from datetime import datetime, timedelta
from cycling_ai.core.workout_comparison import (
    WorkoutComparer,
    ComplianceScorer,
    PatternDetector,
    PlannedWorkout,
    ActualWorkout,
)


class TestComplianceScorer:
    """Test compliance scoring algorithms."""

    def test_perfect_compliance(self):
        """Test workout executed exactly as planned."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 1),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90,
            planned_tss=65,
            segments=[],
            description="Easy endurance",
            zone_distribution={"Z1": 10, "Z2": 75, "Z3": 5},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 1),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=90,
            average_power=175,
            normalized_power=180,
            actual_tss=65,
            zone_distribution={"Z1": 10, "Z2": 75, "Z3": 5},
        )

        scorer = ComplianceScorer(ftp=265)
        metrics = scorer.calculate_compliance_score(planned, actual)

        assert metrics.compliance_score >= 99.0  # Allow minor floating point diff
        assert metrics.completed
        assert metrics.completion_score == 100.0
        assert metrics.duration_score >= 99.0
        assert metrics.intensity_score >= 99.0
        assert metrics.tss_score >= 99.0

    def test_workout_skipped(self):
        """Test skipped workout."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 1),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=75,
            planned_tss=85,
            segments=[],
            description="Threshold intervals",
            zone_distribution={"Z2": 35, "Z4": 30, "Z1": 10},
        )

        scorer = ComplianceScorer(ftp=265)
        metrics = scorer.calculate_compliance_score(planned, None)

        assert metrics.compliance_score == 0.0
        assert not metrics.completed
        assert metrics.completion_score == 0.0
        assert metrics.duration_score == 0.0

    def test_short_duration_deviation(self):
        """Test workout cut short by 20%."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 1),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90,
            planned_tss=65,
            segments=[],
            description="Endurance ride",
            zone_distribution={"Z2": 80, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 1),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=72,  # 80% of planned
            actual_tss=52,
            zone_distribution={"Z2": 64, "Z1": 8},
        )

        scorer = ComplianceScorer(ftp=265)
        metrics = scorer.calculate_compliance_score(planned, actual)

        assert metrics.completed
        assert 70 < metrics.compliance_score < 85  # Moderate compliance
        assert metrics.duration_compliance_pct == 80.0

    def test_intensity_deviation(self):
        """Test wrong intensity zones."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 1),
            weekday="Wednesday",
            workout_type="threshold",
            total_duration_minutes=75,
            planned_tss=85,
            segments=[],
            description="Threshold intervals",
            zone_distribution={"Z2": 35, "Z4": 30, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 1),
            activity_name="Threshold Workout",
            activity_type="Virtual Ride",
            duration_minutes=75,
            actual_tss=68,  # Lower TSS due to lower intensity
            zone_distribution={"Z2": 40, "Z3": 30, "Z1": 5},  # Z3 instead of Z4
        )

        scorer = ComplianceScorer(ftp=265)
        metrics = scorer.calculate_compliance_score(planned, actual)

        assert metrics.completed
        assert 60 < metrics.compliance_score < 80  # Lower due to intensity deviation
        assert metrics.intensity_score < 70  # Poor zone match


class TestPatternDetector:
    """Test pattern detection algorithms."""

    def test_skipped_hard_workouts_pattern(self):
        """Test detection of consistently skipped high-intensity workouts."""
        # Create 1 week with 3 hard workouts, all skipped
        comparisons = [
            WorkoutComparison(
                date=datetime(2024, 11, 1),
                planned=PlannedWorkout(..., workout_type="threshold"),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(completed=False, compliance_score=0.0, ...),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 3),
                planned=PlannedWorkout(..., workout_type="vo2max"),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(completed=False, compliance_score=0.0, ...),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 5),
                planned=PlannedWorkout(..., workout_type="endurance"),
                actual=ActualWorkout(...),  # Completed
                metrics=ComplianceMetrics(completed=True, compliance_score=95.0, ...),
            ),
        ]

        detector = PatternDetector()
        patterns = detector.identify_weekly_patterns(comparisons)

        assert len(patterns) > 0
        assert any(p.pattern_type == "skipped_hard_workouts" for p in patterns)
        pattern = next(p for p in patterns if p.pattern_type == "skipped_hard_workouts")
        assert pattern.severity in ["medium", "high"]

    def test_weekend_warrior_pattern(self):
        """Test detection of weekend warrior pattern."""
        # Create week with better compliance on weekends
        comparisons = [
            # Weekday workouts - poor compliance
            WorkoutComparison(
                date=datetime(2024, 11, 4),  # Monday
                planned=PlannedWorkout(...),
                actual=ActualWorkout(...),
                metrics=ComplianceMetrics(completed=True, compliance_score=60.0, ...),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 6),  # Wednesday
                planned=PlannedWorkout(...),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(completed=False, compliance_score=0.0, ...),
            ),
            # Weekend workouts - excellent compliance
            WorkoutComparison(
                date=datetime(2024, 11, 9),  # Saturday
                planned=PlannedWorkout(...),
                actual=ActualWorkout(...),
                metrics=ComplianceMetrics(completed=True, compliance_score=95.0, ...),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 10),  # Sunday
                planned=PlannedWorkout(...),
                actual=ActualWorkout(...),
                metrics=ComplianceMetrics(completed=True, compliance_score=92.0, ...),
            ),
        ]

        detector = PatternDetector()
        patterns = detector.identify_weekly_patterns(comparisons)

        assert any(p.pattern_type == "weekend_warrior" for p in patterns)


class TestWorkoutComparer:
    """Test main workout comparer facade."""

    @pytest.fixture
    def comparer(self, tmp_path):
        """Create comparer with test data."""
        # Create test files
        plan_path = tmp_path / "test_plan.json"
        csv_path = tmp_path / "test_activities.csv"

        # Write test data (simplified)
        plan_path.write_text('{"total_weeks": 2, "weekly_plan": [...]}')
        csv_path.write_text('Activity Date,Activity Name,Duration,...\n...')

        return WorkoutComparer(
            plan_path=plan_path,
            activities_path=csv_path,
            ftp=265,
        )

    def test_compare_daily_workout(self, comparer):
        """Test daily workout comparison end-to-end."""
        result = comparer.compare_daily_workout("2024-11-01")

        assert result is not None
        assert isinstance(result, WorkoutComparison)
        assert result.date.date() == datetime(2024, 11, 1).date()
        assert result.planned is not None
        assert result.metrics is not None

    def test_compare_weekly_workouts(self, comparer):
        """Test weekly workout comparison end-to-end."""
        result = comparer.compare_weekly_workouts("2024-11-04")  # Monday

        assert result is not None
        assert isinstance(result, WeeklyComparison)
        assert result.week_start_date.date() == datetime(2024, 11, 4).date()
        assert len(result.daily_comparisons) > 0
```

### 7.4 Integration Tests

```python
# tests/tools/wrappers/test_workout_comparison_tool.py

import pytest
import json
from pathlib import Path

from cycling_ai.tools.wrappers.workout_comparison_tool import (
    CompareWorkoutTool,
    CompareWeeklyWorkoutsTool,
)


@pytest.mark.integration
class TestCompareWorkoutTool:
    """Integration tests for workout comparison tool."""

    def test_execute_with_valid_data(self, sample_plan, sample_activities, sample_profile):
        """Test tool execution with valid sample data."""
        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-01",
            training_plan_path=str(sample_plan),
            activities_csv_path=str(sample_activities),
            athlete_profile_path=str(sample_profile),
        )

        assert result.success
        assert result.format == "json"

        data = json.loads(result.output)
        assert "compliance" in data
        assert "planned" in data
        assert "actual" in data
        assert data["compliance"]["compliance_score"] >= 0
        assert data["compliance"]["compliance_score"] <= 100

    def test_execute_with_skipped_workout(self, sample_plan, empty_activities, sample_profile):
        """Test tool with skipped workout."""
        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-01",
            training_plan_path=str(sample_plan),
            activities_csv_path=str(empty_activities),
            athlete_profile_path=str(sample_profile),
        )

        assert result.success
        data = json.loads(result.output)
        assert data["compliance"]["completed"] is False
        assert data["compliance"]["compliance_score"] == 0.0
        assert "Workout skipped" in " ".join(data["deviations"])

    def test_execute_with_missing_plan(self, sample_activities, sample_profile):
        """Test tool with missing training plan."""
        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-01",
            training_plan_path="/nonexistent/plan.json",
            activities_csv_path=str(sample_activities),
            athlete_profile_path=str(sample_profile),
        )

        assert not result.success
        assert "not found" in result.error.lower()
```

### 7.5 E2E Agent Tests

```python
# tests/orchestration/test_workout_comparison_agent.py

import pytest
from cycling_ai.orchestration.agent import LLMAgent
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool


@pytest.mark.integration
@pytest.mark.slow
class TestWorkoutComparisonAgent:
    """End-to-end tests with real LLM."""

    def test_daily_comparison_agent(
        self,
        anthropic_provider,
        sample_plan,
        sample_activities,
        sample_profile,
    ):
        """Test agent with real LLM for daily comparison."""
        # Setup
        prompts_manager = AgentPromptsManager()
        system_prompt = prompts_manager.get_workout_comparison_prompt()

        session = ConversationSession(
            provider_name="anthropic",
            system_prompt=system_prompt,
        )

        agent = LLMAgent(provider=anthropic_provider, session=session)
        agent.register_tools([CompareWorkoutTool()])

        # Execute
        user_message = prompts_manager.get_workout_comparison_user_prompt_daily(
            date="2024-11-01",
            training_plan_path=str(sample_plan),
            activities_csv_path=str(sample_activities),
            athlete_profile_path=str(sample_profile),
        )

        response = agent.process_message(user_message)

        # Verify
        assert "compliance" in response.lower()
        assert any(msg.role == "tool" for msg in session.messages)

        # Verify tool was called correctly
        tool_messages = [m for m in session.messages if m.role == "tool"]
        assert len(tool_messages) > 0
        assert tool_messages[0].tool_results[0]["tool_name"] == "compare_workout"

    def test_weekly_comparison_agent(
        self,
        anthropic_provider,
        sample_plan,
        sample_activities,
        sample_profile,
    ):
        """Test agent with real LLM for weekly comparison."""
        # Similar to daily test but uses compare_weekly_workouts tool
        pass
```

---

## 8. Implementation Roadmap

### Phase 1: Core Foundation (Days 1-2)

**Objective:** Implement and test core business logic with high confidence.

**Tasks:**

1. **Data Models** (2 hours)
   - Create `src/cycling_ai/core/workout_comparison.py`
   - Define all dataclasses: `PlannedWorkout`, `ActualWorkout`, `ComplianceMetrics`, `WorkoutComparison`, `WeeklyPattern`, `WeeklyComparison`
   - Add type hints and docstrings
   - Run `mypy --strict` validation

2. **Compliance Scorer** (4 hours)
   - Implement `ComplianceScorer` class
   - Implement `calculate_compliance_score()`
   - Implement `calculate_zone_match_score()`
   - Implement component scoring methods
   - Write unit tests (target: 95%+ coverage)

3. **Workout Matcher** (3 hours)
   - Implement `WorkoutMatcher` class
   - Implement exact date matching
   - Implement fuzzy matching (±1 day)
   - Implement similarity scoring
   - Write unit tests

4. **Deviation Detector** (2 hours)
   - Implement `DeviationDetector` class
   - Implement deviation detection methods
   - Write unit tests

5. **Recommendation Engine** (2 hours)
   - Implement `RecommendationEngine` class
   - Create recommendation templates
   - Write unit tests

6. **Pattern Detector** (4 hours)
   - Implement `PatternDetector` class
   - Implement all pattern detection methods
   - Write unit tests

7. **Main Facade** (3 hours)
   - Implement `WorkoutComparer` class
   - Implement `compare_daily_workout()`
   - Implement `compare_weekly_workouts()`
   - Implement data loading methods
   - Write integration tests

**Deliverables:**
- `src/cycling_ai/core/workout_comparison.py` (fully implemented)
- `tests/core/test_workout_comparison.py` (comprehensive unit tests)
- All tests passing
- `mypy --strict` compliant
- 90%+ test coverage on core module

**Success Criteria:**
- All unit tests pass
- Type checking passes
- Code coverage ≥ 90%
- All algorithms validated with edge cases

---

### Phase 2: Tool Wrappers (Day 3)

**Objective:** Create MCP-style tools with auto-discovery.

**Tasks:**

1. **Tool Definition** (2 hours)
   - Create `src/cycling_ai/tools/wrappers/workout_comparison_tool.py`
   - Implement `CompareWorkoutTool` class
   - Implement `CompareWeeklyWorkoutsTool` class
   - Add `@register_tool` decorators
   - Add comprehensive docstrings

2. **Tool Integration** (2 hours)
   - Implement `execute()` methods
   - Add error handling
   - Add JSON serialization
   - Test auto-discovery via `ToolRegistry`

3. **Integration Tests** (3 hours)
   - Create `tests/tools/wrappers/test_workout_comparison_tool.py`
   - Test with sample data
   - Test error cases (missing files, invalid data)
   - Test JSON output format
   - Verify tool registration

4. **Test Fixtures** (2 hours)
   - Create `tests/fixtures/sample_training_plan.json`
   - Create `tests/fixtures/sample_activities_perfect.csv`
   - Create `tests/fixtures/sample_activities_partial.csv`
   - Create `tests/fixtures/sample_athlete_profile.json`

**Deliverables:**
- `src/cycling_ai/tools/wrappers/workout_comparison_tool.py`
- `tests/tools/wrappers/test_workout_comparison_tool.py`
- Test fixtures in `tests/fixtures/`
- All integration tests passing

**Success Criteria:**
- Tools auto-discovered by registry
- JSON output validated
- Error handling robust
- Integration tests pass

---

### Phase 3: Prompts & Agent (Day 4)

**Objective:** Create specialized agent with effective prompts.

**Tasks:**

1. **Prompt Files** (3 hours)
   - Create `prompts/default/1.0/workout_comparison_agent.txt`
   - Create `prompts/default/1.0/workout_comparison_user_daily.txt`
   - Create `prompts/default/1.0/workout_comparison_user_weekly.txt`
   - Iterate on prompt clarity and specificity

2. **Prompt Loader Integration** (2 hours)
   - Add methods to `src/cycling_ai/orchestration/prompt_loader.py`
   - Add methods to `src/cycling_ai/orchestration/prompts.py`
   - Test prompt loading

3. **Agent Testing** (4 hours)
   - Create `tests/orchestration/test_workout_comparison_agent.py`
   - Test with mock LLM (unit tests)
   - Test with real LLM (integration tests, marked as `@pytest.mark.integration`)
   - Validate tool calling works
   - Validate response quality

4. **Prompt Iteration** (2 hours)
   - Run manual tests with Anthropic Claude
   - Refine prompts based on output quality
   - Ensure consistent scoring interpretation
   - Verify actionable recommendations

**Deliverables:**
- Prompt files in `prompts/default/1.0/`
- Updated `prompt_loader.py` and `prompts.py`
- `tests/orchestration/test_workout_comparison_agent.py`
- High-quality agent responses

**Success Criteria:**
- Agent produces accurate insights
- Tool calling reliable
- Output clear and actionable
- Prompts load correctly

---

### Phase 4: CLI Commands (Day 5)

**Objective:** Create user-facing CLI with great UX.

**Tasks:**

1. **Command Implementation** (4 hours)
   - Create `src/cycling_ai/cli/commands/compare.py`
   - Implement `compare daily` command
   - Implement `compare weekly` command
   - Add all options (provider, model, verbose)
   - Add output formatting (tables, colors, emojis)

2. **CLI Registration** (1 hour)
   - Update `src/cycling_ai/cli/main.py`
   - Register `compare` command group
   - Test command discovery

3. **Output Formatting** (3 hours)
   - Format compliance scores with color coding
   - Add visual indicators (✓, ⚠, ✗)
   - Create clear section headers
   - Format recommendations readably

4. **CLI Tests** (3 hours)
   - Create `tests/cli/test_compare_commands.py`
   - Test command execution
   - Test option parsing
   - Test error handling
   - Test output formatting

5. **Documentation** (2 hours)
   - Update `CLAUDE.md` with compare commands
   - Add examples to docstrings
   - Create usage examples

**Deliverables:**
- `src/cycling_ai/cli/commands/compare.py`
- Updated `src/cycling_ai/cli/main.py`
- `tests/cli/test_compare_commands.py`
- Updated documentation

**Success Criteria:**
- Commands work end-to-end
- Output is clear and visually appealing
- Error messages helpful
- Documentation complete

---

### Phase 5: Integration & Polish (Day 6)

**Objective:** Final integration, testing, and documentation.

**Tasks:**

1. **End-to-End Testing** (3 hours)
   - Run full workflow with real data
   - Test all CLI commands
   - Test with different providers (Anthropic, OpenAI, Gemini)
   - Fix any issues found

2. **Performance Optimization** (2 hours)
   - Profile execution time
   - Optimize data loading (use Parquet cache)
   - Minimize LLM token usage
   - Target: < 5s for weekly comparison

3. **Documentation** (4 hours)
   - Create `docs/USER_GUIDE_WORKOUT_COMPARISON.md`
   - Update `CLAUDE.md` comprehensively
   - Add API documentation
   - Add troubleshooting section

4. **Code Review** (2 hours)
   - Review all code for consistency
   - Run `ruff check` and fix issues
   - Run `ruff format`
   - Run `mypy --strict`
   - Ensure all tests pass

5. **User Testing** (2 hours)
   - Test with real training plans
   - Validate insights accuracy
   - Refine recommendations
   - Gather feedback

**Deliverables:**
- `docs/USER_GUIDE_WORKOUT_COMPARISON.md`
- Updated `CLAUDE.md`
- All code polished and formatted
- All tests passing (253 → 300+ tests)

**Success Criteria:**
- Full workflow tested
- Performance targets met
- Documentation complete
- Code quality high

---

## 9. Performance Considerations

### 9.1 Execution Time Estimates

| Operation | Data Loading | Business Logic | LLM Processing | Total |
|-----------|--------------|----------------|----------------|-------|
| Daily Comparison | 0.5s | 0.1s | 2-3s | ~3s |
| Weekly Comparison | 1s | 0.3s | 3-4s | ~5s |

### 9.2 Token Usage Estimates (Claude Sonnet)

| Operation | Prompt | Tool Call | Response | Total | Cost |
|-----------|--------|-----------|----------|-------|------|
| Daily | ~800 | ~200 | ~300 | ~1,300 | ~$0.01 |
| Weekly | ~1,000 | ~500 | ~800 | ~2,300 | ~$0.02 |

### 9.3 Optimization Strategies

1. **Data Loading:**
   - Use Parquet cache (10x faster than CSV)
   - Cache athlete profile and training plan in memory
   - Lazy-load zone calculations

2. **LLM Efficiency:**
   - Concise prompts with clear structure
   - Minimal context in user messages
   - Efficient JSON serialization

3. **Caching:**
   - Cache compliance scores for repeated comparisons
   - Cache zone distributions calculated from FIT files

---

## 10. Future Enhancements (Post-MVP)

### 10.1 Phase 6: Multi-Agent Integration (Optional)

**If** standalone version proves valuable, integrate into `MultiAgentOrchestrator`:

**Implementation:**
- Add `_execute_phase_workout_comparison()` to `multi_agent.py`
- Make optional via `--include-compliance` flag
- Update HTML templates with compliance section
- Run after Phase 3 (Training Planning)

**Benefits:**
- Automated compliance tracking in reports
- Holistic view: planning + execution
- No manual invocation needed

**Challenges:**
- Requires existing training plan in multi-agent workflow
- Increases workflow execution time
- Only useful for ongoing plan tracking

### 10.2 Phase 7: Advanced Features

**Interval-by-Interval Comparison:**
- Compare each planned interval against actual power data
- Visualize interval compliance with charts
- Identify specific intervals that were cut short

**Historical Compliance Trends:**
- Monthly/yearly compliance tracking
- Identify long-term patterns
- Predict future adherence

**Predictive Insights:**
- ML model to predict workout completion likelihood
- Recommend optimal workout timing
- Suggest plan modifications based on historical adherence

**Integration:**
- Calendar sync (Google Calendar, Apple Calendar)
- Email/SMS reminders for planned workouts
- Mobile app for compliance tracking

---

## 11. Risk Analysis & Mitigation

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Training plan format mismatch | Medium | High | Comprehensive validation, clear format specification |
| Missing zone data in activities | High | Medium | Fall back to basic metrics (duration, TSS) when zones unavailable |
| Workout matching ambiguity | Medium | Medium | Fuzzy matching with similarity scoring, manual review option |
| LLM hallucination in insights | Low | Medium | Insights derived from business logic, LLM only formats |
| Performance degradation | Low | Low | Optimize data loading, use Parquet cache |

### 11.2 Data Quality Risks

| Risk | Mitigation |
|------|------------|
| Incomplete training plans | Validation in Phase 2, clear error messages |
| Missing power data | Handle gracefully, focus on duration/completion |
| Multiple activities per day | Smart matching with combination logic |
| Timezone mismatches | Normalize all dates to UTC or local timezone |

### 11.3 User Experience Risks

| Risk | Mitigation |
|------|------------|
| Complex CLI usage | Clear examples, helpful error messages, `--help` text |
| Overwhelming output | Tiered output (summary → details), `--verbose` flag |
| Misinterpreted scores | Clear scoring framework in prompts and docs |
| Demotivating feedback | Supportive tone in recommendations, context-aware |

---

## 12. Success Metrics

### 12.1 Technical Metrics

- ✅ **Type Safety:** 100% `mypy --strict` compliance
- ✅ **Test Coverage:** 90%+ on core logic, 80%+ overall
- ✅ **Performance:** < 5s for weekly comparison
- ✅ **Code Quality:** Zero `ruff` errors

### 12.2 Functional Metrics

- ✅ **Accuracy:** Compliance scores within ±5% of manual calculation
- ✅ **Tool Reliability:** Tool calls succeed 95%+ of time
- ✅ **Pattern Detection:** Identify patterns with 90%+ precision
- ✅ **Recommendation Quality:** Actionable recommendations in 95%+ of cases

### 12.3 User Experience Metrics

- ✅ **Usability:** New users can run command within 2 minutes
- ✅ **Clarity:** Output understandable without technical knowledge
- ✅ **Helpfulness:** Recommendations lead to plan adjustments or improved adherence
- ✅ **Documentation:** Users can find answers in docs without support

---

## 13. Acceptance Criteria Checklist

Before marking this feature **COMPLETE**, verify:

### Code Quality ✅
- [ ] All tests passing (unit, integration, e2e)
- [ ] `mypy --strict` passes with zero errors
- [ ] Code coverage ≥ 90% on core, ≥ 80% overall
- [ ] `ruff check` passes with zero errors
- [ ] `ruff format` applied to all files

### Functionality ✅
- [ ] Daily comparison works with perfect compliance
- [ ] Daily comparison works with partial compliance
- [ ] Daily comparison works with skipped workout
- [ ] Weekly comparison aggregates correctly
- [ ] Weekly comparison identifies all pattern types
- [ ] Compliance scores accurate (validated manually)
- [ ] Deviations clear and specific
- [ ] Recommendations actionable

### User Experience ✅
- [ ] CLI commands work end-to-end
- [ ] Output formatted and readable
- [ ] Error messages helpful
- [ ] `--verbose` flag provides debugging info
- [ ] Examples in documentation work
- [ ] Help text (`--help`) comprehensive

### Documentation ✅
- [ ] `docs/USER_GUIDE_WORKOUT_COMPARISON.md` created
- [ ] `CLAUDE.md` updated (architecture, commands, examples)
- [ ] API documentation complete (all public methods)
- [ ] Example data provided in `tests/fixtures/`
- [ ] Troubleshooting section added

### Integration (if Phase 5) ✅
- [ ] Multi-agent workflow integration works
- [ ] HTML reports include compliance section
- [ ] Optional `--include-compliance` flag works
- [ ] No performance regression

---

## 14. Appendix

### 14.1 Training Plan JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["total_weeks", "target_ftp", "weekly_plan"],
  "properties": {
    "total_weeks": {
      "type": "integer",
      "minimum": 4,
      "maximum": 24
    },
    "target_ftp": {
      "type": "number",
      "minimum": 100
    },
    "weekly_plan": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["week_number", "workouts"],
        "properties": {
          "week_number": {"type": "integer"},
          "phase": {"type": "string"},
          "workouts": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["weekday", "segments"],
              "properties": {
                "weekday": {
                  "type": "string",
                  "enum": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                },
                "segments": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["type", "duration_min", "power_low_pct"],
                    "properties": {
                      "type": {"type": "string"},
                      "duration_min": {"type": "number"},
                      "power_low_pct": {"type": "number"},
                      "power_high_pct": {"type": "number"},
                      "description": {"type": "string"}
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 14.2 Compliance Score Interpretation Guide

| Score Range | Interpretation | Color | Emoji |
|-------------|----------------|-------|-------|
| 90-100 | Excellent - Executed as planned | Green | ✅ |
| 70-89 | Good - Minor deviations acceptable | Yellow | ⚠️ |
| 50-69 | Moderate - Significant modifications | Orange | ⚠️ |
| 0-49 | Poor - Substantially different or incomplete | Red | ❌ |

### 14.3 Pattern Severity Levels

| Severity | Description | Action Required |
|----------|-------------|-----------------|
| **Low** | Minor pattern, monitor | Awareness only |
| **Medium** | Recurring pattern, consider plan adjustment | Review with coach |
| **High** | Chronic issue, plan adjustment needed | Immediate action |

### 14.4 Glossary

- **Compliance Score:** Weighted 0-100 score measuring workout adherence
- **TSS (Training Stress Score):** Metric quantifying workout difficulty
- **Zone Distribution:** Minutes spent in each power/HR zone
- **Fuzzy Matching:** Matching workouts with ±1 day tolerance
- **Pattern:** Recurring behavior across multiple workouts
- **Deviation:** Specific difference between planned and actual

---

**End of Architecture Plan**

**Next Steps:**
1. Review plan with stakeholders
2. Clarify any open questions (see Section 186 in original plan)
3. Create feature branch: `git checkout -b feature/workout-comparison-agent`
4. Begin Phase 1 implementation

**Estimated Total Effort:** 6 days (48 hours)
**Target Completion:** 1 week from start

---

*This architecture plan provides a comprehensive blueprint for implementing the Workout Comparison Agent feature. All design decisions are aligned with existing codebase patterns, ensuring seamless integration and maintainability.*
