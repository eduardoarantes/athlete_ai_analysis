from typing import List, Optional

import numpy as np

from .aligners import Aligner
from .compliance import BoundedComplianceScorer, ComplianceScorer
from .models import ComplianceResult, StreamPoint, WorkoutStep
from .offsets import OffsetFinder, WeightedOffsetFinder, WindowedMSEOffsetFinder

class ComplianceAnalyzer:
    def __init__(
        self,
        ftp: float,
        offset_finder: Optional[OffsetFinder] = None,
        weighted_offset_finder: Optional[OffsetFinder] = None,
        compliance_scorer: Optional[ComplianceScorer] = None,
    ):
        self.ftp = ftp
        self._mse_finder = offset_finder or WindowedMSEOffsetFinder()
        self._weighted_finder = weighted_offset_finder or WeightedOffsetFinder()
        self._compliance_scorer = compliance_scorer or BoundedComplianceScorer()

    def calculate_best_offset(self, planned: List[float], actual: List[float]) -> int:
        """Finds the temporal offset that minimizes MSE between planned and actual."""
        return self._mse_finder.find_offset(planned, actual)

    def calculate_best_offset_weighted(self, planned: List[float], actual: List[float]) -> int:
        """Aligns using a weighted error focused on higher-variance planned sections."""
        return self._weighted_finder.find_offset(planned, actual)

    def analyze(self, steps: List[WorkoutStep], streams: List[StreamPoint]) -> List[ComplianceResult]:
        actual_power = [p.power for p in streams]
        planned_power = self._expand_steps_to_seconds(steps)
        
        offset = self.calculate_best_offset(planned_power, actual_power)
        return self.analyze_with_offset(steps, streams, offset)

    def analyze_with_finder(
        self,
        steps: List[WorkoutStep],
        streams: List[StreamPoint],
        offset_finder: OffsetFinder,
    ) -> List[ComplianceResult]:
        actual_power = [p.power for p in streams]
        planned_power = self._expand_steps_to_seconds(steps)
        offset = offset_finder.find_offset(planned_power, actual_power)
        return self.analyze_with_offset(steps, streams, offset)

    def analyze_with_aligner(
        self,
        steps: List[WorkoutStep],
        streams: List[StreamPoint],
        aligner: Aligner,
    ) -> List[ComplianceResult]:
        actual_power = [p.power for p in streams]
        planned_power = self._expand_steps_to_seconds(steps)
        aligned_actual = aligner.align(planned_power, actual_power)
        return self.analyze_with_aligned_series(steps, aligned_actual)

    def analyze_with_aligned_series(
        self,
        steps: List[WorkoutStep],
        aligned_actual: List[Optional[float]],
    ) -> List[ComplianceResult]:
        results = []
        current_time = 0
        for step in steps:
            s, e = current_time, current_time + step.duration
            segment = aligned_actual[s:e]
            numeric = [v for v in segment if v is not None]
            avg_power = float(np.mean(numeric)) if numeric else 0.0
            compliance = self._compliance_scorer.score(
                numeric,
                step.target_power,
                step.duration,
                step.intensity_class,
            )

            results.append(
                ComplianceResult(
                    step_name=step.name,
                    planned_duration=step.duration,
                    actual_duration=len(numeric),
                    target_power=step.target_power,
                    actual_power_avg=avg_power,
                    compliance_pct=compliance,
                    intensity_class=step.intensity_class,
                )
            )
            current_time += step.duration

        return results

    def analyze_with_offset(
        self,
        steps: List[WorkoutStep],
        streams: List[StreamPoint],
        offset: int,
    ) -> List[ComplianceResult]:
        actual_power = [p.power for p in streams]
        results = []
        current_time = 0
        for step in steps:
            # Offset means actual[0] aligns to planned[offset]
            start_idx = current_time - offset
            end_idx = current_time + step.duration - offset
            if end_idx <= 0 or start_idx >= len(actual_power):
                segment = []
            else:
                start_idx = max(0, start_idx)
                end_idx = min(len(actual_power), end_idx)
                segment = actual_power[start_idx:end_idx]
            avg_power = float(np.mean(segment)) if len(segment) > 0 else 0.0
            compliance = self._compliance_scorer.score(
                segment,
                step.target_power,
                step.duration,
                step.intensity_class,
            )
            
            results.append(ComplianceResult(
                step_name=step.name,
                planned_duration=step.duration,
                actual_duration=len(segment),
                target_power=step.target_power,
                actual_power_avg=avg_power,
                compliance_pct=compliance,
                intensity_class=step.intensity_class,
            ))
            current_time += step.duration
            
        return results

    def _expand_steps_to_seconds(self, steps: List[WorkoutStep]) -> List[float]:
        expanded = []
        for s in steps:
            expanded.extend([s.target_power] * s.duration)
        return expanded

    def find_interval_anchors(
        self,
        planned_power: List[float],
        actual_power: List[float],
        high_ratio: float = 0.9,
        min_run: int = 45,
        search_window: int = 600,
    ) -> tuple[Optional[int], Optional[int]]:
        threshold = self.ftp * high_ratio
        planned_anchor = _find_first_sustained(planned_power, threshold, min_run)
        if planned_anchor is None:
            return None, None

        window_start = max(0, planned_anchor - search_window)
        window_end = min(len(actual_power), planned_anchor + search_window)
        if window_end - window_start <= 0:
            return None, None

        local_anchor = _find_first_sustained(
            actual_power[window_start:window_end],
            threshold,
            min_run,
        )
        if local_anchor is None:
            return None, None
        actual_anchor = window_start + local_anchor
        return planned_anchor, actual_anchor

    def _calculate_error(self, planned: List[float], actual: List[float], offset: int) -> float:
        # Simplified MSE calculation for alignment
        s_idx = max(0, offset)
        p_idx = max(0, -offset)
        length = min(len(actual) - s_idx, len(planned) - p_idx)
        if length <= 0: return float('inf')
        
        a_part = np.array(actual[s_idx:s_idx+length])
        p_part = np.array(planned[p_idx:p_idx+length])
        return np.mean((a_part - p_part) ** 2)


def _find_first_sustained(values: List[float], threshold: float, min_run: int) -> Optional[int]:
    run = 0
    for i, v in enumerate(values):
        if v >= threshold:
            run += 1
            if run >= min_run:
                return i - min_run + 1
        else:
            run = 0
    return None
