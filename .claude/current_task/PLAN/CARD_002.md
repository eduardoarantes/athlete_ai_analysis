# CARD_002: Implement FIT File Reading and Metadata Extraction

**Status**: Ready for Implementation
**Priority**: P0 (Foundation)
**Estimated Time**: 2 hours
**Dependencies**: CARD_001

---

## Objective

Implement the FitWorkoutParser class initialization and metadata extraction methods. This card covers reading FIT files using fitparse and extracting workout-level metadata (name, sport, step count).

---

## Tasks

### 1. Implement FitWorkoutParser Class

**File**: `src/cycling_ai/parsers/fit_workout_parser.py`

Add the main parser class:

```python
import fitparse


class FitWorkoutParser:
    """
    Parse FIT workout files into workout library format.

    This parser handles FIT files containing workout definitions
    (not activity recordings). It extracts structured workout data
    and converts it to our internal workout library schema.

    Usage:
        parser = FitWorkoutParser()
        workout = parser.parse_workout_file(
            fit_path="workout.fit",
            ftp=260
        )
        library_format = workout.to_library_format()

    Attributes:
        None (stateless parser)
    """

    def __init__(self) -> None:
        """Initialize parser."""
        pass

    def parse_workout_file(
        self,
        fit_path: Path | str,
        ftp: float,
    ) -> ParsedWorkout:
        """
        Parse FIT workout file into ParsedWorkout object.

        Args:
            fit_path: Path to FIT workout file
            ftp: Athlete's FTP for power percentage calculations

        Returns:
            ParsedWorkout object ready for library format conversion

        Raises:
            FileNotFoundError: If FIT file doesn't exist
            ValueError: If FIT file is invalid or not a workout file

        Example:
            >>> parser = FitWorkoutParser()
            >>> workout = parser.parse_workout_file("vo2max.fit", ftp=260)
            >>> workout.metadata.name
            'VO2 Max intervals'
        """
        fit_path = Path(fit_path)

        # Validate file exists
        if not fit_path.exists():
            raise FileNotFoundError(f"FIT file not found: {fit_path}")

        # Validate FTP
        if ftp <= 0:
            raise ValueError(f"Invalid FTP: {ftp}. Must be positive.")

        # Parse FIT file
        try:
            fit_file = fitparse.FitFile(str(fit_path))
        except Exception as e:
            raise ValueError(f"Failed to parse FIT file: {e}") from e

        # Extract metadata and steps
        metadata = self._extract_metadata(fit_file)
        steps = self._extract_steps(fit_file)

        # Validate workout structure
        self._validate_workout_structure(metadata, steps)

        # Build segments from steps (placeholder for now)
        segments: list[dict[str, Any]] = []

        # Calculate duration and TSS (placeholder for now)
        duration = 0
        tss = 0.0

        return ParsedWorkout(
            metadata=metadata,
            segments=segments,
            base_duration_min=duration,
            base_tss=tss,
        )

    def _extract_metadata(self, fit_file: fitparse.FitFile) -> FitWorkoutMetadata:
        """
        Extract workout metadata from FIT file.

        Processes file_id and workout messages to get:
        - Workout name
        - Sport type
        - Number of steps
        - Creation time (optional)

        Args:
            fit_file: Parsed FIT file

        Returns:
            FitWorkoutMetadata object

        Raises:
            ValueError: If required metadata is missing
        """
        name = ""
        sport = "cycling"
        num_steps = 0
        manufacturer = None
        time_created = None

        # Extract from workout message
        for record in fit_file.get_messages("workout"):
            for field in record:
                if field.name == "wkt_name" and field.value:
                    name = str(field.value)
                elif field.name == "sport" and field.value:
                    sport = str(field.value)
                elif field.name == "num_valid_steps" and field.value:
                    num_steps = int(field.value)

        # Extract from file_id message
        for record in fit_file.get_messages("file_id"):
            for field in record:
                if field.name == "manufacturer" and field.value:
                    manufacturer = str(field.value)
                elif field.name == "time_created" and field.value:
                    time_created = field.value

        # Validate required fields
        if not name:
            raise ValueError(
                "Workout name not found in FIT file. "
                "This may not be a valid workout file."
            )

        if num_steps == 0:
            raise ValueError(
                "Number of steps not found in FIT file. "
                "This may not be a valid workout file."
            )

        return FitWorkoutMetadata(
            name=name,
            sport=sport,
            num_steps=num_steps,
            manufacturer=manufacturer,
            time_created=time_created,
        )

    def _extract_steps(self, fit_file: fitparse.FitFile) -> list[FitWorkoutStep]:
        """
        Extract all workout steps from FIT file.

        Processes workout_step messages to extract:
        - Duration and type
        - Intensity level
        - Power targets (zone or custom)
        - Repeat structures

        Args:
            fit_file: Parsed FIT file

        Returns:
            List of FitWorkoutStep objects in order

        Note:
            This is a placeholder implementation for CARD_002.
            Full implementation will be done in CARD_003.
        """
        # Placeholder: return empty list for now
        # Will be implemented in CARD_003
        return []

    def _validate_workout_structure(
        self,
        metadata: FitWorkoutMetadata,
        steps: list[FitWorkoutStep],
    ) -> None:
        """
        Validate workout has logical structure.

        Args:
            metadata: Workout metadata
            steps: List of workout steps

        Raises:
            ValueError: If structure is invalid

        Note:
            Basic validation for CARD_002. More thorough validation
            will be added in CARD_003.
        """
        # For now, just validate we have metadata
        # Step validation will be added in CARD_003 when steps are extracted
        if not metadata.name:
            raise ValueError("Workout must have a name")

        if metadata.num_steps <= 0:
            raise ValueError("Workout must have at least one step")
```

---

## Testing

### Unit Tests

Add to **File**: `tests/parsers/test_fit_workout_parser.py`

```python
class TestFitWorkoutParser:
    """Test FitWorkoutParser class."""

    @pytest.fixture
    def parser(self):
        """Create parser instance."""
        return FitWorkoutParser()

    @pytest.fixture
    def sample_fit_dir(self):
        """Path to sample FIT files."""
        return Path(".claude/fit_samples")

    def test_init(self, parser):
        """Test parser initialization."""
        assert parser is not None

    def test_parse_workout_file_missing_file(self, parser):
        """Test error when file doesn't exist."""
        with pytest.raises(FileNotFoundError, match="FIT file not found"):
            parser.parse_workout_file("nonexistent.fit", ftp=260)

    def test_parse_workout_file_invalid_ftp_zero(self, parser):
        """Test error when FTP is zero."""
        # Create a temp FIT file for this test
        fit_path = Path(".claude/fit_samples/2025-11-04_MinuteMons.fit")

        with pytest.raises(ValueError, match="Invalid FTP"):
            parser.parse_workout_file(fit_path, ftp=0)

    def test_parse_workout_file_invalid_ftp_negative(self, parser):
        """Test error when FTP is negative."""
        fit_path = Path(".claude/fit_samples/2025-11-04_MinuteMons.fit")

        with pytest.raises(ValueError, match="Invalid FTP"):
            parser.parse_workout_file(fit_path, ftp=-100)

    def test_extract_metadata_minute_monster(self, parser, sample_fit_dir):
        """Test metadata extraction from real FIT file."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        fit_file = fitparse.FitFile(str(fit_path))

        metadata = parser._extract_metadata(fit_file)

        assert metadata.name == "Minute Monster (Power)"
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 14
        assert metadata.manufacturer == "peaksware"
        assert metadata.time_created is not None

    def test_extract_metadata_vo2max_booster(self, parser, sample_fit_dir):
        """Test metadata extraction from VO2 Max workout."""
        fit_path = sample_fit_dir / "2025-11-05_VO2MaxBoos.fit"
        fit_file = fitparse.FitFile(str(fit_path))

        metadata = parser._extract_metadata(fit_file)

        assert "vo2" in metadata.name.lower()
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 23

    def test_extract_metadata_missing_name_raises_error(self, parser):
        """Test error when workout name is missing."""
        # Create mock FIT file without workout name
        # This is a conceptual test - actual implementation may vary
        # based on how we mock fitparse
        pass  # Implement with mock if needed

    def test_validate_workout_structure_valid(self, parser):
        """Test validation passes for valid workout."""
        metadata = FitWorkoutMetadata(
            name="Test Workout",
            sport="cycling",
            num_steps=5,
        )

        steps: list[FitWorkoutStep] = []

        # Should not raise
        parser._validate_workout_structure(metadata, steps)

    def test_validate_workout_structure_empty_name_raises_error(self, parser):
        """Test validation fails for empty name."""
        metadata = FitWorkoutMetadata(
            name="",
            sport="cycling",
            num_steps=5,
        )

        steps: list[FitWorkoutStep] = []

        with pytest.raises(ValueError, match="Workout must have a name"):
            parser._validate_workout_structure(metadata, steps)
```

### Integration Tests

Add to **File**: `tests/parsers/test_fit_workout_parser_integration.py`

```python
"""Integration tests for FIT workout parser."""

import pytest
from pathlib import Path
from cycling_ai.parsers.fit_workout_parser import FitWorkoutParser


class TestFitWorkoutParserIntegration:
    """Integration tests with real FIT files."""

    @pytest.fixture
    def sample_fit_dir(self):
        """Path to sample FIT files."""
        return Path(".claude/fit_samples")

    @pytest.fixture
    def parser(self):
        """FitWorkoutParser instance."""
        return FitWorkoutParser()

    def test_parse_minute_monster_metadata(self, parser, sample_fit_dir):
        """Test parsing Minute Monster workout - metadata only."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        ftp = 1200

        # For CARD_002, we're just testing metadata extraction
        # Full parsing will be tested in later cards
        import fitparse
        fit_file = fitparse.FitFile(str(fit_path))
        metadata = parser._extract_metadata(fit_file)

        assert metadata.name == "Minute Monster (Power)"
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 14
        assert metadata.manufacturer == "peaksware"

    def test_parse_all_sample_files_metadata(self, parser, sample_fit_dir):
        """Test that all sample files have extractable metadata."""
        import fitparse

        sample_files = list(sample_fit_dir.glob("*.fit"))
        assert len(sample_files) >= 4, "Expected at least 4 sample files"

        for fit_path in sample_files:
            fit_file = fitparse.FitFile(str(fit_path))
            metadata = parser._extract_metadata(fit_file)

            # Basic assertions for all files
            assert metadata.name, f"File {fit_path.name} has no name"
            assert metadata.num_steps > 0, f"File {fit_path.name} has no steps"
```

---

## Acceptance Criteria

- [ ] FitWorkoutParser class implemented with `__init__` and `parse_workout_file`
- [ ] `_extract_metadata` method implemented and tested
- [ ] `_validate_workout_structure` method implemented (basic validation)
- [ ] Error handling for missing files
- [ ] Error handling for invalid FTP
- [ ] Error handling for invalid FIT files
- [ ] All unit tests pass
- [ ] All integration tests pass with sample FIT files
- [ ] Type checking passes (`mypy --strict`)
- [ ] Code formatting passes (`ruff format`, `ruff check`)

---

## Files Modified

- **Modified**: `src/cycling_ai/parsers/fit_workout_parser.py` (add FitWorkoutParser class)
- **Modified**: `tests/parsers/test_fit_workout_parser.py` (add parser tests)
- **New**: `tests/parsers/test_fit_workout_parser_integration.py`

---

## Notes

- This card implements **metadata extraction only**
- Step extraction (`_extract_steps`) is a placeholder for CARD_003
- Validation is basic for now - more thorough validation in CARD_003
- Integration tests verify metadata extraction from all sample files
- Error messages should be clear and actionable

---

## Edge Cases to Consider

1. **Missing workout name**: Raise clear error
2. **Missing num_valid_steps**: Raise clear error
3. **File not a workout file**: Raise clear error (might be activity file)
4. **Corrupted FIT file**: Catch fitparse exceptions, re-raise as ValueError
5. **Empty file**: fitparse should raise error, we catch and re-raise

---

**Ready to Implement**: Yes (after CARD_001 complete)
**Blocked By**: CARD_001
**Next Card**: CARD_003 (Step Extraction and Validation)
