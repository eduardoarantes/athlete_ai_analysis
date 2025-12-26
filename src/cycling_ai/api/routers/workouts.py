"""
Workouts Router.

API endpoints for workout library access.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader
from cycling_ai.core.workout_library.models import Workout

logger = logging.getLogger(__name__)

router = APIRouter()


# Valid filter values
WorkoutType = Literal["endurance", "tempo", "sweet_spot", "threshold", "vo2max", "recovery", "mixed"]
WorkoutIntensity = Literal["easy", "moderate", "hard", "very_hard"]
TrainingPhase = Literal["Base", "Build", "Peak", "Recovery", "Taper", "Foundation"]


class WorkoutItem(BaseModel):
    """Simplified workout item for API response."""

    id: str
    name: str
    type: str
    intensity: str
    suitable_phases: list[str] | None
    suitable_weekdays: list[str] | None
    base_duration_min: float
    base_tss: float
    detailed_description: str | None = None


class WorkoutLibraryResponse(BaseModel):
    """Response for workout library endpoint."""

    workouts: list[WorkoutItem]
    total: int
    filters_applied: dict[str, list[str] | int | str | None]


def _workout_to_item(workout: Workout) -> WorkoutItem:
    """Convert Workout model to WorkoutItem for API response."""
    return WorkoutItem(
        id=workout.id,
        name=workout.name,
        type=workout.type,
        intensity=workout.intensity,
        suitable_phases=list(workout.suitable_phases) if workout.suitable_phases else None,
        suitable_weekdays=list(workout.suitable_weekdays) if workout.suitable_weekdays else None,
        base_duration_min=workout.base_duration_min,
        base_tss=workout.base_tss,
        detailed_description=workout.detailed_description,
    )


def _filter_workouts(
    workouts: list[Workout],
    types: list[WorkoutType] | None,
    intensities: list[WorkoutIntensity] | None,
    phases: list[TrainingPhase] | None,
    min_duration: int | None,
    max_duration: int | None,
    search: str | None,
) -> list[Workout]:
    """Filter workouts based on query parameters."""
    filtered = workouts

    # Filter by type
    if types:
        filtered = [w for w in filtered if w.type in types]

    # Filter by intensity
    if intensities:
        filtered = [w for w in filtered if w.intensity in intensities]

    # Filter by phase
    if phases:
        filtered = [
            w for w in filtered
            if w.suitable_phases and any(p in w.suitable_phases for p in phases)
        ]

    # Filter by duration
    if min_duration is not None:
        filtered = [w for w in filtered if w.base_duration_min >= min_duration]

    if max_duration is not None:
        filtered = [w for w in filtered if w.base_duration_min <= max_duration]

    # Filter by search term
    if search:
        search_lower = search.lower()
        filtered = [
            w for w in filtered
            if search_lower in w.name.lower()
            or (w.detailed_description and search_lower in w.detailed_description.lower())
        ]

    return filtered


@router.get("", response_model=WorkoutLibraryResponse)
@router.get("/", response_model=WorkoutLibraryResponse, include_in_schema=False)
async def get_workouts(
    type: list[WorkoutType] | None = Query(default=None, description="Filter by workout type"),
    intensity: list[WorkoutIntensity] | None = Query(default=None, description="Filter by intensity"),
    phase: list[TrainingPhase] | None = Query(default=None, description="Filter by training phase"),
    min_duration: int | None = Query(default=None, alias="minDuration", ge=0, description="Minimum duration in minutes"),
    max_duration: int | None = Query(default=None, alias="maxDuration", ge=0, description="Maximum duration in minutes"),
    search: str | None = Query(default=None, description="Search in name and description"),
) -> JSONResponse:
    """
    Get workout library with optional filtering.

    This is a public endpoint - no authentication required.
    The workout library is static reference data.
    """
    try:
        # Load library (cached after first load)
        loader = WorkoutLibraryLoader()
        library = loader.get_library()

        # Apply filters
        filtered_workouts = _filter_workouts(
            workouts=library.workouts,
            types=type,
            intensities=intensity,
            phases=phase,
            min_duration=min_duration,
            max_duration=max_duration,
            search=search,
        )

        # Convert to response items
        workout_items = [_workout_to_item(w) for w in filtered_workouts]

        # Build filters applied dict
        filters_applied: dict[str, list[str] | int | str | None] = {}
        if type:
            filters_applied["type"] = list(type)
        if intensity:
            filters_applied["intensity"] = list(intensity)
        if phase:
            filters_applied["phase"] = list(phase)
        if min_duration is not None:
            filters_applied["minDuration"] = min_duration
        if max_duration is not None:
            filters_applied["maxDuration"] = max_duration
        if search:
            filters_applied["search"] = search

        response = WorkoutLibraryResponse(
            workouts=workout_items,
            total=len(workout_items),
            filters_applied=filters_applied,
        )

        logger.info(f"Returning {len(workout_items)} workouts (filters: {filters_applied})")

        return JSONResponse(
            content=response.model_dump(),
            headers={
                "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
        )

    except FileNotFoundError as e:
        logger.error(f"Workout library not found: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Workout library not found", "details": str(e)},
        )
    except Exception as e:
        logger.error(f"Error loading workout library: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to load workout library", "details": str(e)},
        )


@router.get("/{workout_id}")
async def get_workout(workout_id: str) -> JSONResponse:
    """
    Get a specific workout by ID.

    This is a public endpoint - no authentication required.
    """
    try:
        loader = WorkoutLibraryLoader()
        library = loader.get_library()

        # Find workout by ID
        workout = next((w for w in library.workouts if w.id == workout_id), None)

        if workout is None:
            return JSONResponse(
                status_code=404,
                content={"error": "Workout not found", "details": f"No workout with id '{workout_id}'"},
            )

        return JSONResponse(content=_workout_to_item(workout).model_dump())

    except Exception as e:
        logger.error(f"Error fetching workout {workout_id}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch workout", "details": str(e)},
        )
