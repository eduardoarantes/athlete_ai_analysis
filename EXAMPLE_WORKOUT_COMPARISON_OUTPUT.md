# Workout Comparison Output Examples

This document shows what users will see when using the Workout Comparison Agent.

---

## Example 1: Daily Comparison - Perfect Compliance

**Command:**
```bash
cycling-ai compare daily --date 2024-11-04 --plan training_plan.json --csv activities.csv --profile athlete_profile.json
```

**Output:**
```
================================================================================
WORKOUT COMPARISON - Monday, November 4, 2024
================================================================================

PLANNED WORKOUT:
  Type:             Endurance
  Duration:         80 minutes
  Target TSS:       65
  Target Zones:     Z1 (20 min), Z2 (60 min)
  Avg Power Target: 65.6% of FTP (174 watts @ 265w FTP)

ACTUAL EXECUTION:
  ✅ COMPLETED
  Activity:         Morning Endurance Ride
  Duration:         80 minutes (100% of planned)
  Actual TSS:       65 (100% of planned)
  Zones:            Z1 (20 min), Z2 (60 min)
  Avg Power:        185 watts (70% of FTP)
  Normalized Power: 190 watts

COMPLIANCE ANALYSIS:
  Overall Score:    ███████████████████████ 100/100 (EXCELLENT)

  ✅ Completion:    100/100 (workout completed)
  ✅ Duration:      100/100 (exactly as planned)
  ✅ Intensity:     100/100 (perfect zone distribution)
  ✅ TSS:           100/100 (exactly as planned)

DEVIATIONS:
  None detected! Perfect execution.

RECOMMENDATION:
  Excellent execution! Workout completed exactly as planned. Continue this
  level of consistency.
```

---

## Example 2: Daily Comparison - Partial Compliance

**Command:**
```bash
cycling-ai compare daily --date 2024-11-06 --plan training_plan.json --csv activities.csv --profile athlete_profile.json
```

**Output:**
```
================================================================================
WORKOUT COMPARISON - Wednesday, November 6, 2024
================================================================================

PLANNED WORKOUT:
  Type:             Threshold Intervals
  Duration:         75 minutes
  Target TSS:       85
  Target Zones:     Z1 (45 min), Z4 (30 min)
  Avg Power Target: 71.0% of FTP (188 watts @ 265w FTP)

ACTUAL EXECUTION:
  ⚠️  COMPLETED WITH MODIFICATIONS
  Activity:         Threshold Attempt
  Duration:         75 minutes (100% of planned)
  Actual TSS:       72 (84.7% of planned)
  Zones:            Z1 (35 min), Z2 (10 min), Z3 (20 min), Z4 (10 min)
  Avg Power:        205 watts (77% of FTP)
  Normalized Power: 220 watts

COMPLIANCE ANALYSIS:
  Overall Score:    ████████████████░░░░░░░ 78.5/100 (GOOD)

  ✅ Completion:    100/100 (workout completed)
  ✅ Duration:      100/100 (exactly as planned)
  ⚠️  Intensity:     20/100 (zone distribution mismatch)
  ⚠️  TSS:           84.7/100 (slightly below target)

DEVIATIONS:
  ⚠️  Intensity deviated from plan (zone match score: 20/100)
      • Planned: 30 min Z4 (threshold intervals)
      • Actual:  10 min Z4, 20 min Z3 (tempo instead of threshold)
      • Analysis: Intervals performed at lower intensity than planned

  ⚠️  TSS 15% lower than planned (72 vs 85 TSS planned)
      • Caused by reduced time at threshold intensity

RECOMMENDATION:
  Good compliance (78%) despite modifications. If this was due to fatigue or
  time constraints, it was appropriate. If recurring, consider adjusting the
  plan.

  Note: Reducing intensity during hard workouts can indicate:
  • Accumulated fatigue (consider rest day)
  • Plan intensity too aggressive
  • Environmental factors (heat, wind, equipment)

NEXT STEPS:
  • Monitor fatigue levels before next hard workout
  • If pattern continues, consider reducing threshold targets by 5%
  • Ensure adequate recovery between hard sessions
```

---

## Example 3: Daily Comparison - Skipped Workout

**Command:**
```bash
cycling-ai compare daily --date 2024-11-08 --plan training_plan.json --csv activities.csv --profile athlete_profile.json
```

**Output:**
```
================================================================================
WORKOUT COMPARISON - Friday, November 8, 2024
================================================================================

PLANNED WORKOUT:
  Type:             VO2max Intervals
  Duration:         60 minutes
  Target TSS:       75
  Target Zones:     Z1 (20 min), Z5 (20 min), Z2 (20 min)
  Avg Power Target: 85.0% of FTP (225 watts @ 265w FTP)

ACTUAL EXECUTION:
  ❌ WORKOUT SKIPPED
  No activity recorded for this date.

COMPLIANCE ANALYSIS:
  Overall Score:    ░░░░░░░░░░░░░░░░░░░░░░░ 0/100 (SKIPPED)

  ❌ Completion:    0/100 (workout not completed)
  ❌ Duration:      0/100
  ❌ Intensity:     0/100
  ❌ TSS:           0/100

DEVIATIONS:
  ❌ Workout skipped entirely

RECOMMENDATION:
  Workout skipped. While occasional missed workouts happen, consistency is
  important for training progress.

  Consider:
  • Was this a planned rest/recovery adjustment? (Good decision if fatigued)
  • Scheduling conflict? (Try to reschedule or adjust weekly plan)
  • Lack of motivation? (Review goals and consider plan modifications)

  If this becomes a pattern (especially for high-intensity workouts), review
  your schedule to protect training time or adjust plan to better fit your
  lifestyle.
```

---

## Example 4: Weekly Comparison - Mixed Compliance

**Command:**
```bash
cycling-ai compare weekly --week-start 2024-11-04 --plan training_plan.json --csv activities.csv --profile athlete_profile.json
```

**Output:**
```
================================================================================
WEEKLY WORKOUT COMPARISON
Week 1: November 4-10, 2024
================================================================================

📊 WEEKLY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Workouts Planned:      5
  Workouts Completed:    4 (80% completion rate)
  Average Compliance:    73.2/100 (GOOD)

  Weekly Training Load:
  • Duration:  267 min / 355 min planned (75%)
  • TSS:       282 / 370 planned (76%)
  • Shortfall: -88 TSS (-24%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 DAILY BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Day            Workout              Score    Status
  ────────────── ──────────────────── ──────── ──────────────────────────────
  Mon Nov 4      Endurance            93.9/100 ✅ Completed (slight reduction)
  Tue Nov 5      Recovery             -        ✅ Rest day (as planned)
  Wed Nov 6      Threshold Intervals  78.5/100 ⚠️  Modified (lower intensity)
  Thu Nov 7      Endurance            -        ❌ Skipped
  Fri Nov 8      VO2max Intervals     -        ❌ Skipped
  Sat Nov 9      Long Endurance       88.1/100 ✅ Completed (cut short)
  Sun Nov 10     Recovery             -        ✅ Rest day (as planned)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 PATTERNS DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🚨 [HIGH SEVERITY] Skipping High-Intensity Workouts
     Pattern:         Threshold and VO2max workouts consistently skipped
     Occurrences:     2 of 2 planned high-intensity sessions
     Affected Dates:  Wed Nov 6, Fri Nov 8
     Impact:          Missing key intensity work limits fitness gains

     Analysis:
     You're maintaining base endurance but avoiding threshold/VO2max work.
     This may indicate:
     • Accumulated fatigue from previous weeks
     • Insufficient recovery between hard sessions
     • Plan intensity doesn't match current fitness
     • Psychological resistance to high-intensity work

     Recommendation:
     • Option 1: Take 3-5 days easy/recovery to rebuild freshness
     • Option 2: Reduce intensity targets by 10% for 2 weeks
     • Option 3: Increase recovery time between hard sessions

  ⚠️  [MEDIUM SEVERITY] Short Duration Pattern
     Pattern:         Workouts consistently cut short
     Occurrences:     3 of 4 completed workouts
     Average:         87.5% of planned duration
     Affected Dates:  Mon Nov 4, Wed Nov 6, Sat Nov 9

     Analysis:
     When you do ride, workouts are ~12% shorter than planned. This may be:
     • Time constraints (work/family schedule)
     • Fatigue causing early termination
     • Overly optimistic planned durations

     Recommendation:
     Reduce planned workout durations by 15% to match available time. Better
     to complete a 60-min workout fully than cut a 75-min workout short.

  ℹ️  [LOW SEVERITY] Weekend Warrior
     Pattern:         Higher compliance on weekends vs weekdays
     Weekend Avg:     91.0/100 compliance
     Weekday Avg:     68.2/100 compliance
     Difference:      +22.8 points

     Analysis:
     You're executing well on weekends (more time available) but struggling
     during the week. This is common for working athletes.

     Recommendation:
     Front-load your key workouts to weekends, keep weekdays shorter/easier.
     Consider:
     • Sat/Sun: Long rides, intervals, quality work
     • Mon-Fri: 45-60 min easy/recovery or complete rest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 WEEKLY COACHING INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STRENGTHS:
  ✅ Maintained 80% completion rate despite challenges
  ✅ Completed all endurance/base work
  ✅ Weekend execution is strong (91/100 average)

  AREAS FOR IMPROVEMENT:
  ⚠️  High-intensity work being skipped (0 of 2 sessions)
  ⚠️  Weekday compliance needs attention (68/100 average)
  ⚠️  Duration consistently 12% short

  RECOMMENDED ADJUSTMENTS:

  1. IMMEDIATE (This Week):
     • Take 2-3 easy recovery days to rebuild freshness
     • Do NOT attempt hard workouts until feeling recovered
     • Monitor morning HR and subjective fatigue

  2. SHORT-TERM (Next 2 Weeks):
     • Reduce workout durations by 15% across the board
     • Move key workouts to Saturday/Sunday
     • Reduce intensity targets by 5-10% (make intervals achievable)

  3. LONG-TERM (Next Plan):
     • Design plan around 3-4 workouts/week instead of 5-6
     • Concentrate quality on weekends
     • Prioritize consistency over intensity
     • Build in flexibility for life/work conflicts

  POSITIVE OUTLOOK:
  You're showing up and doing the work (80% completion). With small
  adjustments to plan structure and intensity, you can maintain this
  consistency while actually completing the prescribed workouts. The goal
  isn't perfection—it's sustainable, progressive training that fits your life.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
  □ Review patterns above and identify root causes
  □ Adjust next week's plan based on recommendations
  □ Monitor weekly compliance trends (target: 75%+ consistency)
  □ Schedule review with coach if patterns persist for 3+ weeks

================================================================================
```

---

## Example 5: Weekly Comparison - Perfect Compliance

**Command:**
```bash
cycling-ai compare weekly --week-start 2024-11-04 --plan training_plan.json --csv activities_perfect.csv --profile athlete_profile.json
```

**Output:**
```
================================================================================
WEEKLY WORKOUT COMPARISON
Week 1: November 4-10, 2024
================================================================================

📊 WEEKLY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Workouts Planned:      3
  Workouts Completed:    3 (100% completion rate) ✨
  Average Compliance:    96.7/100 (EXCELLENT)

  Weekly Training Load:
  • Duration:  255 min / 255 min planned (100%)
  • TSS:       255 / 255 planned (100%)
  • On Target: Perfect execution!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 DAILY BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Day            Workout              Score    Status
  ────────────── ──────────────────── ──────── ──────────────────────────────
  Mon Nov 4      Endurance            100/100  ✅ Perfect execution
  Tue Nov 5      Recovery             -        ✅ Rest day (as planned)
  Wed Nov 6      Threshold Intervals   95/100  ✅ Excellent execution
  Thu Nov 7      -                    -        - (no workout planned)
  Fri Nov 8      -                    -        - (no workout planned)
  Sat Nov 9      Long Endurance        95/100  ✅ Excellent execution
  Sun Nov 10     Recovery             -        ✅ Rest day (as planned)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 PATTERNS DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✨ No negative patterns detected!

  Excellent adherence to the training plan across all workout types.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 WEEKLY COACHING INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Outstanding week! All workouts completed with excellent compliance (97/100).

  STRENGTHS:
  ✅ 100% completion rate (3/3 workouts)
  ✅ Perfect TSS execution (255/255)
  ✅ Consistent high-quality execution across all workout types
  ✅ Proper rest/recovery days maintained

  KEEP DOING:
  • Current training schedule is working well
  • Recovery strategy is effective
  • Workout pacing and intensity control are excellent

  NEXT WEEK:
  With this level of consistency, you're building strong training adaptations.
  Continue the excellent work, and consider progressive overload:
  • Small TSS increase (5-10%) if feeling strong
  • Maintain current structure (it's working!)
  • Monitor fatigue—even perfect weeks can accumulate stress

  LONG-TERM OUTLOOK:
  This level of consistency (95%+ compliance) over 4-6 weeks will drive
  significant fitness gains. Stay patient, trust the process, and keep
  executing at this high level.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
  ✅ Continue current approach (it's working!)
  □ Monitor for early signs of fatigue (HR, subjective feel)
  □ Prepare for progressive overload in coming weeks
  □ Celebrate this excellent week! 🎉

================================================================================
```

---

## Key Features Demonstrated

### 1. **Clear Visual Hierarchy**
- Section headers with visual separators
- Emoji indicators for status (✅⚠️❌)
- Progress bars for compliance scores
- Color-coded severity levels (when displayed in terminal with colors)

### 2. **Actionable Insights**
- Not just "what happened" but "why it matters"
- Specific recommendations for improvement
- Multiple options (adjust plan vs adjust execution)
- Next steps checklist

### 3. **Pattern Detection**
- Identifies behavioral patterns automatically
- Severity classification (low/medium/high)
- Root cause analysis
- Impact assessment

### 4. **Coaching Tone**
- Supportive, not judgmental
- Recognizes context (fatigue, schedule, life)
- Celebrates successes
- Frames challenges as opportunities

### 5. **Data-Driven**
- Specific percentages and scores
- Clear compliance metrics
- TSS tracking
- Zone distribution analysis

### 6. **Contextual Recommendations**
- Immediate actions (this week)
- Short-term adjustments (next 2 weeks)
- Long-term planning (next training block)
- Positive framing with realistic expectations

---

## JSON Output Format (for LLM/API consumption)

The tools return structured JSON that can be:
- Formatted nicely for CLI display (as shown above)
- Embedded in HTML reports
- Consumed by mobile apps
- Processed by other tools

This provides maximum flexibility for different presentation layers while maintaining clean separation between data and presentation.
