"""
Cache preparation tool for Phase 1: Data Preparation.

Creates optimized Parquet cache from FIT files for fast downstream analysis.
Supports two modes:
- FIT-only mode (RECOMMENDED): Builds activities DataFrame directly from FIT files
- CSV mode (LEGACY): Reads activities CSV file and optionally enriches with FIT zone data
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from cycling_ai.tools.base import BaseTool, ToolDefinition, ToolExecutionResult, ToolParameter
from cycling_ai.tools.registry import register_tool


class CachePreparationTool(BaseTool):
    """
    Tool for creating optimized Parquet cache from FIT files.

    Supports two modes:
    - FIT-only mode (RECOMMENDED): Builds DataFrame from FIT files with zones and cross-training data
    - CSV mode (LEGACY): Converts CSV to Parquet with optional zone enrichment from FIT files
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="prepare_cache",
            description=(
                "Create optimized Parquet cache from FIT files. Supports two modes: "
                "1) FIT-only mode (RECOMMENDED): Builds activities DataFrame from FIT files with zones and cross-training data. "
                "2) CSV mode (LEGACY): Converts CSV to Parquet with optional zone enrichment from FIT files. "
                "Both modes create optimized Parquet with proper data types, compression, and indexing. "
                "Cache location: 'cache/' subdirectory next to CSV (CSV mode) or in output directory (FIT-only)."
            ),
            category="data_prep",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description="Absolute path to activities CSV file (LEGACY: optional for FIT-only mode)",
                    required=False,
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description="Absolute path to athlete profile JSON (for metadata and FTP)",
                    required=True,
                ),
                ToolParameter(
                    name="fit_dir_path",
                    type="string",
                    description="Path to directory containing FIT files (required for FIT-only mode, optional for CSV mode zone enrichment)",
                    required=False,
                ),
                ToolParameter(
                    name="output_dir_path",
                    type="string",
                    description="Output directory for cache (used in FIT-only mode when no CSV path provided)",
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Cache creation report with file paths and statistics",
            },
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute cache preparation with optional zone enrichment.

        Supports two modes:
        - CSV mode: csv_file_path provided, builds cache from CSV + optional FIT enrichment
        - FIT-only mode: no CSV, builds cache from FIT files using output_dir_path

        Args:
            csv_file_path: Optional path to CSV file (not needed for FIT-only mode)
            athlete_profile_path: Path to athlete profile JSON (must contain FTP for zones)
            fit_dir_path: Path to FIT files (required for FIT-only, optional for CSV mode)
            output_dir_path: Output directory for cache (used in FIT-only mode)

        Returns:
            Cache creation report with file paths, statistics, and enrichment details
        """
        csv_path = Path(kwargs["csv_file_path"]) if kwargs.get("csv_file_path") else None
        profile_path = Path(kwargs["athlete_profile_path"])
        fit_dir_path = kwargs.get("fit_dir_path")
        output_dir_path = kwargs.get("output_dir_path")

        # Determine mode
        fit_only_mode = csv_path is None

        # Determine cache directory location
        if fit_only_mode:
            # FIT-only mode: use output_dir/cache
            if not output_dir_path:
                return ToolExecutionResult(
                    success=False,
                    data={"success": False, "error": "FIT-only mode requires output_dir_path"},
                    format="json",
                    errors=["FIT-only mode requires output_dir_path parameter"]
                )
            cache_dir = Path(output_dir_path) / "cache"
        else:
            # CSV mode: use CSV parent dir / cache
            cache_dir = csv_path.parent / "cache"

        cache_dir.mkdir(parents=True, exist_ok=True)

        parquet_path = cache_dir / "activities_processed.parquet"
        metadata_path = cache_dir / "cache_metadata.json"

        try:
            # Load data based on mode
            if fit_only_mode:
                # FIT-only mode: build DataFrame from FIT files
                if not fit_dir_path:
                    return ToolExecutionResult(
                        success=False,
                        data={"success": False, "error": "FIT-only mode requires fit_dir_path"},
                        format="json",
                        errors=["FIT-only mode requires fit_dir_path parameter"]
                    )

                from cycling_ai.utils.fit_metadata_extractor import scan_fit_directory

                # Scan FIT directory and build DataFrame
                activities_list = scan_fit_directory(fit_dir_path)
                if not activities_list:
                    return ToolExecutionResult(
                        success=False,
                        data={"success": False, "error": "No FIT files found or metadata extraction failed"},
                        format="json",
                        errors=["No valid FIT files found in directory"]
                    )

                df = pd.DataFrame(activities_list)
                original_count = len(df)
                original_size = 0  # No CSV file to measure
            else:
                # CSV mode: read from CSV
                df = pd.read_csv(csv_path)
                original_count = len(df)
                original_size = csv_path.stat().st_size

            # Parse Activity Date as datetime
            if "Activity Date" in df.columns:
                df["Activity Date"] = pd.to_datetime(df["Activity Date"], format='mixed', errors='coerce')

            # Convert numeric columns with proper handling
            numeric_columns = [
                "Distance", "Moving Time", "Elapsed Time",
                "Elevation Gain", "Elevation Loss",
                "Average Speed", "Max Speed",
                "Average Heart Rate", "Max Heart Rate",
                "Average Watts", "Max Watts", "Weighted Average Power",
                "Average Cadence", "Max Cadence",
                "Calories"
            ]

            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Load profile for FTP
            try:
                with open(profile_path, 'r') as f:
                    profile = json.load(f)

                # Handle different FTP field names and formats
                ftp_raw = profile.get("ftp") or profile.get("FTP") or 0
                if isinstance(ftp_raw, str):
                    # Parse "260w" or "260" to float
                    ftp = float(ftp_raw.replace("w", "").replace("W", "").strip())
                else:
                    ftp = float(ftp_raw)
            except Exception:
                ftp = 0

            # Cross-training categorization (add activity_category, muscle_focus, etc.)
            categorization_summary = None
            try:
                from cycling_ai.utils.activity_categorizer import (
                    categorize_activity,
                    estimate_tss_from_activity
                )

                # Add cross-training metadata columns
                if "sport" in df.columns:
                    # Categorize each activity
                    categories = []
                    muscle_focuses = []
                    fatigue_impacts = []
                    recovery_hours_list = []
                    estimated_tss_list = []

                    for _, row in df.iterrows():
                        sport = row.get("sport", "cycling")
                        sub_sport = row.get("sub_sport")

                        cat = categorize_activity(sport, sub_sport)
                        categories.append(cat.category)
                        muscle_focuses.append(cat.muscle_focus)
                        fatigue_impacts.append(cat.fatigue_impact)
                        recovery_hours_list.append(cat.recovery_hours)

                        # Estimate TSS for non-cycling activities
                        if cat.category != "Cycling":
                            tss = estimate_tss_from_activity(
                                category=cat,
                                duration_seconds=row.get("Elapsed Time", 0),
                                avg_hr=row.get("Average Heart Rate"),
                                max_hr=row.get("Max Heart Rate"),
                                athlete_max_hr=profile.get("max_hr", 185)
                            )
                            estimated_tss_list.append(tss)
                        else:
                            # Cycling TSS will come from zone enrichment or power-based calc
                            estimated_tss_list.append(0)

                    df["activity_category"] = categories
                    df["muscle_focus"] = muscle_focuses
                    df["fatigue_impact"] = fatigue_impacts
                    df["recovery_hours"] = recovery_hours_list
                    df["estimated_tss"] = estimated_tss_list

                    # Count activities by category
                    category_counts = df["activity_category"].value_counts().to_dict()
                    categorization_summary = f"Categorized: {', '.join([f'{count} {cat}' for cat, count in category_counts.items()])}"
                else:
                    categorization_summary = "No sport metadata available for categorization"

            except Exception as e:
                categorization_summary = f"Categorization failed: {str(e)}"

            # Zone enrichment (optional, cycling only)
            zone_enriched = False
            enrichment_summary = None
            if fit_dir_path and ftp > 0:
                try:
                    from cycling_ai.utils.zone_enricher import ZoneEnricher

                    enricher = ZoneEnricher(fit_base_dir=fit_dir_path, ftp=ftp)
                    df, enrich_stats = enricher.enrich_dataframe(df)
                    zone_enriched = enrich_stats["power_data_count"] > 0
                    enrichment_summary = enricher.get_enrichment_summary(enrich_stats)
                except Exception as e:
                    # Zone enrichment is optional, continue without it
                    enrichment_summary = f"Zone enrichment failed: {str(e)}"

            # Add intensity categorization for interference detection
            # Uses TSS, normalized power, and duration to classify activities as Easy/Moderate/Hard
            try:
                intensity_categories = []
                for _, row in df.iterrows():
                    category = row.get("activity_category", "Other")

                    if category == "Cycling":
                        # For cycling: use normalized power / FTP if available
                        np_val = row.get("normalized_power", 0)
                        if np_val and not pd.isna(np_val) and np_val > 0 and ftp > 0:
                            intensity_factor = np_val / ftp
                            if intensity_factor >= 0.95:
                                intensity_categories.append("Hard")
                            elif intensity_factor >= 0.75:
                                intensity_categories.append("Moderate")
                            else:
                                intensity_categories.append("Easy")
                        else:
                            # Fallback: use duration (long rides are typically easier)
                            duration_hours = row.get("Elapsed Time", 0) / 3600
                            if duration_hours >= 2.5:
                                intensity_categories.append("Easy")  # Long endurance rides
                            else:
                                intensity_categories.append("Moderate")  # Unknown intensity
                    else:
                        # For non-cycling: use TSS/hour ratio
                        tss = row.get("estimated_tss", 0)
                        duration_hours = row.get("Elapsed Time", 0) / 3600
                        if duration_hours > 0 and tss > 0:
                            tss_per_hour = tss / duration_hours
                            if tss_per_hour >= 60:
                                intensity_categories.append("Hard")
                            elif tss_per_hour >= 40:
                                intensity_categories.append("Moderate")
                            else:
                                intensity_categories.append("Easy")
                        else:
                            intensity_categories.append("Moderate")  # Default

                df["intensity_category"] = intensity_categories
            except Exception as e:
                # Intensity categorization is optional
                df["intensity_category"] = "Moderate"  # Default fallback

            # Write to Parquet with compression
            df.to_parquet(
                parquet_path,
                engine='pyarrow',
                compression='snappy',
                index=False
            )

            parquet_size = parquet_path.stat().st_size
            compression_ratio = (1 - parquet_size / original_size) * 100 if original_size > 0 else 0

            # Create metadata
            metadata = {
                "version": "3.0",  # v3.0: added cross-training categorization
                "created_at": datetime.now().isoformat(),
                "fit_only_mode": fit_only_mode,
                "source_csv": str(csv_path) if csv_path else None,
                "source_file_mtime": datetime.fromtimestamp(csv_path.stat().st_mtime).isoformat() if csv_path else None,
                "source_fit_dir": str(fit_dir_path) if fit_dir_path else None,
                "activity_count": original_count,
                "original_size_bytes": original_size,
                "cache_size_bytes": parquet_size,
                "compression_ratio_percent": round(compression_ratio, 1) if original_size > 0 else 0,
                "cross_training_categorized": categorization_summary is not None and "failed" not in categorization_summary.lower(),
                "categorization_summary": categorization_summary,
                "zone_enriched": zone_enriched,
                "ftp_watts": ftp,
                "enrichment_summary": enrichment_summary,
            }

            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            # Get date range
            if "Activity Date" in df.columns and not df["Activity Date"].isna().all():
                min_date = df["Activity Date"].min().strftime('%Y-%m-%d')
                max_date = df["Activity Date"].max().strftime('%Y-%m-%d')
            else:
                min_date = "Unknown"
                max_date = "Unknown"

            # Build success message
            if fit_only_mode:
                message_parts = [
                    f"✅ Cache created successfully from FIT files! {original_count} activities cached.",
                    f"Cache size: {round(parquet_size/1024, 1)}KB."
                ]
            else:
                message_parts = [
                    f"✅ Cache created successfully! {original_count} activities cached.",
                    f"Compression: {compression_ratio:.1f}% reduction "
                    f"({round(original_size/1024, 1)}KB → {round(parquet_size/1024, 1)}KB)."
                ]

            # Add categorization info
            if categorization_summary:
                message_parts.append(f"{categorization_summary}")

            # Add zone enrichment info
            if zone_enriched and enrichment_summary:
                message_parts.append(f"Zone enrichment: {enrichment_summary}")
            elif fit_dir_path and ftp > 0 and not fit_only_mode:
                # Only mention "attempted" for CSV mode with optional FIT enrichment
                message_parts.append(
                    f"Zone enrichment attempted but no power data found. "
                    f"Reason: {enrichment_summary or 'Unknown'}"
                )
            elif not fit_dir_path and not fit_only_mode:
                message_parts.append("Zone enrichment skipped (no FIT directory provided).")
            elif ftp <= 0 and not fit_only_mode:
                message_parts.append("Zone enrichment skipped (FTP not set in profile).")

            result_data = {
                "success": True,
                "cache_path": str(parquet_path),
                "metadata_path": str(metadata_path),
                "activity_count": original_count,
                "date_range": f"{min_date} to {max_date}",
                "original_size_kb": round(original_size / 1024, 1),
                "cache_size_kb": round(parquet_size / 1024, 1),
                "compression_percent": round(compression_ratio, 1),
                "zone_enriched": zone_enriched,
                "enrichment_summary": enrichment_summary,
                "message": " ".join(message_parts)
            }
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json"
            )

        except Exception as e:
            error_data = {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to create cache: {str(e)}"
            }
            return ToolExecutionResult(
                success=False,
                data=error_data,
                format="json",
                errors=[str(e)]
            )


# Register tool on module import
register_tool(CachePreparationTool())
