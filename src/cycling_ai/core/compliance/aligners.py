from typing import List, Optional, Protocol

import numpy as np
from dtaidistance import dtw


class Aligner(Protocol):
    def align(self, planned: List[float], actual: List[float]) -> List[Optional[float]]:
        ...


class DTWAligner(Aligner):
    def __init__(
        self,
        max_len: Optional[int] = None,
        window: int = 90,
        penalty: float = 3.0,
        psi: int = 10,
        anchor: bool = True,
        anchor_percentile: int = 85,
        anchor_min_run: int = 45,
        downsample: int = 1,
    ):
        self.max_len = max_len
        self.window = window
        self.penalty = penalty
        self.psi = psi
        self.anchor = anchor
        self.anchor_percentile = anchor_percentile
        self.anchor_min_run = anchor_min_run
        self.downsample = downsample

    def align(self, planned: List[float], actual: List[float]) -> List[Optional[float]]:
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
        planned: List[float],
        actual: List[float],
        planned_anchor: Optional[int],
        actual_anchor: Optional[int],
    ) -> List[Optional[float]]:
        if planned_anchor is None or actual_anchor is None:
            return self._align_core(planned, actual, 0, 0)
        return self._align_core(planned, actual, planned_anchor, actual_anchor)

    def _align_core(
        self,
        planned: List[float],
        actual: List[float],
        planned_anchor: int,
        actual_anchor: int,
    ) -> List[Optional[float]]:
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
            mapping = [[] for _ in range(len(planned))]
            for pi, ai in path:
                p_start = planned_anchor + pi * self.downsample
                p_end = min(planned_anchor + (pi + 1) * self.downsample, len(planned))
                a_start = actual_anchor + ai * self.downsample
                a_end = min(actual_anchor + (ai + 1) * self.downsample, len(actual))
                for p_idx in range(p_start, p_end):
                    mapping[p_idx].extend(range(a_start, a_end))
        else:
            path = dtw.warping_path(p, a, window=self.window, penalty=self.penalty, psi=self.psi)
            mapping = [[] for _ in range(len(planned))]
            for pi, ai in path:
                if 0 <= pi < max_len and 0 <= ai < max_len:
                    mapping[planned_anchor + pi].append(actual_anchor + ai)

        aligned = [None] * len(planned)
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
    std = float(np.std(values))
    if std == 0:
        return np.zeros_like(values)
    return (values - float(np.mean(values))) / std


def _find_first_sustained(values: List[float], threshold: float, min_run: int) -> int:
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
    values: List[float],
    ftp: float,
    high_ratio: float,
    min_run: int,
) -> int:
    threshold = ftp * high_ratio
    return _find_first_sustained(values, threshold, min_run)


def _downsample_array(values: np.ndarray, step: int) -> np.ndarray:
    if step <= 1:
        return values
    return np.array(
        [float(np.mean(values[i : i + step])) for i in range(0, len(values), step)],
        dtype=float,
    )
