# Workout Library Cleanup Summary

**Date:** 2025-11-03
**Original File:** `data/workout_library.json` (222 workouts)
**Final Clean File:** `data/workout_library_unique_ids.json` (177 workouts, all unique IDs)

---

## Overview

The workout library had two major issues:
1. **Duplicate segments**: Multiple workouts with identical segment structures
2. **Duplicate IDs**: Same ID used for multiple different workouts

This cleanup process addressed both issues in two steps.

---

## Step 1: Segment Deduplication

**Script:** `scripts/deduplicate_workouts.py`
**Input:** `data/workout_library.json` (222 workouts)
**Output:** `data/workout_library_deduplicated.json` (177 workouts)
**Report:** `data/deduplication_report.txt`

### What Was Done
- Identified workouts with **identical segments** (same structure, duration, power zones)
- Found **55 duplicate groups** containing 2-11 workouts each
- **Removed 45 workout entries** that were exact duplicates
- **Selection criteria**: Kept the workout with the **longest name** (most descriptive)

### Examples of Removed Duplicates

| ✓ KEPT | ✗ REMOVED | Reason |
|--------|-----------|--------|
| "Base Fitness @ 60-65% Threshold" (31 chars) | "2hr Base Fitness" (16 chars) | More descriptive |
| "1hr Base Fitness @ 60-65% Threshold" (35 chars) | "1hr Base Fitness" (16 chars) | Includes zone info |
| "Base Fitness @ 60-65% Threshold" (31 chars) | "3hr Base Fitness" (16 chars) | More descriptive |

### Key Statistics
- **Duplicate groups found:** 55
- **Total entries removed:** 45
- **Unique workout IDs removed:** 12 different IDs
- **Reduction:** 20% smaller library (222 → 177)

---

## Step 2: ID Uniqueness

**Script:** `scripts/make_ids_unique.py`
**Input:** `data/workout_library_deduplicated.json` (177 workouts, 41 unique IDs)
**Output:** `data/workout_library_unique_ids.json` (177 workouts, 177 unique IDs)
**Report:** `data/id_uniqueness_report.txt`

### What Was Done
- Found **26 base IDs** that appeared multiple times
- Added counter suffixes (_2, _3, _4, etc.) to duplicate IDs
- First occurrence keeps original ID, subsequent get counters
- **162 workouts** received modified IDs
- **All 177 workouts now have unique IDs** ✓

### Top Duplicate IDs (Before → After)

| Base ID | Occurrences | New IDs Generated |
|---------|-------------|-------------------|
| `base_fitness_training_zone_two` | 18 | `base_fitness_training_zone_two`, `..._2`, `..._3`, ..., `..._18` |
| `sub_threshold_efforts` | 18 | `sub_threshold_efforts`, `..._2`, `..._3`, ..., `..._18` |
| `threshold_efforts` | 17 | `threshold_efforts`, `..._2`, `..._3`, ..., `..._17` |
| `map_efforts` | 15 | `map_efforts`, `..._2`, `..._3`, ..., `..._15` |
| `optional_aerobic_endurance_ride` | 14 | `optional_aerobic_endurance_ride`, `..._2`, ..., `..._14` |
| `above_and_below_threshold` | 10 | `above_and_below_threshold`, `..._2`, ..., `..._10` |
| `1hr_base_fitness_60_65_threshold` | 10 | `1hr_base_fitness_60_65_threshold`, `..._2`, ..., `..._10` |
| `active_recovery` | 7 | `active_recovery`, `..._2`, `..._3`, ..., `..._7` |

### Key Statistics
- **Original unique IDs:** 41
- **Final unique IDs:** 177 (100% unique)
- **IDs modified:** 26 different base IDs
- **Workouts affected:** 162 received counter suffixes
- **Workouts unchanged:** 15 already had unique IDs

---

## Final Statistics

| Metric | Value |
|--------|-------|
| **Original workouts** | 222 |
| **After segment deduplication** | 177 |
| **After ID uniqueness** | 177 |
| **Total removed** | 45 (20% reduction) |
| **Unique IDs (verified)** | 177 (100%) ✓ |

---

## Files Created

### Output Files
- ✅ `data/workout_library_deduplicated.json` - After segment deduplication
- ✅ `data/workout_library_unique_ids.json` - **FINAL clean version (ready to use)**

### Reports
- ✅ `data/deduplication_report.txt` - Detailed segment deduplication report (55 groups)
- ✅ `data/id_uniqueness_report.txt` - Detailed ID uniqueness report (26 IDs modified)
- ✅ `data/CLEANUP_SUMMARY.md` - This summary document

### Scripts (Reusable)
- ✅ `scripts/deduplicate_workouts.py` - Segment deduplication tool
- ✅ `scripts/make_ids_unique.py` - ID uniqueness tool

---

## Verification

```bash
# Verify all IDs are unique
jq '.workouts | length' data/workout_library_unique_ids.json
# Output: 177

jq -r '.workouts[].id' data/workout_library_unique_ids.json | sort -u | wc -l
# Output: 177

# All IDs are unique: ✓ YES
```

---

## Recommended Next Steps

### Option 1: Replace Original File (Recommended)
```bash
# Backup original
cp data/workout_library.json data/workout_library_BACKUP_20251103.json

# Replace with cleaned version
cp data/workout_library_unique_ids.json data/workout_library.json
```

### Option 2: Review Before Replacing
1. Review `data/deduplication_report.txt` to see which workouts were removed
2. Review `data/id_uniqueness_report.txt` to see which IDs were modified
3. Spot-check a few workouts in `data/workout_library_unique_ids.json`
4. Once satisfied, replace the original file

---

## Technical Details

### Deduplication Algorithm
1. Hash each workout's segment structure using SHA-256
2. Group workouts by segment hash
3. Within each group, select workout with longest name
4. Remove all other workouts from that group

### ID Uniqueness Algorithm
1. Count occurrences of each workout ID
2. For IDs that appear multiple times:
   - First occurrence keeps original ID
   - Subsequent occurrences get `_2`, `_3`, `_4`, etc.
3. Verify final uniqueness (all IDs unique)

### Segment Comparison
Segments are compared **exactly**, including:
- `type` (warmup, steady, interval, cooldown, etc.)
- `duration_min`
- `power_low_pct` and `power_high_pct`
- `description`
- All other segment fields

---

## Questions?

If you need to:
- Re-run deduplication with different criteria
- Adjust ID naming strategy
- Generate additional reports

The scripts are reusable and well-documented. Run with `--help` or review the source code.

---

**Cleanup Status:** ✅ COMPLETE
**Library Ready:** ✅ YES
**All IDs Unique:** ✅ YES (177/177)
