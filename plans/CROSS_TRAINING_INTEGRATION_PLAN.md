# Cross-Training Analysis Integration Plan

**Status:** Planning
**Date:** 2025-10-31
**Context:** Integrate cross-training impact analysis into multi-agent workflow for athletes doing multiple sports

---

## Overview

The original codebase had sophisticated cross-training analysis capabilities that examined how non-cycling activities (strength training, running, swimming, etc.) impact cycling performance. This feature exists in the current codebase but is **not integrated into the multi-agent workflow**. This plan outlines how to conditionally incorporate it when athletes participate in multiple sports.

---

## Current State Analysis

### ✅ What Already Exists

1. **Core Business Logic** (`src/cycling_ai/core/cross_training.py`)
   - `calculate_weekly_load_distribution()` - Weekly TSS breakdown by activity category
   - `detect_interference_events()` - Identifies poor timing (e.g., strength before hard cycling)
   - `calculate_performance_windows()` - Rolling correlations
   - `analyze_cross_training_impact()` - Main analysis function

2. **Tool Wrapper** (`src/cycling_ai/tools/wrappers/cross_training_tool.py`)
   - `CrossTrainingTool` - Registered tool available to LLM agents
   - Tool name: `analyze_cross_training_impact`
   - Supports both Parquet cache and CSV input
   - Returns structured JSON with interference events, load balance, recommendations

3. **Activity Categorization** (`src/cycling_ai/utils/activity_categorizer.py`)
   - Classifies activities into: Cycling, Strength, Cardio, Other
   - Adds metadata: `muscle_focus`, `fatigue_impact`, `recovery_hours`, `intensity_category`
   - Already integrated into cache preparation

4. **Historical Agent Prompts** (`.claude/agents/cycling-analysis-agent.md`)
   - Line 29: `analyze_cross_training_impact` - Listed as available tool
   - Lines 118-124: Cross-training analysis workflow documented
   - Guidance on when/how to use the tool

### ❌ What's Missing

1. **Not integrated into multi-agent workflow** (`multi_agent.py`)
   - Phase 2 (Performance Analysis) doesn't call cross-training tool
   - No conditional logic to detect if athlete does multiple sports
   - No data extraction for cross-training results

2. **Prompts don't reference cross-training**
   - `prompts/default/1.1/performance_analysis.txt` - No mention of cross-training
   - Tool not listed in available tools
   - No guidance on when to analyze cross-training

3. **No configuration option**
   - `WorkflowConfig` doesn't have flag to enable/disable cross-training analysis
   - No auto-detection logic based on activity diversity

4. **Report templates don't include cross-training data**
   - HTML templates would need sections for:
     - Load distribution charts
     - Interference timeline
     - Activity balance recommendations

---

## Integration Strategy

### Design Principles

1. **Conditional Execution** - Only analyze if athlete does non-cycling activities
2. **Auto-Detection** - Automatically detect multi-sport athletes
3. **Non-Breaking** - Cyclists-only users see no change
4. **Lightweight** - Minimal token overhead if not needed
5. **Actionable** - Focus on scheduling conflicts and load balance

### Detection Logic

**When to analyze cross-training:**

```python
def should_analyze_cross_training(df: pd.DataFrame) -> bool:
    """
    Determine if cross-training analysis is warranted.

    Criteria:
    - At least 10% of activities are non-cycling
    - At least 3 different activity categories
    - Minimum 20 total activities in period
    """
    if len(df) < 20:
        return False

    category_counts = df['activity_category'].value_counts()

    # Need multiple categories
    if len(category_counts) < 2:
        return False

    # Need meaningful non-cycling volume
    non_cycling_pct = (df['activity_category'] != 'Cycling').sum() / len(df)
    if non_cycling_pct < 0.10:  # Less than 10% non-cycling
        return False

    return True
```

---

## Implementation Plan

### Phase A: Configuration & Detection (1-2 hours)

**Objective:** Add configuration support and auto-detection logic

#### A1. Add configuration option

**File:** `src/cycling_ai/orchestration/multi_agent.py`

```python
@dataclass
class WorkflowConfig:
    # ... existing fields ...

    # New field
    analyze_cross_training: bool | None = None  # None = auto-detect
    cross_training_weeks: int = 12  # Default analysis period
```

**Changes:**
- Add `analyze_cross_training` parameter (None = auto-detect, True = force, False = skip)
- Add `cross_training_weeks` parameter for analysis period

#### A2. Implement auto-detection

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**New method:**
```python
def _should_analyze_cross_training(
    self,
    cache_file_path: str,
    threshold_pct: float = 0.10,
    min_activities: int = 20
) -> bool:
    """
    Auto-detect if cross-training analysis is needed.

    Returns True if:
    - Athlete has >= 10% non-cycling activities
    - >= 20 total activities in cache
    - >= 2 different activity categories
    """
    import pandas as pd

    df = pd.read_parquet(cache_file_path)

    if len(df) < min_activities:
        return False

    category_counts = df['activity_category'].value_counts()

    if len(category_counts) < 2:
        return False

    non_cycling_pct = (df['activity_category'] != 'Cycling').sum() / len(df)
    return non_cycling_pct >= threshold_pct
```

#### A3. Update CLI commands

**File:** `src/cycling_ai/cli/commands/generate.py`

**Add option:**
```python
@click.option(
    "--cross-training/--no-cross-training",
    default=None,
    help="Analyze cross-training impact (auto-detect if not specified)",
)
@click.option(
    "--cross-training-weeks",
    type=int,
    default=12,
    help="Weeks to analyze for cross-training impact (default: 12)",
)
```

**Pass to WorkflowConfig:**
```python
config = WorkflowConfig(
    # ... existing parameters ...
    analyze_cross_training=cross_training,
    cross_training_weeks=cross_training_weeks,
)
```

---

### Phase B: Prompt Integration (1-2 hours)

**Objective:** Update prompts to include cross-training analysis

#### B1. Update performance analysis system prompt

**File:** `prompts/default/1.1/performance_analysis.txt`

**Add to Available Tools section (line 21):**
```
- analyze_cross_training_impact: Analyze how non-cycling activities affect cycling (CONDITIONAL - only if athlete does multiple sports)
```

**Add to Objectives section (line 17):**
```
5. Analyze cross-training impact (IF athlete does multiple sports)
```

**Add to Output Schema:**
```json
{
  // ... existing fields ...

  "cross_training": {
    "analyzed": false,
    "activity_distribution": [
      {
        "category": "string",
        "count": 0,
        "percentage": 0.0
      }
    ],
    "load_balance": {
      "cycling_percent": 0.0,
      "strength_percent": 0.0,
      "cardio_percent": 0.0,
      "assessment": "string"
    },
    "interference_events": [
      {
        "date": "YYYY-MM-DD",
        "activity1": "string",
        "activity2": "string",
        "hours_between": 0.0,
        "score": 0,
        "explanation": "string"
      }
    ],
    "recommendations": [
      {"text": "string"}
    ]
  }
}
```

#### B2. Update performance analysis user prompt

**File:** `prompts/default/1.1/performance_analysis_user.txt`

**Add conditional instruction:**
```
{cross_training_guidance}
```

**New template variable (added in prompt loader):**
```python
# If cross-training should be analyzed
cross_training_guidance = """
IMPORTANT: This athlete participates in multiple sports. You MUST analyze cross-training impact:

1. Call analyze_cross_training_impact(
    cache_file_path=<cache_path>,
    analysis_period_weeks={cross_training_weeks}
)

2. Include cross-training analysis in your JSON response under "cross_training" field

3. Focus on:
   - Activity distribution and load balance
   - Interference events (poor timing between activities)
   - Scheduling recommendations specific to this athlete
"""

# If cycling-only
cross_training_guidance = ""
```

---

### Phase C: Multi-Agent Orchestrator Integration (2-3 hours)

**Objective:** Integrate cross-training analysis into Phase 2 workflow

#### C1. Update Phase 2 execution

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**Method:** `_execute_phase_2()`

**Changes:**

```python
def _execute_phase_2(
    self,
    config: WorkflowConfig,
    phase1_result: PhaseResult
) -> PhaseResult:
    """Execute Phase 2: Performance Analysis."""

    cache_file_path = phase1_result.extracted_data.get("cache_file_path", "")

    # Auto-detect or use explicit config
    if config.analyze_cross_training is None:
        should_analyze_ct = self._should_analyze_cross_training(cache_file_path)
    else:
        should_analyze_ct = config.analyze_cross_training

    # Build user message with conditional cross-training guidance
    if should_analyze_ct:
        cross_training_guidance = self.prompts_manager.get_cross_training_guidance(
            cross_training_weeks=config.cross_training_weeks
        )
    else:
        cross_training_guidance = ""

    user_message = self.prompts_manager.get_performance_analysis_user_prompt(
        period_months=config.period_months,
        cross_training_guidance=cross_training_guidance,
    )

    # Execute phase with conditional tool availability
    available_tools = ["analyze_performance"]
    if should_analyze_ct:
        available_tools.append("analyze_cross_training_impact")

    return self._execute_phase(
        phase_name=PHASE_PERFORMANCE_ANALYSIS,
        config=config,
        prompt_getter=lambda: self.prompts_manager.get_performance_analysis_prompt(),
        tools=available_tools,
        phase_context=phase1_result.extracted_data,
        user_message=user_message,
    )
```

#### C2. Update data extraction

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**Method:** `_extract_phase_data()`

**Already exists (line 376-378):**
```python
elif tool_name == "analyze_cross_training_impact":
    data = json.loads(message.content)
    extracted["cross_training_data"] = data
```

**✅ No changes needed** - extraction already implemented!

#### C3. Update Phase 2 response validation

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**Method:** `_extract_and_validate_phase2_response()`

**Add cross-training schema validation:**
```python
# Validate cross_training field (optional)
if "cross_training" in data:
    ct_data = data["cross_training"]
    if not isinstance(ct_data, dict):
        logger.warning("cross_training field is not a dictionary")
    else:
        # Validate structure
        required_ct_fields = ["analyzed", "activity_distribution", "load_balance"]
        missing_ct_fields = [f for f in required_ct_fields if f not in ct_data]
        if missing_ct_fields:
            logger.warning(f"cross_training missing fields: {missing_ct_fields}")
```

---

### Phase D: Report Integration (3-4 hours)

**Objective:** Add cross-training sections to HTML reports

#### D1. Update report data schema

**File:** `src/cycling_ai/orchestration/multi_agent.py` (Phase 4)

**Ensure Phase 4 includes cross-training data in report JSON:**

```python
# In _execute_phase_4() or similar
if phase2_result.extracted_data.get("cross_training_data"):
    report_data["cross_training"] = phase2_result.extracted_data["cross_training_data"]
```

#### D2. Create HTML template sections

**Files to update:**
- `templates/performance_dashboard.html` - Add cross-training section
- `templates/coaching_insights.html` - Add cross-training insights

**New sections:**

**A. Activity Distribution Chart**
```html
{% if cross_training.analyzed %}
<section id="cross-training-analysis">
  <h2>Cross-Training Analysis</h2>

  <div class="chart-container">
    <h3>Activity Distribution</h3>
    <canvas id="activityDistributionChart"></canvas>
    <script>
      const ctx = document.getElementById('activityDistributionChart').getContext('2d');
      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: [{% for item in cross_training.activity_distribution %}'{{ item.category }}'{% if not loop.last %}, {% endif %}{% endfor %}],
          datasets: [{
            data: [{% for item in cross_training.activity_distribution %}{{ item.percentage }}{% if not loop.last %}, {% endif %}{% endfor %}],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          }]
        }
      });
    </script>
  </div>

  <div class="load-balance">
    <h3>Training Load Balance</h3>
    <p>Cycling: {{ cross_training.load_balance.cycling_percent }}%</p>
    <p>Strength: {{ cross_training.load_balance.strength_percent }}%</p>
    <p>Cardio: {{ cross_training.load_balance.cardio_percent }}%</p>
    <p class="assessment">{{ cross_training.load_balance.assessment }}</p>
  </div>
</section>
{% endif %}
```

**B. Interference Events Timeline**
```html
{% if cross_training.interference_events %}
<section id="interference-timeline">
  <h2>Scheduling Conflicts Detected</h2>
  <p class="warning">The following activity pairs may have interfered with performance:</p>

  <table class="interference-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Activity 1</th>
        <th>Activity 2</th>
        <th>Hours Between</th>
        <th>Risk Score</th>
        <th>Explanation</th>
      </tr>
    </thead>
    <tbody>
      {% for event in cross_training.interference_events %}
      <tr class="risk-{{ 'high' if event.score >= 7 else 'medium' if event.score >= 4 else 'low' }}">
        <td>{{ event.date }}</td>
        <td>{{ event.activity1 }}</td>
        <td>{{ event.activity2 }}</td>
        <td>{{ event.hours_between }}h</td>
        <td>{{ event.score }}/10</td>
        <td>{{ event.explanation }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</section>
{% endif %}
```

**C. Cross-Training Recommendations**
```html
{% if cross_training.recommendations %}
<section id="cross-training-recommendations">
  <h2>Scheduling Recommendations</h2>
  <ul>
    {% for rec in cross_training.recommendations %}
    <li>{{ rec.text }}</li>
    {% endfor %}
  </ul>
</section>
{% endif %}
```

#### D3. Add CSS styling

**File:** `templates/styles.css` (or inline in templates)

```css
/* Cross-Training Sections */
#cross-training-analysis {
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.load-balance {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-left: 4px solid #3b82f6;
}

.load-balance .assessment {
  font-weight: 600;
  color: #1f2937;
  margin-top: 0.5rem;
}

.interference-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.interference-table th,
.interference-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.interference-table .risk-high {
  background-color: #fee2e2;
}

.interference-table .risk-medium {
  background-color: #fef3c7;
}

.interference-table .risk-low {
  background-color: #dbeafe;
}
```

---

### Phase E: Testing & Validation (2-3 hours)

**Objective:** Comprehensive testing of cross-training integration

#### E1. Unit Tests

**File:** `tests/orchestration/test_multi_agent_cross_training.py` (NEW)

```python
import pytest
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator, WorkflowConfig

def test_should_analyze_cross_training_multi_sport(sample_multi_sport_cache):
    """Test auto-detection with multi-sport athlete."""
    orchestrator = MultiAgentOrchestrator(provider=mock_provider)

    should_analyze = orchestrator._should_analyze_cross_training(
        cache_file_path=sample_multi_sport_cache
    )

    assert should_analyze is True

def test_should_analyze_cross_training_cycling_only(sample_cycling_only_cache):
    """Test auto-detection with cycling-only athlete."""
    orchestrator = MultiAgentOrchestrator(provider=mock_provider)

    should_analyze = orchestrator._should_analyze_cross_training(
        cache_file_path=sample_cycling_only_cache
    )

    assert should_analyze is False

def test_workflow_with_cross_training_forced(sample_config):
    """Test workflow with cross-training forced on."""
    sample_config.analyze_cross_training = True

    orchestrator = MultiAgentOrchestrator(provider=mock_provider)
    result = orchestrator.execute_workflow(sample_config)

    # Should have cross-training data in Phase 2
    phase2_result = result.phase_results[1]
    assert "cross_training_data" in phase2_result.extracted_data

def test_workflow_with_cross_training_disabled(sample_config):
    """Test workflow with cross-training disabled."""
    sample_config.analyze_cross_training = False

    orchestrator = MultiAgentOrchestrator(provider=mock_provider)
    result = orchestrator.execute_workflow(sample_config)

    # Should NOT have cross-training data
    phase2_result = result.phase_results[1]
    assert "cross_training_data" not in phase2_result.extracted_data
```

#### E2. Integration Tests

**Test scenarios:**

1. **Multi-sport athlete (auto-detect)**
   - 60% cycling, 30% strength, 10% running
   - Should auto-enable cross-training analysis
   - Verify tool is called
   - Verify data extraction
   - Verify JSON response includes cross-training field

2. **Cycling-only athlete**
   - 100% cycling activities
   - Should NOT analyze cross-training
   - Verify tool is not called
   - Verify minimal token usage

3. **Edge case: Low activity count**
   - 15 total activities (below 20 threshold)
   - Should NOT analyze even if multi-sport
   - Verify graceful handling

4. **Edge case: Force flag overrides**
   - Cycling-only + `--cross-training` flag
   - Should analyze even with 100% cycling
   - Use case: Planning to add cross-training

#### E3. Real-world validation

**Test with real athlete data:**

1. **Eduardo's data** (multi-sport?)
   - Run full workflow with auto-detect
   - Verify HTML report includes cross-training sections
   - Check for interference events
   - Validate recommendations make sense

2. **Cycling-only dataset**
   - Run full workflow
   - Verify no performance degradation
   - Confirm no cross-training sections in report
   - Verify token usage is similar to before

---

## Rollout Strategy

### Step 1: Core Integration (Week 1)
- Implement Phases A, B, C
- Unit tests passing
- Manual testing with sample data

### Step 2: Report Integration (Week 1-2)
- Implement Phase D
- Update templates
- Visual QA on reports

### Step 3: Testing & Refinement (Week 2)
- Comprehensive test suite
- Real-world validation
- Performance benchmarking

### Step 4: Documentation (Week 2)
- Update CLAUDE.md
- Update USER_GUIDE_GENERATE.md
- Add examples to docs

---

## Success Criteria

### Functional Requirements
- ✅ Auto-detection works correctly (10% threshold, 20 activity minimum)
- ✅ Cross-training analysis only runs when needed
- ✅ Interference events are detected and reported
- ✅ Load balance recommendations are actionable
- ✅ HTML reports include cross-training sections
- ✅ Cycling-only athletes see no change

### Performance Requirements
- ✅ Token overhead < 500 tokens when cross-training enabled
- ✅ No overhead when disabled
- ✅ Analysis completes in < 10 seconds

### Quality Requirements
- ✅ 253+ tests passing (no regressions)
- ✅ New tests for cross-training (15+ tests)
- ✅ Type safety maintained (`mypy --strict`)
- ✅ Code coverage >= 85% for new code

---

## Open Questions

1. **Should cross-training analysis be part of Phase 2 or separate phase?**
   - **Recommendation:** Keep in Phase 2 (Performance Analysis)
   - **Rationale:** Logically related, minimal token overhead, simpler architecture

2. **What's the right auto-detection threshold?**
   - **Current proposal:** >= 10% non-cycling, >= 20 activities
   - **Alternative:** >= 5 non-cycling activities in period
   - **Need:** Real-world validation with diverse datasets

3. **Should we limit interference event reporting?**
   - **Current:** Top 5 high-interference events
   - **Alternative:** All events with score >= 4
   - **Trade-off:** Completeness vs readability

4. **Should cross-training data affect training plan generation (Phase 3)?**
   - **Current plan:** No - Phase 3 uses FTP and goals only
   - **Future enhancement:** Could adjust recovery days based on interference patterns
   - **Complexity:** Significant - defer to Phase 6

---

## Risk Assessment

### Low Risk
- ✅ Core business logic already exists and tested
- ✅ Tool wrapper already implemented
- ✅ Activity categorization already working

### Medium Risk
- ⚠️ Prompt engineering - Need to ensure LLM uses tool correctly
- ⚠️ JSON schema validation - Cross-training field is optional, need robust validation
- ⚠️ HTML template complexity - More dynamic sections

### Mitigation Strategies
- Extensive prompt testing with multiple providers
- Schema validation at extraction time
- Graceful degradation if cross-training data missing

---

## Alternative Approaches Considered

### Alternative 1: Separate Phase for Cross-Training
**Pros:** Clear separation, easier to skip
**Cons:** Extra phase overhead, more complex workflow
**Decision:** Rejected - too heavyweight for optional feature

### Alternative 2: Always analyze, hide if not relevant
**Pros:** Simpler code, no conditional logic
**Cons:** Token waste, slower for cycling-only athletes
**Decision:** Rejected - efficiency matters

### Alternative 3: Post-hoc analysis (separate command)
**Pros:** Completely optional, zero impact on main flow
**Cons:** Disconnected from main report, harder to correlate
**Decision:** Rejected - defeats purpose of comprehensive analysis

---

## Future Enhancements (Phase 6+)

1. **Cross-training aware training plans**
   - Adjust cycling workouts based on strength schedule
   - Recommend optimal spacing between conflicting activities
   - Periodize cross-training alongside cycling

2. **Advanced correlations**
   - Does strength training improve power?
   - Does running volume hurt cycling FTP?
   - Optimal strength:cycling ratio by age/gender

3. **Recovery modeling**
   - Predict recovery needs based on activity combinations
   - Dynamic TSB adjustments for multi-sport load
   - Personalized interference scores

4. **Interactive scheduling tool**
   - Visual calendar showing interference risks
   - Drag-and-drop activity scheduling
   - Real-time conflict detection

---

## References

- **Original agent configuration:** `.claude/agents/cycling-analysis-agent.md`
- **Core implementation:** `src/cycling_ai/core/cross_training.py`
- **Tool wrapper:** `src/cycling_ai/tools/wrappers/cross_training_tool.py`
- **Interference research:** *Concurrent Training for Sports Performance* (Leveritt et al.)
- **Polarized training:** *The Polarized Training Model* (Seiler & Kjerland)

---

## Appendix A: Detection Logic Examples

### Example 1: Multi-sport athlete (Eduardo?)
```
Activities in 12 weeks:
- Cycling: 45 rides (65%)
- Strength: 20 sessions (29%)
- Running: 4 runs (6%)

Total: 69 activities
Non-cycling: 35%

Auto-detect: YES ✅
Rationale: 35% > 10% threshold, 69 > 20 minimum
```

### Example 2: Cycling-only athlete
```
Activities in 12 weeks:
- Cycling: 48 rides (100%)

Total: 48 activities
Non-cycling: 0%

Auto-detect: NO ❌
Rationale: 0% < 10% threshold
```

### Example 3: Edge case - low activity
```
Activities in 12 weeks:
- Cycling: 10 rides (67%)
- Strength: 5 sessions (33%)

Total: 15 activities
Non-cycling: 33%

Auto-detect: NO ❌
Rationale: 15 < 20 minimum (insufficient data)
```

### Example 4: Triathlete
```
Activities in 12 weeks:
- Cycling: 30 rides (50%)
- Running: 20 runs (33%)
- Swimming: 10 swims (17%)

Total: 60 activities
Non-cycling: 50%

Auto-detect: YES ✅
Rationale: 50% > 10% threshold, 60 > 20 minimum
```

---

## Appendix B: Prompt Template Example

### Performance Analysis User Prompt (with cross-training)

```
Analyze cycling performance for the last {period_months} months using available tools.

**Required Analysis:**
1. Call analyze_performance to compare recent vs previous period
2. Extract key metrics and trends
3. Generate insights and recommendations

{cross_training_guidance}

**Output Format:**
Return ONLY valid JSON matching the schema in your system prompt.
No markdown, no code blocks, just the JSON object.
```

**When cross-training is enabled:**
```python
cross_training_guidance = """
**CROSS-TRAINING ANALYSIS (REQUIRED):**
This athlete participates in multiple sports. You MUST:

1. Call analyze_cross_training_impact(
    cache_file_path="{cache_path}",
    analysis_period_weeks={cross_training_weeks}
)

2. Analyze the results:
   - Activity distribution and balance
   - Interference events (activities too close together)
   - Load distribution across sport types

3. Include findings in your JSON response under "cross_training" field:
   - analyzed: true
   - activity_distribution: [...]
   - load_balance: {...}
   - interference_events: [...]
   - recommendations: [...]

4. Consider cross-training patterns when generating overall recommendations
"""
```

**When cycling-only:**
```python
cross_training_guidance = ""
```

---

**END OF PLAN**
