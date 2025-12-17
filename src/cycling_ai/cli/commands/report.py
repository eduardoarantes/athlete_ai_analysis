"""
Report generation commands for CLI.

Commands for generating comprehensive reports.
"""

from __future__ import annotations

import click

from ...tools.wrappers import ReportGenerationTool
from ..formatting import console


@click.group()
def report() -> None:
    """Generate comprehensive reports."""
    pass


@report.command()
@click.option(
    "--performance-json",
    type=click.Path(exists=True),
    required=True,
    help="Path to performance analysis JSON file",
)
@click.option(
    "--zones-json",
    type=click.Path(exists=True),
    required=True,
    help="Path to zones analysis JSON file",
)
@click.option(
    "--training-json",
    type=click.Path(exists=True),
    help="Path to training plan JSON file (optional)",
)
@click.option(
    "--output",
    type=click.Path(),
    required=True,
    help="Output path for Markdown report",
)
@click.pass_context
def generate(
    ctx: click.Context,
    performance_json: str,
    zones_json: str,
    training_json: str | None,
    output: str,
) -> None:
    """
    Generate comprehensive Markdown report.

    Combines multiple analysis results into a single cohesive report.

    \b
    Example:
        cycling-ai analyze performance --csv data.csv --profile profile.json --format json > perf.json
        cycling-ai analyze zones --fit-dir fits/ --profile profile.json --format json > zones.json
        cycling-ai report generate \\
            --performance-json perf.json \\
            --zones-json zones.json \\
            --output report.md
    """
    from pathlib import Path

    with console.status("[bold green]Generating report..."):
        tool = ReportGenerationTool()

        # Read JSON files
        perf_data = Path(performance_json).read_text()
        zones_data = Path(zones_json).read_text()

        kwargs = {
            "performance_analysis_json": perf_data,
            "zones_analysis_json": zones_data,
            "output_path": output,
        }

        if training_json:
            kwargs["training_plan_json"] = Path(training_json).read_text()

        result = tool.execute(**kwargs)

    if not result.success:
        console.print(f"[red]Error:[/red] {', '.join(result.errors)}")
        raise click.Abort()

    console.print(f"[green]Report generated successfully:[/green] {output}")
    console.print(f"  Size: {result.data['size_bytes']} bytes")
    console.print(f"  Sections: {', '.join(result.data['sections'])}")
