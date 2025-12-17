"""
Extract metadata from FIT files to build activities DataFrame.

This module enables building a complete activities DataFrame directly from FIT files
without requiring a CSV export from Strava. It extracts all essential metadata
(date, duration, distance, power, HR, etc.) from FIT files.

Uses fitdecode library for metadata extraction. fitdecode handles corrupted files
from devices like Coros Dura better than fitparse.
"""

from __future__ import annotations

import gzip
import logging
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import fitdecode

logger = logging.getLogger(__name__)


def extract_fit_metadata(fit_file_path: str | Path) -> dict[str, Any] | None:
    """
    Extract metadata from a single FIT file using fitdecode library.

    Extracts activity metadata including:
    - Activity date/time
    - Duration (elapsed and moving time)
    - Distance
    - Elevation gain
    - Average/max power
    - Average/max heart rate
    - Average/max cadence
    - Activity type

    Args:
        fit_file_path: Path to .fit or .fit.gz file

    Returns:
        Dictionary with activity metadata, or None if extraction fails
    """
    fit_path = Path(fit_file_path)

    if not fit_path.exists():
        logger.warning(f"FIT file not found: {fit_path}")
        return None

    # Handle .fit.gz files - decompress to temp file
    file_to_parse = str(fit_path)
    temp_file = None

    try:
        if fit_path.suffix == ".gz":
            temp_file = tempfile.NamedTemporaryFile(suffix=".fit", delete=False)  # noqa: SIM115
            with gzip.open(fit_path, "rb") as f_in:
                temp_file.write(f_in.read())
            temp_file.close()
            file_to_parse = temp_file.name

        # Parse FIT file using fitdecode
        # Use IGNORE error handling and DISABLED CRC for corrupted files (e.g., Coros Dura)
        fit_reader = fitdecode.FitReader(
            file_to_parse,
            check_crc=fitdecode.CrcCheck.DISABLED,
            error_handling=fitdecode.ErrorHandling.IGNORE,
        )

        # Get session message (contains summary data)
        session_data = None
        for frame in fit_reader:
            if isinstance(frame, fitdecode.FitDataMessage) and frame.name == "session":
                session_data = frame
                break  # Use first session

        if not session_data:
            logger.warning(f"No session data found in FIT file: {fit_path}")
            return None

        # Extract activity ID from filename (e.g., "12345678.fit" -> 12345678)
        activity_id = fit_path.stem.replace(".fit", "")

        # Helper to get field value safely from fitdecode fields
        def get_value(name: str, default: Any = 0) -> Any:
            for field in session_data.fields:
                if field.name == name:
                    return field.value
            return default

        # Extract timestamp
        activity_date = get_value("start_time") or get_value("timestamp")
        if not activity_date:
            activity_date = datetime.now()

        # Determine activity type/sport with proper handling
        sport_raw = get_value("sport", "cycling")
        sub_sport_raw = get_value("sub_sport", None)

        # Convert sport enum to string if needed
        sport = (
            "cycling" if isinstance(sport_raw, (int, float)) else (str(sport_raw).lower() if sport_raw else "cycling")
        )

        # Convert sub_sport enum to string if needed
        if sub_sport_raw and not isinstance(sub_sport_raw, str):
            sub_sport = str(sub_sport_raw).lower()
        else:
            sub_sport = sub_sport_raw if sub_sport_raw else None

        # Determine Activity Type for display (like Strava CSV format)
        # Map sport to Strava-style activity type names
        sport_display_map = {
            "cycling": "Ride",
            "running": "Run",
            "swimming": "Swim",
            "walking": "Walk",
            "hiking": "Hike",
            "strength_training": "Weight Training",
            "training": "Workout",
            "generic": "Workout",
        }
        activity_type_display = sport_display_map.get(sport, sport.title())

        # Helper to safely convert to int/float
        def safe_int(value: Any, default: int = 0) -> int:
            if value is None:
                return default
            try:
                return int(value)
            except (ValueError, TypeError):
                return default

        def safe_float(value: Any, default: float = 0.0) -> float:
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        # Build standardized metadata dict matching CSV column names
        return {
            "Activity ID": int(activity_id) if activity_id.isdigit() else activity_id,
            "Activity Date": activity_date,
            "Activity Name": f"{activity_type_display} - {activity_date.strftime('%B %d, %Y')}"
            if isinstance(activity_date, datetime)
            else activity_type_display,
            "Activity Type": activity_type_display,  # Strava-style display name
            "sport": sport,  # Raw sport type (lowercase, normalized)
            "sub_sport": sub_sport,  # Sub-sport detail (e.g., road, mountain, indoor)
            "Elapsed Time": safe_int(get_value("total_elapsed_time")),
            "Moving Time": safe_int(get_value("total_timer_time")),
            "Distance": safe_float(get_value("total_distance")),
            "Elevation Gain": safe_int(get_value("total_ascent")),
            "Average Speed": safe_float(get_value("avg_speed")),
            "Max Speed": safe_float(get_value("max_speed")),
            "Average Heart Rate": safe_int(get_value("avg_heart_rate")),
            "Max Heart Rate": safe_int(get_value("max_heart_rate")),
            "Average Watts": safe_int(get_value("avg_power")),
            "Max Watts": safe_int(get_value("max_power")),
            "Weighted Average Power": safe_int(get_value("normalized_power")),
            "Average Cadence": safe_int(get_value("avg_cadence")),
            "Max Cadence": safe_int(get_value("max_cadence")),
            "Calories": safe_int(get_value("total_calories")),
            "Filename": str(fit_path.name),
            "Commute": False,
            "Activity Description": None,
            "Activity Gear": None,
            "Athlete Weight": None,
            "Bike Weight": None,
            "Elevation Loss": None,
            "Elevation Low": None,
            "Elevation High": None,
            "Max Grade": None,
            "Average Grade": None,
            "Average Positive Grade": None,
            "Average Negative Grade": None,
            "Max Temperature": None,
            "Average Temperature": None,
            "Relative Effort": None,
            "Total Work": None,
            "Number of Runs": None,
            "Uphill Time": None,
            "Downhill Time": None,
            "Other Time": None,
            "Perceived Exertion": None,
            "Type": None,
            "Start Time": None,
        }

    except Exception as e:
        logger.warning(f"Error extracting metadata from {fit_path}: {e}")
        return None
    finally:
        # Clean up temp file if created
        if temp_file and Path(temp_file.name).exists():
            Path(temp_file.name).unlink()


def scan_fit_directory(fit_dir: str | Path) -> list[dict[str, Any]]:
    """
    Scan directory for FIT files and extract metadata from all of them.

    Recursively searches for .fit and .fit.gz files and extracts metadata
    from each one to build a complete activities dataset.

    Args:
        fit_dir: Directory containing FIT files (can have subdirectories)

    Returns:
        List of activity metadata dictionaries
    """
    fit_dir_path = Path(fit_dir)

    if not fit_dir_path.exists():
        logger.error(f"FIT directory not found: {fit_dir}")
        return []

    # Find all FIT files recursively
    fit_files = []
    for pattern in ["**/*.fit", "**/*.fit.gz"]:
        fit_files.extend(fit_dir_path.glob(pattern))

    logger.info(f"Found {len(fit_files)} FIT files in {fit_dir}")

    # Extract metadata from each file
    activities = []
    for i, fit_file in enumerate(fit_files, 1):
        if i % 50 == 0:
            logger.info(f"Processing FIT file {i}/{len(fit_files)}")

        metadata = extract_fit_metadata(fit_file)
        if metadata:
            activities.append(metadata)

    logger.info(f"Successfully extracted metadata from {len(activities)}/{len(fit_files)} FIT files")

    return activities
