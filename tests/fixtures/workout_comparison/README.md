# Workout Comparison Test Fixtures

## Overview

Test data for workout comparison unit tests. These fixtures provide realistic training plan and activity data for testing compliance scoring, pattern detection, and workout matching algorithms.

## Files

### Training Plan
- **`sample_training_plan.json`** - 2-week training plan with varied workouts
  - Week 1: Monday (endurance 80min), Wednesday (threshold 75min), Saturday (long endurance 150min)
  - Week 2: Monday (recovery 45min), Wednesday (tempo 90min)
  - Total of 5 planned workouts across 2 weeks

### Activities (CSV)

All activity files follow the standard Strava CSV export format with power zone distribution:

- **`sample_activities_perfect.csv`** - Perfect compliance scenario
  - All 5 workouts completed
  - Correct dates matching training plan
  - Zone distributions match planned segments
  - TSS within ±5% of planned
  - Expected compliance scores: 95-100%

- **`sample_activities_partial.csv`** - Partial compliance scenario
  - All 5 workouts completed but modified
  - Monday week 1: 10% shorter duration (72min vs 80min)
  - Wednesday week 1: Lower intensity (Z3 instead of Z4 for intervals)
  - Saturday week 1: 20% shorter duration (120min vs 150min)
  - Monday week 2: Perfect execution
  - Wednesday week 2: Lower intensity (Z3 instead of Z3/Z4 mix)
  - Expected compliance scores: 70-85%

- **`sample_activities_skipped.csv`** - Skipped workouts scenario
  - Only 2 of 5 workouts completed
  - Completed: Monday week 1, Saturday week 1
  - Skipped: Wednesday week 1, Monday week 2, Wednesday week 2
  - Expected compliance: 40% completion rate
  - Pattern: Skipped all hard workouts (threshold and tempo)

### Athlete Profile
- **`sample_athlete_profile.json`** - Test athlete data
  - FTP: 265w
  - Max HR: 186 bpm
  - Weight: 70kg
  - Goal: Improve FTP to 280w

## Zone Mapping

Power zones used in fixtures (% of FTP = 265w):

| Zone | Power Range (%) | Power Range (watts) | Minutes in Endurance | Minutes in Threshold |
|------|-----------------|---------------------|---------------------|---------------------|
| Z1   | 0-55%          | 0-145w              | 20min warmup/cool   | 30min warmup/cool   |
| Z2   | 56-75%         | 148-199w            | 60min steady        | 5min between        |
| Z3   | 76-90%         | 201-238w            | 0min                | 0min (or deviation) |
| Z4   | 91-105%        | 241-278w            | 0min                | 30min intervals     |
| Z5   | 106%+          | 280w+               | 0min                | 10min peaks         |

## TSS Calculations

TSS (Training Stress Score) for each planned workout:

- Monday week 1 (80min endurance): 65 TSS
- Wednesday week 1 (75min threshold): 85 TSS
- Saturday week 1 (150min endurance): 105 TSS
- Monday week 2 (45min recovery): 25 TSS
- Wednesday week 2 (90min tempo): 70 TSS

Total planned TSS over 2 weeks: 350

## Usage in Tests

```python
import pytest
from pathlib import Path
import json
import pandas as pd

@pytest.fixture
def fixtures_dir():
    """Return path to workout comparison fixtures directory."""
    return Path(__file__).parent / "fixtures" / "workout_comparison"

@pytest.fixture
def sample_plan_path(fixtures_dir):
    """Return path to sample training plan."""
    return fixtures_dir / "sample_training_plan.json"

@pytest.fixture
def sample_plan(sample_plan_path):
    """Load sample training plan."""
    with open(sample_plan_path) as f:
        return json.load(f)

@pytest.fixture
def perfect_activities_path(fixtures_dir):
    """Return path to perfect compliance activities."""
    return fixtures_dir / "sample_activities_perfect.csv"

@pytest.fixture
def perfect_activities(perfect_activities_path):
    """Load perfect compliance activities as DataFrame."""
    return pd.read_csv(perfect_activities_path)

@pytest.fixture
def athlete_profile_path(fixtures_dir):
    """Return path to athlete profile."""
    return fixtures_dir / "sample_athlete_profile.json"

@pytest.fixture
def athlete_profile(athlete_profile_path):
    """Load athlete profile."""
    with open(athlete_profile_path) as f:
        return json.load(f)
```

## Validation

All fixtures have been validated:

- JSON files parse correctly with `json.tool`
- CSV files load into pandas DataFrames
- Dates are consistent (Monday 2024-11-04 is correct weekday)
- Zone distributions sum to total workout duration
- TSS calculations align with power zones and duration

## Notes

- Dates are in November 2024 for consistency
- All workouts use realistic power values based on FTP of 265w
- Zone distributions reflect typical workout structures
- TSS values calculated using standard TSS formula: `(duration * NP * IF) / (FTP * 3600) * 100`
- Perfect compliance scenario designed for 95-100% scores
- Partial compliance designed for 70-85% scores
- Skipped workouts scenario designed to test pattern detection (skipped hard workouts)
