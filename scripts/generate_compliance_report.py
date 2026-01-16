#!/usr/bin/env python3
"""
Generate workout compliance report with DTW alignment.

Reads workout_to_activity_mapping.csv, loads each workout from the library,
aligns actual performance with DTW, builds charts + tables, and writes
workout_comparison_report_dtw.html.
"""

import argparse
import csv
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from cycling_ai.core.compliance.aligners import DTWAligner
from cycling_ai.core.compliance.analyzer import ComplianceAnalyzer
from cycling_ai.core.compliance.coach_ai import (
    build_prompt_context,
    generate_coach_analysis,
)
from cycling_ai.core.compliance.io import (
    load_streams,
    load_workout_library,
    load_workout_steps_from_library_object,
)
from cycling_ai.core.compliance.reporting import (
    build_plotly_chart_html,
    save_comparison_report_html,
)

# Prompt paths (relative to project root)
PROMPTS_DIR = project_root / "prompts" / "default" / "1.3"
SYSTEM_PROMPT_PATH = PROMPTS_DIR / "compliance_coach_analysis_system_prompt.j2"
USER_PROMPT_PATH = PROMPTS_DIR / "compliance_coach_analysis_user_prompt.j2"
COACH_ANALYSIS_DIR = project_root / "data" / "coach_analysis"


def _parse_date(value: str) -> Optional[date]:
    """Parse date from CSV value."""
    if not value:
        return None
    cleaned = value.strip().strip('"')
    if "," in cleaned:
        cleaned = cleaned.split(",", 1)[1].strip()
    for fmt in ("%d %B %Y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def _parse_ftp(value: str) -> Optional[float]:
    """Parse FTP value from string."""
    if not value:
        return None
    import re

    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", value)
    if not match:
        return None
    return float(match.group(1))


def _load_ftp_history(path: str) -> list[tuple[date, float]]:
    """Load FTP history from CSV file."""
    entries = []
    if not os.path.exists(path):
        return entries
    with open(path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}
            ftp_value = _parse_ftp(row.get("FTP", ""))
            date_value = _parse_date(row.get("Date", ""))
            if ftp_value is None or date_value is None:
                continue
            entries.append((date_value, ftp_value))
    return sorted(entries, key=lambda item: item[0])


def _select_ftp(
    activity_date: Optional[date], ftp_history: list[tuple[date, float]], fallback: float
) -> float:
    """Select appropriate FTP based on activity date and history."""
    if not activity_date or not ftp_history:
        return fallback
    for entry_date, ftp_value in reversed(ftp_history):
        if entry_date <= activity_date:
            return ftp_value
    return ftp_history[0][1]


def _load_cached_coach_feedback(activity_id: str) -> Optional[str]:
    """Load cached coach feedback if available."""
    COACH_ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = COACH_ANALYSIS_DIR / f"{activity_id}.json"
    if not cache_path.exists():
        return None
    return cache_path.read_text()


def _save_coach_feedback_cache(activity_id: str, feedback: str) -> None:
    """Save coach feedback to cache."""
    COACH_ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = COACH_ANALYSIS_DIR / f"{activity_id}.json"
    cache_path.write_text(feedback)


def _generate_coach_feedback(context: dict) -> str:
    """Generate coach feedback using AI provider."""
    # Check if API key is available
    if not os.environ.get("OPENAI_API_KEY") and not os.environ.get("ANTHROPIC_API_KEY"):
        return "Coach feedback unavailable: No API key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)."

    try:
        # Use the generate_coach_analysis function from coach_ai module
        result = generate_coach_analysis(
            system_prompt_path=str(SYSTEM_PROMPT_PATH),
            user_prompt_path=str(USER_PROMPT_PATH),
            context=context,
            provider="anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "openai",
        )
        return result
    except Exception as exc:
        return f"Coach feedback unavailable: {exc}"


def main() -> None:
    """Main entry point for report generation."""
    parser = argparse.ArgumentParser(
        description="Generate DTW workout compliance report."
    )
    parser.add_argument(
        "--mapping-csv",
        required=True,
        help="Path to workout_to_activity_mapping.csv",
    )
    parser.add_argument(
        "--workout-library", required=True, help="Path to workout_library.json"
    )
    parser.add_argument(
        "--streams-dir",
        default="data",
        help="Directory containing *_streams.json files",
    )
    parser.add_argument(
        "--ftp", type=float, required=True, help="FTP fallback (required)"
    )
    parser.add_argument(
        "--ftp-csv", default="data/ftp.csv", help="Path to ftp.csv (optional)"
    )
    parser.add_argument(
        "--report-output",
        default="workout_comparison_report_dtw.html",
        help="Output HTML report path",
    )
    args = parser.parse_args()

    # Load FTP history
    ftp_history = _load_ftp_history(args.ftp_csv)

    # Load workout library
    library = load_workout_library(args.workout_library)

    compare_sections = []
    missing_streams = []

    # Process each workout-activity mapping
    with open(args.mapping_csv, "r") as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for row in reader:
            # Clean up row data
            row = {
                k.strip(): (v.strip() if v else "") for k, v in row.items() if k
            }
            workout_id = row.get("Workout_ID")
            activity_id = row.get("Activity_ID")
            activity_date_raw = row.get("Date", "")

            if not workout_id or not activity_id:
                continue

            # Check for streams file
            stream_path = os.path.join(args.streams_dir, f"{activity_id}_streams.json")
            if not os.path.exists(stream_path):
                missing_streams.append(stream_path)
                continue

            # Load workout from library
            workout = library.get(workout_id)
            if workout is None:
                print(f"Warning: Workout {workout_id} not found in library")
                continue

            # Parse activity date and select FTP
            activity_date = _parse_date(activity_date_raw)
            ftp_for_activity = _select_ftp(activity_date, ftp_history, args.ftp)

            # Load workout steps and actual streams
            steps, ftp = load_workout_steps_from_library_object(
                workout, ftp=ftp_for_activity
            )
            actual_streams = load_streams(stream_path)

            # Initialize analyzer
            analyzer = ComplianceAnalyzer(ftp=ftp)

            # Expand planned power and get actual power
            planned_power = analyzer._expand_steps_to_seconds(steps)
            actual_power = [p.power for p in actual_streams]

            # Find interval anchors
            planned_anchor, actual_anchor = analyzer.find_interval_anchors(
                planned_power, actual_power
            )

            # Perform DTW alignment
            dtw_aligner = DTWAligner(downsample=4, anchor=False)
            aligned_series = dtw_aligner.align_with_anchors(
                planned_power, actual_power, planned_anchor, actual_anchor
            )

            # Analyze compliance with aligned series
            workout_name = workout.get("name", workout_id)
            results = analyzer.analyze_with_aligned_series(steps, aligned_series)

            # Build context for coach analysis
            context = build_prompt_context(
                activity_id=int(activity_id),
                workout_id=workout_id,
                workout=workout,
                results=results,
                streams=actual_streams,
                ftp=ftp,
                alignment={
                    "model": "DTW Align (Constrained)",
                    "params": (
                        f"downsample=4, window={dtw_aligner.window}, "
                        f"penalty={dtw_aligner.penalty}, psi={dtw_aligner.psi}, "
                        f"anchor={dtw_aligner.anchor}, "
                        "anchor_search=high_ratio=0.9,min_run=45,search_window=600"
                    ),
                    "notes": f"planned_anchor={planned_anchor}, actual_anchor={actual_anchor}",
                },
                activity_meta={
                    "date": activity_date_raw or "Unknown",
                },
            )

            # Generate or load cached coach feedback
            cached_feedback = _load_cached_coach_feedback(activity_id)
            if cached_feedback:
                print(f"Using cached coach feedback for activity {activity_id}")
                coach_feedback = cached_feedback
            else:
                print(f"Generating coach feedback for activity {activity_id}...")
                coach_feedback = _generate_coach_feedback(context)
                if not coach_feedback.startswith("Coach feedback unavailable"):
                    _save_coach_feedback_cache(activity_id, coach_feedback)

            # Build comparison section
            compare_sections.append(
                {
                    "title": workout_name,
                    "workout_definition": workout,
                    "coach_feedback": coach_feedback,
                    "algorithms": [
                        {
                            "name": "DTW Align (Constrained)",
                            "chart_html": build_plotly_chart_html(
                                steps,
                                actual_streams,
                                analyzer,
                                aligned_actual=aligned_series,
                            ),
                            "results": results,
                            "ftp": ftp,
                        }
                    ],
                }
            )

    if not compare_sections:
        parser.error("No matching streams found for mapping file.")

    # Save report
    save_comparison_report_html(args.report_output, compare_sections)
    print(f"\n✓ Report generated: {args.report_output}")
    print(f"  Processed {len(compare_sections)} workout(s)")

    if missing_streams:
        print("\n⚠ Missing stream files:")
        for stream in missing_streams:
            print(f"  - {stream}")


if __name__ == "__main__":
    main()
