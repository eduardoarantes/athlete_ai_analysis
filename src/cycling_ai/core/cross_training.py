"""
Cross-training impact analysis module.

Analyzes how non-cycling activities (strength training, swimming, running, etc.)
impact cycling performance through load distribution, timing patterns, and
performance correlations.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd


@dataclass
class WeeklyLoadMetrics:
    """Weekly load distribution across activity categories."""

    week_start: datetime
    week_number: int
    total_hours: float
    total_tss: float
    cycling_hours: float
    cycling_tss: float
    cycling_percent: float
    strength_hours: float
    strength_tss: float
    strength_percent: float
    cardio_hours: float
    cardio_tss: float
    cardio_percent: float
    activity_count: int
    cycling_count: int
    strength_count: int
    cardio_count: int


@dataclass
class InterferenceEvent:
    """Represents a potential training interference event."""

    date: datetime
    activity1_name: str
    activity1_type: str
    activity1_category: str
    activity2_name: str
    activity2_type: str
    activity2_category: str
    hours_between: float
    interference_score: int
    explanation: str


def calculate_weekly_load_distribution(df: pd.DataFrame) -> list[WeeklyLoadMetrics]:
    """
    Calculate weekly load distribution across activity categories.

    Args:
        df: Activities DataFrame with cross-training classifications

    Returns:
        List of WeeklyLoadMetrics, one per week
    """
    # Ensure date is datetime
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])

    # Add week number
    df["week_start"] = df["date"] - pd.to_timedelta(df["date"].dt.dayofweek, unit="D")
    df["week_number"] = ((df["date"] - df["date"].min()).dt.days // 7) + 1

    # Calculate hours from seconds
    df["hours"] = df["elapsed_time"] / 3600

    # Use estimated_tss or calculate from duration
    df["tss"] = df.apply(
        lambda row: row["estimated_tss"]
        if row["estimated_tss"] > 0
        else row["hours"] * 50,  # Fallback estimate
        axis=1,
    )

    # Group by week
    weekly_metrics = []

    for week_start, week_data in df.groupby("week_start"):
        week_num = week_data["week_number"].iloc[0]

        # Total metrics
        total_hours = week_data["hours"].sum()
        total_tss = week_data["tss"].sum()

        # Cycling metrics
        cycling_data = week_data[week_data["activity_category"] == "Cycling"]
        cycling_hours = cycling_data["hours"].sum()
        cycling_tss = cycling_data["tss"].sum()
        cycling_percent = (cycling_tss / total_tss * 100) if total_tss > 0 else 0

        # Strength metrics
        strength_data = week_data[week_data["activity_category"] == "Strength"]
        strength_hours = strength_data["hours"].sum()
        strength_tss = strength_data["tss"].sum()
        strength_percent = (strength_tss / total_tss * 100) if total_tss > 0 else 0

        # Cardio cross-training metrics
        cardio_data = week_data[week_data["activity_category"] == "Cardio"]
        cardio_hours = cardio_data["hours"].sum()
        cardio_tss = cardio_data["tss"].sum()
        cardio_percent = (cardio_tss / total_tss * 100) if total_tss > 0 else 0

        metrics = WeeklyLoadMetrics(
            week_start=week_start,
            week_number=week_num,
            total_hours=round(total_hours, 1),
            total_tss=round(total_tss, 1),
            cycling_hours=round(cycling_hours, 1),
            cycling_tss=round(cycling_tss, 1),
            cycling_percent=round(cycling_percent, 1),
            strength_hours=round(strength_hours, 1),
            strength_tss=round(strength_tss, 1),
            strength_percent=round(strength_percent, 1),
            cardio_hours=round(cardio_hours, 1),
            cardio_tss=round(cardio_tss, 1),
            cardio_percent=round(cardio_percent, 1),
            activity_count=len(week_data),
            cycling_count=len(cycling_data),
            strength_count=len(strength_data),
            cardio_count=len(cardio_data),
        )

        weekly_metrics.append(metrics)

    return sorted(weekly_metrics, key=lambda x: x.week_start)


def detect_interference_events(
    df: pd.DataFrame, threshold_score: int = 4
) -> list[InterferenceEvent]:
    """
    Detect potential training interference events (e.g., strength before hard cycling).

    Args:
        df: Activities DataFrame with cross-training classifications
        threshold_score: Minimum interference score to report (0-10)

    Returns:
        List of InterferenceEvent objects
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    interference_events = []

    # Check sequential activities
    for i in range(len(df) - 1):
        activity1 = df.iloc[i]
        activity2 = df.iloc[i + 1]

        # Calculate hours between activities
        hours_between = (activity2["date"] - activity1["date"]).total_seconds() / 3600

        # Only check if within 72 hours
        if hours_between > 72:
            continue

        # Check for interference patterns
        score = 0
        reasons = []

        # Pattern 1: Strength before cycling
        if (
            activity1["activity_category"] == "Strength"
            and activity2["activity_category"] == "Cycling"
        ):
            if hours_between < activity1["recovery_hours"]:
                score += 5
                reasons.append(f"Strength < {activity1['recovery_hours']}h before cycling")

            # Extra penalty for leg-focused strength
            if activity1["muscle_focus"] in ["Legs", "Full Body"] and hours_between < 48:
                score += 3
                reasons.append("Leg-focused strength before cycling")

        # Pattern 2: Hard cardio (Running) before cycling
        if (
            activity1["activity_category"] == "Cardio"
            and activity1["muscle_focus"] == "Legs"
            and activity2["activity_category"] == "Cycling"
            and hours_between < 24
        ):
            score += 4
            reasons.append("Leg-focused cardio < 24h before cycling")

        # Pattern 3: High-fatigue activity before hard cycling
        if (
            activity1["fatigue_impact"] == "High"
            and activity2["activity_category"] == "Cycling"
            and activity2["intensity_category"] == "Hard"
            and hours_between < 24
        ):
            score += 2
            reasons.append("High-fatigue activity < 24h before hard cycling")

        # Record if score exceeds threshold
        if score >= threshold_score:
            event = InterferenceEvent(
                date=activity1["date"],
                activity1_name=activity1["name"],
                activity1_type=activity1["type"],
                activity1_category=activity1["activity_category"],
                activity2_name=activity2["name"],
                activity2_type=activity2["type"],
                activity2_category=activity2["activity_category"],
                hours_between=round(hours_between, 1),
                interference_score=score,
                explanation="; ".join(reasons),
            )
            interference_events.append(event)

    return interference_events


def calculate_performance_windows(df: pd.DataFrame, window_days: int = 7) -> pd.DataFrame:
    """
    Calculate rolling performance windows for correlation analysis.

    Args:
        df: Activities DataFrame
        window_days: Window size in days for rolling calculations

    Returns:
        DataFrame with rolling performance metrics
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    # Create date range for complete time series
    date_range = pd.date_range(start=df["date"].min(), end=df["date"].max(), freq="D")
    df_daily = pd.DataFrame({"date": date_range})

    # Calculate daily aggregates by category
    daily_cycling = (
        df[df["activity_category"] == "Cycling"]
        .groupby("date")
        .agg(
            {"avg_watts": "mean", "weighted_power": "mean", "avg_hr": "mean", "elapsed_time": "sum"}
        )
        .reset_index()
    )

    daily_strength = (
        df[df["activity_category"] == "Strength"]
        .groupby("date")
        .agg({"estimated_tss": "sum", "elapsed_time": "sum"})
        .reset_index()
    )

    daily_cardio = (
        df[df["activity_category"] == "Cardio"]
        .groupby("date")
        .agg({"estimated_tss": "sum", "elapsed_time": "sum"})
        .reset_index()
    )

    # Merge with date range
    df_daily = df_daily.merge(daily_cycling, on="date", how="left")
    df_daily = df_daily.merge(daily_strength, on="date", how="left", suffixes=("", "_strength"))
    df_daily = df_daily.merge(daily_cardio, on="date", how="left", suffixes=("", "_cardio"))

    # Rename columns for clarity
    if "estimated_tss" in df_daily.columns:
        df_daily.rename(columns={"estimated_tss": "strength_tss"}, inplace=True)
    if "estimated_tss_cardio" in df_daily.columns:
        df_daily.rename(columns={"estimated_tss_cardio": "cardio_tss"}, inplace=True)

    # Fill NaN with 0 for load calculations
    df_daily = df_daily.fillna(0)

    # Calculate rolling windows
    df_daily["cycling_power_7d"] = (
        df_daily["avg_watts"].rolling(window=window_days, min_periods=1).mean()
    )
    df_daily["cycling_hr_7d"] = df_daily["avg_hr"].rolling(window=window_days, min_periods=1).mean()
    df_daily["strength_tss_7d"] = (
        df_daily.get("strength_tss", pd.Series(0, index=df_daily.index))
        .rolling(window=window_days, min_periods=1)
        .sum()
    )
    df_daily["cardio_tss_7d"] = (
        df_daily.get("cardio_tss", pd.Series(0, index=df_daily.index))
        .rolling(window=window_days, min_periods=1)
        .sum()
    )
    df_daily["total_tss_7d"] = df_daily["strength_tss_7d"] + df_daily["cardio_tss_7d"]

    # Calculate HR efficiency (lower is better)
    df_daily["hr_power_ratio_7d"] = df_daily.apply(
        lambda row: row["cycling_hr_7d"] / row["cycling_power_7d"]
        if row["cycling_power_7d"] > 0
        else 0,
        axis=1,
    )

    return df_daily


def analyze_cross_training_impact(df: pd.DataFrame, analysis_period_weeks: int = 12) -> str:
    """
    Comprehensive cross-training impact analysis.

    Args:
        df: Activities DataFrame with cross-training classifications
        analysis_period_weeks: Number of weeks to analyze

    Returns:
        JSON string with structured analysis data
    """
    import json

    from .utils import convert_to_json_serializable

    # Filter to analysis period
    # Make cutoff_date timezone-aware if df['date'] is timezone-aware
    cutoff_date = datetime.now() - timedelta(weeks=analysis_period_weeks)
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])

    # If dates are timezone-aware, make cutoff timezone-aware too
    if hasattr(df["date"].dtype, "tz") and df["date"].dtype.tz is not None:
        cutoff_date = cutoff_date.replace(tzinfo=UTC)

    df_period = df[df["date"] >= cutoff_date].copy()

    if len(df_period) == 0:
        return json.dumps({"error": "No activities found in the specified period"})

    # Calculate metrics
    weekly_loads = calculate_weekly_load_distribution(df_period)
    interference_events = detect_interference_events(df_period)
    performance_windows = calculate_performance_windows(df_period)

    # Build JSON response
    response_data = {
        "analysis_period": {
            "weeks": analysis_period_weeks,
            "start_date": df_period["date"].min().strftime("%Y-%m-%d"),
            "end_date": df_period["date"].max().strftime("%Y-%m-%d"),
            "total_activities": int(len(df_period)),
        },
        "activity_distribution": [],
        "load_balance": {
            "cycling_percent": 0.0,
            "strength_percent": 0.0,
            "cardio_percent": 0.0,
            "assessment": None,
            "is_optimal": False,
            "recommendation": None,
        },
        "weekly_loads": [],
        "interference_events": [],
        "interference_analysis": {
            "total_events": len(interference_events),
            "high_interference": [],
            "medium_interference": [],
            "low_interference": [],
            "recommendations": [],
        },
        "performance_insights": {"has_power_data": False, "trend": None},
    }

    # Activity Distribution
    category_counts = df_period["activity_category"].value_counts()
    for category, count in category_counts.items():
        pct = (count / len(df_period)) * 100
        response_data["activity_distribution"].append(
            {"category": str(category), "count": int(count), "percentage": float(pct)}
        )

    # Load Balance Summary
    avg_cycling_pct = float(np.mean([w.cycling_percent for w in weekly_loads]))
    avg_strength_pct = float(np.mean([w.strength_percent for w in weekly_loads]))
    avg_cardio_pct = float(np.mean([w.cardio_percent for w in weekly_loads]))

    response_data["load_balance"]["cycling_percent"] = round(avg_cycling_pct, 2)
    response_data["load_balance"]["strength_percent"] = round(avg_strength_pct, 2)
    response_data["load_balance"]["cardio_percent"] = round(avg_cardio_pct, 2)

    # Provide context for LLM to assess balance appropriateness
    # No hard-coded "optimal" threshold - depends on athlete goals, age, gender, training status
    response_data["load_balance"]["context_for_llm"] = {
        "note": "Optimal balance varies by athlete profile and goals",
        "typical_ranges": {
            "endurance_focused": "75-90% cycling",
            "strength_focused": "60-75% cycling",
            "masters_athlete": "65-80% cycling (higher strength % beneficial)",
            "injury_prevention": "70-85% cycling",
        },
    }

    # Weekly Load Trend (last 8 weeks)
    for w in weekly_loads[-8:]:
        response_data["weekly_loads"].append(
            {
                "week_start": w.week_start.strftime("%Y-%m-%d"),
                "week_label": w.week_start.strftime("%m/%d"),
                "cycling_tss": float(w.cycling_tss),
                "strength_tss": float(w.strength_tss),
                "cardio_tss": float(w.cardio_tss),
                "total_tss": float(w.total_tss),
                "cycling_percent": float(w.cycling_percent),
                # Removed hard-coded "is_balanced" - LLM should assess based on athlete context
            }
        )

    # Interference Analysis
    if interference_events:
        high_interference = [e for e in interference_events if e.interference_score >= 7]
        medium_interference = [e for e in interference_events if 4 <= e.interference_score < 7]
        low_interference = [e for e in interference_events if e.interference_score < 4]

        # Populate interference_events list (flat structure for Pydantic model)
        # Include top 10 most significant events
        all_events_sorted = sorted(
            interference_events, key=lambda e: e.interference_score, reverse=True
        )
        for event in all_events_sorted[:10]:
            response_data["interference_events"].append(
                {
                    "date": event.date.strftime("%Y-%m-%d"),
                    "activity1": event.activity1_name,
                    "activity2": event.activity2_name,
                    "hours_between": float(event.hours_between),
                    "score": int(event.interference_score),
                    "explanation": event.explanation,
                }
            )

        # Also keep the nested structure for backward compatibility with analysis tools
        for event in high_interference[:5]:  # Top 5
            response_data["interference_analysis"]["high_interference"].append(
                {
                    "date": event.date.strftime("%Y-%m-%d"),
                    "activity1": event.activity1_name,
                    "activity2": event.activity2_name,
                    "hours_between": float(event.hours_between),
                    "score": float(event.interference_score),
                    "explanation": event.explanation,
                }
            )

        response_data["interference_analysis"]["medium_interference"] = (
            [
                {
                    "count": len(medium_interference),
                    "note": "Review spacing between strength and intense cycling sessions",
                }
            ]
            if medium_interference
            else []
        )

        response_data["interference_analysis"]["low_interference"] = (
            [{"count": len(low_interference)}] if low_interference else []
        )

        # Provide context for LLM to generate personalized scheduling recommendations
        response_data["interference_analysis"]["context_for_llm"] = {
            "note": "Optimal scheduling depends on athlete age, recovery capacity, and training phase",
            "interference_detected": True,
            "high_risk_count": len(high_interference),
            "medium_risk_count": len(medium_interference),
            "factors_to_consider": [
                "Athlete age affects recovery time between conflicting sessions",
                "Training phase (base vs peak) affects interference tolerance",
                "Available training days constrain scheduling options",
                "Gender may affect recovery patterns from strength work",
            ],
        }
    else:
        response_data["interference_analysis"]["context_for_llm"] = {
            "note": "No significant interference detected",
            "interference_detected": False,
            "assessment": "Current scheduling appears well-optimized for concurrent training",
        }

    # Performance Insights
    cycling_activities = df_period[df_period["activity_category"] == "Cycling"]
    if len(cycling_activities) > 10 and cycling_activities["avg_watts"].mean() > 0:
        response_data["performance_insights"]["has_power_data"] = True

        # Simple trend analysis
        first_half = cycling_activities.iloc[: len(cycling_activities) // 2]
        second_half = cycling_activities.iloc[len(cycling_activities) // 2 :]

        avg_power_first = float(first_half["avg_watts"].mean())
        avg_power_second = float(second_half["avg_watts"].mean())
        power_change = (
            float(((avg_power_second - avg_power_first) / avg_power_first) * 100)
            if avg_power_first > 0
            else 0
        )

        trend_status = (
            "improving" if power_change > 2 else ("declining" if power_change < -2 else "stable")
        )

        # Provide raw trend data for LLM to analyze in context
        response_data["performance_insights"]["trend"] = {
            "first_half_avg_watts": avg_power_first,
            "second_half_avg_watts": avg_power_second,
            "change_percent": power_change,
            "status": trend_status,
        }

        # Context for LLM to generate personalized interpretation
        response_data["performance_insights"]["context_for_llm"] = {
            "note": "Performance trend interpretation requires athlete context",
            "factors_to_analyze": [
                "Is the trend aligned with athlete goals and training phase?",
                "Does cross-training load explain performance changes?",
                "Is trend appropriate for athlete age and recovery capacity?",
                "Are interference patterns correlating with performance?",
                "Should training balance be adjusted based on this trend?",
            ],
        }

    response_data = convert_to_json_serializable(response_data)
    return json.dumps(response_data, indent=2)
