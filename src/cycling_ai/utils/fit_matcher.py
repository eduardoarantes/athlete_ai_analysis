"""
Utility for matching CSV activity records with FIT files.

Handles different file naming conventions and directory structures.
"""
from __future__ import annotations

from pathlib import Path


def find_fit_file(
    activity_id: int | str,
    fit_base_dir: Path,
    filename_hint: str | None = None
) -> Path | None:
    """
    Find FIT file for a given activity.

    Tries multiple strategies:
    1. Use filename hint from CSV if available
    2. Search by activity ID in fit_base_dir
    3. Search recursively in subdirectories

    Args:
        activity_id: Strava activity ID
        fit_base_dir: Base directory containing FIT files
        filename_hint: Optional filename from CSV (may be relative path)

    Returns:
        Path to FIT file if found, None otherwise
    """
    if not fit_base_dir.exists():
        return None

    # Strategy 1: Use filename hint from CSV
    if filename_hint:
        # Try as relative path from fit_base_dir's parent
        hint_path = fit_base_dir.parent / filename_hint
        if hint_path.exists() and hint_path.suffix in {".fit", ".gz"}:
            return hint_path

    # Strategy 2: Search by activity ID in fit_base_dir
    activity_str = str(activity_id)

    # Check direct file in base dir
    for ext in [".fit", ".fit.gz"]:
        direct = fit_base_dir / f"{activity_str}{ext}"
        if direct.exists():
            return direct

    # Strategy 3: Recursive search
    # Search organized subdirectories (ride/YYYY-MM/, etc.)
    for fit_file in fit_base_dir.rglob(f"{activity_str}.*"):
        if fit_file.suffix in {".fit", ".gz"}:
            return fit_file

    return None


def has_fit_extension(path: Path) -> bool:
    """
    Check if path is a FIT file (.fit or .fit.gz).

    Args:
        path: Path to check

    Returns:
        True if file has FIT extension
    """
    return path.suffix in {".fit", ".gz"} or str(path).endswith(".fit.gz")
