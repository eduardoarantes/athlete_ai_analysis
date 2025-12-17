"""
Data validation tool for Phase 1: Data Preparation.

Validates that required data files exist and have correct structure.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from cycling_ai.tools.base import BaseTool, ToolDefinition, ToolExecutionResult, ToolParameter
from cycling_ai.tools.registry import register_tool


class DataValidationTool(BaseTool):
    """
    Tool for validating cycling data files before processing.

    Checks file existence, CSV structure (if provided), FIT directory (if required),
    and athlete profile validity. Supports both CSV and FIT-only modes.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="validate_data_files",
            description=(
                "Validate cycling data files for processing. Supports both CSV mode (requires CSV file) "
                "and FIT-only mode (requires FIT directory). Checks file existence, structure validity, "
                "and returns detailed validation report. At least one data source (CSV or FIT directory) "
                "must be provided."
            ),
            category="data_prep",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description="Absolute path to activities CSV file (LEGACY: optional if using FIT-only mode)",
                    required=False,
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description="Absolute path to athlete profile JSON file",
                    required=True,
                ),
                ToolParameter(
                    name="fit_dir_path",
                    type="string",
                    description="Optional path to directory containing FIT files",
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Validation report with file status and any issues found",
            },
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute data validation.

        Args:
            csv_file_path: Optional path to CSV file (not required for FIT-only mode)
            athlete_profile_path: Path to athlete profile JSON
            fit_dir_path: Optional path to FIT directory (required for FIT-only mode)

        Returns:
            Validation report with success status and any issues found
        """
        csv_path = Path(kwargs["csv_file_path"]) if kwargs.get("csv_file_path") else None
        profile_path = Path(kwargs["athlete_profile_path"])
        fit_dir = Path(kwargs.get("fit_dir_path", "")) if kwargs.get("fit_dir_path") else None

        issues = []
        warnings = []

        # Check that we have at least one data source
        if csv_path is None and fit_dir is None:
            issues.append("Must provide either csv_file_path or fit_dir_path (or both)")
            return ToolExecutionResult(
                success=False,
                data={"success": False, "issues": issues, "warnings": warnings},
                format="json",
            )

        # Validate CSV file (if provided)
        activity_count = 0
        if csv_path is not None:
            if not csv_path.exists():
                issues.append(f"CSV file not found: {csv_path}")
            elif not csv_path.is_file():
                issues.append(f"CSV path is not a file: {csv_path}")
            else:
                # Check CSV structure
                try:
                    df = pd.read_csv(csv_path, nrows=5)
                    required_columns = ["Activity Date", "Activity Type", "Distance"]
                    missing_cols = [col for col in required_columns if col not in df.columns]
                    if missing_cols:
                        issues.append(f"CSV missing required columns: {missing_cols}")

                    # Count total activities
                    df_full = pd.read_csv(csv_path)
                    activity_count = len(df_full)

                except Exception as e:
                    issues.append(f"Failed to read CSV file: {str(e)}")
                    activity_count = 0

        # Validate athlete profile
        if not profile_path.exists():
            issues.append(f"Athlete profile not found: {profile_path}")
        elif not profile_path.is_file():
            issues.append(f"Profile path is not a file: {profile_path}")
        else:
            try:
                with open(profile_path) as f:
                    profile_data = json.load(f)

                # Check for key fields
                required_fields = ["ftp", "age"]
                missing_fields = [f for f in required_fields if f not in profile_data]
                if missing_fields:
                    warnings.append(f"Profile missing recommended fields: {missing_fields}")

            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON in profile file: {str(e)}")
            except Exception as e:
                issues.append(f"Failed to read profile file: {str(e)}")

        # Validate FIT directory
        fit_files_count = 0
        fit_only_mode = csv_path is None  # FIT-only if no CSV provided

        if fit_dir:
            if not fit_dir.exists():
                if fit_only_mode:
                    issues.append(f"FIT directory not found: {fit_dir} (required for FIT-only mode)")
                else:
                    warnings.append(f"FIT directory not found: {fit_dir}")
            elif not fit_dir.is_dir():
                if fit_only_mode:
                    issues.append(f"FIT path is not a directory: {fit_dir}")
                else:
                    warnings.append(f"FIT path is not a directory: {fit_dir}")
            else:
                # Count FIT files
                fit_files = list(fit_dir.glob("**/*.fit")) + list(fit_dir.glob("**/*.fit.gz"))
                fit_files_count = len(fit_files)
                if fit_files_count == 0:
                    if fit_only_mode:
                        issues.append(f"No FIT files found in directory: {fit_dir} (required for FIT-only mode)")
                    else:
                        warnings.append(f"No FIT files found in directory: {fit_dir}")
        elif fit_only_mode:
            # FIT-only mode requires FIT directory
            issues.append("FIT-only mode requires fit_dir_path to be provided")

        # Build result
        success = len(issues) == 0

        result = {
            "success": success,
            "fit_only_mode": fit_only_mode,
            "csv_file": str(csv_path) if csv_path else None,
            "csv_exists": csv_path.exists() if csv_path else False,
            "csv_valid": success and csv_path is not None and csv_path.exists(),
            "activity_count": activity_count,
            "profile_file": str(profile_path),
            "profile_exists": profile_path.exists(),
            "profile_valid": success and profile_path.exists(),
            "fit_directory": str(fit_dir) if fit_dir else None,
            "fit_files_count": fit_files_count,
            "issues": issues,
            "warnings": warnings,
        }

        if success:
            if fit_only_mode:
                result["message"] = (
                    f"✅ Data validation passed (FIT-only mode)! Found {fit_files_count} FIT files for processing."
                )
            else:
                result["message"] = (
                    f"✅ Data validation passed! Found {activity_count} activities "
                    f"in CSV and {fit_files_count} FIT files."
                )
        else:
            result["message"] = f"❌ Validation failed with {len(issues)} issue(s)"

        return ToolExecutionResult(success=success, data=result, format="json")


# Register tool on module import
register_tool(DataValidationTool())
