"""Tests for workout library loader."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader
from cycling_ai.core.workout_library.models import WorkoutLibrary


class TestWorkoutLibraryLoader:
    """Test WorkoutLibraryLoader class."""

    def test_singleton_pattern(self) -> None:
        """Test that loader implements singleton pattern."""
        loader1 = WorkoutLibraryLoader()
        loader2 = WorkoutLibraryLoader()

        assert loader1 is loader2

    def test_load_real_library(self) -> None:
        """Test loading the real workout library."""
        library_path = (
            Path(__file__).parent.parent.parent.parent / "data" / "workout_library.json"
        )

        if not library_path.exists():
            pytest.skip(f"Workout library not found at {library_path}")

        loader = WorkoutLibraryLoader()
        library = loader.load_library(library_path)

        assert isinstance(library, WorkoutLibrary)
        assert len(library.workouts) > 0
        assert library.version is not None

    def test_caching_behavior(self) -> None:
        """Test that library is cached after first load."""
        library_path = (
            Path(__file__).parent.parent.parent.parent / "data" / "workout_library.json"
        )

        if not library_path.exists():
            pytest.skip(f"Workout library not found at {library_path}")

        # Reset singleton for clean test
        WorkoutLibraryLoader._instance = None
        WorkoutLibraryLoader._library = None

        loader = WorkoutLibraryLoader()

        # First load should read from file
        library1 = loader.load_library(library_path)
        assert library1 is not None

        # Second load should return cached library
        with patch("builtins.open", MagicMock()) as mock_open:
            library2 = loader.load_library(library_path)
            # open should not be called because we're using cached library
            mock_open.assert_not_called()

        # Should be the same instance
        assert library1 is library2

    def test_get_library(self) -> None:
        """Test get_library method."""
        # Reset singleton
        WorkoutLibraryLoader._instance = None
        WorkoutLibraryLoader._library = None

        loader = WorkoutLibraryLoader()
        library = loader.get_library()

        assert isinstance(library, WorkoutLibrary)
        assert len(library.workouts) > 0

    def test_file_not_found(self) -> None:
        """Test error handling when file doesn't exist."""
        # Reset singleton
        WorkoutLibraryLoader._instance = None
        WorkoutLibraryLoader._library = None

        loader = WorkoutLibraryLoader()
        fake_path = Path("/fake/path/to/workout_library.json")

        with pytest.raises(FileNotFoundError) as exc_info:
            loader.load_library(fake_path)

        assert "Workout library not found" in str(exc_info.value)

    def test_invalid_json(self, tmp_path: Path) -> None:
        """Test error handling for invalid JSON."""
        # Reset singleton
        WorkoutLibraryLoader._instance = None
        WorkoutLibraryLoader._library = None

        # Create invalid JSON file
        invalid_json_path = tmp_path / "invalid.json"
        invalid_json_path.write_text("{ invalid json }")

        loader = WorkoutLibraryLoader()

        with pytest.raises((json.JSONDecodeError, ValueError)):
            loader.load_library(invalid_json_path)

    def test_invalid_schema(self, tmp_path: Path) -> None:
        """Test error handling for invalid schema."""
        # Reset singleton
        WorkoutLibraryLoader._instance = None
        WorkoutLibraryLoader._library = None

        # Create valid JSON but invalid schema
        invalid_schema_path = tmp_path / "invalid_schema.json"
        invalid_schema_path.write_text('{"version": "1.0.0", "workouts": "invalid"}')

        loader = WorkoutLibraryLoader()

        with pytest.raises(Exception):  # Pydantic validation error
            loader.load_library(invalid_schema_path)

    def test_default_library_path(self) -> None:
        """Test that default path is used when no path provided."""
        # Reset singleton
        WorkoutLibraryLoader._instance = None
        WorkoutLibraryLoader._library = None

        loader = WorkoutLibraryLoader()

        # Call load_library without path
        library = loader.load_library()

        assert isinstance(library, WorkoutLibrary)
        assert len(library.workouts) > 0
