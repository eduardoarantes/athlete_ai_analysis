# Workout Detailed Descriptions - Implementation Plan

**Status:** Draft for Review
**Created:** 2025-11-01
**Target Completion:** TBD

---

## Executive Summary

This plan adds comprehensive, scientifically-grounded workout descriptions to complement the existing short workout names. Users will see both a concise name (e.g., "VO2 Max intervals") and detailed physiological explanations (e.g., "Short interval HIIT is an effective means of enhancing your maximal oxygen uptake (VO2max)...").

### Current State
- Workouts have a single `description` field (~3-25 words)
- This description serves as both the name and the only descriptive text
- Example: "High intensity intervals to boost aerobic capacity"

### Target State
- Workouts have two description fields:
  - `name` (3-10 words): Short, scannable workout identifier
  - `detailed_description` (100-250 words): Comprehensive explanation including:
    - Recommended environment (indoor/outdoor)
    - Physiological adaptations targeted
    - Training benefits and mechanisms
    - Execution guidance

---

## Architecture Overview

### Data Flow
```
LLM Prompt (updated)
    ↓
LLM generates workout with name + detailed_description
    ↓
Domain Model (Workout class - updated)
    ↓
Validation (training.py - updated schema)
    ↓
Report Data JSON (updated structure)
    ↓
HTML Template (updated UI)
    ↓
User sees both name + detailed description
```

### Affected Layers
1. **Prompts Layer** - Update training planning prompt to request detailed descriptions
2. **Domain Model** - Add `detailed_description` field, rename `description` to `name`
3. **Tool Wrappers** - Update tool parameter schemas to accept both fields
4. **Validation** - Update schema validation for new fields
5. **Serialization** - Ensure JSON output includes both fields
6. **LLM Response Parsing** - No changes needed (automatic from tool results)
7. **UI Templates** - Display both name and detailed description appropriately

---

## Implementation Tasks

### Phase 1: Domain Model Changes

#### 1.1 Update `Workout` class in `src/cycling_ai/core/workout_builder.py`

**Current Structure:**
```python
class Workout:
    def __init__(self, weekday: str, description: str = ""):
        self.weekday = weekday
        self.description = description  # Short description
        self.segments: list[WorkoutSegment] = []
```

**New Structure:**
```python
class Workout:
    def __init__(
        self,
        weekday: str,
        name: str = "",  # Renamed from description
        detailed_description: str = ""  # NEW FIELD
    ):
        self.weekday = weekday
        self.name = name  # Short workout name (3-10 words)
        self.detailed_description = detailed_description  # Detailed explanation (100-250 words)
        self.segments: list[WorkoutSegment] = []
```

**Changes Required:**
- [x] Rename `description` parameter to `name`
- [x] Add `detailed_description` parameter
- [x] Update `to_dict()` method to include both fields
- [x] Update all builder functions (`build_threshold_workout`, `build_vo2max_workout`, etc.)
- [x] Add detailed descriptions to each builder function

**Example Updated Builder:**
```python
def build_vo2max_workout(ftp: int, weekday: str, intervals: str = "5x5", week: int = 1) -> Workout:
    """Build a VO2 max workout"""

    name = "VO2 Max intervals"

    detailed_description = (
        "Ideally perform this on your trainer, although outdoors works fine too. "
        "Short interval HIIT is an effective means of enhancing your maximal oxygen "
        "uptake (VO2max) and performance. The workout uses short bouts of work above "
        "your pVO2max, with passive relief periods, to enable recruitment of your larger "
        "fast twitch muscles, as well as stimulation of maximal cardiac output (your heart). "
        "Focus on maintaining consistent power throughout each interval and use the recovery "
        "periods to let your heart rate drop before the next effort."
    )

    workout = Workout(weekday, name, detailed_description)
    # ... rest of implementation
```

**Files to Update:**
- `src/cycling_ai/core/workout_builder.py` - All builder functions
- Tests: `tests/core/test_workout_builder.py` - Update assertions

**Backward Compatibility:**
- Keep `description` as alias to `name` in `to_dict()` for existing consumers
- Mark `description` as deprecated in docstrings

---

#### 1.2 Update Validation in `src/cycling_ai/core/training.py`

**Current Validation:**
```python
# Validate workout has description
if "description" not in workout:
    # ... error handling
```

**New Validation:**
```python
# Validate workout has name (required)
if "name" not in workout and "description" not in workout:
    errors.append(f"Week {week_num}, {day}: Workout missing 'name' or 'description' field")

# Validate detailed_description (optional but recommended)
if "detailed_description" in workout:
    desc_len = len(workout["detailed_description"])
    if desc_len < 50:
        errors.append(f"Week {week_num}, {day}: 'detailed_description' should be at least 50 characters (got {desc_len})")
    elif desc_len > 500:
        errors.append(f"Week {week_num}, {day}: 'detailed_description' should be at most 500 characters (got {desc_len})")
```

**Files to Update:**
- `src/cycling_ai/core/training.py` - `validate_training_plan()`
- Tests: `tests/core/test_training.py` - Add validation tests

---

#### 1.3 Update Tool Wrappers

**IMPORTANT:** The tools layer needs updates to accept the new workout fields from the LLM.

##### 1.3.1 Update `create_workout` Tool (Optional - Not Used by Training Planning)

**File:** `src/cycling_ai/tools/wrappers/workout_builder_tool.py`

**Current Parameter (line 50-58):**
```python
ToolParameter(
    name="description",
    type="string",
    description=(
        "Coaching notes and purpose of the workout. Explain what this workout "
        "aims to achieve (e.g., 'Build FTP with sustained efforts', "
        "'Develop aerobic base with steady Z2 riding')."
    ),
    required=True,
),
```

**Updated Parameters:**
```python
ToolParameter(
    name="name",
    type="string",
    description=(
        "Short workout name (3-10 words). Examples: 'VO2 Max intervals', "
        "'Threshold repeats', 'Endurance base'. This is the scannable "
        "identifier shown in calendar views."
    ),
    required=True,
),
ToolParameter(
    name="detailed_description",
    type="string",
    description=(
        "Comprehensive workout explanation (100-250 words) including: "
        "1) Environment recommendation (indoor/outdoor), "
        "2) Physiological target (what system this trains), "
        "3) Training benefits (how this improves performance), "
        "4) Execution guidance (how to perform effectively)."
    ),
    required=False,  # Optional for backward compatibility
),
```

**Update Tool Execution (line 166):**
```python
# Current:
workout = Workout(weekday=weekday, description=description)

# New:
name = kwargs.get("name", kwargs.get("description", "Workout"))
detailed_description = kwargs.get("detailed_description", "")
workout = Workout(weekday=weekday, name=name, detailed_description=detailed_description)
```

**Note:** The `create_workout` tool is **not actively used** by the training planning prompt. The LLM sends workouts directly in the `weekly_plan` array to `finalize_training_plan`. This update is for **future-proofing** and consistency.

---

##### 1.3.2 Update `finalize_training_plan` Tool (CRITICAL - Used by Training Planning)

**File:** `src/cycling_ai/tools/wrappers/training_plan_tool.py`

**Current Workout Schema in `weekly_plan` Parameter (lines 117-127):**
```python
"description": {
    "type": "STRING",
    "description": "Workout purpose and coaching notes"
},
```

**Updated Workout Schema:**
```python
"name": {
    "type": "STRING",
    "description": "Short workout name (3-10 words). Examples: 'VO2 Max intervals', 'Threshold repeats'"
},
"detailed_description": {
    "type": "STRING",
    "description": (
        "Comprehensive workout explanation (100-250 words) including: "
        "environment recommendation, physiological target, training benefits, "
        "and execution guidance. REQUIRED for all workouts."
    )
},
```

**Update Required Fields (line 158):**
```python
# Current:
"required": ["weekday", "description", "segments"]

# New - Support both old and new field names:
"required": ["weekday", "segments"]
# Note: We make both name and description optional to support migration
# Validation will check for at least one
```

**Update Validation Logic:**

Add validation after line 270 to ensure workouts have proper descriptions:

```python
# After loading weekly_plan, validate each workout has name or description
for week in weekly_plan:
    for workout in week.get("workouts", []):
        # Check for name field (new) or description field (old)
        if "name" not in workout and "description" not in workout:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[
                    f"Week {week.get('week_number')}, {workout.get('weekday')}: "
                    f"Workout missing both 'name' and 'description' fields. "
                    f"At least one is required."
                ],
            )

        # Encourage detailed_description
        if "detailed_description" not in workout:
            logger.warning(
                f"Week {week.get('week_number')}, {workout.get('weekday')}: "
                f"Workout missing 'detailed_description' field. "
                f"Consider adding for better user experience."
            )
```

**Files to Update:**
- `src/cycling_ai/tools/wrappers/training_plan_tool.py` - Update workout schema
- `src/cycling_ai/tools/wrappers/workout_builder_tool.py` - Update parameters (optional)
- Tests: `tests/tools/wrappers/test_training_plan_tool.py` - Test both old and new formats

---

##### 1.3.3 LLM Response Parsing (No Changes Needed)

**Good News:** The orchestration layer (`multi_agent.py`) already handles this correctly!

**How it works:**
1. LLM calls `finalize_training_plan` tool with updated JSON
2. Tool wrapper receives the JSON with `name` and `detailed_description` fields
3. Tool passes it to `core.training.finalize_training_plan()`
4. Result is wrapped in `ToolExecutionResult.data`
5. Orchestrator extracts via `_extract_phase_data()` (line 380-448)
6. No parsing changes needed - it's already JSON-based extraction

**Code Reference (`multi_agent.py:405-407`):**
```python
if message.role == "tool" and message.tool_results:
    for tool_result in message.tool_results:
        if tool_result.get("success"):
            # Automatically extracts JSON from tool results
            # No hardcoded field parsing needed
```

**Why this is elegant:**
- The orchestrator doesn't care about specific field names
- It extracts whatever JSON the tool returns
- Adding new fields like `detailed_description` "just works"
- No parser updates required

---

### Phase 2: Prompt Engineering

#### 2.1 Update Training Planning Prompt

**File:** `prompts/default/1.1/training_planning.txt`

**Current Workout Description Guidance:**
```
- `description` (≤25 words)
```

**New Workout Description Guidance:**
```
- `name` (3-10 words) - Short, scannable workout identifier
  Examples: "VO2 Max intervals", "Threshold repeats", "Endurance base"

- `detailed_description` (100-250 words, REQUIRED) - Comprehensive workout explanation
  MUST include ALL of the following:
  1. **Environment recommendation** (indoor trainer / outdoor / either)
  2. **Physiological target** (what system/adaptation this targets)
  3. **Training benefits** (how this improves performance)
  4. **Execution guidance** (how to perform effectively)

  Example structure:
  "Ideally perform this [on trainer/outdoors/either]. This workout targets [physiological system]
  by [mechanism]. The [type] intervals enhance [adaptation] through [process].
  Focus on [key execution points]."

  Examples:
  - VO2 Max: "Ideally perform this on your trainer, although outdoors works fine too.
    Short interval HIIT is an effective means of enhancing your maximal oxygen uptake (VO2max)
    and performance. The workout uses short bouts of work above your pVO2max, with passive
    relief periods, to enable recruitment of your larger fast twitch muscles, as well as
    stimulation of maximal cardiac output (your heart). Focus on maintaining consistent power
    throughout each interval and use recovery periods to let heart rate drop before next effort."

  - Sweet Spot: "This workout is suitable for both indoor trainer and outdoor riding. Sweet spot
    training targets the intersection of aerobic capacity and lactate threshold, maximizing FTP
    gains while remaining sustainable. These sub-threshold intervals (88-93% FTP) accumulate
    significant time-in-zone without the fatigue cost of true threshold work, making them ideal
    for building race-ready endurance. Maintain smooth, controlled power and focus on efficient
    pedaling throughout each interval."

  - Endurance: "Best performed outdoors on varied terrain to build mental resilience and handling
    skills. Long endurance rides develop aerobic capacity through mitochondrial biogenesis and
    improved fat oxidation, creating the foundation for all higher-intensity work. Zone 2 efforts
    should feel conversational—you should be able to talk in complete sentences. Stay disciplined
    with power targets; going too hard defeats the purpose of aerobic base building."
```

**Token Budget Impact:**
- Current per-workout: ~150 characters for description
- New per-workout: ~50 chars (name) + ~800 chars (detailed_description) = ~850 chars
- Net increase: ~700 characters per workout
- For 12-week plan with 48 workouts: +33,600 characters (~8,400 tokens)

**Mitigation Strategy:**
- Increase token budget for training planning phase from 14,000 to 22,000 characters
- Optimize other fields slightly to compensate:
  - `phase_rationale`: Keep at 3-5 words
  - `weekly_focus`: Keep at 2-3 words
  - `segment descriptions`: Keep at 1-3 words

**Files to Update:**
- `prompts/default/1.1/training_planning.txt` - Main prompt
- `src/cycling_ai/orchestration/prompts.py` - If hardcoded prompts exist

---

### Phase 3: UI Template Updates

#### 3.1 Update Calendar View (Compact Display)

**File:** `templates/training_plan_viewer.html`

**Current Display (lines ~1614):**
```javascript
const descDisplay = workout.description ?
    `<div class="workout-desc">${workout.description}</div>` : '';
```

**New Display:**
```javascript
// Show only the short name in calendar view
const nameDisplay = workout.name || workout.description || 'Workout';
const nameHTML = `<div class="workout-name">${nameDisplay}</div>`;

// Don't show detailed description in calendar (too much text)
```

**CSS Updates (lines ~531-556):**
```css
/* Keep existing styles, ensure workout-name is prominent */
.workout-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

/* Remove or repurpose workout-desc for calendar view */
.workout-desc {
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-weight: 400;
    margin-top: 0.25rem;
    /* Only used in calendar for ultra-short hints if needed */
}
```

---

#### 3.2 Update Modal View (Full Display)

**File:** `templates/training_plan_viewer.html`

**Current Modal Description (lines ~1112-1115):**
```html
<div class="workout-description" id="modal-description-container">
    <h4>Workout Description</h4>
    <p id="modal-description">Loading...</p>
</div>
```

**New Modal Layout:**
```html
<!-- Workout Name (prominent) -->
<div class="workout-name-header">
    <h3 id="modal-workout-name">Workout Name</h3>
</div>

<!-- Detailed Description (expandable section) -->
<div class="workout-description-detailed" id="modal-description-container">
    <h4>
        <span class="icon">📖</span>
        About This Workout
    </h4>
    <div class="description-content" id="modal-detailed-description">
        <p>Loading detailed description...</p>
    </div>
</div>

<!-- Keep existing structure section below -->
<div class="workout-structure">
    <h4>Workout Structure</h4>
    <div class="segments-list" id="modal-segments">
        <!-- ... -->
    </div>
</div>
```

**JavaScript Update (line ~1682):**
```javascript
// Current:
document.getElementById('modal-description').textContent =
    workout.description || 'No description available';

// New:
document.getElementById('modal-workout-name').textContent =
    workout.name || workout.description || 'Workout';

const detailedDesc = workout.detailed_description ||
    workout.description ||
    'No detailed description available.';

// Convert markdown-style formatting if present
document.getElementById('modal-detailed-description').innerHTML =
    convertMarkdownToHTML(detailedDesc);
```

**CSS Updates (lines ~722-741):**
```css
/* Workout name in modal header */
.workout-name-header {
    margin-bottom: 1.5rem;
}

.workout-name-header h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

/* Detailed description section */
.workout-description-detailed {
    background: linear-gradient(135deg, #fff5f0 0%, #fffaf7 100%);
    border-left: 4px solid var(--accent-orange);
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
}

.workout-description-detailed h4 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.workout-description-detailed .icon {
    font-size: 1.25rem;
}

.description-content {
    color: var(--text-secondary);
    line-height: 1.8;
    font-size: 0.95rem;
}

.description-content p {
    margin-bottom: 1rem;
}

.description-content p:last-child {
    margin-bottom: 0;
}

/* Highlight key terms */
.description-content strong {
    color: var(--text-primary);
    font-weight: 600;
}
```

---

#### 3.3 Update Standalone Viewer

**File:** `templates/standalone_training_plan_viewer.html`

**Similar changes as above:**
- Update workout name display (line ~473)
- Add detailed description section
- Match styling from main viewer

---

### Phase 4: Testing & Validation

#### 4.1 Unit Tests

**New Tests in `tests/core/test_workout_builder.py`:**
```python
def test_workout_has_name_and_detailed_description():
    """Test that workout includes both name and detailed description"""
    workout = build_vo2max_workout(ftp=250, weekday="Tuesday")

    assert workout.name != ""
    assert len(workout.name) >= 3
    assert len(workout.name) <= 50

    assert workout.detailed_description != ""
    assert len(workout.detailed_description) >= 100
    assert len(workout.detailed_description) <= 500

def test_workout_to_dict_includes_both_descriptions():
    """Test serialization includes both fields"""
    workout = build_threshold_workout(ftp=265, weekday="Wednesday")
    data = workout.to_dict(ftp=265)

    assert "name" in data
    assert "detailed_description" in data
    # Backward compatibility
    assert "description" in data  # Should alias to name

def test_all_workout_builders_have_detailed_descriptions():
    """Ensure all builders provide detailed descriptions"""
    builders = [
        build_threshold_workout,
        build_vo2max_workout,
        build_sweetspot_workout,
        build_tempo_workout,
        build_endurance_workout,
    ]

    for builder_func in builders:
        workout = builder_func(ftp=250, weekday="Tuesday")
        assert len(workout.detailed_description) >= 100, \
            f"{builder_func.__name__} missing detailed description"
```

**New Tests in `tests/core/test_training.py`:**
```python
def test_validate_plan_with_detailed_descriptions():
    """Test validation accepts detailed descriptions"""
    plan_data = {
        "total_weeks": 2,
        "weekly_plan": [
            {
                "week_number": 1,
                "phase": "Foundation",
                "workouts": [
                    {
                        "weekday": "Tuesday",
                        "name": "VO2 Max intervals",
                        "detailed_description": "A" * 150,  # Valid length
                        "segments": [...]
                    }
                ]
            },
            # Week 2...
        ]
    }

    is_valid, errors = validate_training_plan(
        plan_data,
        available_days=["Tuesday"],
        weekly_hours=5.0
    )

    assert is_valid
    assert len(errors) == 0

def test_validate_rejects_short_detailed_description():
    """Test validation warns about too-short detailed descriptions"""
    # Test with <50 char detailed_description
    # Should produce warning error
```

---

#### 4.2 Integration Tests

**Test with Real LLM in `tests/integration/test_training_plan_generation.py`:**
```python
@pytest.mark.integration
def test_llm_generates_detailed_descriptions(anthropic_provider, test_athlete_profile):
    """Test that LLM generates both name and detailed_description for workouts"""

    config = WorkflowConfig(
        csv_file_path=test_csv_path,
        athlete_profile_path=test_profile_path,
        training_plan_weeks=4,
        provider_name="anthropic"
    )

    orchestrator = MultiAgentOrchestrator(provider=anthropic_provider)
    result = orchestrator.execute_workflow(config)

    assert result.success

    # Load generated report data
    report_data = json.loads(Path(result.output_files[0]).read_text())

    # Check each workout has both fields
    for athlete in report_data["athletes"]:
        weekly_plan = athlete["training_plan"]["weekly_plan"]
        for week in weekly_plan:
            for workout in week["workouts"]:
                assert "name" in workout, \
                    f"Week {week['week_number']} missing workout name"
                assert "detailed_description" in workout, \
                    f"Week {week['week_number']} missing detailed_description"

                # Validate lengths
                assert len(workout["detailed_description"]) >= 100, \
                    f"Detailed description too short: {len(workout['detailed_description'])} chars"

                # Validate content quality (basic checks)
                desc = workout["detailed_description"].lower()
                # Should mention environment or execution
                assert any(term in desc for term in ["indoor", "outdoor", "trainer", "perform"]), \
                    "Detailed description missing environment/execution guidance"
```

---

#### 4.3 Manual Testing Checklist

- [ ] Generate 4-week plan, verify all workouts have both fields
- [ ] Generate 12-week plan, verify token budget is sufficient
- [ ] Check calendar view shows compact workout names
- [ ] Check modal view shows detailed descriptions with good formatting
- [ ] Test with different workout types (VO2, threshold, endurance, etc.)
- [ ] Verify markdown formatting works in detailed descriptions
- [ ] Test responsive design on mobile (detailed desc should wrap nicely)
- [ ] Verify standalone viewer also shows detailed descriptions
- [ ] Check browser performance with long descriptions (should be fine)

---

## Detailed Description Content Guidelines

### Template Structure

Each detailed description should follow this pattern:

```
[ENVIRONMENT] + [PHYSIOLOGICAL TARGET] + [BENEFITS] + [EXECUTION GUIDANCE]
```

### Examples by Workout Type

#### VO2 Max Intervals
```
Ideally perform this on your trainer, although outdoors works fine too. Short interval
HIIT is an effective means of enhancing your maximal oxygen uptake (VO2max) and performance.
The workout uses short bouts of work above your pVO2max, with passive relief periods, to
enable recruitment of your larger fast twitch muscles, as well as stimulation of maximal
cardiac output (your heart). Focus on maintaining consistent power throughout each interval
and use the recovery periods to let your heart rate drop before the next effort.
```

#### Threshold (FTP) Intervals
```
This workout works equally well indoors on a trainer or outdoors on steady terrain. Threshold
intervals target your lactate threshold, the highest sustainable power output you can maintain
for approximately one hour. By accumulating time at or near FTP (90-105%), you improve your
body's ability to buffer lactate and sustain higher power outputs for extended periods.
Maintain smooth, consistent power throughout each interval—avoid surges or power spikes.
Focus on controlled breathing and efficient pedaling technique.
```

#### Sweet Spot Training
```
This workout is suitable for both indoor trainer and outdoor riding. Sweet spot training
targets the intersection of aerobic capacity and lactate threshold, maximizing FTP gains
while remaining sustainable. These sub-threshold intervals (88-93% FTP) accumulate significant
time-in-zone without the fatigue cost of true threshold work, making them ideal for building
race-ready endurance. Maintain smooth, controlled power and focus on efficient pedaling
throughout each interval.
```

#### Tempo Intervals
```
Best performed outdoors where you can sustain steady efforts on rolling terrain. Tempo work
(76-85% FTP) develops aerobic endurance and muscular stamina while remaining below your
lactate threshold. This "comfortably hard" effort improves fat oxidation, mitochondrial
density, and mental resilience for long events. Keep power steady and avoid the temptation
to drift into threshold—tempo should feel sustainable for the entire duration.
```

#### Endurance Rides
```
Best performed outdoors on varied terrain to build mental resilience and handling skills.
Long endurance rides develop aerobic capacity through mitochondrial biogenesis and improved
fat oxidation, creating the foundation for all higher-intensity work. Zone 2 efforts should
feel conversational—you should be able to talk in complete sentences. Stay disciplined with
power targets; going too hard defeats the purpose of aerobic base building. Focus on smooth
pedaling and enjoying the ride.
```

#### Recovery Rides
```
Ideally performed outdoors at a very easy pace. Recovery rides promote active recovery
through increased blood flow without accumulating additional fatigue. Keep power in Zone 1
(under 55% FTP) and resist the urge to go harder—this is truly about recovery, not training.
Short 30-60 minute spins help flush metabolic waste products and maintain pedaling economy
without taxing your body's recovery systems. If you feel good, that's perfect—stay easy anyway.
```

### Key Elements to Include

1. **Environment Recommendation**
   - Indoor trainer vs. outdoor
   - Terrain suggestions if outdoor
   - Why that environment is optimal

2. **Physiological Target**
   - What system is being trained (aerobic, anaerobic, neuromuscular)
   - Specific adaptations (VO2max, lactate threshold, fat oxidation)
   - Physiological mechanisms

3. **Performance Benefits**
   - How this translates to better racing/riding
   - What type of events this prepares you for
   - Long-term training value

4. **Execution Guidance**
   - Pacing strategy
   - Technical focus points
   - Common mistakes to avoid
   - Mental approach

---

## Migration Strategy

### Backward Compatibility

**Option 1: Gradual Migration (Recommended)**
- Keep `description` field as alias to `name` in serialization
- Accept either `description` or `name` in validation
- Templates fall back: `workout.name || workout.description`
- Mark `description` as deprecated in docs
- Plan removal in v0.2.0

**Option 2: Breaking Change (Not Recommended)**
- Rename `description` → `name` everywhere immediately
- Requires regeneration of all existing training plans
- Update all existing JSON files

**Recommendation: Use Option 1** to maintain backward compatibility with existing report data.

---

## Rollout Plan

### Phase 1: Core Implementation (Week 1)
1. Update domain models (`Workout` class)
2. Update builder functions with detailed descriptions
3. **Update tool wrappers** (`training_plan_tool.py` and optionally `workout_builder_tool.py`)
4. Update validation logic (both core and tool layer)
5. Write unit tests
6. Ensure backward compatibility

### Phase 2: Prompt Engineering (Week 1)
1. Update training planning prompt with new field requirements
2. Test token budget with 12-week plans
3. Refine description guidelines and examples
4. Test with real LLM (integration tests)
5. Verify tool schema accepts both old and new formats

### Phase 3: UI Implementation (Week 2)
1. Update calendar view (show name only)
2. Update modal view (show both name + detailed)
3. Add CSS styling for detailed descriptions
4. Test responsive design
5. Update standalone viewer

### Phase 4: Testing & Refinement (Week 2)
1. Generate multiple test plans (4, 8, 12 weeks)
2. Review description quality
3. Gather feedback on UI presentation
4. Performance testing
5. Documentation updates

---

## Success Metrics

### Code Quality
- [ ] All unit tests passing (target: 100% for new code)
- [ ] Integration tests passing with real LLM
- [ ] `mypy --strict` passes
- [ ] No ruff linting errors

### Content Quality
- [ ] 100% of workouts have detailed descriptions
- [ ] All detailed descriptions are 100-250 words
- [ ] Descriptions include all 4 required elements (environment, physiology, benefits, execution)
- [ ] No generic/repetitive descriptions

### User Experience
- [ ] Calendar view remains scannable (not cluttered)
- [ ] Modal view provides valuable detail
- [ ] Descriptions are scientifically accurate
- [ ] Formatting is readable and professional

### Performance
- [ ] Page load time increase <100ms
- [ ] Token usage increase <10,000 tokens per 12-week plan
- [ ] No UI lag when opening modals

---

## Risks & Mitigation

### Risk 1: Token Budget Overflow
**Impact:** High - Could fail to generate complete plans
**Probability:** Medium
**Mitigation:**
- Test with 12-week plans during development
- Add hard char limits in prompts
- Implement validation that checks total plan size
- Provide fallback: if too long, auto-shorten segment descriptions

### Risk 2: LLM Generates Low-Quality Descriptions
**Impact:** Medium - Reduces user value
**Probability:** Medium
**Mitigation:**
- Provide detailed examples in prompt
- Add validation for minimum length
- Implement keyword checks (must mention environment, benefits, etc.)
- Human review of first 10 generated plans

### Risk 3: UI Becomes Cluttered
**Impact:** Low - Slightly worse UX
**Probability:** Low
**Mitigation:**
- Keep calendar view minimal (name only)
- Make detailed description collapsible in modal if needed
- Use progressive disclosure patterns
- Test with real users

### Risk 4: Backward Compatibility Issues
**Impact:** Medium - Breaks existing reports
**Probability:** Low (if we use gradual migration)
**Mitigation:**
- Implement fallbacks (`workout.name || workout.description`)
- Keep `description` field in serialization
- Clear migration guide in docs
- Version the report data format

---

## Open Questions

1. **Description Length:** Is 100-250 words the right range, or should we allow up to 300?
   - **Recommendation:** Start with 100-250, expand if users request more detail

2. **Markdown Support:** Should we support full markdown (lists, bold, etc.) or plain text?
   - **Recommendation:** Support basic markdown (**bold**, bullet lists) for readability

3. **Collapsible UI:** Should detailed descriptions be collapsible to save space?
   - **Recommendation:** Keep expanded by default, add collapse option if feedback suggests it's too much

4. **Pre-written Library:** Should we maintain a library of pre-written descriptions for common workouts?
   - **Recommendation:** No—let LLM generate contextual descriptions, but provide strong examples in prompt

5. **Translation:** Do we need to support multiple languages for descriptions?
   - **Recommendation:** Not in v0.1.0—add in future version if requested

---

## Future Enhancements (Not in Scope)

- **Video Links:** Embed demonstration videos for complex workouts
- **Athlete Notes:** Allow users to add personal notes/reflections per workout
- **Coach Overrides:** Let coaches edit LLM-generated descriptions
- **Audio Cues:** Text-to-speech for workout descriptions during execution
- **Multi-language Support:** Translate descriptions to other languages
- **Description Templates:** User-selectable tone (technical, beginner-friendly, motivational)

---

## References

### Internal Documentation
- `docs/REPORT_DATA_FORMAT.md` - Report data schema
- `docs/HTML_VIEWER_GUIDE.md` - Template structure
- `CLAUDE.md` - Overall project architecture

### Training Science Resources
- Hunter Allen & Andrew Coggan - "Training and Racing with a Power Meter"
- Stephen Seiler - Polarized Training Research
- Coggan's Power Training Levels (used for zone descriptions)

### Code Files Referenced
- `src/cycling_ai/core/workout_builder.py:41-289` - Workout class and builders
- `src/cycling_ai/core/training.py:15-321` - Validation logic
- `prompts/default/1.1/training_planning.txt:1-100` - Current prompt
- `templates/training_plan_viewer.html:531-1682` - UI components

---

## Appendix A: Example Complete Workout JSON

```json
{
  "weekday": "Tuesday",
  "name": "VO2 Max intervals",
  "detailed_description": "Ideally perform this on your trainer, although outdoors works fine too. Short interval HIIT is an effective means of enhancing your maximal oxygen uptake (VO2max) and performance. The workout uses short bouts of work above your pVO2max, with passive relief periods, to enable recruitment of your larger fast twitch muscles, as well as stimulation of maximal cardiac output (your heart). Focus on maintaining consistent power throughout each interval and use the recovery periods to let your heart rate drop before the next effort.",
  "segments": [
    {
      "type": "warmup",
      "duration_min": 15,
      "power_low_pct": 50,
      "power_high_pct": 75,
      "description": "Progressive warmup"
    },
    {
      "type": "interval",
      "duration_min": 5,
      "power_low_pct": 106,
      "power_high_pct": 115,
      "description": "VO2 effort"
    },
    {
      "type": "recovery",
      "duration_min": 5,
      "power_low_pct": 50,
      "power_high_pct": 50,
      "description": "Easy spin"
    },
    {
      "type": "cooldown",
      "duration_min": 10,
      "power_low_pct": 50,
      "power_high_pct": 65,
      "description": "Easy cooldown"
    }
  ],
  "tss": 85.2
}
```

---

## Appendix B: CSS Color Variables Reference

From `templates/training_plan_viewer.html`:

```css
:root {
    --primary-blue: #0066cc;
    --accent-orange: #ff6b35;
    --accent-teal: #00a8a8;
    --success-green: #00c896;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-light: #999999;
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-card: #ffffff;
    --border-light: #e0e0e0;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

Use these for styling detailed description sections to maintain visual consistency.

---

**Plan Status:** Ready for Implementation
**Next Steps:**
1. Review this plan with team/stakeholders
2. Create GitHub issues for each phase
3. Begin Phase 1 implementation
4. Update this document with actual implementation notes as work progresses
