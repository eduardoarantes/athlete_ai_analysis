"""
Service for enriching activity DataFrames with time-in-zones data from FIT files.

Handles the complete workflow of:
1. Matching activities with FIT files
2. Parsing FIT files for power/zone data
3. Adding zone columns to DataFrame
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from cycling_ai.utils.fit_matcher import find_fit_file
from cycling_ai.utils.fit_parser import has_power_data, parse_fit_zones

logger = logging.getLogger(__name__)


class ZoneEnricher:
    """
    Service for enriching activities with time-in-zones data.

    Coordinates FIT file discovery, parsing, and DataFrame enrichment.
    """

    # Zone column names to add to DataFrame
    ZONE_COLUMNS = [
        "z1_active_recovery_sec",
        "z2_endurance_sec",
        "z3_tempo_sec",
        "z4_threshold_sec",
        "z5_vo2max_sec",
        "z6_anaerobic_sec",
        "total_power_sec",
        "normalized_power",
    ]

    def __init__(self, fit_base_dir: str | Path, ftp: float):
        """
        Initialize zone enricher.

        Args:
            fit_base_dir: Base directory containing FIT files
            ftp: Functional Threshold Power in watts
        """
        self.fit_base_dir = Path(fit_base_dir)
        self.ftp = ftp

        if not self.fit_base_dir.exists():
            logger.warning(f"FIT directory does not exist: {self.fit_base_dir}")

        if self.ftp <= 0:
            logger.warning(f"Invalid FTP: {self.ftp}")

    def enrich_dataframe(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        """
        Enrich DataFrame with time-in-zones data from FIT files.

        Args:
            df: DataFrame with activities (must have Activity ID column)

        Returns:
            Tuple of (enriched_df, stats_dict) where stats contains:
            - processed_count: Total activities processed
            - fit_found_count: Activities with FIT files found
            - power_data_count: Activities with power data extracted
            - errors: List of error messages

        Raises:
            ValueError: If DataFrame missing required columns
        """
        if "Activity ID" not in df.columns:
            raise ValueError("DataFrame must have 'Activity ID' column")

        # Initialize zone columns with NaN
        for col in self.ZONE_COLUMNS:
            df[col] = pd.NA

        stats = {
            "processed_count": 0,
            "fit_found_count": 0,
            "power_data_count": 0,
            "errors": [],
        }

        # Process each activity
        for idx, row in df.iterrows():
            stats["processed_count"] += 1  # type: ignore[operator]
            activity_id = row["Activity ID"]

            try:
                # Find FIT file
                filename_hint = row.get("Filename")
                fit_file = find_fit_file(
                    activity_id=activity_id,
                    fit_base_dir=self.fit_base_dir,
                    filename_hint=filename_hint,
                )

                if not fit_file:
                    continue

                stats["fit_found_count"] += 1  # type: ignore[operator]

                # Parse FIT file for zone data
                zone_data = parse_fit_zones(fit_file, self.ftp)

                if not has_power_data(zone_data):
                    continue

                stats["power_data_count"] += 1  # type: ignore[operator]

                # Add zone data to DataFrame
                # Note: pandas-stubs doesn't fully support .at indexing with tuples
                df.at[idx, "z1_active_recovery_sec"] = zone_data["z1_active_recovery"]  # type: ignore[index]
                df.at[idx, "z2_endurance_sec"] = zone_data["z2_endurance"]  # type: ignore[index]
                df.at[idx, "z3_tempo_sec"] = zone_data["z3_tempo"]  # type: ignore[index]
                df.at[idx, "z4_threshold_sec"] = zone_data["z4_threshold"]  # type: ignore[index]
                df.at[idx, "z5_vo2max_sec"] = zone_data["z5_vo2max"]  # type: ignore[index]
                df.at[idx, "z6_anaerobic_sec"] = zone_data["z6_anaerobic"]  # type: ignore[index]
                df.at[idx, "total_power_sec"] = zone_data["total_power_seconds"]  # type: ignore[index]
                df.at[idx, "normalized_power"] = zone_data["normalized_power"]  # type: ignore[index]

            except Exception as e:
                error_msg = f"Activity {activity_id}: {str(e)}"
                logger.warning(error_msg)
                stats["errors"].append(error_msg)  # type: ignore[attr-defined]

        logger.info(
            f"Zone enrichment complete: {stats['power_data_count']}/{stats['processed_count']} "
            f"activities enriched with power data"
        )

        return df, stats

    def get_enrichment_summary(self, stats: dict[str, Any]) -> str:
        """
        Generate human-readable summary of enrichment results.

        Args:
            stats: Statistics dict from enrich_dataframe()

        Returns:
            Formatted summary string
        """
        summary_lines = [
            f"Processed {stats['processed_count']} activities",
            f"Found FIT files for {stats['fit_found_count']} activities",
            f"Extracted power data from {stats['power_data_count']} activities",
        ]

        if stats["errors"]:
            error_count = len(stats["errors"])
            summary_lines.append(f"Encountered {error_count} errors during processing")

        return "; ".join(summary_lines)
