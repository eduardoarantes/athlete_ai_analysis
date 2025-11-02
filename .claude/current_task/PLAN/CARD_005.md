# CARD_005: Implement Repeat Structure Handling

**Status**: Ready for Implementation
**Priority**: P1 (Core Functionality)
**Estimated Time**: 3 hours
**Dependencies**: CARD_001, CARD_002, CARD_003, CARD_004

---

## Objective

Implement the logic to detect and handle FIT repeat structures, converting them into interval segments with work/recovery pairs. This is the most complex part of the parser and critical for correctly parsing interval-based workouts.

---

## Background

### FIT Repeat Structure Pattern

In FIT files, intervals are represented as:

```
Step N:   Work interval (intensity=ACTIVE, duration_type=TIME)
Step N+1: Recovery interval (intensity=REST, duration_type=TIME)
Step N+2: Repeat control (duration_type=REPEAT_UNTIL_STEPS_COMPLETE, repeat_steps=5)
```

This represents: **(Work → Recovery) × 5**

### Our Target Format

```json
{
  "type": "interval",
  "sets": 5,
  "work": {
    "duration_min": 3,
    "power_low_pct": 110,
    "power_high_pct": 120,
    "description": "Hard"
  },
  "recovery": {
    "duration_min": 3,
    "power_low_pct": 50,
    "power_high_pct": 60,
    "description": "Easy"
  }
}
```

---

## Tasks

### 1. Implement `_handle_repeat_structure` Method

**File**: `src/cycling_ai/parsers/fit_workout_parser.py`

Add to FitWorkoutParser class:

```python
def _handle_repeat_structure(
    self,
    steps: list[FitWorkoutStep],
    repeat_index: int,
    ftp: float,
) -> dict[str, Any]:
    """
    Handle repeat/interval structure.

    FIT repeat structure:
      Step N: work interval (ACTIVE)
      Step N+1: recovery interval (REST)
      Step N+2: repeat (repeat_steps=X)

    Our format:
      {
        "type": "interval",
        "sets": X,
        "work": {...},
        "recovery": {...}
      }

    Args:
        steps: All workout steps
        repeat_index: Index of the repeat step
        ftp: Athlete's FTP

    Returns:
        Interval segment dictionary

    Raises:
        ValueError: If repeat structure is invalid

    Example:
        >>> steps = [warmup_step, work_step, recovery_step, repeat_step]
        >>> segment = parser._handle_repeat_structure(steps, 3, 260)
        >>> segment["type"]
        'interval'
        >>> segment["sets"]
        5
    """
    repeat_step = steps[repeat_index]

    if not repeat_step.is_repeat_step():
        raise ValueError(f"Step {repeat_index} is not a repeat step")

    # The repeat step tells us how many times to repeat
    repeat_count = repeat_step.repeat_steps or 0

    if repeat_count <= 0:
        raise ValueError(
            f"Repeat step at {repeat_index} has invalid repeat count: {repeat_count}"
        )

    # Find the work and recovery steps before the repeat step
    # Strategy: Look backward from repeat step for ACTIVE and REST steps
    work_step = None
    recovery_step = None

    # Search backward for work interval (ACTIVE intensity)
    # We search in reverse order to find the most recent work step
    for j in range(repeat_index - 1, -1, -1):
        if steps[j].intensity == FitIntensity.ACTIVE:
            work_step = steps[j]
            break

    # Search backward for recovery (REST intensity)
    for j in range(repeat_index - 1, -1, -1):
        if steps[j].intensity == FitIntensity.REST:
            recovery_step = steps[j]
            break

    if not work_step:
        raise ValueError(
            f"Repeat step at index {repeat_index} has no work interval. "
            f"Expected ACTIVE step before repeat."
        )

    # Build interval segment
    segment: dict[str, Any] = {
        "type": "interval",
        "sets": repeat_count,
        "work": {
            "duration_min": int(work_step.duration_value / 60),
            "power_low_pct": self._get_power_pct(work_step, ftp, is_low=True),
            "power_high_pct": self._get_power_pct(work_step, ftp, is_low=False),
            "description": work_step.step_name or "Work",
        },
    }

    # Add recovery if present (some intervals have no recovery)
    if recovery_step:
        segment["recovery"] = {
            "duration_min": int(recovery_step.duration_value / 60),
            "power_low_pct": self._get_power_pct(
                recovery_step, ftp, is_low=True
            ),
            "power_high_pct": self._get_power_pct(
                recovery_step, ftp, is_low=False
            ),
            "description": recovery_step.step_name or "Recovery",
        }

    return segment
```

### 2. Update `_build_segments` Method

Modify the `_build_segments` method to handle repeats:

```python
def _build_segments(
    self,
    steps: list[FitWorkoutStep],
    ftp: float,
) -> list[dict[str, Any]]:
    """
    Build workout segments from FIT steps.

    This is the core transformation logic that:
    1. Identifies repeat structures
    2. Groups work/recovery pairs into intervals
    3. Converts simple steps to segments
    4. Handles power zone or custom power ranges

    Args:
        steps: List of FitWorkoutStep objects
        ftp: Athlete's FTP for percentage calculations

    Returns:
        List of segment dictionaries

    Example:
        >>> steps = [warmup, work, recovery, repeat, cooldown]
        >>> segments = parser._build_segments(steps, 260)
        >>> len(segments)
        3  # warmup, interval, cooldown
    """
    segments: list[dict[str, Any]] = []
    processed_indices: set[int] = set()
    i = 0

    while i < len(steps):
        # Skip already processed steps (work/recovery in repeat)
        if i in processed_indices:
            i += 1
            continue

        step = steps[i]

        if step.is_repeat_step():
            # Handle repeat structure
            repeat_segment = self._handle_repeat_structure(steps, i, ftp)
            segments.append(repeat_segment)

            # Mark work and recovery steps as processed
            # Search backward to find them
            for j in range(i - 1, -1, -1):
                if steps[j].intensity == FitIntensity.ACTIVE:
                    processed_indices.add(j)
                    break

            for j in range(i - 1, -1, -1):
                if steps[j].intensity == FitIntensity.REST:
                    processed_indices.add(j)
                    break

            i += 1
        else:
            # Simple step (warmup, cooldown, steady)
            segment = self._convert_step_to_segment(step, ftp)
            if segment:  # Skip None (like OPEN steps)
                segments.append(segment)
            i += 1

    return segments
```

### 3. Handle Edge Cases

Add helper method for complex repeat detection:

```python
def _is_part_of_repeat(
    self,
    steps: list[FitWorkoutStep],
    step_index: int,
) -> bool:
    """
    Check if a step is part of a repeat structure.

    A step is part of a repeat if:
    - It's followed by a repeat step, AND
    - It has ACTIVE or REST intensity

    Args:
        steps: All workout steps
        step_index: Index to check

    Returns:
        True if step is part of repeat structure

    Example:
        >>> steps = [warmup, work, recovery, repeat, cooldown]
        >>> parser._is_part_of_repeat(steps, 1)  # work step
        True
        >>> parser._is_part_of_repeat(steps, 0)  # warmup
        False
    """
    step = steps[step_index]

    # Only ACTIVE or REST steps can be part of repeats
    if step.intensity not in [FitIntensity.ACTIVE, FitIntensity.REST]:
        return False

    # Look forward for repeat step
    for i in range(step_index + 1, len(steps)):
        if steps[i].is_repeat_step():
            return True
        # Stop looking after we hit another warmup/cooldown
        if steps[i].intensity in [FitIntensity.WARMUP, FitIntensity.COOLDOWN]:
            return False

    return False
```

---

## Testing

### Unit Tests

Add to **File**: `tests/parsers/test_fit_workout_parser.py`

```python
class TestRepeatStructureHandling:
    """Test repeat structure handling."""

    @pytest.fixture
    def parser(self):
        """Create parser instance."""
        return FitWorkoutParser()

    def test_handle_repeat_structure_basic(self, parser):
        """Test basic repeat structure handling."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,  # 3 minutes
            target_type=FitTargetType.POWER,
            custom_power_low=286,  # 110% of 260 FTP
            custom_power_high=312,  # 120% of 260 FTP
            step_name="Hard",
        )

        recovery_step = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=130,  # 50% of 260 FTP
            custom_power_high=156,  # 60% of 260 FTP
            step_name="Easy",
        )

        repeat_step = FitWorkoutStep(
            message_index=3,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        steps = [work_step, recovery_step, repeat_step]
        ftp = 260

        segment = parser._handle_repeat_structure(steps, 2, ftp)

        assert segment["type"] == "interval"
        assert segment["sets"] == 5
        assert segment["work"]["duration_min"] == 3
        assert segment["work"]["power_low_pct"] == 110
        assert segment["work"]["power_high_pct"] == 120
        assert segment["recovery"]["duration_min"] == 3
        assert segment["recovery"]["power_low_pct"] == 50
        assert segment["recovery"]["power_high_pct"] == 60

    def test_handle_repeat_structure_no_recovery(self, parser):
        """Test repeat structure without recovery step."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=60,
            target_type=FitTargetType.POWER,
            custom_power_low=286,
            custom_power_high=312,
            step_name="Sprint",
        )

        repeat_step = FitWorkoutStep(
            message_index=2,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=10,
            target_type=FitTargetType.OPEN,
            repeat_steps=10,
        )

        steps = [work_step, repeat_step]
        ftp = 260

        segment = parser._handle_repeat_structure(steps, 1, ftp)

        assert segment["type"] == "interval"
        assert segment["sets"] == 10
        assert "work" in segment
        assert "recovery" not in segment

    def test_handle_repeat_structure_invalid_not_repeat_step(self, parser):
        """Test error when step is not a repeat step."""
        work_step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
        )

        steps = [work_step]

        with pytest.raises(ValueError, match="not a repeat step"):
            parser._handle_repeat_structure(steps, 0, 260)

    def test_handle_repeat_structure_missing_work_step(self, parser):
        """Test error when work step is missing."""
        repeat_step = FitWorkoutStep(
            message_index=0,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        steps = [repeat_step]

        with pytest.raises(ValueError, match="has no work interval"):
            parser._handle_repeat_structure(steps, 0, 260)

    def test_build_segments_with_repeat(self, parser):
        """Test building segments with repeat structure."""
        warmup = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.WARMUP,
            duration_type=FitDurationType.TIME,
            duration_value=900,  # 15 min
            target_type=FitTargetType.POWER,
            custom_power_low=130,
            custom_power_high=156,
            step_name="Warmup",
        )

        work = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=286,
            custom_power_high=312,
            step_name="Hard",
        )

        recovery = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=130,
            custom_power_high=156,
            step_name="Easy",
        )

        repeat = FitWorkoutStep(
            message_index=3,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        cooldown = FitWorkoutStep(
            message_index=4,
            intensity=FitIntensity.COOLDOWN,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            custom_power_low=130,
            custom_power_high=156,
            step_name="Cooldown",
        )

        steps = [warmup, work, recovery, repeat, cooldown]
        ftp = 260

        segments = parser._build_segments(steps, ftp)

        # Should have 3 segments: warmup, interval, cooldown
        assert len(segments) == 3
        assert segments[0]["type"] == "warmup"
        assert segments[1]["type"] == "interval"
        assert segments[1]["sets"] == 5
        assert segments[2]["type"] == "cooldown"

    def test_is_part_of_repeat(self, parser):
        """Test detecting if step is part of repeat."""
        warmup = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.WARMUP,
            duration_type=FitDurationType.TIME,
            duration_value=900,
            target_type=FitTargetType.POWER,
        )

        work = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
        )

        recovery = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
        )

        repeat = FitWorkoutStep(
            message_index=3,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        steps = [warmup, work, recovery, repeat]

        assert parser._is_part_of_repeat(steps, 0) is False  # warmup
        assert parser._is_part_of_repeat(steps, 1) is True  # work
        assert parser._is_part_of_repeat(steps, 2) is True  # recovery
```

### Integration Tests

Add to **File**: `tests/parsers/test_fit_workout_parser_integration.py`

```python
def test_parse_minute_monster_repeats(parser, sample_fit_dir):
    """Test parsing Minute Monster with multiple repeat structures."""
    fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
    ftp = 1200

    workout = parser.parse_workout_file(fit_path, ftp)

    # Minute Monster has nested repeat structures
    # Should detect and parse all intervals
    interval_segments = [s for s in workout.segments if s["type"] == "interval"]

    assert len(interval_segments) > 0, "Expected interval segments"

    # Each interval should have sets
    for interval in interval_segments:
        assert interval["sets"] > 0
        assert "work" in interval
        assert interval["work"]["duration_min"] > 0


def test_parse_vo2max_booster_repeats(parser, sample_fit_dir):
    """Test parsing VO2 Max Booster with repeat structures."""
    fit_path = sample_fit_dir / "2025-11-05_VO2MaxBoos.fit"
    ftp = 1200

    workout = parser.parse_workout_file(fit_path, ftp)

    # VO2 Max Booster: "6 x 30/15 - 3 repeats"
    # Should have interval segments
    interval_segments = [s for s in workout.segments if s["type"] == "interval"]

    assert len(interval_segments) > 0

    # Validate interval structure
    for interval in interval_segments:
        assert "work" in interval
        assert "recovery" in interval or interval["work"]["duration_min"] > 0
```

---

## Acceptance Criteria

- [ ] `_handle_repeat_structure` method implemented
- [ ] `_build_segments` method updated to handle repeats
- [ ] `_is_part_of_repeat` helper method implemented
- [ ] Repeat structures correctly identified and parsed
- [ ] Work and recovery steps grouped into interval segments
- [ ] Steps marked as processed to avoid duplication
- [ ] All unit tests pass
- [ ] All integration tests pass with real FIT files
- [ ] Type checking passes (`mypy --strict`)
- [ ] Code formatting passes (`ruff format`, `ruff check`)

---

## Files Modified

- **Modified**: `src/cycling_ai/parsers/fit_workout_parser.py`
- **Modified**: `tests/parsers/test_fit_workout_parser.py`
- **Modified**: `tests/parsers/test_fit_workout_parser_integration.py`

---

## Notes

- This is the most complex part of the parser
- Repeat detection requires looking backward through steps
- Must handle edge cases: no recovery, multiple repeats, nested structures
- Processed indices tracking prevents duplication
- Clear error messages essential for debugging

---

## Edge Cases

1. **No recovery step**: Intervals without recovery (e.g., sprints)
2. **Multiple repeat blocks**: Multiple interval sets in one workout
3. **Nested repeats**: Some advanced workouts have repeats within repeats
4. **Non-sequential repeats**: Repeat not immediately after work/recovery

---

**Ready to Implement**: Yes (after CARD_004 complete)
**Blocked By**: CARD_001, CARD_002, CARD_003, CARD_004
**Next Card**: CARD_006 (Power Conversion Logic)
