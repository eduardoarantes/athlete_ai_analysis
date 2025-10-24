# Phase 3: Tool Wrappers and CLI - Implementation Plan

**Project:** cycling-ai-analysis
**Phase:** 3 of 4 (Tool Wrappers and CLI)
**Status:** Ready for Implementation
**Target Coverage:** >85%
**Type Safety:** mypy --strict compliant

---

## Executive Summary

Phase 3 creates the bridge between core business logic (Phase 1) and LLM providers (Phase 2) by implementing tool wrappers that expose analysis functions as provider-agnostic tools. A modern CLI interface enables end-to-end usage with multiple LLM providers.

**Key Deliverables:**
1. 5 tool wrapper implementations (PerformanceAnalysis, ZoneAnalysis, TrainingPlan, CrossTraining, ReportGeneration)
2. YAML-based configuration system with environment variable support
3. Click-based CLI with Rich console formatting
4. Basic orchestration layer for tool invocation
5. Comprehensive test suite (>85% coverage)

**Estimated Timeline:** 5-7 days

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Business Logic Analysis](#core-business-logic-analysis)
3. [Tool Wrapper Specifications](#tool-wrapper-specifications)
4. [Configuration System Design](#configuration-system-design)
5. [CLI Architecture](#cli-architecture)
6. [Orchestration Layer](#orchestration-layer)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Order](#implementation-order)
9. [Dependencies](#dependencies)
10. [Success Criteria](#success-criteria)

---

## Architecture Overview

### High-Level Flow

```
User Input (CLI)
    ↓
Configuration Loader → YAML + Environment Variables
    ↓
Provider Factory → Create LLM Provider Instance
    ↓
Tool Registry → Discover Available Tools
    ↓
Orchestration Layer → Execute Tool + LLM Interpretation
    ↓
Output Formatter → JSON/Markdown/Rich Console
```

### Module Structure

```
src/cycling_ai/
├── core/                      # Business logic (Phase 1) ✅
├── providers/                 # LLM adapters (Phase 2) ✅
├── tools/
│   ├── base.py               # Abstractions ✅
│   ├── registry.py           # Tool registry ✅
│   ├── wrappers/             # NEW: Tool implementations
│   │   ├── __init__.py
│   │   ├── performance.py    # PerformanceAnalysisTool
│   │   ├── zones.py          # ZoneAnalysisTool
│   │   ├── training.py       # TrainingPlanTool
│   │   ├── cross_training.py # CrossTrainingTool
│   │   └── reports.py        # ReportGenerationTool
│   └── loader.py             # NEW: Auto-register tools
├── config/                    # NEW: Configuration
│   ├── __init__.py
│   ├── loader.py             # YAML + env loading
│   ├── schema.py             # Pydantic models
│   └── defaults.py           # Default configurations
├── cli/                       # NEW: CLI interface
│   ├── __init__.py
│   ├── main.py               # Click app entry point
│   ├── commands/
│   │   ├── __init__.py
│   │   ├── analyze.py        # analyze subcommands
│   │   ├── plan.py           # plan subcommands
│   │   ├── report.py         # report subcommands
│   │   └── config.py         # config subcommands
│   └── formatting.py         # Rich console output
└── orchestration/             # NEW: Tool execution
    ├── __init__.py
    ├── executor.py           # Tool invocation
    └── interpreter.py        # LLM response handling
```

---

## Core Business Logic Analysis

### Module Inventory

| Module | Entry Function | Parameters | Returns | Notes |
|--------|---------------|------------|---------|-------|
| `core/performance.py` | `analyze_performance()` | csv_file_path, athlete_name, athlete_age, athlete_weight_kg, athlete_ftp, athlete_max_hr, period_months, athlete_profile | JSON string | Uses cache if available |
| `core/zones.py` | `analyze_time_in_zones()` | activities_directory, athlete_ftp, period_months, max_files, use_cache, athlete_profile | JSON string | Processes FIT files, cache-aware |
| `core/training.py` | `generate_training_plan()` | current_ftp, available_days_per_week, target_ftp, total_weeks, athlete_age, athlete_profile | JSON string | Includes SVG visualizations |
| `core/cross_training.py` | `analyze_cross_training_impact()` | df (DataFrame), analysis_period_weeks | JSON string | Requires preprocessed DataFrame |
| `core/athlete.py` | `load_athlete_profile()` | json_file_path | AthleteProfile | Required for personalization |

### Key Insights

1. **AthleteProfile Integration:** All analysis functions accept optional `athlete_profile` parameter for personalized insights
2. **Return Format:** All functions return JSON strings (perfect for tool execution results)
3. **Caching Strategy:** Performance and zones modules use caching for efficiency
4. **DataFrame Dependency:** Cross-training requires preprocessed DataFrame (needs utility wrapper)
5. **Path Parameters:** CSV paths and FIT directories are file system paths (need validation)

### Parameter Mapping Strategy

**Common Parameters:**
- `csv_file_path` → ToolParameter(type="string", pattern=r"\.csv$")
- `athlete_profile_json` → ToolParameter(type="string", pattern=r"\.json$")
- `period_months` → ToolParameter(type="integer", min_value=1, max_value=24, default=6)

**AthleteProfile Handling:**
- CLI loads profile once from config or parameter
- Tool wrappers call `load_athlete_profile()` internally
- Pass profile object to business logic functions

---

## Tool Wrapper Specifications

### 1. PerformanceAnalysisTool

**File:** `src/cycling_ai/tools/wrappers/performance.py`

```python
from cycling_ai.tools.base import BaseTool, ToolDefinition, ToolParameter, ToolExecutionResult
from cycling_ai.core.performance import analyze_performance
from cycling_ai.core.athlete import load_athlete_profile
from pathlib import Path
import json

class PerformanceAnalysisTool(BaseTool):
    """
    Analyzes cycling performance from Strava CSV export.

    Compares recent period with equivalent prior period to identify trends.
    """

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="analyze_performance",
            description=(
                "Analyze cycling performance from Strava CSV export comparing "
                "time periods. Provides comprehensive statistics, monthly breakdown, "
                "and best performances."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description="Absolute path to Strava activities CSV file",
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description="Path to athlete_profile.json for personalized analysis",
                    required=True,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description="Number of months for each comparison period (recent vs previous)",
                    required=False,
                    default=6,
                    min_value=1,
                    max_value=24,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Performance analysis with period comparison, trends, and athlete profile context"
            },
            version="1.0.0",
        )

    def execute(self, **kwargs) -> ToolExecutionResult:
        """Execute performance analysis."""
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract parameters
            csv_file_path = kwargs["csv_file_path"]
            athlete_profile_json = kwargs["athlete_profile_json"]
            period_months = kwargs.get("period_months", 6)

            # Validate file paths
            csv_path = Path(csv_file_path)
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"CSV file not found: {csv_file_path}"]
                )

            profile_path = Path(athlete_profile_json)
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile not found: {athlete_profile_json}"]
                )

            # Load athlete profile
            athlete_profile = load_athlete_profile(profile_path)

            # Execute analysis
            result_json = analyze_performance(
                csv_file_path=str(csv_path),
                athlete_name=athlete_profile.name,
                athlete_age=athlete_profile.age,
                athlete_weight_kg=athlete_profile.weight_kg,
                athlete_ftp=athlete_profile.ftp,
                athlete_max_hr=athlete_profile.max_hr,
                period_months=period_months,
                athlete_profile=athlete_profile,
            )

            # Parse result to validate JSON
            result_data = json.loads(result_json)

            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "period_months": period_months,
                    "source": "strava_csv"
                }
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Validation error: {str(e)}"]
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Execution error: {str(e)}"]
            )
```

**Test Coverage:**
- Valid execution with real CSV
- Missing CSV file
- Missing profile file
- Invalid period_months
- Malformed CSV
- AthleteProfile loading errors

---

### 2. ZoneAnalysisTool

**File:** `src/cycling_ai/tools/wrappers/zones.py`

```python
class ZoneAnalysisTool(BaseTool):
    """
    Analyzes actual time spent in power zones from FIT files.

    Provides accurate zone distribution by reading second-by-second power data.
    """

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="analyze_time_in_zones",
            description=(
                "Analyze actual time spent in power zones by reading FIT files. "
                "Provides accurate zone distribution and polarization analysis."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="activities_directory",
                    type="string",
                    description="Path to directory containing .fit or .fit.gz files",
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description="Path to athlete_profile.json (provides FTP)",
                    required=True,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description="Number of months to analyze",
                    required=False,
                    default=6,
                    min_value=1,
                    max_value=24,
                ),
                ToolParameter(
                    name="use_cache",
                    type="boolean",
                    description="Use cached zone data if available",
                    required=False,
                    default=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Time-in-zones breakdown with polarization analysis"
            },
            version="1.0.0",
        )

    def execute(self, **kwargs) -> ToolExecutionResult:
        """Execute zone analysis."""
        # Similar structure to PerformanceAnalysisTool
        # Load athlete profile for FTP
        # Call analyze_time_in_zones()
        # Return formatted result
```

---

### 3. TrainingPlanTool

**File:** `src/cycling_ai/tools/wrappers/training.py`

```python
class TrainingPlanTool(BaseTool):
    """
    Generates progressive, periodized training plan.

    Creates structured week-by-week plan based on athlete availability and goals.
    """

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_training_plan",
            description=(
                "Generate a progressive training plan based on athlete's "
                "availability and goals. Includes Foundation, Build, and Peak phases."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description="Path to athlete_profile.json",
                    required=True,
                ),
                ToolParameter(
                    name="total_weeks",
                    type="integer",
                    description="Duration of plan in weeks",
                    required=False,
                    default=12,
                    min_value=4,
                    max_value=24,
                ),
                ToolParameter(
                    name="target_ftp",
                    type="number",
                    description="Target FTP in watts (optional, defaults to +6% of current)",
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Week-by-week training plan with workouts and SVG visualizations"
            },
            version="1.0.0",
        )
```

---

### 4. CrossTrainingTool

**File:** `src/cycling_ai/tools/wrappers/cross_training.py`

```python
class CrossTrainingTool(BaseTool):
    """
    Analyzes impact of non-cycling activities on cycling performance.

    Examines load distribution, timing patterns, and correlations.
    """

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="analyze_cross_training_impact",
            description=(
                "Analyze how non-cycling activities (strength, running, swimming) "
                "impact cycling performance through load and interference analysis."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description="Path to Strava activities CSV with all activity types",
                    required=True,
                ),
                ToolParameter(
                    name="analysis_period_weeks",
                    type="integer",
                    description="Number of weeks to analyze",
                    required=False,
                    default=12,
                    min_value=4,
                    max_value=52,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Cross-training impact analysis with interference detection"
            },
            version="1.0.0",
        )

    def execute(self, **kwargs) -> ToolExecutionResult:
        """Execute cross-training analysis."""
        # Load CSV using core.utils.load_activities_data()
        # Apply cross-training categorization
        # Call analyze_cross_training_impact()
```

**Special Note:** This tool needs DataFrame preprocessing. Create helper function in `core/utils.py`:

```python
def load_and_categorize_activities(csv_file_path: str) -> pd.DataFrame:
    """Load activities and apply cross-training categorization."""
    from .fit_processing import categorize_activities

    df = load_activities_data(csv_file_path)
    df = categorize_activities(df)
    return df
```

---

### 5. ReportGenerationTool

**File:** `src/cycling_ai/tools/wrappers/reports.py`

**Note:** Report generation is currently in MCP server. For Phase 3, we'll create a simplified version that generates Markdown reports (HTML generation can be Phase 4).

```python
class ReportGenerationTool(BaseTool):
    """
    Generates comprehensive analysis report in Markdown format.

    Combines multiple analysis results into a cohesive report.
    """

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_report",
            description=(
                "Generate comprehensive Markdown report combining performance, "
                "zones, and training plan analyses."
            ),
            category="reporting",
            parameters=[
                ToolParameter(
                    name="performance_analysis_json",
                    type="string",
                    description="JSON output from performance analysis",
                    required=True,
                ),
                ToolParameter(
                    name="zones_analysis_json",
                    type="string",
                    description="JSON output from zones analysis",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_json",
                    type="string",
                    description="JSON output from training plan generation",
                    required=False,
                ),
                ToolParameter(
                    name="output_path",
                    type="string",
                    description="Path to save Markdown report",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Report generation status with file path"
            },
            version="1.0.0",
        )

    def execute(self, **kwargs) -> ToolExecutionResult:
        """Generate Markdown report."""
        # Parse input JSONs
        # Generate Markdown sections
        # Write to output_path
        # Return success with file path
```

---

## Configuration System Design

### YAML Schema

**File:** `~/.cycling-ai/config.yaml`

```yaml
# Cycling AI Configuration
version: "1.0"

# Default provider configuration
default_provider: "anthropic"

# Provider configurations
providers:
  anthropic:
    model: "claude-sonnet-4"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "ANTHROPIC_API_KEY"

  openai:
    model: "gpt-4-turbo"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "OPENAI_API_KEY"

  gemini:
    model: "gemini-pro"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "GEMINI_API_KEY"

  ollama:
    model: "llama3"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: ""  # No API key needed for local

# Analysis defaults
analysis:
  period_months: 6
  use_cache: true

# Training plan defaults
training:
  total_weeks: 12

# Paths (optional, can be overridden by CLI)
paths:
  athlete_profile: ""  # Auto-detect from current directory
  activities_csv: ""
  fit_files_directory: ""

# Output preferences
output:
  format: "rich"  # "json", "markdown", "rich"
  verbose: false
  color: true
```

### Pydantic Schema

**File:** `src/cycling_ai/config/schema.py`

```python
from __future__ import annotations
from pydantic import BaseModel, Field, validator
from typing import Literal

class ProviderSettings(BaseModel):
    """Settings for a single provider."""
    model: str
    max_tokens: int = Field(default=4096, ge=1, le=128000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    api_key_env: str = ""

class AnalysisSettings(BaseModel):
    """Default analysis settings."""
    period_months: int = Field(default=6, ge=1, le=24)
    use_cache: bool = True

class TrainingSettings(BaseModel):
    """Training plan settings."""
    total_weeks: int = Field(default=12, ge=4, le=24)

class PathSettings(BaseModel):
    """File path settings."""
    athlete_profile: str = ""
    activities_csv: str = ""
    fit_files_directory: str = ""

class OutputSettings(BaseModel):
    """Output formatting settings."""
    format: Literal["json", "markdown", "rich"] = "rich"
    verbose: bool = False
    color: bool = True

class CyclingAIConfig(BaseModel):
    """Complete configuration."""
    version: str = "1.0"
    default_provider: str = "anthropic"
    providers: dict[str, ProviderSettings]
    analysis: AnalysisSettings = Field(default_factory=AnalysisSettings)
    training: TrainingSettings = Field(default_factory=TrainingSettings)
    paths: PathSettings = Field(default_factory=PathSettings)
    output: OutputSettings = Field(default_factory=OutputSettings)

    @validator('default_provider')
    def validate_default_provider(cls, v, values):
        """Ensure default_provider exists in providers."""
        if 'providers' in values and v not in values['providers']:
            raise ValueError(f"default_provider '{v}' not found in providers")
        return v
```

### Configuration Loader

**File:** `src/cycling_ai/config/loader.py`

```python
from __future__ import annotations
import os
from pathlib import Path
from typing import Any
import yaml
from .schema import CyclingAIConfig

def get_config_path() -> Path:
    """Get configuration file path."""
    # Check environment variable
    if config_path := os.getenv("CYCLING_AI_CONFIG"):
        return Path(config_path)

    # Check user home directory
    home_config = Path.home() / ".cycling-ai" / "config.yaml"
    if home_config.exists():
        return home_config

    # Check current directory
    local_config = Path.cwd() / ".cycling-ai.yaml"
    if local_config.exists():
        return local_config

    # Return default path (will be created)
    return home_config

def load_config() -> CyclingAIConfig:
    """Load configuration from YAML file."""
    config_path = get_config_path()

    if not config_path.exists():
        # Create default config
        return create_default_config(config_path)

    try:
        with open(config_path) as f:
            config_data = yaml.safe_load(f)

        return CyclingAIConfig(**config_data)

    except Exception as e:
        raise ValueError(f"Error loading config from {config_path}: {e}")

def create_default_config(config_path: Path) -> CyclingAIConfig:
    """Create default configuration file."""
    from .defaults import DEFAULT_CONFIG

    # Ensure directory exists
    config_path.parent.mkdir(parents=True, exist_ok=True)

    # Write default config
    with open(config_path, 'w') as f:
        yaml.safe_dump(DEFAULT_CONFIG, f, default_flow_style=False)

    return CyclingAIConfig(**DEFAULT_CONFIG)

def get_api_key(provider_name: str, config: CyclingAIConfig) -> str:
    """Get API key for provider from environment."""
    if provider_name not in config.providers:
        raise ValueError(f"Provider '{provider_name}' not configured")

    provider_config = config.providers[provider_name]

    if not provider_config.api_key_env:
        return ""  # No API key needed (e.g., Ollama)

    api_key = os.getenv(provider_config.api_key_env)
    if not api_key:
        raise ValueError(
            f"API key not found. Set environment variable: {provider_config.api_key_env}"
        )

    return api_key
```

---

## CLI Architecture

### Command Structure

```
cycling-ai
├── analyze
│   ├── performance    # Run performance analysis
│   ├── zones          # Run time-in-zones analysis
│   └── cross-training # Run cross-training analysis
├── plan
│   └── generate       # Generate training plan
├── report
│   └── generate       # Generate comprehensive report
├── config
│   ├── show           # Show current configuration
│   ├── init           # Initialize configuration
│   └── set            # Set configuration value
└── providers
    └── list           # List available providers
```

### Main CLI Entry Point

**File:** `src/cycling_ai/cli/main.py`

```python
from __future__ import annotations
import click
from pathlib import Path

from .commands import analyze, plan, report, config, providers
from ..config.loader import load_config

@click.group()
@click.version_option(version="0.1.0")
@click.option(
    "--config",
    type=click.Path(exists=True),
    help="Path to configuration file",
    envvar="CYCLING_AI_CONFIG",
)
@click.pass_context
def cli(ctx: click.Context, config: str | None) -> None:
    """
    Cycling AI Analysis - AI-powered cycling performance analysis.

    Analyze cycling performance data with multiple LLM providers.
    """
    # Load configuration
    ctx.ensure_object(dict)

    if config:
        import os
        os.environ["CYCLING_AI_CONFIG"] = config

    try:
        ctx.obj["config"] = load_config()
    except Exception as e:
        click.secho(f"Error loading configuration: {e}", fg="red", err=True)
        ctx.exit(1)

# Register command groups
cli.add_command(analyze.analyze)
cli.add_command(plan.plan)
cli.add_command(report.report)
cli.add_command(config.config_cmd)
cli.add_command(providers.providers)

def main() -> None:
    """Entry point for CLI."""
    cli()

if __name__ == "__main__":
    main()
```

### Analyze Commands

**File:** `src/cycling_ai/cli/commands/analyze.py`

```python
from __future__ import annotations
import click
from pathlib import Path

from ..formatting import console, format_json_as_rich
from ...config.schema import CyclingAIConfig
from ...tools.wrappers.performance import PerformanceAnalysisTool
from ...tools.wrappers.zones import ZoneAnalysisTool
from ...tools.wrappers.cross_training import CrossTrainingTool

@click.group()
def analyze() -> None:
    """Analyze cycling performance data."""
    pass

@analyze.command()
@click.option(
    "--csv",
    type=click.Path(exists=True),
    required=True,
    help="Path to Strava activities CSV file",
)
@click.option(
    "--profile",
    type=click.Path(exists=True),
    required=True,
    help="Path to athlete_profile.json",
)
@click.option(
    "--period-months",
    type=int,
    default=6,
    help="Number of months for comparison period",
)
@click.option(
    "--output",
    type=click.Path(),
    help="Output file path (optional, prints to console if not provided)",
)
@click.option(
    "--format",
    type=click.Choice(["json", "rich"]),
    default="rich",
    help="Output format",
)
@click.pass_context
def performance(
    ctx: click.Context,
    csv: str,
    profile: str,
    period_months: int,
    output: str | None,
    format: str,
) -> None:
    """
    Analyze cycling performance comparing time periods.

    Example:
        cycling-ai analyze performance --csv activities.csv --profile profile.json
    """
    config: CyclingAIConfig = ctx.obj["config"]

    with console.status("[bold green]Analyzing performance..."):
        tool = PerformanceAnalysisTool()
        result = tool.execute(
            csv_file_path=csv,
            athlete_profile_json=profile,
            period_months=period_months,
        )

    if not result.success:
        console.print(f"[red]Error:[/red] {', '.join(result.errors)}")
        ctx.exit(1)

    # Format output
    if format == "json":
        import json
        output_text = json.dumps(result.data, indent=2)
    else:
        output_text = format_json_as_rich(result.data)

    # Write or print
    if output:
        Path(output).write_text(output_text)
        console.print(f"[green]Results saved to:[/green] {output}")
    else:
        console.print(output_text)

@analyze.command()
@click.option(
    "--fit-dir",
    type=click.Path(exists=True),
    required=True,
    help="Directory containing FIT files",
)
@click.option(
    "--profile",
    type=click.Path(exists=True),
    required=True,
    help="Path to athlete_profile.json",
)
@click.option(
    "--period-months",
    type=int,
    default=6,
    help="Number of months to analyze",
)
@click.option(
    "--no-cache",
    is_flag=True,
    help="Disable cache usage",
)
@click.pass_context
def zones(
    ctx: click.Context,
    fit_dir: str,
    profile: str,
    period_months: int,
    no_cache: bool,
) -> None:
    """
    Analyze time spent in power zones.

    Example:
        cycling-ai analyze zones --fit-dir ./activities --profile profile.json
    """
    config: CyclingAIConfig = ctx.obj["config"]

    with console.status("[bold green]Processing FIT files..."):
        tool = ZoneAnalysisTool()
        result = tool.execute(
            activities_directory=fit_dir,
            athlete_profile_json=profile,
            period_months=period_months,
            use_cache=not no_cache,
        )

    # Similar output handling as performance command
```

### Plan Commands

**File:** `src/cycling_ai/cli/commands/plan.py`

```python
@click.group()
def plan() -> None:
    """Generate training plans."""
    pass

@plan.command()
@click.option(
    "--profile",
    type=click.Path(exists=True),
    required=True,
    help="Path to athlete_profile.json",
)
@click.option(
    "--weeks",
    type=int,
    default=12,
    help="Plan duration in weeks",
)
@click.option(
    "--target-ftp",
    type=float,
    help="Target FTP (optional, defaults to +6%)",
)
@click.pass_context
def generate(
    ctx: click.Context,
    profile: str,
    weeks: int,
    target_ftp: float | None,
) -> None:
    """
    Generate progressive training plan.

    Example:
        cycling-ai plan generate --profile profile.json --weeks 12
    """
    # Similar implementation
```

### Rich Console Formatting

**File:** `src/cycling_ai/cli/formatting.py`

```python
from __future__ import annotations
from typing import Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
import json

console = Console()

def format_json_as_rich(data: dict[str, Any]) -> str:
    """Format JSON data with Rich syntax highlighting."""
    json_str = json.dumps(data, indent=2)
    syntax = Syntax(json_str, "json", theme="monokai", line_numbers=True)
    return syntax

def format_performance_analysis(data: dict[str, Any]) -> None:
    """Format performance analysis with Rich tables and panels."""
    # Extract athlete profile
    athlete = data.get("athlete_profile", {})

    # Create athlete info panel
    athlete_info = f"""
    Name: {athlete.get('name', 'Unknown')}
    Age: {athlete.get('age')} years
    FTP: {athlete.get('ftp')} W
    Power-to-Weight: {athlete.get('power_to_weight', 0):.2f} W/kg
    """
    console.print(Panel(athlete_info.strip(), title="Athlete Profile", border_style="blue"))

    # Create comparison table
    table = Table(title="Period Comparison")
    table.add_column("Metric", style="cyan")
    table.add_column("Recent", style="green")
    table.add_column("Previous", style="yellow")
    table.add_column("Change", style="magenta")

    # Add rows...

    console.print(table)
```

---

## Orchestration Layer

### Tool Executor

**File:** `src/cycling_ai/orchestration/executor.py`

```python
from __future__ import annotations
from typing import Any

from ..tools.base import BaseTool, ToolExecutionResult
from ..tools.registry import get_global_registry

class ToolExecutor:
    """Executes tools and manages results."""

    def __init__(self):
        """Initialize executor."""
        self.registry = get_global_registry()

    def execute_tool(
        self,
        tool_name: str,
        parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """
        Execute a tool by name.

        Args:
            tool_name: Name of tool to execute
            parameters: Tool parameters

        Returns:
            Tool execution result
        """
        try:
            tool = self.registry.get_tool(tool_name)
            return tool.execute(**parameters)
        except KeyError:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Tool '{tool_name}' not found"]
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Execution error: {str(e)}"]
            )
```

### LLM Interpreter (Basic)

**File:** `src/cycling_ai/orchestration/interpreter.py`

```python
from __future__ import annotations
from typing import Any

from ..providers.base import BaseProvider, ProviderMessage, CompletionResponse
from ..tools.base import ToolExecutionResult

class ResultInterpreter:
    """Interprets tool results using LLM."""

    def __init__(self, provider: BaseProvider):
        """Initialize with LLM provider."""
        self.provider = provider

    def interpret_result(
        self,
        result: ToolExecutionResult,
        user_question: str | None = None
    ) -> CompletionResponse:
        """
        Interpret tool execution result with LLM.

        Args:
            result: Tool execution result
            user_question: Optional user question for context

        Returns:
            LLM interpretation
        """
        # Build prompt
        system_message = ProviderMessage(
            role="system",
            content=(
                "You are a cycling performance analyst. Interpret the provided "
                "analysis data and provide clear, actionable insights."
            )
        )

        result_message = ProviderMessage(
            role="user",
            content=f"Analysis results:\n\n{result.data}"
        )

        messages = [system_message, result_message]

        if user_question:
            question_message = ProviderMessage(
                role="user",
                content=f"Question: {user_question}"
            )
            messages.append(question_message)

        # Get LLM interpretation
        return self.provider.create_completion(messages)
```

---

## Testing Strategy

### Test Structure

```
tests/
├── tools/
│   └── wrappers/
│       ├── test_performance.py
│       ├── test_zones.py
│       ├── test_training.py
│       ├── test_cross_training.py
│       └── test_reports.py
├── config/
│   ├── test_loader.py
│   ├── test_schema.py
│   └── test_defaults.py
├── cli/
│   ├── test_main.py
│   ├── test_analyze_commands.py
│   ├── test_plan_commands.py
│   └── test_formatting.py
├── orchestration/
│   ├── test_executor.py
│   └── test_interpreter.py
└── fixtures/
    ├── sample.csv
    ├── sample_profile.json
    └── sample.fit.gz
```

### Tool Wrapper Tests

**Example: `tests/tools/wrappers/test_performance.py`**

```python
from pathlib import Path
import pytest
import json

from cycling_ai.tools.wrappers.performance import PerformanceAnalysisTool
from cycling_ai.tools.base import ToolExecutionResult

class TestPerformanceAnalysisTool:
    """Tests for PerformanceAnalysisTool."""

    def test_definition(self):
        """Test tool definition is valid."""
        tool = PerformanceAnalysisTool()
        definition = tool.definition

        assert definition.name == "analyze_performance"
        assert definition.category == "analysis"
        assert len(definition.parameters) == 3

        # Check required parameters
        required = definition.get_required_parameters()
        assert len(required) == 2
        assert {p.name for p in required} == {"csv_file_path", "athlete_profile_json"}

    def test_execute_success(self, tmp_path, sample_csv, sample_profile):
        """Test successful execution."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json=str(sample_profile),
            period_months=6,
        )

        assert result.success is True
        assert result.format == "json"
        assert isinstance(result.data, dict)
        assert "athlete_profile" in result.data
        assert "recent_period" in result.data

    def test_execute_missing_csv(self, tmp_path, sample_profile):
        """Test execution with missing CSV file."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path="/nonexistent/file.csv",
            athlete_profile_json=str(sample_profile),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_validate_parameters_missing_required(self):
        """Test parameter validation with missing required params."""
        tool = PerformanceAnalysisTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(period_months=6)
```

### CLI Tests

**Example: `tests/cli/test_analyze_commands.py`**

```python
from click.testing import CliRunner
import pytest

from cycling_ai.cli.main import cli

class TestAnalyzeCommands:
    """Tests for analyze commands."""

    def test_analyze_performance_success(self, sample_csv, sample_profile):
        """Test performance analysis command."""
        runner = CliRunner()

        result = runner.invoke(cli, [
            'analyze', 'performance',
            '--csv', str(sample_csv),
            '--profile', str(sample_profile),
            '--format', 'json'
        ])

        assert result.exit_code == 0
        assert "athlete_profile" in result.output

    def test_analyze_performance_missing_csv(self):
        """Test error handling for missing CSV."""
        runner = CliRunner()

        result = runner.invoke(cli, [
            'analyze', 'performance',
            '--csv', '/nonexistent.csv',
            '--profile', '/nonexistent.json'
        ])

        assert result.exit_code != 0
        assert "Error" in result.output
```

### Fixtures

**File: `tests/fixtures/conftest.py`**

```python
import pytest
from pathlib import Path
import json
import pandas as pd

@pytest.fixture
def sample_csv(tmp_path):
    """Create sample Strava CSV file."""
    csv_path = tmp_path / "activities.csv"

    # Create minimal valid CSV
    data = {
        'Activity Date': ['2024-01-01', '2024-01-02'],
        'Activity Name': ['Morning Ride', 'Evening Ride'],
        'Activity Type': ['Ride', 'Ride'],
        'Distance': [50000, 60000],
        'Moving Time': [7200, 8400],
        'Elapsed Time': [7500, 8700],
        'Elevation Gain': [500, 600],
        'Average Power': [200, 210],
        'Weighted Average Power': [210, 220],
        'Average Heart Rate': [145, 150],
    }

    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)

    return csv_path

@pytest.fixture
def sample_profile(tmp_path):
    """Create sample athlete profile."""
    profile_path = tmp_path / "athlete_profile.json"

    profile_data = {
        "name": "Test Athlete",
        "age": 35,
        "weight": "75kg",
        "FTP": "250w",
        "critical_HR": 165,
        "gender": "male",
        "training_availability": {
            "hours_per_week": 8,
            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday"
        },
        "goals": "Improve FTP to 270w",
        "current_training_status": "recreational"
    }

    with open(profile_path, 'w') as f:
        json.dump(profile_data, f)

    return profile_path
```

### Coverage Targets

| Module | Target Coverage |
|--------|----------------|
| Tool Wrappers | >90% |
| Configuration | >85% |
| CLI Commands | >80% |
| Orchestration | >85% |
| **Overall** | **>85%** |

---

## Implementation Order

### Phase 3A: Foundation (Days 1-2)

**Day 1: Configuration System**
1. Create `config/schema.py` with Pydantic models
2. Create `config/defaults.py` with default configuration
3. Implement `config/loader.py` with YAML loading
4. Write tests for configuration system
5. **Checkpoint:** Configuration loads successfully

**Day 2: Tool Loader & Registry Integration**
1. Create `tools/wrappers/__init__.py`
2. Implement `tools/loader.py` for auto-registration
3. Update `tools/__init__.py` to trigger auto-load
4. Write tests for tool loading
5. **Checkpoint:** Tools auto-register on import

### Phase 3B: Tool Wrappers (Days 3-4)

**Day 3: Core Analysis Tools**
1. Implement `PerformanceAnalysisTool` with tests
2. Implement `ZoneAnalysisTool` with tests
3. Test integration with core business logic
4. **Checkpoint:** 2 tools working end-to-end

**Day 4: Planning & Cross-Training Tools**
1. Implement `TrainingPlanTool` with tests
2. Implement `CrossTrainingTool` with tests
3. Create helper in `core/utils.py` for DataFrame preprocessing
4. **Checkpoint:** 4 tools working

### Phase 3C: CLI Interface (Days 5-6)

**Day 5: CLI Core & Analyze Commands**
1. Create CLI structure (`cli/main.py`)
2. Implement `analyze` commands
3. Create Rich formatting utilities
4. Write CLI tests
5. **Checkpoint:** `cycling-ai analyze` commands work

**Day 6: Remaining Commands & Polish**
1. Implement `plan` commands
2. Implement `config` commands
3. Implement `providers` commands
4. Add progress indicators
5. **Checkpoint:** All CLI commands functional

### Phase 3D: Integration & Polish (Day 7)

**Day 7: Orchestration & Documentation**
1. Implement `orchestration/executor.py`
2. Implement basic `orchestration/interpreter.py`
3. Integration testing with real data
4. Update documentation
5. Create usage examples
6. **Checkpoint:** End-to-end workflows complete

---

## Dependencies

### New Dependencies to Add

**File: `pyproject.toml`**

```toml
dependencies = [
    # Existing dependencies...

    # CLI
    "click>=8.1.0",
    "rich>=13.0.0",

    # Configuration
    "pyyaml>=6.0.0",
    "pydantic>=2.0.0",

    # Utilities
    "python-dotenv>=1.0.0",
]
```

### Installation

```bash
# Install with new dependencies
pip install -e ".[dev]"

# Install CLI as executable
pip install -e .
```

### Entry Point

Add to `pyproject.toml`:

```toml
[project.scripts]
cycling-ai = "cycling_ai.cli.main:main"
```

---

## Success Criteria

### Functional Requirements

- [ ] All 5 tool wrappers implemented and tested
- [ ] Configuration system loads from YAML and environment
- [ ] CLI accepts commands and executes tools
- [ ] Output formatting works (JSON, Markdown, Rich)
- [ ] Error handling provides clear user feedback
- [ ] Auto-registration of tools on import

### Quality Requirements

- [ ] >85% test coverage overall
- [ ] All tests pass with pytest
- [ ] mypy --strict passes without errors
- [ ] ruff linting passes
- [ ] Documentation complete for all public APIs

### Integration Requirements

- [ ] CLI integrates with Phase 1 core business logic
- [ ] CLI integrates with Phase 2 provider adapters
- [ ] Configuration system supports all 4 providers
- [ ] End-to-end workflow: CLI → Tool → Core → Provider → Output

### User Experience Requirements

- [ ] CLI provides helpful error messages
- [ ] Progress indicators for long operations
- [ ] Rich console output is readable and informative
- [ ] Configuration setup is intuitive
- [ ] Examples demonstrate common workflows

---

## Risk Assessment & Mitigation

### Risk 1: DataFrame Preprocessing Complexity (Medium)

**Issue:** CrossTrainingTool needs DataFrame with categorization applied.

**Mitigation:**
- Create helper function `load_and_categorize_activities()` in `core/utils.py`
- Document the preprocessing requirements clearly
- Add specific tests for preprocessing edge cases

### Risk 2: FIT File Processing Performance (Medium)

**Issue:** Zone analysis can be slow with many FIT files.

**Mitigation:**
- Use existing cache system from core module
- Add progress indicators in CLI
- Implement `max_files` parameter for testing
- Document expected processing times

### Risk 3: Configuration Complexity (Low)

**Issue:** Users may find YAML configuration intimidating.

**Mitigation:**
- Provide `config init` command to generate default config
- Include extensive inline comments in default config
- Create configuration tutorial in docs
- Support environment variables as simpler alternative

### Risk 4: Path Resolution Across Platforms (Low)

**Issue:** File paths may behave differently on Windows vs Unix.

**Mitigation:**
- Use `pathlib.Path` consistently for cross-platform compatibility
- Test on multiple platforms (CI)
- Document path requirements clearly

---

## Next Steps After Phase 3

### Phase 4: Advanced Features

1. **Multi-Tool Orchestration**
   - Chain multiple tools in workflows
   - Tool dependency resolution
   - Parallel tool execution

2. **HTML Report Generation**
   - Port existing MCP HTML generation
   - Add SVG visualizations
   - Interactive dashboards

3. **Streaming Responses**
   - Stream LLM responses to CLI
   - Progress updates during long operations
   - Cancellable operations

4. **Advanced LLM Integration**
   - Tool use planning by LLM
   - Conversational interface
   - Multi-turn analysis sessions

---

## Appendix A: Quick Start Example

After Phase 3 implementation, users will be able to:

```bash
# Initialize configuration
cycling-ai config init

# Set API key
export ANTHROPIC_API_KEY="your-key-here"

# Run performance analysis
cycling-ai analyze performance \
  --csv ~/data/activities.csv \
  --profile ~/data/athlete_profile.json \
  --period-months 6

# Generate training plan
cycling-ai plan generate \
  --profile ~/data/athlete_profile.json \
  --weeks 12

# Analyze power zones
cycling-ai analyze zones \
  --fit-dir ~/data/fit_files \
  --profile ~/data/athlete_profile.json

# List providers
cycling-ai providers list

# Show configuration
cycling-ai config show
```

---

## Appendix B: File Checklist

### New Files to Create

- [ ] `src/cycling_ai/config/__init__.py`
- [ ] `src/cycling_ai/config/schema.py`
- [ ] `src/cycling_ai/config/loader.py`
- [ ] `src/cycling_ai/config/defaults.py`
- [ ] `src/cycling_ai/tools/wrappers/__init__.py`
- [ ] `src/cycling_ai/tools/wrappers/performance.py`
- [ ] `src/cycling_ai/tools/wrappers/zones.py`
- [ ] `src/cycling_ai/tools/wrappers/training.py`
- [ ] `src/cycling_ai/tools/wrappers/cross_training.py`
- [ ] `src/cycling_ai/tools/wrappers/reports.py`
- [ ] `src/cycling_ai/tools/loader.py`
- [ ] `src/cycling_ai/cli/__init__.py`
- [ ] `src/cycling_ai/cli/main.py`
- [ ] `src/cycling_ai/cli/formatting.py`
- [ ] `src/cycling_ai/cli/commands/__init__.py`
- [ ] `src/cycling_ai/cli/commands/analyze.py`
- [ ] `src/cycling_ai/cli/commands/plan.py`
- [ ] `src/cycling_ai/cli/commands/report.py`
- [ ] `src/cycling_ai/cli/commands/config.py`
- [ ] `src/cycling_ai/cli/commands/providers.py`
- [ ] `src/cycling_ai/orchestration/__init__.py`
- [ ] `src/cycling_ai/orchestration/executor.py`
- [ ] `src/cycling_ai/orchestration/interpreter.py`

### Test Files to Create

- [ ] `tests/config/test_schema.py`
- [ ] `tests/config/test_loader.py`
- [ ] `tests/tools/wrappers/test_performance.py`
- [ ] `tests/tools/wrappers/test_zones.py`
- [ ] `tests/tools/wrappers/test_training.py`
- [ ] `tests/tools/wrappers/test_cross_training.py`
- [ ] `tests/tools/wrappers/test_reports.py`
- [ ] `tests/cli/test_main.py`
- [ ] `tests/cli/test_analyze_commands.py`
- [ ] `tests/cli/test_plan_commands.py`
- [ ] `tests/cli/test_formatting.py`
- [ ] `tests/orchestration/test_executor.py`
- [ ] `tests/orchestration/test_interpreter.py`

---

**Document Version:** 1.0
**Date:** 2025-10-24
**Author:** Claude Code (Principal Engineer)
**Review Status:** Ready for Implementation
