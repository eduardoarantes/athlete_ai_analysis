"""
Provider commands for CLI.

Commands for managing LLM providers.
"""
from __future__ import annotations

import click

from ..formatting import console


@click.group()
def providers() -> None:
    """Manage LLM providers."""
    pass


@providers.command(name="list")
@click.pass_context
def list_providers(ctx: click.Context) -> None:
    """
    List available LLM providers.

    Shows all configured providers and their status.

    \b
    Example:
        cycling-ai providers list
    """
    console.print("[yellow]Provider management not yet implemented in Phase 3.[/yellow]")
    console.print("This will be added in a future phase.")
