"""
Dynamic Time Warping (DTW) alignment for workout compliance analysis.

This module provides DTW-based alignment algorithms to match planned workout
power profiles with actual power data from activities.
"""

from __future__ import annotations

from typing import Protocol

import numpy as np
from dtaidistance import dtw


class Aligner(Protocol):
    """Protocol for power series alignment algorithms."""

    def align(self, planned: list[float], actual: list[float]) -> list[float | None]:
        """
        Align actual power series to planned power series.

        Args:
            planned: Planned power profile (watts per second)
            actual: Actual power data (watts per second)

        Returns:
            Aligned actual power series matching planned length
        """
        ...


class DTWAligner(Aligner):
    """
    Dynamic Time Warping aligner for power series.

    Uses DTW algorithm to align actual power data to planned power profile,
    accounting for variations in execution timing while preserving the
    structure of the workout.

    Attributes:
        max_len: Maximum length to align (None for full series)
        window: Sakoe-Chiba band constraint for DTW
        penalty: Penalty for diagonal moves in DTW
        psi: PSI constraint for DTW
        anchor: Whether to use anchor-based alignment
        anchor_percentile: Percentile for anchor detection
        anchor_min_run: Minimum sustained seconds for anchor
        downsample: Downsampling factor (1 = no downsampling)
    """

    def __init__(
        self,
        max_len: int | None = None,
        window: int = 90,
        penalty: float = 3.0,
        psi: int = 10,
        anchor: bool = True,
        anchor_percentile: int = 85,
        anchor_min_run: int = 45,
        downsample: int = 1,
    ) -> None:
        self.max_len = max_len
        self.window = window
        self.penalty = penalty
        self.psi = psi
        self.anchor = anchor
        self.anchor_percentile = anchor_percentile
        self.anchor_min_run = anchor_min_run
        self.downsample = downsample

    def align(self, planned: list[float], actual: list[float]) -> list[float | None]:
        if not planned or not actual:
            return [None] * len(planned)

        planned_anchor = 0
        actual_anchor = 0
        if self.anchor:
            planned_anchor = _find_first_interval_block(
                planned,
                ftp=np.percentile(planned, 85),
                high_ratio=0.9,
                min_run=self.anchor_min_run,
            )
            actual_anchor = _find_first_interval_block(
                actual,
                ftp=np.percentile(actual, 85),
                high_ratio=0.9,
                min_run=self.anchor_min_run,
            )

        return self._align_core(planned, actual, planned_anchor, actual_anchor)

    def align_with_anchors(
        self,
        planned: list[float],
        actual: list[float],
        planned_anchor: int | None,
        actual_anchor: int | None,
    ) -> list[float | None]:
        """
        Align series using explicit anchor points.

        Args:
            planned: Planned power profile
            actual: Actual power data
            planned_anchor: Index of anchor point in planned series (or None)
            actual_anchor: Index of anchor point in actual series (or None)

        Returns:
            Aligned actual power series
        """
        if planned_anchor is None or actual_anchor is None:
            return self._align_core(planned, actual, 0, 0)
        return self._align_core(planned, actual, planned_anchor, actual_anchor)

    def _align_core(
        self,
        planned: list[float],
        actual: list[float],
        planned_anchor: int,
        actual_anchor: int,
    ) -> list[float | None]:
        """Core DTW alignment algorithm with anchor points."""
        max_len = min(len(planned) - planned_anchor, len(actual) - actual_anchor)
        if max_len <= 0:
            return [None] * len(planned)
        if self.max_len is not None:
            max_len = min(max_len, self.max_len)

        p = np.array(planned[planned_anchor : planned_anchor + max_len], dtype=float)
        a = np.array(actual[actual_anchor : actual_anchor + max_len], dtype=float)

        p = _zscore(p)
        a = _zscore(a)

        if self.downsample > 1:
            p_ds = _downsample_array(p, self.downsample)
            a_ds = _downsample_array(a, self.downsample)
            window = max(1, self.window // self.downsample)
            path = dtw.warping_path(
                p_ds, a_ds, window=window, penalty=self.penalty, psi=self.psi
            )
            mapping: list[list[int]] = [[] for _ in range(len(planned))]
            for pi, ai in path:
                p_start = planned_anchor + pi * self.downsample
                p_end = min(planned_anchor + (pi + 1) * self.downsample, len(planned))
                a_start = actual_anchor + ai * self.downsample
                a_end = min(actual_anchor + (ai + 1) * self.downsample, len(actual))
                for p_idx in range(p_start, p_end):
                    mapping[p_idx].extend(range(a_start, a_end))
        else:
            path = dtw.warping_path(p, a, window=self.window, penalty=self.penalty, psi=self.psi)
            mapping: list[list[int]] = [[] for _ in range(len(planned))]
            for pi, ai in path:
                if 0 <= pi < max_len and 0 <= ai < max_len:
                    mapping[planned_anchor + pi].append(actual_anchor + ai)

        aligned: list[float | None] = [None] * len(planned)
        if planned_anchor > 0 or actual_anchor > 0:
            anchor_offset = planned_anchor - actual_anchor
            for i in range(0, planned_anchor):
                j = i - anchor_offset
                if 0 <= j < len(actual):
                    aligned[i] = float(actual[j])

        for i, indices in enumerate(mapping):
            if not indices:
                continue
            aligned[i] = float(np.mean([actual[j] for j in indices]))

        return aligned


def _zscore(values: np.ndarray) -> np.ndarray:
    """Standardize array to zero mean and unit variance."""
    std = float(np.std(values))
    if std == 0:
        return np.zeros_like(values)
    return (values - float(np.mean(values))) / std


def _find_first_sustained(values: list[float], threshold: float, min_run: int) -> int:
    """
    Find first sustained run above threshold.

    Args:
        values: Power values
        threshold: Minimum power threshold
        min_run: Minimum sustained duration (seconds)

    Returns:
        Index of first sustained run start (or 0 if not found)
    """
    run = 0
    for i, v in enumerate(values):
        if v >= threshold:
            run += 1
            if run >= min_run:
                return i - min_run + 1
        else:
            run = 0
    return 0


def _find_first_interval_block(
    values: list[float],
    ftp: float,
    high_ratio: float,
    min_run: int,
) -> int:
    """Find first high-intensity interval block for anchoring."""
    threshold = ftp * high_ratio
    return _find_first_sustained(values, threshold, min_run)


def _downsample_array(values: np.ndarray, step: int) -> np.ndarray:
    """Downsample array by averaging every 'step' values."""
    if step <= 1:
        return values
    return np.array(
        [float(np.mean(values[i : i + step])) for i in range(0, len(values), step)],
        dtype=float,
    )
