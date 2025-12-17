"""
FIT file parser utility using fitdecode.

This module provides pure Python FIT zone parsing using fitdecode,
which handles corrupted/imperfect FIT files (like Coros Dura) better than
the Java Garmin FIT SDK.
"""

from __future__ import annotations

import gzip
import tempfile
from pathlib import Path
from typing import Any

import fitdecode


def parse_fit_zones(fit_file_path: str | Path, ftp: float) -> dict[str, Any]:
    """
    Parse FIT file and extract time-in-zones data using fitdecode.

    Args:
        fit_file_path: Path to FIT file (.fit or .fit.gz)
        ftp: Functional Threshold Power in watts

    Returns:
        Dictionary with zone data:
        {
            "success": bool,
            "ftp": float,
            "total_power_seconds": int,
            "z1_active_recovery": int,  # seconds in Z1 (0-55% FTP)
            "z2_endurance": int,         # seconds in Z2 (56-75% FTP)
            "z3_tempo": int,             # seconds in Z3 (76-90% FTP)
            "z4_threshold": int,         # seconds in Z4 (91-105% FTP)
            "z5_vo2max": int,            # seconds in Z5 (106-120% FTP)
            "z6_anaerobic": int,         # seconds in Z6 (>120% FTP)
            "avg_power": float,
            "max_power": int,
            "normalized_power": float,
            "error": str (only if success=False)
        }
    """
    fit_path = Path(fit_file_path)

    if not fit_path.exists():
        return {"success": False, "error": f"FIT file not found: {fit_path}"}

    if ftp <= 0:
        return {"success": False, "error": f"Invalid FTP: {ftp}. Must be positive."}

    # Handle .fit.gz files by decompressing to temp file
    temp_file = None
    try:
        if fit_path.suffix == ".gz":
            temp_file = tempfile.NamedTemporaryFile(suffix=".fit", delete=False)
            with gzip.open(fit_path, "rb") as f_in:
                temp_file.write(f_in.read())
            temp_file.close()
            file_to_parse = temp_file.name
        else:
            file_to_parse = str(fit_path)

        # Initialize zone boundaries
        z1_max = ftp * 0.55
        z2_max = ftp * 0.75
        z3_max = ftp * 0.90
        z4_max = ftp * 1.05
        z5_max = ftp * 1.20

        # Initialize counters
        zones = {
            "z1_active_recovery": 0,
            "z2_endurance": 0,
            "z3_tempo": 0,
            "z4_threshold": 0,
            "z5_vo2max": 0,
            "z6_anaerobic": 0,
        }

        power_values = []
        avg_power_from_session = 0
        normalized_power_from_session = 0
        max_power = 0

        # Parse FIT file with lenient settings
        fit_reader = fitdecode.FitReader(
            file_to_parse,
            check_crc=fitdecode.CrcCheck.DISABLED,
            error_handling=fitdecode.ErrorHandling.IGNORE,
        )

        for frame in fit_reader:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue

            # Process record messages (second-by-second data)
            if frame.name == "record":
                # Extract power value
                power = None
                for field in frame.fields:
                    if field.name == "power":
                        power = field.value
                        break

                if power is not None and power > 0:
                    power_values.append(power)

                    # Track max power
                    if power > max_power:
                        max_power = power

                    # Categorize into zones
                    if power <= z1_max:
                        zones["z1_active_recovery"] += 1
                    elif power <= z2_max:
                        zones["z2_endurance"] += 1
                    elif power <= z3_max:
                        zones["z3_tempo"] += 1
                    elif power <= z4_max:
                        zones["z4_threshold"] += 1
                    elif power <= z5_max:
                        zones["z5_vo2max"] += 1
                    else:
                        zones["z6_anaerobic"] += 1

            # Process session message (summary data)
            elif frame.name == "session":
                for field in frame.fields:
                    if field.name == "avg_power" and field.value:
                        avg_power_from_session = float(field.value)
                    elif field.name == "normalized_power" and field.value:
                        normalized_power_from_session = float(field.value)

        # Calculate average power if not from session
        if avg_power_from_session == 0 and power_values:
            avg_power_from_session = sum(power_values) / len(power_values)

        return {
            "success": True,
            "ftp": ftp,
            "total_power_seconds": len(power_values),
            "z1_active_recovery": zones["z1_active_recovery"],
            "z2_endurance": zones["z2_endurance"],
            "z3_tempo": zones["z3_tempo"],
            "z4_threshold": zones["z4_threshold"],
            "z5_vo2max": zones["z5_vo2max"],
            "z6_anaerobic": zones["z6_anaerobic"],
            "avg_power": avg_power_from_session,
            "max_power": max_power,
            "normalized_power": normalized_power_from_session,
        }

    except Exception as e:
        return {"success": False, "error": f"Error parsing FIT file: {str(e)}"}
    finally:
        # Clean up temp file
        if temp_file and Path(temp_file.name).exists():
            Path(temp_file.name).unlink()


def has_power_data(zone_data: dict[str, Any]) -> bool:
    """
    Check if zone data contains actual power measurements.

    Args:
        zone_data: Result from parse_fit_zones()

    Returns:
        True if file had power data, False otherwise
    """
    return zone_data.get("success", False) and zone_data.get("total_power_seconds", 0) > 0
