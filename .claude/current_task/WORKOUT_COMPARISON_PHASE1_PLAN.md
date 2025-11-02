# Workout Comparison Agent - Phase 1 Implementation Plan

**Created:** 2025-11-01
**Phase:** Core Foundation (Days 1-2)
**Goal:** Implement business logic with 90%+ test coverage using TDD approach
**Estimated Time:** 20 hours

---

## Executive Summary

Phase 1 implements the pure Python business logic for workout comparison analysis. This includes all data models, algorithms for compliance scoring, pattern detection, workout matching, and deviation analysis. Following strict TDD (Test-Driven Development), we'll write tests first, then implement to pass tests.

**Key Success Metrics:**
- 90%+ test coverage on core module
- 100% `mypy --strict` compliance
- All algorithms validated with edge cases
- Zero business logic in tools or orchestration layers

---

## Architecture Context

### Existing Patterns to Follow

From examining the codebase:

1. **Data Models**: Defined using `@dataclass` in business logic modules (e.g., `core/athlete.py`)
2. **Type Safety**: Full type hints on all functions, `mypy --strict` compliance
3. **Pure Functions**: Business logic separated from I/O operations
4. **Test Structure**: Class-based tests with clear test names (e.g., `test_segment_tss_at_ftp`)
5. **Dependencies**: Reuse existing utilities (`core/tss.py`, `core/athlete.py`, `core/power_zones.py`)

### Integration Points

**Data Sources:**
- Training plan JSON (from `core/training.py` - `finalize_training_plan` output)
- Activities CSV/Parquet (existing data preparation infrastructure)
- Athlete profile JSON (from `core/athlete.py` - `AthleteProfile`)

**Dependencies:**
- `core/tss.py` - TSS calculation functions
- `core/power_zones.py` - Zone calculations
- `core/athlete.py` - Athlete profile loading
- Parquet cache infrastructure (for performance)

---

## File Structure

```
src/cycling_ai/core/
└── workout_comparison.py          # New module (all business logic)

tests/core/
├── test_workout_comparison.py     # New comprehensive test suite
└── fixtures/
    ├── sample_training_plan.json  # Test training plan (2 weeks)
    ├── sample_activities_perfect_compliance.csv
    ├── sample_activities_partial_compliance.csv
    ├── sample_activities_skipped_workouts.csv
    └── sample_athlete_profile.json
```

---

## Implementation Strategy: Test-Driven Development

### TDD Cycle

For each component:
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass test
3. **REFACTOR**: Improve code quality while keeping tests green
4. **REPEAT**: Next test case

### Test Coverage Target

**Minimum 90% coverage across:**
- Data model creation and validation
- Compliance scoring algorithms
- Zone matching calculations
- Pattern detection logic
- Workout matching algorithms
- Deviation detection
- Recommendation generation

---

## Data Models Implementation

### Model 1: PlannedWorkout

```python
@dataclass
class PlannedWorkout:
    """
    Planned workout extracted from training plan JSON.

    Maps to existing training plan structure from core/training.py.
    """
    date: datetime
    weekday: str  # "Monday", "Tuesday", etc.
    workout_type: str  # "endurance", "threshold", "vo2max", "recovery", "tempo"
    total_duration_minutes: float
    planned_tss: float
    segments: list[dict[str, Any]]  # Raw segment data
    description: str  # Workout description

    # Derived fields for comparison
    zone_distribution: dict[str, float] = field(default_factory=dict)  # zone -> minutes
    target_avg_power_pct: float | None = None

    def __post_init__(self) -> None:
        """Calculate derived fields after initialization."""
        if not self.zone_distribution:
            self.zone_distribution = self._calculate_zone_distribution()
        if self.target_avg_power_pct is None:
            self.target_avg_power_pct = self._calculate_avg_power_pct()

    def _calculate_zone_distribution(self) -> dict[str, float]:
        """Calculate time in each zone from segments."""
        # Implementation to map power percentages to zones
        pass

    def _calculate_avg_power_pct(self) -> float:
        """Calculate weighted average target power across segments."""
        pass
```

**Test Cases:**
- ✓ Create PlannedWorkout with all fields
- ✓ Auto-calculate zone distribution from segments
- ✓ Auto-calculate average power percentage
- ✓ Handle empty segments list
- ✓ Validate weekday is valid day name
- ✓ Validate workout_type is valid type

### Model 2: ActualWorkout

```python
@dataclass
class ActualWorkout:
    """
    Actual workout from activities CSV/Parquet.

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
    zone_distribution: dict[str, float] = field(default_factory=dict)
```

**Test Cases:**
- ✓ Create ActualWorkout with required fields only
- ✓ Create ActualWorkout with all optional fields
- ✓ Handle missing power data
- ✓ Handle missing zone distribution

### Model 3: ComplianceMetrics

```python
@dataclass
class ComplianceMetrics:
    """
    Detailed compliance metrics for a single workout comparison.

    Scoring Framework:
    - Completion: 40% weight (100 if completed, 0 if skipped)
    - Duration: 25% weight (actual/planned ratio, capped at 100)
    - Intensity: 25% weight (zone distribution match, 0-100)
    - TSS: 10% weight (actual/planned TSS ratio, capped at 100)
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
```

**Test Cases:**
- ✓ Create metrics for completed workout
- ✓ Create metrics for skipped workout
- ✓ Validate scores are 0-100
- ✓ Validate compliance_score is weighted average
- ✓ Handle missing TSS data

### Model 4: WorkoutComparison

```python
@dataclass
class WorkoutComparison:
    """Result of comparing one planned workout against actual execution."""
    date: datetime
    planned: PlannedWorkout
    actual: ActualWorkout | None  # None if skipped

    # Metrics
    metrics: ComplianceMetrics

    # Insights (generated by business logic)
    deviations: list[str] = field(default_factory=list)
    recommendation: str = ""
```

**Test Cases:**
- ✓ Create comparison for completed workout
- ✓ Create comparison for skipped workout
- ✓ Validate deviations list is populated
- ✓ Validate recommendation is generated

### Model 5: WeeklyPattern

```python
@dataclass
class WeeklyPattern:
    """Identified pattern in weekly workout compliance."""
    pattern_type: str  # "skipped_hard_workouts", "short_duration", etc.
    description: str
    severity: str  # "low", "medium", "high"
    affected_workouts: list[datetime] = field(default_factory=list)
```

**Test Cases:**
- ✓ Create pattern with all fields
- ✓ Validate severity is valid value
- ✓ Validate pattern_type is known type

### Model 6: WeeklyComparison

```python
@dataclass
class WeeklyComparison:
    """Aggregated comparison for an entire week."""
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
```

**Test Cases:**
- ✓ Create weekly comparison from daily comparisons
- ✓ Validate aggregated metrics calculated correctly
- ✓ Validate week_start_date is Monday
- ✓ Validate week_end_date is Sunday

---

## Core Classes Implementation

### Class 1: ComplianceScorer

**Responsibility:** Calculate compliance scores using weighted factors

**Methods:**
1. `calculate_compliance_score(planned, actual, ftp) -> ComplianceMetrics`
2. `score_completion(actual) -> float`
3. `score_duration(planned, actual) -> tuple[float, float]`
4. `score_intensity(planned, actual) -> float`
5. `score_tss(planned, actual) -> tuple[float, float | None]`
6. `calculate_zone_match_score(planned_zones, actual_zones) -> float`

**Algorithm: Compliance Scoring**

```python
def calculate_compliance_score(
    self,
    planned: PlannedWorkout,
    actual: ActualWorkout | None,
    ftp: int,
) -> ComplianceMetrics:
    """
    Calculate multi-factor compliance score.

    Weights:
    - Completion: 40%
    - Duration: 25%
    - Intensity: 25%
    - TSS: 10%
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

    # 1. Completion (40%)
    completion_score = 100.0

    # 2. Duration (25%)
    duration_score, duration_pct = self.score_duration(planned, actual)

    # 3. Intensity (25%)
    intensity_score = self.score_intensity(planned, actual)

    # 4. TSS (10%)
    tss_score, tss_pct = self.score_tss(planned, actual)

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
        compliance_score=round(compliance_score, 1),
        duration_compliance_pct=round(duration_pct, 1),
        tss_compliance_pct=round(tss_pct, 1) if tss_pct else None,
    )
```

**Test Cases:**
- ✓ Perfect compliance (100 score)
- ✓ Skipped workout (0 score)
- ✓ Short duration (-20% time)
- ✓ Wrong intensity (Z3 instead of Z4)
- ✓ Missing TSS data (defaults to 100)
- ✓ Long duration (+10% time, capped at 100)
- ✓ Multiple deviations (combined effect)
- ✓ Edge case: 0 duration
- ✓ Edge case: 0 TSS

**Algorithm: Zone Match Scoring**

```python
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
    3. Convert to 0-100 score (lower deviation = higher score)

    Score = max(0, 100 - deviation_pct)
    """
    if not planned_zones:
        return 100.0  # No planned zones = perfect match

    total_deviation = 0.0
    total_planned_time = sum(planned_zones.values())

    # Get all zones (union of planned and actual)
    all_zones = set(planned_zones.keys()) | set(actual_zones.keys())

    for zone in all_zones:
        planned_min = planned_zones.get(zone, 0.0)
        actual_min = actual_zones.get(zone, 0.0)
        deviation = abs(planned_min - actual_min)
        total_deviation += deviation

    if total_planned_time == 0:
        return 100.0

    deviation_pct = (total_deviation / total_planned_time) * 100
    score = max(0.0, 100.0 - deviation_pct)

    return round(score, 1)
```

**Test Cases:**
- ✓ Perfect match (100 score)
- ✓ Complete mismatch (0 score)
- ✓ Partial match (Z2 correct, Z4 wrong)
- ✓ Extra zones in actual (Z1, Z2, Z3 vs Z2)
- ✓ Missing zones in actual (Z2 only vs Z2, Z4)
- ✓ Empty planned zones (100 score)
- ✓ Empty actual zones (0 score)

### Class 2: WorkoutMatcher

**Responsibility:** Match planned workouts to actual activities

**Methods:**
1. `match_workouts(planned_list, actual_list, fuzzy_days=1) -> list[tuple[PlannedWorkout, ActualWorkout | None]]`
2. `match_by_date(planned, actuals) -> ActualWorkout | None`
3. `fuzzy_match(planned, actuals, days=1) -> ActualWorkout | None`
4. `calculate_similarity(planned, actual) -> float`

**Algorithm: Workout Matching**

```python
def match_workouts(
    self,
    planned_workouts: list[PlannedWorkout],
    actual_activities: list[ActualWorkout],
    fuzzy_match_days: int = 1,
) -> list[tuple[PlannedWorkout, ActualWorkout | None]]:
    """
    Match planned workouts to actual activities.

    Strategy:
    1. Exact date match (preferred)
    2. Fuzzy match within ±N days with similarity scoring
    3. Handle multiple activities per day (select best match)
    """
    matched_pairs = []
    used_actuals: set[ActualWorkout] = set()

    for planned in planned_workouts:
        # Try exact date match first
        exact_match = self.match_by_date(planned, actual_activities, used_actuals)

        if exact_match:
            matched_pairs.append((planned, exact_match))
            used_actuals.add(exact_match)
            continue

        # Try fuzzy match
        fuzzy_match = self.fuzzy_match(
            planned, actual_activities, used_actuals, fuzzy_match_days
        )

        if fuzzy_match:
            matched_pairs.append((planned, fuzzy_match))
            used_actuals.add(fuzzy_match)
        else:
            # No match - workout was skipped
            matched_pairs.append((planned, None))

    return matched_pairs
```

**Test Cases:**
- ✓ Exact date match
- ✓ Fuzzy match +1 day
- ✓ Fuzzy match -1 day
- ✓ Multiple activities same day (select longest)
- ✓ No match (skipped workout)
- ✓ Already used activity (skip to next)
- ✓ Similarity threshold not met (skip)
- ✓ Empty actual activities (all skipped)

### Class 3: DeviationDetector

**Responsibility:** Identify specific deviations from planned workout

**Methods:**
1. `detect_deviations(planned, actual) -> list[str]`
2. `detect_duration_deviation(planned, actual) -> str | None`
3. `detect_intensity_deviation(planned, actual) -> str | None`
4. `detect_type_mismatch(planned, actual) -> str | None`

**Algorithm: Deviation Detection**

```python
def detect_deviations(
    self,
    planned: PlannedWorkout,
    actual: ActualWorkout | None,
) -> list[str]:
    """
    Identify specific deviations from planned workout.

    Returns human-readable deviation descriptions.
    """
    if actual is None:
        return ["Workout skipped entirely"]

    deviations = []

    # Duration deviation
    duration_dev = self.detect_duration_deviation(planned, actual)
    if duration_dev:
        deviations.append(duration_dev)

    # Intensity deviation
    intensity_dev = self.detect_intensity_deviation(planned, actual)
    if intensity_dev:
        deviations.append(intensity_dev)

    # Type mismatch
    type_dev = self.detect_type_mismatch(planned, actual)
    if type_dev:
        deviations.append(type_dev)

    return deviations if deviations else ["No significant deviations"]
```

**Test Cases:**
- ✓ Skipped workout
- ✓ Duration too short (-20%)
- ✓ Duration too long (+15%)
- ✓ Wrong intensity (Z3 instead of Z4)
- ✓ Type mismatch (virtual ride vs outdoor)
- ✓ Multiple deviations
- ✓ No deviations (perfect execution)

### Class 4: RecommendationEngine

**Responsibility:** Generate actionable coaching recommendations

**Methods:**
1. `generate_recommendation(comparison) -> str`
2. `_get_template(deviation_types, compliance_score) -> str`

**Algorithm: Recommendation Generation**

```python
def generate_recommendation(
    self,
    comparison: WorkoutComparison,
) -> str:
    """
    Generate actionable coaching recommendation based on comparison.

    Templates selected based on:
    - Completion status
    - Compliance score range
    - Specific deviations
    """
    if not comparison.metrics.completed:
        return self._recommendation_skipped_workout(comparison)

    score = comparison.metrics.compliance_score

    if score >= 90:
        return self._recommendation_excellent(comparison)
    elif score >= 70:
        return self._recommendation_good(comparison)
    elif score >= 50:
        return self._recommendation_moderate(comparison)
    else:
        return self._recommendation_poor(comparison)
```

**Test Cases:**
- ✓ Skipped workout recommendation
- ✓ Excellent compliance (90-100)
- ✓ Good compliance (70-89)
- ✓ Moderate compliance (50-69)
- ✓ Poor compliance (<50)
- ✓ Specific deviation recommendations (short duration, wrong intensity)

### Class 5: PatternDetector

**Responsibility:** Identify weekly patterns in compliance

**Methods:**
1. `identify_weekly_patterns(daily_comparisons, min_occurrences=2) -> list[WeeklyPattern]`
2. `detect_skipped_hard_workouts(comparisons) -> WeeklyPattern | None`
3. `detect_short_duration_pattern(comparisons) -> WeeklyPattern | None`
4. `detect_weekend_warrior(comparisons) -> WeeklyPattern | None`
5. `detect_scheduling_conflicts(comparisons) -> WeeklyPattern | None`
6. `detect_intensity_avoidance(comparisons) -> WeeklyPattern | None`

**Algorithm: Pattern Detection**

See architecture document section 3.2.3 for detailed algorithm.

**Test Cases:**
- ✓ Skipped hard workouts pattern (2+ threshold/VO2 skipped)
- ✓ Short duration pattern (avg <80% duration)
- ✓ Weekend warrior (weekend compliance > weekday + 20)
- ✓ Scheduling conflict (specific day always skipped)
- ✓ Intensity avoidance (always lower zones)
- ✓ No patterns detected
- ✓ Multiple patterns detected
- ✓ Edge case: 1 workout (below min_occurrences)

### Class 6: WorkoutComparer (Main Facade)

**Responsibility:** Coordinate all components, provide main API

**Methods:**
1. `__init__(plan_path, activities_path, ftp)`
2. `compare_daily_workout(date_str) -> WorkoutComparison`
3. `compare_weekly_workouts(week_start_str) -> WeeklyComparison`
4. `load_planned_workout(date) -> PlannedWorkout`
5. `load_actual_workout(date) -> ActualWorkout | None`

**Implementation:**

```python
class WorkoutComparer:
    """
    Main facade for workout comparison functionality.

    Coordinates all sub-components and provides high-level API.
    """

    def __init__(
        self,
        plan_path: Path,
        activities_path: Path,
        ftp: int,
    ):
        self.plan_path = plan_path
        self.activities_path = activities_path
        self.ftp = ftp

        # Initialize sub-components
        self.scorer = ComplianceScorer()
        self.matcher = WorkoutMatcher()
        self.deviation_detector = DeviationDetector()
        self.recommendation_engine = RecommendationEngine()
        self.pattern_detector = PatternDetector()

        # Load data (lazy-loaded)
        self._plan_data: dict[str, Any] | None = None
        self._activities_data: pd.DataFrame | None = None

    def compare_daily_workout(self, date_str: str) -> WorkoutComparison:
        """
        Compare single day's planned vs actual workout.

        Args:
            date_str: Date in YYYY-MM-DD format

        Returns:
            WorkoutComparison with metrics and insights
        """
        date = datetime.strptime(date_str, "%Y-%m-%d")

        # Load planned and actual
        planned = self.load_planned_workout(date)
        actual = self.load_actual_workout(date)

        # Calculate metrics
        metrics = self.scorer.calculate_compliance_score(planned, actual, self.ftp)

        # Detect deviations
        deviations = self.deviation_detector.detect_deviations(planned, actual)

        # Generate recommendation
        comparison = WorkoutComparison(
            date=date,
            planned=planned,
            actual=actual,
            metrics=metrics,
            deviations=deviations,
        )

        recommendation = self.recommendation_engine.generate_recommendation(comparison)
        comparison.recommendation = recommendation

        return comparison
```

**Test Cases:**
- ✓ Compare daily workout (perfect compliance)
- ✓ Compare daily workout (partial compliance)
- ✓ Compare daily workout (skipped)
- ✓ Invalid date format (raises error)
- ✓ Date not in plan (raises error)
- ✓ Empty activities data
- ✓ Compare weekly workouts (all metrics aggregated)
- ✓ Weekly patterns detected
- ✓ Weekly recommendation generated

---

## Test Implementation Order (TDD)

### Day 1: Data Models + Compliance Scoring

**Morning (4 hours):**
1. Test fixtures creation
2. Data model tests + implementation
3. ComplianceScorer tests (basic cases)

**Afternoon (4 hours):**
4. ComplianceScorer implementation
5. Zone matching algorithm tests + implementation
6. Edge case testing

### Day 2: Matching + Patterns + Facade

**Morning (4 hours):**
1. WorkoutMatcher tests + implementation
2. DeviationDetector tests + implementation
3. RecommendationEngine tests + implementation

**Afternoon (4 hours):**
4. PatternDetector tests + implementation
5. WorkoutComparer facade tests + implementation
6. Integration tests
7. Coverage analysis and gap filling

---

## Test Fixtures

### Sample Training Plan (2 weeks)

```json
{
  "plan_metadata": {
    "total_weeks": 2,
    "current_ftp": 265,
    "target_ftp": 280
  },
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
          ],
          "description": "Easy endurance ride"
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
          ],
          "description": "Threshold intervals 3x10min"
        },
        {
          "weekday": "Saturday",
          "segments": [
            {"type": "warmup", "duration_min": 15, "power_low_pct": 50, "power_high_pct": 60},
            {"type": "steady", "duration_min": 120, "power_low_pct": 65, "power_high_pct": 75},
            {"type": "cooldown", "duration_min": 15, "power_low_pct": 45, "power_high_pct": 55}
          ],
          "description": "Long endurance ride"
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
          ],
          "description": "Recovery ride"
        }
      ]
    }
  ]
}
```

### Sample Activities - Perfect Compliance

```csv
Activity Date,Activity Name,Activity Type,Distance,Moving Time,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
2024-11-04,Morning Ride,Ride,50.2,80,185,190,65,10,60,10,0,0
2024-11-06,Threshold Workout,Virtual Ride,35.4,65,220,235,85,10,15,0,30,10
2024-11-09,Long Ride,Ride,95.3,150,175,180,105,15,120,15,0,0
2024-11-11,Easy Recovery,Ride,25.1,45,135,140,25,0,45,0,0,0
```

### Sample Activities - Partial Compliance

```csv
Activity Date,Activity Name,Activity Type,Distance,Moving Time,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
2024-11-04,Morning Ride,Ride,40.5,72,185,190,58,10,54,8,0,0
2024-11-06,Threshold Attempt,Virtual Ride,30.2,55,210,225,72,10,15,5,20,5
2024-11-09,Long Ride Cut Short,Ride,75.4,120,175,180,85,12,96,12,0,0
```

### Sample Activities - Skipped Workouts

```csv
Activity Date,Activity Name,Activity Type,Distance,Moving Time,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
2024-11-04,Morning Ride,Ride,50.2,80,185,190,65,10,60,10,0,0
2024-11-09,Long Ride,Ride,95.3,150,175,180,105,15,120,15,0,0
```
(Note: Wednesday and Monday week 2 missing)

---

## Risk Mitigation

### Risk 1: Zone Calculation Complexity

**Risk:** Mapping power percentages to named zones may be complex

**Mitigation:**
- Use existing `core/power_zones.py` module
- Create helper function `map_power_pct_to_zone(power_pct, ftp)`
- Test extensively with edge cases

### Risk 2: Training Plan Format Variations

**Risk:** Training plans may have slightly different structures

**Mitigation:**
- Validate structure with comprehensive error messages
- Use optional fields with defaults
- Document expected format clearly

### Risk 3: Missing Data in Activities

**Risk:** Activities may be missing power data or zone distribution

**Mitigation:**
- Make power metrics optional
- Fall back to duration-only scoring when power unavailable
- Document limitations in docstrings

### Risk 4: Date Parsing Edge Cases

**Risk:** Timezone issues, date format variations

**Mitigation:**
- Standardize on ISO format (YYYY-MM-DD)
- Use `datetime.strptime` with explicit format
- Test with various date formats

---

## Acceptance Criteria

Before marking Phase 1 complete:

- [ ] All data models implemented with full type hints
- [ ] All core classes implemented (6 classes)
- [ ] Test coverage ≥ 90% on `core/workout_comparison.py`
- [ ] `mypy --strict` passes with zero errors
- [ ] All edge cases tested (skipped workouts, missing data, etc.)
- [ ] Test fixtures created for subsequent phases
- [ ] Integration tests pass (end-to-end via WorkoutComparer)
- [ ] Documentation complete (all public methods have docstrings)
- [ ] Code reviewed for consistency with existing patterns

---

## Success Metrics

**Code Quality:**
- Type safety: 100% (mypy --strict)
- Test coverage: 90%+
- Code style: Zero ruff errors

**Functionality:**
- Compliance scoring accurate within ±1%
- Zone matching validated manually
- Pattern detection precision 90%+
- All algorithms validated with edge cases

**Performance:**
- Daily comparison: <0.1s
- Weekly comparison: <0.3s
- Memory usage: <50MB for typical dataset

---

## Next Steps After Phase 1

Once Phase 1 is complete and all acceptance criteria met:

1. **Phase 2**: Tool wrappers (MCP-style tools)
2. **Phase 3**: Prompts and agent integration
3. **Phase 4**: CLI commands
4. **Phase 5**: Integration and polish

Phase 1 provides the solid foundation - all business logic is pure Python, testable, type-safe, and well-documented.

---

**Phase 1 Start Date:** TBD
**Phase 1 Target Completion:** 2 days from start
**Last Updated:** 2025-11-01
