"""
Configuration commands for CLI.

Commands for managing configuration files.
"""

from __future__ import annotations

import click

from ..formatting import console


@click.group(name="config")
def config() -> None:
    """Manage configuration."""
    pass


@config.command()
@click.pass_context
def show(ctx: click.Context) -> None:
    """
    Show current configuration.

    Displays the active configuration settings.

    \b
    Example:
        cycling-ai config show
    """
    console.print("[yellow]Configuration management not yet implemented in Phase 3.[/yellow]")
    console.print("This will be added in a future phase.")


@config.command()
@click.pass_context
def init(ctx: click.Context) -> None:
    """
    Initialize default configuration.

    Creates a default configuration file if one doesn't exist.

    \b
    Example:
        cycling-ai config init
    """
    console.print("[yellow]Configuration initialization not yet implemented in Phase 3.[/yellow]")
    console.print("This will be added in a future phase.")
