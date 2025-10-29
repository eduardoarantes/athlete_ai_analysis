"""
Report generation tool wrapper.

Generates HTML reports from JSON analysis results.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.json_validator import extract_and_validate_performance_analysis
from cycling_ai.tools.performance_report_generator import generate_performance_html
from cycling_ai.tools.registry import register_tool


class ReportGenerationTool(BaseTool):
    """
    Tool for generating professional HTML performance analysis reports.

    Generates HTML reports from JSON-based performance analysis output.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="generate_report",
            description=(
                "Generate professional HTML performance analysis report from JSON output. "
                "Creates a beautifully styled, responsive HTML report with performance metrics, "
                "zone distribution, trends, insights, and recommendations."
            ),
            category="reporting",
            parameters=[
                ToolParameter(
                    name="performance_analysis_json",
                    type="string",
                    description="JSON string output from performance analysis agent (must match PerformanceAnalysis schema)",
                    required=True,
                ),
                ToolParameter(
                    name="output_dir",
                    type="string",
                    description="Directory where HTML report should be saved",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Report generation status with saved file path",
            },
            version="2.0.0",
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
            # Extract and validate parameters
            performance_json_str = kwargs.get("performance_analysis_json")
            output_dir_str = kwargs.get("output_dir")

            if not performance_json_str:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Missing required parameter: performance_analysis_json"],
                )

            if not output_dir_str:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Missing required parameter: output_dir"],
                )

            # Validate and parse JSON
            try:
                analysis = extract_and_validate_performance_analysis(performance_json_str)
            except ValueError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid performance analysis JSON: {str(e)}"],
                )

            # Create output directory
            output_dir = Path(output_dir_str)
            try:
                output_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Cannot create output directory: {str(e)}"],
                )

            # Generate HTML report
            output_path = output_dir / "performance_report.html"
            try:
                generate_performance_html(analysis, output_path)
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
                    "output_file": str(output_path),
                    "output_format": "html",
                    "output_directory": str(output_dir),
                    "athlete_name": analysis.athlete_profile.name,
                },
                format="json",
                metadata={
                    "generated_at": datetime.now().isoformat(),
                },
            )

        except Exception as e:
            # Unexpected errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )


# Register tool on module import
register_tool(ReportGenerationTool())
