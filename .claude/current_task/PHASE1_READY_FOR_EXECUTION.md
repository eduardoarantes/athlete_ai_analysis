# Phase 1 Implementation - Ready for Execution

**Created:** 2025-11-01
**Status:** PLAN COMPLETE - Ready for Executor Agent
**Approach:** Test-Driven Development (TDD)

---

## Summary

The implementation plan for Phase 1 (Core Foundation) of the Workout Comparison Agent is complete. This document provides a handoff summary for the executor agent.

---

## What Has Been Prepared

### 1. Comprehensive Architecture Analysis

**Documents:**
- Full architecture review in `plans/WORKOUT_COMPARISON_ARCHITECTURE.md` (2,398 lines)
- Executive summary in `plans/WORKOUT_COMPARISON_EXECUTIVE_SUMMARY.md`
- Phase 1 detailed plan in `.claude/current_task/WORKOUT_COMPARISON_PHASE1_PLAN.md`

**Key Findings:**
- Existing patterns identified (dataclasses, type safety, TDD approach)
- Integration points mapped (core/tss.py, core/athlete.py, core/power_zones.py)
- Data flow understood (training plan JSON → planned workouts, activities CSV → actual workouts)

### 2. Implementation Cards Created

Three detailed implementation cards with step-by-step instructions:

1. **CARD_01_TEST_FIXTURES.md** - Create test data (2 hours)
2. **CARD_02_DATA_MODELS.md** - Implement 6 dataclasses (3 hours)
3. **CARD_03_COMPLIANCE_SCORER.md** - Core scoring algorithms (4 hours)

**Remaining Cards Needed:**
4. CARD_04: WorkoutMatcher (matching algorithm)
5. CARD_05: DeviationDetector + RecommendationEngine
6. CARD_06: PatternDetector (weekly pattern identification)
7. CARD_07: WorkoutComparer (main facade)
8. CARD_08: Integration tests + coverage validation

### 3. Test-Driven Development Strategy

**TDD Cycle Defined:**
1. RED: Write failing test first
2. GREEN: Write minimal code to pass
3. REFACTOR: Improve while keeping tests green
4. REPEAT: Next test case

**Coverage Targets:**
- Data models: 100%
- Core algorithms: 95%+
- Overall Phase 1: 90%+

### 4. Alignment with Existing Codebase

**Patterns to Follow:**
- Dataclass pattern from `core/athlete.py`
- Type safety from all core modules (mypy --strict)
- Test structure from `tests/core/test_tss.py`
- TSS calculations from `core/tss.py`
- Pure business logic (no I/O in core)

---

## Implementation Order (TDD)

### Day 1: Foundations (8 hours)

**Morning (4 hours):**
1. CARD_01: Create test fixtures (2h)
2. CARD_02: Data models - Part 1 (2h)
   - PlannedWorkout
   - ActualWorkout

**Afternoon (4 hours):**
3. CARD_02: Data models - Part 2 (1h)
   - ComplianceMetrics
   - WorkoutComparison
   - WeeklyPattern
   - WeeklyComparison
4. CARD_03: ComplianceScorer (3h)
   - Compliance scoring
   - Zone matching algorithm

### Day 2: Algorithms + Integration (8-12 hours)

**Morning (4 hours):**
5. CARD_04: WorkoutMatcher (3h)
   - Exact date matching
   - Fuzzy matching
   - Similarity scoring
6. CARD_05: Deviation + Recommendations (1h)

**Afternoon (4 hours):**
7. CARD_06: PatternDetector (3h)
   - 5 pattern types
   - Severity classification
8. CARD_07: WorkoutComparer facade (1h)

**Evening (2-4 hours if needed):**
9. CARD_08: Integration tests + coverage (2h)
10. Final validation + documentation (2h)

---

## Key Algorithms to Implement

### 1. Compliance Scoring

**Formula:**
```
compliance_score = (
    completion_score * 0.40 +
    duration_score * 0.25 +
    intensity_score * 0.25 +
    tss_score * 0.10
)
```

**Components:**
- Completion: 100 or 0 (binary)
- Duration: min(100, actual/planned * 100)
- Intensity: zone_match_score (deviation-based)
- TSS: min(100, actual/planned * 100)

### 2. Zone Match Scoring

**Formula:**
```
total_deviation = sum(|planned[zone] - actual[zone]| for all zones)
deviation_pct = (total_deviation / total_planned_time) * 100
score = max(0, 100 - deviation_pct)
```

### 3. Workout Matching

**Strategy:**
1. Try exact date match
2. If no match, try fuzzy (±1 day with similarity > 0.5)
3. If multiple activities same day, select best match
4. If no match, mark as skipped

### 4. Pattern Detection

**5 Pattern Types:**
1. Skipped hard workouts (threshold/VO2max/tempo consistently skipped)
2. Short duration (avg compliance <80%)
3. Weekend warrior (weekend compliance > weekday + 20)
4. Scheduling conflict (specific day always skipped)
5. Intensity avoidance (always lower zones)

---

## File Structure

```
src/cycling_ai/core/
└── workout_comparison.py          # NEW (all Phase 1 code)

tests/core/
├── test_workout_comparison.py     # NEW (comprehensive tests)
└── fixtures/
    └── workout_comparison/        # NEW (test data)
        ├── sample_training_plan.json
        ├── sample_activities_perfect.csv
        ├── sample_activities_partial.csv
        ├── sample_activities_skipped.csv
        ├── sample_athlete_profile.json
        └── README.md
```

---

## Success Criteria Checklist

Before marking Phase 1 complete:

### Code Quality
- [ ] All data models implemented with full type hints
- [ ] All 6 core classes implemented
- [ ] `mypy --strict` passes with zero errors
- [ ] `ruff check` passes with zero errors
- [ ] Code follows existing patterns from codebase

### Testing
- [ ] Test coverage ≥ 90% on `core/workout_comparison.py`
- [ ] All tests pass (unit + integration)
- [ ] All edge cases tested (skipped workouts, missing data, etc.)
- [ ] Test fixtures created for subsequent phases

### Functionality
- [ ] Compliance scoring accurate (validated manually)
- [ ] Zone matching algorithm correct
- [ ] Pattern detection working (5 pattern types)
- [ ] Workout matching reliable (exact + fuzzy)
- [ ] Deviation detection comprehensive
- [ ] Recommendations actionable

### Documentation
- [ ] All public methods have docstrings
- [ ] Module docstring complete
- [ ] Complex algorithms documented with examples
- [ ] Test fixtures documented

---

## Risk Assessment

### Identified Risks

1. **Zone Calculation Complexity** - MITIGATED
   - Use existing `core/power_zones.py` patterns
   - Map power percentages to zones (Z1: 0-55%, Z2: 56-75%, etc.)
   - Test extensively with edge cases

2. **Missing Data Handling** - MITIGATED
   - All power metrics optional in ActualWorkout
   - Fall back to duration-only scoring when power unavailable
   - TSS defaults to 100 if missing

3. **Date Parsing Edge Cases** - MITIGATED
   - Use strict ISO format (YYYY-MM-DD)
   - Use `datetime.strptime` with explicit format
   - Test with various date scenarios

4. **Training Plan Format Variations** - MITIGATED
   - Validate structure with clear error messages
   - Use optional fields with sensible defaults
   - Document expected format

---

## Dependencies

### Python Packages (all existing)
- `dataclasses` (stdlib)
- `datetime` (stdlib)
- `typing` (stdlib)
- `pandas` (existing dependency for CSV loading)
- `pytest` (existing dev dependency)
- `mypy` (existing dev dependency)

### Existing Code
- `src/cycling_ai/core/tss.py` - TSS calculations
- `src/cycling_ai/core/power_zones.py` - Zone definitions
- `src/cycling_ai/core/athlete.py` - Athlete profile loading
- Parquet cache infrastructure (data loading)

---

## Commands for Executor

### Initial Setup
```bash
# Create test fixtures directory
mkdir -p tests/fixtures/workout_comparison

# Create module files
touch src/cycling_ai/core/workout_comparison.py
touch tests/core/test_workout_comparison.py
```

### Development Cycle
```bash
# Run tests (TDD - should fail first!)
pytest tests/core/test_workout_comparison.py -v

# Type check
mypy src/cycling_ai/core/workout_comparison.py --strict

# Coverage
pytest tests/core/test_workout_comparison.py --cov=src/cycling_ai/core/workout_comparison --cov-report=term-missing

# Code style
ruff check src/cycling_ai/core/workout_comparison.py
ruff format src/cycling_ai/core/workout_comparison.py
```

### Final Validation
```bash
# All tests pass
pytest tests/core/test_workout_comparison.py -v

# Type checking
mypy src/cycling_ai/core/workout_comparison.py --strict

# Coverage ≥ 90%
pytest tests/core/test_workout_comparison.py --cov=src/cycling_ai/core/workout_comparison --cov-report=html

# Code quality
ruff check src/cycling_ai/core/
```

---

## Next Steps for Executor

1. **Review** this document and the detailed plan in `WORKOUT_COMPARISON_PHASE1_PLAN.md`
2. **Read** the three implementation cards (CARD_01, CARD_02, CARD_03)
3. **Start** with CARD_01 (test fixtures)
4. **Follow TDD** strictly: test first, then implement
5. **Complete** remaining cards 04-08 following same pattern
6. **Validate** all acceptance criteria before marking Phase 1 complete

---

## Questions for Clarification (if needed)

1. Should zone distribution use power-based zones or heart rate zones?
   - **Decision:** Power-based zones (Z1-Z5 based on % FTP)
   - Rationale: Training plans use power percentages

2. How to handle multiple activities on same day?
   - **Decision:** Select activity with longest duration as primary match
   - Alternative: Could combine activities (future enhancement)

3. What is minimum occurrences for a "pattern"?
   - **Decision:** 2 workouts (configurable parameter)
   - Rationale: Balance between sensitivity and noise

4. TSS calculation for planned workouts - use which FTP?
   - **Decision:** Use athlete's current FTP from profile
   - Rationale: Training plan already has TSS calculated

---

## Handoff Complete

This plan is comprehensive and ready for execution. The executor agent has:
- Clear implementation order (TDD approach)
- Detailed cards with step-by-step instructions
- Acceptance criteria for each component
- Risk mitigation strategies
- Full context from existing codebase

**Estimated Timeline:** 2 days (16-20 hours total)
**Complexity:** Medium-High (core algorithms, strict type safety)
**Confidence:** High (clear requirements, existing patterns to follow)

---

**Status:** READY FOR EXECUTION
**Last Updated:** 2025-11-01
**Prepared By:** Task Implementation Preparation Architect (Claude)
