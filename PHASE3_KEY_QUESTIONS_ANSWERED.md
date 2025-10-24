# Phase 3: Key Questions - Definitive Answers

**Quick Reference Guide**
**Date:** 2025-10-24

This document provides direct, actionable answers to the 6 key questions posed in the Phase 3 specification.

---

## Question 1: How do we convert CSV/Parquet paths to tool parameters?

### Answer

**Approach:** File paths are passed as string parameters and validated within tool `execute()` methods.

### Implementation Pattern

```python
# In ToolDefinition
ToolParameter(
    name="csv_file_path",
    type="string",
    description="Absolute path to Strava activities CSV file",
    required=True,
)

# In execute() method
def execute(self, **kwargs):
    csv_file_path = kwargs["csv_file_path"]

    # Validate path
    csv_path = Path(csv_file_path)
    if not csv_path.exists():
        return ToolExecutionResult(
            success=False,
            errors=[f"CSV file not found: {csv_file_path}"]
        )

    # Use path - core utilities handle CSV/Parquet automatically
    # load_activities_data() checks for cached Parquet first
    result = analyze_performance(csv_file_path=str(csv_path), ...)
```

### Key Points

1. **String parameters:** All file paths are type `"string"` in ToolParameter
2. **Absolute paths:** Tools expect absolute paths (can be enforced in CLI)
3. **pathlib.Path validation:** Convert to Path for cross-platform compatibility
4. **Transparent caching:** Core utilities (`load_activities_data()`) automatically use Parquet cache if available
5. **No conversion needed:** Users provide CSV path, system handles Parquet optimization transparently

### CLI Example

```bash
cycling-ai analyze performance \
  --csv /Users/eduardo/data/activities.csv \
  --profile /Users/eduardo/data/athlete_profile.json
```

---

## Question 2: How do we handle AthleteProfile loading in tools?

### Answer

**Approach:** Tools accept `athlete_profile_json` parameter and load the profile internally.

### Implementation Pattern

```python
# In ToolDefinition
ToolParameter(
    name="athlete_profile_json",
    type="string",
    description="Path to athlete_profile.json for personalized analysis",
    required=True,
)

# In execute() method
def execute(self, **kwargs):
    athlete_profile_json = kwargs["athlete_profile_json"]

    # Validate profile path
    profile_path = Path(athlete_profile_json)
    if not profile_path.exists():
        return ToolExecutionResult(
            success=False,
            errors=[f"Athlete profile not found: {athlete_profile_json}"]
        )

    # Load athlete profile
    try:
        from cycling_ai.core.athlete import load_athlete_profile
        athlete_profile = load_athlete_profile(profile_path)
    except Exception as e:
        return ToolExecutionResult(
            success=False,
            errors=[f"Error loading athlete profile: {str(e)}"]
        )

    # Pass to business logic
    result = analyze_performance(
        csv_file_path=csv_path,
        athlete_name=athlete_profile.name,
        athlete_age=athlete_profile.age,
        athlete_weight_kg=athlete_profile.weight_kg,
        athlete_ftp=athlete_profile.ftp,
        athlete_max_hr=athlete_profile.max_hr,
        athlete_profile=athlete_profile,  # Full profile object
    )
```

### Why This Approach?

1. **Single source of truth:** Profile JSON file contains all athlete data
2. **No parameter explosion:** Instead of passing age, weight, FTP separately, just pass profile path
3. **Validation in one place:** `load_athlete_profile()` handles all parsing and validation
4. **Easy to extend:** Adding new athlete fields doesn't change tool signatures
5. **Personalization ready:** Full profile object enables LLM personalization

### CLI Pattern

```bash
# User only needs to specify profile path once
cycling-ai analyze performance \
  --csv data.csv \
  --profile athlete_profile.json  # Contains all athlete data
```

---

## Question 3: What's the best format for tool results (JSON, Markdown, both)?

### Answer

**Approach:** Tools return structured JSON data. CLI handles formatting based on user preference.

### Architecture

```
Tool Wrapper
    ↓
ToolExecutionResult(data=JSON_DICT, format="json")
    ↓
CLI Formatter
    ├─→ JSON output (--format json)
    ├─→ Markdown output (--format markdown)
    └─→ Rich console (--format rich, default)
```

### Implementation

```python
# Tool always returns JSON
def execute(self, **kwargs):
    result_json = analyze_performance(...)  # Returns JSON string
    result_data = json.loads(result_json)   # Parse to dict

    return ToolExecutionResult(
        success=True,
        data=result_data,     # Structured dictionary
        format="json",        # Metadata about format
        metadata={...}
    )

# CLI handles formatting
@click.option("--format", type=click.Choice(["json", "rich"]))
def performance(format: str):
    result = tool.execute(...)

    if format == "json":
        print(json.dumps(result.data, indent=2))
    else:
        format_performance_analysis_rich(result.data)  # Rich tables/panels
```

### Benefits

1. **Separation of concerns:** Tools don't know about presentation
2. **Multiple consumers:** Same tool output works for CLI, API, LLM
3. **Structured data:** JSON enables programmatic processing
4. **User choice:** CLI users pick preferred format
5. **LLM-friendly:** JSON is ideal for LLM interpretation

### CLI Examples

```bash
# Rich console output (default, beautiful)
cycling-ai analyze performance --csv data.csv --profile profile.json

# JSON output (machine-readable)
cycling-ai analyze performance --csv data.csv --profile profile.json --format json

# JSON to file (for chaining)
cycling-ai analyze performance --csv data.csv --profile profile.json --format json > results.json
```

---

## Question 4: How do we make CLI commands intuitive for end users?

### Answer

**Approach:** Apply CLI design best practices for developer tools.

### Design Principles

#### 1. Verb-Noun Structure
```bash
# Intuitive command structure
cycling-ai analyze performance    # Verb: analyze, Noun: performance
cycling-ai plan generate           # Verb: plan (action), Noun: generate (type)
cycling-ai report generate         # Verb: report, Noun: generate
```

#### 2. Sensible Defaults
```python
@click.option("--period-months", type=int, default=6)
@click.option("--weeks", type=int, default=12)
@click.option("--format", default="rich")
```

Users only specify what they want to change.

#### 3. Required vs Optional Clear
```bash
# Required options are obvious (no defaults work)
--csv /path/to/file.csv         # Required
--profile /path/to/profile.json # Required

# Optional have sensible defaults
--period-months 6               # Optional (default: 6)
--no-cache                      # Optional flag (default: use cache)
```

#### 4. Helpful Error Messages
```python
if not csv_path.exists():
    console.print("[red]Error:[/red] CSV file not found at:")
    console.print(f"  {csv_file_path}")
    console.print("\n[yellow]Tip:[/yellow] Check that the path is correct and the file exists.")
    ctx.exit(1)
```

#### 5. Rich Help Text
```python
@click.command()
def performance():
    """
    Analyze cycling performance comparing time periods.

    Compares recent period (e.g., last 6 months) with equivalent prior period
    to identify trends in distance, power, heart rate, and more.

    Example:
        cycling-ai analyze performance \\
          --csv ~/data/activities.csv \\
          --profile ~/data/athlete_profile.json \\
          --period-months 6
    """
```

#### 6. Progress Indicators
```python
with console.status("[bold green]Processing FIT files..."):
    result = tool.execute(...)
```

#### 7. Beautiful Output
```python
# Rich console with tables, panels, colors
console.print(Panel("Athlete Profile", style="blue"))
console.print(Table(...))  # Formatted data
```

### Examples

```bash
# Discovery: Help at every level
cycling-ai --help
cycling-ai analyze --help
cycling-ai analyze performance --help

# Execution: Minimal required input
cycling-ai analyze performance \
  --csv activities.csv \
  --profile profile.json

# Customization: Override defaults
cycling-ai analyze performance \
  --csv activities.csv \
  --profile profile.json \
  --period-months 12 \
  --format json \
  --output results.json
```

---

## Question 5: How do we handle long-running operations (FIT file processing)?

### Answer

**Multi-layer approach:** Caching + Progress indicators + User control

### 1. Caching Strategy (Primary Solution)

```python
# Zone analysis uses aggressive caching
def analyze_time_in_zones(
    activities_directory: str,
    athlete_ftp: float,
    use_cache: bool = True  # Default: use cache
):
    if use_cache:
        cached_data = load_time_in_zones_cache(activities_directory, int(athlete_ftp))
        if cached_data:
            # Return cached results instantly (~10ms vs 30s+)
            return format_cached_results(cached_data)

    # Only process FIT files if cache miss or disabled
    process_fit_files(...)
```

**Cache details:**
- Stored at: `{activities_directory}/../cache/time_in_zones_ftp{FTP}.json`
- Per-FTP caching (different FTP = different zones = different cache)
- Contains per-activity zone data for fast filtering by period

### 2. Progress Indicators

```python
# CLI shows spinner during processing
with console.status("[bold green]Processing FIT files...") as status:
    files_processed = 0
    for fit_file in fit_files:
        status.update(f"Processing FIT files... ({files_processed}/{total_files})")
        # Process file
        files_processed += 1
```

### 3. User Control

```bash
# Use cache (fast, default)
cycling-ai analyze zones --fit-dir ./fits --profile profile.json

# Force fresh processing (slow, accurate)
cycling-ai analyze zones --fit-dir ./fits --profile profile.json --no-cache
```

### 4. Metadata Transparency

```python
return ToolExecutionResult(
    success=True,
    data=result_data,
    metadata={
        "files_processed": 150,
        "files_with_power": 145,
        "cache_used": True,           # User knows cache was used
        "processing_time_ms": 12      # Show performance
    }
)
```

### Performance Characteristics

| Operation | Without Cache | With Cache | Speedup |
|-----------|---------------|------------|---------|
| 100 FIT files | ~30 seconds | ~10ms | 3000x |
| 500 FIT files | ~2.5 minutes | ~15ms | 10000x |
| 1000 FIT files | ~5 minutes | ~20ms | 15000x |

### User Experience

```bash
# First run (slow, builds cache)
$ cycling-ai analyze zones --fit-dir fits/ --profile profile.json
Processing FIT files... (150/150)
✓ Analysis complete in 28.3 seconds
Cache saved for future runs

# Subsequent runs (instant)
$ cycling-ai analyze zones --fit-dir fits/ --profile profile.json
✓ Analysis complete in 0.01 seconds (cache)

# Force refresh (occasional)
$ cycling-ai analyze zones --fit-dir fits/ --profile profile.json --no-cache
Processing FIT files... (150/150)
✓ Analysis complete in 29.1 seconds
Cache updated
```

---

## Question 6: What's the minimal configuration needed to get started?

### Answer

**Minimal setup:** Just set API key. Everything else has defaults.

### Absolute Minimum (Zero Configuration)

```bash
# 1. Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 2. Run analysis (uses all defaults)
cycling-ai analyze performance \
  --csv activities.csv \
  --profile athlete_profile.json

# That's it! No config file needed.
```

### What Happens Behind the Scenes

1. **No config file?** CLI creates in-memory config with defaults
2. **Provider selection:** Uses `default_provider = "anthropic"` (built-in)
3. **API key:** Read from environment variable `ANTHROPIC_API_KEY`
4. **Model selection:** Uses default `claude-sonnet-4` (built-in)
5. **Analysis settings:** Uses `period_months=6` (built-in default)

### Default Configuration (Implicit)

```yaml
# User doesn't need to create this - all built-in defaults
version: "1.0"
default_provider: "anthropic"

providers:
  anthropic:
    model: "claude-sonnet-4"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "ANTHROPIC_API_KEY"  # Read from environment

analysis:
  period_months: 6
  use_cache: true

training:
  total_weeks: 12

output:
  format: "rich"
  verbose: false
  color: true
```

### When to Create Config File

**Create config file when you want to:**
- Use different provider (e.g., OpenAI instead of Anthropic)
- Change default model (e.g., GPT-4 Turbo)
- Adjust default parameters (e.g., `period_months: 12`)
- Set default paths to avoid typing them

### Creating Config (Optional)

```bash
# Generate default config file at ~/.cycling-ai/config.yaml
cycling-ai config init

# Edit config file
vim ~/.cycling-ai/config.yaml

# Or set specific values
cycling-ai config set default_provider openai
```

### Progression of Use

**Level 1: Just Works (Zero Config)**
```bash
export ANTHROPIC_API_KEY="..."
cycling-ai analyze performance --csv data.csv --profile profile.json
```

**Level 2: Customize Defaults (Config File)**
```bash
cycling-ai config init
# Edit ~/.cycling-ai/config.yaml to change defaults
cycling-ai analyze performance --csv data.csv --profile profile.json
```

**Level 3: Multi-Provider Setup (Advanced Config)**
```yaml
# ~/.cycling-ai/config.yaml
default_provider: "anthropic"

providers:
  anthropic:
    model: "claude-sonnet-4"
    api_key_env: "ANTHROPIC_API_KEY"
  openai:
    model: "gpt-4-turbo"
    api_key_env: "OPENAI_API_KEY"
  gemini:
    model: "gemini-pro"
    api_key_env: "GEMINI_API_KEY"

# Switch providers at runtime
cycling-ai analyze performance --provider openai --csv data.csv --profile profile.json
```

### Environment Variables Priority

```
1. CLI flags (highest priority)
   --period-months 12

2. Environment variables
   export CYCLING_AI_PERIOD_MONTHS=12

3. Config file
   analysis:
     period_months: 12

4. Built-in defaults (lowest priority)
   period_months: 6
```

---

## Summary: The Answers at a Glance

| Question | Answer | Implementation |
|----------|--------|----------------|
| **CSV/Parquet paths** | String parameters, Path validation in execute() | `csv_path = Path(kwargs["csv_file_path"])` |
| **AthleteProfile** | Load internally from profile JSON path | `athlete_profile = load_athlete_profile(profile_path)` |
| **Result format** | Always JSON from tools, CLI formats for display | `ToolExecutionResult(data=dict, format="json")` |
| **Intuitive CLI** | Verb-noun, defaults, help, examples, Rich output | `cycling-ai analyze performance --csv ... --profile ...` |
| **Long operations** | Caching (3000x faster) + progress + user control | `use_cache=True` (default), `--no-cache` flag |
| **Minimal config** | Zero config works, just API key environment variable | `export ANTHROPIC_API_KEY="..."` |

---

## Quick Start Template

**Complete minimal setup:**

```bash
# 1. Install
pip install -e ".[dev]"

# 2. Set API key
export ANTHROPIC_API_KEY="your-api-key-here"

# 3. Run analysis (everything else uses defaults)
cycling-ai analyze performance \
  --csv ~/data/activities.csv \
  --profile ~/data/athlete_profile.json

# 4. View results in beautiful Rich console output
# (or use --format json for machine-readable output)
```

**That's it!** No configuration files, no complex setup, no parameter tuning needed for basic usage.

---

**Document Version:** 1.0
**Cross-Reference:** See PHASE3_IMPLEMENTATION_PLAN.md for detailed architecture
