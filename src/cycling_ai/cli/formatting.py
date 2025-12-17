"""
Rich console formatting utilities for CLI.

Provides beautiful console output with syntax highlighting, tables, and panels.
"""

from __future__ import annotations

import json
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table

# Global console instance
console = Console()


def format_json_as_rich(data: dict[str, Any] | str) -> Syntax:
    """
    Format JSON data with Rich syntax highlighting.

    Args:
        data: Dictionary or JSON string to format

    Returns:
        Syntax object for Rich console printing
    """
    json_str = json.dumps(data, indent=2) if isinstance(data, dict) else data

    return Syntax(json_str, "json", theme="monokai", line_numbers=True)


def format_performance_analysis(data: dict[str, Any]) -> None:
    """
    Format performance analysis with Rich tables and panels.

    Args:
        data: Performance analysis result dictionary
    """
    # Extract athlete profile
    athlete = data.get("athlete_profile", {})

    # Create athlete info panel
    athlete_info = f"""
Name: {athlete.get("name", "Unknown")}
Age: {athlete.get("age")} years
FTP: {athlete.get("ftp")} W
Power-to-Weight: {athlete.get("power_to_weight", 0):.2f} W/kg
"""
    console.print(Panel(athlete_info.strip(), title="Athlete Profile", border_style="blue"))

    # Create comparison table
    recent = data.get("recent_period", {})
    previous = data.get("previous_period", {})
    trends = data.get("trends", {})

    table = Table(title="Period Comparison")
    table.add_column("Metric", style="cyan")
    table.add_column("Recent", style="green")
    table.add_column("Previous", style="yellow")
    table.add_column("Change", style="magenta")

    # Add rows
    table.add_row(
        "Total Rides",
        str(recent.get("total_rides", 0)),
        str(previous.get("total_rides", 0)),
        f"{trends.get('rides', 0):+.1f}%" if "rides" in trends else "N/A",
    )

    table.add_row(
        "Distance (km)",
        f"{recent.get('total_distance_km', 0):.1f}",
        f"{previous.get('total_distance_km', 0):.1f}",
        f"{trends.get('distance', 0):+.1f}%" if "distance" in trends else "N/A",
    )

    table.add_row(
        "Time (hours)",
        f"{recent.get('total_time_hours', 0):.1f}",
        f"{previous.get('total_time_hours', 0):.1f}",
        f"{trends.get('time', 0):+.1f}%" if "time" in trends else "N/A",
    )

    table.add_row(
        "Avg Power (W)",
        f"{recent.get('avg_power', 0):.0f}",
        f"{previous.get('avg_power', 0):.0f}",
        f"{trends.get('power', 0):+.1f}%" if "power" in trends else "N/A",
    )

    console.print(table)


def format_zone_analysis(data: dict[str, Any]) -> None:
    """
    Format zone analysis with Rich tables.

    Args:
        data: Zone analysis result dictionary
    """
    # Create zone distribution table
    zones = data.get("zones", {})
    ftp = data.get("ftp", 0)

    console.print(Panel(f"FTP: {ftp} W", title="Power Zones", border_style="blue"))

    table = Table(title="Time in Zones")
    table.add_column("Zone", style="cyan")
    table.add_column("Time (hours)", style="green")
    table.add_column("Percentage", style="yellow")

    for zone_name, zone_info in zones.items():
        hours = zone_info.get("time_hours", 0)
        pct = zone_info.get("percentage", 0)
        table.add_row(zone_name, f"{hours:.1f}", f"{pct:.1f}%")

    console.print(table)

    # Polarization summary
    console.print("\n[bold]Polarization Analysis:[/bold]")
    console.print(f"  Easy (Z1-Z2): {data.get('easy_percent', 0):.1f}%")
    console.print(f"  Moderate (Z3): {data.get('moderate_percent', 0):.1f}%")
    console.print(f"  Hard (Z4-Z5): {data.get('hard_percent', 0):.1f}%")


def format_training_plan(data: dict[str, Any]) -> None:
    """
    Format training plan with Rich tables.

    Args:
        data: Training plan result dictionary
    """
    # Header info
    console.print(
        Panel(
            f"Current FTP: {data.get('current_ftp')} W\n"
            f"Target FTP: {data.get('target_ftp')} W\n"
            f"Duration: {data.get('total_weeks')} weeks",
            title="Training Plan",
            border_style="blue",
        )
    )

    # If plan_text is available, display it
    if plan_text := data.get("plan_text"):
        console.print(plan_text)
