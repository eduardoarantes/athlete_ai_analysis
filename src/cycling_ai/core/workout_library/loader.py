"""Workout library loader with caching."""

import json
import logging
from pathlib import Path
from typing import Optional

from cycling_ai.core.workout_library.models import WorkoutLibrary

logger = logging.getLogger(__name__)


class WorkoutLibraryLoader:
    """
    Loads and caches workout library from JSON.

    Singleton pattern to ensure library is loaded once per process.
    """

    _instance: Optional["WorkoutLibraryLoader"] = None
    _library: WorkoutLibrary | None = None

    def __new__(cls) -> "WorkoutLibraryLoader":
        """Ensure only one instance exists."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load_library(self, library_path: Path | None = None) -> WorkoutLibrary:
        """
        Load workout library from JSON file.

        Args:
            library_path: Path to workout_library.json (defaults to data/workout_library.json)

        Returns:
            Loaded and validated WorkoutLibrary

        Raises:
            FileNotFoundError: If library file doesn't exist
            ValueError: If library JSON is invalid
        """
        # Use cached library if available
        if self._library is not None:
            logger.debug("Using cached workout library")
            return self._library

        # Default path: data/workout_library.json relative to project root
        if library_path is None:
            # From src/cycling_ai/core/workout_library/loader.py
            # Go up: loader.py -> workout_library/ -> core/ -> cycling_ai/ -> src/ -> project_root
            library_path = (
                Path(__file__).parent.parent.parent.parent.parent
                / "data"
                / "workout_library.json"
            )

        if not library_path.exists():
            raise FileNotFoundError(f"Workout library not found: {library_path}")

        logger.info(f"Loading workout library from {library_path}")

        try:
            with open(library_path, encoding="utf-8") as f:
                library_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in workout library: {e}") from e

        # Validate with Pydantic
        self._library = WorkoutLibrary(**library_data)

        logger.info(f"Loaded {len(self._library.workouts)} workouts from library")

        return self._library

    def get_library(self) -> WorkoutLibrary:
        """Get cached library (load if not cached)."""
        if self._library is None:
            return self.load_library()
        return self._library
