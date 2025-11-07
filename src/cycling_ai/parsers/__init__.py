"""
Parsers package for importing workout data from external formats.

This package provides parsers for various workout file formats:
- FIT workout files (Garmin, Wahoo, TrainingPeaks)
- Future: ZWO files (Zwift)
- Future: MRC files (TrainerRoad)
"""

from .fit_workout_parser import (
    FitDurationType,
    FitIntensity,
    FitRepeatStructure,
    FitTargetType,
    FitWorkoutMetadata,
    FitWorkoutParser,
    FitWorkoutStep,
    ParsedWorkout,
)

__all__ = [
    "FitWorkoutParser",
    "FitWorkoutMetadata",
    "FitWorkoutStep",
    "FitRepeatStructure",
    "ParsedWorkout",
    "FitIntensity",
    "FitDurationType",
    "FitTargetType",
]
