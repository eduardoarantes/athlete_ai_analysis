"""
FIT file analysis module.

This module provides functionality to parse and analyze FIT files from cycling activities.
Extracts metrics like power, heart rate, cadence, distance, and duration from organized
FIT files and calculates aggregate statistics.

Copied from fit-analyzer/server.py (lines 189-393)
"""

import gzip
import statistics
import tempfile
from datetime import datetime
from pathlib import Path

import fitdecode


def parse_fit_file_metrics(filepath: Path) -> dict | None:
    """
    Extract key metrics from a FIT file for analysis.

    Args:
        filepath: Path to the FIT file

    Returns:
        Dictionary containing extracted metrics, or None if parsing fails
    """
    try:
        # Handle .fit.gz files by decompressing first
        file_to_parse = str(filepath)
        temp_file = None
        if filepath.suffix == ".gz":
            temp_file = tempfile.NamedTemporaryFile(suffix=".fit", delete=False)  # noqa: SIM115
            with gzip.open(filepath, "rb") as f_in:
                temp_file.write(f_in.read())
            temp_file.close()
            file_to_parse = temp_file.name

        try:
            # Parse FIT file with lenient settings for corrupted files
            fitfile = fitdecode.FitReader(
                file_to_parse,
                check_crc=fitdecode.CrcCheck.DISABLED,
                error_handling=fitdecode.ErrorHandling.IGNORE,
            )

            metrics = {
                "filename": filepath.name,
                "filepath": str(filepath),
                "timestamp": None,
                "duration": 0,
                "distance": 0,
                "avg_power": None,
                "max_power": None,
                "avg_hr": None,
                "max_hr": None,
                "avg_cadence": None,
                "total_ascent": None,
                "calories": None,
                "avg_speed": None,
                "max_speed": None,
            }

            # Get session data (summary)
            for frame in fitfile:
                if not isinstance(frame, fitdecode.FitDataMessage):
                    continue

                if frame.name == "session":
                    for field in frame.fields:
                        if field.name == "timestamp":
                            metrics["timestamp"] = field.value.isoformat() if field.value else None
                        elif field.name == "total_elapsed_time":
                            metrics["duration"] = field.value
                        elif field.name == "total_distance":
                            metrics["distance"] = field.value
                        elif field.name == "avg_power":
                            metrics["avg_power"] = field.value
                        elif field.name == "max_power":
                            metrics["max_power"] = field.value
                        elif field.name == "avg_heart_rate":
                            metrics["avg_hr"] = field.value
                        elif field.name == "max_heart_rate":
                            metrics["max_hr"] = field.value
                        elif field.name == "avg_cadence":
                            metrics["avg_cadence"] = field.value
                        elif field.name == "total_ascent":
                            metrics["total_ascent"] = field.value
                        elif field.name == "total_calories":
                            metrics["calories"] = field.value
                        elif field.name == "avg_speed":
                            metrics["avg_speed"] = field.value
                        elif field.name == "max_speed":
                            metrics["max_speed"] = field.value

            return metrics
        finally:
            # Clean up temp file
            if temp_file and Path(temp_file.name).exists():
                Path(temp_file.name).unlink()

    except Exception:
        return None


def calculate_activity_stats(activities: list[dict]) -> dict:
    """
    Calculate aggregate statistics from a list of activities.

    Args:
        activities: List of activity dictionaries with metrics

    Returns:
        Dictionary containing aggregate statistics
    """
    if not activities:
        return {}

    # Filter out None values for each metric
    powers = [a["avg_power"] for a in activities if a["avg_power"]]
    hrs = [a["avg_hr"] for a in activities if a["avg_hr"]]
    cadences = [a["avg_cadence"] for a in activities if a["avg_cadence"]]
    distances = [a["distance"] for a in activities if a["distance"]]
    durations = [a["duration"] for a in activities if a["duration"]]
    ascents = [a["total_ascent"] for a in activities if a["total_ascent"]]

    stats = {
        "total_activities": len(activities),
        "total_distance_km": sum(distances) / 1000 if distances else 0,
        "total_duration_hours": sum(durations) / 3600 if durations else 0,
        "total_ascent_m": sum(ascents) if ascents else 0,
        "avg_power": {
            "mean": statistics.mean(powers) if powers else None,
            "median": statistics.median(powers) if powers else None,
            "max": max(powers) if powers else None,
            "min": min(powers) if powers else None,
        }
        if powers
        else None,
        "avg_hr": {
            "mean": statistics.mean(hrs) if hrs else None,
            "median": statistics.median(hrs) if hrs else None,
            "max": max(hrs) if hrs else None,
            "min": min(hrs) if hrs else None,
        }
        if hrs
        else None,
        "avg_cadence": {
            "mean": statistics.mean(cadences) if cadences else None,
            "median": statistics.median(cadences) if cadences else None,
            "max": max(cadences) if cadences else None,
            "min": min(cadences) if cadences else None,
        }
        if cadences
        else None,
    }

    return stats


def analyze_fit_files(directory: str, output_file: str | None = None) -> str:
    """
    Analyzes FIT files in a directory to extract cycling performance metrics.

    Analyzes both outdoor rides and virtual rides, calculating aggregate statistics
    including power, heart rate, cadence, distance, and duration metrics.

    Args:
        directory: Path to organized directory containing activity_type/YYYY-MM/*.fit files
        output_file: Optional path to save detailed JSON output

    Returns:
        Summary of analysis with statistics for outdoor rides, virtual rides, and totals
    """
    import json

    base_path = Path(directory)

    if not base_path.exists():
        return f"Error: Directory {directory} does not exist"

    # Find outdoor and virtual ride directories
    outdoor_path = base_path / "ride"
    virtual_path = base_path / "virtual ride"

    outdoor_rides = []
    virtual_rides = []

    # Process outdoor rides
    if outdoor_path.exists():
        fit_files = list(outdoor_path.rglob("*.fit")) + list(outdoor_path.rglob("*.fit.gz"))
        for fit_file in fit_files:
            metrics = parse_fit_file_metrics(fit_file)
            if metrics and metrics["timestamp"]:
                metrics["activity_type"] = "outdoor_ride"
                outdoor_rides.append(metrics)

    # Process virtual rides
    if virtual_path.exists():
        fit_files = list(virtual_path.rglob("*.fit")) + list(virtual_path.rglob("*.fit.gz"))
        for fit_file in fit_files:
            metrics = parse_fit_file_metrics(fit_file)
            if metrics and metrics["timestamp"]:
                metrics["activity_type"] = "virtual_ride"
                virtual_rides.append(metrics)

    # Sort by timestamp
    outdoor_rides.sort(key=lambda x: x["timestamp"] if x["timestamp"] else "")
    virtual_rides.sort(key=lambda x: x["timestamp"] if x["timestamp"] else "")
    all_rides = outdoor_rides + virtual_rides

    # Calculate statistics
    outdoor_stats = calculate_activity_stats(outdoor_rides)
    virtual_stats = calculate_activity_stats(virtual_rides)
    total_stats = calculate_activity_stats(all_rides)

    # Build result string
    result = "FIT FILE ANALYSIS\n" + "=" * 60 + "\n"

    result += f"\nOUTDOOR RIDES: {outdoor_stats.get('total_activities', 0)}\n"
    if outdoor_stats.get("avg_power"):
        result += f"  Avg Power: {outdoor_stats['avg_power']['mean']:.1f}W (median: {outdoor_stats['avg_power']['median']:.1f}W)\n"
    if outdoor_stats.get("avg_hr"):
        result += f"  Avg HR: {outdoor_stats['avg_hr']['mean']:.1f} bpm\n"
    if outdoor_stats.get("avg_cadence"):
        result += f"  Avg Cadence: {outdoor_stats['avg_cadence']['mean']:.1f} rpm\n"
    result += f"  Total Distance: {outdoor_stats.get('total_distance_km', 0):.1f} km\n"
    result += f"  Total Duration: {outdoor_stats.get('total_duration_hours', 0):.1f} hours\n"
    result += f"  Total Ascent: {outdoor_stats.get('total_ascent_m', 0):.0f} m\n"

    result += f"\nVIRTUAL RIDES: {virtual_stats.get('total_activities', 0)}\n"
    if virtual_stats.get("avg_power"):
        result += f"  Avg Power: {virtual_stats['avg_power']['mean']:.1f}W (median: {virtual_stats['avg_power']['median']:.1f}W)\n"
    if virtual_stats.get("avg_hr"):
        result += f"  Avg HR: {virtual_stats['avg_hr']['mean']:.1f} bpm\n"
    if virtual_stats.get("avg_cadence"):
        result += f"  Avg Cadence: {virtual_stats['avg_cadence']['mean']:.1f} rpm\n"
    result += f"  Total Distance: {virtual_stats.get('total_distance_km', 0):.1f} km\n"
    result += f"  Total Duration: {virtual_stats.get('total_duration_hours', 0):.1f} hours\n"
    result += f"  Total Ascent: {virtual_stats.get('total_ascent_m', 0):.0f} m\n"

    result += f"\nTOTAL CYCLING: {total_stats.get('total_activities', 0)} activities\n"
    if total_stats.get("avg_power"):
        result += f"  Overall Avg Power: {total_stats['avg_power']['mean']:.1f}W\n"
    if total_stats.get("avg_hr"):
        result += f"  Overall Avg HR: {total_stats['avg_hr']['mean']:.1f} bpm\n"
    if total_stats.get("avg_cadence"):
        result += f"  Overall Avg Cadence: {total_stats['avg_cadence']['mean']:.1f} rpm\n"
    result += f"  Combined Distance: {total_stats.get('total_distance_km', 0):.1f} km\n"
    result += f"  Combined Duration: {total_stats.get('total_duration_hours', 0):.1f} hours\n"
    result += f"  Combined Ascent: {total_stats.get('total_ascent_m', 0):.0f} m\n"

    # Save to JSON if output_file specified
    if output_file:
        output_data = {
            "outdoor_rides": outdoor_rides,
            "virtual_rides": virtual_rides,
            "outdoor_stats": outdoor_stats,
            "virtual_stats": virtual_stats,
            "total_stats": total_stats,
            "analysis_date": datetime.now().isoformat(),
        }

        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(output_data, f, indent=2)

        result += f"\n✓ Detailed data saved to: {output_file}\n"

    result += "=" * 60
    return result
