# Profile Onboarding Architecture Plan

**Document Version:** 1.0
**Created:** 2025-11-07
**Status:** Design Complete - Ready for Implementation
**Estimated Effort:** 5 weeks

---

## Executive Summary

This document outlines the architecture for enhancing the cycling-ai chat experience with intelligent profile onboarding. The solution uses a **tool-based approach** where specialized LLM-callable tools guide users through profile creation in a natural, conversational manner.

### Key Features
- ✅ Conversational profile collection via LLM agent
- ✅ Progressive disclosure (core fields → optional → confirmation)
- ✅ Smart FTP and Max HR estimation
- ✅ Type-safe validation at every step
- ✅ Resume capability if interrupted
- ✅ Zero breaking changes to existing functionality

---

## Table of Contents

1. [Requirements](#requirements)
2. [Architecture Design](#architecture-design)
3. [Component Specifications](#component-specifications)
4. [Data Flow](#data-flow)
5. [Implementation Strategy](#implementation-strategy)
6. [Testing Strategy](#testing-strategy)
7. [Risk Assessment](#risk-assessment)
8. [Implementation Timeline](#implementation-timeline)
9. [Appendices](#appendices)

---

## Requirements

### Functional Requirements

**FR1: Profile Detection**
- System must detect if athlete profile exists on chat startup
- Path: `data/{Athlete_Name}/athlete_profile.json`

**FR2: Interactive Profile Collection**
- Collect required fields: name, age, gender, weight, FTP, max HR, training experience, availability, goals
- Collect optional fields: target event, cycling history, limitations
- Natural language interaction (any order, conversational)

**FR3: Validation & Estimation**
- Real-time validation with user-friendly error messages
- FTP estimation: 20-min test, weight-based, ramp test methods
- Max HR estimation: Age-based formula (220 - age)

**FR4: Profile Storage**
- Save to JSON at: `data/{Athlete_Name}/athlete_profile.json`
- Do NOT include `raw_training_data_path` field (added later)

**FR5: Resume Capability**
- Store partial profile in session state
- Resume from interruption without losing data

**FR6: Workflow Transition**
- After profile creation, transition to data upload/analysis
- Integrate with existing `cycling-ai generate` workflow

### Non-Functional Requirements

**NFR1: Type Safety**
- 100% `mypy --strict` compliance
- Type hints on all functions and classes

**NFR2: Test Coverage**
- Unit tests: 90%+ for validation and tools
- Integration tests: 85%+ for onboarding manager
- E2E tests: Optional with real LLM

**NFR3: Performance**
- Profile creation: < 10 LLM API calls
- Time to complete: < 5 minutes
- Session state: < 50KB

**NFR4: User Experience**
- Completion rate: 90%+
- Clear progress indicators
- Graceful error handling

**NFR5: Maintainability**
- Follow existing project patterns
- Clear separation of concerns
- Comprehensive documentation

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   CLI Entry Point                            │
│              cycling-ai chat [--profile]                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Profile      │ NO
                  │ Exists?      ├───────┐
                  └──────┬───────┘       │
                         │ YES           ▼
                         │        ┌─────────────────────┐
                         │        │ ProfileOnboarding   │
                         │        │ Manager             │
                         │        │ (State Machine)     │
                         │        └──────────┬──────────┘
                         │                   │
                         │                   ▼
                         │        ┌─────────────────────┐
                         │        │ LLM Agent Loop      │
                         │        │ + Profile Tools     │
                         │        └──────────┬──────────┘
                         │                   │
                         │                   ▼
                         │        ┌─────────────────────┐
                         │        │ 4 Profile Tools:    │
                         │        │ • update_field      │
                         │        │ • estimate_ftp      │
                         │        │ • estimate_max_hr   │
                         │        │ • finalize_profile  │
                         │        └──────────┬──────────┘
                         │                   │
                         │                   ▼
                         │        ┌─────────────────────┐
                         │        │ Save Profile JSON   │
                         │        └──────────┬──────────┘
                         │                   │
                         └───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │ Normal Chat Session      │
                    │ (Performance Analysis)   │
                    └──────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     New Components                           │
│                                                              │
│  ProfileOnboardingManager                                    │
│  ├── state_machine: OnboardingState                         │
│  ├── partial_profile: PartialProfile                        │
│  ├── validation: FieldValidator                             │
│  └── methods:                                               │
│      ├── start_onboarding()                                 │
│      ├── get_onboarding_prompt()                            │
│      ├── should_continue()                                  │
│      └── get_completion_percentage()                        │
│                                                              │
│  4 Profile Tools                                            │
│  ├── UpdateProfileFieldTool                                 │
│  ├── EstimateFTPTool                                        │
│  ├── EstimateMaxHRTool                                      │
│  └── FinalizeProfileTool                                    │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Modified: chat.py  │      │ Modified: executor.py│
│  + Profile detection│      │ + Session context    │
│  + Onboarding mode  │      │   injection          │
└─────────────────────┘      └─────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Existing Components (Unchanged)                 │
│  • ConversationSession                                       │
│  • LLMAgent                                                  │
│  • ToolExecutor                                              │
│  • ToolRegistry                                              │
│  • BaseProvider (Anthropic, OpenAI, Gemini, Ollama)         │
└─────────────────────────────────────────────────────────────┘
```

### State Machine

```
┌──────────────┐
│ NOT_STARTED  │
└──────┬───────┘
       │ start_onboarding()
       ▼
┌──────────────────┐
│ COLLECTING_CORE  │ ──────► Core fields (9 required)
└──────┬───────────┘         name, age, gender, weight, ftp,
       │                     max_hr, experience, availability, goals
       │ core_complete()
       ▼
┌────────────────────────┐
│ COLLECTING_OPTIONAL    │ ──────► Optional fields
└──────┬─────────────────┘         target_event, history, limitations
       │
       │ user_confirms_done()
       ▼
┌──────────────┐
│  REVIEWING   │ ──────► Show summary, ask for confirmation
└──────┬───────┘
       │
       │ user_confirms()
       ▼
┌──────────────┐
│  CONFIRMED   │
└──────┬───────┘
       │
       │ needs_estimation()
       ▼
┌────────────────────┐
│ ESTIMATING_VALUES  │ ──────► FTP/MaxHR estimation if needed
└──────┬─────────────┘
       │
       │ estimation_complete()
       ▼
┌──────────────┐
│  FINALIZING  │ ──────► Save JSON file
└──────┬───────┘
       │
       │ save_success()
       ▼
┌──────────────┐
│  COMPLETED   │
└──────────────┘
```

**State Transitions:**
- All states stored in session context for resume capability
- Each state has entry/exit conditions
- Validation gates prevent premature transitions
- Error states handled with retry logic

---

## Component Specifications

### 1. ProfileOnboardingManager

**Location:** `src/cycling_ai/orchestration/profile_onboarding.py`

**Purpose:** Orchestrates the profile collection flow using state machine pattern.

**Class Definition:**

```python
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional

class OnboardingState(Enum):
    """Profile onboarding states."""
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
    """Stores in-progress profile data."""

    # Core required fields
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    ftp: Optional[int] = None
    max_hr: Optional[int] = None
    training_experience: Optional[str] = None
    training_availability_hours_per_week: Optional[float] = None
    goals: list[str] = field(default_factory=list)

    # Optional fields
    target_event: Optional[dict[str, Any]] = None
    previous_cycling_history: Optional[str] = None
    limitations: Optional[str] = None

    def is_core_complete(self) -> bool:
        """Check if all core fields are populated."""
        return all([
            self.name,
            self.age is not None,
            self.gender,
            self.weight_kg is not None,
            self.ftp is not None,
            self.max_hr is not None,
            self.training_experience,
            self.training_availability_hours_per_week is not None,
            len(self.goals) > 0,
        ])

    def get_completion_percentage(self) -> float:
        """Calculate completion percentage (0.0 to 1.0)."""
        total_fields = 9  # Core fields only
        completed = sum([
            self.name is not None,
            self.age is not None,
            self.gender is not None,
            self.weight_kg is not None,
            self.ftp is not None,
            self.max_hr is not None,
            self.training_experience is not None,
            self.training_availability_hours_per_week is not None,
            len(self.goals) > 0,
        ])
        return completed / total_fields

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "weight_kg": self.weight_kg,
            "ftp": self.ftp,
            "max_hr": self.max_hr,
            "training_experience": self.training_experience,
            "training_availability_hours_per_week":
                self.training_availability_hours_per_week,
            "goals": self.goals,
        }

        # Add optional fields if present
        if self.target_event:
            result["target_event"] = self.target_event
        if self.previous_cycling_history:
            result["previous_cycling_history"] = self.previous_cycling_history
        if self.limitations:
            result["limitations"] = self.limitations

        return result


@dataclass
class ProfileOnboardingManager:
    """Manages profile onboarding state and flow."""

    state: OnboardingState = OnboardingState.NOT_STARTED
    partial_profile: PartialProfile = field(default_factory=PartialProfile)

    def start_onboarding(self) -> str:
        """Start onboarding and return initial prompt."""
        self.state = OnboardingState.COLLECTING_CORE
        return self._get_collecting_core_prompt()

    def _get_collecting_core_prompt(self) -> str:
        """Get prompt for collecting core profile fields."""
        return """You are helping a cyclist create their athlete profile.

Your goal is to collect these REQUIRED fields naturally and conversationally:
1. Name (string) - for personalization
2. Age (number, 18-100) - in years
3. Gender (string) - Male/Female/Other
4. Weight (number, 40-200) - in kg
5. FTP (number, 50-600) - Functional Threshold Power in watts
   - If unknown, offer to estimate using the estimate_ftp tool
6. Max Heart Rate (number, 100-220) - in bpm
   - If unknown, offer to estimate using the estimate_max_hr tool
7. Training Experience (string) - beginner/intermediate/advanced
8. Training Availability (number, 1-40) - hours per week
9. Goals (list of strings) - e.g., "Improve FTP", "Lose weight", "Complete century"

Use the update_profile_field tool after each answer to save progress.

Be conversational and friendly. Ask one question at a time. If the user provides
multiple pieces of information at once, extract and save all of them.

Start by warmly greeting them and asking for their name.
"""

    def should_continue_onboarding(self) -> bool:
        """Check if onboarding should continue."""
        return self.state not in [
            OnboardingState.COMPLETED,
            OnboardingState.NOT_STARTED,
        ]

    def advance_to_optional(self) -> str:
        """Advance to optional fields collection."""
        self.state = OnboardingState.COLLECTING_OPTIONAL
        return """Great! All required fields are complete. Now let's collect some
optional information that will help me provide better training recommendations.

Optional fields:
1. Target Event - If you have a specific event in mind (name, date, distance)
2. Previous Cycling History - Any relevant background
3. Limitations - Injuries or other factors I should know about

These are optional - feel free to skip any you don't want to provide.
Do you have a target event coming up?
"""

    def advance_to_review(self) -> str:
        """Advance to review state."""
        self.state = OnboardingState.REVIEWING
        profile_summary = self._generate_profile_summary()
        return f"""Perfect! Here's your profile summary:

{profile_summary}

Does everything look correct? (yes/no)
If you'd like to change anything, just let me know which field.
"""

    def _generate_profile_summary(self) -> str:
        """Generate human-readable profile summary."""
        p = self.partial_profile
        summary = f"""
Name: {p.name}
Age: {p.age}
Gender: {p.gender}
Weight: {p.weight_kg} kg
FTP: {p.ftp}W
Max HR: {p.max_hr} bpm
Training Experience: {p.training_experience}
Training Availability: {p.training_availability_hours_per_week} hours/week
Goals: {', '.join(p.goals)}
"""

        if p.target_event:
            summary += f"\nTarget Event: {p.target_event.get('name', 'N/A')}"
        if p.previous_cycling_history:
            summary += f"\nCycling History: {p.previous_cycling_history}"
        if p.limitations:
            summary += f"\nLimitations: {p.limitations}"

        return summary.strip()

    def get_completion_percentage(self) -> float:
        """Get current completion percentage."""
        return self.partial_profile.get_completion_percentage()
```

**Estimated Size:** ~350 LOC

---

### 2. Profile Creation Tools

**Location:** `src/cycling_ai/tools/wrappers/profile_creation_tools.py`

**Purpose:** Four specialized tools for profile creation, validation, and estimation.

#### Tool 1: UpdateProfileFieldTool

```python
from dataclasses import dataclass, field
from typing import Any, Optional
from cycling_ai.tools.base import BaseTool, ToolParameter, ToolExecutionResult


@dataclass
class UpdateProfileFieldTool(BaseTool):
    """Tool to update individual profile fields with validation."""

    name: str = "update_profile_field"
    description: str = """Update a field in the athlete profile being created.

Validates input and stores in session state. Use this after collecting each piece
of information from the user.
"""

    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="field_name",
            param_type="string",
            description=(
                "Field to update. Valid: name, age, gender, weight_kg, ftp, "
                "max_hr, training_experience, training_availability_hours_per_week, "
                "goals, target_event, previous_cycling_history, limitations"
            ),
            required=True,
        ),
        ToolParameter(
            name="value",
            param_type="any",
            description="Value to set for the field",
            required=True,
        ),
    ])

    def execute(
        self,
        field_name: str,
        value: Any,
        session_context: Optional[dict[str, Any]] = None,
    ) -> ToolExecutionResult:
        """Execute field update with validation."""
        try:
            # Validate field name
            valid_fields = {
                "name", "age", "gender", "weight_kg", "ftp", "max_hr",
                "training_experience", "training_availability_hours_per_week",
                "goals", "target_event", "previous_cycling_history", "limitations"
            }

            if field_name not in valid_fields:
                return ToolExecutionResult(
                    success=False,
                    error=f"Invalid field: {field_name}. Valid: {valid_fields}",
                )

            # Validate value based on field type
            validation_result = self._validate_field(field_name, value)
            if not validation_result["valid"]:
                return ToolExecutionResult(
                    success=False,
                    error=validation_result["error"],
                )

            # Update in session context
            if session_context is None:
                session_context = {}

            if "partial_profile" not in session_context:
                session_context["partial_profile"] = {}

            session_context["partial_profile"][field_name] = value

            return ToolExecutionResult(
                success=True,
                output=f"Updated {field_name} = {value}",
            )

        except Exception as e:
            return ToolExecutionResult(
                success=False,
                error=f"Failed to update field: {str(e)}",
            )

    def _validate_field(self, field_name: str, value: Any) -> dict[str, Any]:
        """Validate field value."""

        # Age validation
        if field_name == "age":
            if not isinstance(value, int) or value < 18 or value > 100:
                return {
                    "valid": False,
                    "error": "Age must be between 18 and 100"
                }

        # Weight validation
        elif field_name == "weight_kg":
            if not isinstance(value, (int, float)) or value < 40 or value > 200:
                return {
                    "valid": False,
                    "error": "Weight must be between 40 and 200 kg"
                }

        # FTP validation
        elif field_name == "ftp":
            if not isinstance(value, int) or value < 50 or value > 600:
                return {
                    "valid": False,
                    "error": "FTP must be between 50 and 600 watts"
                }

        # Max HR validation
        elif field_name == "max_hr":
            if not isinstance(value, int) or value < 100 or value > 220:
                return {
                    "valid": False,
                    "error": "Max HR must be between 100 and 220 bpm"
                }

        # Training availability validation
        elif field_name == "training_availability_hours_per_week":
            if not isinstance(value, (int, float)) or value < 1 or value > 40:
                return {
                    "valid": False,
                    "error": "Training availability must be between 1 and 40 hours/week"
                }

        # Training experience validation
        elif field_name == "training_experience":
            valid_levels = {"beginner", "intermediate", "advanced"}
            if value.lower() not in valid_levels:
                return {
                    "valid": False,
                    "error": f"Training experience must be one of: {valid_levels}"
                }

        # Gender validation
        elif field_name == "gender":
            valid_genders = {"male", "female", "other", "m", "f"}
            if value.lower() not in valid_genders:
                return {
                    "valid": False,
                    "error": "Gender must be Male, Female, or Other"
                }

        # Goals validation
        elif field_name == "goals":
            if not isinstance(value, list) or len(value) == 0:
                return {
                    "valid": False,
                    "error": "Goals must be a non-empty list of strings"
                }

        return {"valid": True}
```

#### Tool 2: EstimateFTPTool

```python
@dataclass
class EstimateFTPTool(BaseTool):
    """Tool to estimate FTP using various methods."""

    name: str = "estimate_ftp"
    description: str = """Estimate Functional Threshold Power (FTP) using one of three methods:
1. twenty_min_test - Based on 20-minute all-out power (FTP = 0.95 × 20min avg)
2. weight_based - Rough estimate from body weight (FTP = weight_kg × 2.5-3.5)
3. ramp_test - Based on ramp test max power (FTP = max_power × 0.75)
"""

    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="method",
            param_type="string",
            description=(
                "Estimation method: 'twenty_min_test', 'weight_based', or 'ramp_test'"
            ),
            required=True,
        ),
        ToolParameter(
            name="input_value",
            param_type="number",
            description=(
                "Input for estimation: 20-min avg power, weight in kg, "
                "or ramp test max power"
            ),
            required=True,
        ),
    ])

    def execute(
        self,
        method: str,
        input_value: float,
    ) -> ToolExecutionResult:
        """Execute FTP estimation."""
        try:
            if method == "twenty_min_test":
                estimated_ftp = int(input_value * 0.95)
                explanation = (
                    f"FTP estimated as 95% of 20-minute power: "
                    f"{input_value}W × 0.95 = {estimated_ftp}W"
                )

            elif method == "weight_based":
                # Conservative: 2.5 W/kg, Average: 3.0 W/kg, Strong: 3.5 W/kg
                low = int(input_value * 2.5)
                mid = int(input_value * 3.0)
                high = int(input_value * 3.5)
                estimated_ftp = mid
                explanation = (
                    f"FTP estimated from weight ({input_value}kg):\n"
                    f"Conservative: {low}W (2.5 W/kg)\n"
                    f"Average: {mid}W (3.0 W/kg)\n"
                    f"Strong: {high}W (3.5 W/kg)\n"
                    f"Using average: {estimated_ftp}W"
                )

            elif method == "ramp_test":
                estimated_ftp = int(input_value * 0.75)
                explanation = (
                    f"FTP estimated as 75% of ramp test max: "
                    f"{input_value}W × 0.75 = {estimated_ftp}W"
                )

            else:
                return ToolExecutionResult(
                    success=False,
                    error=(
                        f"Invalid method: {method}. "
                        f"Use: twenty_min_test, weight_based, or ramp_test"
                    ),
                )

            return ToolExecutionResult(
                success=True,
                output=f"{explanation}\n\nEstimated FTP: {estimated_ftp}W",
                data={"estimated_ftp": estimated_ftp, "method": method},
            )

        except Exception as e:
            return ToolExecutionResult(
                success=False,
                error=f"FTP estimation failed: {str(e)}",
            )
```

#### Tool 3: EstimateMaxHRTool

```python
@dataclass
class EstimateMaxHRTool(BaseTool):
    """Tool to estimate maximum heart rate."""

    name: str = "estimate_max_hr"
    description: str = """Estimate maximum heart rate using age-based formula.

Standard formula: 220 - age
Also provides range: (220 - age) ± 10 bpm
"""

    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="age",
            param_type="integer",
            description="Athlete's age in years",
            required=True,
        ),
    ])

    def execute(self, age: int) -> ToolExecutionResult:
        """Execute max HR estimation."""
        try:
            if age < 18 or age > 100:
                return ToolExecutionResult(
                    success=False,
                    error="Age must be between 18 and 100",
                )

            estimated_max_hr = 220 - age
            lower_bound = estimated_max_hr - 10
            upper_bound = estimated_max_hr + 10

            explanation = (
                f"Maximum heart rate estimated using formula: 220 - age\n"
                f"Estimated Max HR: {estimated_max_hr} bpm\n"
                f"Typical range: {lower_bound}-{upper_bound} bpm\n\n"
                f"Note: This is an estimate. Actual max HR can vary by ±10-15 bpm. "
                f"For accuracy, consider a field test or lab test."
            )

            return ToolExecutionResult(
                success=True,
                output=explanation,
                data={
                    "estimated_max_hr": estimated_max_hr,
                    "range": {"lower": lower_bound, "upper": upper_bound}
                },
            )

        except Exception as e:
            return ToolExecutionResult(
                success=False,
                error=f"Max HR estimation failed: {str(e)}",
            )
```

#### Tool 4: FinalizeProfileTool

```python
@dataclass
class FinalizeProfileTool(BaseTool):
    """Tool to validate and save complete profile to JSON."""

    name: str = "finalize_profile"
    description: str = """Validate complete profile and save to JSON file.

Creates directory structure and saves to:
data/{name}/athlete_profile.json
"""

    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="confirm",
            param_type="boolean",
            description="Confirmation that profile is ready to save",
            required=True,
        ),
    ])

    def execute(
        self,
        confirm: bool,
        session_context: Optional[dict[str, Any]] = None,
    ) -> ToolExecutionResult:
        """Execute profile finalization."""
        import json
        from pathlib import Path

        try:
            if not confirm:
                return ToolExecutionResult(
                    success=False,
                    error="Profile finalization not confirmed",
                )

            if session_context is None or "partial_profile" not in session_context:
                return ToolExecutionResult(
                    success=False,
                    error="No profile data found in session",
                )

            profile_data = session_context["partial_profile"]

            # Validate required fields
            required = [
                "name", "age", "gender", "weight_kg", "ftp", "max_hr",
                "training_experience", "training_availability_hours_per_week",
                "goals"
            ]

            missing = [f for f in required if f not in profile_data or profile_data[f] is None]
            if missing:
                return ToolExecutionResult(
                    success=False,
                    error=f"Missing required fields: {', '.join(missing)}",
                )

            # Create directory
            name = profile_data["name"]
            profile_dir = Path("data") / name
            profile_dir.mkdir(parents=True, exist_ok=True)

            # Save JSON
            profile_path = profile_dir / "athlete_profile.json"
            with open(profile_path, "w") as f:
                json.dump(profile_data, f, indent=2)

            return ToolExecutionResult(
                success=True,
                output=(
                    f"✅ Profile saved successfully!\n"
                    f"Location: {profile_path}\n\n"
                    f"You can now upload training data or start asking questions."
                ),
                data={"profile_path": str(profile_path)},
            )

        except Exception as e:
            return ToolExecutionResult(
                success=False,
                error=f"Failed to save profile: {str(e)}",
            )
```

**Estimated Size:** ~400 LOC total for 4 tools

---

## Data Flow

### End-to-End Flow Diagram

```
User: cycling-ai chat
         │
         ▼
┌────────────────────────┐
│ chat.py startup        │
│ • Load config          │
│ • Check profile exists │
└────────┬───────────────┘
         │
         ▼
      Profile exists?
         │
    NO   │   YES
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌──────────────┐
│OnBoard │  │ Normal Chat  │
│Manager │  │ Session      │
└───┬────┘  └──────────────┘
    │
    │ Start onboarding
    ▼
┌──────────────────────┐
│ Create Session with  │
│ ONBOARDING_PROMPT    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ LLM Agent Loop       │
│ • Ask questions      │
│ • Call tools         │
│ • Update state       │
└────────┬─────────────┘
         │
         ▼
    ┌────────────────┐
    │ Tools Execute  │
    │ • update_field │
    │ • estimate_*   │
    │ • finalize     │
    └────┬───────────┘
         │
         ▼
    Session Context Updated
    partial_profile: {...}
         │
         ▼
    Profile Complete?
         │
    YES  │   NO
    ┌────┴────┐
    │         │
    ▼         │
┌─────────┐  │
│Finalize │  │
│& Save   │  │
└───┬─────┘  │
    │        │
    ▼        │
JSON File  ◄─┘ Continue
Created       collecting
    │
    ▼
┌──────────────────────┐
│ Transition to        │
│ Normal Chat          │
└──────────────────────┘
```

### Session Context Structure

```json
{
  "onboarding_state": "collecting_core",
  "partial_profile": {
    "name": "Eduardo",
    "age": 35,
    "gender": "Male",
    "weight_kg": 70,
    "ftp": null,
    "max_hr": null,
    "training_experience": null,
    "training_availability_hours_per_week": null,
    "goals": []
  },
  "completion_percentage": 0.44
}
```

---

## Implementation Strategy

### Phase 1: Core Infrastructure (Week 1)

**Tasks:**
1. Create `profile_onboarding.py` with:
   - `OnboardingState` enum
   - `PartialProfile` dataclass
   - `ProfileOnboardingManager` class skeleton
   - State machine logic
   - Validation helpers

2. Write unit tests:
   - State transitions
   - Validation logic
   - Completion percentage calculation

**Deliverables:**
- ✅ `profile_onboarding.py` (~350 LOC)
- ✅ Unit tests (~200 LOC)
- ✅ 90%+ test coverage

**Acceptance Criteria:**
- All state transitions work correctly
- Validation catches invalid inputs
- `mypy --strict` passes

---

### Phase 2: Profile Tools (Week 2)

**Tasks:**
1. Create `profile_creation_tools.py` with 4 tools:
   - `UpdateProfileFieldTool`
   - `EstimateFTPTool`
   - `EstimateMaxHRTool`
   - `FinalizeProfileTool`

2. Implement validation for each field type
3. Write unit tests for each tool
4. Register tools with `ToolRegistry`

**Deliverables:**
- ✅ `profile_creation_tools.py` (~400 LOC)
- ✅ Tool unit tests (~300 LOC)
- ✅ 95%+ test coverage on tools

**Acceptance Criteria:**
- All tools execute without errors
- Validation works for all field types
- Tools are auto-discovered by registry
- `mypy --strict` passes

---

### Phase 3: Manager Integration (Week 3)

**Tasks:**
1. Integrate `ProfileOnboardingManager` with session system
2. Implement session context injection in `executor.py`
3. Write integration tests:
   - Full onboarding flow with mock LLM
   - State persistence across messages
   - Resume capability

4. Test with all 4 LLM providers (mock mode)

**Deliverables:**
- ✅ Modified `executor.py` (+10 LOC)
- ✅ Integration tests (~400 LOC)
- ✅ 85%+ coverage on manager integration

**Acceptance Criteria:**
- Full onboarding flow works end-to-end
- Session state persists correctly
- Resume works after interruption
- All providers support the flow

---

### Phase 4: CLI Integration (Week 4)

**Tasks:**
1. Modify `chat.py`:
   - Add profile detection on startup
   - Integrate `ProfileOnboardingManager`
   - Add onboarding mode
   - Transition to normal chat after completion

2. Add CLI flags:
   - `--skip-onboarding` - Skip even if no profile
   - `--force-onboarding` - Force even if profile exists

3. Write CLI integration tests

**Deliverables:**
- ✅ Modified `chat.py` (+150 LOC)
- ✅ CLI integration tests (~200 LOC)
- ✅ Updated CLI help text

**Acceptance Criteria:**
- Profile detection works correctly
- Onboarding launches automatically
- CLI flags work as expected
- Help text is clear and accurate

---

### Phase 5: Polish & Documentation (Week 5)

**Tasks:**
1. Add progress indicators (completion %)
2. Improve error messages
3. Add examples to prompts
4. Write end-to-end tests with real LLM (optional)
5. Update documentation:
   - Add onboarding section to README
   - Update CLAUDE.md
   - Add troubleshooting guide

6. Final testing with all providers
7. Performance testing (token usage, latency)

**Deliverables:**
- ✅ Polished UX
- ✅ E2E tests (~300 LOC, optional)
- ✅ Updated documentation
- ✅ Performance metrics report

**Acceptance Criteria:**
- User experience is smooth and intuitive
- All documentation is up-to-date
- E2E tests pass with real LLM
- Token usage < 10 requests per profile
- Time to complete < 5 minutes

---

## Testing Strategy

### Unit Tests (90%+ Coverage)

**Test Files:**
1. `tests/orchestration/test_profile_onboarding.py`
2. `tests/tools/test_profile_creation_tools.py`

**Test Cases:**

```python
# test_profile_onboarding.py
def test_state_transitions()
def test_partial_profile_validation()
def test_completion_percentage()
def test_profile_to_dict()
def test_start_onboarding()
def test_advance_to_optional()
def test_advance_to_review()
def test_generate_profile_summary()

# test_profile_creation_tools.py
def test_update_profile_field_valid()
def test_update_profile_field_invalid()
def test_update_profile_field_age_validation()
def test_update_profile_field_weight_validation()
def test_update_profile_field_ftp_validation()
def test_estimate_ftp_twenty_min()
def test_estimate_ftp_weight_based()
def test_estimate_ftp_ramp_test()
def test_estimate_ftp_invalid_method()
def test_estimate_max_hr_valid()
def test_estimate_max_hr_invalid_age()
def test_finalize_profile_success()
def test_finalize_profile_missing_fields()
def test_finalize_profile_no_session_context()
```

### Integration Tests (85%+ Coverage)

**Test File:** `tests/integration/test_profile_onboarding_flow.py`

**Test Cases:**

```python
def test_full_onboarding_flow_happy_path()
"""
Simulate complete onboarding with mock LLM:
1. Start onboarding
2. Collect all core fields
3. Collect optional fields
4. Review and confirm
5. Finalize and save
6. Verify JSON file created
"""

def test_onboarding_with_ftp_estimation()
"""Test flow when FTP needs estimation."""

def test_onboarding_with_max_hr_estimation()
"""Test flow when Max HR needs estimation."""

def test_onboarding_resume_after_interruption()
"""
Simulate interruption:
1. Start onboarding
2. Collect 5/9 fields
3. Session ends
4. Resume session
5. Continue from where left off
"""

def test_onboarding_field_correction()
"""
Test editing fields during review:
1. Complete onboarding
2. Review shows incorrect age
3. User corrects age
4. Finalize with corrected value
"""

def test_onboarding_with_all_providers()
"""Test onboarding works with Anthropic, OpenAI, Gemini, Ollama."""
```

### E2E Tests (Optional, Real LLM)

**Test File:** `tests/e2e/test_profile_onboarding_e2e.py`

**Test Cases:**

```python
@pytest.mark.integration
def test_real_onboarding_anthropic()
"""Test with real Anthropic Claude."""

@pytest.mark.integration
def test_real_onboarding_openai()
"""Test with real OpenAI GPT-4."""
```

---

## Risk Assessment

### Technical Risks

**Risk 1: LLM Tool Calling Reliability**
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:**
  - Test with all providers
  - Add retry logic for failed tool calls
  - Fallback to structured prompts if tool calling fails

**Risk 2: Session State Overflow**
- **Impact:** Medium
- **Likelihood:** Low
- **Mitigation:**
  - Limit onboarding to single session
  - Keep prompts concise
  - Use session context instead of conversation history

**Risk 3: Validation Edge Cases**
- **Impact:** Medium
- **Likelihood:** Medium
- **Mitigation:**
  - Comprehensive unit tests
  - User testing with edge cases
  - Clear error messages

**Risk 4: Type Safety Violations**
- **Impact:** High (project standard)
- **Likelihood:** Low
- **Mitigation:**
  - Run `mypy --strict` after every change
  - Type hints on all functions
  - CI/CD integration

### UX Risks

**Risk 5: User Drop-off**
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:**
  - Progressive disclosure (core first)
  - Progress indicators
  - Resume capability
  - Save after each field

**Risk 6: Confusing Conversation Flow**
- **Impact:** Medium
- **Likelihood:** Medium
- **Mitigation:**
  - Clear prompts with examples
  - Test with real users
  - Allow "I don't know" answers with estimation

**Risk 7: Over-prompting**
- **Impact:** Low
- **Likelihood:** Low
- **Mitigation:**
  - Allow multiple answers in one message
  - LLM extracts all provided info at once

### Data Quality Risks

**Risk 8: Invalid FTP Estimates**
- **Impact:** High (affects analysis quality)
- **Likelihood:** Medium
- **Mitigation:**
  - Multiple estimation methods
  - Clear explanation of accuracy
  - Allow manual override

**Risk 9: Missing Required Fields**
- **Impact:** High
- **Likelihood:** Low
- **Mitigation:**
  - Validation gate before finalization
  - Clear error messages
  - Track completion percentage

---

## Implementation Timeline

### Week 1: Core Infrastructure
- **Days 1-2:** Implement `ProfileOnboardingManager`
- **Days 3-4:** Write unit tests
- **Day 5:** Code review and refinement

### Week 2: Profile Tools
- **Days 1-2:** Implement 4 profile tools
- **Days 3-4:** Write tool unit tests
- **Day 5:** Integration with registry

### Week 3: Manager Integration
- **Days 1-2:** Integrate with session system
- **Days 3-4:** Write integration tests
- **Day 5:** Test with all providers

### Week 4: CLI Integration
- **Days 1-2:** Modify `chat.py`
- **Days 3-4:** CLI integration tests
- **Day 5:** Testing and bug fixes

### Week 5: Polish & Documentation
- **Days 1-2:** UX improvements
- **Days 3-4:** Documentation
- **Day 5:** Final testing and release

---

## Appendices

### Appendix A: Example Conversation Flow

```
$ cycling-ai chat

🚴 Welcome to Cycling AI Chat!

I notice you don't have an athlete profile yet. Let's create one together!
This will help me provide personalized training insights.

First, what's your name?

> Eduardo

Nice to meet you, Eduardo! How old are you?

> 35

Great! What's your gender? (Male/Female/Other)

> Male

What's your current weight in kilograms?

> 70

Perfect. Now, do you know your FTP (Functional Threshold Power in watts)?

> I'm not sure what that is

No problem! FTP is the maximum power you can sustain for about an hour.
I can help estimate it. Have you done any of these recently?

1. A 20-minute all-out time trial
2. A ramp test (increasing power until exhaustion)
3. Neither - I can estimate from your weight

Which option?

> 3

I'll estimate based on your weight. For a 70kg cyclist:
- Conservative: 175W (2.5 W/kg)
- Average: 210W (3.0 W/kg)
- Strong: 245W (3.5 W/kg)

Let's use 210W as a starting point. Does that seem reasonable?

> Yes, that sounds about right

Great! Now, do you know your maximum heart rate?

> Not exactly

I can estimate it using the formula: 220 - age
For you: 220 - 35 = 185 bpm
Typical range: 175-195 bpm

Sound good?

> Yes

How would you describe your training experience? (beginner/intermediate/advanced)

> Intermediate

How many hours per week can you typically dedicate to training?

> About 8 hours

What are your main cycling goals? (You can list multiple)

> Improve my FTP and maybe do a century ride this year

Excellent goals!

Now for some optional information (feel free to skip):

Do you have a specific target event in mind?

> Yes, there's a century ride in June called "Summer Challenge"

Great! When in June?

> June 15, 2025

Perfect. Any previous cycling history or experience I should know about?

> I've been cycling recreationally for 2 years, did a few 50-mile rides

Any injuries or limitations I should be aware of?

> Not really, all good

Excellent! Here's your profile summary:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: Eduardo
Age: 35
Gender: Male
Weight: 70 kg
FTP: 210W (estimated)
Max HR: 185 bpm (estimated)
Training Experience: Intermediate
Training Availability: 8 hours/week
Goals: Improve FTP, Complete century ride
Target Event: Summer Challenge (June 15, 2025, 100 miles)
Cycling History: Recreational for 2 years, completed 50-mile rides
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Does everything look correct?

> Yes, perfect!

✅ Profile saved successfully!
Location: data/Eduardo/athlete_profile.json

Now, would you like to:
1. Upload training data (CSV or FIT files)
2. Start asking questions about training
3. Generate a training plan for your century ride

What would you like to do?

> Let's generate a training plan!

[Transitions to normal chat mode with training plan generation...]
```

---

### Appendix B: Sample Athlete Profile JSON

```json
{
  "name": "Eduardo",
  "age": 35,
  "gender": "Male",
  "weight_kg": 70,
  "ftp": 210,
  "max_hr": 185,
  "training_experience": "intermediate",
  "training_availability_hours_per_week": 8,
  "goals": [
    "Improve FTP",
    "Complete century ride"
  ],
  "target_event": {
    "name": "Summer Challenge",
    "date": "2025-06-15",
    "distance_km": 160
  },
  "previous_cycling_history": "Recreational for 2 years, completed 50-mile rides",
  "limitations": null
}
```

**Note:** The `raw_training_data_path` field is NOT included in the profile created by onboarding. This is added later when the user uploads training data via the `cycling-ai generate` workflow.

---

## Summary

This architecture provides a robust, type-safe, and user-friendly solution for profile onboarding in the cycling-ai chat interface. Key strengths:

1. **Natural Conversation:** LLM-driven flow adapts to user input
2. **Progressive Disclosure:** Core fields first, optional later
3. **Smart Defaults:** FTP/MaxHR estimation when needed
4. **Resume Capability:** Session state enables interruption recovery
5. **Type Safety:** Full `mypy --strict` compliance
6. **Well Tested:** 85%+ coverage with unit and integration tests
7. **Zero Breaking Changes:** Existing `--profile` flag still works

The implementation follows all project standards and can be completed in 5 weeks using the phased approach outlined above.
