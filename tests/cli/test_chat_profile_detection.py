"""
Unit tests for chat profile detection functionality.

Tests the _detect_existing_profile() function that determines if an athlete
profile exists and should be used, or if onboarding is needed.
"""

from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from cycling_ai.cli.commands.chat import _detect_existing_profile


class TestProfileDetection:
    """Test suite for profile detection logic."""

    def test_detect_profile_with_explicit_path(self, tmp_path: Path) -> None:
        """Test that explicit --profile flag takes priority."""
        # Create a profile at specified path
        explicit_profile = tmp_path / "explicit_profile.json"
        explicit_profile.write_text('{"ftp": 265}')

        # Create other profiles in data directory (should be ignored)
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        athlete_dir = data_dir / "TestAthlete"
        athlete_dir.mkdir()
        other_profile = athlete_dir / "athlete_profile.json"
        other_profile.write_text('{"ftp": 280}')

        # Should return explicit profile, ignoring others
        result = _detect_existing_profile(explicit_profile)

        assert result == explicit_profile
        assert result.exists()

    def test_detect_profile_no_profiles_found(self, tmp_path: Path) -> None:
        """Test returns None when no profiles exist."""
        # Empty data directory
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        assert result is None

    def test_detect_profile_single_profile_found(self, tmp_path: Path) -> None:
        """Test auto-detects single profile in data directory."""
        # Create data/Athlete/athlete_profile.json
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        athlete_dir = data_dir / "Athlete1"
        athlete_dir.mkdir()
        profile_path = athlete_dir / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        assert result == profile_path
        assert result.exists()

    def test_detect_profile_multiple_profiles_uses_most_recent(
        self, tmp_path: Path
    ) -> None:
        """Test selects most recently modified when multiple profiles exist."""
        # Create multiple athlete profiles
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        # Athlete 1 (older)
        athlete1_dir = data_dir / "Athlete1"
        athlete1_dir.mkdir()
        profile1 = athlete1_dir / "athlete_profile.json"
        profile1.write_text('{"ftp": 265}')

        # Athlete 2 (newer - touch to update mtime)
        athlete2_dir = data_dir / "Athlete2"
        athlete2_dir.mkdir()
        profile2 = athlete2_dir / "athlete_profile.json"
        profile2.write_text('{"ftp": 280}')
        profile2.touch()  # Make it more recent

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        # Should return most recently modified
        assert result == profile2

    def test_detect_profile_ignores_non_json_files(self, tmp_path: Path) -> None:
        """Test ignores files that aren't athlete_profile.json."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        # Create athlete directory with wrong file names
        athlete_dir = data_dir / "Athlete1"
        athlete_dir.mkdir()
        (athlete_dir / "profile.json").write_text('{"ftp": 265}')
        (athlete_dir / "athlete_data.json").write_text('{"ftp": 280}')
        (athlete_dir / "config.json").write_text('{"ftp": 300}')

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        # Should not find any profiles
        assert result is None

    def test_detect_profile_searches_from_current_directory(
        self, tmp_path: Path
    ) -> None:
        """Test searches for data/ directory from current working directory."""
        # Create data directory with profile
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        athlete_dir = data_dir / "Athlete1"
        athlete_dir.mkdir()
        profile_path = athlete_dir / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        assert result == profile_path

    def test_detect_profile_handles_missing_data_directory(
        self, tmp_path: Path
    ) -> None:
        """Test handles case where data/ directory doesn't exist."""
        # tmp_path exists but has no data/ subdirectory

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        assert result is None

    def test_detect_profile_explicit_path_nonexistent_raises_error(
        self, tmp_path: Path
    ) -> None:
        """Test raises error if explicit profile path doesn't exist."""
        nonexistent = tmp_path / "nonexistent.json"

        # Function should validate that explicit path exists
        # This is handled by Click's exists=True, but we test the function directly
        # In practice, Click would prevent this case
        with pytest.raises(FileNotFoundError):
            # Call with path that doesn't exist
            result = _detect_existing_profile(nonexistent)
            # If function returns result, verify it
            if result:
                result.exists()  # This would raise FileNotFoundError

    def test_detect_profile_empty_athlete_directories(self, tmp_path: Path) -> None:
        """Test handles athlete directories with no profiles."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        # Create athlete directories but no profiles
        (data_dir / "Athlete1").mkdir()
        (data_dir / "Athlete2").mkdir()
        (data_dir / "Athlete3").mkdir()

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        assert result is None

    def test_detect_profile_nested_data_directories(self, tmp_path: Path) -> None:
        """Test only searches immediate data/ directory, not nested."""
        # Create data/Athlete1/data/Athlete2/athlete_profile.json
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        athlete1_dir = data_dir / "Athlete1"
        athlete1_dir.mkdir()
        nested_data = athlete1_dir / "data"
        nested_data.mkdir()
        athlete2_dir = nested_data / "Athlete2"
        athlete2_dir.mkdir()
        nested_profile = athlete2_dir / "athlete_profile.json"
        nested_profile.write_text('{"ftp": 300}')

        with patch("cycling_ai.cli.commands.chat.Path.cwd", return_value=tmp_path):
            result = _detect_existing_profile(None)

        # Should not find nested profile
        assert result is None
