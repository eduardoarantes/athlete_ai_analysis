"""
Time-in-zones analysis module.

This module provides functionality to analyze actual time spent in power zones
by reading second-by-second data from FIT files. Provides accurate zone distribution
analysis with caching for performance.

Copied from performance-analyzer-mcp/server.py (lines 729-1144)
"""

import gzip
import json
from datetime import datetime, timedelta
from pathlib import Path

from fitparse import FitFile

from .utils import convert_to_json_serializable


def save_time_in_zones_cache(activities_dir: str, athlete_ftp: int, activities_data: list[dict]) -> Path:
    """
    Save per-activity time-in-zones data to cache.

    Creates a JSON file in the cache directory with detailed time-in-zone
    information for each activity, enabling fast subsequent analysis without
    re-processing .fit files.

    Args:
        activities_dir: Path to activities directory
        athlete_ftp: FTP used for zone calculations
        activities_data: List of dictionaries containing per-activity zone data

    Returns:
        Path to the saved cache file
    """
    activities_path = Path(activities_dir)
    cache_dir = activities_path.parent / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    cache_file = cache_dir / f"time_in_zones_ftp{athlete_ftp}.json"

    cache_data = {
        "version": "1.0",
        "generated": datetime.now().isoformat(),
        "athlete_ftp": athlete_ftp,
        "activities_directory": str(activities_path),
        "total_activities": len(activities_data),
        "activities": activities_data
    }

    with open(cache_file, 'w') as f:
        json.dump(cache_data, f, indent=2)

    return cache_file


def load_time_in_zones_cache(activities_dir: str, athlete_ftp: int) -> dict | None:
    """
    Load cached time-in-zones data.

    Args:
        activities_dir: Path to activities directory
        athlete_ftp: FTP used for zone calculations

    Returns:
        Cached data dictionary or None if cache doesn't exist or is invalid
    """
    activities_path = Path(activities_dir)
    cache_dir = activities_path.parent / "cache"
    cache_file = cache_dir / f"time_in_zones_ftp{athlete_ftp}.json"

    if not cache_file.exists():
        return None

    try:
        with open(cache_file) as f:
            cache_data = json.load(f)

        # Validate cache version
        if cache_data.get("version") != "1.0":
            return None

        # Validate FTP matches
        if cache_data.get("athlete_ftp") != athlete_ftp:
            return None

        return cache_data

    except (json.JSONDecodeError, KeyError):
        return None


def analyze_time_in_zones(
    activities_directory: str,
    athlete_ftp: float,
    period_months: int = 6,
    max_files: int | None = None,
    use_cache: bool = True,
    athlete_profile: any | None = None
) -> str:
    """
    Analyze actual time spent in each power zone by reading .fit files.

    This provides accurate time-in-zone analysis by reading second-by-second power data
    from .fit files, rather than using ride averages which can be misleading due to
    warm-up, cool-down, and rest periods.

    Saves per-activity data to cache for subsequent analysis.

    Args:
        activities_directory: Path to directory containing .fit/.fit.gz files
        athlete_ftp: Athlete's FTP in watts
        period_months: Number of months to analyze (default: 6)
        max_files: Optional maximum number of files to process (for testing)
        use_cache: Use cached data if available (default: True)
        athlete_profile: Optional AthleteProfile object for personalized context

    Returns:
        Formatted analysis results as JSON string including athlete profile context
    """
    activities_path = Path(activities_directory)

    # Try to load from cache first
    if use_cache:
        cached_data = load_time_in_zones_cache(activities_directory, int(athlete_ftp))
        if cached_data:
            # Filter cached data by period if needed
            cutoff_date = None
            if period_months:
                cutoff_date = datetime.now() - timedelta(days=30 * period_months)

            activities_in_period = []
            for activity in cached_data.get("activities", []):
                activity_date = datetime.fromisoformat(activity["timestamp"])
                if not cutoff_date or activity_date >= cutoff_date:
                    activities_in_period.append(activity)

            # Calculate aggregated stats from cached data
            zone_times = {
                'Z1 (Active Recovery)': 0,
                'Z2 (Endurance)': 0,
                'Z3 (Tempo)': 0,
                'Z4 (Threshold)': 0,
                'Z5 (VO2 Max)': 0
            }

            for activity in activities_in_period:
                for zone_name in zone_times:
                    zone_times[zone_name] += activity["zones"][zone_name]

            total_time = sum(zone_times.values())

            # Build JSON response from cached data
            zones_definitions = {
                'Z1 (Active Recovery)': (0, athlete_ftp * 0.6),
                'Z2 (Endurance)': (athlete_ftp * 0.6, athlete_ftp * 0.8),
                'Z3 (Tempo)': (athlete_ftp * 0.8, athlete_ftp * 0.9),
                'Z4 (Threshold)': (athlete_ftp * 0.9, athlete_ftp * 1.1),
                'Z5 (VO2 Max)': (athlete_ftp * 1.1, float('inf'))
            }

            zone_data = {}
            for zone_name, (lower, upper) in zones_definitions.items():
                zone_seconds = zone_times[zone_name]
                zone_hours = zone_seconds / 3600
                zone_pct = (zone_seconds / total_time * 100) if total_time > 0 else 0

                zone_data[zone_name] = {
                    'time_seconds': float(zone_seconds),
                    'time_hours': float(zone_hours),
                    'percentage': float(zone_pct),
                    'lower_bound': float(lower),
                    'upper_bound': float(upper) if upper != float('inf') else None
                }

            # Polarization analysis
            easy_time = zone_times['Z1 (Active Recovery)'] + zone_times['Z2 (Endurance)']
            moderate_time = zone_times['Z3 (Tempo)']
            hard_time = zone_times['Z4 (Threshold)'] + zone_times['Z5 (VO2 Max)']

            easy_pct = (easy_time / total_time * 100) if total_time > 0 else 0
            moderate_pct = (moderate_time / total_time * 100) if total_time > 0 else 0
            hard_pct = (hard_time / total_time * 100) if total_time > 0 else 0

            response_data = {
                'ftp': float(athlete_ftp),
                'period_months': period_months,
                'cache_date': cached_data['generated'],
                'activities_count': len(activities_in_period),
                'total_hours': float(total_time / 3600),
                'source': 'cached',
                'zones': zone_data,
                'z1_percent': float(zone_data['Z1 (Active Recovery)']['percentage']),
                'z2_percent': float(zone_data['Z2 (Endurance)']['percentage']),
                'z3_percent': float(zone_data['Z3 (Tempo)']['percentage']),
                'z4_percent': float(zone_data['Z4 (Threshold)']['percentage']),
                'z5_percent': float(zone_data['Z5 (VO2 Max)']['percentage']),
                'easy_percent': float(easy_pct),
                'moderate_percent': float(moderate_pct),
                'hard_percent': float(hard_pct)
            }

            response_data = convert_to_json_serializable(response_data)
            return json.dumps(response_data, indent=2)

    # No cache or cache disabled - process .fit files
    if not activities_path.exists():
        return f"❌ Error: Activities directory not found at {activities_directory}"

    # Define power zones based on FTP
    zones_definitions = {
        'Z1 (Active Recovery)': (0, athlete_ftp * 0.6),
        'Z2 (Endurance)': (athlete_ftp * 0.6, athlete_ftp * 0.8),
        'Z3 (Tempo)': (athlete_ftp * 0.8, athlete_ftp * 0.9),
        'Z4 (Threshold)': (athlete_ftp * 0.9, athlete_ftp * 1.1),
        'Z5 (VO2 Max)': (athlete_ftp * 1.1, float('inf'))
    }

    # Initialize zone counters (in seconds)
    zone_times = dict.fromkeys(zones_definitions.keys(), 0)
    total_time = 0
    files_processed = 0
    files_with_power = 0
    files_failed = 0

    # Collect per-activity data for caching
    activities_data = []

    # Calculate cutoff date if period_months is specified
    cutoff_date = None
    if period_months:
        cutoff_date = datetime.now() - timedelta(days=30 * period_months)

    # Find all .fit and .fit.gz files recursively in all subdirectories
    fit_files = list(activities_path.glob("**/*.fit")) + list(activities_path.glob("**/*.fit.gz"))

    # Sort by modification time (newest first) for efficiency if max_files is set
    fit_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)

    # Limit files if max_files is specified (useful for testing)
    if max_files:
        fit_files = fit_files[:max_files]

    # Process each .fit file
    for fit_file_path in fit_files:
        try:
            # Open file (handle both .fit and .fit.gz)
            if fit_file_path.suffix == '.gz':
                with gzip.open(fit_file_path, 'rb') as f:
                    fitfile = FitFile(f)
                    fitfile.parse()
            else:
                fitfile = FitFile(str(fit_file_path))
                fitfile.parse()

            # Check file date if period filtering is enabled
            file_timestamp = None
            for record in fitfile.get_messages('file_id'):
                for record_data in record:
                    if record_data.name == 'time_created':
                        file_timestamp = record_data.value
                        break
                if file_timestamp:
                    break

            # Skip if file is older than cutoff date
            if cutoff_date and file_timestamp:
                if isinstance(file_timestamp, datetime):
                    if file_timestamp < cutoff_date:
                        continue

            # Extract power data from record messages
            has_power_data = False
            file_zone_times = dict.fromkeys(zones_definitions.keys(), 0)

            for record in fitfile.get_messages('record'):
                power = None
                timestamp = None

                for record_data in record:
                    if record_data.name == 'power':
                        power = record_data.value
                    elif record_data.name == 'timestamp':
                        timestamp = record_data.value

                # If we have valid power data, categorize it into a zone
                if power is not None and power > 0:
                    has_power_data = True

                    # Determine which zone this power reading belongs to
                    for zone_name, (lower, upper) in zones_definitions.items():
                        if lower <= power < upper:
                            file_zone_times[zone_name] += 1  # Each record is ~1 second
                            break

            # Add this file's data to totals and save activity data
            if has_power_data:
                file_total_time = sum(file_zone_times.values())

                # Create activity data record
                activity_data = {
                    "filename": fit_file_path.name,
                    "filepath": str(fit_file_path),
                    "timestamp": file_timestamp.isoformat() if file_timestamp else None,
                    "total_time_seconds": file_total_time,
                    "zones": file_zone_times.copy(),
                    "zone_percentages": {}
                }

                # Calculate percentages for this activity
                if file_total_time > 0:
                    for zone_name in zones_definitions.keys():
                        pct = (file_zone_times[zone_name] / file_total_time) * 100
                        activity_data["zone_percentages"][zone_name] = round(pct, 2)

                activities_data.append(activity_data)

                # Add to totals
                for zone in zones_definitions.keys():
                    zone_times[zone] += file_zone_times[zone]
                    total_time += file_zone_times[zone]
                files_with_power += 1

            files_processed += 1

        except Exception:
            # Skip files that fail to parse
            files_failed += 1
            continue

    # Save cache for future use
    cache_file = None
    if activities_data:
        try:
            cache_file = save_time_in_zones_cache(activities_directory, int(athlete_ftp), activities_data)
        except Exception:
            # Don't fail if cache save fails
            pass

    # Build JSON response
    if total_time == 0:
        return json.dumps({
            'error': 'No power data found in processed files',
            'files_processed': files_processed,
            'files_with_power': files_with_power,
            'files_failed': files_failed
        }, indent=2)

    # Calculate zone data
    zone_data = {}
    for zone_name, (lower, upper) in zones_definitions.items():
        zone_seconds = zone_times[zone_name]
        zone_hours = zone_seconds / 3600
        zone_pct = (zone_seconds / total_time * 100) if total_time > 0 else 0

        zone_data[zone_name] = {
            'time_seconds': float(zone_seconds),
            'time_hours': float(zone_hours),
            'percentage': float(zone_pct),
            'lower_bound': float(lower),
            'upper_bound': float(upper) if upper != float('inf') else None
        }

    # Polarization analysis
    easy_time = zone_times['Z1 (Active Recovery)'] + zone_times['Z2 (Endurance)']
    moderate_time = zone_times['Z3 (Tempo)']
    hard_time = zone_times['Z4 (Threshold)'] + zone_times['Z5 (VO2 Max)']

    easy_pct = (easy_time / total_time * 100) if total_time > 0 else 0
    moderate_pct = (moderate_time / total_time * 100) if total_time > 0 else 0
    hard_pct = (hard_time / total_time * 100) if total_time > 0 else 0

    # Build athlete profile data for LLM context
    athlete_profile_data = {
        'ftp': float(athlete_ftp)
    }

    # Add extended profile data if available
    if athlete_profile:
        athlete_profile_data.update({
            'name': athlete_profile.name,
            'age': athlete_profile.age,
            'gender': athlete_profile.gender,
            'weight_kg': athlete_profile.weight_kg,
            'power_to_weight': float(athlete_ftp / athlete_profile.weight_kg) if athlete_profile.weight_kg else None,
            'max_hr': athlete_profile.max_hr,
            'training_availability': athlete_profile.training_availability,
            'goals': athlete_profile.goals,
            'current_training_status': athlete_profile.current_training_status,
            'available_training_days': athlete_profile.get_training_days(),
            'weekly_training_hours': athlete_profile.get_weekly_training_hours()
        })

    # Context for LLM to generate personalized zone distribution analysis
    llm_context = {
        'polarization_analysis': {
            'easy_zones': {'z1_z2': easy_pct, 'description': 'Active recovery and aerobic base building'},
            'moderate_zone': {'z3': moderate_pct, 'description': 'Tempo - often called "gray zone"'},
            'hard_zones': {'z4_z5': hard_pct, 'description': 'Threshold and VO2 max efforts'}
        },
        'interpretation_factors': {
            'age_considerations': 'Masters athletes (40+) typically benefit from higher polarization (85/5/10 or 80/10/10)',
            'goal_based': 'Endurance events favor more Z2, power events favor more threshold work',
            'training_status': 'Beginners need more Z2 base, advanced athletes can handle more intensity',
            'gender_notes': 'Women may benefit from slightly different recovery patterns between hard efforts'
        },
        'analysis_needed': [
            'Is this distribution optimal for the athlete\'s age, gender, and training status?',
            'Does it align with stated goals?',
            'Is Z3 percentage too high (indicates "junk miles")?',
            'Is hard work (Z4+Z5) percentage sustainable given age and recovery capacity?',
            'Should distribution be adjusted for goal timeline?',
            'Are there specific zone deficiencies for the target event?'
        ],
        'typical_distributions': {
            'polarized_80_20': {'easy': 80, 'moderate': 10, 'hard': 10},
            'pyramidal': {'easy': 75, 'moderate': 15, 'hard': 10},
            'threshold_focused': {'easy': 70, 'moderate': 10, 'hard': 20},
            'masters_optimal': {'easy': 85, 'moderate': 5, 'hard': 10}
        }
    }

    response_data = {
        'athlete_profile': athlete_profile_data,
        'llm_context': llm_context,
        'period_months': period_months,
        'files_processed': files_processed,
        'files_with_power': files_with_power,
        'files_failed': files_failed,
        'total_hours': float(total_time / 3600),
        'source': 'fit_files',
        'cache_saved': str(cache_file) if cache_file else None,
        'zones': zone_data,
        'z1_percent': float(zone_data['Z1 (Active Recovery)']['percentage']),
        'z2_percent': float(zone_data['Z2 (Endurance)']['percentage']),
        'z3_percent': float(zone_data['Z3 (Tempo)']['percentage']),
        'z4_percent': float(zone_data['Z4 (Threshold)']['percentage']),
        'z5_percent': float(zone_data['Z5 (VO2 Max)']['percentage']),
        'easy_percent': float(easy_pct),
        'moderate_percent': float(moderate_pct),
        'hard_percent': float(hard_pct)
    }

    response_data = convert_to_json_serializable(response_data)
    return json.dumps(response_data, indent=2)
