from typing import List, Optional, Protocol

import numpy as np


class OffsetFinder(Protocol):
    def find_offset(self, planned: List[float], actual: List[float]) -> int:
        ...


class WindowedMSEOffsetFinder(OffsetFinder):
    def __init__(self, max_offset: int = 1500, min_required: int = 1000):
        self.max_offset = max_offset
        self.min_required = min_required

    def find_offset(self, planned: List[float], actual: List[float]) -> int:
        return _find_offset(
            planned,
            actual,
            max_offset=self.max_offset,
            min_required=self.min_required,
        )


class WeightedOffsetFinder(OffsetFinder):
    def __init__(
        self,
        max_offset: int = 1500,
        min_required: int = 1000,
        window: int = 60,
        percentile: int = 60,
        low_weight: float = 0.2,
    ):
        self.max_offset = max_offset
        self.min_required = min_required
        self.window = window
        self.percentile = percentile
        self.low_weight = low_weight

    def find_offset(self, planned: List[float], actual: List[float]) -> int:
        weights = _variance_weights(
            planned,
            window=self.window,
            percentile=self.percentile,
            low_weight=self.low_weight,
        )
        return _find_offset(
            planned,
            actual,
            weights=weights,
            max_offset=self.max_offset,
            min_required=self.min_required,
        )


class SegmentPeakOffsetFinder(OffsetFinder):
    def __init__(
        self,
        max_offset: int = 1500,
        min_required: int = 600,
        percentile: int = 85,
    ):
        self.max_offset = max_offset
        self.min_required = min_required
        self.percentile = percentile

    def find_offset(self, planned: List[float], actual: List[float]) -> int:
        if not planned or not actual:
            return 0
        p_thresh = np.percentile(planned, self.percentile)
        a_thresh = np.percentile(actual, self.percentile)
        planned_peaks = np.array(planned) >= p_thresh
        actual_peaks = np.array(actual) >= a_thresh
        return _find_peak_overlap_offset(
            planned_peaks,
            actual_peaks,
            max_offset=self.max_offset,
            min_required=self.min_required,
        )


class DTWOffsetFinder(OffsetFinder):
    def __init__(
        self,
        max_offset: int = 1500,
        min_required: int = 600,
        downsample: int = 5,
        band: int = 80,
    ):
        self.max_offset = max_offset
        self.min_required = min_required
        self.downsample = downsample
        self.band = band

    def find_offset(self, planned: List[float], actual: List[float]) -> int:
        if not planned or not actual:
            return 0
        p = _downsample(planned, self.downsample)
        a = _downsample(actual, self.downsample)
        if not p or not a:
            return 0
        p = _zscore(p)
        a = _zscore(a)
        path = _dtw_path(p, a, band=self.band)
        if not path:
            return 0
        offsets = [(pi - ai) * self.downsample for pi, ai in path]
        median_offset = int(np.median(offsets))
        return max(0, min(self.max_offset, median_offset))


def _find_offset(
    planned: List[float],
    actual: List[float],
    weights: Optional[List[float]] = None,
    max_offset: int = 1500,
    min_required: int = 1000,
) -> int:
    best_offset = 0
    min_error = float("inf")

    min_required = min(min_required, len(planned), len(actual))
    max_offset = min(max_offset, len(planned))
    for offset in range(0, max_offset):
        overlap_len = min(len(planned) - offset, len(actual))
        if overlap_len < min_required:
            break

        p_part = np.array(planned[offset : offset + overlap_len])
        a_part = np.array(actual[:overlap_len])
        if weights is None:
            error = np.mean((p_part - a_part) ** 2)
        else:
            w_part = np.array(weights[offset : offset + overlap_len])
            if np.all(w_part == 0):
                error = np.mean((p_part - a_part) ** 2)
            else:
                error = np.average((p_part - a_part) ** 2, weights=w_part)
        if error < min_error:
            min_error = error
            best_offset = offset
    return best_offset


def _variance_weights(
    planned: List[float],
    window: int = 60,
    percentile: int = 60,
    low_weight: float = 0.2,
) -> List[float]:
    if len(planned) < window:
        return [1.0] * len(planned)

    arr = np.array(planned, dtype=float)
    kernel = np.ones(window)
    mean = np.convolve(arr, kernel, mode="same") / window
    mean_sq = np.convolve(arr ** 2, kernel, mode="same") / window
    std = np.sqrt(np.maximum(mean_sq - mean ** 2, 0))

    threshold = np.percentile(std, percentile)
    weights = np.where(std >= threshold, 1.0, low_weight)
    return weights.tolist()


def _find_peak_overlap_offset(
    planned_peaks: np.ndarray,
    actual_peaks: np.ndarray,
    max_offset: int,
    min_required: int,
) -> int:
    best_offset = 0
    best_score = -1
    max_offset = min(max_offset, len(planned_peaks))
    min_required = min(min_required, len(planned_peaks), len(actual_peaks))
    for offset in range(0, max_offset):
        overlap_len = min(len(planned_peaks) - offset, len(actual_peaks))
        if overlap_len < min_required:
            break
        p_part = planned_peaks[offset : offset + overlap_len]
        a_part = actual_peaks[:overlap_len]
        score = int(np.sum(p_part & a_part))
        if score > best_score:
            best_score = score
            best_offset = offset
    return best_offset


def _downsample(values: List[float], step: int) -> List[float]:
    if step <= 1:
        return values
    return [float(np.mean(values[i : i + step])) for i in range(0, len(values), step)]


def _zscore(values: List[float]) -> List[float]:
    arr = np.array(values, dtype=float)
    mean = float(np.mean(arr))
    std = float(np.std(arr))
    if std == 0:
        return [0.0] * len(values)
    return ((arr - mean) / std).tolist()


def _dtw_path(a: List[float], b: List[float], band: int) -> List[tuple[int, int]]:
    n = len(a)
    m = len(b)
    band = max(band, abs(n - m))
    inf = float("inf")
    dtw = np.full((n + 1, m + 1), inf)
    dtw[0, 0] = 0.0

    for i in range(1, n + 1):
        j_start = max(1, i - band)
        j_end = min(m, i + band)
        for j in range(j_start, j_end + 1):
            cost = abs(a[i - 1] - b[j - 1])
            dtw[i, j] = cost + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])

    i, j = n, m
    path = []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        steps = [(i - 1, j), (i, j - 1), (i - 1, j - 1)]
        i, j = min(steps, key=lambda t: dtw[t[0], t[1]])
    return path[::-1]
