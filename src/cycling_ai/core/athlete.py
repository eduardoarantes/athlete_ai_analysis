#!/usr/bin/env python3
"""
Athlete Profile Loader

Reads athlete information from athlete_profile.json files.
Eliminates hardcoded athlete data across all tools.
"""

import json
from pathlib import Path
from typing import Any


class AthleteProfile:
    """Athlete profile data from athlete_profile.json file."""

    def __init__(
        self,
        name: str,
        age: int,
        weight_kg: float,
        ftp: float,
        max_hr: int | None = None,
        gender: str | None = None,
        training_availability: dict[str, Any] | None = None,
        goals: str | None = None,
        current_training_status: str | None = None,
        raw_training_data_path: str | None = None,
    ):
        self.name = name
        self.age = age
        self.weight_kg = weight_kg
        self.ftp = ftp
        self.max_hr = max_hr
        self.gender = gender

        # Enhanced personalization fields
        self.training_availability = training_availability or {}
        self.goals = goals
        self.current_training_status = current_training_status
        self.raw_training_data_path = raw_training_data_path

    def __repr__(self) -> str:
        return f"AthleteProfile(name='{self.name}', age={self.age}, weight={self.weight_kg}kg, FTP={self.ftp}W, max_hr={self.max_hr})"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for easy access."""
        return {
            "name": self.name,
            "age": self.age,
            "weight_kg": self.weight_kg,
            "ftp": self.ftp,
            "max_hr": self.max_hr,
            "gender": self.gender,
            "training_availability": self.training_availability,
            "goals": self.goals,
            "current_training_status": self.current_training_status,
            "raw_training_data_path": self.raw_training_data_path,
        }

    def get_weekly_training_hours(self) -> float:
        """Get available weekly training hours from training availability."""
        if self.training_availability and "hours_per_week" in self.training_availability:
            return float(self.training_availability["hours_per_week"])
        return 7.0  # Default

    def get_training_days(self) -> list[str]:
        """Get list of available training days."""
        if self.training_availability and "week_days" in self.training_availability:
            days_str = self.training_availability["week_days"]
            if isinstance(days_str, str):
                return [day.strip() for day in days_str.split(",")]
            if isinstance(days_str, list):
                return list(days_str)
            return []
        return []  # Default to empty

    def get_training_days_count(self) -> int:
        """Get number of available training days per week."""
        days = self.get_training_days()
        return len(days) if days else 5  # Default to 5 days


def load_athlete_profile(json_file_path: str | Path) -> AthleteProfile:
    """
    Load athlete profile from a JSON file.

    Expected JSON format:
    {
        "name": "Athlete Name",
        "age": 31,
        "weight": "74kg",
        "FTP": "236w",
        "critical_HR": 149,
        "gender": "male",
        "training_availability": {
            "hours_per_week": 7,
            "week_days": "Sunday, Saturday, Tuesday, Wednesday"
        },
        "goals": "increase my FTP to 260 w",
        "current_training_status": "strong recreational",
        "raw_training_data_path": "/path/to/activities"
    }

    Args:
        json_file_path: Path to athlete profile JSON file

    Returns:
        AthleteProfile object with all athlete data

    Raises:
        FileNotFoundError: If JSON file doesn't exist
        ValueError: If JSON is malformed or missing required fields
    """
    json_path = Path(json_file_path)

    # Validate file exists
    if not json_path.exists():
        raise FileNotFoundError(f"Athlete profile JSON not found: {json_path}")

    try:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        # Parse weight (handle "84kg" format)
        weight_str = str(data.get("weight", ""))
        weight_kg = float(weight_str.replace("kg", "").strip())

        # Parse FTP (handle "260w" format)
        ftp_str = str(data.get("FTP", ""))
        ftp = float(ftp_str.replace("w", "").replace("W", "").strip())

        # Get other fields
        age = int(data.get("age", 0))
        if age <= 0:
            raise ValueError("Age is required and must be positive")

        critical_hr = data.get("critical_HR")
        max_hr = int(critical_hr) if critical_hr else None

        gender = data.get("gender")
        training_availability = data.get("training_availability", {})
        goals = data.get("goals")
        current_training_status = data.get("current_training_status")
        raw_training_data_path = data.get("raw_training_data_path")

        # Extract name from file path if not in JSON
        name = data.get("name", json_path.parent.name)

        # Create and return profile
        return AthleteProfile(
            name=name,
            age=age,
            weight_kg=weight_kg,
            ftp=ftp,
            max_hr=max_hr,
            gender=gender,
            training_availability=training_availability,
            goals=goals,
            current_training_status=current_training_status,
            raw_training_data_path=raw_training_data_path,
        )

    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {e}") from e
    except KeyError as e:
        raise ValueError(f"Missing required field in JSON: {e}") from e
    except Exception as e:
        raise ValueError(f"Error parsing athlete profile JSON: {e}") from e


# Example usage
if __name__ == "__main__":
    # Example path
    profile_path = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Tom/athlete_profile.json"

    try:
        profile = load_athlete_profile(profile_path)
        print("✅ Athlete Profile Loaded Successfully")
        print(f"\n{profile}")
        print("\nDetailed Information:")
        for key, value in profile.to_dict().items():
            if value is not None:
                print(f"  {key}: {value}")
    except Exception as e:
        print(f"❌ Error: {e}")
