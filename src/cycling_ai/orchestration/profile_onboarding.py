"""
Profile onboarding management for conversational profile creation.

This module provides the core infrastructure for guided profile creation through
a conversational interface. It manages the onboarding state machine, stores
partial profile data, and provides validation for all profile fields.

Key Components:
- OnboardingState: Enum defining the 8 onboarding states
- PartialProfile: Dataclass storing in-progress profile data
- ProfileOnboardingManager: Orchestrates the onboarding flow
- Validation helpers: Pure functions for field validation
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class OnboardingState(Enum):
    """
    Profile onboarding state machine states.

    State transitions:
    NOT_STARTED → COLLECTING_CORE → COLLECTING_OPTIONAL → REVIEWING →
    CONFIRMED → ESTIMATING_VALUES → FINALIZING → COMPLETED

    States:
        NOT_STARTED: Initial state before onboarding begins
        COLLECTING_CORE: Collecting 9 required core fields
        COLLECTING_OPTIONAL: Collecting optional enrichment fields
        REVIEWING: User reviewing complete profile summary
        CONFIRMED: User confirmed profile is correct
        ESTIMATING_VALUES: Estimating FTP/Max HR if needed
        FINALIZING: Saving profile to disk
        COMPLETED: Onboarding successfully finished
    """

    NOT_STARTED = "not_started"
    COLLECTING_CORE = "collecting_core"
    COLLECTING_OPTIONAL = "collecting_optional"
    REVIEWING = "reviewing"
    CONFIRMED = "confirmed"
    ESTIMATING_VALUES = "estimating_values"
    FINALIZING = "finalizing"
    COMPLETED = "completed"


@dataclass
class PartialProfile:
    """
    Stores in-progress profile data during onboarding.

    This dataclass holds all profile fields with Optional types to support
    incremental collection. It tracks 9 core required fields and 3 optional
    enrichment fields.

    Core Required Fields (9):
        name: Athlete's name for personalization
        age: Age in years (18-100)
        gender: Male, Female, or Other
        weight_kg: Body weight in kilograms (40-200)
        ftp: Functional Threshold Power in watts (50-600)
        max_hr: Maximum heart rate in bpm (100-220)
        training_experience: beginner, intermediate, or advanced
        training_availability_hours_per_week: Training time available (1-40)
        goals: List of training goals (at least 1 required)

    Optional Enrichment Fields (3):
        target_event: Upcoming event details (name, date, distance)
        previous_cycling_history: Background and experience
        limitations: Injuries or constraints to consider
    """

    # Core required fields (9 total)
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    weight_kg: float | None = None
    ftp: int | None = None
    max_hr: int | None = None
    training_experience: str | None = None
    training_availability_hours_per_week: float | None = None
    goals: list[str] = field(default_factory=list)

    # Optional enrichment fields (3 total)
    target_event: dict[str, Any] | None = None
    previous_cycling_history: str | None = None
    limitations: str | None = None

    def is_core_complete(self) -> bool:
        """
        Check if all core required fields are populated.

        Returns:
            True if all 9 core fields have non-None values, False otherwise.

        Examples:
            >>> profile = PartialProfile(name="Test")
            >>> profile.is_core_complete()
            False
            >>> # Fill all 9 core fields...
            >>> profile.is_core_complete()
            True
        """
        return all(
            [
                self.name is not None,
                self.age is not None,
                self.gender is not None,
                self.weight_kg is not None,
                self.ftp is not None,
                self.max_hr is not None,
                self.training_experience is not None,
                self.training_availability_hours_per_week is not None,
                len(self.goals) > 0,
            ]
        )

    def get_completion_percentage(self) -> float:
        """
        Calculate profile completion percentage based on core fields.

        Only core fields count toward completion. Optional fields do not
        affect the percentage.

        Returns:
            Float between 0.0 (empty) and 1.0 (all core fields complete).

        Examples:
            >>> profile = PartialProfile()
            >>> profile.get_completion_percentage()
            0.0
            >>> profile.name = "Test"
            >>> profile.age = 35
            >>> profile.get_completion_percentage()
            0.222...  # 2 of 9 fields
        """
        total_core_fields = 9
        completed_fields = sum(
            [
                self.name is not None,
                self.age is not None,
                self.gender is not None,
                self.weight_kg is not None,
                self.ftp is not None,
                self.max_hr is not None,
                self.training_experience is not None,
                self.training_availability_hours_per_week is not None,
                len(self.goals) > 0,
            ]
        )
        return completed_fields / total_core_fields

    def to_dict(self) -> dict[str, Any]:
        """
        Convert profile to JSON-serializable dictionary.

        Only includes optional fields if they have non-None values.
        All core fields are always included.

        Returns:
            Dictionary representation suitable for JSON serialization.

        Examples:
            >>> profile = PartialProfile(name="Test", age=35)
            >>> data = profile.to_dict()
            >>> data['name']
            'Test'
            >>> data['age']
            35
        """
        result: dict[str, Any] = {
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "weight_kg": self.weight_kg,
            "ftp": self.ftp,
            "max_hr": self.max_hr,
            "training_experience": self.training_experience,
            "training_availability_hours_per_week": self.training_availability_hours_per_week,
            "goals": self.goals,
        }

        # Add optional fields only if present
        if self.target_event is not None:
            result["target_event"] = self.target_event
        if self.previous_cycling_history is not None:
            result["previous_cycling_history"] = self.previous_cycling_history
        if self.limitations is not None:
            result["limitations"] = self.limitations

        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PartialProfile:
        """
        Create PartialProfile from dictionary.

        Args:
            data: Dictionary containing profile fields

        Returns:
            PartialProfile instance with fields populated from dictionary.

        Examples:
            >>> data = {"name": "Test", "age": 35, "goals": ["Race"]}
            >>> profile = PartialProfile.from_dict(data)
            >>> profile.name
            'Test'
        """
        return cls(
            name=data.get("name"),
            age=data.get("age"),
            gender=data.get("gender"),
            weight_kg=data.get("weight_kg"),
            ftp=data.get("ftp"),
            max_hr=data.get("max_hr"),
            training_experience=data.get("training_experience"),
            training_availability_hours_per_week=data.get("training_availability_hours_per_week"),
            goals=data.get("goals", []),
            target_event=data.get("target_event"),
            previous_cycling_history=data.get("previous_cycling_history"),
            limitations=data.get("limitations"),
        )


def validate_age(age: int) -> tuple[bool, str]:
    """
    Validate age is within acceptable range.

    Args:
        age: Age in years

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_age(35)
        (True, '')
        >>> validate_age(17)
        (False, 'Age must be at least 18')
    """
    if not isinstance(age, int):
        return False, "Age must be a whole number"
    if age < 18:
        return False, "Age must be at least 18"
    if age > 100:
        return False, "Age must be 100 or less"
    return True, ""


def validate_weight(weight_kg: float) -> tuple[bool, str]:
    """
    Validate weight is within acceptable range.

    Args:
        weight_kg: Weight in kilograms

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_weight(70.0)
        (True, '')
        >>> validate_weight(30.0)
        (False, 'Weight must be between 40 and 200 kg')
    """
    if not isinstance(weight_kg, (int, float)):
        return False, "Weight must be a number"
    if weight_kg < 40.0:
        return False, "Weight must be between 40 and 200 kg"
    if weight_kg > 200.0:
        return False, "Weight must be between 40 and 200 kg"
    return True, ""


def validate_ftp(ftp: int) -> tuple[bool, str]:
    """
    Validate FTP (Functional Threshold Power) is within acceptable range.

    Args:
        ftp: FTP in watts

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_ftp(250)
        (True, '')
        >>> validate_ftp(30)
        (False, 'FTP must be between 50 and 600 watts')
    """
    if not isinstance(ftp, int):
        return False, "FTP must be a whole number"
    if ftp < 50:
        return False, "FTP must be between 50 and 600 watts"
    if ftp > 600:
        return False, "FTP must be between 50 and 600 watts"
    return True, ""


def validate_max_hr(max_hr: int) -> tuple[bool, str]:
    """
    Validate maximum heart rate is within acceptable range.

    Args:
        max_hr: Maximum heart rate in beats per minute

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_max_hr(185)
        (True, '')
        >>> validate_max_hr(90)
        (False, 'Maximum heart rate must be between 100 and 220 bpm')
    """
    if not isinstance(max_hr, int):
        return False, "Maximum heart rate must be a whole number"
    if max_hr < 100:
        return False, "Maximum heart rate must be between 100 and 220 bpm"
    if max_hr > 220:
        return False, "Maximum heart rate must be between 100 and 220 bpm"
    return True, ""


def validate_training_availability(hours: float) -> tuple[bool, str]:
    """
    Validate training availability hours per week.

    Args:
        hours: Training availability in hours per week

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_training_availability(8.0)
        (True, '')
        >>> validate_training_availability(0.5)
        (False, 'Training availability must be between 1 and 40 hours per week')
    """
    if not isinstance(hours, (int, float)):
        return False, "Training availability must be a number"
    if hours < 1.0:
        return False, "Training availability must be between 1 and 40 hours per week"
    if hours > 40.0:
        return False, "Training availability must be between 1 and 40 hours per week"
    return True, ""


@dataclass
class ProfileOnboardingManager:
    """
    Manages profile onboarding state machine and flow.

    Orchestrates the conversational profile creation process by managing
    the state machine, tracking partial profile data, and providing prompts
    for each onboarding phase.

    The onboarding flow follows this state sequence:
    NOT_STARTED → COLLECTING_CORE → COLLECTING_OPTIONAL → REVIEWING →
    CONFIRMED → ESTIMATING_VALUES → FINALIZING → COMPLETED

    Attributes:
        state: Current onboarding state
        partial_profile: In-progress profile data

    Example:
        >>> manager = ProfileOnboardingManager()
        >>> prompt = manager.start_onboarding()
        >>> # User provides data via tools...
        >>> if manager.partial_profile.is_core_complete():
        ...     optional_prompt = manager.advance_to_optional()
    """

    state: OnboardingState = OnboardingState.NOT_STARTED
    partial_profile: PartialProfile = field(default_factory=PartialProfile)

    def start_onboarding(self) -> str:
        """
        Start profile onboarding flow.

        Transitions state to COLLECTING_CORE and returns the initial prompt
        for collecting core profile fields.

        Returns:
            Initial prompt text for core field collection

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> prompt = manager.start_onboarding()
            >>> assert manager.state == OnboardingState.COLLECTING_CORE
            >>> assert "name" in prompt.lower()
        """
        self.state = OnboardingState.COLLECTING_CORE
        return self._get_collecting_core_prompt()

    def should_continue_onboarding(self) -> bool:
        """
        Check if onboarding should continue.

        Returns False if state is NOT_STARTED or COMPLETED,
        True for all intermediate states.

        Returns:
            True if onboarding is in progress, False otherwise

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> manager.should_continue_onboarding()
            False
            >>> manager.start_onboarding()
            >>> manager.should_continue_onboarding()
            True
        """
        return self.state not in [
            OnboardingState.NOT_STARTED,
            OnboardingState.COMPLETED,
        ]

    def advance_to_optional(self) -> str:
        """
        Advance to optional fields collection phase.

        Should be called after all core fields are complete.
        Transitions state to COLLECTING_OPTIONAL.

        Returns:
            Prompt text for optional field collection

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> manager.start_onboarding()
            >>> # Fill core fields...
            >>> prompt = manager.advance_to_optional()
            >>> assert manager.state == OnboardingState.COLLECTING_OPTIONAL
        """
        self.state = OnboardingState.COLLECTING_OPTIONAL
        return self._get_collecting_optional_prompt()

    def advance_to_review(self) -> str:
        """
        Advance to profile review phase.

        Generates human-readable summary of profile and asks user to confirm.
        Transitions state to REVIEWING.

        Returns:
            Prompt text with profile summary and confirmation request

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> # Complete onboarding...
            >>> prompt = manager.advance_to_review()
            >>> assert manager.state == OnboardingState.REVIEWING
            >>> assert manager.partial_profile.name in prompt
        """
        self.state = OnboardingState.REVIEWING
        summary = self._generate_profile_summary()
        return f"""Perfect! Here's your profile summary:

{summary}

Does everything look correct? (yes/no)
If you'd like to change anything, just let me know which field."""

    def confirm_profile(self) -> None:
        """
        Mark profile as confirmed by user.

        Transitions state to CONFIRMED. Call this after user confirms
        the profile summary is correct.

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> # Complete review...
            >>> manager.confirm_profile()
            >>> assert manager.state == OnboardingState.CONFIRMED
        """
        self.state = OnboardingState.CONFIRMED

    def advance_to_estimating(self) -> str:
        """
        Advance to value estimation phase.

        Used when FTP or Max HR need to be estimated. Transitions state
        to ESTIMATING_VALUES.

        Returns:
            Prompt text for estimation phase

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> prompt = manager.advance_to_estimating()
            >>> assert manager.state == OnboardingState.ESTIMATING_VALUES
        """
        self.state = OnboardingState.ESTIMATING_VALUES
        return "Let's estimate any missing values (FTP or Max HR) now."

    def advance_to_finalizing(self) -> str:
        """
        Advance to profile finalization phase.

        Prepares to save profile to disk. Transitions state to FINALIZING.

        Returns:
            Prompt text for finalization

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> prompt = manager.advance_to_finalizing()
            >>> assert manager.state == OnboardingState.FINALIZING
        """
        self.state = OnboardingState.FINALIZING
        return "Finalizing your profile..."

    def mark_completed(self) -> None:
        """
        Mark onboarding as completed.

        Transitions state to COMPLETED. Call this after profile is
        successfully saved to disk.

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> manager.mark_completed()
            >>> assert manager.state == OnboardingState.COMPLETED
        """
        self.state = OnboardingState.COMPLETED

    def get_completion_percentage(self) -> float:
        """
        Get current profile completion percentage.

        Delegates to PartialProfile.get_completion_percentage().

        Returns:
            Float between 0.0 (empty) and 1.0 (complete)

        Example:
            >>> manager = ProfileOnboardingManager()
            >>> manager.get_completion_percentage()
            0.0
            >>> manager.partial_profile.name = "Test"
            >>> manager.get_completion_percentage()
            0.111...
        """
        return self.partial_profile.get_completion_percentage()

    def _get_collecting_core_prompt(self) -> str:
        """
        Get prompt for collecting core profile fields.

        Returns:
            Multi-line prompt text explaining core fields and usage
        """
        return """Welcome! Let's create your athlete profile together.

I'll need to collect some core information to provide personalized training insights.
This should only take a few minutes.

**Required Information (9 fields):**

1. **Name** - What's your name?

2. **Age** - How old are you? (18-100)

3. **Gender** - Male, Female, or Other

4. **Weight** - What's your weight in kilograms? (40-200 kg)

5. **FTP (Functional Threshold Power)** - This is the maximum power you can sustain
   for about an hour, measured in watts (50-600W). If you don't know your FTP,
   I can help estimate it.

6. **Maximum Heart Rate** - Your max heart rate in beats per minute (100-220 bpm).
   If you don't know it, I can estimate this too.

7. **Training Experience** - How would you describe your cycling experience?
   (beginner, intermediate, or advanced)

8. **Training Availability** - How many hours per week can you dedicate to training? (1-40)

9. **Goals** - What are your cycling goals? (e.g., "Improve FTP", "Complete a century ride",
   "Lose weight", "Race competitively")

**How this works:**
- Answer in any order - I'll track your progress
- You can provide multiple pieces of information at once
- I'll save your answers as we go
- If you're unsure about FTP or Max HR, just let me know and I'll help estimate them

Let's start! What's your name?"""

    def _get_collecting_optional_prompt(self) -> str:
        """
        Get prompt for collecting optional profile fields.

        Returns:
            Multi-line prompt text explaining optional fields
        """
        return """Great! All core information is complete.

Now, let's collect some optional information that will help me provide even better
recommendations. Feel free to skip anything you're not comfortable sharing.

**Optional Information:**

1. **Target Event** (optional) - Do you have a specific event you're training for?
   If so, what's the event name, date, and distance?

2. **Previous Cycling History** (optional) - Any relevant background or experience
   I should know about?

3. **Limitations** (optional) - Any injuries, health considerations, or time constraints
   I should keep in mind when making recommendations?

You can answer these now, or just say "skip" to move on to the review."""

    def _generate_profile_summary(self) -> str:
        """
        Generate human-readable profile summary.

        Formats all populated profile fields into a clean, readable summary.

        Returns:
            Multi-line string with formatted profile data
        """
        p = self.partial_profile
        lines = [
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"Name: {p.name}",
            f"Age: {p.age} years",
            f"Gender: {p.gender}",
            f"Weight: {p.weight_kg} kg",
            f"FTP: {p.ftp}W",
            f"Max HR: {p.max_hr} bpm",
            f"Training Experience: {p.training_experience}",
            f"Training Availability: {p.training_availability_hours_per_week} hours/week",
            f"Goals: {', '.join(p.goals)}",
        ]

        # Add optional fields if present
        if p.target_event:
            event_name = p.target_event.get("name", "Unknown Event")
            event_date = p.target_event.get("date", "")
            event_distance = p.target_event.get("distance_km", "")
            lines.append(f"\nTarget Event: {event_name}")
            if event_date:
                lines.append(f"  Date: {event_date}")
            if event_distance:
                lines.append(f"  Distance: {event_distance} km")

        if p.previous_cycling_history:
            lines.append(f"\nCycling History: {p.previous_cycling_history}")

        if p.limitations:
            lines.append(f"\nLimitations: {p.limitations}")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        return "\n".join(lines)
