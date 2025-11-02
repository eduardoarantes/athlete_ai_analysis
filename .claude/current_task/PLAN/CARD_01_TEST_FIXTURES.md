# CARD 01: Create Test Fixtures

**Estimated Time:** 2 hours
**Priority:** Critical (must be first)
**Dependencies:** None

---

## Objective

Create comprehensive test fixtures that will be used across all Phase 1 tests. These fixtures provide realistic data for testing workout comparison logic.

---

## Acceptance Criteria

- [ ] Sample training plan JSON created (2 weeks, varied workout types)
- [ ] Sample activities CSV - perfect compliance
- [ ] Sample activities CSV - partial compliance (shortened, wrong zones)
- [ ] Sample activities CSV - skipped workouts
- [ ] Sample athlete profile JSON
- [ ] All fixtures validated (valid JSON, valid CSV format)
- [ ] Fixtures documented with clear descriptions

---

## File Changes

### New Files

1. `tests/fixtures/workout_comparison/sample_training_plan.json`
2. `tests/fixtures/workout_comparison/sample_activities_perfect.csv`
3. `tests/fixtures/workout_comparison/sample_activities_partial.csv`
4. `tests/fixtures/workout_comparison/sample_activities_skipped.csv`
5. `tests/fixtures/workout_comparison/sample_athlete_profile.json`
6. `tests/fixtures/workout_comparison/README.md` (fixture documentation)

---

## Implementation Steps

### Step 1: Create Directory Structure

```bash
mkdir -p tests/fixtures/workout_comparison
```

### Step 2: Create Training Plan Fixture

**File:** `tests/fixtures/workout_comparison/sample_training_plan.json`

**Content Structure:**
- 2 weeks total
- Week 1: 3 workouts (Monday endurance, Wednesday threshold, Saturday long)
- Week 2: 1 workout (Monday recovery)
- Varied segment types: warmup, interval, steady, recovery, cooldown
- TSS calculated for each workout

**Key Features:**
- Different workout types for pattern testing
- Realistic segment durations and power zones
- Includes hard workouts (threshold) and easy workouts (recovery)

### Step 3: Create Perfect Compliance Activities

**File:** `tests/fixtures/workout_comparison/sample_activities_perfect.csv`

**Content:**
- Matches all planned workouts exactly
- Correct dates (2024-11-04, 2024-11-06, 2024-11-09, 2024-11-11)
- Zone distribution matches planned segments
- TSS within 5% of planned

**Columns:**
```
Activity Date,Activity Name,Activity Type,Distance,Moving Time,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
```

### Step 4: Create Partial Compliance Activities

**File:** `tests/fixtures/workout_comparison/sample_activities_partial.csv`

**Content:**
- All workouts completed but modified
- Monday: 10% shorter duration
- Wednesday: Lower intensity (Z3 instead of Z4 for intervals)
- Saturday: 20% shorter duration
- Monday week 2: Correct

### Step 5: Create Skipped Workouts Activities

**File:** `tests/fixtures/workout_comparison/sample_activities_skipped.csv`

**Content:**
- Monday week 1: Completed
- Wednesday week 1: SKIPPED (no entry)
- Saturday week 1: Completed
- Monday week 2: SKIPPED (no entry)

### Step 6: Create Athlete Profile

**File:** `tests/fixtures/workout_comparison/sample_athlete_profile.json`

```json
{
  "name": "Test Athlete",
  "age": 35,
  "weight": "70kg",
  "FTP": "265w",
  "critical_HR": 186,
  "gender": "male",
  "training_availability": {
    "hours_per_week": 8,
    "week_days": "Monday, Wednesday, Saturday, Sunday"
  },
  "goals": "Improve FTP to 280w",
  "current_training_status": "recreational"
}
```

### Step 7: Document Fixtures

**File:** `tests/fixtures/workout_comparison/README.md`

```markdown
# Workout Comparison Test Fixtures

## Overview

Test data for workout comparison unit tests.

## Files

### Training Plan
- `sample_training_plan.json` - 2-week plan with varied workouts

### Activities
- `sample_activities_perfect.csv` - Perfect compliance (100% scores)
- `sample_activities_partial.csv` - Partial compliance (70-85% scores)
- `sample_activities_skipped.csv` - Some workouts skipped (2/4 completed)

### Athlete
- `sample_athlete_profile.json` - Test athlete (FTP: 265w)

## Usage

```python
import pytest
from pathlib import Path

@pytest.fixture
def sample_plan_path():
    return Path(__file__).parent / "workout_comparison" / "sample_training_plan.json"
```
```

---

## Testing Strategy

**Manual Validation:**
1. Load each JSON file and validate it parses
2. Load each CSV file with pandas and validate columns
3. Check dates are consistent (Monday 2024-11-04 is correct weekday)
4. Verify TSS calculations match plan

**Automated Validation:**
```python
def test_fixtures_valid():
    """Test that all fixtures are valid and loadable."""
    # Verify training plan JSON is valid
    with open(sample_plan_path) as f:
        plan = json.load(f)
    assert plan["plan_metadata"]["total_weeks"] == 2
    assert len(plan["weekly_plan"]) == 2

    # Verify activities CSV is valid
    df = pd.read_csv(sample_activities_path)
    assert "Activity Date" in df.columns
    assert len(df) > 0
```

---

## Dependencies

**Python Packages:**
- `json` (stdlib)
- `csv` (stdlib)
- `pandas` (existing dependency)

**Existing Code:**
- `core/tss.py` - for TSS calculation validation

---

## Acceptance Testing

Run these checks before marking card complete:

```bash
# 1. Validate JSON files
python -m json.tool tests/fixtures/workout_comparison/sample_training_plan.json > /dev/null
python -m json.tool tests/fixtures/workout_comparison/sample_athlete_profile.json > /dev/null

# 2. Validate CSV files
python -c "import pandas as pd; df = pd.read_csv('tests/fixtures/workout_comparison/sample_activities_perfect.csv'); print(df.shape)"

# 3. Verify dates
python -c "from datetime import datetime; print(datetime(2024, 11, 4).strftime('%A'))"  # Should be "Monday"
```

Expected outputs:
- JSON validation: No errors
- CSV shape: (4, 13) for perfect, (3, 13) for partial, (2, 13) for skipped
- Date verification: "Monday"

---

## Notes

- Use realistic data based on existing cycling activities
- Ensure zone distributions align with power zones (Z1: 0-55%, Z2: 56-75%, Z3: 76-90%, Z4: 91-105%, Z5: 106%+)
- TSS calculations should match `core/tss.py` algorithms
- Dates should be in November 2024 for consistency

---

**Ready for Implementation:** YES
**Blocked:** NO
