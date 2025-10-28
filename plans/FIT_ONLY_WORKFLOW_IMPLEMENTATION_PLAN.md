# FIT-Only Workflow Implementation Plan

**Goal:** Enable the system to work directly from FIT files + athlete profile, without requiring a CSV export from Strava.

**Status:** Foundation complete, 4 major components remaining

---

## Architecture Overview

### Current (CSV-first):
```
CSV file → Phase 1: Read CSV → Create Parquet cache with zones → Phases 2-4 use cache
```

### New (FIT-first OR CSV-first):
```
Option A: CSV file → Phase 1: Read CSV → Create Parquet cache with zones → Phases 2-4
Option B: FIT directory → Phase 1: Extract from FIT → Create Parquet cache with zones → Phases 2-4
```

---

## Completed Components

### ✅ 1. FIT Metadata Extractor (`src/cycling_ai/utils/fit_metadata_extractor.py`)

**Status:** Complete and tested

**What it does:**
- Scans directory for .fit/.fit.gz files
- Extracts session metadata (date, distance, power, HR, etc.)
- Returns list of dictionaries matching CSV column structure
- Handles decompression of .fit.gz files
- Uses fitparse library for metadata extraction

**Test Results:**
```
✅ Successfully extracts from .fit.gz files
✅ Handles multiple activity types (Cycling, Training, etc.)
✅ Returns proper data types (int, float, datetime)
✅ Tested with real data - 5 sample files parsed successfully
```

---

## Remaining Components

### 🔄 2. Update CachePreparationTool

**File:** `src/cycling_ai/tools/wrappers/cache_preparation_tool.py`

**Changes Required:**

#### A. Add FIT-only mode parameter
```python
ToolParameter(
    name="csv_file_path",
    type="string",
    description="Path to Strava CSV file (optional if fit_dir_path provided)",
    required=False,  # Changed from True
),
ToolParameter(
    name="fit_only_mode",
    type="boolean",
    description="Build cache directly from FIT files without CSV",
    required=False,
    default=False,
),
```

#### B. Update execute() method logic

**Location:** Lines 67-89

**Current code:**
```python
def execute(self, **kwargs: Any) -> ToolExecutionResult:
    csv_path = Path(kwargs["csv_file_path"])
    profile_path = Path(kwargs["athlete_profile_path"])
    fit_dir_path = kwargs.get("fit_dir_path")

    # Create cache directory
    cache_dir = csv_path.parent / "cache"
    cache_dir.mkdir(exist_ok=True)

    # Read CSV
    df = pd.read_csv(csv_path)
    # ... rest of CSV processing
```

**New code:**
```python
def execute(self, **kwargs: Any) -> ToolExecutionResult:
    csv_path = kwargs.get("csv_file_path")
    profile_path = Path(kwargs["athlete_profile_path"])
    fit_dir_path = kwargs.get("fit_dir_path")
    fit_only_mode = kwargs.get("fit_only_mode", False)

    # Validate inputs
    if not csv_path and not fit_dir_path:
        return ToolExecutionResult(
            success=False,
            data={"error": "Must provide either csv_file_path or fit_dir_path"},
            format="json",
            errors=["Missing required input: CSV or FIT directory"]
        )

    # Determine cache location
    if csv_path:
        cache_dir = Path(csv_path).parent / "cache"
    else:
        # FIT-only mode: cache in FIT directory parent
        cache_dir = Path(fit_dir_path).parent / "cache"

    cache_dir.mkdir(exist_ok=True)
    parquet_path = cache_dir / "activities_processed.parquet"
    metadata_path = cache_dir / "cache_metadata.json"

    try:
        # Build DataFrame from CSV or FIT files
        if fit_only_mode or not csv_path:
            # FIT-only mode: build DataFrame from FIT files
            from cycling_ai.utils.fit_metadata_extractor import scan_fit_directory

            logger.info(f"Building cache from FIT files in {fit_dir_path}")
            activities_list = scan_fit_directory(fit_dir_path)

            if not activities_list:
                return ToolExecutionResult(
                    success=False,
                    data={"error": "No valid FIT files found"},
                    format="json",
                    errors=["No activities extracted from FIT directory"]
                )

            df = pd.DataFrame(activities_list)
            original_count = len(df)
            original_size = None  # No CSV to measure

            # Parse Activity Date as datetime (already datetime from FIT extraction)
            if "Activity Date" in df.columns:
                df["Activity Date"] = pd.to_datetime(df["Activity Date"], errors='coerce')
        else:
            # CSV mode: existing logic
            csv_path = Path(csv_path)
            df = pd.read_csv(csv_path)
            original_count = len(df)
            original_size = csv_path.stat().st_size

            # Parse Activity Date as datetime
            if "Activity Date" in df.columns:
                df["Activity Date"] = pd.to_datetime(df["Activity Date"], format='mixed', errors='coerce')

        # Convert numeric columns (same for both modes)
        numeric_columns = [
            "Distance", "Moving Time", "Elapsed Time",
            "Elevation Gain", "Elevation Loss",
            "Average Speed", "Max Speed",
            "Average Heart Rate", "Max Heart Rate",
            "Average Watts", "Max Watts", "Weighted Average Power",
            "Average Cadence", "Max Cadence",
            "Calories"
        ]

        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # ... rest of existing code for FTP loading and zone enrichment
```

#### C. Update metadata creation

**Location:** Lines 156-169

**Changes:**
```python
metadata = {
    "version": "2.0" if zone_enriched else "1.0",
    "created_at": datetime.now().isoformat(),
    "source_type": "fit" if fit_only_mode else "csv",  # NEW
    "source_csv": str(csv_path) if csv_path else None,  # Changed
    "source_fit_dir": str(fit_dir_path) if fit_dir_path else None,  # NEW
    "source_file_mtime": datetime.fromtimestamp(csv_path.stat().st_mtime).isoformat() if csv_path else None,  # Changed
    "activity_count": original_count,
    "original_size_bytes": original_size if original_size else None,  # Changed
    "cache_size_bytes": parquet_size,
    "compression_ratio_percent": round((1 - parquet_size / original_size) * 100, 1) if original_size else None,  # Changed
    "zone_enriched": zone_enriched,
    "ftp_watts": ftp,
    "enrichment_summary": enrichment_summary,
}
```

---

### 🔄 3. Update DataValidationTool

**File:** `src/cycling_ai/tools/wrappers/data_validation_tool.py`

**Changes Required:**

#### A. Make CSV parameter optional

**Location:** Lines 30-41

**Current:**
```python
ToolParameter(
    name="csv_file_path",
    type="string",
    description="Absolute path to Strava activities CSV export file",
    required=True,
),
```

**New:**
```python
ToolParameter(
    name="csv_file_path",
    type="string",
    description="Absolute path to Strava activities CSV export file (optional if fit_dir_path provided)",
    required=False,
),
```

#### B. Update validation logic

**Location:** Lines 62-100 (execute method)

**Current logic:**
- Checks CSV exists
- Validates CSV structure
- Checks profile
- Optionally checks FIT directory

**New logic:**
```python
def execute(self, **kwargs: Any) -> ToolExecutionResult:
    csv_path = kwargs.get("csv_file_path")
    profile_path = Path(kwargs["athlete_profile_path"])
    fit_dir_path = kwargs.get("fit_dir_path")

    issues = []
    warnings = []

    # Validate that we have at least one data source
    if not csv_path and not fit_dir_path:
        return ToolExecutionResult(
            success=False,
            data={
                "success": False,
                "message": "❌ Must provide either CSV file or FIT directory",
                "issues": ["No data source provided"]
            },
            format="json",
            errors=["No data source provided"]
        )

    # CSV validation (if provided)
    csv_valid = False
    activity_count_csv = 0
    if csv_path:
        csv_path = Path(csv_path)
        if not csv_path.exists():
            issues.append(f"CSV file not found: {csv_path}")
        else:
            try:
                import pandas as pd
                df = pd.read_csv(csv_path)
                activity_count_csv = len(df)

                # Check required columns
                required_cols = ["Activity Date", "Activity Type", "Distance", "Moving Time"]
                missing_cols = [col for col in required_cols if col not in df.columns]

                if missing_cols:
                    issues.append(f"CSV missing required columns: {missing_cols}")
                else:
                    csv_valid = True
            except Exception as e:
                issues.append(f"CSV validation error: {str(e)}")

    # Athlete profile validation (always required)
    profile_valid = False
    ftp = 0
    if not profile_path.exists():
        issues.append(f"Athlete profile not found: {profile_path}")
    else:
        try:
            with open(profile_path, 'r') as f:
                profile = json.load(f)

            # Check for FTP
            ftp_raw = profile.get("ftp") or profile.get("FTP") or 0
            if isinstance(ftp_raw, str):
                ftp = float(ftp_raw.replace("w", "").replace("W", "").strip())
            else:
                ftp = float(ftp_raw)

            if ftp <= 0:
                warnings.append("FTP not set in profile (zone enrichment will be skipped)")

            profile_valid = True
        except Exception as e:
            issues.append(f"Profile validation error: {str(e)}")

    # FIT directory validation (if provided or if no CSV)
    fit_valid = False
    fit_files_count = 0
    if fit_dir_path:
        fit_dir = Path(fit_dir_path)
        if not fit_dir.exists():
            issues.append(f"FIT directory not found: {fit_dir}")
        else:
            # Count FIT files
            fit_files = list(fit_dir.glob("**/*.fit")) + list(fit_dir.glob("**/*.fit.gz"))
            fit_files_count = len(fit_files)

            if fit_files_count == 0:
                issues.append("No FIT files found in directory")
            else:
                fit_valid = True

    # Determine overall success
    success = profile_valid and (csv_valid or fit_valid)

    # Prepare result
    result_data = {
        "success": success,
        "csv_valid": csv_valid,
        "profile_valid": profile_valid,
        "fit_valid": fit_valid,
        "activity_count": activity_count_csv if csv_valid else fit_files_count,
        "fit_files_count": fit_files_count,
        "ftp": ftp,
        "issues": issues,
        "warnings": warnings,
    }

    # Build message
    if success:
        data_source = "CSV" if csv_valid else "FIT files"
        count = activity_count_csv if csv_valid else fit_files_count
        result_data["message"] = f"✅ Data validation passed! Found {count} activities in {data_source}."
        if fit_files_count > 0 and ftp > 0:
            result_data["message"] += f" {fit_files_count} FIT files available for zone enrichment."
    else:
        result_data["message"] = "❌ Data validation failed. See issues."

    return ToolExecutionResult(
        success=success,
        data=result_data,
        format="json",
        errors=issues if issues else None
    )
```

---

### 🔄 4. Update CLI Generate Command

**File:** `src/cycling_ai/cli/commands/generate.py`

**Changes Required:**

#### A. Make --csv optional

**Location:** Lines 121-126

**Current:**
```python
@click.option(
    "--csv",
    "csv_file",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Path to Strava activities CSV export",
)
```

**New:**
```python
@click.option(
    "--csv",
    "csv_file",
    type=click.Path(exists=True, path_type=Path),
    required=False,
    help="Path to Strava activities CSV export (optional if --fit-dir provided)",
)
```

#### B. Add validation for required inputs

**Location:** Lines 170-190 (in generate function, after parameter parsing)

**Add this validation:**
```python
def generate(
    csv_file: Path | None,
    profile_file: Path,
    fit_dir: Path | None,
    provider: str,
    model: str | None,
    period_months: int,
    training_plan_weeks: int,
    output_dir: Path,
) -> None:
    """Generate comprehensive cycling performance reports..."""

    # Validate inputs
    if not csv_file and not fit_dir:
        console.print("[red]Error: Must provide either --csv or --fit-dir[/red]")
        raise click.Abort()

    if not csv_file and fit_dir:
        console.print(f"[yellow]FIT-only mode: Building cache from {fit_dir}[/yellow]")

    # ... rest of existing code
```

#### C. Update WorkflowConfig construction

**Location:** Lines 240-250

**Current:**
```python
workflow_config = WorkflowConfig(
    csv_file_path=str(csv_file),
    athlete_profile_path=str(profile_file),
    fit_dir_path=str(fit_dir) if fit_dir else None,
    output_dir=output_dir,
    period_months=period_months,
    training_plan_weeks=training_plan_weeks,
)
```

**New:**
```python
workflow_config = WorkflowConfig(
    csv_file_path=str(csv_file) if csv_file else None,  # Changed: handle None
    athlete_profile_path=str(profile_file),
    fit_dir_path=str(fit_dir) if fit_dir else None,
    output_dir=output_dir,
    period_months=period_months,
    training_plan_weeks=training_plan_weeks,
    fit_only_mode=not bool(csv_file),  # NEW: flag for FIT-only mode
)
```

---

### 🔄 5. Update WorkflowConfig

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**Changes Required:**

#### A. Update WorkflowConfig dataclass

**Location:** Lines 30-50

**Current:**
```python
@dataclass
class WorkflowConfig:
    """Configuration for multi-agent workflow execution."""

    csv_file_path: str
    athlete_profile_path: str
    fit_dir_path: str | None
    output_dir: Path
    period_months: int = 6
    training_plan_weeks: int = 12
```

**New:**
```python
@dataclass
class WorkflowConfig:
    """Configuration for multi-agent workflow execution."""

    csv_file_path: str | None  # Changed: optional
    athlete_profile_path: str
    fit_dir_path: str | None
    output_dir: Path
    period_months: int = 6
    training_plan_weeks: int = 12
    fit_only_mode: bool = False  # NEW
```

#### B. Update phase execution to pass fit_only_mode

**Location:** Lines 450-470 (_execute_phase_1 method)

**Current:**
```python
def _execute_phase_1(self, config: WorkflowConfig) -> PhaseResult:
    """Execute Phase 1: Data Preparation."""
    user_message = self.prompts_manager.get_data_preparation_user_prompt(
        csv_file_path=config.csv_file_path,
        athlete_profile_path=config.athlete_profile_path,
        fit_dir_path=config.fit_dir_path or "",
    )
```

**New:**
```python
def _execute_phase_1(self, config: WorkflowConfig) -> PhaseResult:
    """Execute Phase 1: Data Preparation."""
    user_message = self.prompts_manager.get_data_preparation_user_prompt(
        csv_file_path=config.csv_file_path or "None (FIT-only mode)",  # Changed
        athlete_profile_path=config.athlete_profile_path,
        fit_dir_path=config.fit_dir_path or "",
        fit_only_mode=config.fit_only_mode,  # NEW
    )
```

---

### 🔄 6. Update Prompts

**Files:**
- `prompts/default/1.0/data_preparation_user.txt`
- `prompts/default/1.0/data_preparation.txt`

**Changes Required:**

#### A. Update user prompt template

**File:** `data_preparation_user.txt`

**Current:**
```
Prepare cycling data for analysis:

1. Call validate_data_files() to verify all input files exist and are properly formatted
2. If validation passes, call prepare_cache() to create optimized Parquet cache
3. Report validation results and cache details (location, activity count, date range, compression)

CSV: {csv_file_path}
Profile: {athlete_profile_path}
FIT Directory: {fit_dir_path}

Note: Cache will be created in a 'cache/' subdirectory next to the CSV file.
```

**New:**
```
Prepare cycling data for analysis:

1. Call validate_data_files() to verify all input files exist and are properly formatted
2. If validation passes, call prepare_cache() to create optimized Parquet cache
3. Report validation results and cache details (location, activity count, date range, compression)

Data Sources:
- CSV: {csv_file_path}
- Profile: {athlete_profile_path}
- FIT Directory: {fit_dir_path}
- Mode: {"FIT-only (building from FIT files)" if fit_only_mode else "CSV + FIT enrichment"}

Note: Cache will be created in a 'cache/' subdirectory next to the data source.
```

#### B. Update system prompt

**File:** `data_preparation.txt`

**Add this section after line 13:**
```
**Data Source Modes:**
This tool supports two modes:
1. CSV + FIT Mode (default): Validates CSV, creates cache from CSV, enriches with FIT zones
2. FIT-only Mode: Validates FIT directory, creates cache directly from FIT files, includes zones

The mode is determined automatically based on which files are provided.
```

---

## Testing Plan

### Test Case 1: FIT-Only Mode (Your Use Case)

```bash
# Clear any existing cache
rm -rf /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/cache

# Run generate command with FIT-only
cycling-ai generate \
  --profile /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json \
  --fit-dir /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities \
  --provider anthropic \
  --output-dir /tmp/cycling_test_fit_only
```

**Expected Results:**
1. Phase 1 validates FIT directory and profile
2. Phase 1 scans ~928 FIT files
3. Phase 1 creates cache at `.../Athlete_Name/cache/activities_processed.parquet`
4. Cache includes zone enrichment for activities with power data
5. Phases 2-4 use the cache successfully
6. 3 HTML reports generated

### Test Case 2: CSV Mode (Backward Compatibility)

```bash
# Test with CSV (if you have one)
cycling-ai generate \
  --csv activities.csv \
  --profile athlete_profile.json \
  --fit-dir fit_files/ \
  --provider anthropic \
  --output-dir /tmp/cycling_test_csv
```

**Expected Results:**
- Existing behavior preserved
- CSV takes precedence over FIT-only mode

### Test Case 3: Validation Errors

```bash
# Test with neither CSV nor FIT
cycling-ai generate \
  --profile athlete_profile.json \
  --provider anthropic
```

**Expected Result:**
- Error: "Must provide either --csv or --fit-dir"

---

## Implementation Order

Recommended sequence to minimize breaking changes:

1. **Update WorkflowConfig** (5 mins)
   - Add optional fields
   - Test existing CSV workflows still work

2. **Update DataValidationTool** (15 mins)
   - Make CSV optional
   - Add FIT-only validation logic
   - Test validation with FIT-only

3. **Update CachePreparationTool** (30 mins)
   - Add FIT-only mode logic
   - Import fit_metadata_extractor
   - Test cache creation from FIT files

4. **Update CLI** (10 mins)
   - Make --csv optional
   - Add input validation
   - Update help text

5. **Update Prompts** (5 mins)
   - Add FIT-only mode documentation
   - Update user prompt template

6. **End-to-End Testing** (20 mins)
   - Test FIT-only mode with real data
   - Test CSV mode (backward compatibility)
   - Test validation errors

**Total Estimated Time:** 1.5-2 hours

---

## Migration Notes

### For Users

**Before:**
```bash
# Required CSV export from Strava
cycling-ai generate --csv activities.csv --profile profile.json
```

**After (Backward Compatible):**
```bash
# Option 1: Still works with CSV
cycling-ai generate --csv activities.csv --profile profile.json

# Option 2: NEW - FIT-only mode
cycling-ai generate --fit-dir ./fit_files --profile profile.json
```

### Breaking Changes

**None** - This is a backward-compatible enhancement. All existing CSV-based workflows continue to work unchanged.

---

## Files Summary

### Modified Files (7):
1. `src/cycling_ai/tools/wrappers/cache_preparation_tool.py` - Add FIT-only mode
2. `src/cycling_ai/tools/wrappers/data_validation_tool.py` - Optional CSV validation
3. `src/cycling_ai/cli/commands/generate.py` - Optional --csv flag
4. `src/cycling_ai/orchestration/multi_agent.py` - Add fit_only_mode to config
5. `prompts/default/1.0/data_preparation.txt` - Document FIT-only mode
6. `prompts/default/1.0/data_preparation_user.txt` - Add mode indicator
7. `src/cycling_ai/orchestration/prompts.py` - Pass fit_only_mode parameter

### New Files (1):
1. `src/cycling_ai/utils/fit_metadata_extractor.py` - ✅ Already created

### Total Lines Changed: ~400-500 lines

---

## Success Criteria

- [ ] Can run `cycling-ai generate` with only `--profile` and `--fit-dir`
- [ ] Phase 1 creates cache from FIT files without CSV
- [ ] Cache includes all required columns for analysis tools
- [ ] Zone enrichment works in FIT-only mode
- [ ] Phases 2-4 execute successfully using FIT-generated cache
- [ ] 3 HTML reports generated correctly
- [ ] Existing CSV-based workflows still work (backward compatibility)
- [ ] All tests pass

---

## Next Steps

To implement this plan:

1. **Start with WorkflowConfig** - Simplest change, enables rest of work
2. **Follow implementation order above**
3. **Test after each component** - Catch issues early
4. **Run full end-to-end test** - Verify complete workflow

Would you like me to start implementing these changes, or would you prefer to review the plan first?
