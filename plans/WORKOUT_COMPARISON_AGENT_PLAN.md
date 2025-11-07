# Workout Comparison Agent - Implementation Plan

**Created:** 2025-11-01
**Status:** Planning Phase
**Goal:** Create an AI agent that compares planned training workouts against actual executed workouts

---

## 📋 Overview

**Goal:** Create an AI agent that compares planned training workouts against actual executed workouts, providing insights on compliance, variations, and training plan adherence.

**Use Cases:**
- Daily comparison: "Did the athlete complete today's workout as planned?"
- Weekly comparison: "How well did the athlete follow this week's training plan?"
- Identify patterns: Skipped workouts, intensity deviations, duration differences
- Generate coaching insights: Recommendations based on adherence patterns

---

## 🏗️ Architecture Design

### 1. **Data Model** (`src/cycling_ai/core/models.py` additions)

```python
@dataclass
class PlannedWorkout:
    """Represents a planned workout from training plan."""
    date: datetime
    workout_type: str  # "endurance", "threshold", "vo2max", "recovery"
    planned_duration_minutes: int
    planned_tss: float
    planned_intensity_zones: dict[str, int]  # zone -> minutes
    planned_intervals: list[PlannedInterval] | None
    description: str

@dataclass
class PlannedInterval:
    """Planned interval within a workout."""
    duration_minutes: int
    target_power_watts: int | None
    target_zone: int | None
    target_hr: int | None

@dataclass
class ActualWorkout:
    """Represents actual executed workout from FIT file."""
    date: datetime
    duration_minutes: int
    actual_tss: float | None
    average_power: int | None
    normalized_power: int | None
    average_hr: int | None
    intensity_zones: dict[str, int]  # zone -> minutes
    workout_type: str | None

@dataclass
class WorkoutComparison:
    """Result of comparing planned vs actual workout."""
    date: datetime
    planned: PlannedWorkout
    actual: ActualWorkout | None  # None if workout was skipped

    # Compliance metrics
    completed: bool
    duration_compliance_pct: float  # % of planned duration
    tss_compliance_pct: float | None
    intensity_compliance: dict[str, float]  # zone -> compliance %

    # Insights
    deviations: list[str]  # Human-readable deviations
    compliance_score: float  # 0-100
    recommendation: str

@dataclass
class WeeklyComparison:
    """Aggregated comparison for entire week."""
    week_start_date: datetime
    daily_comparisons: list[WorkoutComparison]

    # Weekly metrics
    workouts_planned: int
    workouts_completed: int
    completion_rate_pct: float
    total_planned_tss: float
    total_actual_tss: float
    tss_compliance_pct: float
    avg_compliance_score: float

    # Insights
    patterns: list[str]  # Identified patterns
    weekly_recommendation: str
```

### 2. **Core Business Logic** (`src/cycling_ai/core/workout_comparison.py`)

New module with pure Python algorithms:

```python
class WorkoutComparer:
    """Compare planned vs actual workouts."""

    def compare_daily_workout(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout | None,
    ) -> WorkoutComparison:
        """Compare single day planned vs actual."""
        # Calculate compliance metrics
        # Identify deviations
        # Generate recommendations

    def compare_weekly_workouts(
        self,
        planned_workouts: list[PlannedWorkout],
        actual_workouts: list[ActualWorkout],
    ) -> WeeklyComparison:
        """Compare entire week of workouts."""
        # Match planned to actual by date
        # Aggregate daily comparisons
        # Identify weekly patterns

    def calculate_compliance_score(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout | None,
    ) -> float:
        """Calculate 0-100 compliance score."""
        # Weighted scoring:
        # - Completion: 40%
        # - Duration match: 25%
        # - Intensity match: 25%
        # - TSS match: 10%

    def identify_deviations(
        self,
        planned: PlannedWorkout,
        actual: ActualWorkout | None,
    ) -> list[str]:
        """Generate human-readable deviation descriptions."""
        # e.g., "Workout skipped", "20% shorter than planned",
        # "Too much time in Z3 (planned Z2)"
```

### 3. **Tool Wrapper** (`src/cycling_ai/tools/wrappers/workout_comparison_tool.py`)

```python
@dataclass
class CompareWorkoutTool(BaseTool):
    """Tool for comparing planned vs actual workout execution."""

    name: str = "compare_workout"
    description: str = (
        "Compare a planned workout against actual execution. "
        "Analyzes compliance, deviations, and provides recommendations."
    )
    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="date",
            param_type="string",
            description="Date of workout to compare (YYYY-MM-DD)",
            required=True,
        ),
        ToolParameter(
            name="training_plan_path",
            param_type="string",
            description="Path to training plan JSON file",
            required=True,
        ),
        ToolParameter(
            name="activities_csv_path",
            param_type="string",
            description="Path to activities CSV file",
            required=True,
        ),
    ])

    def execute(
        self,
        date: str,
        training_plan_path: str,
        activities_csv_path: str,
    ) -> ToolExecutionResult:
        # Load planned workout from training plan
        # Load actual workout from CSV/Parquet
        # Run comparison
        # Return WorkoutComparison as JSON

@dataclass
class CompareWeeklyWorkoutsTool(BaseTool):
    """Tool for comparing entire week of planned vs actual workouts."""

    name: str = "compare_weekly_workouts"
    description: str = (
        "Compare an entire week of planned workouts against actual execution. "
        "Provides weekly compliance metrics and pattern identification."
    )
    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="week_start_date",
            param_type="string",
            description="Start date of week (Monday, YYYY-MM-DD)",
            required=True,
        ),
        ToolParameter(
            name="training_plan_path",
            param_type="string",
            description="Path to training plan JSON file",
            required=True,
        ),
        ToolParameter(
            name="activities_csv_path",
            param_type="string",
            description="Path to activities CSV file",
            required=True,
        ),
    ])

    def execute(
        self,
        week_start_date: str,
        training_plan_path: str,
        activities_csv_path: str,
    ) -> ToolExecutionResult:
        # Load week's planned workouts
        # Load week's actual workouts
        # Run weekly comparison
        # Return WeeklyComparison as JSON
```

### 4. **Specialized Agent Prompt** (`src/cycling_ai/orchestration/prompts.py`)

```python
WORKOUT_COMPARISON_AGENT_PROMPT = """You are a **Workout Comparison Specialist** for cycling training analysis.

Your role: Analyze how well an athlete executed their planned workouts compared to the training plan.

**Available Tools:**
- `compare_workout`: Compare a single day's planned vs actual workout
- `compare_weekly_workouts`: Compare an entire week of planned vs actual workouts

**Your Responsibilities:**

1. **Daily Comparison:**
   - Determine if the workout was completed
   - Calculate duration, intensity, and TSS compliance
   - Identify specific deviations (e.g., too easy, too short, wrong type)
   - Provide actionable recommendations

2. **Weekly Comparison:**
   - Track overall completion rate
   - Identify patterns (e.g., skipping hard workouts, cutting duration)
   - Assess weekly training load compliance
   - Provide coaching insights

3. **Coaching Insights:**
   - If compliance is low, suggest reasons (fatigue, schedule conflicts)
   - If workouts are consistently modified, recommend plan adjustments
   - Highlight positive adherence patterns

**Analysis Framework:**

Compliance Score = weighted average of:
- Completion (40%): Did workout happen?
- Duration match (25%): How close to planned duration?
- Intensity match (25%): Time in correct zones?
- TSS match (10%): Overall training stress?

**Output Format:**
Provide clear, concise analysis with:
- Compliance metrics (percentages)
- Specific deviations identified
- Actionable recommendations
- Patterns observed (for weekly)

Be objective but supportive. Focus on helping the athlete improve adherence while recognizing valid reasons for modifications.
"""
```

### 5. **CLI Commands** (`src/cycling_ai/cli/commands/compare.py`)

New command file:

```python
@click.group()
def compare():
    """Compare planned vs actual workout execution."""
    pass

@compare.command()
@click.option("--date", required=True, help="Workout date (YYYY-MM-DD)")
@click.option("--plan", "plan_path", required=True, type=click.Path(exists=True))
@click.option("--csv", "csv_path", required=True, type=click.Path(exists=True))
@click.option("--provider", default="anthropic", help="LLM provider")
def daily(date: str, plan_path: str, csv_path: str, provider: str):
    """Compare single day's planned vs actual workout."""
    # Create agent with WORKOUT_COMPARISON_AGENT_PROMPT
    # Execute comparison
    # Display results

@compare.command()
@click.option("--week-start", required=True, help="Week start date (YYYY-MM-DD)")
@click.option("--plan", "plan_path", required=True, type=click.Path(exists=True))
@click.option("--csv", "csv_path", required=True, type=click.Path(exists=True))
@click.option("--provider", default="anthropic", help="LLM provider")
def weekly(week_start: str, plan_path: str, csv_path: str, provider: str):
    """Compare entire week's planned vs actual workouts."""
    # Create agent with WORKOUT_COMPARISON_AGENT_PROMPT
    # Execute weekly comparison
    # Display results
```

Add to main CLI (`src/cycling_ai/cli/main.py`):
```python
from cycling_ai.cli.commands.compare import compare

cli.add_command(compare)
```

---

## 🔄 Integration Options

### Option A: Standalone Agent (Recommended for MVP)

**Usage:**
```bash
# Compare single workout
cycling-ai compare daily --date 2024-11-01 --plan plan.json --csv activities.csv

# Compare weekly
cycling-ai compare weekly --week-start 2024-10-28 --plan plan.json --csv activities.csv
```

**Pros:**
- Simple, focused functionality
- Easy to test and iterate
- Users can run on-demand
- No impact on existing workflows

**Cons:**
- Separate from report generation
- Manual invocation required

### Option B: Integrated into Multi-Agent Workflow

Add as **Phase 5** in `MultiAgentOrchestrator`:

**New Phase: Workout Compliance Analysis**
- Runs after Phase 3 (Training Planning)
- Compares recently generated plan against recent actual workouts
- Adds compliance section to HTML reports

**Changes needed:**
1. Add `_execute_phase_workout_comparison()` to `multi_agent.py`
2. Add workout comparison section to HTML templates
3. Make phase optional via `--include-compliance` flag

**Pros:**
- Integrated into comprehensive reports
- Automated compliance tracking
- Holistic view of planning + execution

**Cons:**
- Increases workflow complexity
- Longer execution time
- Only useful if training plan exists

---

## 📊 Key Algorithms

### 1. **Compliance Score Calculation**

```python
def calculate_compliance_score(planned: PlannedWorkout, actual: ActualWorkout | None) -> float:
    if actual is None:
        return 0.0  # Workout skipped

    # Component scores (0-100)
    completion_score = 100.0  # Workout happened

    duration_score = min(100, (actual.duration_minutes / planned.planned_duration_minutes) * 100)

    # Intensity compliance: compare zone distribution
    intensity_score = calculate_zone_match_score(planned.planned_intensity_zones, actual.intensity_zones)

    # TSS compliance
    tss_score = 100.0
    if planned.planned_tss and actual.actual_tss:
        tss_score = min(100, (actual.actual_tss / planned.planned_tss) * 100)

    # Weighted average
    return (
        completion_score * 0.40 +
        duration_score * 0.25 +
        intensity_score * 0.25 +
        tss_score * 0.10
    )
```

### 2. **Zone Match Scoring**

```python
def calculate_zone_match_score(planned_zones: dict[str, int], actual_zones: dict[str, int]) -> float:
    """
    Compare time-in-zone distribution.
    Returns 0-100 score based on how well actual matches planned.
    """
    total_deviation = 0.0
    total_planned_time = sum(planned_zones.values())

    for zone, planned_minutes in planned_zones.items():
        actual_minutes = actual_zones.get(zone, 0)
        deviation = abs(planned_minutes - actual_minutes)
        total_deviation += deviation

    # Perfect match = 100, complete mismatch = 0
    if total_planned_time == 0:
        return 100.0

    deviation_pct = total_deviation / total_planned_time
    return max(0, 100 - (deviation_pct * 100))
```

### 3. **Pattern Identification (Weekly)**

```python
def identify_weekly_patterns(daily_comparisons: list[WorkoutComparison]) -> list[str]:
    """Identify patterns in weekly workout compliance."""
    patterns = []

    # Pattern: Skipping hard workouts
    hard_workouts = [c for c in daily_comparisons if c.planned.workout_type in ["threshold", "vo2max"]]
    if len(hard_workouts) >= 2:
        skipped_hard = [c for c in hard_workouts if not c.completed]
        if len(skipped_hard) >= 2:
            patterns.append("Tendency to skip high-intensity workouts")

    # Pattern: Cutting duration short
    completed = [c for c in daily_comparisons if c.completed]
    if completed:
        avg_duration_compliance = sum(c.duration_compliance_pct for c in completed) / len(completed)
        if avg_duration_compliance < 80:
            patterns.append(f"Workouts consistently shorter than planned ({avg_duration_compliance:.0f}% avg)")

    # Pattern: Weekend warrior
    weekend_workouts = [c for c in daily_comparisons if c.date.weekday() >= 5]
    if weekend_workouts:
        weekend_compliance = sum(c.compliance_score for c in weekend_workouts) / len(weekend_workouts)
        weekday_workouts = [c for c in daily_comparisons if c.date.weekday() < 5]
        if weekday_workouts:
            weekday_compliance = sum(c.compliance_score for c in weekday_workouts) / len(weekday_workouts)
            if weekend_compliance > weekday_compliance + 20:
                patterns.append("Higher compliance on weekends vs weekdays")

    return patterns
```

---

## 🧪 Testing Strategy

### Unit Tests (`tests/core/test_workout_comparison.py`)

```python
class TestWorkoutComparer:
    def test_perfect_compliance(self):
        """Test workout executed exactly as planned."""
        planned = PlannedWorkout(...)
        actual = ActualWorkout(...)  # Perfect match

        comparer = WorkoutComparer()
        result = comparer.compare_daily_workout(planned, actual)

        assert result.compliance_score == 100.0
        assert result.completed
        assert len(result.deviations) == 0

    def test_workout_skipped(self):
        """Test skipped workout."""
        planned = PlannedWorkout(...)
        actual = None

        result = comparer.compare_daily_workout(planned, actual)

        assert result.compliance_score == 0.0
        assert not result.completed
        assert "Workout skipped" in result.deviations

    def test_intensity_deviation(self):
        """Test workout with wrong intensity."""
        planned = PlannedWorkout(
            planned_intensity_zones={"Z2": 60, "Z3": 0}
        )
        actual = ActualWorkout(
            intensity_zones={"Z2": 30, "Z3": 30}  # Too hard
        )

        result = comparer.compare_daily_workout(planned, actual)

        assert result.compliance_score < 80
        assert any("intensity" in d.lower() for d in result.deviations)
```

### Integration Tests (`tests/tools/test_workout_comparison_tool.py`)

```python
@pytest.mark.integration
def test_compare_workout_tool_with_real_data(sample_plan, sample_csv):
    """Test tool with real training plan and activity data."""
    tool = CompareWorkoutTool()

    result = tool.execute(
        date="2024-11-01",
        training_plan_path=str(sample_plan),
        activities_csv_path=str(sample_csv),
    )

    assert result.success
    data = json.loads(result.output)
    assert "compliance_score" in data
    assert "deviations" in data
```

### End-to-End Tests (`tests/orchestration/test_workout_comparison_agent.py`)

```python
@pytest.mark.integration
def test_workout_comparison_agent_daily(anthropic_provider, sample_plan, sample_csv):
    """Test daily comparison agent with real LLM."""
    session = ConversationSession(provider_name="anthropic")
    agent = LLMAgent(
        provider=anthropic_provider,
        session=session,
        system_prompt=WORKOUT_COMPARISON_AGENT_PROMPT,
    )

    executor = ToolExecutor()
    agent.register_tools([CompareWorkoutTool()])

    response = agent.process_message(
        f"Compare the workout on 2024-11-01 from plan {sample_plan} "
        f"against actual execution in {sample_csv}"
    )

    assert "compliance" in response.lower()
    # Verify tool was called
    assert any(msg.role == "tool" for msg in session.messages)
```

---

## 📈 Example Outputs

### Daily Comparison Output (CLI)

```
Workout Comparison - November 1, 2024
=====================================

PLANNED WORKOUT:
  Type: Threshold intervals
  Duration: 90 minutes
  TSS: 85
  Target zones: Z2 (45 min), Z4 (30 min), Z1 (15 min)

ACTUAL WORKOUT:
  Duration: 75 minutes (83% of planned)
  TSS: 72 (85% of planned)
  Zones: Z2 (40 min), Z4 (25 min), Z1 (10 min)

COMPLIANCE ANALYSIS:
  Overall Score: 81/100
  ✓ Workout completed
  ⚠ Duration: 15 minutes shorter than planned
  ⚠ TSS: 13 points below target
  ⚠ Z4 intervals: 5 minutes short

DEVIATIONS:
  - Workout cut short by 17%
  - Threshold intervals reduced by 17%
  - Overall intensity slightly below target

RECOMMENDATION:
  Workout mostly completed but cut short. If time constraints
  are recurring, consider adjusting plan duration. Otherwise,
  aim to complete full workout duration next time.
```

### Weekly Comparison Output (CLI)

```
Weekly Workout Comparison - October 28 - November 3, 2024
=========================================================

SUMMARY:
  Workouts planned: 5
  Workouts completed: 4 (80%)
  Average compliance: 76/100
  Total TSS: 312 / 380 planned (82%)

DAILY BREAKDOWN:
  Mon Oct 28: Recovery ride       ✓ 95/100
  Tue Oct 29: Threshold intervals ✓ 81/100
  Wed Oct 30: Rest day            - (planned rest)
  Thu Oct 31: Endurance ride      ✗ Skipped
  Fri Nov 01: VO2max intervals    ✓ 68/100
  Sat Nov 02: Long endurance      ✓ 82/100

PATTERNS IDENTIFIED:
  ⚠ High-intensity workouts consistently shorter than planned
  ⚠ Thursday workout missed (scheduling conflict?)
  ✓ Weekend compliance excellent (avg 88/100)

COACHING INSIGHTS:
  You're completing most workouts but cutting intensity work short.
  This may impact training adaptations. Consider:
  1. Reducing interval duration in plan if time is limited
  2. Ensuring proper recovery before hard sessions
  3. Protecting Thursday slot or moving workout to different day

  Positive: Recovery and endurance rides well executed!
```

---

## 🚀 Implementation Phases

### Phase 1: Core Foundation (1-2 days)
**Goal:** Implement data models and core comparison algorithms

**Tasks:**
- Define data models (PlannedWorkout, ActualWorkout, WorkoutComparison, WeeklyComparison)
- Implement WorkoutComparer class with core algorithms
- Implement compliance scoring logic
- Implement zone match scoring
- Implement pattern identification
- Write comprehensive unit tests (90%+ coverage goal)

**Deliverables:**
- `src/cycling_ai/core/models.py` (updated with new models)
- `src/cycling_ai/core/workout_comparison.py` (new module)
- `tests/core/test_workout_comparison.py` (unit tests)

**Success Criteria:**
- All unit tests passing
- Type safety: `mypy --strict` compliance
- Coverage: 90%+ on workout_comparison.py

---

### Phase 2: Tool Wrappers (1 day)
**Goal:** Create MCP-style tools for LLM interaction

**Tasks:**
- Create CompareWorkoutTool in `tools/wrappers/workout_comparison_tool.py`
- Create CompareWeeklyWorkoutsTool
- Ensure auto-discovery via ToolRegistry
- Write tool integration tests
- Test JSON serialization of results

**Deliverables:**
- `src/cycling_ai/tools/wrappers/workout_comparison_tool.py` (new file)
- `tests/tools/test_workout_comparison_tool.py` (integration tests)

**Success Criteria:**
- Tools auto-discovered by registry
- JSON output format validated
- Integration tests passing with sample data

---

### Phase 3: Agent & Prompts (1 day)
**Goal:** Create specialized agent with optimized prompt

**Tasks:**
- Add WORKOUT_COMPARISON_AGENT_PROMPT to `orchestration/prompts.py`
- Add prompt getter methods to AgentPromptsManager
- Test prompt with real LLM (Anthropic Claude recommended)
- Iterate on prompt based on output quality
- Write end-to-end agent tests

**Deliverables:**
- `src/cycling_ai/orchestration/prompts.py` (updated)
- `tests/orchestration/test_workout_comparison_agent.py` (e2e tests)

**Success Criteria:**
- Agent produces accurate, actionable insights
- Tool calling works reliably
- Output format is clear and helpful

---

### Phase 4: CLI Commands (1 day)
**Goal:** Add user-facing CLI commands

**Tasks:**
- Create `cli/commands/compare.py` with daily and weekly subcommands
- Add compare command group to main CLI
- Implement output formatting (tables, colors, symbols)
- Add --verbose flag for debugging
- Write CLI integration tests

**Deliverables:**
- `src/cycling_ai/cli/commands/compare.py` (new file)
- `src/cycling_ai/cli/main.py` (updated to include compare command)
- `tests/cli/test_compare.py` (CLI tests)

**Success Criteria:**
- Commands work end-to-end with real data
- Output is clear and user-friendly
- Error handling is robust

---

### Phase 5: Integration (Optional, 1-2 days)
**Goal:** Integrate into multi-agent workflow for automated compliance tracking

**Tasks:**
- Add `_execute_phase_workout_comparison()` to MultiAgentOrchestrator
- Update HTML templates with compliance section
- Add --include-compliance flag to generate command
- Test integration with full workflow
- Update documentation

**Deliverables:**
- `src/cycling_ai/orchestration/multi_agent.py` (updated)
- `templates/compliance_section.html` (new template)
- Updated user documentation

**Success Criteria:**
- Phase executes successfully after Phase 3
- Compliance data flows into HTML reports
- Optional flag works correctly
- No performance degradation

---

## 📝 Usage Examples

### Standalone Usage

```bash
# Compare today's workout
cycling-ai compare daily \
  --date 2024-11-01 \
  --plan ~/.cycling-ai/training_plan.json \
  --csv ~/.cycling-ai/activities.csv

# Compare this week
cycling-ai compare weekly \
  --week-start 2024-10-28 \
  --plan ~/.cycling-ai/training_plan.json \
  --csv ~/.cycling-ai/activities.csv \
  --provider anthropic

# Use different provider
cycling-ai compare daily \
  --date 2024-11-01 \
  --plan plan.json \
  --csv activities.csv \
  --provider openai

# Verbose mode for debugging
cycling-ai compare weekly \
  --week-start 2024-10-28 \
  --plan plan.json \
  --csv activities.csv \
  --verbose
```

### Conversational Chat Usage

```bash
cycling-ai chat --provider anthropic

> "Compare my workout from yesterday against the plan"
> "How well did I follow the plan last week?"
> "Show me patterns in my workout compliance over the last month"
> "Which workouts do I tend to skip?"
```

### Integrated Workflow Usage (Phase 5)

```bash
# Generate report with compliance analysis
cycling-ai generate \
  --profile profile.json \
  --fit-dir ./fit/ \
  --provider anthropic \
  --include-compliance

# Output includes compliance section in HTML reports
```

---

## 🎯 Success Criteria

### Technical Excellence
1. **Type Safety:** Full `mypy --strict` compliance throughout
2. **Test Coverage:** 90%+ on core algorithms, 80%+ overall
3. **Performance:** Comparison completes in < 10 seconds for weekly analysis
4. **Code Quality:** Follows existing patterns and conventions

### Functionality
1. **Accuracy:** Compliance scores accurately reflect workout adherence
2. **Insights:** Agent provides actionable coaching recommendations
3. **Usability:** Clear, easy-to-understand output format
4. **Flexibility:** Works standalone AND in multi-agent workflow

### User Experience
1. **Clear Output:** CLI output is formatted, readable, actionable
2. **Error Handling:** Helpful error messages for missing/invalid data
3. **Documentation:** User guide with examples
4. **Performance:** Fast execution, minimal LLM token usage

---

## 📚 Data Requirements

### Training Plan Format

Expected JSON structure for training plans:

```json
{
  "athlete_id": "athlete_123",
  "plan_name": "12-Week Base Building",
  "start_date": "2024-10-01",
  "end_date": "2024-12-24",
  "weeks": [
    {
      "week_number": 1,
      "start_date": "2024-10-01",
      "workouts": [
        {
          "date": "2024-10-01",
          "type": "endurance",
          "duration_minutes": 90,
          "tss": 65,
          "intensity_zones": {
            "Z1": 10,
            "Z2": 75,
            "Z3": 5
          },
          "description": "Easy endurance ride",
          "intervals": null
        },
        {
          "date": "2024-10-02",
          "type": "threshold",
          "duration_minutes": 75,
          "tss": 85,
          "intensity_zones": {
            "Z1": 10,
            "Z2": 35,
            "Z4": 25,
            "Z1": 5
          },
          "description": "Threshold intervals: 3x10min @ FTP",
          "intervals": [
            {
              "duration_minutes": 10,
              "target_power_watts": 265,
              "target_zone": 4,
              "target_hr": null
            }
          ]
        }
      ]
    }
  ]
}
```

### Activities CSV Format

Required columns in activities.csv:

- **Activity Date** (YYYY-MM-DD)
- **Activity Name** (string)
- **Activity Type** (Ride, Virtual Ride, etc.)
- **Distance** (km)
- **Moving Time** (HH:MM:SS or seconds)
- **Elevation Gain** (meters)
- **Average Power** (watts, optional)
- **Normalized Power** (watts, optional)
- **Average Heart Rate** (bpm, optional)

Optional but recommended for accurate comparison:
- **Training Stress Score (TSS)**
- **Intensity Factor (IF)**
- Time in power zones (Z1-Z7)

---

## 🔧 Technical Considerations

### Workout Matching Algorithm

**Challenge:** Match planned workouts to actual activities when:
- Activity names don't match plan descriptions
- Activities are on different days than planned
- Multiple activities in one day
- Workouts are split across multiple activities

**Solution:**
1. **Primary match:** Exact date match
2. **Fuzzy match:** ±1 day with type similarity
3. **Activity combination:** Sum multiple activities on same day
4. **User confirmation:** Ambiguous matches flagged for review

### TSS Calculation

If TSS not available in activity data, calculate using:

```python
def calculate_tss(
    duration_hours: float,
    normalized_power: int,
    ftp: int,
) -> float:
    """Calculate Training Stress Score."""
    if normalized_power == 0 or ftp == 0:
        return 0.0

    intensity_factor = normalized_power / ftp
    tss = (duration_hours * normalized_power * intensity_factor) / (ftp * 3600) * 100
    return round(tss, 1)
```

### Zone Distribution Calculation

If zone data not in CSV, calculate from power data in FIT files:

```python
def calculate_zone_distribution(
    power_stream: list[int],
    zones: PowerZones,
) -> dict[str, int]:
    """Calculate minutes spent in each power zone."""
    zone_minutes = defaultdict(int)

    for power_watts in power_stream:
        zone = zones.get_zone_for_power(power_watts)
        zone_minutes[zone] += 1  # Assuming 1-second resolution

    # Convert seconds to minutes
    return {zone: seconds // 60 for zone, seconds in zone_minutes.items()}
```

---

## 🚧 Known Limitations & Future Enhancements

### Current Limitations

1. **Requires structured training plan:** Must have JSON format with workout details
2. **Single-activity assumption:** Doesn't handle split workouts (e.g., commute + workout)
3. **No strength training:** Only cycling workouts
4. **Limited interval analysis:** Basic comparison only, not interval-by-interval
5. **English only:** Output messages not internationalized

### Future Enhancements

**Phase 6: Advanced Features**
- Interval-by-interval comparison for structured workouts
- Multi-activity workout detection and combination
- Historical compliance trends (monthly, yearly)
- Predictive insights: "You tend to skip Thursday workouts"
- Integration with calendar/scheduling tools
- Mobile/web dashboard for compliance tracking
- Automated weekly compliance reports via email

**Phase 7: Machine Learning**
- Predict likelihood of workout completion
- Recommend optimal workout timing based on historical compliance
- Detect fatigue patterns from compliance data
- Suggest plan modifications based on adherence patterns

---

## 📖 Documentation Requirements

### User Documentation

Create `docs/USER_GUIDE_WORKOUT_COMPARISON.md`:
- Overview and use cases
- CLI command reference
- Training plan JSON format specification
- Example workflows
- Interpreting compliance scores
- Troubleshooting common issues

### Developer Documentation

Update `CLAUDE.md`:
- Add workout comparison to architecture overview
- Document new data models
- Add to "Common Tasks & How-Tos" section
- Update directory structure
- Add to quick reference

### API Documentation

Add docstrings following existing patterns:
- Module-level documentation
- Class and method docstrings with examples
- Type hints for all public interfaces
- Usage examples in docstrings

---

## 🔍 Testing Data Requirements

### Test Fixtures

Create realistic test data:

**Training Plan Fixture** (`tests/fixtures/sample_training_plan.json`):
- 2-week plan with variety of workout types
- Mix of endurance, threshold, VO2max, recovery
- Some rest days
- Realistic TSS and duration values

**Activities CSV Fixture** (`tests/fixtures/sample_activities_with_compliance.csv`):
- Matching activities for perfect compliance test
- Modified activities for partial compliance test
- Missing activities for skipped workout test
- Extra activities for unplanned workout test

**Parquet Cache Fixture** (generated from CSV):
- Pre-processed activities with zones calculated
- Used for performance testing

---

## 💡 Design Decisions & Rationale

### Why Weighted Compliance Score?

**Rationale:** Not all deviations are equal in impact.

- **Completion (40%):** Most important - did workout happen at all?
- **Duration (25%):** Significant impact on training load
- **Intensity (25%):** Critical for workout effectiveness
- **TSS (10%):** Derived metric, less reliable than components

### Why Session Isolation for Agent?

**Rationale:** Follows existing multi-agent pattern for consistency.

- Fresh context prevents prompt contamination
- Clear separation of concerns
- Easier to debug and test
- Consistent with existing phases

### Why Standalone First (Option A)?

**Rationale:** Lower risk, faster delivery, easier iteration.

- Independent testing and validation
- No impact on existing workflows
- Users can experiment without commitment
- Can integrate later once proven

---

## 📊 Performance Estimates

### Token Usage (Claude Sonnet)

**Daily Comparison:**
- Prompt: ~800 tokens
- Tool call: ~200 tokens
- Response: ~300 tokens
- **Total: ~1,300 tokens (~$0.01)**

**Weekly Comparison:**
- Prompt: ~1,000 tokens
- Tool call: ~500 tokens (more data)
- Response: ~800 tokens (patterns + insights)
- **Total: ~2,300 tokens (~$0.02)**

### Execution Time

**Daily Comparison:**
- Data loading: ~0.5s
- Comparison logic: ~0.1s
- LLM processing: ~2-3s
- **Total: ~3s**

**Weekly Comparison:**
- Data loading: ~1s
- Comparison logic: ~0.3s
- LLM processing: ~3-4s
- **Total: ~5s**

---

## 🎓 Learning Objectives for Implementation

As you implement this feature, you will:

1. **Practice MCP pattern:** Tool creation, registration, execution
2. **Master dataclass design:** Complex nested structures with validation
3. **Apply TDD:** Write tests first, drive implementation
4. **Implement business algorithms:** Scoring, pattern detection, matching
5. **Design effective prompts:** Specialized agent with clear responsibilities
6. **Handle real-world data:** Missing values, edge cases, format variations
7. **Create great UX:** Clear CLI output, helpful error messages

---

## ✅ Acceptance Criteria

Before marking this feature complete, verify:

### Code Quality
- [ ] All tests passing (unit, integration, e2e)
- [ ] Type safety: `mypy --strict` passes
- [ ] Code coverage: 90%+ on core logic, 80%+ overall
- [ ] Linting: `ruff check` passes with no errors
- [ ] Formatting: `ruff format` applied

### Functionality
- [ ] Daily comparison works with perfect compliance
- [ ] Daily comparison works with partial compliance
- [ ] Daily comparison works with skipped workout
- [ ] Weekly comparison aggregates correctly
- [ ] Weekly comparison identifies patterns
- [ ] Compliance scores are accurate and meaningful
- [ ] Deviations are clear and actionable

### User Experience
- [ ] CLI commands work end-to-end
- [ ] Output is formatted and readable
- [ ] Error messages are helpful
- [ ] --verbose flag provides debugging info
- [ ] Examples in documentation work

### Documentation
- [ ] User guide created
- [ ] CLAUDE.md updated
- [ ] API documentation complete
- [ ] Example data provided
- [ ] Troubleshooting section added

### Integration (if Phase 5)
- [ ] Multi-agent workflow integration works
- [ ] HTML reports include compliance section
- [ ] Optional flag works correctly
- [ ] No performance regression

---

## 🚀 Getting Started

### Step 1: Set Up Branch

```bash
git checkout -b feature/workout-comparison-agent
```

### Step 2: Create Test Fixtures

Create `tests/fixtures/sample_training_plan.json` with realistic data.

### Step 3: Start with Phase 1 (Core Foundation)

Begin with data models and core algorithms - the foundation of everything else.

### Step 4: Follow TDD

Write tests first, then implement to make them pass.

### Step 5: Iterate

Test with real data early and often. Refine algorithms based on real-world results.

---

## 📞 Questions & Decisions Needed

Before implementation begins, clarify:

1. **Training Plan Format:** Is the JSON format specified above acceptable, or do we need to support existing format?

2. **Integration Priority:** Should we implement Phase 5 (multi-agent integration) in first version, or defer to later?

3. **Workout Matching:** How should we handle ambiguous matches (e.g., activity on different day)?

4. **Compliance Thresholds:** What compliance score ranges map to "excellent", "good", "needs improvement"?

5. **Pattern Sensitivity:** How many occurrences define a "pattern" (e.g., skipping 2 vs 3 workouts)?

---

**End of Plan**

Ready to implement when you are!
