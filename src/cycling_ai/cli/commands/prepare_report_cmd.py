"""
Prepare Report Command

Extract training plan data from interaction logs and create report_data.json
"""

import sys
from pathlib import Path

import click

from cycling_ai.cli.formatting import console
from cycling_ai.cli.prepare_report import prepare_report, setup_logging


@click.command(name="prepare-report")
@click.option("--session", type=click.Path(exists=True), help="Single session JSONL file")
@click.option(
    "--sessions",
    type=click.Path(exists=True),
    multiple=True,
    help="Multiple session files (can be specified multiple times)",
)
@click.option(
    "--athlete-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    help="Directory containing athlete profiles (e.g., data/)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(),
    default="logs/report_data.json",
    help="Output file path (default: logs/report_data.json)",
    show_default=True,
)
@click.option("--no-validate", is_flag=True, help="Skip validation against schema")
@click.option("--verbose", "-v", is_flag=True, help="Verbose output")
def prepare_report_cmd(
    session: str | None,
    sessions: tuple[str, ...],
    athlete_dir: str | None,
    output: str,
    no_validate: bool,
    verbose: bool,
) -> None:
    """
    Prepare training plan report data from interaction logs.

    Extracts training plan data from LLM interaction logs and creates
    a consolidated report_data.json file that can be used with the
    interactive HTML viewer.

    \b
    Examples:
        # Single session
        cycling-ai prepare-report --session logs/session_latest.jsonl

        \b
        # Multiple sessions
        cycling-ai prepare-report \\
          --sessions logs/session1.jsonl \\
          --sessions logs/session2.jsonl

        \b
        # With athlete directory
        cycling-ai prepare-report \\
          --session logs/session.jsonl \\
          --athlete-dir data/

        \b
        # Custom output location
        cycling-ai prepare-report \\
          --session logs/session.jsonl \\
          --output reports/report_data.json
    """
    # Setup logging
    setup_logging(verbose)

    # Collect session patterns
    session_patterns = []
    if session:
        session_patterns.append(session)
    if sessions:
        session_patterns.extend(sessions)

    if not session_patterns:
        console.print("[red]Error:[/red] Must specify --session or --sessions")
        sys.exit(1)

    # Convert paths
    output_path = Path(output)
    athlete_dir_path = Path(athlete_dir) if athlete_dir else None

    # Prepare report
    with console.status("[bold green]Preparing report data..."):
        success = prepare_report(
            session_patterns=session_patterns,
            output_path=output_path,
            athlete_dir=athlete_dir_path,
            validate=not no_validate,
        )

    if success:
        console.print(f"\n[green]✓[/green] Report data saved to: {output_path}")
    else:
        console.print("\n[red]✗[/red] Failed to prepare report data")
        sys.exit(1)
