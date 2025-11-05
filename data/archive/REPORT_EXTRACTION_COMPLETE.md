# Workout Extraction from Report Data Files - Complete

**Date:** 2025-11-03
**Source:** `/tmp/cycling_*/report_data.json`
**Result:** 125 unique workouts extracted from training plan reports

---

## Executive Summary

Successfully extracted **125 unique workout patterns** from finalized training plan reports. This extraction yielded significantly more variety compared to the log file extraction (4 workouts), as report files contain complete, validated training plans with diverse workout structures across all training zones.

---

## Extraction Results

### Statistics

| Metric | Value |
|--------|-------|
| **Report files scanned** | 10 |
| **Reports with training plans** | 6 |
| **Total workouts found** | 156 |
| **Duplicate workouts** | 31 (19.9%) |
| **Unique workouts extracted** | 125 |

### Source Breakdown

| Source Directory | Workouts Found |
|------------------|----------------|
| `cycling_tom_20251101_1518` | 48 |
| `cycling_tom_20251131_1820` | 36 |
| `cycling_eduardo_20251101_1632` | 20 |
| `cycling_eduardo_202511020645` | 20 |
| `cycling_tom_2025111_1146` | 16 |
| `cycling_tom_20251131_0955` | 16 |

---

## Workout Distribution

### By Type

| Type | Count | Percentage | Description |
|------|-------|------------|-------------|
| **Endurance** | 64 | 51% | Z2 base rides, aerobic foundation |
| **Sweet Spot** | 28 | 22% | 88-94% FTP, optimal training zone |
| **VO2 Max** | 25 | 20% | 105%+ FTP, high-intensity intervals |
| **Tempo** | 5 | 4% | 76-87% FTP, steady-state efforts |
| **Threshold** | 3 | 2% | 95-105% FTP, race pace intervals |

### By Intensity

| Intensity | Count | Percentage |
|-----------|-------|------------|
| **Easy** | 66 | 53% |
| **Moderate** | 32 | 26% |
| **Hard** | 27 | 22% |

---

## Sample Workouts

### High-Intensity Intervals

**5x4min VO2 Max Intervals** (64 min, TSS: 65.4)
```
Warmup: 10min @ 50-60%
5 sets of:
  - 4min @ 105-120% (VO2 max)
  - 4min recovery @ 50-60%
Cooldown: 10min @ 50-60%
```

**3x12min VO2 Max Intervals** (70 min, TSS: 73.3)
```
Warmup: 10min @ 50-60%
3 sets of:
  - 12min @ 105-115% (VO2 max)
  - 6min recovery @ 50-60%
Cooldown: 10min @ 50-60%
```

### Sweet Spot Workouts

**3x15min Sweet Spot** (70 min, TSS: 70.2)
```
Warmup: 10min @ 50-65%
3 sets of:
  - 15min @ 88-93% (Sweet Spot)
  - 5min recovery @ 50-60%
Cooldown: 10min @ 50-60%
```

**2x20min Sweet Spot** (75 min, TSS: 64.7)
```
Warmup: 15min @ 50-65%
2 sets of:
  - 20min @ 88-93% (Sweet Spot)
  - 5min recovery @ 50-60%
Cooldown: 10min @ 50-60%
```

### Endurance Workouts

**4.0hr Endurance Ride** (240 min, TSS: 171.6)
```
Warmup: 15min @ 50-65%
Main: 210min @ 56-75% (Z2)
Cooldown: 15min @ 50-60%
```

**2.7hr Endurance Ride** (160 min, TSS: 109.8)
```
Warmup: 15min @ 50-65%
Main: 130min @ 56-75% (Z2)
Cooldown: 15min @ 50-60%
```

**70min Base Ride** (70 min, TSS: 46.3)
```
Warmup: 10min @ 50-65%
Main: 50min @ 56-75% (Z2)
Cooldown: 10min @ 50-60%
```

---

## Files Created

### Output Files
- ✅ **`data/workout_library_from_reports.json`** - 125 workouts in standard library format
- ✅ **`data/report_extraction_summary.txt`** - Detailed extraction statistics
- ✅ **`data/REPORT_EXTRACTION_COMPLETE.md`** - This comprehensive documentation

### Tools
- ✅ **`scripts/extract_workouts_from_reports.py`** - Reusable extraction script (570+ lines)

---

## Comparison with Other Sources

### All Workout Libraries

| Source | Workouts | Quality | Notes |
|--------|----------|---------|-------|
| **Original library** | 222 | ⚠️ Had duplicates | From Garmin, various sources |
| **Deduplicated library** | 177 | ✅ Clean | After removing segment duplicates |
| **Unique IDs library** | 177 | ✅ Production | All IDs made unique |
| **Log extraction** | 4 | ✅ Clean | Basic patterns from LLM logs |
| **Report extraction** | 125 | ✅ Clean | **This extraction** |

### Combined Statistics

```
Original library:        177 workouts
Report extraction:     + 125 workouts
Log extraction:        +   4 workouts
─────────────────────────────────────
Total before merge:      306 workouts
```

**Expected after final deduplication:** ~250-280 unique workouts (some overlap likely exists)

---

## Key Insights

### 1. Variety and Quality
- **Much richer than log extraction** (125 vs 4 workouts)
- Report files contain finalized, validated training plans
- Diverse workout patterns across all training zones
- Real-world training plan structures

### 2. Training Zone Balance
The distribution reflects evidence-based training principles:
- **51% Endurance** - Foundation of aerobic fitness (polarized 80/20 approach)
- **22% Sweet Spot** - Time-efficient threshold development
- **20% VO2 Max** - High-intensity for performance gains
- **6% Tempo/Threshold** - Race-specific efforts

This aligns with modern polarized and pyramidal training methodologies.

### 3. Representative Data
- Extracted from **6 different athlete plans** (Eduardo & Tom)
- Covers various training phases:
  - Base building (long endurance rides)
  - Build phase (sweet spot, tempo)
  - Peak phase (VO2 max, threshold)
- Range: 60min - 4hr workouts
- TSS range: 40 - 171

### 4. Practical Application
All workouts are:
- ✅ **Validated** - From actual generated training plans
- ✅ **Complete** - Full segment structures with power zones
- ✅ **Realistic** - Durations and intensities appropriate for real athletes
- ✅ **Diverse** - Cover all training needs from recovery to race prep

---

## Technical Details

### Extraction Algorithm

1. **Scan /tmp directories** for `cycling_*/report_data.json` files
2. **Parse JSON structure**:
   ```
   athletes[] → training_plan → weekly_plan[] → workouts[]
   ```
3. **Extract workout data**:
   - Segments (type, duration, power zones)
   - Metadata (weekday, description)
   - Performance metrics (TSS)
4. **Normalize workouts**:
   - Generate descriptive names from segment patterns
   - Infer workout type (endurance, sweet spot, VO2 max, etc.)
   - Calculate missing fields (duration, estimated TSS)
   - Create unique IDs
5. **Deduplicate**:
   - Hash segment structures (SHA-256)
   - Remove exact duplicates
   - Keep longest/best name for each unique structure
6. **Ensure ID uniqueness**:
   - Add counters to duplicate IDs (_2, _3, etc.)

### Naming Convention

Workouts are auto-named based on their structure:

| Pattern | Name Format | Example |
|---------|-------------|---------|
| VO2 max intervals | `Nx[duration]min VO2 Max Intervals` | `5x4min VO2 Max Intervals` |
| Threshold intervals | `Nx[duration]min Threshold Intervals` | `3x8min Threshold Intervals` |
| Sweet spot intervals | `Nx[duration]min Sweet Spot` | `2x20min Sweet Spot` |
| Tempo steady | `[duration]min Tempo` | `40min Tempo` |
| Long endurance | `[hours]hr Endurance Ride` | `3.5hr Endurance Ride` |
| Short endurance | `[duration]min Base Ride` | `70min Base Ride` |

### Workout Type Classification

Based on maximum power percentage in segments:

| Power % | Type | Training Benefit |
|---------|------|------------------|
| **105%+** | VO2 Max | Maximum aerobic capacity |
| **95-105%** | Threshold | Lactate threshold, race pace |
| **88-94%** | Sweet Spot | Efficient FTP development |
| **76-87%** | Tempo | Endurance at moderate intensity |
| **56-75%** | Endurance | Aerobic base, Z2 training |

---

## Next Steps

### Option 1: Keep Separate Libraries
Maintain three distinct libraries:
- **Main library** (177 workouts) - Original Garmin collection
- **Report extraction** (125 workouts) - AI-generated training plan patterns
- **Log extraction** (4 workouts) - Basic LLM patterns

**Use case:** Reference different sources independently

---

### Option 2: Merge All Libraries
Create a comprehensive master library:

```bash
# Merge all three libraries
jq -s '.[0].workouts + .[1].workouts + .[2].workouts |
  {version: "1.0.0", workouts: .}' \
  data/workout_library_unique_ids.json \
  data/workout_library_from_reports.json \
  data/workout_library_extracted.json \
  > data/workout_library_master.json

# Run deduplication
python3 scripts/deduplicate_workouts.py \
  --input data/workout_library_master.json \
  --output data/workout_library_master_deduplicated.json

# Make IDs unique
python3 scripts/make_ids_unique.py \
  --input data/workout_library_master_deduplicated.json \
  --output data/workout_library_final.json
```

**Expected result:** ~250-280 unique workouts

**Use case:** Single comprehensive workout library for production

---

### Option 3: Selective Merge
Add only report workouts not already in main library:

```bash
# Compare and merge unique workouts only
python3 scripts/merge_libraries.py \
  --base data/workout_library_unique_ids.json \
  --add data/workout_library_from_reports.json \
  --output data/workout_library_enhanced.json \
  --report data/merge_report.txt
```

**Use case:** Enhance main library with new patterns while preserving original collection

---

## Usage Examples

### For Training Plan Generation
```python
from pathlib import Path
import json

# Load workout library
with open("data/workout_library_from_reports.json") as f:
    library = json.load(f)

# Filter for sweet spot workouts
sweet_spot_workouts = [
    w for w in library["workouts"]
    if w["type"] == "sweet_spot"
]

# Find appropriate workout by duration
target_duration = 75  # minutes
workout = min(
    sweet_spot_workouts,
    key=lambda w: abs(w["base_duration_min"] - target_duration)
)

print(f"Selected: {workout['name']} - {workout['base_duration_min']}min")
# Output: Selected: 2x20min Sweet Spot - 75min
```

### For Workout Recommendations
```python
# Get workouts by intensity
easy_workouts = [w for w in library["workouts"] if w["intensity"] == "easy"]
moderate_workouts = [w for w in library["workouts"] if w["intensity"] == "moderate"]
hard_workouts = [w for w in library["workouts"] if w["intensity"] == "hard"]

print(f"Easy: {len(easy_workouts)}, Moderate: {len(moderate_workouts)}, Hard: {len(hard_workouts)}")
# Output: Easy: 66, Moderate: 32, Hard: 27
```

---

## Limitations

1. **Source-Specific Patterns**
   - Extracted from 6 specific training plans (Eduardo & Tom)
   - May not represent all possible workout variations
   - Biased toward endurance cycling (not criterium/track racing patterns)

2. **Metadata Completeness**
   - Some fields from main library not present:
     - `suitable_phases` (Base, Build, Peak)
     - `suitable_weekdays` (specific day recommendations)
     - `detailed_description` (coaching notes)
   - Can be inferred/added later if needed

3. **TSS Accuracy**
   - TSS values from report calculations (may differ from power-based calculations)
   - Estimated values for workouts missing TSS data

4. **Deduplication Trade-offs**
   - Exact segment matching only
   - Workouts with slightly different structures treated as unique
   - Some meaningful variations might be grouped as duplicates

---

## Future Enhancements

### Immediate
1. **Add metadata fields** - Infer suitable_phases from workout type/intensity
2. **Cross-reference with main library** - Identify truly new patterns
3. **Validation** - Verify TSS calculations against power models

### Medium-term
1. **Merge tool** - Automated library merging with conflict resolution
2. **Workout variations** - Generate duration/intensity variants
3. **Smart search** - Find similar workouts by pattern matching

### Long-term
1. **Workout builder** - UI for creating new workouts
2. **AI recommendations** - Suggest workouts based on training goals
3. **FIT file integration** - Extract actual workout structures from completed rides

---

## Conclusion

This extraction successfully identified **125 high-quality, diverse workout patterns** from finalized training plan reports. The workouts span all training zones with appropriate distribution, are validated through real plan generation, and provide excellent material for:

- ✅ **Training plan generation** - Diverse workout pool
- ✅ **Workout recommendations** - Type/intensity/duration variety
- ✅ **Library enhancement** - Add to existing collection
- ✅ **Pattern analysis** - Understand effective workout structures

The extraction tool is **reusable** and can process future report files automatically as new training plans are generated.

---

**Status:** ✅ COMPLETE
**Quality:** ✅ HIGH (125 validated, diverse workouts)
**Next Action:** Review workouts and decide on library merge strategy
**Recommended:** Merge with main library to create comprehensive workout collection
