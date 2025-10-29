"""
Workout builder tool wrapper.

Allows LLM to create structured workouts with segments (warm-up, intervals, recovery, cool-down).
"""
from __future__ import annotations

import json
from typing import Any

from cycling_ai.core.workout_builder import Workout, WorkoutSegment
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class WorkoutBuilderTool(BaseTool):
    """
    Tool for creating structured workouts.

    Enables LLM to design workouts with specific segments, power targets,
    and durations. Generates SVG visualizations automatically.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="create_workout",
            description=(
                "Create a structured workout with warm-up, work intervals, recovery periods, "
                "and cool-down. Each workout consists of segments with specific durations and "
                "power targets. Use this tool to design each individual workout in your training plan. "
                "Automatically generates visual SVG representation."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="workout_name",
                    type="string",
                    description=(
                        "Name of the workout (e.g., 'Threshold Development', 'VO2 Max Intervals', "
                        "'Long Endurance Ride'). Should be descriptive and specific."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="description",
                    type="string",
                    description=(
                        "Coaching notes and purpose of the workout. Explain what this workout "
                        "aims to achieve (e.g., 'Build FTP with sustained efforts', "
                        "'Develop aerobic base with steady Z2 riding')."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="segments",
                    type="array",
                    description=(
                        "Array of workout segments in sequential order. Each segment must include: "
                        "type (warmup/interval/recovery/cooldown/steady), duration_min (integer), "
                        "power_low (watts), power_high (watts, optional - defaults to power_low), "
                        "description (segment purpose). Workouts typically include: warm-up (10-15min), "
                        "main intervals, recovery between intervals (3-5min), and cool-down (10min)."
                    ),
                    required=True,
                    items={
                        "type": "OBJECT",
                        "properties": {
                            "type": {
                                "type": "STRING",
                                "description": "Segment type: warmup, interval, recovery, cooldown, or steady"
                            },
                            "duration_min": {
                                "type": "INTEGER",
                                "description": "Duration of segment in minutes"
                            },
                            "power_low": {
                                "type": "INTEGER",
                                "description": "Lower power target in watts"
                            },
                            "power_high": {
                                "type": "INTEGER",
                                "description": "Upper power target in watts (optional, defaults to power_low)"
                            },
                            "description": {
                                "type": "STRING",
                                "description": "Purpose or details of this segment"
                            }
                        },
                        "required": ["type", "duration_min", "power_low"]
                    },
                ),
                ToolParameter(
                    name="ftp",
                    type="number",
                    description=(
                        "Athlete's current FTP in watts. Used for SVG visualization scaling. "
                        "Required for generating the workout visualization."
                    ),
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "Structured workout object containing: name, description, total_duration_min, "
                    "work_time_min (interval segments only), segments (array of segment details), "
                    "and svg (visual representation as SVG markup)."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute workout creation.

        Args:
            **kwargs: Tool parameters (workout_name, description, segments, ftp)

        Returns:
            ToolExecutionResult with structured workout data
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            # Extract parameters
            workout_name = kwargs["workout_name"]
            description = kwargs["description"]
            segments_data = kwargs["segments"]
            ftp = float(kwargs["ftp"])

            # Validate segments is a list
            if not isinstance(segments_data, list):
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["segments parameter must be an array of segment objects"],
                )

            if len(segments_data) == 0:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["segments array cannot be empty - workout must have at least one segment"],
                )

            # Create workout
            workout = Workout(name=workout_name, description=description)

            # Add segments
            for idx, seg_data in enumerate(segments_data):
                try:
                    # Validate segment data
                    if not isinstance(seg_data, dict):
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[f"Segment {idx + 1} must be an object with type, duration_min, power_low, etc."],
                        )

                    # Extract segment fields
                    seg_type = seg_data.get("type", "").lower()
                    duration_min = seg_data.get("duration_min")
                    power_low = seg_data.get("power_low")
                    power_high = seg_data.get("power_high", power_low)  # Default to power_low if not provided
                    seg_description = seg_data.get("description", "")

                    # Validate required fields
                    if not seg_type:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[f"Segment {idx + 1} missing required field: type"],
                        )

                    if duration_min is None:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[f"Segment {idx + 1} missing required field: duration_min"],
                        )

                    if power_low is None:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[f"Segment {idx + 1} missing required field: power_low"],
                        )

                    # Validate segment type
                    valid_types = ["warmup", "interval", "recovery", "cooldown", "steady"]
                    if seg_type not in valid_types:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[
                                f"Segment {idx + 1} has invalid type '{seg_type}'. "
                                f"Must be one of: {', '.join(valid_types)}"
                            ],
                        )

                    # Convert to integers
                    duration_min = int(duration_min)
                    power_low = int(power_low)
                    power_high = int(power_high) if power_high is not None else power_low

                    # Validate values
                    if duration_min <= 0:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[f"Segment {idx + 1} duration_min must be positive, got {duration_min}"],
                        )

                    if power_low < 0:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[f"Segment {idx + 1} power_low cannot be negative, got {power_low}"],
                        )

                    if power_high < power_low:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[
                                f"Segment {idx + 1} power_high ({power_high}) cannot be less than power_low ({power_low})"
                            ],
                        )

                    # Create segment
                    segment = WorkoutSegment(
                        duration_min=duration_min,
                        power_low=power_low,
                        power_high=power_high,
                        description=seg_description or f"{seg_type.title()} {duration_min}min",
                        segment_type=seg_type,
                    )

                    workout.add_segment(segment)

                except (ValueError, TypeError) as e:
                    return ToolExecutionResult(
                        success=False,
                        data=None,
                        format="json",
                        errors=[f"Error processing segment {idx + 1}: {str(e)}"],
                    )

            # Generate workout data
            workout_dict = workout.to_dict()

            # Generate SVG visualization
            svg_markup = workout.generate_svg(width=600, height=200, ftp=int(ftp))
            workout_dict['svg'] = svg_markup

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=workout_dict,
                format="json",
                metadata={
                    "workout_name": workout_name,
                    "total_duration_min": workout.total_duration(),
                    "work_time_min": workout.work_time(),
                    "num_segments": len(workout.segments),
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
                errors=[f"Unexpected error during workout creation: {str(e)}"],
            )


# Register tool on module import
register_tool(WorkoutBuilderTool())
