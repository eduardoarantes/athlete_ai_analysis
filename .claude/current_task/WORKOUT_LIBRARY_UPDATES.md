# Workout Library Enhancement Proposal

**Document:** Library Schema Updates & Migration
**Version:** 1.0
**Date:** 2025-11-04
**Status:** Design Complete

---

## Executive Summary

The current workout library (222 workouts, 90 with `variable_components`) has sufficient coverage but **underutilizes existing metadata**. This document proposes **zero-breaking-change enhancements** to maximize library extensibility without requiring wholesale library regeneration.

**Key Findings:**
- **90 workouts already have variable_components** (40% coverage)
- **Schema supports duration scaling** but features unused in production
- **Missing: Explicit extensibility flags** for quick filtering
- **Opportunity: Batch-update existing workouts** with minimal manual effort

**Proposed Enhancements:**
1. Add `extensible` boolean flag (backward-compatible)
2. Add `duration_scaling_strategy` enum for intelligent scaling
3. Enhance `variable_components` with segment-level metadata
4. Create migration script to auto-populate new fields
5. Add 30-50 new pre-extended workout variants

**Impact:** 0% breaking changes, 100% backward compatibility, 60%+ extensibility coverage

---

## Current Library State Analysis

### Statistics

```
Total Workouts: 222
├─ With variable_components: 90 (40.5%)
├─ Without variable_components: 132 (59.5%)
└─ Breakdown by type:
    ├─ Endurance: 94 (42.3%)
    │   ├─ With variable_components: 38 (40.4%)
    │   └─ Extensible candidates: 56 (59.6%)
    ├─ Threshold: 42 (18.9%)
    ├─ Sweet Spot: 28 (12.6%)
    ├─ Tempo: 24 (10.8%)
    ├─ VO2max: 18 (8.1%)
    ├─ Recovery: 10 (4.5%)
    └─ Mixed: 6 (2.7%)
```

### Duration Distribution (Endurance Workouts)

```
Range: 39-240 min
Median: 80 min
Mean: 105 min

Histogram:
 39-60 min:   18 workouts (19.1%)  [Weekday short]
 61-90 min:   32 workouts (34.0%)  [Weekday standard] ✓✓✓
 91-120 min:  22 workouts (23.4%)  [Weekend short]
121-180 min:  14 workouts (14.9%)  [Weekend long]
181-240 min:   8 workouts (8.5%)   [Weekend epic]

GAP IDENTIFIED: 91-120 min range needs more coverage (only 22 workouts)
```

### Variable Components Coverage

```python
# Sample workouts with variable_components:
{
  "id": "endurance_z2_90_extendable",
  "base_duration_min": 90,
  "variable_components": {
    "adjustable_field": "duration",
    "min_value": 60,
    "max_value": 150,
    "tss_per_unit": null,      # Not applicable for duration type
    "duration_per_unit_min": null
  }
}

{
  "id": "threshold_intervals_5x5",
  "base_duration_min": 70,
  "variable_components": {
    "adjustable_field": "sets",
    "min_value": 3,             # Minimum 3 sets
    "max_value": 8,             # Maximum 8 sets
    "tss_per_unit": 12,         # 12 TSS per set
    "duration_per_unit_min": 6  # 6 minutes per set (5 min work + 1 min rest)
  }
}
```

**Current Coverage:**
- `adjustable_field="duration"`: 65 workouts (72% of variable)
- `adjustable_field="sets"`: 25 workouts (28% of variable)

---

## Proposed Schema Enhancements

### Enhancement 1: Add `extensible` Flag

**Purpose:** Quick filtering for workouts that can be safely extended.

**Schema Change (backward-compatible):**

```python
class Workout(BaseModel):
    id: str
    name: str
    # ... existing fields ...

    # NEW FIELD (optional, default: False)
    extensible: bool = False

    variable_components: VariableComponents | None = None
```

**Usage:**

```python
# Quick filter for extensible workouts
extensible_workouts = [
    w for w in library.workouts
    if w.extensible or w.variable_components is not None
]

# Prioritize extensible workouts in selection
if workout.extensible:
    score += 10  # Bonus points for extensibility
```

**Migration:**

```python
def migrate_add_extensible_flag():
    """Auto-populate extensible flag based on existing metadata."""
    for workout in library.workouts:
        if workout.variable_components:
            # Already has variable_components → extensible
            workout.extensible = True
        elif workout.type in ["endurance", "mixed"]:
            # Endurance/mixed workouts with long steady segments → extensible
            has_long_steady = any(
                seg.type in ["steady", "endurance"]
                and seg.duration_min
                and seg.duration_min >= 30
                for seg in workout.segments
            )
            workout.extensible = has_long_steady
        else:
            # Intervals/threshold → not extensible by default
            workout.extensible = False
```

**Expected Results:**
- 90 workouts: `extensible=True` (from variable_components)
- 40-50 workouts: `extensible=True` (from endurance heuristic)
- **Total: 130-140 extensible workouts (58-63% coverage)**

### Enhancement 2: Add `duration_scaling_strategy`

**Purpose:** Provide guidance on HOW to scale duration for optimal results.

**Schema Change:**

```python
class Workout(BaseModel):
    # ... existing fields ...

    # NEW FIELD (optional)
    duration_scaling_strategy: Literal[
        "proportional",      # Scale all segments proportionally
        "extend_main",       # Extend main work segment only
        "add_sets",          # Add interval sets
        "extend_recovery",   # Extend recovery segments (recovery rides)
        "fixed",             # Do not scale (default)
    ] | None = "fixed"
```

**Usage:**

```python
def scale_workout_by_strategy(workout: Workout, target_duration: float) -> Workout:
    """Scale workout using its preferred strategy."""
    match workout.duration_scaling_strategy:
        case "proportional":
            return _scale_all_segments(workout, target_duration)
        case "extend_main":
            return _extend_main_segment(workout, target_duration)
        case "add_sets":
            return _add_interval_sets(workout, target_duration)
        case "extend_recovery":
            return _extend_recovery_segments(workout, target_duration)
        case "fixed":
            return workout  # No scaling
```

**Migration:**

```python
def migrate_add_duration_scaling_strategy():
    """Auto-populate scaling strategy based on workout structure."""
    for workout in library.workouts:
        if not workout.extensible:
            workout.duration_scaling_strategy = "fixed"
        elif workout.variable_components:
            if workout.variable_components.adjustable_field == "sets":
                workout.duration_scaling_strategy = "add_sets"
            else:
                workout.duration_scaling_strategy = "proportional"
        elif workout.type == "endurance":
            workout.duration_scaling_strategy = "extend_main"
        elif workout.type == "recovery":
            workout.duration_scaling_strategy = "extend_recovery"
        else:
            workout.duration_scaling_strategy = "proportional"
```

### Enhancement 3: Segment-Level Metadata

**Purpose:** Fine-grained control over which segments to extend/scale.

**Schema Change:**

```python
class WorkoutSegment(BaseModel):
    type: Literal["warmup", "interval", "recovery", "cooldown", "steady", "tempo"]

    # ... existing fields ...

    # NEW FIELDS (optional)
    min_duration_min: float | None = None  # Minimum safe duration for this segment
    max_duration_min: float | None = None  # Maximum safe duration for this segment
    scalable: bool = True  # Can this segment be scaled? (default: True)
```

**Usage:**

```python
def scale_segment_safely(segment: WorkoutSegment, scaling_factor: float) -> WorkoutSegment:
    """Scale segment respecting min/max bounds."""
    if not segment.scalable:
        return segment  # Don't scale this segment

    new_duration = segment.duration_min * scaling_factor

    # Clamp to bounds
    if segment.min_duration_min:
        new_duration = max(segment.min_duration_min, new_duration)
    if segment.max_duration_min:
        new_duration = min(segment.max_duration_min, new_duration)

    segment.duration_min = new_duration
    return segment
```

**Migration:**

```python
def migrate_add_segment_metadata():
    """Auto-populate segment min/max based on type."""
    SEGMENT_DURATION_BOUNDS = {
        "warmup": {"min": 5, "max": 20, "scalable": False},    # Fixed warmup
        "cooldown": {"min": 5, "max": 15, "scalable": False},  # Fixed cooldown
        "interval": {"min": None, "max": None, "scalable": False},  # Sets-based
        "recovery": {"min": 5, "max": 60, "scalable": True},
        "steady": {"min": 20, "max": 180, "scalable": True},
        "endurance": {"min": 30, "max": 240, "scalable": True},
        "tempo": {"min": 20, "max": 120, "scalable": True},
    }

    for workout in library.workouts:
        for segment in workout.segments:
            bounds = SEGMENT_DURATION_BOUNDS.get(segment.type, {})
            segment.min_duration_min = bounds.get("min")
            segment.max_duration_min = bounds.get("max")
            segment.scalable = bounds.get("scalable", True)
```

---

## Backward Compatibility Strategy

### Principle: Zero Breaking Changes

All new fields are **optional with sensible defaults**:

```python
class Workout(BaseModel):
    # Existing required fields (UNCHANGED)
    id: str
    name: str
    type: Literal[...]
    segments: list[WorkoutSegment]
    base_duration_min: float
    base_tss: float

    # New optional fields (BACKWARD COMPATIBLE)
    extensible: bool = False  # Default: not extensible
    duration_scaling_strategy: Literal[...] | None = "fixed"  # Default: no scaling
    variable_components: VariableComponents | None = None  # Already optional
```

### Migration Path

**Option 1: In-Place Migration (Recommended)**

```bash
# Run migration script
python scripts/migrate_workout_library.py \
    --input data/workout_library.json \
    --output data/workout_library_v2.json \
    --add-extensible-flag \
    --add-scaling-strategy \
    --add-segment-metadata

# Validate new library
python scripts/validate_workout_library.py data/workout_library_v2.json

# Backup old library
mv data/workout_library.json data/workout_library_v1_backup.json

# Activate new library
mv data/workout_library_v2.json data/workout_library.json
```

**Option 2: Lazy Migration (Runtime)**

```python
class WorkoutLibraryLoader:
    def get_library(self) -> WorkoutLibrary:
        """Load library with runtime migration."""
        library = self._load_from_disk()

        # Apply migrations if needed
        if not hasattr(library.workouts[0], "extensible"):
            library = self._migrate_add_extensible(library)

        return library
```

### Rollback Strategy

```bash
# If issues arise, rollback is trivial:
mv data/workout_library_v1_backup.json data/workout_library.json

# Old code continues to work (new fields are optional)
```

---

## New Workout Variants Proposal

### Strategy: Pre-Generate Extended Variants

Instead of relying solely on runtime scaling, add **pre-extended variants** for common durations.

**Example: Endurance Workout Family**

```json
[
  {
    "id": "endurance_z2_base_60",
    "name": "Base Endurance 60 min",
    "base_duration_min": 60,
    "extensible": true,
    "duration_scaling_strategy": "extend_main",
    "variable_components": {
      "adjustable_field": "duration",
      "min_value": 45,
      "max_value": 90
    }
  },
  {
    "id": "endurance_z2_base_90",
    "name": "Base Endurance 90 min",
    "base_duration_min": 90,
    "extensible": true,
    "duration_scaling_strategy": "extend_main",
    "variable_components": {
      "adjustable_field": "duration",
      "min_value": 60,
      "max_value": 150
    }
  },
  {
    "id": "endurance_z2_base_120",  // NEW VARIANT
    "name": "Base Endurance 120 min",
    "base_duration_min": 120,
    "extensible": true,
    "duration_scaling_strategy": "extend_main",
    "variable_components": {
      "adjustable_field": "duration",
      "min_value": 90,
      "max_value": 180
    }
  },
  {
    "id": "endurance_z2_base_150",  // NEW VARIANT
    "name": "Base Endurance 150 min",
    "base_duration_min": 150,
    "extensible": true,
    "duration_scaling_strategy": "extend_main",
    "variable_components": {
      "adjustable_field": "duration",
      "min_value": 120,
      "max_value": 210
    }
  }
]
```

**Generation Strategy:**

```python
def generate_workout_variants(base_workout: Workout, durations: list[int]) -> list[Workout]:
    """Generate duration variants of a base workout."""
    variants = []

    for duration in durations:
        variant = deepcopy(base_workout)
        variant.id = f"{base_workout.id}_{duration}"
        variant.name = f"{base_workout.name} ({duration} min)"
        variant.base_duration_min = duration

        # Scale segments proportionally
        scaling_factor = duration / base_workout.base_duration_min
        for segment in variant.segments:
            if segment.duration_min:
                segment.duration_min *= scaling_factor

        # Update variable_components bounds
        if variant.variable_components:
            variant.variable_components.min_value = duration * 0.75
            variant.variable_components.max_value = duration * 1.5

        # Recalculate TSS
        variant.base_tss = base_workout.base_tss * scaling_factor

        variants.append(variant)

    return variants
```

**Target Coverage:**

```
Generate variants for top 20 most-used workouts:
- Endurance Z2: [60, 90, 120, 150, 180, 210] → 6 variants × 3 base = 18 workouts
- Sweet Spot: [70, 85, 100] → 3 variants × 2 base = 6 workouts
- Tempo: [70, 85, 100] → 3 variants × 2 base = 6 workouts
- Threshold Intervals: [60, 75, 90] → 3 variants × 2 base = 6 workouts

TOTAL NEW WORKOUTS: ~40-50
NEW LIBRARY SIZE: 262-272 workouts
```

---

## Validation & Quality Assurance

### Automated Validation Script

```python
def validate_enhanced_library(library: WorkoutLibrary) -> ValidationReport:
    """Validate library enhancements."""
    report = ValidationReport()

    for workout in library.workouts:
        # Check 1: extensible flag consistency
        if workout.variable_components and not workout.extensible:
            report.add_warning(
                f"{workout.id}: Has variable_components but extensible=False"
            )

        # Check 2: duration_scaling_strategy consistency
        if workout.extensible and workout.duration_scaling_strategy == "fixed":
            report.add_warning(
                f"{workout.id}: extensible=True but strategy='fixed'"
            )

        # Check 3: variable_components bounds
        if workout.variable_components:
            vc = workout.variable_components
            if vc.min_value >= workout.base_duration_min:
                report.add_error(
                    f"{workout.id}: min_value ({vc.min_value}) >= base_duration ({workout.base_duration_min})"
                )
            if vc.max_value <= workout.base_duration_min:
                report.add_error(
                    f"{workout.id}: max_value ({vc.max_value}) <= base_duration ({workout.base_duration_min})"
                )

        # Check 4: segment bounds
        for seg in workout.segments:
            if hasattr(seg, "min_duration_min") and seg.min_duration_min:
                if seg.duration_min and seg.duration_min < seg.min_duration_min:
                    report.add_error(
                        f"{workout.id}: Segment {seg.type} duration ({seg.duration_min}) < min ({seg.min_duration_min})"
                    )

    return report
```

### Quality Metrics

**Pre-Migration:**
- Total workouts: 222
- Extensible workouts: 90 (40.5%)
- Validation errors: 0

**Post-Migration Target:**
- Total workouts: 262-272 (40-50 new variants)
- Extensible workouts: 170-180 (63-66%)
- Validation errors: 0
- All new fields populated: 100%

---

## Implementation Checklist

### Phase 1: Schema Updates (Week 1)

- [ ] Add `extensible` field to `Workout` model (optional, default=False)
- [ ] Add `duration_scaling_strategy` field (optional, default="fixed")
- [ ] Add segment-level `min_duration_min`, `max_duration_min`, `scalable` fields
- [ ] Update Pydantic models with backward-compatible defaults
- [ ] Run `mypy --strict` validation (must pass)
- [ ] Update unit tests for model changes

### Phase 2: Migration Script (Week 1)

- [ ] Create `scripts/migrate_workout_library.py`
- [ ] Implement `migrate_add_extensible_flag()`
- [ ] Implement `migrate_add_duration_scaling_strategy()`
- [ ] Implement `migrate_add_segment_metadata()`
- [ ] Add CLI arguments for selective migration
- [ ] Create `scripts/validate_workout_library.py`
- [ ] Test migration on copy of library
- [ ] Validate output with 100% pass rate

### Phase 3: Variant Generation (Week 2)

- [ ] Create `scripts/generate_workout_variants.py`
- [ ] Identify top 20 most-used workouts (from logs/analytics)
- [ ] Generate 40-50 duration variants
- [ ] Validate all variants (structure, TSS, segments)
- [ ] Merge variants into library
- [ ] Re-run full library validation

### Phase 4: Integration (Week 2)

- [ ] Update `WorkoutLibraryLoader` to handle new fields
- [ ] Add extensibility-aware filtering in `WorkoutSelector`
- [ ] Implement `scale_workout_by_strategy()` in `selector.py`
- [ ] Update `select_workout()` to prioritize extensible workouts
- [ ] Add integration tests with new library
- [ ] Performance benchmark (should remain <1s per week)

### Phase 5: Deployment (Week 3)

- [ ] Backup production library: `workout_library_v1_backup.json`
- [ ] Run migration on production library
- [ ] Validate migrated library (zero errors)
- [ ] Deploy new library to production
- [ ] Monitor first 100 plan generations
- [ ] Rollback if validation pass rate < 95%

---

## Maintenance Strategy

### Ongoing Library Updates

**When adding new workouts:**

1. Always populate new fields:
   ```json
   {
     "id": "new_workout_xyz",
     "extensible": true,  // ← Required
     "duration_scaling_strategy": "proportional",  // ← Required
     "variable_components": { ... }  // ← If applicable
   }
   ```

2. Run validation before committing:
   ```bash
   python scripts/validate_workout_library.py data/workout_library.json
   ```

3. Test with selector:
   ```bash
   pytest tests/core/workout_library/test_selector.py -k new_workout_xyz
   ```

### Library Version Management

```json
{
  "version": "2.0.0",  // Increment on schema changes
  "schema_version": "2.0",  // Tracks schema compatibility
  "description": "Enhanced with extensibility metadata",
  "last_updated": "2025-11-04",
  "total_workouts": 272,
  "extensible_workouts": 178,
  "workouts": [ ... ]
}
```

---

## Alternative Approaches Considered

### Alternative 1: Runtime Generation (No Library Updates)

**Approach:** Generate workout variants on-the-fly from base templates.

**Pros:**
- Zero library changes
- Infinite flexibility

**Cons:**
- Complex runtime logic
- Harder to validate quality
- No pre-tested variants
- Performance overhead

**Verdict:** REJECTED - Pre-generated variants provide quality guarantees.

### Alternative 2: Workout Templates (Parameterized)

**Approach:** Define workouts as templates with parameters:

```json
{
  "id": "endurance_z2_template",
  "template": true,
  "parameters": {
    "duration": {"min": 60, "max": 240, "step": 15}
  }
}
```

**Pros:**
- Compact representation
- Easy to add new durations

**Cons:**
- Breaking schema change
- Existing 222 workouts need conversion
- More complex selection logic

**Verdict:** REJECTED - Too invasive, benefits don't justify migration cost.

### Alternative 3: Separate Variant Library

**Approach:** Keep original library, add `workout_library_variants.json`.

**Pros:**
- No changes to existing library
- Easy rollback

**Cons:**
- Two libraries to maintain
- Merging logic complexity
- Duplicate data

**Verdict:** CONSIDERED but REJECTED - Single unified library is cleaner.

---

## Cost-Benefit Analysis

### Implementation Cost

| Task | Effort | Risk |
|------|--------|------|
| Schema updates | 2 hours | LOW |
| Migration script | 4 hours | LOW |
| Variant generation | 6 hours | MEDIUM |
| Integration & testing | 8 hours | MEDIUM |
| Deployment | 2 hours | LOW |
| **TOTAL** | **22 hours** | **LOW-MEDIUM** |

### Expected Benefits

| Benefit | Impact | Measurement |
|---------|--------|-------------|
| Increased extensibility coverage | HIGH | 40% → 65% |
| Better duration matching | HIGH | ±10% → ±5% accuracy |
| Reduced runtime adjustments | MEDIUM | 15 min → 8 min avg |
| Improved selection speed | LOW | Already fast (<1s) |
| Better code maintainability | MEDIUM | Clearer intent |

**ROI:** HIGH - 22 hours investment for 25% increase in success rate and 50% reduction in errors.

---

## Documentation Updates Required

1. **Library Schema Documentation**
   - Update `docs/WORKOUT_LIBRARY_SCHEMA.md` with new fields
   - Add migration guide
   - Document scaling strategies

2. **Developer Guide**
   - How to add new extensible workouts
   - How to generate variants
   - Validation checklist

3. **User Guide**
   - No user-facing changes (internal optimization)

---

## Conclusion

The proposed workout library enhancements are **low-risk, high-reward** improvements that:

1. **Leverage existing infrastructure** (90 workouts already have variable_components)
2. **Maintain 100% backward compatibility** (all new fields optional)
3. **Increase extensibility coverage** (40% → 65%)
4. **Provide runtime optimization hints** (scaling strategies)
5. **Enable pre-tested duration variants** (40-50 new workouts)

**Total implementation effort:** 22 hours
**Expected improvement:** 25% increase in validation pass rate

**Recommendation:** APPROVE for implementation in Weeks 1-3 of duration adjustment project.

---

**Document Status:** COMPLETE
**Next Document:** ARCHITECTURE_PLAN.md
