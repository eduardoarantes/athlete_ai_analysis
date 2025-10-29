"""
Main CLI entry point.

Provides command-line interface for cycling AI analysis using Click.
"""
from __future__ import annotations

import click

from .commands import analyze, chat, config as config_cmd, generate, plan, providers, report
from .commands.prepare_report_cmd import prepare_report_cmd
from .formatting import console


@click.group()
@click.version_option(version="0.1.0", prog_name="cycling-ai")
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

    Analyze cycling performance data using multiple analysis tools
    and generate comprehensive reports.

    \b
    Examples:
        cycling-ai analyze performance --csv activities.csv --profile profile.json
        cycling-ai analyze zones --fit-dir ./fit_files --profile profile.json
        cycling-ai plan generate --profile profile.json --weeks 12
    """
    # Ensure context object dict exists
    ctx.ensure_object(dict)

    # Store config path if provided
    if config:
        ctx.obj["config"] = config


# Register command groups
cli.add_command(analyze.analyze)
cli.add_command(chat.chat)
cli.add_command(generate.generate)
cli.add_command(plan.plan)
cli.add_command(report.report)
cli.add_command(prepare_report_cmd)
cli.add_command(config_cmd.config)
cli.add_command(providers.providers)


def main() -> None:
    """Entry point for CLI application."""
    try:
        cli()
    except Exception as e:
        console.print(f"[red]Error:[/red] {str(e)}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
