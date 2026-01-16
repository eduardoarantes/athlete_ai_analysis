from dataclasses import dataclass
from typing import List, Optional

@dataclass(frozen=True)
class StreamPoint:
    time_offset: int  # Seconds from start
    power: float

@dataclass(frozen=True)
class WorkoutStep:
    name: str
    duration: int  # Seconds
    target_power: float
    intensity_class: str

@dataclass
class ComplianceResult:
    step_name: str
    planned_duration: int
    actual_duration: int
    target_power: float
    actual_power_avg: float
    compliance_pct: float
    intensity_class: Optional[str] = None
