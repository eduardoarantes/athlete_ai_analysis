"""
Analyze commands for CLI.

Commands for running different types of analysis (performance, zones, cross-training).
"""

from __future__ import annotations

import json
from pathlib import Path

import click

from ...tools.wrappers import CrossTrainingTool, PerformanceAnalysisTool, ZoneAnalysisTool
from ..formatting import (
    console,
    format_json_as_rich,
    format_performance_analysis,
    format_zone_analysis,
)


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
    help="Number of months for comparison period (default: 6)",
)
@click.option(
    "--output",
    type=click.Path(),
    help="Output file path (optional, prints to console if not provided)",
)
@click.option(
    "--format",
    "output_format",
    type=click.Choice(["json", "rich"]),
    default="rich",
    help="Output format (default: rich)",
)
@click.pass_context
def performance(
    ctx: click.Context,
    csv: str,
    profile: str,
    period_months: int,
    output: str | None,
    output_format: str,
) -> None:
    """
    Analyze cycling performance comparing time periods.

    Compares recent period (e.g., last 6 months) with equivalent prior period
    to identify trends in distance, power, heart rate, and other metrics.

    \b
    Example:
        cycling-ai analyze performance \\
            --csv ~/data/activities.csv \\
            --profile ~/data/athlete_profile.json \\
            --period-months 6
    """
    with console.status("[bold green]Analyzing performance..."):
        tool = PerformanceAnalysisTool()
        result = tool.execute(
            csv_file_path=csv,
            athlete_profile_json=profile,
            period_months=period_months,
        )

    if not result.success:
        console.print(f"[red]Error:[/red] {', '.join(result.errors)}")
        raise click.Abort()

    # Format output
    if output_format == "json":
        output_text = json.dumps(result.data, indent=2)
        if output:
            Path(output).write_text(output_text)
            console.print(f"[green]Results saved to:[/green] {output}")
        else:
            console.print(format_json_as_rich(result.data))
    else:  # rich format
        format_performance_analysis(result.data)


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
    help="Number of months to analyze (default: 6)",
)
@click.option(
    "--no-cache",
    is_flag=True,
    help="Disable cache usage (force re-processing of FIT files)",
)
@click.option(
    "--output",
    type=click.Path(),
    help="Output file path (optional)",
)
@click.option(
    "--format",
    "output_format",
    type=click.Choice(["json", "rich"]),
    default="rich",
    help="Output format (default: rich)",
)
@click.pass_context
def zones(
    ctx: click.Context,
    fit_dir: str,
    profile: str,
    period_months: int,
    no_cache: bool,
    output: str | None,
    output_format: str,
) -> None:
    """
    Analyze time spent in power zones.

    Reads second-by-second power data from FIT files to provide accurate
    zone distribution analysis and polarization metrics.

    \b
    Example:
        cycling-ai analyze zones \\
            --fit-dir ~/data/fit_files \\
            --profile ~/data/athlete_profile.json
    """
    with console.status("[bold green]Processing FIT files..."):
        tool = ZoneAnalysisTool()
        result = tool.execute(
            activities_directory=fit_dir,
            athlete_profile_json=profile,
            period_months=period_months,
            use_cache=not no_cache,
        )

    if not result.success:
        console.print(f"[red]Error:[/red] {', '.join(result.errors)}")
        raise click.Abort()

    # Format output
    if output_format == "json":
        output_text = json.dumps(result.data, indent=2)
        if output:
            Path(output).write_text(output_text)
            console.print(f"[green]Results saved to:[/green] {output}")
        else:
            console.print(format_json_as_rich(result.data))
    else:  # rich format
        format_zone_analysis(result.data)


@analyze.command(name="cross-training")
@click.option(
    "--csv",
    type=click.Path(exists=True),
    required=True,
    help="Path to Strava activities CSV (all activity types)",
)
@click.option(
    "--period-weeks",
    type=int,
    default=12,
    help="Number of weeks to analyze (default: 12)",
)
@click.option(
    "--output",
    type=click.Path(),
    help="Output file path (optional)",
)
@click.option(
    "--format",
    "output_format",
    type=click.Choice(["json", "rich"]),
    default="rich",
    help="Output format (default: rich)",
)
@click.pass_context
def cross_training(
    ctx: click.Context,
    csv: str,
    period_weeks: int,
    output: str | None,
    output_format: str,
) -> None:
    """
    Analyze cross-training impact on cycling performance.

    Examines how strength training, running, swimming, and other activities
    affect cycling through load distribution and interference patterns.

    \b
    Example:
        cycling-ai analyze cross-training \\
            --csv ~/data/all_activities.csv \\
            --period-weeks 12
    """
    with console.status("[bold green]Analyzing cross-training impact..."):
        tool = CrossTrainingTool()
        result = tool.execute(
            csv_file_path=csv,
            analysis_period_weeks=period_weeks,
        )

    if not result.success:
        console.print(f"[red]Error:[/red] {', '.join(result.errors)}")
        raise click.Abort()

    # Format output
    if output_format == "json":
        output_text = json.dumps(result.data, indent=2)
        if output:
            Path(output).write_text(output_text)
            console.print(f"[green]Results saved to:[/green] {output}")
        else:
            console.print(format_json_as_rich(result.data))
    else:  # rich format
        console.print(format_json_as_rich(result.data))
