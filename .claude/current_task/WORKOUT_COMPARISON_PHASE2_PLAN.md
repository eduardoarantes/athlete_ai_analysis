# Workout Comparison - Phase 2: Tool Wrappers Implementation Plan

**Created:** 2025-11-01
**Status:** Ready for Implementation
**Estimated Effort:** Day 3 (8 hours)
**Architect:** Claude Code - Task Implementation Preparation Architect

---

## Executive Summary

Phase 2 implements MCP-style tool wrappers that expose Phase 1's core business logic (`WorkoutComparer`) to LLM agents. This phase creates two tools: `CompareWorkoutTool` (daily comparison) and `CompareWeeklyWorkoutsTool` (weekly comparison), both auto-discoverable via `@register_tool` decorator.

**Phase 1 Status:** ✅ COMPLETE with 100% success
- Core business logic fully implemented in `workout_comparison.py` (1327 lines)
- Public API: `WorkoutComparer.compare_daily_workout()` and `compare_weekly_workouts()`
- Comprehensive data models and test fixtures validated
- Type-safe (mypy --strict compliant)

**Phase 2 Goal:** Create production-ready tool wrappers with comprehensive error handling, JSON serialization, and integration tests following TDD approach.

---

## Table of Contents

1. [Architecture Context](#architecture-context)
2. [Tool Specifications](#tool-specifications)
3. [Implementation Steps (TDD)](#implementation-steps-tdd)
4. [Test Strategy](#test-strategy)
5. [Success Criteria](#success-criteria)
6. [Risk Mitigation](#risk-mitigation)

---

## Architecture Context

### Phase 1 Achievement (COMPLETE ✅)

**File:** `src/cycling_ai/core/workout_comparison.py`

**Public API:**
```python
class WorkoutComparer:
    def __init__(self, plan_path: Path, activities_path: Path, ftp: int)
    def compare_daily_workout(self, date: str) -> WorkoutComparison | None
    def compare_weekly_workouts(self, week_start: str) -> WeeklyComparison
```

**Data Models:**
- `PlannedWorkout` - Planned workout from training plan JSON
- `ActualWorkout` - Actual workout from CSV/Parquet
- `ComplianceMetrics` - Weighted compliance scoring (0-100)
- `WorkoutComparison` - Single day comparison result
- `WeeklyPattern` - Identified adherence patterns
- `WeeklyComparison` - Aggregated weekly results

**Test Fixtures:**
- `sample_training_plan.json` - 2-week plan with 5 workouts
- `sample_athlete_profile.json` - Test athlete (FTP 265w)
- CSV fixtures needed for Phase 2 (see Test Strategy)

### Phase 2 Scope (THIS PHASE)

**File to Create:** `src/cycling_ai/tools/wrappers/workout_comparison_tool.py`
**Test File:** `tests/tools/wrappers/test_workout_comparison_tool.py`

**Pattern to Follow:** `training_plan_tool.py` (existing reference)
- Inherit from `BaseTool`
- Implement `@property def definition() -> ToolDefinition`
- Implement `execute(**kwargs) -> ToolExecutionResult`
- Auto-register with `register_tool()` decorator
- Category: "analysis"

---

## Tool Specifications

### Tool 1: CompareWorkoutTool

**Purpose:** Compare single day's planned vs actual workout

**Tool Definition:**
```python
ToolDefinition(
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
    returns={
        "type": "object",
        "format": "json",
        "description": "WorkoutComparison with compliance metrics, deviations, and recommendation"
    },
    version="1.0.0"
)
```

**JSON Output Format:**
```json
{
  "date": "2024-11-04",
  "planned": {
    "weekday": "Monday",
    "type": "endurance",
    "duration_minutes": 80,
    "tss": 65,
    "zone_distribution": {"Z1": 20, "Z2": 60},
    "target_avg_power_pct": 67.5
  },
  "actual": {
    "completed": true,
    "activity_name": "Morning Ride",
    "duration_minutes": 75,
    "tss": 62,
    "zone_distribution": {"Z1": 18, "Z2": 55, "Z3": 2}
  },
  "compliance": {
    "completed": true,
    "compliance_score": 88.5,
    "completion_score": 100.0,
    "duration_score": 93.8,
    "intensity_score": 92.5,
    "tss_score": 95.4,
    "duration_compliance_pct": 93.8,
    "tss_compliance_pct": 95.4
  },
  "deviations": [
    "Duration 6% shorter than planned (75 min vs 80 min planned)"
  ],
  "recommendation": "Good compliance (89%) despite modifications..."
}
```

### Tool 2: CompareWeeklyWorkoutsTool

**Purpose:** Compare entire week of planned vs actual workouts

**Tool Definition:**
```python
ToolDefinition(
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
    returns={
        "type": "object",
        "format": "json",
        "description": "WeeklyComparison with aggregated metrics and patterns"
    },
    version="1.0.0"
)
```

**JSON Output Format:**
```json
{
  "week_number": 1,
  "week_start_date": "2024-11-04",
  "week_end_date": "2024-11-10",
  "summary": {
    "workouts_planned": 3,
    "workouts_completed": 3,
    "completion_rate_pct": 100.0,
    "avg_compliance_score": 88.5
  },
  "daily_comparisons": [...],
  "patterns": [...],
  "weekly_recommendation": "Good week with 100% completion rate..."
}
```

---

## Implementation Steps (TDD)

### Step 1: Create Test File Structure (30 min)

**Create:** `tests/tools/wrappers/test_workout_comparison_tool.py`

**Add Fixtures:**
```python
import pytest
from pathlib import Path

@pytest.fixture
def fixtures_dir():
    """Return path to workout comparison fixtures directory."""
    return Path(__file__).parent.parent / "fixtures" / "workout_comparison"

@pytest.fixture
def sample_plan_path(fixtures_dir):
    """Return path to sample training plan."""
    return fixtures_dir / "sample_training_plan.json"

@pytest.fixture
def perfect_activities_path(fixtures_dir):
    """Return path to perfect compliance activities."""
    return fixtures_dir / "sample_activities_perfect.csv"

@pytest.fixture
def athlete_profile_path(fixtures_dir):
    """Return path to athlete profile."""
    return fixtures_dir / "sample_athlete_profile.json"
```

**Write First Test:**
```python
def test_compare_workout_tool_definition():
    """Test that CompareWorkoutTool has correct definition."""
    from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

    tool = CompareWorkoutTool()

    assert tool.definition.name == "compare_workout"
    assert tool.definition.category == "analysis"
    assert len(tool.definition.parameters) == 4
    assert tool.definition.parameters[0].name == "date"
    assert tool.definition.parameters[0].required is True
```

**Run Test:** Should fail (module doesn't exist yet)

---

### Step 2: Implement CompareWorkoutTool Skeleton (30 min)

**Create:** `src/cycling_ai/tools/wrappers/workout_comparison_tool.py`

```python
"""
Workout comparison tool wrappers.

Provides MCP-style tools for comparing planned training workouts
against actual executed workouts, exposing core business logic
to LLM agents.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.workout_comparison import WorkoutComparer
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool

logger = logging.getLogger(__name__)


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
            returns={
                "type": "object",
                "format": "json",
                "description": "WorkoutComparison with compliance metrics, deviations, and recommendation"
            },
            version="1.0.0"
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute workout comparison.

        Returns:
            ToolExecutionResult with WorkoutComparison as JSON
        """
        # Implementation in next step
        pass


# Register tool
register_tool(CompareWorkoutTool())
```

**Run Test:** Should now pass `test_compare_workout_tool_definition()`

---

### Step 3: Create CSV Test Fixtures (45 min)

**Create:** `tests/fixtures/workout_comparison/sample_activities_perfect.csv`

Perfect compliance with all 5 planned workouts from sample_training_plan.json:

```csv
Activity Date,Activity Name,Activity Type,Moving Time,Distance,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
2024-11-04,Morning Endurance Ride,Ride,80,45.2,178,180,65,20,60,0,0,0
2024-11-06,Threshold Intervals,Virtual Ride,75,0,252,258,85,30,5,0,30,10
2024-11-09,Long Weekend Ride,Ride,150,95.5,180,185,105,30,120,0,0,0
2024-11-11,Recovery Spin,Ride,45,20.3,135,138,25,0,45,0,0,0
2024-11-13,Tempo Intervals,Virtual Ride,90,0,235,240,70,30,5,35,20,0
```

**Create:** `tests/fixtures/workout_comparison/sample_activities_partial.csv`

Partial compliance - workouts completed but modified:

```csv
Activity Date,Activity Name,Activity Type,Moving Time,Distance,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
2024-11-04,Morning Ride - Cut Short,Ride,72,40.5,175,178,62,18,52,2,0,0
2024-11-06,Threshold - Lower Intensity,Virtual Ride,75,0,230,235,72,30,5,25,15,0
2024-11-09,Long Ride - Cut Short,Ride,120,76.2,178,182,88,25,95,0,0,0
2024-11-11,Recovery Ride,Ride,45,20.3,135,138,25,0,45,0,0,0
2024-11-13,Tempo - Lower Intensity,Virtual Ride,90,0,220,225,62,30,5,45,10,0
```

**Create:** `tests/fixtures/workout_comparison/sample_activities_skipped.csv`

Skipped hard workouts (only 2 of 5 completed):

```csv
Activity Date,Activity Name,Activity Type,Moving Time,Distance,Average Power,Normalized Power,TSS,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes
2024-11-04,Morning Endurance Ride,Ride,80,45.2,178,180,65,20,60,0,0,0
2024-11-09,Long Weekend Ride,Ride,150,95.5,180,185,105,30,120,0,0,0
```

**Update README:** `tests/fixtures/workout_comparison/README.md` with CSV descriptions

---

### Step 4: Implement execute() - Happy Path (1 hour)

**Write Test:**
```python
def test_execute_with_perfect_compliance(
    sample_plan_path,
    perfect_activities_path,
    athlete_profile_path
):
    """Test tool execution with perfect compliance."""
    from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

    tool = CompareWorkoutTool()

    result = tool.execute(
        date="2024-11-04",
        training_plan_path=str(sample_plan_path),
        activities_csv_path=str(perfect_activities_path),
        athlete_profile_path=str(athlete_profile_path),
    )

    assert result.success
    assert result.format == "json"
    assert result.data is not None

    # Validate JSON structure
    data = result.data
    assert "compliance" in data
    assert "planned" in data
    assert "actual" in data
    assert "deviations" in data
    assert "recommendation" in data

    # Validate compliance scores
    assert data["compliance"]["compliance_score"] >= 95.0
    assert data["compliance"]["completed"] is True
```

**Implement execute():**
```python
def execute(
    self,
    date: str,
    training_plan_path: str,
    activities_csv_path: str,
    athlete_profile_path: str,
) -> ToolExecutionResult:
    """Execute workout comparison."""
    try:
        logger.info(f"[COMPARE WORKOUT TOOL] Comparing workout for date: {date}")

        # 1. Validate inputs (file existence)
        plan_path = Path(training_plan_path)
        csv_path = Path(activities_csv_path)
        profile_path = Path(athlete_profile_path)

        # 2. Load athlete profile
        profile = load_athlete_profile(profile_path)
        logger.debug(f"[COMPARE WORKOUT TOOL] Loaded profile, FTP: {profile.ftp}")

        # 3. Initialize WorkoutComparer
        comparer = WorkoutComparer(
            plan_path=plan_path,
            activities_path=csv_path,
            ftp=profile.ftp,
        )

        # 4. Execute comparison
        comparison = comparer.compare_daily_workout(date)

        if comparison is None:
            return ToolExecutionResult(
                success=True,
                data={"message": f"No workout planned for {date}"},
                format="json",
                metadata={"date": date},
            )

        # 5. Serialize to JSON
        result_data = {
            "date": comparison.date.strftime("%Y-%m-%d"),
            "planned": {
                "weekday": comparison.planned.weekday,
                "type": comparison.planned.workout_type,
                "duration_minutes": comparison.planned.total_duration_minutes,
                "tss": comparison.planned.planned_tss,
                "zone_distribution": comparison.planned.zone_distribution,
                "target_avg_power_pct": comparison.planned.target_avg_power_pct,
            },
            "actual": None,
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

        # Add actual workout data if completed
        if comparison.actual:
            result_data["actual"] = {
                "completed": True,
                "activity_name": comparison.actual.activity_name,
                "activity_type": comparison.actual.activity_type,
                "duration_minutes": comparison.actual.duration_minutes,
                "tss": comparison.actual.actual_tss,
                "zone_distribution": comparison.actual.zone_distribution,
                "average_power": comparison.actual.average_power,
                "normalized_power": comparison.actual.normalized_power,
            }

        return ToolExecutionResult(
            success=True,
            data=result_data,
            format="json",
            metadata={
                "date": date,
                "compliance_score": comparison.metrics.compliance_score,
                "completed": comparison.metrics.completed,
            },
        )

    except Exception as e:
        logger.error(f"[COMPARE WORKOUT TOOL] Error: {str(e)}", exc_info=True)
        return ToolExecutionResult(
            success=False,
            data=None,
            format="json",
            errors=[f"Unexpected error during execution: {str(e)}"],
        )
```

**Run Test:** Should pass

---

### Step 5: Implement Error Handling (1 hour)

**Write Tests:**
```python
def test_execute_with_missing_plan(athlete_profile_path):
    """Test tool handles missing training plan gracefully."""
    tool = CompareWorkoutTool()

    result = tool.execute(
        date="2024-11-04",
        training_plan_path="/nonexistent/plan.json",
        activities_csv_path="/nonexistent/activities.csv",
        athlete_profile_path=str(athlete_profile_path),
    )

    assert not result.success
    assert result.format == "json"
    assert len(result.errors) > 0
    assert "not found" in result.errors[0].lower()

def test_execute_with_invalid_date():
    """Test tool handles invalid date format."""
    tool = CompareWorkoutTool()

    result = tool.execute(
        date="invalid-date",
        training_plan_path="/tmp/plan.json",
        activities_csv_path="/tmp/activities.csv",
        athlete_profile_path="/tmp/profile.json",
    )

    assert not result.success
    assert "invalid date format" in result.errors[0].lower()
```

**Enhance execute() with error handling:**
```python
def execute(self, **kwargs: Any) -> ToolExecutionResult:
    """Execute workout comparison."""
    try:
        # Validate parameters against tool definition
        self.validate_parameters(**kwargs)

        # Extract parameters
        date = kwargs["date"]
        training_plan_path = kwargs["training_plan_path"]
        activities_csv_path = kwargs["activities_csv_path"]
        athlete_profile_path = kwargs["athlete_profile_path"]

        # Validate file paths
        plan_path = Path(training_plan_path)
        if not plan_path.exists():
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Training plan not found: {training_plan_path}"],
            )

        csv_path = Path(activities_csv_path)
        if not csv_path.exists():
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Activities file not found: {activities_csv_path}"],
            )

        profile_path = Path(athlete_profile_path)
        if not profile_path.exists():
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Athlete profile not found: {athlete_profile_path}"],
            )

        # Validate date format
        try:
            parsed_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Invalid date format: {date}. Use YYYY-MM-DD"],
            )

        # ... rest of implementation ...

    except ValueError as e:
        # Parameter validation errors
        return ToolExecutionResult(
            success=False,
            data=None,
            format="json",
            errors=[f"Parameter validation error: {str(e)}"],
        )
    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(f"[COMPARE WORKOUT TOOL] Unexpected error: {str(e)}", exc_info=True)
        return ToolExecutionResult(
            success=False,
            data=None,
            format="json",
            errors=[f"Unexpected error during execution: {str(e)}"],
        )
```

**Run Tests:** All error handling tests should pass

---

### Step 6: Test Edge Cases (45 min)

**Write Additional Tests:**
```python
def test_execute_with_no_workout_on_date(
    sample_plan_path,
    perfect_activities_path,
    athlete_profile_path
):
    """Test when no workout planned for requested date."""
    tool = CompareWorkoutTool()

    result = tool.execute(
        date="2024-11-05",  # Tuesday - no workout planned
        training_plan_path=str(sample_plan_path),
        activities_csv_path=str(perfect_activities_path),
        athlete_profile_path=str(athlete_profile_path),
    )

    assert result.success
    assert "message" in result.data
    assert "No workout planned" in result.data["message"]

def test_execute_with_partial_compliance(
    sample_plan_path,
    partial_activities_path,
    athlete_profile_path
):
    """Test with partial compliance activities."""
    tool = CompareWorkoutTool()

    result = tool.execute(
        date="2024-11-04",
        training_plan_path=str(sample_plan_path),
        activities_csv_path=str(partial_activities_path),
        athlete_profile_path=str(athlete_profile_path),
    )

    assert result.success
    data = result.data
    assert 70 <= data["compliance"]["compliance_score"] <= 85
    assert len(data["deviations"]) > 0
```

**Run Tests:** All should pass

---

### Step 7: Implement CompareWeeklyWorkoutsTool (2 hours)

**Write Test:**
```python
def test_weekly_tool_definition():
    """Test CompareWeeklyWorkoutsTool has correct definition."""
    from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWeeklyWorkoutsTool

    tool = CompareWeeklyWorkoutsTool()

    assert tool.definition.name == "compare_weekly_workouts"
    assert tool.definition.category == "analysis"
    assert len(tool.definition.parameters) == 4

def test_weekly_execute_with_perfect_week(
    sample_plan_path,
    perfect_activities_path,
    athlete_profile_path
):
    """Test weekly tool with perfect compliance."""
    tool = CompareWeeklyWorkoutsTool()

    result = tool.execute(
        week_start_date="2024-11-04",
        training_plan_path=str(sample_plan_path),
        activities_csv_path=str(perfect_activities_path),
        athlete_profile_path=str(athlete_profile_path),
    )

    assert result.success
    data = result.data
    assert data["summary"]["workouts_planned"] == 3
    assert data["summary"]["workouts_completed"] == 3
    assert data["summary"]["completion_rate_pct"] == 100.0
```

**Implement CompareWeeklyWorkoutsTool:**
```python
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
            returns={
                "type": "object",
                "format": "json",
                "description": "WeeklyComparison with aggregated metrics and patterns"
            },
            version="1.0.0"
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """Execute weekly comparison."""
        # Similar structure to daily comparison
        # Calls comparer.compare_weekly_workouts()
        # Serializes WeeklyComparison to JSON
        # (Implementation follows same pattern as daily tool)
```

**Run Tests:** Should pass

---

### Step 8: Tool Registration & Integration (30 min)

**Add at module level:**
```python
# Register tools
register_tool(CompareWorkoutTool())
register_tool(CompareWeeklyWorkoutsTool())
```

**Write Test:**
```python
def test_tool_registration():
    """Test that tools are auto-registered with ToolRegistry."""
    from cycling_ai.tools.registry import ToolRegistry

    registry = ToolRegistry()
    tools = registry.get_tools_by_category("analysis")

    tool_names = [tool.definition.name for tool in tools]
    assert "compare_workout" in tool_names
    assert "compare_weekly_workouts" in tool_names
```

**Run Test:** Should pass

---

### Step 9: JSON Output Validation (30 min)

**Write Tests:**
```python
def test_json_output_format_daily(
    sample_plan_path,
    perfect_activities_path,
    athlete_profile_path
):
    """Test JSON output has all expected keys."""
    tool = CompareWorkoutTool()

    result = tool.execute(
        date="2024-11-04",
        training_plan_path=str(sample_plan_path),
        activities_csv_path=str(perfect_activities_path),
        athlete_profile_path=str(athlete_profile_path),
    )

    data = result.data

    # Required top-level keys
    assert "date" in data
    assert "planned" in data
    assert "actual" in data
    assert "compliance" in data
    assert "deviations" in data
    assert "recommendation" in data

    # Planned keys
    assert "weekday" in data["planned"]
    assert "type" in data["planned"]
    assert "duration_minutes" in data["planned"]

    # Compliance keys
    assert "compliance_score" in data["compliance"]
    assert "completed" in data["compliance"]
```

**Run Tests:** Should pass

---

### Step 10: Full Test Suite & Documentation (1 hour)

**Run Full Test Suite:**
```bash
pytest tests/tools/wrappers/test_workout_comparison_tool.py -v
pytest --cov=src/cycling_ai/tools/wrappers/workout_comparison_tool.py
```

**Target:** 95%+ coverage

**Add Comprehensive Docstrings:**
- Module-level docstring explaining architecture
- Class docstrings for both tools
- Method docstrings for execute() methods
- Inline comments for complex logic

**Update README:**
- Add CSV fixtures documentation
- Explain perfect/partial/skipped scenarios
- Document expected compliance scores

---

## Test Strategy

### Test File Organization

```python
tests/tools/wrappers/test_workout_comparison_tool.py

├── Fixtures (15+ tests total)
│   ├── fixtures_dir()
│   ├── sample_plan_path()
│   ├── perfect_activities_path()
│   ├── partial_activities_path()
│   ├── skipped_activities_path()
│   └── athlete_profile_path()
│
├── TestCompareWorkoutTool
│   ├── test_tool_definition()
│   ├── test_execute_with_perfect_compliance()
│   ├── test_execute_with_partial_compliance()
│   ├── test_execute_with_skipped_workout()
│   ├── test_execute_with_missing_plan()
│   ├── test_execute_with_missing_csv()
│   ├── test_execute_with_missing_profile()
│   ├── test_execute_with_invalid_date()
│   ├── test_execute_with_no_workout_on_date()
│   └── test_json_output_format_daily()
│
├── TestCompareWeeklyWorkoutsTool
│   ├── test_weekly_tool_definition()
│   ├── test_weekly_execute_with_perfect_week()
│   ├── test_weekly_execute_with_partial_compliance()
│   ├── test_weekly_execute_with_skipped_workouts()
│   ├── test_weekly_pattern_detection()
│   └── test_json_output_format_weekly()
│
└── TestToolRegistration
    └── test_tool_registration()
```

### Test Data Validation

All CSV fixtures validated with:
- Correct column names (Activity Date, Moving Time, zone1_minutes, etc.)
- Valid dates matching training plan
- Realistic zone distributions (sum to total duration)
- TSS values aligned with power zones
- All numeric fields parseable

---

## Success Criteria

### Code Quality ✅
- [ ] `mypy --strict` passes with zero errors
- [ ] All 15+ tests passing
- [ ] Code coverage ≥ 95% on tool wrappers
- [ ] `ruff check` passes with zero errors
- [ ] `ruff format` applied
- [ ] Comprehensive docstrings

### Functionality ✅
- [ ] Tools auto-discovered by ToolRegistry
- [ ] JSON output validated and well-structured
- [ ] Error handling robust with clear messages
- [ ] Both tools callable (manual verification)
- [ ] All test fixtures created and validated

### Integration ✅
- [ ] Follows existing pattern from training_plan_tool.py
- [ ] Compatible with Phase 1 core business logic
- [ ] Ready for Phase 3 LLM agent integration
- [ ] No regressions in existing tests

---

## Risk Mitigation

### Risk 1: Training Plan Format Mismatch
**Mitigation:** Phase 1 already handles plan parsing. WorkoutComparer raises ValueError with clear message if format doesn't match.

### Risk 2: Missing Zone Data in CSV
**Mitigation:** Phase 1 handles missing zones gracefully (zone_distribution defaults to empty dict). Compliance scoring falls back to duration/TSS only.

### Risk 3: CSV Parsing Errors
**Mitigation:** Wrap CSV loading in try/except. Return clear error message in ToolExecutionResult.

### Risk 4: JSON Serialization Errors
**Mitigation:** Test JSON serialization for all data types. All data models already serializable (simple types only).

---

## Deliverables Checklist

- [ ] `src/cycling_ai/tools/wrappers/workout_comparison_tool.py` - Complete implementation
- [ ] `tests/tools/wrappers/test_workout_comparison_tool.py` - All tests passing
- [ ] `tests/fixtures/workout_comparison/sample_activities_perfect.csv` - Created and validated
- [ ] `tests/fixtures/workout_comparison/sample_activities_partial.csv` - Created and validated
- [ ] `tests/fixtures/workout_comparison/sample_activities_skipped.csv` - Created and validated
- [ ] `tests/fixtures/workout_comparison/README.md` - Updated with CSV descriptions
- [ ] All tests passing (pytest)
- [ ] Type checking passing (mypy --strict)
- [ ] Code formatted (ruff format)
- [ ] Tools registered and discoverable

---

## Next Steps After Phase 2

**Phase 3: Prompts & Agent** (Day 4)
- Create specialized agent prompts in `prompts/default/1.0/`
- Integrate with PromptLoader
- Test agent with real LLM
- Iterate on prompt quality

---

## Appendix: Tool Registration Pattern

Tools use the `register_tool()` function for auto-discovery:

```python
# At end of module
register_tool(CompareWorkoutTool())
register_tool(CompareWeeklyWorkoutsTool())
```

This ensures tools are automatically available to:
- `ToolRegistry.get_tools_by_category("analysis")`
- LLM agents via AgentFactory
- CLI commands via tool discovery

**Pattern Rationale:**
- No manual registration needed
- Follows existing pattern from training_plan_tool.py
- Tools discoverable at module import time
- Simple and maintainable

---

**Status:** ✅ Plan Ready for Implementation
**Next Action:** Begin Step 1 - Create test file structure
**Estimated Completion:** Day 3 end (8 hours from start)

---

*This implementation plan provides a comprehensive TDD roadmap for Phase 2. Follow steps sequentially, run tests after each step, and maintain high code quality throughout.*
