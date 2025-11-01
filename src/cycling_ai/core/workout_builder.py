"""
Workout Builder Module

Generates detailed workout structures with warm-up, main sets, and cool-down.
"""

from .power_zones import get_workout_power_targets
from .tss import calculate_workout_tss



class WorkoutSegment:
    """Represents a single segment of a workout (warm-up, interval, recovery, cool-down)"""

    def __init__(self, duration_min: int, power_low: int, power_high: int = None,
                 description: str = "", segment_type: str = "steady"):
        """
        Args:
            duration_min: Duration in minutes
            power_low: Lower power bound in watts
            power_high: Upper power bound in watts (same as low for steady state)
            description: Text description of the segment
            segment_type: Type of segment (warmup, interval, work, recovery, cooldown, steady, tempo)
        """
        self.duration_min = duration_min
        self.power_low = power_low
        self.power_high = power_high if power_high else power_low
        self.description = description
        self.segment_type = segment_type

    def to_dict(self) -> dict:
        return {
            'duration_min': self.duration_min,
            'power_low': self.power_low,
            'power_high': self.power_high,
            'description': self.description,
            'type': self.segment_type
        }


class Workout:
    """Represents a complete structured workout"""

    def __init__(
        self,
        weekday: str,
        name: str = "",
        detailed_description: str = "",
        description: str = "",  # Deprecated: kept for backward compatibility
    ):
        self.weekday = weekday
        # Use name if provided, otherwise fall back to description for backward compatibility
        self.name = name if name else description
        self.detailed_description = detailed_description
        self.segments: list[WorkoutSegment] = []

    def add_segment(self, segment: WorkoutSegment):
        """Add a segment to the workout"""
        self.segments.append(segment)

    def add_warmup(self, duration_min: int, power_low: int, power_high: int):
        """Add a progressive warm-up segment"""
        self.segments.append(WorkoutSegment(
            duration_min, power_low, power_high,
            f"Warm-up {duration_min} min ({power_low}-{power_high}W)",
            "warmup"
        ))

    def add_cooldown(self, duration_min: int, power_low: int, power_high: int):
        """Add a progressive cool-down segment"""
        self.segments.append(WorkoutSegment(
            duration_min, power_low, power_high,
            f"Cool-down {duration_min} min ({power_low}-{power_high}W)",
            "cooldown"
        ))

    def add_interval(self, duration_min: int, power_low: int, power_high: int, description: str = ""):
        """Add a work interval"""
        desc = description or f"Interval {duration_min} min @ {power_low}-{power_high}W"
        self.segments.append(WorkoutSegment(
            duration_min, power_low, power_high, desc, "interval"
        ))

    def add_recovery(self, duration_min: int, power: int):
        """Add a recovery segment"""
        self.segments.append(WorkoutSegment(
            duration_min, power, power, f"Recovery {duration_min} min @ {power}W", "recovery"
        ))

    def add_steady(self, duration_min: int, power_low: int, power_high: int, description: str = ""):
        """Add a steady state segment"""
        desc = description or f"Steady {duration_min} min @ {power_low}-{power_high}W"
        self.segments.append(WorkoutSegment(
            duration_min, power_low, power_high, desc, "steady"
        ))

    def total_duration(self) -> int:
        """Calculate total workout duration in minutes"""
        return sum(s.duration_min for s in self.segments)

    def work_time(self) -> int:
        """Calculate work time (interval segments only) in minutes"""
        return sum(s.duration_min for s in self.segments if s.segment_type == 'interval')

    def calculate_tss(self, ftp: float) -> float:
        """
        Calculate TSS for the workout based on FTP.

        Args:
            ftp: Athlete's FTP in watts

        Returns:
            Total TSS for the workout
        """
        segments_data = [s.to_dict() for s in self.segments]
        # Convert power watts to power_pct for TSS calculation
        for seg in segments_data:
            seg['power_low_pct'] = (seg['power_low'] / ftp) * 100
            seg['power_high_pct'] = (seg['power_high'] / ftp) * 100
        return calculate_workout_tss(segments_data, ftp)

    def to_dict(self, ftp: float | None = None) -> dict:
        """
        Convert workout to dictionary.

        Args:
            ftp: Optional FTP to include TSS calculation

        Returns:
            Dictionary representation of workout
        """
        result = {
            'weekday': self.weekday,
            'name': self.name,
            'detailed_description': self.detailed_description,
            'description': self.name,  # Backward compatibility: alias to name
            'total_duration_min': self.total_duration(),
            'work_time_min': self.work_time(),
            'segments': [s.to_dict() for s in self.segments]
        }

        if ftp is not None:
            result['tss'] = self.calculate_tss(ftp)

        return result


def build_threshold_workout(ftp: int, weekday: str, intervals: str = "2x20", week: int = 1) -> Workout:
    """
    Build a threshold workout with warm-up and cool-down.

    Args:
        ftp: Athlete's FTP
        weekday: Day of the week (Monday-Sunday)
        intervals: Interval structure (e.g., "2x20", "2x15")
        week: Week number for progression

    Returns:
        Structured Workout object
    """
    name = "Threshold intervals"
    detailed_description = (
        "This workout works equally well indoors on a trainer or outdoors on steady terrain. "
        "Threshold intervals target your lactate threshold, the highest sustainable power output "
        "you can maintain for approximately one hour. By accumulating time at or near FTP (90-105%), "
        "you improve your body's ability to buffer lactate and sustain higher power outputs for "
        "extended periods. Maintain smooth, consistent power throughout each interval—avoid surges "
        "or power spikes. Focus on controlled breathing and efficient pedaling technique."
    )
    workout = Workout(weekday, name=name, detailed_description=detailed_description)

    # Parse intervals
    sets, duration = intervals.split('x')
    sets = int(sets)
    duration = int(duration)

    # Get power targets using centralized helper
    targets = get_workout_power_targets(ftp)

    # Warm-up (15 min progressive)
    workout.add_warmup(15, targets['z1_max'], targets['z2_max'])

    # Main set
    threshold_low = targets['threshold_low']
    threshold_high = targets['threshold_high']
    recovery_power = targets['recovery']

    for i in range(sets):
        workout.add_interval(duration, threshold_low, threshold_high, f"Threshold {duration}min @ 90-95% FTP")
        if i < sets - 1:  # Don't add recovery after last interval
            workout.add_recovery(5, recovery_power)

    # Cool-down (10 min)
    workout.add_cooldown(10, targets['z1_max'], int(ftp * 0.5))

    return workout


def build_vo2max_workout(ftp: int, weekday: str, intervals: str = "5x5", week: int = 1) -> Workout:
    """Build a VO2 max workout"""
    name = "VO2 Max intervals"
    detailed_description = (
        "Ideally perform this on your trainer, although outdoors works fine too. "
        "Short interval HIIT is an effective means of enhancing your maximal oxygen uptake (VO2max) "
        "and performance. The workout uses short bouts of work above your pVO2max, with passive "
        "relief periods, to enable recruitment of your larger fast twitch muscles, as well as "
        "stimulation of maximal cardiac output (your heart). Focus on maintaining consistent power "
        "throughout each interval and use the recovery periods to let your heart rate drop before "
        "the next effort."
    )
    workout = Workout(weekday, name=name, detailed_description=detailed_description)

    sets, duration = intervals.split('x')
    sets = int(sets)
    duration = int(duration)

    # Get power targets using centralized helper
    targets = get_workout_power_targets(ftp)

    # Warm-up (15 min progressive with primers)
    workout.add_warmup(10, targets['z1_max'], targets['z2_max'])

    # Add 2 short primers
    workout.add_interval(1, int(ftp * 1.0), int(ftp * 1.05), "Primer")
    workout.add_recovery(2, targets['z1_max'])
    workout.add_interval(1, int(ftp * 1.0), int(ftp * 1.05), "Primer")
    workout.add_recovery(2, targets['z1_max'])

    # Main set
    vo2_low = targets['vo2_low']
    vo2_high = targets['vo2_high']
    recovery_power = targets['recovery']

    for i in range(sets):
        workout.add_interval(duration, vo2_low, vo2_high, f"VO2 Max {duration}min @ 106-115% FTP")
        if i < sets - 1:
            workout.add_recovery(5, recovery_power)

    # Cool-down
    workout.add_cooldown(10, targets['z1_max'], int(ftp * 0.5))

    return workout


def build_sweetspot_workout(ftp: int, weekday: str, intervals: str = "3x15") -> Workout:
    """Build a sweet spot workout"""
    name = "Sweet Spot intervals"
    detailed_description = (
        "This workout is suitable for both indoor trainer and outdoor riding. Sweet spot training "
        "targets the intersection of aerobic capacity and lactate threshold, maximizing FTP gains "
        "while remaining sustainable. These sub-threshold intervals (88-93% FTP) accumulate "
        "significant time-in-zone without the fatigue cost of true threshold work, making them "
        "ideal for building race-ready endurance. Maintain smooth, controlled power and focus on "
        "efficient pedaling throughout each interval."
    )
    workout = Workout(weekday, name=name, detailed_description=detailed_description)

    sets, duration = intervals.split('x')
    sets = int(sets)
    duration = int(duration)

    # Get power targets using centralized helper
    targets = get_workout_power_targets(ftp)

    # Warm-up
    workout.add_warmup(15, targets['z1_max'], targets['z2_max'])

    # Main set
    ss_low = targets['sweet_spot_low']
    ss_high = targets['sweet_spot_high']
    recovery_power = targets['endurance_low']

    for i in range(sets):
        workout.add_interval(duration, ss_low, ss_high, f"Sweet Spot {duration}min @ 88-93% FTP")
        if i < sets - 1:
            workout.add_recovery(5, recovery_power)

    # Cool-down
    workout.add_cooldown(10, targets['z1_max'], int(ftp * 0.5))

    return workout


def build_tempo_workout(ftp: int, weekday: str, intervals: str = "3x15") -> Workout:
    """Build a tempo workout"""
    name = "Tempo intervals"
    detailed_description = (
        "Best performed outdoors where you can sustain steady efforts on rolling terrain. Tempo "
        "work (76-85% FTP) develops aerobic endurance and muscular stamina while remaining below "
        "your lactate threshold. This 'comfortably hard' effort improves fat oxidation, "
        "mitochondrial density, and mental resilience for long events. Keep power steady and avoid "
        "the temptation to drift into threshold—tempo should feel sustainable for the entire duration."
    )
    workout = Workout(weekday, name=name, detailed_description=detailed_description)

    sets, duration = intervals.split('x')
    sets = int(sets)
    duration = int(duration)

    # Get power targets using centralized helper
    targets = get_workout_power_targets(ftp)

    # Warm-up
    workout.add_warmup(10, targets['z1_max'], targets['z2_max'])

    # Main set
    tempo_low = targets['tempo_low']
    tempo_high = targets['tempo_high']
    recovery_power = targets['endurance_low']

    for i in range(sets):
        workout.add_interval(duration, tempo_low, tempo_high, f"Tempo {duration}min @ 80-85% FTP")
        if i < sets - 1:
            workout.add_recovery(5, recovery_power)

    # Cool-down
    workout.add_cooldown(10, targets['z1_max'], int(ftp * 0.5))

    return workout


def build_endurance_workout(ftp: int, weekday: str, duration_min: int = 60) -> Workout:
    """Build an endurance workout"""
    name = "Endurance ride"
    detailed_description = (
        "Best performed outdoors on varied terrain to build mental resilience and handling skills. "
        "Long endurance rides develop aerobic capacity through mitochondrial biogenesis and improved "
        "fat oxidation, creating the foundation for all higher-intensity work. Zone 2 efforts should "
        "feel conversational—you should be able to talk in complete sentences. Stay disciplined with "
        "power targets; going too hard defeats the purpose of aerobic base building. Focus on smooth "
        "pedaling and enjoying the ride."
    )
    workout = Workout(weekday, name=name, detailed_description=detailed_description)

    # Get power targets using centralized helper
    targets = get_workout_power_targets(ftp)

    z2_low = targets['endurance_low']
    z2_high = targets['endurance_high']

    workout.add_steady(duration_min, z2_low, z2_high, f"Endurance {duration_min}min @ Z2")

    return workout
