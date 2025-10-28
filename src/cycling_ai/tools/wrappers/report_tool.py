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
                    name="output_dir",
                    type="string",
                    description="Directory where HTML reports should be saved",
                    required=False,
                ),
                ToolParameter(
                    name="output_format",
                    type="string",
                    description="Output format: 'html' or 'markdown' (default: html)",
                    required=False,
                ),
                ToolParameter(
                    name="output_path",
                    type="string",
                    description="DEPRECATED: Use output_dir instead. Path for single Markdown report",
                    required=False,
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
            # Extract parameters
            performance_json = kwargs.get("performance_analysis_json")
            zones_json = kwargs.get("zones_analysis_json")
            training_plan_json = kwargs.get("training_plan_json")

            # Validate required parameters
            if not performance_json or not zones_json:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Missing required parameters: performance_analysis_json and zones_analysis_json"],
                )

            # Support both output_dir (new) and output_path (legacy)
            output_dir = kwargs.get("output_dir")
            output_path = kwargs.get("output_path")

            if not output_dir and not output_path:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Required parameter missing: either output_dir or output_path must be provided"],
                )

            # Determine output directory
            if output_dir:
                output_directory = Path(output_dir)
            else:
                # Legacy: use parent of output_path
                output_directory = Path(output_path).parent  # type: ignore

            # Determine format - default to html if output_dir provided, markdown if output_path
            output_format = kwargs.get("output_format")
            if not output_format:
                output_format = "html" if output_dir else "markdown"

            if output_format not in ["html", "markdown"]:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid output_format: {output_format}. Must be 'html' or 'markdown'"],
                )

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

            # Create output directory
            try:
                output_directory.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Cannot create output directory: {str(e)}"],
                )

            # Generate reports based on format
            try:
                if output_format == "html":
                    output_files = self._generate_html_reports(
                        performance_data, zones_data, training_plan_data, output_directory
                    )
                else:
                    # Legacy Markdown mode
                    if output_path:
                        markdown_file = Path(output_path)
                    else:
                        markdown_file = output_directory / "report.md"

                    markdown = self._generate_markdown_report(
                        performance_data, zones_data, training_plan_data
                    )
                    markdown_file.write_text(markdown, encoding="utf-8")
                    output_files = [markdown_file]

            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Report generation failed: {str(e)}"],
                )

            # Return success
            return ToolExecutionResult(
                success=True,
                data={
                    "output_files": [str(f) for f in output_files],
                    "output_format": output_format,
                    "files_created": len(output_files),
                    "output_directory": str(output_directory),
                },
                format="json",
                metadata={
                    "generated_at": datetime.now().isoformat(),
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

    def _generate_html_reports(
        self,
        performance_data: dict[str, Any],
        zones_data: dict[str, Any],
        training_plan_data: dict[str, Any] | None,
        output_dir: Path,
    ) -> list[Path]:
        """
        Generate 3 HTML reports.

        Args:
            performance_data: Performance analysis results
            zones_data: Zone analysis results
            training_plan_data: Training plan results (optional)
            output_dir: Directory to save reports

        Returns:
            List of generated file paths
        """
        output_files = []

        # Generate index.html
        index_html = self._generate_index_html(
            performance_data, zones_data, training_plan_data
        )
        index_path = output_dir / "index.html"
        index_path.write_text(index_html, encoding="utf-8")
        output_files.append(index_path)

        # Generate coaching_insights.html
        insights_html = self._generate_coaching_insights_html(
            performance_data, zones_data, training_plan_data
        )
        insights_path = output_dir / "coaching_insights.html"
        insights_path.write_text(insights_html, encoding="utf-8")
        output_files.append(insights_path)

        # Generate performance_dashboard.html
        dashboard_html = self._generate_performance_dashboard_html(
            performance_data, zones_data, training_plan_data
        )
        dashboard_path = output_dir / "performance_dashboard.html"
        dashboard_path.write_text(dashboard_html, encoding="utf-8")
        output_files.append(dashboard_path)

        return output_files

    def _get_base_css(self) -> str:
        """Get embedded CSS for all HTML reports."""
        return """
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background: #f5f5f5;
                padding: 20px;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
                color: #1976d2;
                font-size: 2.5em;
                margin-bottom: 10px;
                border-bottom: 3px solid #1976d2;
                padding-bottom: 10px;
            }
            h2 {
                color: #1976d2;
                font-size: 1.8em;
                margin-top: 30px;
                margin-bottom: 15px;
                border-bottom: 2px solid #e0e0e0;
                padding-bottom: 8px;
            }
            h3 {
                color: #424242;
                font-size: 1.4em;
                margin-top: 20px;
                margin-bottom: 10px;
            }
            .metadata {
                color: #666;
                font-size: 0.9em;
                margin-bottom: 30px;
            }
            .stat-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }
            .stat-card {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 6px;
                border-left: 4px solid #1976d2;
            }
            .stat-label {
                font-size: 0.85em;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .stat-value {
                font-size: 1.8em;
                font-weight: bold;
                color: #1976d2;
                margin-top: 5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e0e0e0;
            }
            th {
                background: #f5f5f5;
                font-weight: 600;
                color: #424242;
            }
            tr:hover {
                background: #f9f9f9;
            }
            .positive {
                color: #4caf50;
            }
            .negative {
                color: #f44336;
            }
            .nav-links {
                margin: 20px 0;
                padding: 15px;
                background: #e3f2fd;
                border-radius: 6px;
            }
            .nav-links a {
                color: #1976d2;
                text-decoration: none;
                margin-right: 20px;
                font-weight: 500;
            }
            .nav-links a:hover {
                text-decoration: underline;
            }
            @media print {
                body {
                    background: white;
                    padding: 0;
                }
                .container {
                    box-shadow: none;
                }
                .nav-links {
                    display: none;
                }
            }
        </style>
        """

    def _generate_index_html(
        self,
        performance_data: dict[str, Any],
        zones_data: dict[str, Any],
        training_plan_data: dict[str, Any] | None,
    ) -> str:
        """Generate index.html with executive summary."""
        athlete = performance_data.get("athlete_profile", {})
        recent = performance_data.get("recent_period", {})
        trends = performance_data.get("trends", {})

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cycling Performance Report - {athlete.get('name', 'Athlete')}</title>
    {self._get_base_css()}
</head>
<body>
    <div class="container">
        <h1>Cycling Performance Report</h1>
        <div class="metadata">
            <strong>Athlete:</strong> {athlete.get('name', 'N/A')} |
            <strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </div>

        <div class="nav-links">
            <strong>Navigation:</strong>
            <a href="index.html">Summary</a>
            <a href="coaching_insights.html">Coaching Insights</a>
            <a href="performance_dashboard.html">Performance Dashboard</a>
        </div>

        <h2>Executive Summary</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">FTP (Functional Threshold Power)</div>
                <div class="stat-value">{athlete.get('ftp', 'N/A')} W</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Power-to-Weight Ratio</div>
                <div class="stat-value">{athlete.get('power_to_weight', 0):.2f} W/kg</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Recent Rides</div>
                <div class="stat-value">{recent.get('total_rides', 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Distance</div>
                <div class="stat-value">{recent.get('total_distance_km', 0):.0f} km</div>
            </div>
        </div>

        <h2>Key Insights</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Training Time</div>
                <div class="stat-value">{recent.get('total_time_hours', 0):.1f} hrs</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Power</div>
                <div class="stat-value">{recent.get('avg_power', 0):.0f} W</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Easy Training (Z1-Z2)</div>
                <div class="stat-value">{zones_data.get('easy_percent', 0):.1f}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Hard Training (Z4-Z5)</div>
                <div class="stat-value">{zones_data.get('hard_percent', 0):.1f}%</div>
            </div>
        </div>
"""

        # Add trends if available
        if trends:
            html += """
        <h2>Performance Trends</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Change</th>
                </tr>
            </thead>
            <tbody>
"""
            for metric, change in trends.items():
                metric_name = metric.replace('_', ' ').title()
                change_class = "positive" if change > 0 else "negative"
                html += f"""                <tr>
                    <td>{metric_name}</td>
                    <td class="{change_class}">{change:+.1f}%</td>
                </tr>
"""
            html += """            </tbody>
        </table>
"""

        # Add training plan summary if available
        if training_plan_data:
            html += f"""
        <h2>Training Plan</h2>
        <p><strong>Duration:</strong> {training_plan_data.get('total_weeks')} weeks</p>
        <p><strong>Current FTP:</strong> {training_plan_data.get('current_ftp')} W</p>
        <p><strong>Target FTP:</strong> {training_plan_data.get('target_ftp')} W</p>
        <p><strong>Expected Gain:</strong> <span class="positive">+{training_plan_data.get('ftp_gain')} W ({training_plan_data.get('ftp_gain_percent'):.1f}%)</span></p>
"""

        html += """
    </div>
</body>
</html>
"""
        return html

    def _generate_coaching_insights_html(
        self,
        performance_data: dict[str, Any],
        zones_data: dict[str, Any],
        training_plan_data: dict[str, Any] | None,
    ) -> str:
        """Generate coaching_insights.html with detailed analysis."""
        athlete = performance_data.get("athlete_profile", {})
        recent = performance_data.get("recent_period", {})
        previous = performance_data.get("previous_period", {})

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coaching Insights - {athlete.get('name', 'Athlete')}</title>
    {self._get_base_css()}
</head>
<body>
    <div class="container">
        <h1>Coaching Insights</h1>
        <div class="metadata">
            <strong>Athlete:</strong> {athlete.get('name', 'N/A')} |
            <strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </div>

        <div class="nav-links">
            <strong>Navigation:</strong>
            <a href="index.html">Summary</a>
            <a href="coaching_insights.html">Coaching Insights</a>
            <a href="performance_dashboard.html">Performance Dashboard</a>
        </div>

        <h2>Athlete Profile</h2>
        <table>
            <tr>
                <th>Attribute</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Age</td>
                <td>{athlete.get('age')} years</td>
            </tr>
            <tr>
                <td>FTP</td>
                <td>{athlete.get('ftp')} W</td>
            </tr>
            <tr>
                <td>Power-to-Weight</td>
                <td>{athlete.get('power_to_weight', 0):.2f} W/kg</td>
            </tr>
"""
        if goals := athlete.get("goals"):
            html += f"""            <tr>
                <td>Goals</td>
                <td>{goals}</td>
            </tr>
"""
        html += """        </table>

        <h2>Period Comparison</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Recent Period</th>
                    <th>Previous Period</th>
                    <th>Change</th>
                </tr>
            </thead>
            <tbody>
"""

        # Compare metrics
        metrics = [
            ("Total Rides", "total_rides", ""),
            ("Distance", "total_distance_km", "km"),
            ("Training Time", "total_time_hours", "hrs"),
            ("Average Power", "avg_power", "W"),
        ]

        for label, key, unit in metrics:
            recent_val = recent.get(key, 0)
            prev_val = previous.get(key, 0)
            if prev_val > 0:
                change = ((recent_val - prev_val) / prev_val) * 100
                change_class = "positive" if change > 0 else "negative"
                change_str = f'<span class="{change_class}">{change:+.1f}%</span>'
            else:
                change_str = "N/A"

            recent_str = f"{recent_val:.1f} {unit}" if isinstance(recent_val, float) else f"{recent_val} {unit}"
            prev_str = f"{prev_val:.1f} {unit}" if isinstance(prev_val, float) else f"{prev_val} {unit}"

            html += f"""                <tr>
                    <td>{label}</td>
                    <td>{recent_str}</td>
                    <td>{prev_str}</td>
                    <td>{change_str}</td>
                </tr>
"""

        html += """            </tbody>
        </table>

        <h2>Training Zone Distribution</h2>
        <table>
            <thead>
                <tr>
                    <th>Zone</th>
                    <th>Time (hours)</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
"""

        zones = zones_data.get("zones", {})
        for zone_name, zone_info in zones.items():
            hours = zone_info.get("time_hours", 0)
            pct = zone_info.get("percentage", 0)
            html += f"""                <tr>
                    <td>{zone_name}</td>
                    <td>{hours:.1f}</td>
                    <td>{pct:.1f}%</td>
                </tr>
"""

        html += """            </tbody>
        </table>

        <h2>Polarization Analysis</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Easy (Z1-Z2)</div>
                <div class="stat-value">{:.1f}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Moderate (Z3)</div>
                <div class="stat-value">{:.1f}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Hard (Z4-Z5)</div>
                <div class="stat-value">{:.1f}%</div>
            </div>
        </div>
""".format(
            zones_data.get('easy_percent', 0),
            zones_data.get('moderate_percent', 0),
            zones_data.get('hard_percent', 0),
        )

        # Add training plan details if available
        if training_plan_data and (plan_text := training_plan_data.get("plan_text")):
            html += f"""
        <h2>Training Plan Details</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; white-space: pre-wrap; font-family: monospace;">
{plan_text}
        </div>
"""

        html += """
    </div>
</body>
</html>
"""
        return html

    def _generate_performance_dashboard_html(
        self,
        performance_data: dict[str, Any],
        zones_data: dict[str, Any],
        training_plan_data: dict[str, Any] | None,
    ) -> str:
        """Generate performance_dashboard.html with visual data."""
        athlete = performance_data.get("athlete_profile", {})
        recent = performance_data.get("recent_period", {})

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Dashboard - {athlete.get('name', 'Athlete')}</title>
    {self._get_base_css()}
    <style>
        .chart-bar {{
            height: 30px;
            background: #1976d2;
            margin: 5px 0;
            border-radius: 3px;
            display: flex;
            align-items: center;
            padding-left: 10px;
            color: white;
            font-weight: bold;
        }}
        .zone-bar {{
            margin: 10px 0;
        }}
        .zone-label {{
            font-weight: 600;
            margin-bottom: 5px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Performance Dashboard</h1>
        <div class="metadata">
            <strong>Athlete:</strong> {athlete.get('name', 'N/A')} |
            <strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </div>

        <div class="nav-links">
            <strong>Navigation:</strong>
            <a href="index.html">Summary</a>
            <a href="coaching_insights.html">Coaching Insights</a>
            <a href="performance_dashboard.html">Performance Dashboard</a>
        </div>

        <h2>Key Performance Indicators</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Total Rides</div>
                <div class="stat-value">{recent.get('total_rides', 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Distance</div>
                <div class="stat-value">{recent.get('total_distance_km', 0):.0f} km</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Time</div>
                <div class="stat-value">{recent.get('total_time_hours', 0):.1f} hrs</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Power</div>
                <div class="stat-value">{recent.get('avg_power', 0):.0f} W</div>
            </div>
        </div>

        <h2>Zone Distribution Visualization</h2>
"""

        zones = zones_data.get("zones", {})
        max_hours = max((z.get("time_hours", 0) for z in zones.values()), default=1)

        for zone_name, zone_info in zones.items():
            hours = zone_info.get("time_hours", 0)
            pct = zone_info.get("percentage", 0)
            width_pct = (hours / max_hours) * 100 if max_hours > 0 else 0

            html += f"""        <div class="zone-bar">
            <div class="zone-label">{zone_name}: {hours:.1f} hours ({pct:.1f}%)</div>
            <div class="chart-bar" style="width: {width_pct}%;">
                {hours:.1f}h
            </div>
        </div>
"""

        html += """
        <h2>Training Distribution</h2>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Easy Training (Z1-Z2)</td>
                    <td>{:.1f}%</td>
                </tr>
                <tr>
                    <td>Moderate Training (Z3)</td>
                    <td>{:.1f}%</td>
                </tr>
                <tr>
                    <td>Hard Training (Z4-Z5)</td>
                    <td>{:.1f}%</td>
                </tr>
            </tbody>
        </table>
""".format(
            zones_data.get('easy_percent', 0),
            zones_data.get('moderate_percent', 0),
            zones_data.get('hard_percent', 0),
        )

        html += """
    </div>
</body>
</html>
"""
        return html


# Register tool on module import
register_tool(ReportGenerationTool())
