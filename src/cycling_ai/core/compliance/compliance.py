from typing import List, Optional, Protocol, Set

import numpy as np


class ComplianceScorer(Protocol):
    def score(
        self,
        segment: List[float],
        target_power: float,
        planned_duration: int,
        intensity_class: Optional[str],
    ) -> float:
        ...


class LegacyComplianceScorer:
    def score(
        self,
        segment: List[float],
        target_power: float,
        planned_duration: int,
        intensity_class: Optional[str],
    ) -> float:
        if not segment:
            return 0.0
        avg_power = float(np.mean(segment))
        if target_power <= 0:
            return 0.0
        return (avg_power / target_power) * 100.0


class BoundedComplianceScorer:
    def __init__(
        self,
        tolerance: float = 0.05,
        allow_below_for: Optional[Set[str]] = None,
    ):
        self.tolerance = tolerance
        self.allow_below_for = {c.lower() for c in (allow_below_for or {"warmup", "cooldown"})}

    def score(
        self,
        segment: List[float],
        target_power: float,
        planned_duration: int,
        intensity_class: Optional[str],
    ) -> float:
        if planned_duration <= 0 or not segment:
            return 0.0

        actual_duration = len(segment)
        duration_ratio = actual_duration / planned_duration
        duration_score = max(0.0, 1.0 - abs(duration_ratio - 1.0))

        nonzero = sum(1 for v in segment if v > 0)
        nonzero_ratio = nonzero / planned_duration

        avg_power = float(np.mean(segment))
        if target_power <= 0:
            power_score = 1.0 if avg_power <= 0 else 0.0
        else:
            class_key = (intensity_class or "").lower()
            ceiling = target_power * (1.0 + self.tolerance)
            floor = target_power * (1.0 - self.tolerance)
            if class_key in self.allow_below_for:
                if avg_power <= ceiling:
                    power_score = 1.0
                else:
                    power_score = max(0.0, 1.0 - (avg_power - ceiling) / target_power)
            else:
                if floor <= avg_power <= ceiling:
                    power_score = 1.0
                elif avg_power < floor:
                    power_score = max(0.0, 1.0 - (floor - avg_power) / target_power)
                else:
                    power_score = max(0.0, 1.0 - (avg_power - ceiling) / target_power)

        compliance = 100.0 * duration_score * nonzero_ratio * power_score
        return min(100.0, compliance)
