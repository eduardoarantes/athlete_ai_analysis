"""
Performance analysis module.

This module provides comprehensive cycling performance analysis comparing time periods,
identifying trends, and generating insights from Strava CSV data.

Extracted from MCP implementation - all business logic preserved.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from .utils import analyze_period, convert_to_json_serializable, load_activities_data

logger = logging.getLogger(__name__)


def analyze_performance(
    csv_file_path: str,
    athlete_name: str = "Athlete",
    athlete_age: int | None = None,
    athlete_weight_kg: float | None = None,
    athlete_ftp: float | None = None,
    athlete_max_hr: int | None = None,
    period_months: int = 6,
    athlete_profile: Any | None = None,
) -> str:
    """
    Analyze cycling performance from Strava CSV export, comparing periods.

    Compares recent period with the equivalent prior period to identify trends and insights.
    For example, with period_months=6: compares last 6 months vs the 6 months before that.
    Provides comprehensive statistics, monthly breakdown, and best performances.

    Args:
        csv_file_path: Absolute path to the Strava activities CSV file
        athlete_name: Athlete's name (default: "Athlete")
        athlete_age: Athlete's age in years (optional)
        athlete_weight_kg: Athlete's weight in kilograms (optional)
        athlete_ftp: Athlete's Functional Threshold Power in watts (optional)
        athlete_max_hr: Athlete's maximum heart rate (optional)
        period_months: Number of months for each period in comparison (default: 6)
            - Recent period: last N months (today → N months ago)
            - Previous period: N months before that (N months ago → 2N months ago)
        athlete_profile: Optional AthleteProfile instance with extended data

    Returns:
        Formatted performance analysis as JSON string
    """
    try:
        logger.debug("Starting analyze_performance")
        logger.debug(f"csv_file_path: {csv_file_path}")
        logger.debug(f"period_months: {period_months}")

        # Load activities data - uses cache if available, otherwise loads from CSV
        # Cache significantly improves performance (~10x faster reads)
        df_clean = load_activities_data(csv_file_path)
        logger.debug(f"Loaded {len(df_clean)} activities")

        # Define time periods for comparison analysis
        # Recent period: last N months (default 6) - from N months ago to today
        # Previous period: N months prior to that - from 2N months ago to N months ago
        # Example with N=6: Recent = last 6 months, Previous = 6 months before that (months 7-12)
        # Use timezone-aware datetime to match Parquet cache (which stores dates in UTC)
        today = datetime.now(UTC)
        logger.debug(f"today: {today} (type: {type(today)})")
        period_start = today - timedelta(days=30 * period_months)
        previous_period_start = today - timedelta(days=30 * period_months * 2)
        logger.debug("Periods defined successfully")

        # Filter to only cycling activities (any activity with category 'Cycling')
        rides = df_clean[df_clean["activity_category"] == "Cycling"].copy()

        # Split activities into two comparison periods
        # Recent: activities from period_start to today (last N months)
        recent_period = rides[rides["date"] >= period_start]
        # Previous: activities from previous_period_start to period_start (N months prior)
        previous_period = rides[
            (rides["date"] >= previous_period_start) & (rides["date"] < period_start)
        ]

        # Run comprehensive analysis on both periods for comparison
        recent_stats = analyze_period(recent_period, f"Last {period_months} Months")
        prev_stats = analyze_period(previous_period, f"Previous {period_months} Months")

        # Calculate month-by-month breakdown for the recent period
        # This provides granular insight into training patterns and trends over time
        monthly_stats = []
        for i in range(int(period_months)):
            # Create rolling 30-day windows going backwards from today
            month_start = today - timedelta(days=30 * (i + 1))
            month_end = today - timedelta(days=30 * i)
            month_data = recent_period[
                (recent_period["date"] >= month_start) & (recent_period["date"] < month_end)
            ]
            # Calculate key metrics for this month
            month_stats = {
                "month": month_start.strftime("%B %Y"),
                "rides": len(month_data),
                "distance_km": month_data["distance"].sum() / 1000,
                "time_hours": month_data["moving_time"].sum() / 3600,
                "elevation_m": month_data["elevation"].sum(),
                "avg_power": (
                    month_data[month_data["avg_watts"] > 0]["avg_watts"].mean()
                    if len(month_data[month_data["avg_watts"] > 0]) > 0
                    else 0
                ),
            }
            # Insert at beginning so months are in chronological order
            monthly_stats.insert(0, month_stats)

        # Extract best performances across all rides for motivation and benchmarking
        # Top 5 rides by average power - shows peak intensity achievements
        best_power_rides = (
            rides[rides["avg_watts"] > 0]
            .nlargest(5, "avg_watts")[["date", "name", "distance", "avg_watts", "weighted_power"]]
            .to_dict("records")
        )

        # Top 10 longest rides by distance - shows endurance capacity
        longest_rides = rides.nlargest(10, "distance")[
            ["date", "name", "distance", "moving_time", "elevation", "avg_watts"]
        ].to_dict("records")

        # Format best rides for JSON (convert dates to strings)
        formatted_best_power = []
        for ride in best_power_rides:
            date_str = (
                ride["date"].strftime("%Y-%m-%d")
                if hasattr(ride["date"], "strftime")
                else str(ride["date"])
            )
            formatted_best_power.append(
                {
                    "date": date_str,
                    "name": ride["name"],
                    "distance_km": float(ride["distance"] / 1000),
                    "avg_power_w": float(ride["avg_watts"]),
                    "normalized_power_w": float(ride["weighted_power"]),
                }
            )

        formatted_longest = []
        for ride in longest_rides:
            date_str = (
                ride["date"].strftime("%Y-%m-%d")
                if hasattr(ride["date"], "strftime")
                else str(ride["date"])
            )
            formatted_longest.append(
                {
                    "date": date_str,
                    "name": ride["name"],
                    "distance_km": float(ride["distance"] / 1000),
                    "time_hours": float(ride["moving_time"] / 3600),
                    "elevation_m": float(ride["elevation"]),
                    "avg_power_w": (float(ride["avg_watts"]) if ride["avg_watts"] > 0 else None),
                }
            )

        # Build JSON response structure
        # Include full athlete profile if available for LLM analysis
        athlete_profile_data: dict[str, Any] = {
            "name": athlete_name,
            "age": athlete_age,
            "weight_kg": athlete_weight_kg,
            "ftp": athlete_ftp,
            "power_to_weight": (
                float(athlete_ftp / athlete_weight_kg)
                if (athlete_ftp and athlete_weight_kg)
                else None
            ),
            "max_hr": athlete_max_hr,
        }

        # Add extended profile data if available
        if athlete_profile:
            athlete_profile_data.update(
                {
                    "gender": athlete_profile.gender,
                    "training_availability": athlete_profile.training_availability,
                    "goals": athlete_profile.goals,
                    "current_training_status": athlete_profile.current_training_status,
                    "available_training_days": athlete_profile.get_training_days(),
                    "weekly_training_hours": athlete_profile.get_weekly_training_hours(),
                }
            )

        response_data: dict[str, Any] = {
            "athlete_profile": athlete_profile_data,
            "period_months": period_months,
            "recent_period": recent_stats,
            "previous_period": prev_stats,
            "monthly_breakdown": monthly_stats,
            "best_power_rides": formatted_best_power,
            "longest_rides": formatted_longest,
        }

        # Add trend calculations if we have comparison data
        if prev_stats["weekly_distance_km"] > 0:
            trends: dict[str, float] = {}

            # Calculate percentage changes
            trends["distance_change_pct"] = float(
                (recent_stats["weekly_distance_km"] / prev_stats["weekly_distance_km"] - 1) * 100
            )
            trends["time_change_pct"] = float(
                (recent_stats["weekly_time_hours"] / prev_stats["weekly_time_hours"] - 1) * 100
            )
            trends["elevation_change_pct"] = float(
                (recent_stats["weekly_elevation_m"] / prev_stats["weekly_elevation_m"] - 1) * 100
            )

            if prev_stats["avg_power"] > 0 and recent_stats["avg_power"] > 0:
                trends["power_change_pct"] = float(
                    (recent_stats["avg_power"] / prev_stats["avg_power"] - 1) * 100
                )

            if prev_stats["avg_hr"] > 0 and recent_stats["avg_hr"] > 0:
                trends["hr_change_pct"] = float(
                    (recent_stats["avg_hr"] / prev_stats["avg_hr"] - 1) * 100
                )

            trends["frequency_change_pct"] = float(
                (recent_stats["rides_per_week"] / prev_stats["rides_per_week"] - 1) * 100
            )

            response_data["trends"] = trends

        # Convert all numpy/pandas types to JSON-serializable types
        response_data = convert_to_json_serializable(response_data)

        # Return as JSON string
        return json.dumps(response_data, indent=2)

    except Exception as e:
        # Handle any errors gracefully and provide helpful error messages
        logger.error(f"EXCEPTION in analyze_performance: {type(e).__name__}: {e}", exc_info=True)
        error_text = f"❌ Error analyzing performance: {str(e)}\n\n"
        error_text += "Make sure the CSV file path is correct and the file is a valid Strava activities export."
        return error_text
