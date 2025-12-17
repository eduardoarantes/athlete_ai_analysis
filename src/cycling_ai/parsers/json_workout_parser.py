#!/usr/bin/env python3
"""
JSON Workout Parser - Parse workout JSON files into library format.

Parses workout definitions from JSON files (TrainingPeaks, Garmin, etc.) and
converts them to the workout library schema.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class JsonWorkoutParser:
    """Parser for JSON workout files."""

    def parse_workout_file(self, json_path: Path | str) -> dict[str, Any]:
        """
        Parse JSON workout file into library format.

        Args:
            json_path: Path to JSON workout file

        Returns:
            Dictionary in workout library format

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If JSON is invalid or missing required fields
        """
        json_path = Path(json_path)

        if not json_path.exists():
            raise FileNotFoundError(f"JSON file not found: {json_path}")

        # Load JSON
        with open(json_path) as f:
            data = json.load(f)

        # Validate required fields
        if "title" not in data:
            raise ValueError(f"Missing 'title' in {json_path}")
        if "workout_structure" not in data:
            raise ValueError(f"Missing 'workout_structure' in {json_path}")

        # Extract metadata
        title = data["title"]
        description = data.get("description") or ""  # Handle null
        user_tags = data.get("userTags") or ""  # Handle null

        # Generate ID from title
        workout_id = self._generate_id(title)

        # Determine workout type and intensity from description/tags
        workout_type = self._infer_workout_type(title, description, user_tags)
        intensity = self._infer_intensity(workout_type, description)

        # Parse workout structure into segments
        segments = self._parse_workout_structure(data["workout_structure"])

        # Calculate total duration and TSS
        base_duration_min = self._calculate_duration(segments)
        base_tss = self._calculate_tss(segments, base_duration_min)

        # Determine suitable phases and weekdays
        suitable_phases = self._infer_suitable_phases(workout_type, intensity)
        suitable_weekdays = self._infer_suitable_weekdays(workout_type, intensity)

        # Identify variable components
        variable_components = self._identify_variable_components(segments)

        return {
            "id": workout_id,
            "name": title,
            "detailed_description": description,
            "type": workout_type,
            "intensity": intensity,
            "suitable_phases": suitable_phases,
            "suitable_weekdays": suitable_weekdays,
            "segments": segments,
            "base_duration_min": base_duration_min,
            "base_tss": base_tss,
            "variable_components": variable_components,
            "source_file": json_path.name,
            "source_format": "json",
        }

    def _generate_id(self, title: str) -> str:
        """Generate snake_case ID from title."""
        # Remove special characters, convert to lowercase, replace spaces with underscores
        id_str = re.sub(r"[^\w\s-]", "", title.lower())
        id_str = re.sub(r"[-\s]+", "_", id_str)
        # Limit length
        return id_str[:50]

    def _infer_workout_type(self, title: str, description: str, tags: str) -> str:
        """Infer workout type from title, description, and tags."""
        combined = (title + " " + description + " " + tags).lower()

        # Check for keywords
        if any(kw in combined for kw in ["vo2", "vo2max", "40/20", "30/30", "MAP"]):
            return "vo2max"
        elif any(kw in combined for kw in ["threshold", "FTP", "sweet spot", "sweetspot", "tempo"]):
            if "sweet spot" in combined or "sweetspot" in combined:
                return "sweet_spot"
            elif "tempo" in combined:
                return "tempo"
            else:
                return "threshold"
        elif any(kw in combined for kw in ["endurance", "aerobic", "z2", "zone 2", "easy"]):
            return "endurance"
        elif any(kw in combined for kw in ["recovery", "z1", "zone 1"]):
            return "recovery"
        elif any(kw in combined for kw in ["sprint", "neuromuscular", "max power", "anaerobic"]):
            return "sprint"
        else:
            # Default based on power targets in workout
            return "mixed"

    def _infer_intensity(self, workout_type: str, description: str) -> str:
        """Infer intensity (hard/easy) from workout type."""
        hard_types = ["vo2max", "threshold", "sprint", "sweet_spot"]
        easy_types = ["recovery", "endurance"]

        if workout_type in hard_types:
            return "hard"
        elif workout_type in easy_types:
            return "easy"
        else:
            # Check description for clues
            desc_lower = description.lower()
            if any(kw in desc_lower for kw in ["hard", "intense", "high intensity"]):
                return "hard"
            else:
                return "easy"

    def _parse_workout_structure(self, workout_structure: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Parse workout_structure array into segments."""
        segments: list[dict[str, Any]] = []

        for item in workout_structure:
            item_type = item.get("type", "step")
            steps = item.get("steps", [])

            if item_type == "repetition":
                # This is an interval set
                segment = self._parse_repetition(item)
                if segment:
                    segments.append(segment)
            else:
                # This is a simple step
                for step in steps:
                    segment = self._parse_simple_step(step)
                    if segment:
                        segments.append(segment)

        return segments

    def _parse_repetition(self, repetition: dict[str, Any]) -> dict[str, Any] | None:
        """Parse a repetition structure into an interval segment."""
        steps = repetition.get("steps", [])
        if len(steps) < 2:
            # Not a valid interval (need work + recovery)
            return None

        repetitions = int(repetition.get("length", {}).get("value", 1))

        # First step is work, second is recovery
        work_step = steps[0]
        recovery_step = steps[1]

        # Parse work interval
        work_duration_sec = work_step.get("length", {}).get("value", 0)
        work_targets = work_step.get("targets", [{}])[0]
        work_power_low = work_targets.get("minValue", 100)
        work_power_high = work_targets.get("maxValue", work_power_low)

        # Parse recovery interval
        recovery_duration_sec = recovery_step.get("length", {}).get("value", 0)
        recovery_targets = recovery_step.get("targets", [{}])[0]
        recovery_power_low = recovery_targets.get("minValue", 50)
        recovery_power_high = recovery_targets.get("maxValue", recovery_power_low)

        return {
            "type": "interval",
            "sets": repetitions,
            "work": {
                "duration_min": round(work_duration_sec / 60, 2),
                "power_low_pct": int(work_power_low),
                "power_high_pct": int(work_power_high),
                "description": work_step.get("name", "Work"),
            },
            "recovery": {
                "duration_min": round(recovery_duration_sec / 60, 2),
                "power_low_pct": int(recovery_power_low),
                "power_high_pct": int(recovery_power_high),
                "description": recovery_step.get("name", "Recovery"),
            },
        }

    def _parse_simple_step(self, step: dict[str, Any]) -> dict[str, Any] | None:
        """Parse a simple step into a segment."""
        intensity_class = step.get("intensityClass", "active")
        duration_sec = step.get("length", {}).get("value", 0)

        if duration_sec == 0:
            return None

        targets = step.get("targets", [{}])[0]
        power_low = targets.get("minValue", 50)
        power_high = targets.get("maxValue", power_low)

        # Map intensity class to segment type
        segment_type_map = {
            "warmUp": "warmup",
            "coolDown": "cooldown",
            "active": "steady",
            "rest": "recovery",
        }

        segment_type = segment_type_map.get(intensity_class, "steady")

        return {
            "type": segment_type,
            "duration_min": round(duration_sec / 60, 2),
            "power_low_pct": int(power_low),
            "power_high_pct": int(power_high),
            "description": step.get("name", segment_type.title()),
        }

    def _calculate_duration(self, segments: list[dict[str, Any]]) -> int:
        """Calculate total workout duration in minutes."""
        total_duration = 0

        for segment in segments:
            if segment["type"] == "interval":
                # Interval: (work + recovery) × sets
                work_dur = segment["work"]["duration_min"]
                recovery_dur = segment["recovery"]["duration_min"]
                sets = segment["sets"]
                total_duration += (work_dur + recovery_dur) * sets
            else:
                # Simple segment
                total_duration += segment["duration_min"]

        return int(round(total_duration))

    def _calculate_tss(self, segments: list[dict[str, Any]], duration_min: int) -> float:
        """
        Calculate Training Stress Score (TSS).

        TSS = duration_hours × intensity_factor² × 100
        where intensity_factor is derived from average power percentage
        """
        if duration_min == 0:
            return 0.0

        # Calculate weighted average power percentage
        total_power_weighted = 0.0
        total_time = 0.0

        for segment in segments:
            if segment["type"] == "interval":
                # Work intervals
                work_dur = segment["work"]["duration_min"]
                work_power_avg = (segment["work"]["power_low_pct"] + segment["work"]["power_high_pct"]) / 2
                sets = segment["sets"]

                total_power_weighted += work_power_avg * work_dur * sets
                total_time += work_dur * sets

                # Recovery intervals
                recovery_dur = segment["recovery"]["duration_min"]
                recovery_power_avg = (segment["recovery"]["power_low_pct"] + segment["recovery"]["power_high_pct"]) / 2

                total_power_weighted += recovery_power_avg * recovery_dur * sets
                total_time += recovery_dur * sets
            else:
                # Simple segment
                dur = segment["duration_min"]
                power_avg = (segment["power_low_pct"] + segment["power_high_pct"]) / 2

                total_power_weighted += power_avg * dur
                total_time += dur

        if total_time == 0:
            return 0.0

        avg_power_pct = total_power_weighted / total_time
        intensity_factor = avg_power_pct / 100  # Convert percentage to factor

        # TSS formula
        duration_hours = duration_min / 60
        tss = duration_hours * (intensity_factor**2) * 100

        return round(tss, 1)

    def _infer_suitable_phases(self, workout_type: str, intensity: str) -> list[str]:
        """Infer suitable training phases for this workout."""
        if workout_type == "recovery" or intensity == "easy":
            return ["Foundation", "Recovery", "Taper"]
        elif workout_type == "endurance":
            return ["Foundation", "Build", "Base"]
        elif workout_type in ["vo2max", "threshold"]:
            return ["Build", "Peak"]
        elif workout_type == "sweet_spot":
            return ["Base", "Build"]
        elif workout_type == "sprint":
            return ["Peak", "Specialty"]
        else:
            return ["Build"]

    def _infer_suitable_weekdays(self, workout_type: str, intensity: str) -> list[str]:
        """Infer suitable weekdays for this workout."""
        if intensity == "hard":
            # Hard workouts: mid-week
            return ["Tuesday", "Wednesday", "Thursday"]
        elif workout_type == "endurance":
            # Long endurance: weekends
            return ["Saturday", "Sunday"]
        elif workout_type == "recovery":
            # Recovery: any day, but often Monday or Friday
            return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        else:
            # Default: any day
            return [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ]

    def _identify_variable_components(self, segments: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Identify which components can be adjusted."""
        # Look for interval segments
        for segment in segments:
            if segment["type"] == "interval":
                sets = segment["sets"]
                work_dur = segment["work"]["duration_min"]
                recovery_dur = segment["recovery"]["duration_min"]

                # Estimate TSS per set
                work_power = (segment["work"]["power_low_pct"] + segment["work"]["power_high_pct"]) / 2
                recovery_power = (segment["recovery"]["power_low_pct"] + segment["recovery"]["power_high_pct"]) / 2

                # Simple TSS estimate for one set
                set_duration_hours = (work_dur + recovery_dur) / 60
                avg_power_pct = (work_power * work_dur + recovery_power * recovery_dur) / (work_dur + recovery_dur)
                if_per_set = avg_power_pct / 100
                tss_per_set = set_duration_hours * (if_per_set**2) * 100

                return {
                    "adjustable_field": "sets",
                    "min_value": max(1, sets - 2),
                    "max_value": sets + 3,
                    "tss_per_unit": round(tss_per_set, 1),
                    "duration_per_unit_min": round(work_dur + recovery_dur, 1),
                }

        # No intervals found - could adjust duration of longest segment
        if segments:
            longest_segment = max(segments, key=lambda s: s.get("duration_min", 0))
            if longest_segment.get("duration_min", 0) > 30:
                return {
                    "adjustable_field": "duration",
                    "min_value": int(longest_segment["duration_min"] * 0.7),
                    "max_value": int(longest_segment["duration_min"] * 1.3),
                }

        return None
