# Phase 3: Tool Wrapper Detailed Specifications

**Version:** 1.0
**Date:** 2025-10-24

This document provides complete, implementation-ready specifications for all 5 tool wrappers in Phase 3.

---

## Table of Contents

1. [PerformanceAnalysisTool](#1-performanceanalysistool)
2. [ZoneAnalysisTool](#2-zoneanalysistool)
3. [TrainingPlanTool](#3-trainingplantool)
4. [CrossTrainingTool](#4-crosstrainingtool)
5. [ReportGenerationTool](#5-reportgenerationtool)
6. [Common Patterns](#6-common-patterns)
7. [Testing Requirements](#7-testing-requirements)

---

## 1. PerformanceAnalysisTool

### Purpose
Analyzes cycling performance from Strava CSV export, comparing recent and previous time periods to identify trends and insights.

### File Location
`src/cycling_ai/tools/wrappers/performance.py`

### Complete Implementation

```python
"""
Performance analysis tool wrapper.

Wraps core.performance.analyze_performance() as a BaseTool for LLM provider integration.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.performance import analyze_performance
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)


class PerformanceAnalysisTool(BaseTool):
    """
    Tool for analyzing cycling performance from Strava CSV data.

    Compares recent period with equivalent prior period to identify trends,
    provides monthly breakdown, and highlights best performances.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="analyze_performance",
            description=(
                "Analyze cycling performance from Strava CSV export comparing time periods. "
                "Compares recent period (e.g., last 6 months) with equivalent prior period "
                "(e.g., 6 months before that) to identify trends. Provides comprehensive "
                "statistics including weekly averages, monthly breakdown, power/HR trends, "
                "and highlights of best performances. Uses athlete profile for personalized "
                "analysis context (age, FTP, goals, training status)."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description=(
                        "Absolute path to Strava activities CSV export file. "
                        "Must be a valid Strava export containing Activity Date, "
                        "Distance, Moving Time, Average Power, etc."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json containing athlete data "
                        "(name, age, weight, FTP, goals, training availability). "
                        "Required for personalized analysis and insights."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description=(
                        "Number of months for each comparison period. Default is 6. "
                        "Recent period: last N months, Previous period: N months before that. "
                        "For example, period_months=6 compares last 6 months vs months 7-12."
                    ),
                    required=False,
                    default=6,
                    min_value=1,
                    max_value=24,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: athlete_profile (name, age, FTP, goals), "
                    "recent_period stats (rides, distance, time, power, HR), "
                    "previous_period stats, monthly_breakdown (month-by-month trends), "
                    "trends (percentage changes), best_power_rides (top 5 by power), "
                    "longest_rides (top 10 by distance)."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute performance analysis.

        Args:
            **kwargs: Tool parameters (csv_file_path, athlete_profile_json, period_months)

        Returns:
            ToolExecutionResult with analysis data or errors
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract and validate parameters
            csv_file_path = kwargs["csv_file_path"]
            athlete_profile_json = kwargs["athlete_profile_json"]
            period_months = kwargs.get("period_months", 6)

            # Validate file existence
            csv_path = Path(csv_file_path)
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"CSV file not found at path: {csv_file_path}"],
                )

            if not csv_path.is_file():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Path is not a file: {csv_file_path}"],
                )

            profile_path = Path(athlete_profile_json)
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile not found at path: {athlete_profile_json}"],
                )

            # Load athlete profile
            try:
                athlete_profile = load_athlete_profile(profile_path)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error loading athlete profile: {str(e)}"],
                )

            # Execute core business logic
            result_json = analyze_performance(
                csv_file_path=str(csv_path),
                athlete_name=athlete_profile.name,
                athlete_age=athlete_profile.age,
                athlete_weight_kg=athlete_profile.weight_kg,
                athlete_ftp=athlete_profile.ftp,
                athlete_max_hr=athlete_profile.max_hr,
                period_months=period_months,
                athlete_profile=athlete_profile,
            )

            # Parse and validate result JSON
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON returned from analysis: {str(e)}"],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "period_months": period_months,
                    "source": "strava_csv",
                    "activities_analyzed": result_data.get("recent_period", {}).get(
                        "total_rides", 0
                    )
                    + result_data.get("previous_period", {}).get("total_rides", 0),
                },
            )

        except ValueError as e:
            # Parameter validation errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            # Unexpected errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )
```

### Test Specification

**File:** `tests/tools/wrappers/test_performance.py`

```python
"""Tests for PerformanceAnalysisTool."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from cycling_ai.tools.wrappers.performance import PerformanceAnalysisTool


class TestPerformanceAnalysisTool:
    """Test suite for PerformanceAnalysisTool."""

    def test_definition_structure(self) -> None:
        """Test that tool definition has correct structure."""
        tool = PerformanceAnalysisTool()
        definition = tool.definition

        assert definition.name == "analyze_performance"
        assert definition.category == "analysis"
        assert definition.version == "1.0.0"
        assert len(definition.parameters) == 3

        # Verify required parameters
        required_params = definition.get_required_parameters()
        assert len(required_params) == 2
        param_names = {p.name for p in required_params}
        assert param_names == {"csv_file_path", "athlete_profile_json"}

        # Verify optional parameters
        optional_params = definition.get_optional_parameters()
        assert len(optional_params) == 1
        assert optional_params[0].name == "period_months"
        assert optional_params[0].default == 6

    def test_execute_success(
        self, sample_csv: Path, sample_profile: Path
    ) -> None:
        """Test successful execution with valid inputs."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json=str(sample_profile),
            period_months=6,
        )

        assert result.success is True
        assert result.format == "json"
        assert isinstance(result.data, dict)

        # Verify expected data structure
        assert "athlete_profile" in result.data
        assert "recent_period" in result.data
        assert "previous_period" in result.data
        assert "monthly_breakdown" in result.data

        # Verify metadata
        assert "athlete" in result.metadata
        assert result.metadata["period_months"] == 6

    def test_execute_missing_csv(self, sample_profile: Path) -> None:
        """Test execution with non-existent CSV file."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path="/nonexistent/activities.csv",
            athlete_profile_json=str(sample_profile),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_execute_missing_profile(self, sample_csv: Path) -> None:
        """Test execution with non-existent profile file."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json="/nonexistent/profile.json",
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "profile" in result.errors[0].lower()

    def test_execute_missing_required_parameter(self, sample_csv: Path) -> None:
        """Test validation catches missing required parameters."""
        tool = PerformanceAnalysisTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(csv_file_path=str(sample_csv))

    def test_execute_invalid_period_months(
        self, sample_csv: Path, sample_profile: Path
    ) -> None:
        """Test validation of period_months range."""
        tool = PerformanceAnalysisTool()

        # Test with period_months = 0 (below minimum)
        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json=str(sample_profile),
            period_months=0,
        )
        # Should fail validation or return error

        # Test with period_months = 25 (above maximum)
        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json=str(sample_profile),
            period_months=25,
        )
        # Should fail validation or return error
```

---

## 2. ZoneAnalysisTool

### Purpose
Analyzes actual time spent in power zones by reading second-by-second data from FIT files.

### File Location
`src/cycling_ai/tools/wrappers/zones.py`

### Complete Implementation

```python
"""
Zone analysis tool wrapper.

Wraps core.zones.analyze_time_in_zones() as a BaseTool.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.zones import analyze_time_in_zones
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)


class ZoneAnalysisTool(BaseTool):
    """
    Tool for analyzing time-in-zones from FIT files.

    Reads second-by-second power data from .fit/.fit.gz files to provide
    accurate zone distribution analysis and polarization metrics.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="analyze_time_in_zones",
            description=(
                "Analyze actual time spent in power zones by reading FIT files. "
                "Provides accurate zone distribution (Z1-Z5) by processing second-by-second "
                "power data rather than using ride averages. Includes polarization analysis "
                "(easy/moderate/hard distribution) and personalized recommendations based on "
                "athlete age, goals, and training status. Uses caching for performance."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="activities_directory",
                    type="string",
                    description=(
                        "Path to directory containing .fit or .fit.gz files. "
                        "Can be organized in subdirectories (e.g., ride/2024-01/). "
                        "All .fit files will be processed recursively."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json. Required for FTP value "
                        "and personalized zone recommendations."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description=(
                        "Number of months to analyze (looking back from today). "
                        "Only FIT files within this period will be processed."
                    ),
                    required=False,
                    default=6,
                    min_value=1,
                    max_value=24,
                ),
                ToolParameter(
                    name="use_cache",
                    type="boolean",
                    description=(
                        "Use cached zone data if available. Cache is stored per FTP value. "
                        "Set to false to force re-processing of all FIT files."
                    ),
                    required=False,
                    default=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: ftp, zones (Z1-Z5 with time/percentage), "
                    "polarization analysis (easy/moderate/hard percentages), "
                    "athlete_profile context, llm_context for personalized recommendations."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute zone analysis.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with zone distribution data or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract parameters
            activities_directory = kwargs["activities_directory"]
            athlete_profile_json = kwargs["athlete_profile_json"]
            period_months = kwargs.get("period_months", 6)
            use_cache = kwargs.get("use_cache", True)

            # Validate paths
            activities_path = Path(activities_directory)
            if not activities_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Activities directory not found: {activities_directory}"],
                )

            if not activities_path.is_dir():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Path is not a directory: {activities_directory}"],
                )

            profile_path = Path(athlete_profile_json)
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile not found: {athlete_profile_json}"],
                )

            # Load athlete profile
            try:
                athlete_profile = load_athlete_profile(profile_path)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error loading athlete profile: {str(e)}"],
                )

            # Execute zone analysis
            result_json = analyze_time_in_zones(
                activities_directory=str(activities_path),
                athlete_ftp=athlete_profile.ftp,
                period_months=period_months,
                max_files=None,  # Process all files
                use_cache=use_cache,
                athlete_profile=athlete_profile,
            )

            # Parse result
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON from zone analysis: {str(e)}"],
                )

            # Check for error in result
            if "error" in result_data:
                return ToolExecutionResult(
                    success=False,
                    data=result_data,
                    format="json",
                    errors=[result_data["error"]],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "ftp": athlete_profile.ftp,
                    "period_months": period_months,
                    "files_processed": result_data.get("files_processed", 0),
                    "cache_used": result_data.get("source") == "cached",
                },
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )
```

### Test Specification

Similar structure to PerformanceAnalysisTool tests, with additional tests for:
- FIT file processing
- Cache usage
- Empty directory handling
- Invalid FIT files

---

## 3. TrainingPlanTool

### Purpose
Generates progressive, periodized training plan based on athlete's availability and goals.

### File Location
`src/cycling_ai/tools/wrappers/training.py`

### Complete Implementation

```python
"""
Training plan generation tool wrapper.

Wraps core.training.generate_training_plan() as a BaseTool.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.training import generate_training_plan
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)


class TrainingPlanTool(BaseTool):
    """
    Tool for generating progressive training plans.

    Creates periodized week-by-week plans with Foundation, Build, Recovery,
    and Peak phases tailored to athlete's availability and goals.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="generate_training_plan",
            description=(
                "Generate a progressive, periodized training plan based on athlete's "
                "current fitness, goals, and availability. Creates structured week-by-week "
                "plan with Foundation (base building), Build (intensity), Recovery (adaptation), "
                "and Peak (performance) phases. Includes specific workouts with power targets, "
                "SVG visualizations, and personalized recommendations based on age, training status, "
                "and available training days."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json. Required for FTP, age, "
                        "training availability (days/week), and goals."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="total_weeks",
                    type="integer",
                    description=(
                        "Duration of training plan in weeks. Minimum 4, maximum 24. "
                        "Longer plans allow for more gradual progression."
                    ),
                    required=False,
                    default=12,
                    min_value=4,
                    max_value=24,
                ),
                ToolParameter(
                    name="target_ftp",
                    type="number",
                    description=(
                        "Target FTP in watts. If not provided, defaults to +6% of current FTP. "
                        "Should be realistic based on plan duration and current fitness."
                    ),
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: athlete_profile, ftp_progression, power_zones, "
                    "weekly_workouts (with SVG visualizations), plan_text (formatted markdown), "
                    "llm_context for personalized coaching recommendations."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute training plan generation.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with training plan data or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract parameters
            athlete_profile_json = kwargs["athlete_profile_json"]
            total_weeks = kwargs.get("total_weeks", 12)
            target_ftp = kwargs.get("target_ftp")

            # Validate profile path
            profile_path = Path(athlete_profile_json)
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile not found: {athlete_profile_json}"],
                )

            # Load athlete profile
            try:
                athlete_profile = load_athlete_profile(profile_path)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error loading athlete profile: {str(e)}"],
                )

            # Get available training days from profile
            available_days = athlete_profile.get_training_days_count()

            # Generate training plan
            result_json = generate_training_plan(
                current_ftp=athlete_profile.ftp,
                available_days_per_week=available_days,
                target_ftp=target_ftp,
                total_weeks=total_weeks,
                athlete_age=athlete_profile.age,
                athlete_profile=athlete_profile,
            )

            # Parse result
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON from training plan: {str(e)}"],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "current_ftp": athlete_profile.ftp,
                    "target_ftp": result_data.get("target_ftp"),
                    "total_weeks": total_weeks,
                    "available_days": available_days,
                },
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )
```

---

## 4. CrossTrainingTool

### Purpose
Analyzes how non-cycling activities impact cycling performance through load distribution and interference analysis.

### File Location
`src/cycling_ai/tools/wrappers/cross_training.py`

### Helper Function Required

First, add to `src/cycling_ai/core/utils.py`:

```python
def load_and_categorize_activities(csv_file_path: str) -> pd.DataFrame:
    """
    Load activities and apply cross-training categorization.

    Args:
        csv_file_path: Path to Strava CSV file

    Returns:
        DataFrame with cross-training categories applied
    """
    from .fit_processing import categorize_activities

    # Load activities
    df = load_activities_data(csv_file_path)

    # Apply cross-training categorization
    df = categorize_activities(df)

    return df
```

### Complete Implementation

```python
"""
Cross-training analysis tool wrapper.

Wraps core.cross_training.analyze_cross_training_impact() as a BaseTool.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.cross_training import analyze_cross_training_impact
from cycling_ai.core.utils import load_and_categorize_activities
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)


class CrossTrainingTool(BaseTool):
    """
    Tool for analyzing cross-training impact on cycling performance.

    Examines how strength training, running, swimming, and other activities
    affect cycling through load distribution and interference patterns.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="analyze_cross_training_impact",
            description=(
                "Analyze how non-cycling activities (strength training, running, swimming) "
                "impact cycling performance. Examines training load distribution across "
                "activity categories, detects potential interference events (e.g., strength "
                "before hard cycling), analyzes weekly load balance, and provides timing "
                "recommendations. Includes personalized guidance based on athlete age, "
                "recovery capacity, and goals."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description=(
                        "Path to Strava activities CSV export containing ALL activity types "
                        "(cycling, running, strength training, swimming, etc.). Must include "
                        "complete activity history for meaningful cross-training analysis."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="analysis_period_weeks",
                    type="integer",
                    description=(
                        "Number of weeks to analyze (looking back from today). "
                        "Longer periods provide more data for pattern detection."
                    ),
                    required=False,
                    default=12,
                    min_value=4,
                    max_value=52,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: activity_distribution (by category), "
                    "load_balance (cycling vs strength vs cardio percentages), "
                    "weekly_loads (week-by-week TSS breakdown), interference_analysis "
                    "(timing conflicts), performance_insights (correlations)."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute cross-training analysis.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with cross-training analysis or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract parameters
            csv_file_path = kwargs["csv_file_path"]
            analysis_period_weeks = kwargs.get("analysis_period_weeks", 12)

            # Validate CSV path
            csv_path = Path(csv_file_path)
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"CSV file not found: {csv_file_path}"],
                )

            # Load and categorize activities
            try:
                df = load_and_categorize_activities(str(csv_path))
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error loading/categorizing activities: {str(e)}"],
                )

            # Execute cross-training analysis
            result_json = analyze_cross_training_impact(
                df=df,
                analysis_period_weeks=analysis_period_weeks,
            )

            # Parse result
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON from cross-training analysis: {str(e)}"],
                )

            # Check for error in result
            if "error" in result_data:
                return ToolExecutionResult(
                    success=False,
                    data=result_data,
                    format="json",
                    errors=[result_data["error"]],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "analysis_period_weeks": analysis_period_weeks,
                    "total_activities": result_data.get("analysis_period", {}).get(
                        "total_activities", 0
                    ),
                    "interference_events": result_data.get("interference_analysis", {}).get(
                        "total_events", 0
                    ),
                },
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )
```

---

## 5. ReportGenerationTool

### Purpose
Generates comprehensive Markdown report combining multiple analysis results.

### File Location
`src/cycling_ai/tools/wrappers/reports.py`

### Implementation Note
This is a simplified version for Phase 3. HTML generation with SVG visualizations can be added in Phase 4.

### Complete Implementation

```python
"""
Report generation tool wrapper.

Generates Markdown reports combining multiple analysis results.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)


class ReportGenerationTool(BaseTool):
    """
    Tool for generating comprehensive analysis reports.

    Combines performance, zones, and training plan analyses into a
    cohesive Markdown report.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="generate_report",
            description=(
                "Generate comprehensive Markdown report combining multiple analysis results. "
                "Creates a well-structured report with performance summary, zone distribution, "
                "training plan, and recommendations. Report is saved as Markdown file for "
                "easy viewing and version control."
            ),
            category="reporting",
            parameters=[
                ToolParameter(
                    name="performance_analysis_json",
                    type="string",
                    description="JSON string output from performance analysis tool",
                    required=True,
                ),
                ToolParameter(
                    name="zones_analysis_json",
                    type="string",
                    description="JSON string output from zones analysis tool",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_json",
                    type="string",
                    description="JSON string output from training plan tool (optional)",
                    required=False,
                ),
                ToolParameter(
                    name="output_path",
                    type="string",
                    description="Path where Markdown report should be saved",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Report generation status with saved file path",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute report generation.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with report generation status
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract parameters
            performance_json = kwargs["performance_analysis_json"]
            zones_json = kwargs["zones_analysis_json"]
            training_plan_json = kwargs.get("training_plan_json")
            output_path = kwargs["output_path"]

            # Parse input JSONs
            try:
                performance_data = json.loads(performance_json)
                zones_data = json.loads(zones_json)
                training_plan_data = (
                    json.loads(training_plan_json) if training_plan_json else None
                )
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid input JSON: {str(e)}"],
                )

            # Generate report
            report_markdown = self._generate_markdown_report(
                performance_data, zones_data, training_plan_data
            )

            # Write to file
            try:
                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                output_file.write_text(report_markdown)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error writing report file: {str(e)}"],
                )

            # Return success
            return ToolExecutionResult(
                success=True,
                data={
                    "report_path": str(output_file),
                    "size_bytes": len(report_markdown),
                    "sections": ["performance", "zones"]
                    + (["training_plan"] if training_plan_data else []),
                },
                format="json",
                metadata={
                    "generated_at": datetime.now().isoformat(),
                    "output_path": str(output_file),
                },
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )

    def _generate_markdown_report(
        self,
        performance_data: dict[str, Any],
        zones_data: dict[str, Any],
        training_plan_data: dict[str, Any] | None,
    ) -> str:
        """
        Generate Markdown report from analysis data.

        Args:
            performance_data: Performance analysis results
            zones_data: Zone analysis results
            training_plan_data: Training plan results (optional)

        Returns:
            Markdown-formatted report string
        """
        report = []

        # Header
        athlete = performance_data.get("athlete_profile", {})
        report.append(f"# Cycling Performance Report - {athlete.get('name', 'Athlete')}")
        report.append(f"\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

        # Athlete Profile Section
        report.append("## Athlete Profile\n")
        report.append(f"- **Age:** {athlete.get('age')} years")
        report.append(f"- **FTP:** {athlete.get('ftp')} W")
        report.append(
            f"- **Power-to-Weight:** {athlete.get('power_to_weight', 0):.2f} W/kg"
        )
        if goals := athlete.get("goals"):
            report.append(f"- **Goals:** {goals}")
        report.append("")

        # Performance Section
        report.append("## Performance Analysis\n")
        recent = performance_data.get("recent_period", {})
        previous = performance_data.get("previous_period", {})

        report.append("### Recent Period")
        report.append(f"- **Rides:** {recent.get('total_rides', 0)}")
        report.append(f"- **Distance:** {recent.get('total_distance_km', 0):.1f} km")
        report.append(f"- **Time:** {recent.get('total_time_hours', 0):.1f} hours")
        report.append(f"- **Avg Power:** {recent.get('avg_power', 0):.0f} W")
        report.append("")

        # Trends
        if trends := performance_data.get("trends"):
            report.append("### Trends")
            for metric, change in trends.items():
                report.append(f"- **{metric.replace('_', ' ').title()}:** {change:+.1f}%")
            report.append("")

        # Zone Distribution Section
        report.append("## Power Zone Distribution\n")
        zones = zones_data.get("zones", {})

        report.append("| Zone | Time (hours) | Percentage |")
        report.append("|------|--------------|------------|")
        for zone_name, zone_info in zones.items():
            hours = zone_info.get("time_hours", 0)
            pct = zone_info.get("percentage", 0)
            report.append(f"| {zone_name} | {hours:.1f} | {pct:.1f}% |")
        report.append("")

        # Polarization
        report.append("### Polarization Analysis\n")
        report.append(f"- **Easy (Z1-Z2):** {zones_data.get('easy_percent', 0):.1f}%")
        report.append(f"- **Moderate (Z3):** {zones_data.get('moderate_percent', 0):.1f}%")
        report.append(f"- **Hard (Z4-Z5):** {zones_data.get('hard_percent', 0):.1f}%")
        report.append("")

        # Training Plan Section (if available)
        if training_plan_data:
            report.append("## Training Plan\n")
            report.append(f"- **Duration:** {training_plan_data.get('total_weeks')} weeks")
            report.append(
                f"- **Current FTP:** {training_plan_data.get('current_ftp')} W"
            )
            report.append(f"- **Target FTP:** {training_plan_data.get('target_ftp')} W")
            report.append(
                f"- **FTP Gain:** +{training_plan_data.get('ftp_gain')} W "
                f"({training_plan_data.get('ftp_gain_percent'):.1f}%)"
            )
            report.append("")

            # Include formatted plan text if available
            if plan_text := training_plan_data.get("plan_text"):
                report.append(plan_text)

        return "\n".join(report)
```

---

## 6. Common Patterns

All tool wrappers follow these common patterns:

### Error Handling

```python
try:
    self.validate_parameters(**kwargs)
    # ... tool execution ...
except ValueError as e:
    return ToolExecutionResult(
        success=False,
        data=None,
        format="json",
        errors=[f"Parameter validation error: {str(e)}"]
    )
except Exception as e:
    return ToolExecutionResult(
        success=False,
        data=None,
        format="json",
        errors=[f"Unexpected error: {str(e)}"]
    )
```

### Path Validation

```python
path = Path(file_path)
if not path.exists():
    return ToolExecutionResult(
        success=False,
        data=None,
        format="json",
        errors=[f"File not found: {file_path}"]
    )
```

### Athlete Profile Loading

```python
try:
    athlete_profile = load_athlete_profile(profile_path)
except Exception as e:
    return ToolExecutionResult(
        success=False,
        data=None,
        format="json",
        errors=[f"Error loading athlete profile: {str(e)}"]
    )
```

### Result Parsing

```python
try:
    result_data = json.loads(result_json)
except json.JSONDecodeError as e:
    return ToolExecutionResult(
        success=False,
        data=None,
        format="json",
        errors=[f"Invalid JSON: {str(e)}"]
    )
```

---

## 7. Testing Requirements

### Required Test Cases per Tool

1. **Definition Tests**
   - Validate tool name, category, version
   - Check parameter count and types
   - Verify required vs optional parameters

2. **Success Cases**
   - Execute with valid inputs
   - Verify result structure
   - Check metadata fields

3. **Error Cases**
   - Missing files
   - Invalid paths
   - Malformed input data
   - Parameter validation failures

4. **Edge Cases**
   - Empty datasets
   - Extreme parameter values
   - Concurrent executions

### Fixture Requirements

All tests need these fixtures:
- `sample_csv`: Valid Strava CSV file
- `sample_profile`: Valid athlete_profile.json
- `sample_fit_file`: Valid .fit.gz file (for zone analysis)
- `tmp_path`: Pytest temporary directory

---

**End of Tool Specifications Document**
