# FIT Workout File Parser - Implementation Task

**Status**: Planning Complete - Ready for Implementation
**Created**: 2025-11-02
**Task Type**: Feature Implementation

---

## Overview

Implement a FIT workout file parser that reads structured workout files (`.fit` format) and converts them into our internal workout library format. This enables importing proven workouts from external sources (TrainingPeaks, Garmin Connect, Wahoo, etc.) into our workout library system.

---

## Objectives

1. ✅ Parse FIT workout files containing workout definitions (not activity recordings)
2. ✅ Support all FIT workout message types (FileId, Workout, WorkoutStep)
3. ✅ Handle complex interval/repeat structures correctly
4. ✅ Convert power zones and custom power ranges to our format
5. ✅ Map FIT intensity types to our segment types
6. ✅ Full type safety (mypy --strict compliance)
7. ✅ Comprehensive unit and integration tests

---

## Documentation

### Planning Documents

1. **[PLAN.md](/Users/eduardo/Documents/projects/cycling-ai-analysis/.claude/current_task/PLAN.md)**
   - Executive summary
   - Architecture overview
   - Data flow patterns
   - Implementation strategy
   - Testing strategy
   - Risk analysis
   - Open questions

2. **Implementation Task Cards** (`.claude/current_task/PLAN/`)
   - **CARD_001**: Set Up Module Structure and Data Classes
   - **CARD_002**: Implement FIT File Reading and Metadata Extraction
   - **CARD_003**: Implement Step Extraction and Validation (not yet created)
   - **CARD_004**: Implement Simple Segment Conversion (not yet created)
   - **CARD_005**: Implement Repeat Structure Handling
   - **CARD_006**: Implement Power Conversion Logic (not yet created)
   - **CARD_007-010**: Integration and polish (not yet created)

### Technical References

1. **[docs/FIT_WORKOUT_FILE_FORMAT.md](/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/FIT_WORKOUT_FILE_FORMAT.md)**
   - FIT file format specification
   - Message structure definitions
   - Enumerations (Intensity, Duration, Target types)
   - Parsing strategies
   - Example workouts

2. **[plans/WORKOUT_LIBRARY_REFACTOR.md](/Users/eduardo/Documents/projects/cycling-ai-analysis/plans/WORKOUT_LIBRARY_REFACTOR.md)**
   - Context: Workout library system design
   - Target workout format schema
   - Integration with training plan generation

---

## Architecture

### Module Structure

```
src/cycling_ai/parsers/
├── __init__.py              # Package exports
└── fit_workout_parser.py    # Parser implementation
    ├── Enumerations (FitIntensity, FitDurationType, FitTargetType)
    ├── Data Classes (FitWorkoutMetadata, FitWorkoutStep, etc.)
    └── FitWorkoutParser class
```

### Key Components

1. **Data Classes** (Type-safe data structures)
   - `FitWorkoutMetadata`: Workout metadata from FIT file
   - `FitWorkoutStep`: Single workout step
   - `FitRepeatStructure`: Interval structure
   - `ParsedWorkout`: Complete parsed workout

2. **Parser Class** (`FitWorkoutParser`)
   - `parse_workout_file()`: Main entry point
   - `_extract_metadata()`: Parse file_id and workout messages
   - `_extract_steps()`: Parse workout_step messages
   - `_build_segments()`: Convert steps to segments
   - `_handle_repeat_structure()`: Process interval structures

3. **Conversion Functions**
   - `_map_intensity_to_type()`: FIT Intensity → segment type
   - `_get_power_pct()`: Power watts/zones → FTP percentage
   - `_calculate_total_duration()`: Sum segment durations
   - `_calculate_base_tss()`: Estimate Training Stress Score

---

## Implementation Approach

### Test-Driven Development (TDD)

All implementation follows TDD:
1. Write unit tests first (expected behavior)
2. Implement minimal code to pass tests
3. Refactor for clean code
4. Add integration tests with real FIT files

### Implementation Sequence

**Phase 1: Foundation** (Cards 1-3)
- Module structure and data classes
- FIT file reading and metadata extraction
- Step extraction and validation

**Phase 2: Core Parsing** (Cards 4-6)
- Simple segment conversion (warmup, cooldown, steady)
- Repeat structure handling (intervals)
- Power conversion (zones, custom ranges)

**Phase 3: Integration** (Cards 7-8)
- Complete ParsedWorkout implementation
- Library format conversion
- Integration tests with sample files

**Phase 4: Polish** (Cards 9-10)
- Edge case handling
- Comprehensive validation
- Documentation and examples

---

## Sample Data

### Available FIT Files

Located in `.claude/fit_samples/`:

1. **2025-11-04_MinuteMons.fit** - "Minute Monster (Power)"
   - Complex workout with multiple repeat structures
   - 14 workout steps
   - Good test for nested intervals

2. **2025-11-05_VO2MaxBoos.fit** - "VO2 Max Booster - 6 x 30/15 - 3 repeats"
   - Classic VO2 max interval workout
   - 23 workout steps
   - Tests short work/recovery intervals

3. **2025-04-04_M.A.PEffor.fit** - "M.A.P Efforts"
   - Maximal aerobic power workout
   - 10 workout steps
   - Tests different power targets

4. **2025-11-04_30sx4minte.fit**
   - Additional test case
   - Different structure pattern

### FIT File Structure Example

```python
# Metadata
WorkoutMessage:
  wkt_name: "VO2 Max Booster"
  sport: cycling
  num_valid_steps: 23

# Steps
WorkoutStepMessage[]:
  Step 0: warmup, 10min @ 1107-1134W
  Step 1: work, 30sec @ 1294-1307W
  Step 2: recovery, 15sec @ 1134-1160W
  Step 3: repeat steps 1-2, 6 times
  Step 4: cooldown, 10min @ 1107-1134W
```

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage
  - All data classes
  - All parser methods
  - All conversion functions
  - All edge cases

- **Integration Tests**: 100% of sample files
  - All 4 sample FIT files parse successfully
  - Correct segment structure
  - Accurate power percentages
  - Valid library format output

- **Type Checking**: 100% mypy --strict compliance

### Running Tests

```bash
# All tests
pytest tests/parsers/

# Specific test file
pytest tests/parsers/test_fit_workout_parser.py -v

# Integration tests only
pytest tests/parsers/test_fit_workout_parser_integration.py -v

# With coverage
pytest tests/parsers/ --cov=src/cycling_ai/parsers --cov-report=html

# Type checking
mypy src/cycling_ai/parsers --strict

# Code formatting
ruff format src/cycling_ai/parsers tests/parsers
ruff check src/cycling_ai/parsers tests/parsers
```

---

## Dependencies

### Python Packages

```python
fitparse==1.2.0  # FIT file parsing (already installed)
dataclasses      # Built-in Python 3.7+
pathlib          # Built-in Python 3.4+
typing           # Built-in Python 3.5+
```

### Internal Dependencies

```python
from cycling_ai.core.workout_builder import Workout, WorkoutSegment
from cycling_ai.core.power_zones import calculate_power_zones
from cycling_ai.core.tss import calculate_workout_tss
```

---

## Success Criteria

### Functional
- [ ] Parse all 4 sample FIT files successfully
- [ ] Extract workout metadata (name, sport, steps)
- [ ] Convert all workout steps to segments
- [ ] Handle repeat/interval structures correctly
- [ ] Convert power zones and custom ranges to percentages
- [ ] Calculate accurate duration and TSS
- [ ] Generate valid workout library format

### Non-Functional
- [ ] 100% type safety (mypy --strict passes)
- [ ] 90%+ test coverage (unit tests)
- [ ] 100% integration test success (all samples)
- [ ] Clear error messages for invalid files
- [ ] Performance: Parse file in < 1 second
- [ ] Documentation: All public methods documented

### Code Quality
- [ ] PEP 8 compliance (ruff check passes)
- [ ] No code duplication
- [ ] Clear, descriptive naming
- [ ] Comprehensive docstrings
- [ ] Type hints on all functions

---

## Getting Started

### For Implementation Agent

1. **Read Planning Documents**
   - Review `PLAN.md` for full context
   - Review `docs/FIT_WORKOUT_FILE_FORMAT.md` for FIT specification

2. **Start with CARD_001**
   - Create module structure
   - Implement data classes
   - Write unit tests for data classes
   - Verify type checking passes

3. **Progress Through Cards Sequentially**
   - Complete each card fully before moving to next
   - Run tests after each card
   - Commit changes after each card

4. **Test with Real Data Early**
   - Use sample FIT files for integration tests
   - Verify parser works with real-world data
   - Catch edge cases early

---

## Notes

### Design Decisions

1. **FTP Required**: Parser requires FTP to calculate power percentages
   - Rationale: Workout library format uses percentages
   - Alternative: Could store raw watts, but less flexible

2. **Workout Type Inference**: Parser infers workout type from power zones
   - Rationale: Provides reasonable defaults
   - Alternative: Leave empty for manual classification

3. **Repeat Detection**: Look backward from repeat step for work/recovery
   - Rationale: Simpler than tracking explicit ranges
   - Edge Case: May miss non-adjacent repeats

4. **Error Handling**: Fail fast with clear error messages
   - Rationale: Better developer experience
   - Alternative: Silent failures or warnings

### Open Questions

1. Should parser support parsing without FTP? (Decision: No, require FTP)
2. How to handle missing workout names? (Decision: Raise error)
3. How to infer suitable phases? (Decision: Based on intensity)
4. Should we generate detailed descriptions? (Decision: Leave empty, add manually)

---

## Timeline

**Estimated Total Time**: 8-12 hours (1.5-2 days)

- Phase 1 (Cards 1-3): 4-5 hours
- Phase 2 (Cards 4-6): 3-4 hours
- Phase 3 (Cards 7-8): 1-2 hours
- Phase 4 (Cards 9-10): 1-2 hours

---

## Related Work

### Completed
- Workout builder system (`src/cycling_ai/core/workout_builder.py`)
- Power zones calculation (`src/cycling_ai/core/power_zones.py`)
- TSS calculation (`src/cycling_ai/core/tss.py`)
- FIT activity parsing (`src/cycling_ai/utils/fit_parser.py`)

### In Progress
- FIT workout file parser (this task)

### Future
- Workout library JSON creation
- Training plan workout selection refactor
- FIT workout file export (bi-directional conversion)

---

## Contact

**Task Owner**: Task Implementation Preparation Architect
**Reviewer**: Eduardo
**Created**: 2025-11-02

---

**Status**: ✅ PLANNING COMPLETE - READY FOR IMPLEMENTATION AGENT
