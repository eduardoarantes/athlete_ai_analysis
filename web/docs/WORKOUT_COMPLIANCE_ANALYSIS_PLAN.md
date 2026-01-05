# Workout Compliance Analysis - Implementation Plan

**Feature:** Analyze how well completed activities match planned workouts
**Status:** Planning
**Created:** 2026-01-06
**Last Updated:** 2026-01-06

> **Note:** This is the **engineering/developer version** of this document with full code examples and implementation details.
>
> For a **coach/athlete-friendly version** without code, see the web guide at:
> `/guides/compliance` (requires login) - [`web/app/(dashboard)/guides/compliance/page.tsx`](../app/(dashboard)/guides/compliance/page.tsx)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [Zone Models](#3-zone-models)
4. [Segment Matching Algorithm](#4-segment-matching-algorithm) ⭐ Core Logic
5. [Compliance Scoring](#5-compliance-scoring-algorithm)
6. [Edge Cases](#6-edge-cases--handling)
7. [Output Data Structure](#7-output-data-structure)
8. [Implementation Phases](#8-implementation-phases)
9. [Glossary](#9-glossary)

---

## 1. Overview

### What This Feature Does

This feature answers the question: **"How well did I execute my planned workout?"**

When an athlete completes a ride, we compare their actual performance (power data from Strava) against what was prescribed in their training plan. The system:

1. **Identifies each segment** of the workout (warmup, intervals, recovery, cooldown)
2. **Matches planned segments to actual performance** using intelligent pattern detection
3. **Scores each segment** based on power accuracy, time in zone, and duration
4. **Calculates an overall compliance score** (0-100)
5. **Generates AI coaching feedback** explaining what went well and what to improve

### Why Pattern-Based Matching?

Athletes rarely execute workouts exactly as written. Common variations include:
- Starting intervals a minute late
- Taking longer recovery between efforts
- Cutting a segment short
- Adding extra warmup time

**Simple time-based matching** would incorrectly align segments and produce misleading scores.

**Pattern-based matching** intelligently detects where each segment actually occurred, providing accurate and fair compliance analysis.

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     INPUT DATA                                   │
├─────────────────────────────────────────────────────────────────┤
│  Athlete Profile          Planned Workout       Strava Activity │
│  • FTP: 250W              • Warmup 10min        • Power stream  │
│  • LTHR: 165bpm           • 4x5min @105%        • HR stream     │
│                           • Recovery 3min        • Time stream   │
│                           • Cooldown 5min                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ZONE CALCULATOR                                 │
│  Power Zones (from FTP)    HR Zones (from LTHR)                 │
│  Z1: <138W                 Z1: <134bpm                          │
│  Z2: 138-188W              Z2: 134-147bpm                       │
│  Z3: 188-225W              Z3: 147-154bpm                       │
│  Z4: 225-263W              Z4: 154-164bpm                       │
│  Z5: >263W                 Z5: >164bpm                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PATTERN-BASED SEGMENT MATCHING                      │
│                                                                  │
│  1. Detect power zones in activity stream                        │
│  2. Identify segment boundaries (zone transitions)               │
│  3. Match planned segments to detected segments                  │
│  4. Handle skipped/merged segments with realignment              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 COMPLIANCE SCORING                               │
│                                                                  │
│  For each matched segment:                                       │
│  • Power Compliance: Was avg power in target range?              │
│  • Zone Compliance: % time spent in correct zone                 │
│  • Duration Compliance: Did segment last long enough?            │
│                                                                  │
│  Overall Score = Weighted average of all segments                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI COACH FEEDBACK                              │
│                                                                  │
│  "Great job on the intervals! You hit your power targets        │
│   consistently. Consider a longer warmup next time - you        │
│   started the first interval before fully warming up."          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Current State Analysis

### Available Data

| Data | Location | Status |
|------|----------|--------|
| **FTP** | `athlete_profiles.ftp` | ✅ Available |
| **Max HR** | `athlete_profiles.max_hr` | ✅ Available |
| **Resting HR** | `athlete_profiles.resting_hr` | ✅ Available |
| **LTHR** | - | ❌ **Missing - needs migration** |
| **Workout Segments** | `plan_data.weekly_plan[].workouts[].segments` | ✅ Available |
| **Activity Summary** | `strava_activities` table | ✅ Available |
| **Power Streams** | Strava API | ⚠️ Fetch on-demand |

### Workout Segment Structure (Current)

```typescript
interface WorkoutSegment {
  type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'work' | 'tempo'
  duration_min: number           // Target duration in minutes
  power_low_pct?: number         // Lower bound as % of FTP (e.g., 88)
  power_high_pct?: number        // Upper bound as % of FTP (e.g., 93)
  description?: string           // Human-readable description

  // For interval sets
  sets?: number                  // Number of repetitions
  work?: { duration_min, power_low_pct, power_high_pct }
  recovery?: { duration_min, power_low_pct, power_high_pct }
}
```

### Strava Streams Structure

```typescript
// Fetched from: GET /activities/{id}/streams?keys=watts,heartrate,time
interface StravaStreams {
  time: { data: number[] }        // Seconds from activity start [0, 1, 2, ...]
  watts: { data: number[] }       // Power at each second [145, 148, 152, ...]
  heartrate: { data: number[] }   // HR at each second [120, 121, 122, ...]
}
```

---

## 3. Zone Models

### 5-Zone Power Model (FTP-Based)

Power zones are calculated from the athlete's **Functional Threshold Power (FTP)** - the highest power they can sustain for approximately one hour.

| Zone | Name | % of FTP | Description | Feel |
|------|------|----------|-------------|------|
| **Z1** | Active Recovery | < 55% | Very easy spinning | Can chat easily |
| **Z2** | Endurance | 55-75% | Comfortable pace | Can hold conversation |
| **Z3** | Tempo | 76-90% | Moderate effort | Conversation difficult |
| **Z4** | Threshold | 91-105% | Hard, sustainable | Few words at a time |
| **Z5** | VO2max+ | > 105% | Very hard to maximal | Cannot speak |

**Example for FTP = 250W:**
- Z1: 0-137W
- Z2: 138-187W
- Z3: 188-225W
- Z4: 226-262W
- Z5: 263W+

### 5-Zone HR Model (LTHR-Based)

Heart rate zones are calculated from **Lactate Threshold Heart Rate (LTHR)** - the heart rate at which lactate begins to accumulate in the blood faster than it can be cleared.

| Zone | Name | % of LTHR | Description |
|------|------|-----------|-------------|
| **Z1** | Active Recovery | < 81% | Very easy |
| **Z2** | Endurance | 81-89% | Aerobic base building |
| **Z3** | Tempo | 90-93% | Muscular endurance |
| **Z4** | Threshold | 94-99% | Lactate threshold |
| **Z5** | VO2max+ | 100%+ | Anaerobic capacity |

**Example for LTHR = 165bpm:**
- Z1: 0-133bpm
- Z2: 134-146bpm
- Z3: 147-153bpm
- Z4: 154-163bpm
- Z5: 164bpm+

---

## 4. Segment Matching Algorithm

### The Challenge

A planned workout has structured segments:
```
Planned: [Warmup 10min] → [Interval 5min] → [Recovery 3min] → [Interval 5min] → [Cooldown 5min]
```

But an actual activity is a continuous stream of power data:
```
Actual: 142,145,148,151,...,265,268,271,...,145,142,138,...,262,265,270,...,148,145,140,...
```

We need to intelligently match these together, accounting for:
- The athlete starting intervals early or late
- Taking longer or shorter recovery
- Skipping segments entirely
- Adding extra time

### Algorithm Overview: Pattern-Based Sliding Window Matching

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALGORITHM PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: PREPARATION                                             │
│  ├─ Flatten planned workout into sequential segments             │
│  ├─ Convert power targets to absolute watts                      │
│  └─ Smooth the power stream (30-sec rolling average)             │
│                                                                  │
│  Step 2: ZONE CLASSIFICATION                                     │
│  ├─ Classify each second of activity into zones (Z1-Z5)          │
│  └─ Create zone timeline: [Z1,Z1,Z1,Z2,Z2,Z3,Z3,Z4,Z4,Z4,...]   │
│                                                                  │
│  Step 3: SEGMENT BOUNDARY DETECTION                              │
│  ├─ Detect significant zone transitions                          │
│  ├─ Identify "effort blocks" (sustained zone periods)            │
│  └─ Create detected segments list                                │
│                                                                  │
│  Step 4: SEGMENT MATCHING (Sliding Window)                       │
│  ├─ For each planned segment, find best matching detected block  │
│  ├─ Use similarity scoring (zone match, duration match)          │
│  └─ Handle unmatched segments (skipped, merged)                  │
│                                                                  │
│  Step 5: COMPLIANCE CALCULATION                                  │
│  └─ Score each matched pair                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 1: Preparation

#### 1.1 Flatten Planned Workout

Expand interval sets into individual segments:

**Input (Planned Workout):**
```
Warmup: 10 min @ 50-60%
Sets: 3x (5 min work @ 105-115%, 3 min recovery @ 50-55%)
Cooldown: 5 min @ 50-60%
```

**Output (Flattened Segments):**
```
Index  Type      Duration  Power Range    Target Zone
─────────────────────────────────────────────────────
[0]    warmup    10 min    50-60%  FTP    Z1-Z2
[1]    work      5 min     105-115% FTP   Z5
[2]    recovery  3 min     50-55%  FTP    Z1
[3]    work      5 min     105-115% FTP   Z5
[4]    recovery  3 min     50-55%  FTP    Z1
[5]    work      5 min     105-115% FTP   Z5
[6]    cooldown  5 min     50-60%  FTP    Z1-Z2

Total Planned Duration: 39 minutes
```

#### 1.2 Convert to Absolute Power

Using athlete's FTP (e.g., 250W):

```
[0] warmup:   125-150W (Z1-Z2)
[1] work:     263-288W (Z5)
[2] recovery: 125-138W (Z1)
[3] work:     263-288W (Z5)
[4] recovery: 125-138W (Z1)
[5] work:     263-288W (Z5)
[6] cooldown: 125-150W (Z1-Z2)
```

#### 1.3 Smooth Power Stream

Apply 30-second rolling average to reduce noise:

```
Raw:      [145, 280, 142, 275, 148, 268, ...]  ← Noisy (pedal strokes, coasting)
Smoothed: [148, 152, 158, 185, 210, 242, ...]  ← Cleaner signal
```

**Why 30 seconds?**
- Short enough to detect interval starts
- Long enough to filter out pedal stroke variations
- Standard in cycling analytics

---

### Step 2: Zone Classification

#### 2.1 Classify Each Second

For each data point in the smoothed power stream, determine the zone:

```typescript
function classifyZone(power: number, zones: PowerZones): number {
  if (power < zones.z1_max) return 1
  if (power < zones.z2_max) return 2
  if (power < zones.z3_max) return 3
  if (power < zones.z4_max) return 4
  return 5
}
```

**Example (FTP = 250W):**
```
Time(s)  Power  Zone
──────────────────────
0        145    Z2
1        148    Z2
2        152    Z2
...
600      265    Z5
601      268    Z5
602      271    Z5
...
900      142    Z2
901      138    Z1
```

#### 2.2 Create Zone Timeline

```
Zone Timeline: [2,2,2,2,2,2,2,2,2,2,...,5,5,5,5,5,5,...,1,1,1,1,...]
               └─── Warmup ───┘     └─ Interval ─┘   └ Recovery ┘
```

---

### Step 3: Segment Boundary Detection

#### 3.1 Detect Zone Transitions

A **segment boundary** occurs when the zone changes significantly and stays changed.

**Algorithm:**
```
1. Scan the zone timeline
2. Mark a boundary when:
   - Zone changes by ≥1 level AND
   - New zone is maintained for ≥30 seconds (minimum segment duration)
3. Ignore brief zone excursions (< 30 seconds)
```

**Example:**
```
Zone:  [2,2,2,2,2,2,5,5,5,5,5,5,5,5,1,1,1,1,1,1,5,5,5,5,5,5,...]
       └─────────┘ └─────────────┘ └─────────┘ └─────────────┘
       Block 1     Block 2         Block 3     Block 4
       Z2 Warmup   Z5 Interval     Z1 Recovery Z5 Interval

Detected Boundaries: [0, 360, 660, 840, 1140, ...]
```

#### 3.2 Create Detected Effort Blocks

Group continuous zone periods into blocks:

```typescript
interface DetectedBlock {
  start_sec: number      // Start time in activity
  end_sec: number        // End time in activity
  duration_sec: number   // How long the block lasted
  dominant_zone: number  // Most common zone (1-5)
  avg_power: number      // Average power during block
  zone_distribution: {   // % time in each zone
    z1: number
    z2: number
    z3: number
    z4: number
    z5: number
  }
}
```

**Example Detected Blocks:**
```
Block  Start    End      Duration  Zone  Avg Power
──────────────────────────────────────────────────
[0]    0:00     6:30     6.5 min   Z2    148W      ← Warmup (shorter than planned)
[1]    6:30     12:00    5.5 min   Z5    272W      ← Interval 1
[2]    12:00    15:30    3.5 min   Z1    135W      ← Recovery 1
[3]    15:30    20:45    5.25 min  Z5    268W      ← Interval 2
[4]    20:45    24:00    3.25 min  Z1    138W      ← Recovery 2
[5]    24:00    29:15    5.25 min  Z5    275W      ← Interval 3
[6]    29:15    34:00    4.75 min  Z1-Z2 142W      ← Cooldown
```

---

### Step 4: Segment Matching (Sliding Window)

This is the core intelligence of the algorithm.

#### 4.1 The Matching Problem

We have:
- **Planned Segments:** What the athlete was supposed to do
- **Detected Blocks:** What the athlete actually did

We need to match them, handling:
- **Time shifts:** Athlete started intervals late
- **Duration variations:** Segments longer/shorter than planned
- **Skipped segments:** Athlete missed a segment entirely
- **Merged segments:** Two planned segments done as one

#### 4.2 Similarity Score Function

For each potential match between a planned segment and detected block:

```typescript
function calculateMatchSimilarity(
  planned: PlannedSegment,
  detected: DetectedBlock
): number {
  // Score components (0-100 each)

  // 1. Zone Match (40% weight)
  // How well does the detected zone match the target zone?
  const zoneScore = calculateZoneMatchScore(planned.target_zone, detected.dominant_zone)

  // 2. Duration Match (30% weight)
  // How close is the duration to what was planned?
  const durationRatio = detected.duration_sec / (planned.duration_min * 60)
  const durationScore = calculateDurationMatchScore(durationRatio)

  // 3. Power Match (30% weight)
  // Is average power within the target range?
  const powerScore = calculatePowerMatchScore(
    detected.avg_power,
    planned.power_low,
    planned.power_high
  )

  // Weighted total
  return (zoneScore * 0.4) + (durationScore * 0.3) + (powerScore * 0.3)
}
```

**Zone Match Scoring:**
```
Target Zone vs Detected Zone → Score
Same zone                    → 100
Off by 1 zone               → 70
Off by 2 zones              → 40
Off by 3+ zones             → 10
```

**Duration Match Scoring:**
```
Duration Ratio → Score
0.9 - 1.1      → 100  (within 10%)
0.8 - 1.2      → 85   (within 20%)
0.7 - 1.3      → 70   (within 30%)
0.5 - 1.5      → 50   (within 50%)
< 0.5 or > 1.5 → 25   (very different)
```

**Power Match Scoring:**
```
If avg power within target range → 100
If below target: deduct 2 points per watt below
If above target: deduct 1 point per watt above (less penalty for going harder)
Minimum score: 0
```

#### 4.3 Sliding Window Matching Algorithm

```
ALGORITHM: MatchSegments(planned_segments, detected_blocks)

INPUT:
  planned_segments: List of planned workout segments [P0, P1, P2, ...]
  detected_blocks:  List of detected effort blocks [D0, D1, D2, ...]

OUTPUT:
  matches: List of (planned_index, detected_index, similarity_score)
  unmatched_planned: List of planned segments with no match (skipped)
  unmatched_detected: List of detected blocks with no match (extra work)

ALGORITHM:

1. Initialize:
   - matches = []
   - used_detected = Set()  // Track which detected blocks are already matched
   - planned_index = 0
   - search_start = 0       // Start of search window in detected blocks

2. For each planned segment P[i]:

   a. Define search window:
      - window_start = search_start
      - window_end = min(search_start + 3, len(detected_blocks))
      // We look at the next 3 detected blocks (allows for 2 skipped/merged segments)

   b. Find best match in window:
      best_match = null
      best_score = 0

      For each detected block D[j] in window where j not in used_detected:
        score = calculateMatchSimilarity(P[i], D[j])
        if score > best_score AND score >= MINIMUM_MATCH_THRESHOLD (50):
          best_match = j
          best_score = score

   c. If match found:
      - Add (i, best_match, best_score) to matches
      - Add best_match to used_detected
      - search_start = best_match + 1  // Move window forward

   d. If no match found:
      - Mark P[i] as "skipped" (no matching effort detected)
      - Do NOT advance search_start (next planned segment might match current block)

3. Any detected blocks not in used_detected are "extra work"

4. Return matches, unmatched_planned, unmatched_detected
```

#### 4.4 Visual Example

```
PLANNED SEGMENTS:
[P0: Warmup Z2]  [P1: Interval Z5]  [P2: Recovery Z1]  [P3: Interval Z5]  [P4: Cooldown Z2]
     10 min           5 min              3 min              5 min              5 min

DETECTED BLOCKS:
[D0: Z2]  [D1: Z5]  [D2: Z1]  [D3: Z5]  [D4: Z2]
  6 min    5.5 min   3.5 min   5.2 min   4.5 min

MATCHING PROCESS:

Step 1: Match P0 (Warmup Z2)
  - Search window: [D0, D1, D2]
  - D0 (Z2): Zone=100, Duration=60, Power=95 → Score=85 ✓ BEST
  - D1 (Z5): Zone=40, Duration=110, Power=20 → Score=50
  - D2 (Z1): Zone=70, Duration=35, Power=90 → Score=62
  → Match P0 → D0 (score: 85)

Step 2: Match P1 (Interval Z5)
  - Search window: [D1, D2, D3] (D0 already used)
  - D1 (Z5): Zone=100, Duration=92, Power=98 → Score=97 ✓ BEST
  - D2 (Z1): Zone=10, Duration=70, Power=5 → Score=28
  → Match P1 → D1 (score: 97)

Step 3: Match P2 (Recovery Z1)
  - Search window: [D2, D3, D4] (D0, D1 already used)
  - D2 (Z1): Zone=100, Duration=85, Power=95 → Score=93 ✓ BEST
  → Match P2 → D2 (score: 93)

Step 4: Match P3 (Interval Z5)
  - Search window: [D3, D4]
  - D3 (Z5): Zone=100, Duration=96, Power=95 → Score=97 ✓ BEST
  → Match P3 → D3 (score: 97)

Step 5: Match P4 (Cooldown Z2)
  - Search window: [D4]
  - D4 (Z2): Zone=100, Duration=90, Power=92 → Score=94 ✓ BEST
  → Match P4 → D4 (score: 94)

FINAL MATCHES:
P0 (Warmup)   → D0  Score: 85  "Warmup was shorter than planned"
P1 (Interval) → D1  Score: 97  "Excellent interval execution"
P2 (Recovery) → D2  Score: 93  "Good recovery"
P3 (Interval) → D3  Score: 97  "Excellent interval execution"
P4 (Cooldown) → D4  Score: 94  "Good cooldown"
```

#### 4.5 Handling Skipped Segments

When no match is found:

```
PLANNED: [Warmup] [Interval 1] [Recovery 1] [Interval 2] [Recovery 2] [Interval 3] [Cooldown]
DETECTED:[  Z2  ] [    Z5    ] [    Z5    ] [    Z2    ]

Matching:
- Warmup → D0 ✓
- Interval 1 → D1 ✓
- Recovery 1 → No match (athlete went straight to next interval)  ⚠️ SKIPPED
- Interval 2 → D2 ✓ (D1 was merged interval)
- Recovery 2 → No match ⚠️ SKIPPED
- Interval 3 → No match ⚠️ SKIPPED (athlete only did 2 intervals)
- Cooldown → D3 ✓

Result:
- Skipped segments: Recovery 1, Recovery 2, Interval 3
- These get 0% compliance score
- Coach feedback: "You skipped recovery periods and only completed 2 of 3 intervals"
```

#### 4.6 Handling Merged Segments

When one detected block matches multiple planned segments:

```
PLANNED: [Warmup 10min Z2] [Steady 20min Z3] [Cooldown 5min Z2]
DETECTED:[      Z2-Z3 35min (blended)      ]

The algorithm detects this as one block with mixed zones.
We split analysis based on zone distribution within the block:
- First 10 min: Mostly Z2 → Matches Warmup
- Middle 20 min: Mostly Z3 → Matches Steady
- Last 5 min: Mostly Z2 → Matches Cooldown
```

---

### Step 5: Per-Segment Compliance Analysis

Once segments are matched, we analyze each pair in detail.

#### 5.1 Extract Segment Data

For each matched pair (Planned P, Detected D):

```typescript
interface SegmentAnalysis {
  // Identification
  segment_index: number
  segment_name: string           // "Interval 1", "Recovery 2", etc.
  segment_type: string           // warmup, interval, recovery, cooldown
  match_quality: 'excellent' | 'good' | 'fair' | 'poor' | 'skipped'

  // Planned targets
  planned_duration_sec: number
  planned_power_low: number      // Watts
  planned_power_high: number     // Watts
  planned_zone: number           // 1-5

  // Actual performance
  actual_start_time: string      // "6:30" into activity
  actual_duration_sec: number
  actual_avg_power: number
  actual_normalized_power: number
  actual_max_power: number
  actual_min_power: number
  actual_dominant_zone: number

  // Time distribution (seconds in each zone)
  time_in_zone: {
    z1: number
    z2: number
    z3: number
    z4: number
    z5: number
  }

  // Compliance scores (0-100)
  scores: {
    power_compliance: number      // Was avg power correct?
    zone_compliance: number       // % time in target zone
    duration_compliance: number   // Was duration correct?
    overall_segment_score: number // Weighted combination
  }

  // Human-readable assessment
  assessment: string             // "Power was 15W below target"
}
```

---

## 5. Compliance Scoring Algorithm

### 5.1 Power Compliance Score (0-100)

**Question:** Was the average power within the target range?

```typescript
function calculatePowerCompliance(
  actualAvgPower: number,
  targetLow: number,
  targetHigh: number
): { score: number; assessment: string } {

  // Perfect: within target range
  if (actualAvgPower >= targetLow && actualAvgPower <= targetHigh) {
    return {
      score: 100,
      assessment: "Power was within target range"
    }
  }

  const targetMid = (targetLow + targetHigh) / 2

  // Below target
  if (actualAvgPower < targetLow) {
    const wattsBelow = targetLow - actualAvgPower
    const percentBelow = (wattsBelow / targetMid) * 100

    // Deduct 2 points per percent below (more penalty for going easy)
    const score = Math.max(0, 100 - (percentBelow * 2))

    return {
      score: Math.round(score),
      assessment: `Power was ${Math.round(wattsBelow)}W below target`
    }
  }

  // Above target
  const wattsAbove = actualAvgPower - targetHigh
  const percentAbove = (wattsAbove / targetMid) * 100

  // Deduct 1 point per percent above (less penalty for going harder)
  const score = Math.max(0, 100 - (percentAbove * 1))

  return {
    score: Math.round(score),
    assessment: `Power was ${Math.round(wattsAbove)}W above target (good effort!)`
  }
}
```

**Examples:**
| Target | Actual | Score | Assessment |
|--------|--------|-------|------------|
| 220-240W | 230W | 100 | Within target range |
| 220-240W | 200W | 83 | 20W below target |
| 220-240W | 260W | 91 | 20W above target |
| 220-240W | 180W | 65 | 40W below target |

### 5.2 Zone Compliance Score (0-100)

**Question:** What percentage of time was spent in the target zone?

```typescript
function calculateZoneCompliance(
  timeInZone: ZoneDistribution,
  targetZone: number
): { score: number; assessment: string } {

  const totalTime = Object.values(timeInZone).reduce((a, b) => a + b, 0)
  const timeInTarget = timeInZone[`z${targetZone}`]

  const percentInZone = (timeInTarget / totalTime) * 100

  // Score is simply the percentage (0-100)
  const score = Math.round(percentInZone)

  // Generate assessment
  let assessment: string
  if (score >= 90) {
    assessment = `Excellent zone discipline (${score}% in Z${targetZone})`
  } else if (score >= 75) {
    assessment = `Good zone discipline (${score}% in Z${targetZone})`
  } else if (score >= 50) {
    assessment = `Inconsistent zone discipline (${score}% in Z${targetZone})`
  } else {
    assessment = `Poor zone discipline (only ${score}% in Z${targetZone})`
  }

  return { score, assessment }
}
```

**Examples:**
| Target Zone | Time Distribution | Score | Assessment |
|-------------|-------------------|-------|------------|
| Z4 | 85% Z4, 10% Z3, 5% Z5 | 85 | Good zone discipline |
| Z5 | 95% Z5, 5% Z4 | 95 | Excellent zone discipline |
| Z2 | 40% Z2, 30% Z3, 30% Z1 | 40 | Poor zone discipline |

### 5.3 Duration Compliance Score (0-100)

**Question:** Did the segment last as long as planned?

```typescript
function calculateDurationCompliance(
  actualDurationSec: number,
  targetDurationSec: number
): { score: number; assessment: string } {

  const ratio = actualDurationSec / targetDurationSec

  let score: number
  let assessment: string

  if (ratio >= 0.95 && ratio <= 1.05) {
    // Within 5%: Perfect
    score = 100
    assessment = "Duration matched plan"
  } else if (ratio >= 0.90 && ratio <= 1.10) {
    // Within 10%: Excellent
    score = 95
    assessment = "Duration very close to plan"
  } else if (ratio >= 0.80 && ratio <= 1.20) {
    // Within 20%: Good
    score = 85
    assessment = ratio < 1
      ? `Segment was ${Math.round((1-ratio)*100)}% shorter than planned`
      : `Segment was ${Math.round((ratio-1)*100)}% longer than planned`
  } else if (ratio >= 0.60 && ratio <= 1.40) {
    // Within 40%: Fair
    score = 70
    assessment = ratio < 1
      ? `Segment was significantly shorter than planned`
      : `Segment was significantly longer than planned`
  } else {
    // More than 40% off: Poor
    score = Math.max(0, 100 - Math.abs(1 - ratio) * 100)
    assessment = ratio < 1
      ? `Segment was much shorter than planned`
      : `Segment was much longer than planned`
  }

  return { score: Math.round(score), assessment }
}
```

### 5.4 Overall Segment Score

Weight the three components based on segment type:

```typescript
const SEGMENT_WEIGHTS: Record<string, { power: number; zone: number; duration: number }> = {
  warmup:   { power: 0.25, zone: 0.35, duration: 0.40 },  // Duration matters for warmup
  work:     { power: 0.45, zone: 0.40, duration: 0.15 },  // Power & zone matter most
  interval: { power: 0.45, zone: 0.40, duration: 0.15 },  // Power & zone matter most
  recovery: { power: 0.20, zone: 0.30, duration: 0.50 },  // Duration matters for recovery
  cooldown: { power: 0.25, zone: 0.35, duration: 0.40 },  // Duration matters for cooldown
  steady:   { power: 0.40, zone: 0.40, duration: 0.20 },  // Balanced
  tempo:    { power: 0.40, zone: 0.40, duration: 0.20 },  // Balanced
}

function calculateSegmentScore(
  powerScore: number,
  zoneScore: number,
  durationScore: number,
  segmentType: string
): number {
  const weights = SEGMENT_WEIGHTS[segmentType] || { power: 0.35, zone: 0.35, duration: 0.30 }

  return Math.round(
    powerScore * weights.power +
    zoneScore * weights.zone +
    durationScore * weights.duration
  )
}
```

### 5.5 Overall Workout Compliance Score

Weight segments by their planned duration (longer segments count more):

```typescript
function calculateOverallCompliance(segments: SegmentAnalysis[]): {
  score: number
  grade: string
  summary: string
} {
  // Filter out skipped segments for weighted average
  const completedSegments = segments.filter(s => s.match_quality !== 'skipped')

  if (completedSegments.length === 0) {
    return { score: 0, grade: 'F', summary: 'Workout not completed' }
  }

  // Calculate duration-weighted average
  const totalPlannedDuration = completedSegments.reduce(
    (sum, s) => sum + s.planned_duration_sec, 0
  )

  let weightedScore = 0
  for (const segment of completedSegments) {
    const weight = segment.planned_duration_sec / totalPlannedDuration
    weightedScore += segment.scores.overall_segment_score * weight
  }

  // Penalize for skipped segments
  const skippedCount = segments.filter(s => s.match_quality === 'skipped').length
  const skippedPenalty = skippedCount * 5  // -5 points per skipped segment

  const finalScore = Math.max(0, Math.round(weightedScore) - skippedPenalty)

  // Determine grade
  const grade =
    finalScore >= 90 ? 'A' :
    finalScore >= 80 ? 'B' :
    finalScore >= 70 ? 'C' :
    finalScore >= 60 ? 'D' : 'F'

  // Generate summary
  const summary = generateSummary(finalScore, skippedCount, completedSegments)

  return { score: finalScore, grade, summary }
}
```

### 5.6 Grade Scale

| Score | Grade | Meaning | Typical Feedback |
|-------|-------|---------|------------------|
| 90-100 | A | Excellent | "Outstanding execution! You nailed this workout." |
| 80-89 | B | Good | "Good job! Minor deviations from the plan." |
| 70-79 | C | Acceptable | "Decent effort with some room for improvement." |
| 60-69 | D | Below Target | "Workout completed but with significant deviations." |
| 0-59 | F | Poor | "Workout was not completed as prescribed." |

---

## 6. Edge Cases & Handling

### Case 1: Activity Much Shorter Than Planned

**Scenario:** Planned 60 min workout, activity was 35 min

**Handling:**
- Match whatever segments were completed
- Mark remaining planned segments as "skipped"
- Flag as "Incomplete Workout"
- Overall score reflects only completed portion minus skipped penalty

### Case 2: Activity Much Longer Than Planned

**Scenario:** Planned 45 min workout, activity was 70 min

**Handling:**
- Extra time at the end becomes "unmatched detected blocks"
- Does not negatively impact compliance score
- Coach feedback notes: "You did extra work beyond the plan"

### Case 3: No Power Data

**Scenario:** Strava activity has no power data (no power meter)

**Handling:**
- Cannot perform compliance analysis
- Return special status: "Power data required for compliance analysis"
- Optionally: Fall back to HR-based analysis (less accurate)

### Case 4: Indoor vs Outdoor Variations

**Scenario:** Indoor trainer workouts have more consistent power

**Handling:**
- No special handling needed
- Algorithm works the same
- Indoor workouts typically score higher due to better power control

### Case 5: Very Short Segments (< 30 seconds)

**Scenario:** Sprint intervals of 20 seconds

**Handling:**
- Reduce smoothing window for short efforts
- Use 10-second rolling average instead of 30-second
- Segment boundary detection uses 15-second minimum

---

## 7. Output Data Structure

### Complete Analysis Result

```typescript
interface WorkoutComplianceAnalysis {
  // === IDENTIFICATION ===
  analysis_id: string              // Unique ID for this analysis
  match_id: string                 // Links to workout_activity_matches
  analyzed_at: string              // ISO timestamp

  // === WORKOUT INFO ===
  workout: {
    date: string                   // "2026-01-06"
    name: string                   // "VO2max Intervals"
    type: string                   // "vo2max"
    planned_duration_min: number   // 45
    planned_tss: number            // 85
  }

  // === ACTIVITY INFO ===
  activity: {
    strava_id: number
    name: string                   // "Tuesday Morning Ride"
    actual_duration_min: number    // 48
    actual_tss: number             // 82
  }

  // === ATHLETE CONTEXT ===
  athlete: {
    ftp: number                    // 250
    lthr: number | null            // 165
    power_zones: PowerZones
    hr_zones: HRZones | null
  }

  // === OVERALL RESULTS ===
  overall: {
    score: number                  // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    summary: string                // "Good workout execution with..."

    // High-level stats
    segments_completed: number     // 5
    segments_skipped: number       // 1
    segments_total: number         // 6

    // Time analysis
    total_time_in_target_zone_pct: number  // 78%
    avg_power_vs_target_pct: number        // 102% (slightly above)
  }

  // === PER-SEGMENT BREAKDOWN ===
  segments: SegmentAnalysis[]

  // === AI COACH FEEDBACK ===
  coach_feedback: {
    summary: string                // 2-3 sentence overview
    positives: string[]            // What went well
    improvements: string[]         // What to work on
    next_workout_tip: string       // Advice for next session
  } | null                         // Null if not yet generated

  // === METADATA ===
  metadata: {
    algorithm_version: string      // "1.0.0"
    power_data_quality: 'good' | 'partial' | 'missing'
    hr_data_quality: 'good' | 'partial' | 'missing'
    confidence: 'high' | 'medium' | 'low'
  }
}
```

---

## 8. Implementation Phases

### Phase 1: Database & Types ✏️
- [ ] Add `lthr` field to `athlete_profiles` table (migration)
- [ ] Update TypeScript database types
- [ ] Add UI for LTHR input in profile settings
- [ ] Create `workout_compliance_analyses` table for storing results

### Phase 2: Zone Calculator Service
- [ ] Create `lib/services/zone-calculator.ts`
- [ ] `calculatePowerZones(ftp: number): PowerZones`
- [ ] `calculateHRZones(lthr: number): HRZones`
- [ ] Unit tests with various FTP/LTHR values

### Phase 3: Strava Stream Fetcher
- [ ] Add `getActivityStreams(activityId, keys)` to Strava service
- [ ] Fetch power, HR, time, distance streams
- [ ] Handle API rate limiting
- [ ] Cache streams in database (optional)

### Phase 4: Compliance Analysis Engine
- [ ] Create `lib/services/compliance-analysis-service.ts`
- [ ] Implement segment flattening
- [ ] Implement power smoothing
- [ ] Implement zone classification
- [ ] Implement segment boundary detection
- [ ] Implement sliding window matching
- [ ] Implement per-segment scoring
- [ ] Implement overall scoring
- [ ] Comprehensive unit tests

### Phase 5: API Endpoints
- [ ] `POST /api/compliance/analyze` - Trigger analysis for a match
- [ ] `GET /api/compliance/{matchId}` - Get analysis results
- [ ] `GET /api/compliance/history` - Get analysis history for user

### Phase 6: UI Integration
- [ ] Add compliance score badge to matched workouts
- [ ] Create compliance detail view in workout modal
- [ ] Per-segment breakdown visualization
- [ ] Zone time distribution chart

### Phase 7: AI Coach Integration
- [ ] Create coach prompt template with compliance data
- [ ] Integrate with existing LLM provider system
- [ ] Generate and store coach feedback
- [ ] Display feedback in UI

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **FTP** | Functional Threshold Power - highest power sustainable for ~1 hour |
| **LTHR** | Lactate Threshold Heart Rate - HR at lactate threshold |
| **Power Zone** | Training intensity range based on % of FTP |
| **Segment** | A distinct portion of a workout (warmup, interval, recovery, etc.) |
| **Detected Block** | A period of consistent effort identified in the power stream |
| **Compliance Score** | 0-100 measure of how well actual matched planned |
| **Normalized Power** | Weighted average accounting for variability |
| **TSS** | Training Stress Score - overall workout load metric |
| **Sliding Window** | Algorithm technique that searches within a moving range |

---

## 10. Complete Worked Example

This section walks through a complete analysis from start to finish with real numbers.

### Example Workout: Sweet Spot Intervals

**Athlete Profile:**
- FTP: 250W
- LTHR: 165bpm

**Planned Workout:**
```
Name: Sweet Spot Intervals
Type: sweet_spot
Planned Duration: 50 minutes
Planned TSS: 65

Segments:
1. Warmup:     10 min @ 50-60% FTP
2. Interval 1: 10 min @ 88-93% FTP
3. Recovery 1:  5 min @ 50-55% FTP
4. Interval 2: 10 min @ 88-93% FTP
5. Recovery 2:  5 min @ 50-55% FTP
6. Cooldown:   10 min @ 50-60% FTP
```

### Step-by-Step Analysis

#### Step A: Calculate Power Zones

```typescript
// Input: FTP = 250W
const ftp = 250

const powerZones = {
  z1: { min: 0,   max: Math.round(ftp * 0.55) - 1 },  // 0-137W
  z2: { min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.75) },  // 138-188W
  z3: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90) },  // 189-225W
  z4: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },  // 226-263W
  z5: { min: Math.round(ftp * 1.06), max: 9999 }  // 264W+
}

// Result:
// Z1: 0-137W (Active Recovery)
// Z2: 138-188W (Endurance)
// Z3: 189-225W (Tempo/Sweet Spot)
// Z4: 226-263W (Threshold)
// Z5: 264W+ (VO2max)
```

#### Step B: Convert Planned Segments to Absolute Power

```typescript
const plannedSegments = [
  {
    index: 0,
    name: "Warmup",
    type: "warmup",
    duration_sec: 600,  // 10 min
    power_low: Math.round(250 * 0.50),   // 125W
    power_high: Math.round(250 * 0.60),  // 150W
    target_zone: 1  // Z1-Z2
  },
  {
    index: 1,
    name: "Interval 1",
    type: "work",
    duration_sec: 600,  // 10 min
    power_low: Math.round(250 * 0.88),   // 220W
    power_high: Math.round(250 * 0.93),  // 233W
    target_zone: 3  // Z3 (Sweet Spot)
  },
  {
    index: 2,
    name: "Recovery 1",
    type: "recovery",
    duration_sec: 300,  // 5 min
    power_low: Math.round(250 * 0.50),   // 125W
    power_high: Math.round(250 * 0.55),  // 138W
    target_zone: 1  // Z1
  },
  {
    index: 3,
    name: "Interval 2",
    type: "work",
    duration_sec: 600,  // 10 min
    power_low: Math.round(250 * 0.88),   // 220W
    power_high: Math.round(250 * 0.93),  // 233W
    target_zone: 3  // Z3
  },
  {
    index: 4,
    name: "Recovery 2",
    type: "recovery",
    duration_sec: 300,  // 5 min
    power_low: Math.round(250 * 0.50),   // 125W
    power_high: Math.round(250 * 0.55),  // 138W
    target_zone: 1  // Z1
  },
  {
    index: 5,
    name: "Cooldown",
    type: "cooldown",
    duration_sec: 600,  // 10 min
    power_low: Math.round(250 * 0.50),   // 125W
    power_high: Math.round(250 * 0.60),  // 150W
    target_zone: 1  // Z1-Z2
  }
]

// Total planned duration: 3000 sec (50 min)
```

#### Step C: Process Actual Power Stream

**Raw Strava Power Data (sampled every second, showing every 60th value):**
```typescript
const rawPowerStream = [
  // Minute 0-9: Warmup (athlete warmed up for 8 min instead of 10)
  142, 145, 148, 140, 152, 138, 145, 150,  // ~145W avg

  // Minute 8-18: First interval (started early!)
  185, 210, 225, 228, 230, 225, 228, 232, 230, 225,  // ~222W avg

  // Minute 18-22: Recovery (took 4 min instead of 5)
  140, 135, 130, 142,  // ~137W avg

  // Minute 22-33: Second interval (went longer - 11 min)
  220, 228, 232, 235, 230, 225, 228, 230, 232, 228, 225,  // ~228W avg

  // Minute 33-38: Recovery
  138, 140, 135, 132, 138,  // ~137W avg

  // Minute 38-48: Cooldown
  145, 142, 140, 138, 135, 132, 130, 128, 125, 120  // ~134W avg
]
// Total actual duration: 2880 sec (48 min)
```

#### Step D: Smooth Power Stream (30-sec rolling average)

```typescript
function smoothPowerStream(power: number[], windowSec: number = 30): number[] {
  const smoothed: number[] = []

  for (let i = 0; i < power.length; i++) {
    const windowStart = Math.max(0, i - windowSec + 1)
    const window = power.slice(windowStart, i + 1)
    const avg = window.reduce((a, b) => a + b, 0) / window.length
    smoothed.push(Math.round(avg))
  }

  return smoothed
}

// After smoothing, noisy power spikes are averaged out
// This makes zone transitions clearer
```

#### Step E: Classify Each Second Into Zones

```typescript
function classifyPowerToZone(power: number, zones: PowerZones): number {
  if (power <= zones.z1.max) return 1
  if (power <= zones.z2.max) return 2
  if (power <= zones.z3.max) return 3
  if (power <= zones.z4.max) return 4
  return 5
}

// Example classification:
// Power: 145W → Zone 2 (Endurance)
// Power: 225W → Zone 3 (Sweet Spot)
// Power: 265W → Zone 5 (VO2max)

// Create zone timeline (simplified):
const zoneTimeline = [
  // Warmup: mostly Z2
  2, 2, 2, 2, 2, 2, 2, 2,  // 8 minutes

  // Interval 1: mostly Z3, some Z4
  3, 3, 3, 3, 4, 3, 3, 4, 3, 3,  // 10 minutes

  // Recovery 1: Z1
  1, 1, 1, 1,  // 4 minutes

  // Interval 2: Z3 with some Z4
  3, 3, 4, 4, 3, 3, 3, 4, 3, 3, 3,  // 11 minutes

  // Recovery 2: Z1
  1, 1, 1, 1, 1,  // 5 minutes

  // Cooldown: Z1-Z2
  2, 2, 2, 1, 1, 1, 1, 1, 1, 1  // 10 minutes
]
```

#### Step F: Detect Segment Boundaries

```typescript
interface DetectedBlock {
  start_sec: number
  end_sec: number
  duration_sec: number
  dominant_zone: number
  avg_power: number
  zone_distribution: Record<string, number>
}

function detectSegmentBoundaries(
  zoneTimeline: number[],
  minSegmentDuration: number = 30
): DetectedBlock[] {
  const blocks: DetectedBlock[] = []
  let blockStart = 0
  let currentZone = zoneTimeline[0]
  let zoneCount: Record<number, number> = { [currentZone]: 1 }

  for (let i = 1; i < zoneTimeline.length; i++) {
    const zone = zoneTimeline[i]

    // Zone changed
    if (zone !== currentZone) {
      // Check if this is a sustained change (look ahead)
      const lookAhead = zoneTimeline.slice(i, i + minSegmentDuration)
      const newZoneCount = lookAhead.filter(z => z === zone).length

      // If new zone is dominant for next 30 sec, it's a real transition
      if (newZoneCount >= minSegmentDuration * 0.7) {
        // Save current block
        blocks.push({
          start_sec: blockStart,
          end_sec: i,
          duration_sec: i - blockStart,
          dominant_zone: getDominantZone(zoneCount),
          avg_power: 0, // Calculate separately
          zone_distribution: normalizeZoneCount(zoneCount)
        })

        // Start new block
        blockStart = i
        zoneCount = {}
      }
    }

    zoneCount[zone] = (zoneCount[zone] || 0) + 1
    currentZone = zone
  }

  // Don't forget last block
  blocks.push({
    start_sec: blockStart,
    end_sec: zoneTimeline.length,
    duration_sec: zoneTimeline.length - blockStart,
    dominant_zone: getDominantZone(zoneCount),
    avg_power: 0,
    zone_distribution: normalizeZoneCount(zoneCount)
  })

  return blocks
}

// Detected blocks for our example:
const detectedBlocks: DetectedBlock[] = [
  {
    start_sec: 0,
    end_sec: 480,      // 8 minutes
    duration_sec: 480,
    dominant_zone: 2,
    avg_power: 145,
    zone_distribution: { z1: 0.1, z2: 0.9, z3: 0, z4: 0, z5: 0 }
  },
  {
    start_sec: 480,
    end_sec: 1080,     // 10 minutes
    duration_sec: 600,
    dominant_zone: 3,
    avg_power: 222,
    zone_distribution: { z1: 0, z2: 0.05, z3: 0.75, z4: 0.20, z5: 0 }
  },
  {
    start_sec: 1080,
    end_sec: 1320,     // 4 minutes
    duration_sec: 240,
    dominant_zone: 1,
    avg_power: 137,
    zone_distribution: { z1: 0.95, z2: 0.05, z3: 0, z4: 0, z5: 0 }
  },
  {
    start_sec: 1320,
    end_sec: 1980,     // 11 minutes
    duration_sec: 660,
    dominant_zone: 3,
    avg_power: 228,
    zone_distribution: { z1: 0, z2: 0, z3: 0.70, z4: 0.30, z5: 0 }
  },
  {
    start_sec: 1980,
    end_sec: 2280,     // 5 minutes
    duration_sec: 300,
    dominant_zone: 1,
    avg_power: 137,
    zone_distribution: { z1: 1.0, z2: 0, z3: 0, z4: 0, z5: 0 }
  },
  {
    start_sec: 2280,
    end_sec: 2880,     // 10 minutes
    duration_sec: 600,
    dominant_zone: 1,
    avg_power: 134,
    zone_distribution: { z1: 0.6, z2: 0.4, z3: 0, z4: 0, z5: 0 }
  }
]
```

#### Step G: Match Planned Segments to Detected Blocks

```typescript
function matchSegments(
  planned: PlannedSegment[],
  detected: DetectedBlock[]
): SegmentMatch[] {
  const matches: SegmentMatch[] = []
  const usedDetected = new Set<number>()
  let searchStart = 0

  for (const p of planned) {
    let bestMatch: number | null = null
    let bestScore = 0

    // Search window: next 3 detected blocks
    const windowEnd = Math.min(searchStart + 3, detected.length)

    for (let d = searchStart; d < windowEnd; d++) {
      if (usedDetected.has(d)) continue

      const score = calculateMatchSimilarity(p, detected[d])

      if (score > bestScore && score >= 50) {
        bestMatch = d
        bestScore = score
      }
    }

    if (bestMatch !== null) {
      matches.push({
        planned_index: p.index,
        detected_index: bestMatch,
        similarity_score: bestScore
      })
      usedDetected.add(bestMatch)
      searchStart = bestMatch + 1
    } else {
      // No match found - segment was skipped
      matches.push({
        planned_index: p.index,
        detected_index: null,
        similarity_score: 0,
        skipped: true
      })
    }
  }

  return matches
}

// Matching results for our example:
const matchResults = [
  { planned: "Warmup",     detected: 0, score: 78, note: "Shorter warmup (8 min vs 10 min)" },
  { planned: "Interval 1", detected: 1, score: 92, note: "Good match" },
  { planned: "Recovery 1", detected: 2, score: 75, note: "Shorter recovery (4 min vs 5 min)" },
  { planned: "Interval 2", detected: 3, score: 88, note: "Longer interval (11 min vs 10 min)" },
  { planned: "Recovery 2", detected: 4, score: 95, note: "Perfect recovery" },
  { planned: "Cooldown",   detected: 5, score: 90, note: "Good cooldown" }
]
```

#### Step H: Calculate Per-Segment Compliance Scores

```typescript
// Example: Scoring Interval 1

const interval1Planned = {
  duration_sec: 600,
  power_low: 220,
  power_high: 233,
  target_zone: 3
}

const interval1Detected = {
  duration_sec: 600,
  avg_power: 222,
  dominant_zone: 3,
  zone_distribution: { z1: 0, z2: 0.05, z3: 0.75, z4: 0.20, z5: 0 }
}

// Power Compliance
// Target: 220-233W, Actual: 222W
// 222 is within range → Score: 100
const powerScore = 100
const powerAssessment = "Power was within target range"

// Zone Compliance
// Target: Z3, Time in Z3: 75%
// Score = 75 (percentage in target zone)
const zoneScore = 75
const zoneAssessment = "Good zone discipline (75% in Z3)"

// Duration Compliance
// Target: 600s, Actual: 600s
// Ratio = 1.0 (perfect)
const durationScore = 100
const durationAssessment = "Duration matched plan"

// Overall Segment Score (weighted by segment type "work")
// Weights: power=0.45, zone=0.40, duration=0.15
const segmentScore = Math.round(
  (100 * 0.45) + (75 * 0.40) + (100 * 0.15)
)
// = 45 + 30 + 15 = 90

// Final result for Interval 1:
const interval1Analysis = {
  segment_name: "Interval 1",
  segment_type: "work",
  match_quality: "excellent",

  planned: {
    duration_sec: 600,
    power_range: "220-233W",
    target_zone: 3
  },

  actual: {
    start_time: "8:00",
    duration_sec: 600,
    avg_power: 222,
    zone_distribution: "75% Z3, 20% Z4, 5% Z2"
  },

  scores: {
    power_compliance: 100,
    zone_compliance: 75,
    duration_compliance: 100,
    overall_segment_score: 90
  },

  assessment: "Excellent interval execution. Power was on target. Consider staying more consistently in Z3 - you drifted into Z4 occasionally."
}
```

#### Step I: Calculate Overall Workout Score

```typescript
const segmentScores = [
  { name: "Warmup",     score: 78, duration: 600, type: "warmup" },
  { name: "Interval 1", score: 90, duration: 600, type: "work" },
  { name: "Recovery 1", score: 75, duration: 300, type: "recovery" },
  { name: "Interval 2", score: 88, duration: 600, type: "work" },
  { name: "Recovery 2", score: 95, duration: 300, type: "recovery" },
  { name: "Cooldown",   score: 90, duration: 600, type: "cooldown" }
]

// Calculate duration-weighted average
const totalDuration = segmentScores.reduce((sum, s) => sum + s.duration, 0)
// = 3000 seconds

let weightedSum = 0
for (const segment of segmentScores) {
  const weight = segment.duration / totalDuration
  weightedSum += segment.score * weight
}

// Calculation:
// Warmup:     78 * (600/3000) = 78 * 0.20 = 15.6
// Interval 1: 90 * (600/3000) = 90 * 0.20 = 18.0
// Recovery 1: 75 * (300/3000) = 75 * 0.10 = 7.5
// Interval 2: 88 * (600/3000) = 88 * 0.20 = 17.6
// Recovery 2: 95 * (300/3000) = 95 * 0.10 = 9.5
// Cooldown:   90 * (600/3000) = 90 * 0.20 = 18.0
// Total: 15.6 + 18.0 + 7.5 + 17.6 + 9.5 + 18.0 = 86.2

const overallScore = Math.round(weightedSum)  // 86

// No skipped segments, so no penalty
const skippedPenalty = 0

const finalScore = overallScore - skippedPenalty  // 86

// Determine grade
const grade = finalScore >= 90 ? 'A' :
              finalScore >= 80 ? 'B' :
              finalScore >= 70 ? 'C' :
              finalScore >= 60 ? 'D' : 'F'
// Grade: B
```

#### Step J: Final Analysis Output

```typescript
const workoutComplianceAnalysis: WorkoutComplianceAnalysis = {
  analysis_id: "ca_abc123",
  match_id: "match_xyz789",
  analyzed_at: "2026-01-06T15:30:00Z",

  workout: {
    date: "2026-01-06",
    name: "Sweet Spot Intervals",
    type: "sweet_spot",
    planned_duration_min: 50,
    planned_tss: 65
  },

  activity: {
    strava_id: 12345678,
    name: "Tuesday Sweet Spot Session",
    actual_duration_min: 48,
    actual_tss: 62
  },

  athlete: {
    ftp: 250,
    lthr: 165,
    power_zones: { z1: "0-137", z2: "138-188", z3: "189-225", z4: "226-263", z5: "264+" },
    hr_zones: { z1: "0-133", z2: "134-146", z3: "147-153", z4: "154-163", z5: "164+" }
  },

  overall: {
    score: 86,
    grade: "B",
    summary: "Good workout execution with minor timing variations.",

    segments_completed: 6,
    segments_skipped: 0,
    segments_total: 6,

    total_time_in_target_zone_pct: 78,
    avg_power_vs_target_pct: 101
  },

  segments: [
    {
      segment_name: "Warmup",
      match_quality: "good",
      scores: { power: 95, zone: 85, duration: 60, overall: 78 },
      assessment: "Warmup was 2 minutes shorter than planned. Consider a longer warmup for intervals."
    },
    {
      segment_name: "Interval 1",
      match_quality: "excellent",
      scores: { power: 100, zone: 75, duration: 100, overall: 90 },
      assessment: "Excellent interval. Power on target. Some drift into Z4."
    },
    {
      segment_name: "Recovery 1",
      match_quality: "good",
      scores: { power: 95, zone: 95, duration: 50, overall: 75 },
      assessment: "Recovery was 1 minute short. Allow full recovery between intervals."
    },
    {
      segment_name: "Interval 2",
      match_quality: "excellent",
      scores: { power: 98, zone: 70, duration: 92, overall: 88 },
      assessment: "Good interval but went 1 minute long and pushed into Z4 more."
    },
    {
      segment_name: "Recovery 2",
      match_quality: "excellent",
      scores: { power: 95, zone: 100, duration: 100, overall: 95 },
      assessment: "Perfect recovery execution."
    },
    {
      segment_name: "Cooldown",
      match_quality: "excellent",
      scores: { power: 90, zone: 85, duration: 100, overall: 90 },
      assessment: "Good cooldown. Properly brought intensity down."
    }
  ],

  coach_feedback: {
    summary: "Good Sweet Spot session! You executed the main intervals well, staying in the target power range. Your warmup was a bit short and you cut some recovery periods - this could lead to accumulated fatigue.",

    positives: [
      "Hit target power for both Sweet Spot intervals",
      "Good pacing throughout the workout",
      "Proper cooldown to finish"
    ],

    improvements: [
      "Extend warmup to full 10 minutes - your body needs time to prepare for intensity",
      "Take full recovery periods - they're essential for quality in subsequent intervals",
      "Try to stay more consistently in Z3 during Sweet Spot - occasional Z4 drift means you're pushing too hard"
    ],

    next_workout_tip: "For your next Sweet Spot session, set a timer for warmup and recoveries. Focus on staying at the top of Z3 without crossing into Z4."
  },

  metadata: {
    algorithm_version: "1.0.0",
    power_data_quality: "good",
    hr_data_quality: "good",
    confidence: "high"
  }
}
```

---

## 11. TypeScript Type Definitions

### Core Types

```typescript
// Power zone boundaries
interface PowerZones {
  z1: { min: number; max: number }
  z2: { min: number; max: number }
  z3: { min: number; max: number }
  z4: { min: number; max: number }
  z5: { min: number; max: number }
}

// HR zone boundaries
interface HRZones {
  z1: { min: number; max: number }
  z2: { min: number; max: number }
  z3: { min: number; max: number }
  z4: { min: number; max: number }
  z5: { min: number; max: number }
}

// Zone distribution (percentage in each zone)
interface ZoneDistribution {
  z1: number  // 0-1 (percentage)
  z2: number
  z3: number
  z4: number
  z5: number
}

// Planned workout segment (after flattening)
interface PlannedSegment {
  index: number
  name: string
  type: 'warmup' | 'work' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'tempo'
  duration_sec: number
  power_low: number      // Absolute watts
  power_high: number     // Absolute watts
  target_zone: number    // 1-5
}

// Detected effort block from power stream
interface DetectedBlock {
  start_sec: number
  end_sec: number
  duration_sec: number
  dominant_zone: number
  avg_power: number
  max_power: number
  min_power: number
  normalized_power: number
  zone_distribution: ZoneDistribution
}

// Match between planned and detected
interface SegmentMatch {
  planned_index: number
  detected_index: number | null
  similarity_score: number
  skipped: boolean
}

// Detailed analysis of one segment
interface SegmentAnalysis {
  // Identity
  segment_index: number
  segment_name: string
  segment_type: string
  match_quality: 'excellent' | 'good' | 'fair' | 'poor' | 'skipped'

  // Planned values
  planned_duration_sec: number
  planned_power_low: number
  planned_power_high: number
  planned_zone: number

  // Actual values
  actual_start_time: string
  actual_end_time: string
  actual_duration_sec: number
  actual_avg_power: number
  actual_normalized_power: number
  actual_max_power: number
  actual_min_power: number
  actual_dominant_zone: number
  time_in_zone: ZoneDistribution

  // Scores
  scores: {
    power_compliance: number
    zone_compliance: number
    duration_compliance: number
    overall_segment_score: number
  }

  // Human-readable
  assessment: string
}

// Complete workout analysis
interface WorkoutComplianceAnalysis {
  // Identity
  analysis_id: string
  match_id: string
  analyzed_at: string

  // Workout info
  workout: {
    date: string
    name: string
    type: string
    planned_duration_min: number
    planned_tss: number
  }

  // Activity info
  activity: {
    strava_id: number
    name: string
    actual_duration_min: number
    actual_tss: number
  }

  // Athlete context
  athlete: {
    ftp: number
    lthr: number | null
    power_zones: PowerZones
    hr_zones: HRZones | null
  }

  // Overall results
  overall: {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    summary: string
    segments_completed: number
    segments_skipped: number
    segments_total: number
    total_time_in_target_zone_pct: number
    avg_power_vs_target_pct: number
  }

  // Per-segment breakdown
  segments: SegmentAnalysis[]

  // AI coach feedback
  coach_feedback: {
    summary: string
    positives: string[]
    improvements: string[]
    next_workout_tip: string
  } | null

  // Metadata
  metadata: {
    algorithm_version: string
    power_data_quality: 'good' | 'partial' | 'missing'
    hr_data_quality: 'good' | 'partial' | 'missing'
    confidence: 'high' | 'medium' | 'low'
  }
}
```

### Service Interface

```typescript
interface ComplianceAnalysisService {
  /**
   * Analyze workout compliance for a matched workout-activity pair
   */
  analyzeCompliance(
    matchId: string,
    athleteProfile: AthleteProfile,
    plannedWorkout: Workout,
    stravaActivity: StravaActivity,
    powerStream: number[],
    timeStream: number[]
  ): Promise<WorkoutComplianceAnalysis>

  /**
   * Calculate power zones from FTP
   */
  calculatePowerZones(ftp: number): PowerZones

  /**
   * Calculate HR zones from LTHR
   */
  calculateHRZones(lthr: number): HRZones

  /**
   * Flatten workout segments (expand interval sets)
   */
  flattenWorkoutSegments(
    segments: WorkoutSegment[],
    ftp: number
  ): PlannedSegment[]

  /**
   * Detect effort blocks from power stream
   */
  detectEffortBlocks(
    powerStream: number[],
    timeStream: number[],
    zones: PowerZones
  ): DetectedBlock[]

  /**
   * Match planned segments to detected blocks
   */
  matchSegments(
    planned: PlannedSegment[],
    detected: DetectedBlock[]
  ): SegmentMatch[]

  /**
   * Generate AI coach feedback
   */
  generateCoachFeedback(
    analysis: WorkoutComplianceAnalysis
  ): Promise<CoachFeedback>
}
```

---

## 12. References

- Strava API Streams: https://developers.strava.com/docs/reference/#api-Streams
- Coggan Power Zones: Training and Racing with a Power Meter
- Joe Friel HR Zones: The Cyclist's Training Bible
- Normalized Power: Dr. Andrew Coggan's algorithm
