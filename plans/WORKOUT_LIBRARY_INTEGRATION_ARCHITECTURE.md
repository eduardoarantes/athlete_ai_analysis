# TECHNICAL ARCHITECTURE PLAN
## Workout Library-Based Training Plan Generation

**Document Version**: 1.0
**Date**: 2025-11-03
**Status**: DRAFT - Ready for Review
**Estimated Timeline**: 3.5-4.5 days development + 1-2 weeks alpha testing

---

## EXECUTIVE SUMMARY

This plan proposes a deterministic, library-based alternative to the current LLM-based workout generation system (Phase 3b). The new system will select pre-validated workouts from an existing 222-workout library instead of having the LLM generate workouts from scratch, solving two critical problems:

1. **Reliability Issues**: Current Gemini provider has `MALFORMED_FUNCTION_CALL` errors with complex workout schemas
2. **Quality Control**: LLM-generated workouts lack consistency and validation

The library contains 222 workouts across 7 types (endurance, tempo, sweet_spot, threshold, vo2max, recovery, mixed) with metadata for intelligent selection. The new system will:

- Complete in <5 seconds (vs 2-5 minutes for LLM-based)
- Provide consistent, validated workout structures
- Enable A/B comparison with existing LLM approach
- Maintain backward compatibility

**Key Innovation**: Hybrid approach using LLM for strategic planning (Phase 3a) + **stochastic selection algorithm** for tactical execution (Phase 3b).

---

## REQUIREMENTS ANALYSIS

### Functional Requirements

1. **FR1**: Load and validate 222 workouts from `data/workout_library.json`
2. **FR2**: Select appropriate workouts based on:
   - Workout type (endurance, tempo, sweet_spot, threshold, vo2max, recovery, mixed)
   - Training phase (Base, Build, Peak, Taper)
   - Weekday suitability (suitable_weekdays metadata)
   - TSS targets from Phase 3a
   - Duration constraints
3. **FR3**: Add **controlled randomness** to prevent repetitive training plans
4. **FR4**: Maintain workout variety history to avoid selecting same workouts repeatedly
5. **FR5**: Support adjustable TSS/duration via variable_components
6. **FR6**: Generate complete training plan in <5 seconds
7. **FR7**: Maintain backward compatibility with LLM-based approach

### Non-Functional Requirements

1. **NFR1**: Performance: <1 second selection time per workout
2. **NFR2**: Type Safety: Full `mypy --strict` compliance
3. **NFR3**: Test Coverage: 90%+ for selection algorithm
4. **NFR4**: Variety: No workout repeated within 3 weeks unless necessary
5. **NFR5**: Quality: All selected workouts validated against constraints

---

## SYSTEM ARCHITECTURE

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Layer                                 │
│  cycling-ai generate --workout-source library               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│         FullReportWorkflowLibrary                           │
│  (Orchestrates 4 phases with library-based Phase 3b)       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         v               v               v
    ┌─────────┐   ┌─────────────┐   ┌─────────┐
    │ Phase 1 │   │  Phase 3a   │   │ Phase 4 │
    │  Data   │──▶│LLM Overview │──▶│ Report  │
    │  Prep   │   │             │   │   Prep  │
    └─────────┘   └──────┬──────┘   └─────────┘
                         │
                         v
                  ┌──────────────────────────────┐
                  │      Phase 3b (NEW)          │
                  │ LibraryBasedTrainingPlanning │
                  └──────────┬───────────────────┘
                             │
                             v
                  ┌──────────────────────────────┐
                  │   WorkoutSelector            │
                  │  (Stochastic Selection)      │
                  └──────────┬───────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         v                   v                   v
    ┌─────────┐      ┌──────────────┐     ┌──────────────┐
    │Workout  │      │  Scoring     │     │  Variety     │
    │Library  │      │  Algorithm   │     │  Tracker     │
    │Loader   │      │              │     │              │
    └─────────┘      └──────────────┘     └──────────────┘
```

### Data Flow

```
1. Phase 3a (LLM): Creates strategic overview
   ↓
   Output: weekly_overview = [
     {week: 1, phase: "Base", training_days: [
       {weekday: "Monday", type: "endurance", target_tss: 65},
       {weekday: "Wednesday", type: "sweet_spot", target_tss: 85},
       ...
     ]},
     ...
   ]

2. Phase 3b (Library-based): Selects specific workouts
   ↓
   For each week:
     For each training_day:
       ↓
       WorkoutSelector.select_workout(
         workout_type="endurance",
         phase="Base",
         weekday="Monday",
         target_tss=65,
         variety_history=[...]  # Previously selected IDs
       )
       ↓
       Returns: Workout object (with randomness applied)
   ↓
   Output: Complete training plan with specific workouts
```

---

## WORKOUT LIBRARY SCHEMA

### Pydantic Models

```python
from typing import Literal
from pydantic import BaseModel, Field

class WorkoutSegment(BaseModel):
    """A segment within a workout (warmup, interval, recovery, cooldown)."""
    type: Literal["warmup", "interval", "recovery", "cooldown", "steady"]
    duration_min: float
    power_low_pct: int
    power_high_pct: int
    description: str

class VariableComponents(BaseModel):
    """Adjustable parameters for workout scaling."""
    adjustable_field: Literal["duration", "tss", "intervals"]
    min_value: float
    max_value: float

class Workout(BaseModel):
    """A single workout from the library."""
    id: str
    name: str
    detailed_description: str
    type: Literal["endurance", "tempo", "sweet_spot", "threshold", "vo2max", "recovery", "mixed"]
    intensity: Literal["easy", "moderate", "hard", "very_hard"]
    suitable_phases: list[Literal["Base", "Build", "Peak", "Taper"]]
    suitable_weekdays: list[Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]]
    segments: list[WorkoutSegment]
    base_duration_min: float
    base_tss: float
    variable_components: VariableComponents | None = None
    source_file: str
    source_format: str

class WorkoutLibrary(BaseModel):
    """The complete workout library."""
    version: str
    description: str
    workouts: list[Workout]
```

---

## WORKOUT SELECTION ALGORITHM (WITH RANDOMNESS)

### Core Selection Strategy

The algorithm uses **weighted scoring with stochastic sampling** to balance:
1. **Fitness to requirements** (type, phase, weekday, TSS)
2. **Controlled randomness** for variety
3. **Avoidance of recent workouts** (variety history)

### Scoring Function

```python
def score_workout(
    workout: Workout,
    target_type: str,
    target_phase: str,
    target_weekday: str,
    target_tss: float,
    variety_history: list[str],  # Recently used workout IDs
) -> float:
    """
    Score a workout for selection (0.0 to 100.0).

    Scoring breakdown:
    - Type match: 40 points (exact match)
    - Phase match: 25 points (if phase in suitable_phases)
    - Weekday match: 15 points (if weekday in suitable_weekdays)
    - TSS match: 10 points (inverse of TSS difference %)
    - Duration match: 5 points (bonus if duration is reasonable)
    - Variety bonus: 5 points (if NOT in recent history)
    """
    score = 0.0

    # Type match (40 points) - CRITICAL
    if workout.type == target_type:
        score += 40.0
    elif is_compatible_type(workout.type, target_type):
        score += 20.0  # Partial credit for compatible types

    # Phase match (25 points)
    if target_phase in workout.suitable_phases:
        score += 25.0

    # Weekday match (15 points)
    if target_weekday in workout.suitable_weekdays:
        score += 15.0

    # TSS match (10 points)
    tss_diff_pct = abs(workout.base_tss - target_tss) / target_tss
    tss_score = max(0, 10.0 * (1 - tss_diff_pct))
    score += tss_score

    # Duration reasonableness (5 points)
    if 30 <= workout.base_duration_min <= 180:
        score += 5.0

    # Variety bonus (5 points) - NOT in recent history
    if workout.id not in variety_history:
        score += 5.0
    else:
        # Penalize recent workouts
        recency_index = variety_history.index(workout.id)
        penalty = 5.0 * (1 - recency_index / len(variety_history))
        score -= penalty

    return score

def is_compatible_type(workout_type: str, target_type: str) -> bool:
    """
    Check if workout type is compatible with target type.

    Compatibility rules:
    - endurance ↔ recovery (both easy)
    - tempo ↔ sweet_spot (similar intensity)
    - threshold ↔ vo2max (both hard)
    - mixed compatible with any
    """
    compatibility_map = {
        "endurance": ["recovery", "mixed"],
        "recovery": ["endurance", "mixed"],
        "tempo": ["sweet_spot", "mixed"],
        "sweet_spot": ["tempo", "mixed"],
        "threshold": ["vo2max", "mixed"],
        "vo2max": ["threshold", "mixed"],
        "mixed": ["endurance", "recovery", "tempo", "sweet_spot", "threshold", "vo2max"],
    }
    return target_type in compatibility_map.get(workout_type, [])
```

### Stochastic Selection with Temperature

Instead of always picking the **highest-scored** workout (deterministic), we use **temperature-based sampling** for controlled randomness:

```python
import random
import numpy as np

def select_workout_stochastic(
    candidates: list[Workout],
    scores: list[float],
    temperature: float = 0.5,
) -> Workout:
    """
    Select workout using temperature-based stochastic sampling.

    Temperature controls randomness:
    - temperature = 0.0: Always pick highest score (deterministic)
    - temperature = 0.5: Balanced randomness (RECOMMENDED)
    - temperature = 1.0: High randomness, scores matter less
    - temperature = 2.0: Nearly uniform random

    Args:
        candidates: List of candidate workouts
        scores: Corresponding scores for each workout
        temperature: Randomness parameter (0.0 to 2.0)

    Returns:
        Selected workout
    """
    if not candidates:
        raise ValueError("No candidate workouts available")

    if temperature == 0.0:
        # Deterministic: pick highest score
        max_idx = scores.index(max(scores))
        return candidates[max_idx]

    # Apply temperature scaling to scores
    # Higher temperature → flatter distribution → more random
    scaled_scores = np.array(scores) / temperature

    # Convert to probabilities using softmax
    exp_scores = np.exp(scaled_scores - np.max(scaled_scores))  # Subtract max for numerical stability
    probabilities = exp_scores / np.sum(exp_scores)

    # Sample workout based on probabilities
    selected_idx = np.random.choice(len(candidates), p=probabilities)
    return candidates[selected_idx]
```

### Complete Selection Flow

```python
def select_workout(
    self,
    workout_type: str,
    phase: str,
    weekday: str,
    target_tss: float,
    variety_history: list[str],
    temperature: float = 0.5,
    min_score_threshold: float = 50.0,
) -> Workout:
    """
    Select a workout using stochastic sampling.

    Process:
    1. Filter workouts by minimum score threshold
    2. Score all candidates
    3. Apply stochastic sampling with temperature
    4. Adjust TSS if needed (via variable_components)

    Args:
        workout_type: Target workout type (endurance, tempo, etc.)
        phase: Training phase (Base, Build, Peak, Taper)
        weekday: Target weekday (Monday, Tuesday, etc.)
        target_tss: Target Training Stress Score
        variety_history: List of recently used workout IDs (last 3 weeks)
        temperature: Randomness parameter (0.0 to 2.0, default 0.5)
        min_score_threshold: Minimum score to be considered (default 50.0)

    Returns:
        Selected workout (possibly adjusted for TSS)
    """
    # Score all workouts
    candidates = []
    scores = []

    for workout in self.library.workouts:
        score = score_workout(
            workout=workout,
            target_type=workout_type,
            target_phase=phase,
            target_weekday=weekday,
            target_tss=target_tss,
            variety_history=variety_history,
        )

        if score >= min_score_threshold:
            candidates.append(workout)
            scores.append(score)

    if not candidates:
        # Fallback: lower threshold and try again
        logger.warning(f"No workouts above threshold {min_score_threshold}, lowering to 30.0")
        return self.select_workout(
            workout_type=workout_type,
            phase=phase,
            weekday=weekday,
            target_tss=target_tss,
            variety_history=variety_history,
            temperature=temperature,
            min_score_threshold=30.0,
        )

    # Stochastic selection
    selected = select_workout_stochastic(
        candidates=candidates,
        scores=scores,
        temperature=temperature,
    )

    # Adjust TSS if needed
    adjusted = self.adjust_workout_tss(selected, target_tss)

    return adjusted
```

### Variety History Management

```python
class VarietyTracker:
    """
    Tracks recently used workouts to ensure variety.

    Maintains a rolling window of workout IDs to prevent repetition.
    """

    def __init__(self, window_weeks: int = 3):
        """
        Initialize variety tracker.

        Args:
            window_weeks: Number of weeks to track (default 3)
        """
        self.window_weeks = window_weeks
        self.history: list[str] = []  # List of workout IDs

    def add_workout(self, workout_id: str) -> None:
        """Add a workout to history."""
        self.history.append(workout_id)

        # Trim to window size (assuming 5 workouts per week)
        max_size = self.window_weeks * 5
        if len(self.history) > max_size:
            self.history = self.history[-max_size:]

    def get_recent_ids(self) -> list[str]:
        """Get list of recently used workout IDs."""
        return self.history.copy()

    def reset(self) -> None:
        """Clear history (for testing or new plans)."""
        self.history = []
```

---

## CLASS/MODULE DESIGN

### File: `src/cycling_ai/core/workout_library/models.py`

```python
"""Pydantic models for workout library schema."""
from typing import Literal
from pydantic import BaseModel, Field

# [Models defined above: WorkoutSegment, VariableComponents, Workout, WorkoutLibrary]
```

### File: `src/cycling_ai/core/workout_library/loader.py`

```python
"""Workout library loader with caching."""
import json
import logging
from pathlib import Path
from typing import Optional

from cycling_ai.core.workout_library.models import WorkoutLibrary

logger = logging.getLogger(__name__)

class WorkoutLibraryLoader:
    """
    Loads and caches workout library from JSON.

    Singleton pattern to ensure library is loaded once.
    """

    _instance: Optional["WorkoutLibraryLoader"] = None
    _library: Optional[WorkoutLibrary] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load_library(self, library_path: Path | None = None) -> WorkoutLibrary:
        """
        Load workout library from JSON file.

        Args:
            library_path: Path to workout_library.json (defaults to data/workout_library.json)

        Returns:
            Loaded and validated WorkoutLibrary

        Raises:
            FileNotFoundError: If library file doesn't exist
            ValueError: If library JSON is invalid
        """
        # Use cached library if available
        if self._library is not None:
            logger.debug("Using cached workout library")
            return self._library

        # Default path
        if library_path is None:
            library_path = Path(__file__).parent.parent.parent.parent / "data" / "workout_library.json"

        if not library_path.exists():
            raise FileNotFoundError(f"Workout library not found: {library_path}")

        logger.info(f"Loading workout library from {library_path}")

        with open(library_path, "r", encoding="utf-8") as f:
            library_data = json.load(f)

        # Validate with Pydantic
        self._library = WorkoutLibrary(**library_data)

        logger.info(f"Loaded {len(self._library.workouts)} workouts from library")

        return self._library

    def get_library(self) -> WorkoutLibrary:
        """Get cached library (load if not cached)."""
        if self._library is None:
            return self.load_library()
        return self._library
```

### File: `src/cycling_ai/core/workout_library/selector.py`

```python
"""Workout selection algorithm with stochastic sampling."""
import logging
import random
from typing import Optional
import numpy as np

from cycling_ai.core.workout_library.models import Workout, WorkoutLibrary
from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader

logger = logging.getLogger(__name__)

class VarietyTracker:
    """Tracks recently used workouts to ensure variety."""
    # [Implementation as shown above]

class WorkoutSelector:
    """
    Selects workouts from library using multi-criteria scoring with stochastic sampling.
    """

    def __init__(
        self,
        library: WorkoutLibrary | None = None,
        variety_window_weeks: int = 3,
        default_temperature: float = 0.5,
    ):
        """
        Initialize workout selector.

        Args:
            library: Workout library (loads from default if None)
            variety_window_weeks: Number of weeks to track for variety (default 3)
            default_temperature: Default randomness parameter (default 0.5)
        """
        if library is None:
            loader = WorkoutLibraryLoader()
            library = loader.get_library()

        self.library = library
        self.variety_tracker = VarietyTracker(window_weeks=variety_window_weeks)
        self.default_temperature = default_temperature

        logger.info(f"WorkoutSelector initialized with {len(library.workouts)} workouts")

    def select_workout(
        self,
        workout_type: str,
        phase: str,
        weekday: str,
        target_tss: float,
        temperature: float | None = None,
        min_score_threshold: float = 50.0,
    ) -> Workout:
        """Select workout using stochastic sampling."""
        # [Implementation as shown above]

    def score_workout(
        self,
        workout: Workout,
        target_type: str,
        target_phase: str,
        target_weekday: str,
        target_tss: float,
    ) -> float:
        """Score a workout for selection."""
        # [Implementation as shown above]

    def adjust_workout_tss(
        self,
        workout: Workout,
        target_tss: float,
        tolerance_pct: float = 0.15,
    ) -> Workout:
        """
        Adjust workout TSS using variable_components if needed.

        Args:
            workout: Original workout
            target_tss: Target TSS
            tolerance_pct: Acceptable TSS difference (default 15%)

        Returns:
            Adjusted workout (new instance) or original if no adjustment needed
        """
        tss_diff_pct = abs(workout.base_tss - target_tss) / target_tss

        if tss_diff_pct <= tolerance_pct:
            # Within tolerance, no adjustment needed
            return workout

        if workout.variable_components is None:
            logger.warning(
                f"Workout {workout.id} cannot be adjusted (no variable_components), "
                f"TSS difference: {tss_diff_pct*100:.1f}%"
            )
            return workout

        # Calculate adjustment factor
        adjustment_factor = target_tss / workout.base_tss

        # Adjust based on variable component type
        if workout.variable_components.adjustable_field == "duration":
            # Adjust all segment durations proportionally
            adjusted_workout = workout.model_copy(deep=True)
            for segment in adjusted_workout.segments:
                segment.duration_min *= adjustment_factor

            adjusted_workout.base_duration_min *= adjustment_factor
            adjusted_workout.base_tss = target_tss

            # Ensure within min/max bounds
            if not (
                workout.variable_components.min_value
                <= adjusted_workout.base_duration_min
                <= workout.variable_components.max_value
            ):
                logger.warning(
                    f"Adjusted duration {adjusted_workout.base_duration_min:.0f}min "
                    f"outside bounds [{workout.variable_components.min_value}, "
                    f"{workout.variable_components.max_value}], using original"
                )
                return workout

            logger.debug(
                f"Adjusted workout {workout.id} duration: "
                f"{workout.base_duration_min:.0f} → {adjusted_workout.base_duration_min:.0f}min, "
                f"TSS: {workout.base_tss:.1f} → {adjusted_workout.base_tss:.1f}"
            )
            return adjusted_workout

        elif workout.variable_components.adjustable_field == "tss":
            # Direct TSS adjustment
            adjusted_workout = workout.model_copy(deep=True)
            adjusted_workout.base_tss = target_tss

            logger.debug(
                f"Adjusted workout {workout.id} TSS: "
                f"{workout.base_tss:.1f} → {adjusted_workout.base_tss:.1f}"
            )
            return adjusted_workout

        else:
            logger.warning(
                f"Unknown adjustable_field: {workout.variable_components.adjustable_field}"
            )
            return workout
```

---

## IMPLEMENTATION PLAN

### Task Breakdown

**T1: Create Pydantic Models** (3-4 hours)
- File: `src/cycling_ai/core/workout_library/models.py`
- Models: `WorkoutSegment`, `VariableComponents`, `Workout`, `WorkoutLibrary`
- Validation: Type safety, enum constraints
- Tests: Unit tests for model validation

**T2: Implement WorkoutLibraryLoader** (2-3 hours)
- File: `src/cycling_ai/core/workout_library/loader.py`
- Singleton pattern for caching
- JSON loading and Pydantic validation
- Error handling (file not found, invalid JSON)
- Tests: Load real library, test caching

**T3: Implement WorkoutSelector with Stochastic Sampling** (6-8 hours)
- File: `src/cycling_ai/core/workout_library/selector.py`
- Classes: `VarietyTracker`, `WorkoutSelector`
- Scoring algorithm with all criteria
- Temperature-based stochastic sampling
- TSS adjustment logic
- Tests: Unit tests for scoring, selection, variety tracking

**T4: Create LibraryBasedTrainingPlanningPhase** (4-5 hours)
- File: `src/cycling_ai/orchestration/phases/training_planning_library.py`
- Loads weekly_overview from Phase 3a
- Calls WorkoutSelector for each training day
- Calls `add_week_details` tool for each week
- Error handling and logging
- Tests: Integration test with mock Phase 3a output

**T5: Create FullReportWorkflowLibrary** (1-2 hours)
- File: `src/cycling_ai/orchestration/workflows/full_report_library.py`
- Copy of FullReportWorkflow with Phase 3b replaced
- Configuration for library-based workflow
- Tests: End-to-end workflow test

**T6: Add CLI Integration** (1-2 hours)
- File: `src/cycling_ai/cli/commands/generate.py`
- Add `--workout-source` flag (choices: llm, library)
- Route to appropriate workflow
- Tests: CLI integration test

**T7: Unit Tests** (3-4 hours)
- Test all scoring criteria
- Test stochastic sampling with different temperatures
- Test variety tracking
- Test TSS adjustment
- Test edge cases (no candidates, threshold lowering)

**T8: Integration Tests** (2-3 hours)
- Test with real workout library
- Test complete workflow (Phase 3a → Phase 3b)
- Test randomness (run multiple times, verify different selections)
- Test variety (verify no repetition within 3 weeks)

**T9: Performance Benchmarks** (1-2 hours)
- Measure selection time per workout
- Measure total Phase 3b time (12-week plan)
- Compare with LLM-based approach
- Document results

**T10: Documentation** (2-3 hours)
- Update user guide with --workout-source flag
- Document temperature parameter tuning
- Add examples of variety control
- Update architecture docs

**Total Estimated Time**: 25-34 hours (3-4 days development)

---

## TESTING STRATEGY

### Unit Tests

```python
# tests/core/workout_library/test_selector.py

def test_scoring_exact_match():
    """Test scoring with exact type/phase/weekday match."""
    selector = WorkoutSelector()
    workout = create_test_workout(
        type="endurance",
        phase=["Base"],
        weekday=["Monday"],
        tss=65.0,
    )

    score = selector.score_workout(
        workout=workout,
        target_type="endurance",
        target_phase="Base",
        target_weekday="Monday",
        target_tss=65.0,
    )

    # Should get near-perfect score (40+25+15+10+5+5 = 100)
    assert score >= 95.0

def test_stochastic_sampling_deterministic():
    """Test temperature=0.0 always picks highest score."""
    candidates = [create_workout(tss=50), create_workout(tss=75), create_workout(tss=100)]
    scores = [50.0, 90.0, 70.0]  # Middle one has highest score

    for _ in range(10):
        selected = select_workout_stochastic(candidates, scores, temperature=0.0)
        assert selected == candidates[1]  # Always pick index 1

def test_stochastic_sampling_randomness():
    """Test temperature>0 produces variety."""
    candidates = [create_workout(tss=50), create_workout(tss=75)]
    scores = [80.0, 85.0]  # Close scores

    selections = []
    for _ in range(100):
        selected = select_workout_stochastic(candidates, scores, temperature=0.5)
        selections.append(candidates.index(selected))

    # Both should be selected at least once (high probability)
    assert 0 in selections
    assert 1 in selections

    # Higher-scored one should be selected more often
    assert selections.count(1) > selections.count(0)

def test_variety_tracking():
    """Test variety tracker prevents repetition."""
    selector = WorkoutSelector()

    # Select 10 workouts
    selected_ids = []
    for i in range(10):
        workout = selector.select_workout(
            workout_type="endurance",
            phase="Base",
            weekday="Monday",
            target_tss=65.0,
        )
        selected_ids.append(workout.id)
        selector.variety_tracker.add_workout(workout.id)

    # No workout should repeat in last 3 weeks (15 workouts assuming 5/week)
    recent_15 = selected_ids[-15:] if len(selected_ids) >= 15 else selected_ids
    assert len(recent_15) == len(set(recent_15))  # All unique
```

### Integration Tests

```python
# tests/orchestration/phases/test_training_planning_library.py

@pytest.mark.integration
def test_library_based_phase_3b():
    """Test Phase 3b with library-based selection."""
    # Mock Phase 3a output
    weekly_overview = [
        {
            "week": 1,
            "phase": "Base",
            "training_days": [
                {"weekday": "Monday", "type": "endurance", "target_tss": 65},
                {"weekday": "Wednesday", "type": "sweet_spot", "target_tss": 85},
                {"weekday": "Friday", "type": "endurance", "target_tss": 70},
                {"weekday": "Saturday", "type": "endurance", "target_tss": 90},
            ],
        },
        # ... more weeks
    ]

    phase = LibraryBasedTrainingPlanningPhase(config=config)
    result = phase.execute(weekly_overview=weekly_overview)

    assert result.success
    # Verify workouts were selected and added
    # Verify variety (no duplicates in week 1)

@pytest.mark.integration
def test_randomness_produces_variety():
    """Test that running Phase 3b multiple times produces different plans."""
    weekly_overview = [...]  # Same input

    plans = []
    for _ in range(5):
        phase = LibraryBasedTrainingPlanningPhase(config=config)
        result = phase.execute(weekly_overview=weekly_overview)
        plans.append(result.workout_ids)

    # At least 3 out of 5 runs should produce different plans
    unique_plans = len(set(map(tuple, plans)))
    assert unique_plans >= 3
```

---

## EDGE CASES & ERROR HANDLING

1. **No Matching Workouts**: Lower score threshold progressively (50 → 30 → 20)
2. **TSS Adjustment Out of Bounds**: Use original workout, log warning
3. **Empty Variety History**: Normal scoring (no penalty)
4. **All Workouts in History**: Penalize but still allow selection (use recency weighting)
5. **Invalid Temperature**: Clip to [0.0, 2.0] range
6. **Library Load Failure**: Fail fast with clear error message
7. **Corrupted Workout Data**: Pydantic validation catches issues at load time

---

## PERFORMANCE TARGETS

- **Workout Selection**: <10ms per workout
- **Complete Phase 3b** (12 weeks, 48 workouts): <1 second
- **Library Loading**: <100ms (cached after first load)
- **Total Workflow** (Phases 1-4): <5 seconds

---

## CONFIGURATION & TUNING

### Temperature Parameter Recommendations

| Temperature | Behavior | Use Case |
|-------------|----------|----------|
| 0.0 | Deterministic (always best score) | Testing, debugging |
| 0.3 | Low randomness, quality-focused | Conservative athletes |
| 0.5 | **Balanced (RECOMMENDED)** | Most users |
| 0.7 | High randomness, variety-focused | Advanced athletes seeking variety |
| 1.0 | Very high randomness | Experimental |

### Variety Window Tuning

- **2 weeks**: More repetition allowed, faster convergence
- **3 weeks (RECOMMENDED)**: Good balance
- **4 weeks**: Maximum variety, may compromise optimal selection

---

## Key Files Reference

**Existing workout library**: `/Users/eduardo/Documents/projects/cycling-ai-analysis/data/workout_library.json` (222 workouts)

**New components to create**:
- `src/cycling_ai/core/workout_library/models.py` - Pydantic models
- `src/cycling_ai/core/workout_library/loader.py` - Library loader
- `src/cycling_ai/core/workout_library/selector.py` - Selection algorithm
- `src/cycling_ai/orchestration/phases/training_planning_library.py` - New phase
- `src/cycling_ai/orchestration/workflows/full_report_library.py` - New workflow

**CLI changes**:
- `src/cycling_ai/cli/commands/generate.py` - Add `--workout-source` flag

---

## Next Steps

1. ✅ **Architecture Plan Complete** - This document
2. ⏭️ **Stakeholder Review** - Review and approve plan
3. ⏭️ **Implementation** - Begin with T1 (Pydantic models)
4. ⏭️ **Testing** - Unit tests, integration tests, benchmarks
5. ⏭️ **Alpha Deployment** - Internal testing
6. ⏭️ **Beta Release** - User feedback
7. ⏭️ **General Availability** - Production deployment

---

**Generated by**: Claude Code (architecture-planner agent)
**For**: Workout library integration feature
**Project**: cycling-ai-analysis
