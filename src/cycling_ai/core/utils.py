"""
Shared utility functions for cycling analysis.

This module contains common utilities used by multiple analysis tools:
- Cache management (Parquet caching for fast CSV reads)
- Data loading and cleaning
- Period analysis and statistics calculation
- Text formatting

Copied from performance-analyzer-mcp/server.py (lines 40-364)
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


def convert_to_json_serializable(obj: Any) -> Any:
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif pd.isna(obj):
        return None
    return obj


def get_cache_dir(csv_file_path: str) -> Path:
    """
    Get the cache directory path for a given CSV file.

    Cache directory is created at the same level as the CSV file in a 'cache/' folder.

    Args:
        csv_file_path: Path to the CSV file

    Returns:
        Path object pointing to the cache directory
    """
    csv_path = Path(csv_file_path)
    cache_dir = csv_path.parent / "cache"
    return cache_dir


def needs_cache_refresh(csv_file_path: str, cache_dir: Path) -> bool:
    """
    Check if the cache needs to be refreshed based on source file modification time.

    Returns True if:
    - Cache doesn't exist
    - Metadata file doesn't exist
    - CSV file is newer than the cache
    - Cache files are corrupted

    Args:
        csv_file_path: Path to the source CSV file
        cache_dir: Path to the cache directory

    Returns:
        True if cache needs refresh, False if cache is valid
    """
    metadata_path = cache_dir / "cache_metadata.json"
    parquet_path = cache_dir / "activities_processed.parquet"

    # Cache doesn't exist
    if not cache_dir.exists() or not metadata_path.exists() or not parquet_path.exists():
        return True

    try:
        # Load metadata
        with open(metadata_path) as f:
            metadata = json.load(f)

        # Check if CSV file has been modified since cache was created
        csv_mtime = os.path.getmtime(csv_file_path)
        cache_mtime = datetime.fromisoformat(metadata['source_file_mtime']).timestamp()

        return csv_mtime > cache_mtime

    except (json.JSONDecodeError, KeyError, ValueError):
        # Corrupted metadata, needs refresh
        return True


def load_csv_data(csv_file_path: str) -> pd.DataFrame:
    """
    Load and clean activities data from Strava CSV export.

    Handles Strava's duplicate column names by using positional indexing.
    Converts all columns to appropriate data types.

    Args:
        csv_file_path: Path to the Strava activities CSV file

    Returns:
        Cleaned DataFrame with standardized column names
    """
    # Read the CSV file exported from Strava
    df = pd.read_csv(csv_file_path, low_memory=False)

    # Map columns by position to handle duplicate column names
    df_clean = pd.DataFrame()
    df_clean['date'] = pd.to_datetime(df.iloc[:, 1])
    df_clean['name'] = df.iloc[:, 2].astype(str)
    df_clean['type'] = df.iloc[:, 3].astype('category')
    df_clean['elapsed_time'] = pd.to_numeric(df.iloc[:, 15], errors='coerce').fillna(0)
    df_clean['moving_time'] = pd.to_numeric(df.iloc[:, 16], errors='coerce').fillna(0)
    df_clean['distance'] = pd.to_numeric(df.iloc[:, 17], errors='coerce').fillna(0)
    df_clean['elevation'] = pd.to_numeric(df.iloc[:, 20], errors='coerce').fillna(0)
    df_clean['avg_hr'] = pd.to_numeric(df.iloc[:, 31], errors='coerce').fillna(0)
    df_clean['max_hr'] = pd.to_numeric(df.iloc[:, 30], errors='coerce').fillna(0)
    df_clean['avg_watts'] = pd.to_numeric(df.iloc[:, 33], errors='coerce').fillna(0)
    df_clean['max_watts'] = pd.to_numeric(df.iloc[:, 32], errors='coerce').fillna(0)
    df_clean['avg_cadence'] = pd.to_numeric(df.iloc[:, 29], errors='coerce').fillna(0)
    df_clean['avg_speed'] = pd.to_numeric(df.iloc[:, 19], errors='coerce').fillna(0)
    df_clean['weighted_power'] = pd.to_numeric(df.iloc[:, 46], errors='coerce').fillna(0)

    # Add activity_category if present (column 47)
    if df.shape[1] > 47:
        df_clean['activity_category'] = df.iloc[:, 47].astype(str)
    else:
        # Fallback: derive from activity type
        df_clean['activity_category'] = df_clean['type'].apply(
            lambda x: 'Cycling' if 'Ride' in str(x) else 'Other'
        )

    # Clean up - remove invalid dates and sort
    df_clean = df_clean.dropna(subset=['date'])
    df_clean = df_clean.sort_values('date', ascending=False)

    return df_clean


def create_cache(csv_file_path: str) -> tuple[Path, dict[str, Any]]:
    """
    Create a Parquet cache from the CSV file with metadata.

    This significantly speeds up subsequent reads by:
    - Using columnar Parquet format (5-10x faster reads)
    - Pre-parsing and cleaning data types
    - Compressing data (50-70% size reduction)

    Args:
        csv_file_path: Path to the source CSV file

    Returns:
        Tuple of (cache_dir_path, metadata_dict)
    """
    cache_dir = get_cache_dir(csv_file_path)

    # Create cache directory if it doesn't exist
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Load and clean data
    df_clean = load_csv_data(csv_file_path)

    # Save to Parquet format
    parquet_path = cache_dir / "activities_processed.parquet"
    df_clean.to_parquet(parquet_path, engine='pyarrow', compression='snappy', index=False)

    # Create metadata
    csv_path = Path(csv_file_path)
    csv_stat = os.stat(csv_file_path)

    metadata = {
        "version": "1.0",
        "source_file": csv_path.name,
        "source_file_size": csv_stat.st_size,
        "source_file_mtime": datetime.fromtimestamp(csv_stat.st_mtime).isoformat(),
        "cache_created": datetime.now().isoformat(),
        "total_activities": len(df_clean),
        "date_range": {
            "first": df_clean['date'].min().strftime('%Y-%m-%d'),
            "last": df_clean['date'].max().strftime('%Y-%m-%d')
        }
    }

    # Save metadata
    metadata_path = cache_dir / "cache_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    # Create README
    readme_path = cache_dir / "README.txt"
    with open(readme_path, 'w') as f:
        f.write("Performance Analyzer MCP Cache Directory\n")
        f.write("=" * 50 + "\n\n")
        f.write("This directory contains cached, processed activity data\n")
        f.write("for faster analysis performance.\n\n")
        f.write("Files:\n")
        f.write("- activities_processed.parquet: Optimized data in Parquet format\n")
        f.write("- cache_metadata.json: Cache validation and info\n")
        f.write("- README.txt: This file\n\n")
        f.write("This cache is automatically managed. You can safely delete\n")
        f.write("this directory - it will be recreated when needed.\n")

    return cache_dir, metadata


def load_activities_data(csv_file_path: str) -> pd.DataFrame:
    """
    Load activities data, using cache if available and valid.

    This function checks if a valid cache exists and uses it for fast loading.
    If cache doesn't exist or is invalid, it loads from CSV and creates cache.

    Args:
        csv_file_path: Path to the Strava activities CSV file

    Returns:
        DataFrame with cleaned activity data
    """
    cache_dir = get_cache_dir(csv_file_path)
    parquet_path = cache_dir / "activities_processed.parquet"

    # Check if cache exists and is valid
    if not needs_cache_refresh(csv_file_path, cache_dir):
        try:
            # Load from cache
            return pd.read_parquet(parquet_path, engine='pyarrow')
        except Exception:
            # Cache corrupted, will recreate below
            pass

    # Cache doesn't exist, is invalid, or corrupted - load from CSV
    return load_csv_data(csv_file_path)


def analyze_period(data: pd.DataFrame, period_name: str) -> dict[str, Any]:
    """
    Analyze cycling performance metrics for a specific time period.

    This function calculates comprehensive statistics including volume (distance, time, elevation),
    intensity (power, heart rate, speed), consistency (rides per week), and ride distribution
    (long/medium/short, indoor/outdoor).

    Args:
        data: DataFrame containing cycling activity data with columns for distance, time,
              elevation, power, heart rate, cadence, speed, etc.
        period_name: Human-readable name for this period (e.g., "Last 6 Months")

    Returns:
        Dictionary containing all calculated statistics for the period including:
        - Volume metrics: total/avg distance, time, elevation
        - Intensity metrics: avg/max power, heart rate, speed
        - Consistency: rides per week
        - Distribution: long/medium/short rides, indoor/outdoor split
    """
    # Initialize basic volume statistics
    stats: dict[str, Any] = {
        'period': period_name,
        'total_rides': len(data),
        'total_distance_km': data['distance'].sum() / 1000,
        'total_time_hours': data['moving_time'].sum() / 3600,
        'total_elevation_m': data['elevation'].sum(),
    }

    # Calculate average metrics if there are any rides in this period
    if len(data) > 0:
        stats['avg_distance_km'] = data['distance'].mean() / 1000
        stats['avg_time_hours'] = data['moving_time'].mean() / 3600
        stats['avg_speed_kmh'] = data['avg_speed'].mean() * 3.6 if data['avg_speed'].mean() > 0 else 0
        stats['max_distance_km'] = data['distance'].max() / 1000
    else:
        # Set defaults for periods with no rides
        stats['avg_distance_km'] = 0
        stats['avg_time_hours'] = 0
        stats['avg_speed_kmh'] = 0
        stats['max_distance_km'] = 0

    # Power analysis - only analyze rides that have power data (power meter equipped)
    power_data = data[data['avg_watts'] > 0]
    if len(power_data) > 0:
        stats['avg_power'] = power_data['avg_watts'].mean()
        stats['max_power'] = power_data['max_watts'].max()
        stats['weighted_avg_power'] = power_data['weighted_power'].mean()
        stats['power_rides'] = len(power_data)
        stats['normalized_power'] = power_data['weighted_power'].mean()
    else:
        stats['avg_power'] = 0
        stats['max_power'] = 0
        stats['weighted_avg_power'] = 0
        stats['power_rides'] = 0
        stats['normalized_power'] = 0

    # Heart rate analysis - only analyze rides with HR monitor data
    hr_data = data[data['avg_hr'] > 0]
    if len(hr_data) > 0:
        stats['avg_hr'] = hr_data['avg_hr'].mean()
        stats['max_hr'] = hr_data['max_hr'].max()
        stats['hr_rides'] = len(hr_data)
    else:
        stats['avg_hr'] = 0
        stats['max_hr'] = 0
        stats['hr_rides'] = 0

    # Cadence analysis - only analyze rides with cadence sensor data
    cadence_data = data[data['avg_cadence'] > 0]
    if len(cadence_data) > 0:
        stats['avg_cadence'] = cadence_data['avg_cadence'].mean()
        stats['cadence_rides'] = len(cadence_data)
    else:
        stats['avg_cadence'] = 0
        stats['cadence_rides'] = 0

    # Consistency analysis - calculate average rides per week over the period
    if len(data) > 0:
        date_range = (data['date'].max() - data['date'].min()).days
        weeks = max(date_range / 7, 1)
        stats['rides_per_week'] = len(data) / weeks

        # Calculate weekly averages for all key metrics
        stats['weekly_distance_km'] = stats['total_distance_km'] / weeks
        stats['weekly_time_hours'] = stats['total_time_hours'] / weeks
        stats['weekly_elevation_m'] = stats['total_elevation_m'] / weeks
    else:
        stats['rides_per_week'] = 0
        stats['weekly_distance_km'] = 0
        stats['weekly_time_hours'] = 0
        stats['weekly_elevation_m'] = 0

    # Ride distribution by distance - categorize rides into long/medium/short
    # Long rides: > 80km, Medium: 40-80km, Short: < 40km
    stats['long_rides'] = len(data[data['distance'] > 80000])
    stats['medium_rides'] = len(data[(data['distance'] >= 40000) & (data['distance'] <= 80000)])
    stats['short_rides'] = len(data[data['distance'] < 40000])

    # Indoor vs Outdoor split - useful for understanding training environment preferences
    # Virtual Ride is indoor, all other cycling types are outdoor
    stats['indoor_rides'] = len(data[data['type'] == 'Virtual Ride'])
    stats['outdoor_rides'] = len(data[data['type'] != 'Virtual Ride'])

    return stats


def format_stats_text(stats: dict[str, Any]) -> str:
    """
    Format performance statistics into human-readable markdown text with emoji icons.

    Takes the raw statistics dictionary from analyze_period() and converts it into
    a nicely formatted markdown string with sections for distance, time, elevation,
    speed, power, heart rate, cadence, frequency, and ride distribution.

    Args:
        stats: Dictionary of performance statistics from analyze_period()

    Returns:
        Formatted markdown string with emoji icons and organized metrics
    """
    text = f"\n**{stats['period']}** ({stats['total_rides']} rides)\n"
    text += f"📏 Distance: {stats['total_distance_km']:.0f} km total, {stats['weekly_distance_km']:.1f} km/week, {stats['avg_distance_km']:.1f} km/ride\n"
    text += f"⏱️ Time: {stats['total_time_hours']:.0f} hours total, {stats['weekly_time_hours']:.1f} hrs/week, {stats['avg_time_hours']:.1f} hrs/ride\n"
    text += f"⛰️ Elevation: {stats['total_elevation_m']:.0f} m total, {stats['weekly_elevation_m']:.0f} m/week\n"
    text += f"🚀 Speed: {stats['avg_speed_kmh']:.1f} km/h avg\n"

    if stats['power_rides'] > 0:
        text += f"⚡ Power: {stats['avg_power']:.0f} W avg, {stats['max_power']:.0f} W max ({stats['power_rides']} rides)\n"
        text += f"💪 Normalized Power: {stats['normalized_power']:.0f} W\n"

    if stats['hr_rides'] > 0:
        text += f"❤️ Heart Rate: {stats['avg_hr']:.0f} bpm avg, {stats['max_hr']:.0f} bpm max ({stats['hr_rides']} rides)\n"

    if stats['cadence_rides'] > 0:
        text += f"🔄 Cadence: {stats['avg_cadence']:.0f} rpm avg ({stats['cadence_rides']} rides)\n"

    text += f"📊 Frequency: {stats['rides_per_week']:.1f} rides/week\n"
    text += f"🏠 Location: {stats['indoor_rides']} indoor / {stats['outdoor_rides']} outdoor\n"
    text += f"📦 Distribution: {stats['long_rides']} long (>80km) / {stats['medium_rides']} medium (40-80km) / {stats['short_rides']} short (<40km)\n"

    return text
