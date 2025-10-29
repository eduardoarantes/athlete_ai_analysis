"""
Power zones calculation module.

Provides centralized, consistent power zone calculations based on FTP.
All zone calculations should use these functions to ensure consistency across the codebase.
"""

from typing import Dict, Tuple


def calculate_power_zones(ftp: float) -> Dict[str, Dict[str, float]]:
    """
    Calculate standard cycling power zones based on FTP.

    Uses the Coggan/Allen 5-zone model with additional Sweet Spot zone.
    All calculations use the same percentages for consistency across the application.

    Args:
        ftp: Functional Threshold Power in watts

    Returns:
        Dictionary of zone definitions with min/max values in watts

    Example:
        >>> zones = calculate_power_zones(260)
        >>> zones['z2']
        {'name': 'Endurance', 'min': 146, 'max': 208, 'ftp_pct_min': 0.56, 'ftp_pct_max': 0.80}
    """
    return {
        'z1': {
            'name': 'Active Recovery',
            'min': 0,
            'max': int(ftp * 0.55),
            'ftp_pct_min': 0.00,
            'ftp_pct_max': 0.55,
            'description': 'Very easy, recovery pace. Conversational.',
        },
        'z2': {
            'name': 'Endurance',
            'min': int(ftp * 0.56),
            'max': int(ftp * 0.75),
            'ftp_pct_min': 0.56,
            'ftp_pct_max': 0.75,
            'description': 'Aerobic base building. Long rides, comfortable pace.',
        },
        'z3': {
            'name': 'Tempo',
            'min': int(ftp * 0.76),
            'max': int(ftp * 0.90),
            'ftp_pct_min': 0.76,
            'ftp_pct_max': 0.90,
            'description': 'Moderate intensity. Sustainable but requires focus.',
        },
        'z4': {
            'name': 'Threshold',
            'min': int(ftp * 0.91),
            'max': int(ftp * 1.05),
            'ftp_pct_min': 0.91,
            'ftp_pct_max': 1.05,
            'description': 'FTP intensity. Hard, sustainable for 20-60 minutes.',
        },
        'z5': {
            'name': 'VO2 Max',
            'min': int(ftp * 1.06),
            'max': int(ftp * 1.20),  # Practical upper bound
            'ftp_pct_min': 1.06,
            'ftp_pct_max': 1.20,
            'description': 'Very hard, short intervals. Maximum aerobic power.',
        },
        'sweet_spot': {
            'name': 'Sweet Spot',
            'min': int(ftp * 0.88),
            'max': int(ftp * 0.93),
            'ftp_pct_min': 0.88,
            'ftp_pct_max': 0.93,
            'description': 'Sub-threshold training. Effective for FTP development.',
        },
    }


def get_zone_bounds_for_analysis(ftp: float) -> Dict[str, Tuple[float, float]]:
    """
    Get zone boundaries for time-in-zones analysis.

    Returns a simpler format used by the zones analysis module,
    with tuple (lower_bound, upper_bound) for each zone.

    Args:
        ftp: Functional Threshold Power in watts

    Returns:
        Dictionary mapping zone names to (lower, upper) tuples

    Example:
        >>> bounds = get_zone_bounds_for_analysis(260)
        >>> bounds['Z2 (Endurance)']
        (146.0, 195.0)
    """
    zones = calculate_power_zones(ftp)

    return {
        'Z1 (Active Recovery)': (0, zones['z1']['max']),
        'Z2 (Endurance)': (zones['z2']['min'], zones['z2']['max']),
        'Z3 (Tempo)': (zones['z3']['min'], zones['z3']['max']),
        'Z4 (Threshold)': (zones['z4']['min'], zones['z4']['max']),
        'Z5 (VO2 Max)': (zones['z5']['min'], float('inf')),
    }


def get_zone_for_power(power: float, ftp: float) -> str:
    """
    Determine which zone a given power reading belongs to.

    Args:
        power: Power in watts
        ftp: Functional Threshold Power in watts

    Returns:
        Zone name (e.g., 'Z2 (Endurance)')

    Example:
        >>> get_zone_for_power(180, 260)
        'Z2 (Endurance)'
    """
    bounds = get_zone_bounds_for_analysis(ftp)

    for zone_name, (lower, upper) in bounds.items():
        if lower <= power < upper:
            return zone_name

    # Power is above all zones (> Z5 max)
    return 'Z5 (VO2 Max)'


def get_workout_power_targets(ftp: float) -> Dict[str, int]:
    """
    Get common power targets for workout building.

    Provides convenient power values for designing workouts.

    Args:
        ftp: Functional Threshold Power in watts

    Returns:
        Dictionary of power targets in watts

    Example:
        >>> targets = get_workout_power_targets(260)
        >>> targets['z1_max']
        143
        >>> targets['threshold_low']
        237
    """
    zones = calculate_power_zones(ftp)

    return {
        # Zone maximums
        'z1_max': zones['z1']['max'],
        'z2_min': zones['z2']['min'],
        'z2_max': zones['z2']['max'],
        'z3_min': zones['z3']['min'],
        'z3_max': zones['z3']['max'],
        'z4_min': zones['z4']['min'],
        'z4_max': zones['z4']['max'],
        'z5_min': zones['z5']['min'],

        # Sweet Spot
        'sweet_spot_low': zones['sweet_spot']['min'],
        'sweet_spot_high': zones['sweet_spot']['max'],

        # Common workout targets
        'recovery': zones['z1']['max'],
        'endurance_low': zones['z2']['min'],
        'endurance_high': zones['z2']['max'],
        'tempo_low': zones['z3']['min'],
        'tempo_high': zones['z3']['max'],
        'threshold_low': int(ftp * 0.90),  # Low end of threshold work
        'threshold_high': int(ftp * 0.95),  # High end of threshold work
        'vo2_low': int(ftp * 1.06),
        'vo2_high': int(ftp * 1.15),
    }
