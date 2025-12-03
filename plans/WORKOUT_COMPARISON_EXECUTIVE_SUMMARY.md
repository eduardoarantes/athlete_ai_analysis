# Workout Comparison Agent - Executive Summary

**Created:** 2025-11-01
**Status:** Architecture Complete, Ready for Implementation
**Estimated Effort:** 6 days (48 hours)

---

## Overview

The Workout Comparison Agent is a new feature that analyzes how well athletes execute their planned training workouts, providing compliance metrics, pattern detection, and actionable coaching recommendations.

---

## Key Architecture Decisions

### 1. **Standalone-First Approach** ✅
- Implement as independent CLI commands: `cycling-ai compare daily` and `cycling-ai compare weekly`
- Easy to test, iterate, and use without impacting existing workflows
- Can integrate into multi-agent workflow later (optional Phase 5)

### 2. **Leverage Existing Patterns** ✅
- MCP-style tool architecture (auto-discovery via `@register_tool`)
- PromptLoader system for external prompt management
- Type-safe design with full `mypy --strict` compliance
- Session isolation following multi-agent pattern

### 3. **Compliance Scoring Framework** ✅
Weighted multi-factor scoring:
- **Completion (40%)**: Did the workout happen?
- **Duration (25%)**: How close to planned duration?
- **Intensity (25%)**: Time in correct zones?
- **TSS (10%)**: Overall training stress match?

Score: 0-100 (90-100 = excellent, 70-89 = good, 50-69 = moderate, <50 = poor)

### 4. **Data Model Extension** ✅
Extends existing training plan structure from `core/training.py`:
- No new format required - works with current training plans
- Leverages existing TSS calculations from `core/tss.py`
- Integrates with Parquet cache for performance

### 5. **Pattern Detection** ✅
Identifies weekly patterns:
- Skipping hard workouts (threshold, VO2max)
- Consistently cutting duration short
- Weekend warrior (better compliance on weekends)
- Specific day scheduling conflicts
- Intensity avoidance

---

## Component Architecture

```
Workout Comparison Feature
│
├── CLI Commands (User Interface)
│   ├── cycling-ai compare daily
│   └── cycling-ai compare weekly
│
├── Specialized Agent (LLM Orchestration)
│   ├── System prompt (PromptLoader)
│   └── User prompt templates
│
├── MCP Tools (Tool Layer)
│   ├── CompareWorkoutTool (daily)
│   └── CompareWeeklyWorkoutsTool (weekly)
│
└── Core Business Logic (Pure Python)
    ├── WorkoutComparer (main facade)
    ├── ComplianceScorer (scoring algorithms)
    ├── PatternDetector (pattern identification)
    ├── WorkoutMatcher (planned vs actual matching)
    ├── DeviationDetector (deviation identification)
    └── RecommendationEngine (coaching insights)
```

---

## Implementation Phases

### ✅ Phase 1: Core Foundation (Days 1-2)
**Goal:** Implement business logic with 90%+ test coverage

**Deliverables:**
- `src/cycling_ai/core/workout_comparison.py` (data models + algorithms)
- `tests/core/test_workout_comparison.py` (comprehensive unit tests)
- All algorithms validated with edge cases

**Key Components:**
- Data models: `PlannedWorkout`, `ActualWorkout`, `ComplianceMetrics`, `WorkoutComparison`, `WeeklyPattern`, `WeeklyComparison`
- Algorithms: compliance scoring, zone matching, pattern detection, workout matching
- 90%+ test coverage, `mypy --strict` compliant

---

### ✅ Phase 2: Tool Wrappers (Day 3)
**Goal:** Create MCP-style tools with auto-discovery

**Deliverables:**
- `src/cycling_ai/tools/wrappers/workout_comparison_tool.py`
- `tests/tools/wrappers/test_workout_comparison_tool.py`
- Test fixtures in `tests/fixtures/`

**Key Components:**
- `CompareWorkoutTool` (daily comparison)
- `CompareWeeklyWorkoutsTool` (weekly comparison)
- Auto-registration via `@register_tool`
- JSON serialization of results

---

### ✅ Phase 3: Prompts & Agent (Day 4)
**Goal:** Create specialized agent with effective prompts

**Deliverables:**
- `prompts/default/1.0/workout_comparison_agent.txt`
- `prompts/default/1.0/workout_comparison_user_daily.txt`
- `prompts/default/1.0/workout_comparison_user_weekly.txt`
- `tests/orchestration/test_workout_comparison_agent.py`

**Key Components:**
- System prompt with compliance framework
- User prompt templates for daily/weekly
- Integration with PromptLoader
- Agent tests (mock + real LLM)

---

### ✅ Phase 4: CLI Commands (Day 5)
**Goal:** Create user-facing CLI with great UX

**Deliverables:**
- `src/cycling_ai/cli/commands/compare.py`
- Updated `src/cycling_ai/cli/main.py`
- `tests/cli/test_compare_commands.py`

**Key Components:**
- `compare daily` command
- `compare weekly` command
- Output formatting (colors, emojis, clear structure)
- Error handling and validation

---

### ✅ Phase 5: Integration & Polish (Day 6)
**Goal:** Final testing, optimization, and documentation

**Deliverables:**
- `docs/USER_GUIDE_WORKOUT_COMPARISON.md`
- Updated `CLAUDE.md`
- All code polished and formatted
- All tests passing (target: 300+ total tests)

**Key Components:**
- End-to-end testing with real data
- Performance optimization (< 5s for weekly)
- Comprehensive documentation
- User testing and refinement

---

## Usage Examples

### Daily Comparison
```bash
cycling-ai compare daily \
  --date 2024-11-01 \
  --plan training_plan.json \
  --csv activities.csv \
  --profile athlete_profile.json \
  --provider anthropic
```

**Output:**
```
🔍 Comparing workout for 2024-11-01...

======================================================================
WORKOUT COMPARISON - 2024-11-01
======================================================================

COMPLIANCE SUMMARY: 81/100 (Good)
✓ Workout completed
⚠ Duration: 15 minutes shorter than planned (83% of target)
⚠ TSS: 13 points below target (85% of planned)
⚠ Z4 intervals: 5 minutes short

PLANNED WORKOUT:
  Type: Threshold intervals
  Duration: 90 minutes
  TSS: 85
  Zones: Z2 (45 min), Z4 (30 min), Z1 (15 min)

ACTUAL EXECUTION:
  Duration: 75 minutes
  TSS: 72
  Zones: Z2 (40 min), Z4 (25 min), Z1 (10 min)

RECOMMENDATION:
Workout mostly completed but cut short. If time constraints are
recurring, consider adjusting plan duration. Otherwise, aim to
complete full workout duration next time.
```

### Weekly Comparison
```bash
cycling-ai compare weekly \
  --week-start 2024-10-28 \
  --plan training_plan.json \
  --csv activities.csv \
  --profile athlete_profile.json
```

**Output:**
```
🔍 Comparing week starting 2024-10-28...

======================================================================
WEEKLY WORKOUT COMPARISON - Oct 28 - Nov 3, 2024
======================================================================

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
Consider:
1. Reducing interval duration in plan if time is limited
2. Ensuring proper recovery before hard sessions
3. Protecting Thursday slot or moving workout to different day

Positive: Recovery and endurance rides well executed!
```

---

## Performance Estimates

### Execution Time
- **Daily Comparison**: ~3 seconds (0.5s data + 0.1s logic + 2-3s LLM)
- **Weekly Comparison**: ~5 seconds (1s data + 0.3s logic + 3-4s LLM)

### Token Usage (Claude Sonnet)
- **Daily**: ~1,300 tokens (~$0.01)
- **Weekly**: ~2,300 tokens (~$0.02)

### Optimizations
- Use Parquet cache for 10x faster data loading
- Concise prompts to minimize tokens
- Lazy-load zone calculations
- Cache athlete profile and training plan

---

## Success Metrics

### Technical Excellence
- ✅ **Type Safety:** 100% `mypy --strict` compliance
- ✅ **Test Coverage:** 90%+ on core logic, 80%+ overall
- ✅ **Performance:** < 5s for weekly comparison
- ✅ **Code Quality:** Zero `ruff` errors

### Functionality
- ✅ **Accuracy:** Compliance scores within ±5% of manual calculation
- ✅ **Tool Reliability:** Tool calls succeed 95%+ of time
- ✅ **Pattern Detection:** 90%+ precision in identifying patterns
- ✅ **Recommendations:** Actionable in 95%+ of cases

### User Experience
- ✅ **Usability:** New users can run within 2 minutes
- ✅ **Clarity:** Output understandable without technical knowledge
- ✅ **Helpfulness:** Leads to plan adjustments or improved adherence
- ✅ **Documentation:** Self-service via comprehensive docs

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Training plan format mismatch | Comprehensive validation, clear format spec |
| Missing zone data | Fall back to basic metrics (duration, TSS) |
| Workout matching ambiguity | Fuzzy matching with similarity scoring |
| Performance degradation | Optimize data loading, use Parquet cache |

### Data Quality Risks
| Risk | Mitigation |
|------|------------|
| Incomplete training plans | Validation, clear error messages |
| Missing power data | Handle gracefully, focus on duration/completion |
| Multiple activities per day | Smart matching with combination logic |
| Timezone mismatches | Normalize dates to UTC or local timezone |

---

## Future Enhancements (Post-MVP)

### Phase 6: Multi-Agent Integration (Optional)
- Integrate into `MultiAgentOrchestrator` as optional Phase 5
- Add `--include-compliance` flag to `cycling-ai generate`
- Update HTML templates with compliance section
- Automated compliance tracking in reports

### Phase 7: Advanced Features
- Interval-by-interval comparison with charts
- Historical compliance trends (monthly, yearly)
- Predictive insights (ML-based adherence prediction)
- Calendar sync and reminders
- Mobile app integration

---

## Open Questions (To Clarify Before Implementation)

1. **Training Plan Format**
   - Is the existing format from `core/training.py` acceptable, or do we need modifications?
   - Current format uses `segments` with `type`, `duration_min`, `power_low_pct`, `power_high_pct`

2. **Integration Priority**
   - Should Phase 5 (multi-agent integration) be included in first version?
   - Recommendation: Start standalone, integrate later if proven valuable

3. **Workout Matching**
   - How to handle ambiguous matches (activity on different day)?
   - Recommendation: Fuzzy matching with ±1 day, similarity scoring

4. **Compliance Thresholds**
   - Are the proposed ranges (90-100 excellent, 70-89 good, etc.) appropriate?
   - Can be adjusted based on user feedback

5. **Pattern Sensitivity**
   - How many occurrences define a "pattern" (2 vs 3 workouts)?
   - Recommendation: 2 occurrences (configurable parameter)

---

## Next Steps

### Immediate Actions
1. ✅ Review this architecture plan
2. ✅ Clarify open questions above
3. ✅ Create feature branch: `git checkout -b feature/workout-comparison-agent`
4. ✅ Create test fixtures in `tests/fixtures/`
5. ✅ Begin Phase 1: Core Foundation

### Implementation Order
1. **Phase 1** (Days 1-2): Core business logic + unit tests
2. **Phase 2** (Day 3): Tool wrappers + integration tests
3. **Phase 3** (Day 4): Prompts + agent tests
4. **Phase 4** (Day 5): CLI commands + CLI tests
5. **Phase 5** (Day 6): Integration, polish, documentation

### Quality Gates
- After each phase: All tests passing, `mypy --strict` compliant
- Before Phase 5: User testing with real data
- Final: 300+ tests passing, documentation complete

---

## Documentation References

- **Full Architecture Plan**: `plans/WORKOUT_COMPARISON_ARCHITECTURE.md`
- **Original Feature Plan**: `plans/WORKOUT_COMPARISON_AGENT_PLAN.md`
- **Project Guide**: `CLAUDE.md`

---

**Status:** ✅ Architecture Complete, Ready for Implementation
**Estimated Timeline:** 6 days (48 hours)
**Next Milestone:** Phase 1 Core Foundation Complete

---

*This executive summary provides a high-level overview of the architecture plan. Refer to `WORKOUT_COMPARISON_ARCHITECTURE.md` for detailed specifications, algorithms, and implementation guidance.*
