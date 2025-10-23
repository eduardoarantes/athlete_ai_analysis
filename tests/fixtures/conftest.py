"""Pytest fixtures for testing."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest


@pytest.fixture
def sample_athlete_profile(tmp_path: Path) -> Path:
    """Create a sample athlete profile JSON file."""
    profile_data = {
        "name": "Test Athlete",
        "age": 35,
        "weight": "75kg",
        "FTP": "250w",
        "critical_HR": 180,
        "gender": "male",
        "training_availability": {"hours_per_week": 8, "week_days": "Sunday, Tuesday, Thursday, Saturday"},
        "goals": "Improve FTP to 275w",
        "current_training_status": "recreational",
    }

    profile_path = tmp_path / "athlete_profile.json"
    with open(profile_path, "w") as f:
        json.dump(profile_data, f)

    return profile_path


@pytest.fixture
def sample_activities_csv(tmp_path: Path) -> Path:
    """Create a sample activities CSV file."""
    # Minimal valid Strava CSV structure
    data = {
        "Activity Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Activity Name": ["Morning Ride", "Lunch Ride", "Evening Ride"],
        "Activity Type": ["Ride", "Ride", "Ride"],
        "Distance": [50000, 30000, 40000],  # meters
        "Moving Time": [7200, 3600, 5400],  # seconds
        "Elevation Gain": [500, 200, 350],  # meters
        "Average Power": [220, 240, 230],  # watts
        "Weighted Average Power": [230, 250, 240],
        "Average Heart Rate": [150, 160, 155],
    }

    df = pd.DataFrame(data)
    csv_path = tmp_path / "activities.csv"
    df.to_csv(csv_path, index=False)

    return csv_path
