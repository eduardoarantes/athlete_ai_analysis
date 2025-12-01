# Workout Selection Logic Analysis

## Current Implementation Status

### ✅ What Currently Exists

**File:** `src/cycling_ai/core/workout_library/selector.py`

#### 1. VarietyTracker Class (Lines 27-66)
```python
class VarietyTracker:
    """Tracks recently used workouts to prevent repetition."""

    def __init__(self, window_size: int = 15) -> None:
        """Default window is 15 workouts (~3 weeks at 5 workouts/week)."""
        self.window_size = window_size
        self._recent_workouts: deque[str] = deque(maxlen=window_size)

    def add_workout(self, workout_id: str) -> None:
        """Add workout ID to tracking history."""
        self._recent_workouts.append(workout_id)
```

**Current Behavior:**
- Rolling window of last 15 workout IDs
- Uses `deque` with `maxlen=15` (automatically removes oldest when full)
- Window size covers approximately 3 weeks at 5 workouts/week

#### 2. Scoring System (Lines 98-161)
```python
def score_workout(
    self,
    workout: Workout,
    target_type: str,
    target_phase: str,
    target_weekday: str,
    target_duration_min: float,
    min_duration_min: float | None,
    max_duration_min: float | None,
    variety_history: list[str],
) -> float:
    """Score workout based on multiple criteria (0-100 points)."""
    score = 0.0

    # Type match (40 points exact, 20 compatible)
    if workout.type == target_type:
        score += 40
    elif target_type in TYPE_COMPATIBILITY.get(workout.type, []):
        score += 20

    # Phase match (25 points)
    if workout.suitable_phases and target_phase in workout.suitable_phases:
        score += 25

    # Weekday match (15 points)
    if workout.suitable_weekdays and target_weekday in workout.suitable_weekdays:
        score += 15

    # Duration match (15 points based on % difference)
    if target_duration_min > 0:
        duration_diff_pct = abs(workout.base_duration_min - target_duration_min) / target_duration_min
        duration_score = max(0, 15 * (1 - min(duration_diff_pct, 1.0)))
        score += duration_score

    # ⚠️ Variety bonus: 5 points if NOT in recent history
    if workout.id not in variety_history:
        score += 5

    return score
```

**Variety Bonus Logic:**
- Only gives 5 bonus points if workout NOT in last 15 selections
- Does NOT hard-block recently used workouts
- Recent workouts can still be selected if they score high on other criteria

---

## ❌ Critical Missing Logic

### Problem 1: Variety Tracker Never Updated

**File:** `src/cycling_ai/orchestration/phases/training_planning_library.py`
**Method:** `_select_and_scale_workouts()` (Lines 308-434)

```python
# Current code (INCORRECT)
for day in week["training_days"]:
    if day["workout_type"] == "rest":
        continue

    workout = self.selector.select_workout(
        target_type=day["workout_type"],
        target_phase=week["phase"],
        target_weekday=day["weekday"],
        target_duration_min=90 if is_weekend else 60,
        min_duration_min=90 if is_weekend else 45,
        max_duration_min=100 if is_weekend else 75,
        temperature=self.temperature,
    )

    # ❌ MISSING: Never calls self.selector.variety_tracker.add_workout(workout.id)

    workout_dict = workout.model_dump()
    # ... rest of processing
```

**Impact:**
- ✅ First workout selection: Variety tracker is empty, all workouts get +5 bonus
- ❌ Second workout selection: Variety tracker still empty (never updated)
- ❌ Third+ selections: Still empty, same workouts can repeat
- ❌ Same workout can appear multiple times in same week
- ❌ Same workout can appear every week

---

## 📋 Requirements Analysis

### User Requirements
1. **Same Week:** Don't repeat the same workout in the same week
2. **4-Week Period:** No more than twice in a 4-week period

### Current Gap Analysis

| Requirement | Current Implementation | Status |
|-------------|----------------------|---------|
| No repeat in same week | Only 5-point penalty (can still be selected) | ❌ NOT ENFORCED |
| Max 2x in 4 weeks | Only tracks last 15 workouts globally | ⚠️ PARTIALLY WORKS |
| Variety across weeks | Variety tracker exists but never updated | ❌ NOT WORKING |

---

## 🔧 Required Fixes

### Fix 1: Update Variety Tracker After Each Selection

**Location:** `src/cycling_ai/orchestration/phases/training_planning_library.py:340-394`

```python
# BEFORE (current)
workout = self.selector.select_workout(...)

if workout is None:
    raise RuntimeError(...)

# Convert to dict
workout_dict = workout.model_dump()
```

```python
# AFTER (fixed)
workout = self.selector.select_workout(...)

if workout is None:
    raise RuntimeError(...)

# ✅ ADD: Update variety tracker immediately after selection
self.selector.variety_tracker.add_workout(workout.id)

# Convert to dict
workout_dict = workout.model_dump()
```

**Why This Works:**
- Each workout selection updates the tracker
- Next workout in same week sees previous workouts in variety_history
- Workouts used in same week get -5 points (but can still be selected if score is high)

---

### Fix 2: Add Hard Constraint for Same-Week Duplicates

**Location:** `src/cycling_ai/core/workout_library/selector.py:350-418`

Add a new parameter `exclude_ids` to `select_workout()`:

```python
def select_workout(
    self,
    target_type: str,
    target_phase: str,
    target_weekday: str,
    target_duration_min: float,
    min_duration_min: float | None = None,
    max_duration_min: float | None = None,
    temperature: float = 0.5,
    seed: int | None = None,
    exclude_ids: list[str] | None = None,  # ✅ NEW PARAMETER
) -> Workout | None:
    """Select best-matching workout from library."""

    # Filter candidates by phase (mandatory)
    candidates = [
        w
        for w in self.library.workouts
        if w.suitable_phases and target_phase in w.suitable_phases
    ]

    # ✅ NEW: Filter out excluded workout IDs (hard constraint)
    if exclude_ids:
        candidates = [w for w in candidates if w.id not in exclude_ids]

    if not candidates:
        logger.warning(f"No workouts found for phase={target_phase}")
        return None

    # ... rest of method unchanged
```

---

### Fix 3: Track Same-Week Workouts in Planning Phase

**Location:** `src/cycling_ai/orchestration/phases/training_planning_library.py:308-434`

```python
def _select_and_scale_workouts(
    self,
    week: dict[str, Any]
) -> list[dict[str, Any]]:
    """Select workouts and scale weekends to hit time target."""
    target_hours = week["total_hours"]

    weekday_workouts = []
    weekend_workouts = []
    weekend_endurance_workouts = []

    # ✅ NEW: Track workout IDs used in THIS WEEK
    current_week_workout_ids: list[str] = []

    # Select all workouts
    for day in week["training_days"]:
        if day["workout_type"] == "rest":
            continue

        is_weekend = day["weekday"] in ["Saturday", "Sunday"]

        workout = self.selector.select_workout(
            target_type=day["workout_type"],
            target_phase=week["phase"],
            target_weekday=day["weekday"],
            target_duration_min=90 if is_weekend else 60,
            min_duration_min=90 if is_weekend else 45,
            max_duration_min=100 if is_weekend else 75,
            temperature=self.temperature,
            exclude_ids=current_week_workout_ids,  # ✅ NEW: Exclude already used in this week
        )

        if workout is None:
            raise RuntimeError(
                f"No matching workout found for week {week.get('week_number')}, "
                f"day {day['weekday']}, type {day['workout_type']}, phase {week['phase']}"
            )

        # ✅ NEW: Update trackers immediately after selection
        self.selector.variety_tracker.add_workout(workout.id)
        current_week_workout_ids.append(workout.id)

        # Convert to dict
        workout_dict = workout.model_dump()
        # ... rest unchanged
```

---

## 📊 How Fixes Enforce Requirements

### Requirement 1: No Repeat in Same Week
**Enforcement:** Hard constraint via `exclude_ids` parameter
- Week 1, Day 1: Select "Base Builder" → Add to `current_week_workout_ids`
- Week 1, Day 2: "Base Builder" in `exclude_ids` → CANNOT be selected
- Week 1, Day 3: "Base Builder" still excluded → CANNOT be selected

**Result:** ✅ GUARANTEED no duplicates within same week

---

### Requirement 2: Max 2x in 4 Weeks
**Enforcement:** Soft constraint via variety_tracker + scoring

**Scenario:**
- Week 1, Tue: "Sweet Spot Intervals" selected → Added to variety_tracker (position 1)
- Week 2, Wed: "Sweet Spot Intervals" considered → In variety_history → Score penalty -5 points
- Week 3, Thu: "Sweet Spot Intervals" still in tracker (position 8/15) → Score penalty -5 points
- Week 4, Tue: "Sweet Spot Intervals" still in tracker (position 15/15) → Score penalty -5 points
- Week 5: "Sweet Spot Intervals" rolls out of tracker (beyond 15) → No penalty, can be selected again

**Window Size Math:**
- 15 workouts ÷ 5 workouts/week = 3 weeks exact
- After 3 weeks, workout rolls out of tracker
- In practice: Workout can appear at most 1-2 times in 3-week window

**Adjustment Needed for 4-Week Requirement:**
```python
# Change window size from 15 to 20 workouts
self.variety_tracker = VarietyTracker(window_size=20)

# Math: 20 workouts ÷ 5 workouts/week = 4 weeks
```

**Result:** ⚠️ SOFT ENFORCEMENT (score penalty, not hard block)

---

## 🎯 Recommended Implementation

### Option A: Soft Enforcement (Current + Fixes 1-3)
**Pros:**
- Flexible - allows repeats if no better alternatives exist
- Good for smaller libraries
- Gradual degradation when variety is limited

**Cons:**
- Doesn't guarantee max 2x in 4 weeks
- User requirement says "no more than twice" (sounds like hard requirement)

---

### Option B: Hard Enforcement with Frequency Tracking
Add a new tracker for 4-week frequency limits:

```python
class FrequencyTracker:
    """Tracks workout frequency over rolling 4-week period."""

    def __init__(self, window_weeks: int = 4, workouts_per_week: int = 5) -> None:
        self.window_size = window_weeks * workouts_per_week
        self._workout_history: deque[str] = deque(maxlen=self.window_size)
        self._frequency_counts: dict[str, int] = {}

    def add_workout(self, workout_id: str) -> None:
        """Add workout and update frequency counts."""
        # Remove oldest if at capacity
        if len(self._workout_history) == self.window_size:
            oldest = self._workout_history[0]
            self._frequency_counts[oldest] = max(0, self._frequency_counts.get(oldest, 0) - 1)

        # Add new workout
        self._workout_history.append(workout_id)
        self._frequency_counts[workout_id] = self._frequency_counts.get(workout_id, 0) + 1

    def get_frequency(self, workout_id: str) -> int:
        """Get how many times workout was used in window."""
        return self._frequency_counts.get(workout_id, 0)

    def is_at_limit(self, workout_id: str, max_frequency: int = 2) -> bool:
        """Check if workout has reached frequency limit."""
        return self.get_frequency(workout_id) >= max_frequency
```

**Usage in select_workout():**
```python
# Filter out workouts at frequency limit
candidates = [
    w for w in candidates
    if not self.frequency_tracker.is_at_limit(w.id, max_frequency=2)
]
```

**Pros:**
- ✅ GUARANTEES no more than 2x in 4 weeks
- Clear enforcement of user requirement
- Explicit frequency tracking

**Cons:**
- More complex implementation
- Could fail if library doesn't have enough variety
- Need fallback logic if no candidates remain

---

## 📝 Summary

### Current State
1. ✅ VarietyTracker exists with 15-workout rolling window
2. ✅ Scoring system gives +5 bonus for variety
3. ❌ Tracker never updated after selections
4. ❌ Same workout can repeat in same week
5. ⚠️ Soft enforcement of 4-week limit (not guaranteed)

### Required Changes
1. **CRITICAL:** Update variety_tracker after each selection (Fix 1)
2. **REQUIRED:** Add `exclude_ids` parameter for same-week hard constraint (Fix 2)
3. **REQUIRED:** Track current week IDs and pass to selector (Fix 3)
4. **OPTIONAL:** Increase window size from 15 to 20 for full 4-week coverage
5. **RECOMMENDED:** Implement FrequencyTracker for hard 2x/4-week enforcement (Option B)

### Testing Strategy
```python
def test_no_repeats_in_same_week():
    """Verify same workout cannot appear twice in same week."""
    selector = WorkoutSelector(library)
    week_ids = []

    for day in range(5):  # 5 training days
        workout = selector.select_workout(
            target_type="endurance",
            target_phase="Base",
            target_weekday="Monday",
            target_duration_min=60,
            exclude_ids=week_ids,
        )
        assert workout.id not in week_ids, f"Duplicate workout {workout.id} in same week!"
        week_ids.append(workout.id)
        selector.variety_tracker.add_workout(workout.id)

def test_max_2x_in_4_weeks():
    """Verify workout appears at most 2x in 4-week period."""
    selector = WorkoutSelector(library)
    frequency_tracker = FrequencyTracker(window_weeks=4)

    for week in range(4):
        for day in range(5):
            workout = selector.select_workout(...)
            frequency_tracker.add_workout(workout.id)
            assert frequency_tracker.get_frequency(workout.id) <= 2, \
                f"Workout {workout.id} exceeded 2x limit in 4 weeks!"
```

---

## 🚀 Next Steps

1. Implement Fix 1 (update variety_tracker) - **CRITICAL**
2. Implement Fix 2 (exclude_ids parameter) - **REQUIRED**
3. Implement Fix 3 (track current week IDs) - **REQUIRED**
4. Decide on Option A vs Option B for 4-week enforcement
5. Add comprehensive tests
6. Update documentation

**Priority:** HIGH - Current implementation does NOT prevent duplicates as user expects
