# CARD 03: Implement ComplianceScorer

**Estimated Time:** 4 hours
**Priority:** Critical
**Dependencies:** CARD_02 (data models)

---

## Objective

Implement the `ComplianceScorer` class with full compliance scoring algorithms, including zone matching. This is the core of the workout comparison logic.

---

## Acceptance Criteria

- [ ] `ComplianceScorer` class implemented
- [ ] All scoring methods implemented and tested
- [ ] Zone matching algorithm implemented
- [ ] Test coverage ≥ 95%
- [ ] All edge cases tested (missing data, zero values, etc.)
- [ ] `mypy --strict` compliance

---

## File Changes

### Modified Files
1. `src/cycling_ai/core/workout_comparison.py` (add ComplianceScorer class)
2. `tests/core/test_workout_comparison.py` (add ComplianceScorer tests)

---

## Implementation Steps (TDD)

### Step 1: Write ComplianceScorer Tests

In `tests/core/test_workout_comparison.py`:

```python
class TestComplianceScorer:
    """Test ComplianceScorer algorithms."""

    @pytest.fixture
    def scorer(self):
        """Create ComplianceScorer instance."""
        return ComplianceScorer()

    def test_perfect_compliance(self, scorer):
        """Test workout executed exactly as planned."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            segments=[],
            description="Endurance",
            zone_distribution={"Z1": 10, "Z2": 75, "Z3": 5},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=90.0,
            actual_tss=65.0,
            zone_distribution={"Z1": 10, "Z2": 75, "Z3": 5},
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert metrics.compliance_score >= 99.0  # Allow minor floating point diff
        assert metrics.completion_score == 100.0
        assert metrics.duration_score >= 99.0
        assert metrics.intensity_score >= 99.0
        assert metrics.tss_score >= 99.0

    def test_skipped_workout(self, scorer):
        """Test skipped workout returns zero scores."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            segments=[],
            description="Threshold",
        )

        metrics = scorer.calculate_compliance_score(planned, None, ftp=265)

        assert metrics.completed is False
        assert metrics.compliance_score == 0.0
        assert metrics.completion_score == 0.0
        assert metrics.duration_score == 0.0
        assert metrics.intensity_score == 0.0
        assert metrics.tss_score == 0.0

    def test_short_duration_deviation(self, scorer):
        """Test workout cut short by 20%."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            segments=[],
            description="Endurance",
            zone_distribution={"Z2": 80, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=72.0,  # 80% of planned
            actual_tss=52.0,
            zone_distribution={"Z2": 64, "Z1": 8},
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert 70 < metrics.compliance_score < 85  # Moderate compliance
        assert metrics.duration_compliance_pct == 80.0
        assert metrics.duration_score == 80.0

    def test_intensity_deviation(self, scorer):
        """Test wrong intensity zones (Z3 instead of Z4)."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 6),
            weekday="Wednesday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            segments=[],
            description="Threshold",
            zone_distribution={"Z2": 35, "Z4": 30, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 6),
            activity_name="Threshold Attempt",
            activity_type="Virtual Ride",
            duration_minutes=75.0,
            actual_tss=68.0,
            zone_distribution={"Z2": 40, "Z3": 30, "Z1": 5},  # Z3 instead of Z4
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert 60 < metrics.compliance_score < 80
        assert metrics.intensity_score < 70  # Poor zone match

    def test_missing_tss_data(self, scorer):
        """Test handling of missing TSS data."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            segments=[],
            description="Endurance",
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=90.0,
            actual_tss=None,  # Missing TSS
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert metrics.tss_score == 100.0  # Default when TSS missing
        assert metrics.tss_compliance_pct is None

    def test_zone_match_perfect(self, scorer):
        """Test perfect zone match returns 100."""
        planned_zones = {"Z1": 10, "Z2": 60, "Z3": 10}
        actual_zones = {"Z1": 10, "Z2": 60, "Z3": 10}

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)
        assert score == 100.0

    def test_zone_match_complete_mismatch(self, scorer):
        """Test complete zone mismatch."""
        planned_zones = {"Z2": 60}
        actual_zones = {"Z4": 60}  # All time in wrong zone

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)

        # Total deviation = |60-0| + |0-60| = 120 minutes
        # Total planned = 60 minutes
        # Deviation % = 120/60 = 200%
        # Score = max(0, 100 - 200) = 0
        assert score == 0.0

    def test_zone_match_partial(self, scorer):
        """Test partial zone match."""
        planned_zones = {"Z2": 60, "Z4": 20}
        actual_zones = {"Z2": 60, "Z3": 20}  # Z3 instead of Z4

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)

        # Z2: no deviation (60 = 60)
        # Z4: deviation of 20 (planned 20, actual 0)
        # Z3: deviation of 20 (planned 0, actual 20)
        # Total deviation = 40
        # Total planned = 80
        # Deviation % = 40/80 = 50%
        # Score = 100 - 50 = 50
        assert score == 50.0

    def test_zone_match_empty_planned(self, scorer):
        """Test empty planned zones returns 100."""
        score = scorer.calculate_zone_match_score({}, {"Z2": 60})
        assert score == 100.0

    def test_zone_match_empty_actual(self, scorer):
        """Test empty actual zones with planned zones."""
        planned_zones = {"Z2": 60}
        actual_zones = {}

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)

        # All planned time is deviation
        assert score == 0.0
```

### Step 2: Implement ComplianceScorer

In `src/cycling_ai/core/workout_comparison.py`:

```python
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
        compliance_score = (
            completion_score * 0.40
            + duration_score * 0.25
            + intensity_score * 0.25
            + tss_score * 0.10
        )

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

    def score_duration(
        self, planned: PlannedWorkout, actual: ActualWorkout
    ) -> tuple[float, float]:
        """
        Score duration compliance.

        Returns:
            Tuple of (score 0-100, compliance percentage)
        """
        if planned.total_duration_minutes == 0:
            return 100.0, 100.0

        ratio = actual.duration_minutes / planned.total_duration_minutes
        compliance_pct = ratio * 100
        score = min(100.0, compliance_pct)  # Cap at 100

        return score, compliance_pct

    def score_intensity(
        self, planned: PlannedWorkout, actual: ActualWorkout
    ) -> float:
        """
        Score intensity compliance via zone distribution match.

        Returns:
            Score 0-100
        """
        return self.calculate_zone_match_score(
            planned.zone_distribution, actual.zone_distribution
        )

    def score_tss(
        self, planned: PlannedWorkout, actual: ActualWorkout
    ) -> tuple[float, float | None]:
        """
        Score TSS compliance.

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
```

### Step 3: Run Tests

```bash
pytest tests/core/test_workout_comparison.py::TestComplianceScorer -v
```

### Step 4: Add Edge Case Tests

Add tests for:
- Zero duration planned workout
- Zero TSS planned workout
- Actual duration longer than planned (verify capped at 100)
- Actual TSS higher than planned (verify capped at 100)
- Multiple zone mismatches (combined effect)

### Step 5: Type Check

```bash
mypy src/cycling_ai/core/workout_comparison.py --strict
```

---

## Acceptance Testing

```bash
# Run all ComplianceScorer tests
pytest tests/core/test_workout_comparison.py::TestComplianceScorer -v

# Check coverage
pytest tests/core/test_workout_comparison.py::TestComplianceScorer --cov=src/cycling_ai/core/workout_comparison --cov-report=term-missing

# Type check
mypy src/cycling_ai/core/workout_comparison.py --strict
```

Expected results:
- All tests pass
- Coverage ≥ 95% on ComplianceScorer
- Zero mypy errors

---

## Notes

- Scoring weights are fixed: 40% completion, 25% duration, 25% intensity, 10% TSS
- Scores are capped at 100 (cannot exceed perfect compliance)
- Missing data handled gracefully (TSS defaults to 100 if unavailable)
- Zone matching is deviation-based (total deviation as % of planned time)
- Round all scores to 1 decimal place for readability

---

**Ready for Implementation:** YES (after CARD_02)
**Blocked:** NO
