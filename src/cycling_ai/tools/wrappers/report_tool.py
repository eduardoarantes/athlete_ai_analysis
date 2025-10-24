"""
Report generation tool wrapper.

Generates Markdown reports combining multiple analysis results.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class ReportGenerationTool(BaseTool):
    """
    Tool for generating comprehensive analysis reports.

    Combines performance, zones, and training plan analyses into a
    cohesive Markdown report.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="generate_report",
            description=(
                "Generate comprehensive Markdown report combining multiple analysis results. "
                "Creates a well-structured report with performance summary, zone distribution, "
                "training plan, and recommendations. Report is saved as Markdown file for "
                "easy viewing and version control."
            ),
            category="reporting",
            parameters=[
                ToolParameter(
                    name="performance_analysis_json",
                    type="string",
                    description="JSON string output from performance analysis tool",
                    required=True,
                ),
                ToolParameter(
                    name="zones_analysis_json",
                    type="string",
                    description="JSON string output from zones analysis tool",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_json",
                    type="string",
                    description="JSON string output from training plan tool (optional)",
                    required=False,
                ),
                ToolParameter(
                    name="output_path",
                    type="string",
                    description="Path where Markdown report should be saved",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Report generation status with saved file path",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute report generation.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with report generation status
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract parameters
            performance_json = kwargs["performance_analysis_json"]
            zones_json = kwargs["zones_analysis_json"]
            training_plan_json = kwargs.get("training_plan_json")
            output_path = kwargs["output_path"]

            # Parse input JSONs
            try:
                performance_data = json.loads(performance_json)
                zones_data = json.loads(zones_json)
                training_plan_data = (
                    json.loads(training_plan_json) if training_plan_json else None
                )
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid input JSON: {str(e)}"],
                )

            # Generate report
            report_markdown = self._generate_markdown_report(
                performance_data, zones_data, training_plan_data
            )

            # Write to file
            try:
                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                output_file.write_text(report_markdown)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error writing report file: {str(e)}"],
                )

            # Return success
            return ToolExecutionResult(
                success=True,
                data={
                    "report_path": str(output_file),
                    "size_bytes": len(report_markdown),
                    "sections": ["performance", "zones"]
                    + (["training_plan"] if training_plan_data else []),
                },
                format="json",
                metadata={
                    "generated_at": datetime.now().isoformat(),
                    "output_path": str(output_file),
                },
            )

        except ValueError as e:
            # Parameter validation errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            # Unexpected errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )

    def _generate_markdown_report(
        self,
        performance_data: dict[str, Any],
        zones_data: dict[str, Any],
        training_plan_data: dict[str, Any] | None,
    ) -> str:
        """
        Generate Markdown report from analysis data.

        Args:
            performance_data: Performance analysis results
            zones_data: Zone analysis results
            training_plan_data: Training plan results (optional)

        Returns:
            Markdown-formatted report string
        """
        report = []

        # Header
        athlete = performance_data.get("athlete_profile", {})
        report.append(f"# Cycling Performance Report - {athlete.get('name', 'Athlete')}")
        report.append(f"\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

        # Athlete Profile Section
        report.append("## Athlete Profile\n")
        report.append(f"- **Age:** {athlete.get('age')} years")
        report.append(f"- **FTP:** {athlete.get('ftp')} W")
        report.append(
            f"- **Power-to-Weight:** {athlete.get('power_to_weight', 0):.2f} W/kg"
        )
        if goals := athlete.get("goals"):
            report.append(f"- **Goals:** {goals}")
        report.append("")

        # Performance Section
        report.append("## Performance Analysis\n")
        recent = performance_data.get("recent_period", {})
        previous = performance_data.get("previous_period", {})

        report.append("### Recent Period")
        report.append(f"- **Rides:** {recent.get('total_rides', 0)}")
        report.append(f"- **Distance:** {recent.get('total_distance_km', 0):.1f} km")
        report.append(f"- **Time:** {recent.get('total_time_hours', 0):.1f} hours")
        report.append(f"- **Avg Power:** {recent.get('avg_power', 0):.0f} W")
        report.append("")

        # Trends
        if trends := performance_data.get("trends"):
            report.append("### Trends")
            for metric, change in trends.items():
                report.append(f"- **{metric.replace('_', ' ').title()}:** {change:+.1f}%")
            report.append("")

        # Zone Distribution Section
        report.append("## Power Zone Distribution\n")
        zones = zones_data.get("zones", {})

        report.append("| Zone | Time (hours) | Percentage |")
        report.append("|------|--------------|------------|")
        for zone_name, zone_info in zones.items():
            hours = zone_info.get("time_hours", 0)
            pct = zone_info.get("percentage", 0)
            report.append(f"| {zone_name} | {hours:.1f} | {pct:.1f}% |")
        report.append("")

        # Polarization
        report.append("### Polarization Analysis\n")
        report.append(f"- **Easy (Z1-Z2):** {zones_data.get('easy_percent', 0):.1f}%")
        report.append(f"- **Moderate (Z3):** {zones_data.get('moderate_percent', 0):.1f}%")
        report.append(f"- **Hard (Z4-Z5):** {zones_data.get('hard_percent', 0):.1f}%")
        report.append("")

        # Training Plan Section (if available)
        if training_plan_data:
            report.append("## Training Plan\n")
            report.append(f"- **Duration:** {training_plan_data.get('total_weeks')} weeks")
            report.append(
                f"- **Current FTP:** {training_plan_data.get('current_ftp')} W"
            )
            report.append(f"- **Target FTP:** {training_plan_data.get('target_ftp')} W")
            report.append(
                f"- **FTP Gain:** +{training_plan_data.get('ftp_gain')} W "
                f"({training_plan_data.get('ftp_gain_percent'):.1f}%)"
            )
            report.append("")

            # Include formatted plan text if available
            if plan_text := training_plan_data.get("plan_text"):
                report.append(plan_text)

        return "\n".join(report)


# Register tool on module import
register_tool(ReportGenerationTool())
