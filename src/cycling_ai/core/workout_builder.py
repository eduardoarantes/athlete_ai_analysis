"""
Workout Builder Module

Generates detailed workout structures with warm-up, main sets, and cool-down.
Creates visual SVG representations of workouts similar to Zwift/TrainingPeaks.
"""

from .power_zones import get_workout_power_targets



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
            segment_type: Type of segment (warmup, interval, recovery, cooldown, steady)
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

    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
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

    def to_dict(self) -> dict:
        """Convert workout to dictionary"""
        return {
            'name': self.name,
            'description': self.description,
            'total_duration_min': self.total_duration(),
            'work_time_min': self.work_time(),
            'segments': [s.to_dict() for s in self.segments]
        }

    def generate_svg(self, width: int = 600, height: int = 200, ftp: int = 250) -> str:
        """
        Generate an SVG visualization of the workout.

        Args:
            width: SVG width in pixels
            height: SVG height in pixels
            ftp: Athlete's FTP for scaling

        Returns:
            SVG markup as string
        """
        if not self.segments:
            return ""

        # Calculate total duration
        total_duration = self.total_duration()
        if total_duration == 0:
            return ""

        # SVG setup - use total duration * 10 for viewBox width for smooth scaling
        viewbox_width = total_duration * 10
        viewbox_height = 120

        # No padding in viewBox coordinates - we'll work in the full viewBox space
        chart_width = viewbox_width
        chart_height = viewbox_height

        # Find max power for scaling (use 200% FTP as max for better visualization)
        max_power = ftp * 2.0

        # Color mapping for different segment types and zones
        def get_color(segment: WorkoutSegment) -> str:
            avg_power = (segment.power_low + segment.power_high) / 2
            intensity = avg_power / ftp if ftp > 0 else 0

            if segment.segment_type in ['warmup', 'cooldown']:
                return '#94A3B8'  # Gray
            elif intensity < 0.6:
                return '#3B82F6'  # Blue - Z1 Recovery
            elif intensity < 0.8:
                return '#10B981'  # Green - Z2 Endurance
            elif intensity < 0.9:
                return '#F59E0B'  # Orange - Z3 Tempo
            elif intensity < 1.05:
                return '#EF4444'  # Red - Z4 Threshold
            else:
                return '#DC2626'  # Dark Red - Z5 VO2 Max

        # Start building SVG with viewBox and preserveAspectRatio
        svg_parts = [
            f'<svg viewBox="0 0 {viewbox_width} {viewbox_height}" preserveAspectRatio="none" style="width: 100%; height: 120px;" xmlns="http://www.w3.org/2000/svg">',

            # Background grid lines
            f'<line x1="0" y1="30" x2="{viewbox_width}" y2="30" stroke="#e4e6e8" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>',
            f'<line x1="0" y1="60" x2="{viewbox_width}" y2="60" stroke="#e4e6e8" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>',
            f'<line x1="0" y1="90" x2="{viewbox_width}" y2="90" stroke="#e4e6e8" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>',
        ]

        # Add FTP reference line at 50% of viewbox height (middle)
        ftp_y = viewbox_height / 2
        svg_parts.append(
            f'<line x1="0" y1="{ftp_y}" x2="{viewbox_width}" y2="{ftp_y}" stroke="#696cff" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>'
        )

        # Draw workout segments
        x_position = 0
        for segment in self.segments:
            # Calculate segment width based on duration (multiply by 10 to match viewBox width)
            segment_width = segment.duration_min * 10

            # Calculate bar height based on power as percentage of max
            # Map power to a position in the viewBox (0-120)
            # We want FTP (100%) to be at y=60 (middle)
            # So higher power = lower y value
            avg_power = (segment.power_low + segment.power_high) / 2
            power_ratio = avg_power / ftp if ftp > 0 else 0.5

            # Map power ratio to height
            # 0% = y=120 (bottom), 50% = y=90, 100% (FTP) = y=60, 200% = y=0
            bar_height = viewbox_height - (power_ratio * viewbox_height / 2)
            y_top = viewbox_height - bar_height

            color = get_color(segment)

            # Draw segment as a rectangle
            svg_parts.append(
                f'<rect x="{x_position}" y="{y_top}" width="{segment_width}" height="{bar_height}" fill="{color}"/>'
            )

            x_position += segment_width

        # Close SVG
        svg_parts.append('</svg>')

        return '\n'.join(svg_parts)


def build_threshold_workout(ftp: int, intervals: str = "2x20", week: int = 1) -> Workout:
    """
    Build a threshold workout with warm-up and cool-down.

    Args:
        ftp: Athlete's FTP
        intervals: Interval structure (e.g., "2x20", "2x15")
        week: Week number for progression

    Returns:
        Structured Workout object
    """
    workout = Workout("Threshold", "Build sustainable power at FTP")

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


def build_vo2max_workout(ftp: int, intervals: str = "5x5", week: int = 1) -> Workout:
    """Build a VO2 max workout"""
    workout = Workout("VO2 Max", "High intensity intervals to boost aerobic capacity")

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


def build_sweetspot_workout(ftp: int, intervals: str = "3x15") -> Workout:
    """Build a sweet spot workout"""
    workout = Workout("Sweet Spot", "Sub-threshold intervals for FTP development")

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


def build_tempo_workout(ftp: int, intervals: str = "3x15") -> Workout:
    """Build a tempo workout"""
    workout = Workout("Tempo", "Aerobic endurance at moderate intensity")

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


def build_endurance_workout(ftp: int, duration_min: int = 60) -> Workout:
    """Build an endurance workout"""
    workout = Workout("Endurance", "Aerobic base building")

    # Get power targets using centralized helper
    targets = get_workout_power_targets(ftp)

    z2_low = targets['endurance_low']
    z2_high = targets['endurance_high']

    workout.add_steady(duration_min, z2_low, z2_high, f"Endurance {duration_min}min @ Z2")

    return workout
