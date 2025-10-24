"""Pytest fixtures for cycling AI tests."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    """Create sample Strava CSV file."""
    csv_path = tmp_path / "activities.csv"

    # Create minimal valid CSV matching Strava export format
    # Column 0 must be Activity ID (per utils.py:115)
    data = {
        "Activity ID": [1001, 1002, 1003, 1004],
        "Activity Date": ["2024-01-01", "2024-01-02", "2024-06-01", "2024-06-02"],
        "Activity Name": ["Morning Ride", "Evening Ride", "Test Ride", "Another Ride"],
        "Activity Type": ["Ride", "Ride", "Ride", "Ride"],
        "Distance": [50000, 60000, 55000, 58000],
        "Moving Time": [7200, 8400, 7500, 7800],
        "Elapsed Time": [7500, 8700, 7800, 8100],
        "Elevation Gain": [500, 600, 550, 575],
        "Average Power": [200, 210, 205, 208],
        "Weighted Average Power": [210, 220, 215, 218],
        "Average Heart Rate": [145, 150, 148, 149],
    }

    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)

    return csv_path


@pytest.fixture
def sample_profile(tmp_path: Path) -> Path:
    """Create sample athlete profile."""
    profile_path = tmp_path / "athlete_profile.json"

    profile_data = {
        "name": "Test Athlete",
        "age": 35,
        "weight": "75kg",
        "FTP": "250w",
        "critical_HR": 165,
        "gender": "male",
        "training_availability": {
            "hours_per_week": 8,
            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
        },
        "goals": "Improve FTP to 270w",
        "current_training_status": "recreational",
    }

    with open(profile_path, "w") as f:
        json.dump(profile_data, f)

    return profile_path


@pytest.fixture
def sample_fit_directory(tmp_path: Path) -> Path:
    """Create sample FIT files directory."""
    fit_dir = tmp_path / "fit_files"
    fit_dir.mkdir()

    # We'll just create an empty directory for now
    # Actual FIT file processing tests will use real FIT files
    return fit_dir
