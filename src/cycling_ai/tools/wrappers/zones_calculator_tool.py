"""
Power zones calculator tool wrapper.

Calculates training power zones based on FTP for workout design.
"""

from __future__ import annotations

from typing import Any

from cycling_ai.core.power_zones import calculate_power_zones
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class ZonesCalculatorTool(BaseTool):
    """
    Tool for calculating training power zones.

    Computes standard cycling training zones (Z1-Z5) and Sweet Spot
    based on athlete's current FTP.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="calculate_power_zones",
            description=(
                "Calculate training power zones based on athlete's current FTP. "
                "Returns standard 5-zone model (Z1 Active Recovery, Z2 Endurance, Z3 Tempo, "
                "Z4 Threshold, Z5 VO2 Max) plus Sweet Spot zone. Use these zones to design "
                "workout power targets."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="ftp",
                    type="number",
                    description=(
                        "Athlete's current Functional Threshold Power in watts. "
                        "This is the power they can sustain for approximately 60 minutes."
                    ),
                    required=True,
                    min_value=50,
                    max_value=600,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "Power zone definitions with min/max watts for each zone: "
                    "z1 (0-55% FTP), z2 (56-75% FTP), z3 (76-90% FTP), "
                    "z4 (91-105% FTP), z5 (>105% FTP), sweet_spot (88-93% FTP). "
                    "Each zone includes name, min, max, and percentage of FTP."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute power zones calculation.

        Args:
            **kwargs: Tool parameters (ftp)

        Returns:
            ToolExecutionResult with power zone definitions
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract FTP
            ftp = float(kwargs["ftp"])

            # Calculate zones using centralized helper
            zones = calculate_power_zones(ftp)

            # Add percentage strings for display
            for zone_key, zone_data in zones.items():
                pct_min = int(zone_data["ftp_pct_min"] * 100)
                pct_max = int(zone_data["ftp_pct_max"] * 100)
                zone_data["ftp_percentage"] = f"{pct_min}-{pct_max}%"

            # Add summary information
            result_data = {
                "ftp": int(ftp),
                "zones": zones,
                "summary": {
                    "total_zones": 5,
                    "additional_zones": ["sweet_spot"],
                    "zone_model": "5-zone Coggan/Allen model",
                },
            }

            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "ftp": int(ftp),
                    "zone_count": 5,
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
                errors=[f"Unexpected error during zones calculation: {str(e)}"],
            )


# Register tool on module import
register_tool(ZonesCalculatorTool())
