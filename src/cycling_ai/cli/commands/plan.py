"""
Plan generation commands for CLI.

Commands for generating training plans.
"""
from __future__ import annotations

import json
from pathlib import Path

import click

from ..formatting import console, format_json_as_rich, format_training_plan
from ...tools.wrappers import TrainingPlanTool


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
    help="Plan duration in weeks (4-24, default: 12)",
)
@click.option(
    "--target-ftp",
    type=float,
    help="Target FTP in watts (optional, defaults to +6% of current)",
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
def generate(
    ctx: click.Context,
    profile: str,
    weeks: int,
    target_ftp: float | None,
    output: str | None,
    output_format: str,
) -> None:
    """
    Generate progressive training plan.

    Creates a periodized week-by-week plan based on athlete's availability
    and goals with Foundation, Build, and Peak phases.

    \b
    Example:
        cycling-ai plan generate \\
            --profile ~/data/athlete_profile.json \\
            --weeks 12 \\
            --target-ftp 270
    """
    with console.status("[bold green]Generating training plan..."):
        tool = TrainingPlanTool()
        kwargs = {
            "athlete_profile_json": profile,
            "total_weeks": weeks,
        }
        if target_ftp:
            kwargs["target_ftp"] = target_ftp

        result = tool.execute(**kwargs)

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
        format_training_plan(result.data)
