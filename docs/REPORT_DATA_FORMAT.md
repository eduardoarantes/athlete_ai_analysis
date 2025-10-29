# Report Data Format Specification

## Overview

This document defines the JSON data format for prepared training plan reports. The data preparation tool extracts information from LLM interaction logs and athlete profiles to create a consolidated JSON file that can be consumed by the interactive HTML viewer.

**Version:** 1.0
**Last Updated:** 2025-10-29

---

## File: `report_data.json`

### Top-Level Structure

```json
{
  "version": "1.0",
  "generated_timestamp": "2025-10-29T12:30:00Z",
  "generator": {
    "tool": "cycling-ai",
    "version": "0.1.0",
    "command": "prepare-report --session logs/session.jsonl"
  },
  "athletes": [
    {
      // Athlete object (see below)
    }
  ]
}
```

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Data format version (semantic versioning) |
| `generated_timestamp` | string (ISO 8601) | Yes | When this data file was generated |
| `generator` | object | Yes | Information about the tool that generated this file |
| `generator.tool` | string | Yes | Name of the tool (e.g., "cycling-ai") |
| `generator.version` | string | Yes | Version of the tool |
| `generator.command` | string | No | Command used to generate the file |
| `athletes` | array | Yes | Array of athlete objects |

---

## Athlete Object

### Structure

```json
{
  "id": "athlete_name",
  "name": "Athlete Name",
  "profile": {
    // Profile object (see below)
  },
  "training_plan": {
    // Training plan object (see below)
  },
  "performance_analysis": {
    // Performance analysis object (see below) - OPTIONAL
  },
  "metadata": {
    // Metadata object (see below)
  }
}
```

### Athlete Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (filesystem-safe, lowercase, underscores) |
| `name` | string | Yes | Display name for the athlete |
| `profile` | object | Yes | Athlete profile information |
| `training_plan` | object | Yes | Generated training plan |
| `performance_analysis` | object | No | Historical performance data (if available) |
| `metadata` | object | Yes | Metadata about data sources and generation |

---

## Profile Object

### Structure

```json
{
  "age": 51,
  "gender": "male",
  "ftp": 260,
  "weight_kg": 84.0,
  "power_to_weight": 3.095,
  "max_hr": 149,
  "resting_hr": 55,
  "training_availability": {
    "hours_per_week": 7,
    "week_days": "Sunday, Saturday, Tuesday, Wednesday",
    "available_training_days": ["Sunday", "Saturday", "Tuesday", "Wednesday"],
    "weekly_training_hours": 7.0
  },
  "goals": "Complete a 160km ride under 5 hours in 10 weeks",
  "current_training_status": "strong recreational"
}
```

### Profile Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `age` | integer | Yes | Athlete's age in years |
| `gender` | string | No | "male", "female", or other |
| `ftp` | integer | Yes | Current Functional Threshold Power (watts) |
| `weight_kg` | float | Yes | Body weight in kilograms |
| `power_to_weight` | float | Yes | FTP/weight ratio (W/kg) |
| `max_hr` | integer | No | Maximum heart rate (bpm) |
| `resting_hr` | integer | No | Resting heart rate (bpm) |
| `training_availability` | object | Yes | Training schedule constraints |
| `training_availability.hours_per_week` | float | Yes | Available training hours per week |
| `training_availability.week_days` | string | No | Human-readable list of available days |
| `training_availability.available_training_days` | array | Yes | Array of day names |
| `training_availability.weekly_training_hours` | float | Yes | Same as hours_per_week |
| `goals` | string | Yes | Athlete's training goals |
| `current_training_status` | string | No | Training status description |

---

## Training Plan Object

### Structure

```json
{
  "current_ftp": 260,
  "target_ftp": 275,
  "ftp_gain": 15,
  "ftp_gain_percent": 5.77,
  "total_weeks": 12,
  "available_days_per_week": 4,
  "plan_structure": {
    "foundation_weeks": 4,
    "build_weeks": 4,
    "peak_weeks": 4,
    "recovery_weeks": [4, 8]
  },
  "power_zones": {
    // Power zones object (see below)
  },
  "plan_text": "# 12-Week Progressive Training Plan\n\n...",
  "weekly_workouts": [
    // Array of week objects (see below)
  ]
}
```

### Training Plan Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `current_ftp` | float | Yes | Starting FTP (watts) |
| `target_ftp` | float | Yes | Target FTP at end of plan (watts) |
| `ftp_gain` | float | Yes | Expected FTP gain (watts) |
| `ftp_gain_percent` | float | Yes | Expected FTP gain as percentage |
| `total_weeks` | integer | Yes | Total weeks in the plan |
| `available_days_per_week` | integer | Yes | Number of training days per week |
| `plan_structure` | object | No | Plan phase breakdown |
| `plan_structure.foundation_weeks` | integer | No | Number of foundation weeks |
| `plan_structure.build_weeks` | integer | No | Number of build weeks |
| `plan_structure.peak_weeks` | integer | No | Number of peak weeks |
| `plan_structure.recovery_weeks` | array | No | Week numbers for recovery weeks |
| `power_zones` | object | Yes | Power zone definitions |
| `plan_text` | string | No | Markdown-formatted plan summary |
| `weekly_workouts` | array | Yes | Array of week objects with workouts |

---

## Power Zones Object

### Structure

```json
{
  "z1": {
    "name": "Active Recovery",
    "min": 0,
    "max": 156
  },
  "z2": {
    "name": "Endurance",
    "min": 156,
    "max": 208
  },
  "z3": {
    "name": "Tempo",
    "min": 208,
    "max": 234
  },
  "z4": {
    "name": "Threshold",
    "min": 234,
    "max": 286
  },
  "z5": {
    "name": "VO2 Max",
    "min": 286,
    "max": null
  },
  "sweet_spot": {
    "name": "Sweet Spot",
    "min": 228,
    "max": 241
  }
}
```

### Power Zone Fields

Each zone object contains:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Zone name |
| `min` | integer | Yes | Minimum power (watts) |
| `max` | integer/null | Yes | Maximum power (watts), null for open-ended |

**Standard zones:** z1, z2, z3, z4, z5, sweet_spot

---

## Week Object

### Structure

```json
{
  "week": 1,
  "phase": "Foundation",
  "workouts": {
    "Monday": {
      // Workout object (see below)
    },
    "Tuesday": {
      // Workout object
    },
    // ... other days
  }
}
```

### Week Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `week` | integer | Yes | Week number (1-based) |
| `phase` | string | Yes | Training phase: "Foundation", "Build", "Peak", "Recovery" |
| `workouts` | object | Yes | Map of day names to workout objects |

**Valid day keys:** "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"

**Note:** Not all days need to be present. Missing days are considered rest days.

---

## Workout Object

### Structure

```json
{
  "name": "Threshold",
  "description": "Build sustainable power at FTP",
  "total_duration_min": 60,
  "work_time_min": 30,
  "intensity_zone": "Z4",
  "segments": [
    // Array of segment objects (see below)
  ],
  "svg": "<svg viewBox=\"0 0 600 120\">...</svg>"
}
```

### Workout Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workout name (e.g., "Threshold", "Endurance", "VO2 Max") |
| `description` | string | Yes | Workout description and purpose |
| `total_duration_min` | integer | Yes | Total workout duration in minutes |
| `work_time_min` | integer | No | Total work time (excluding warmup/cooldown) |
| `intensity_zone` | string | No | Primary intensity zone (e.g., "Z2", "Z4", "Mixed") |
| `segments` | array | Yes | Array of workout segments |
| `svg` | string | No | SVG visualization of power profile |

---

## Segment Object

### Structure

```json
{
  "duration_min": 15,
  "power_low": 156,
  "power_high": 195,
  "description": "Warm-up 15 min (156-195W)",
  "type": "warmup"
}
```

### Segment Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `duration_min` | integer | Yes | Segment duration in minutes |
| `power_low` | integer | Yes | Lower power bound (watts) |
| `power_high` | integer | Yes | Upper power bound (watts) |
| `description` | string | Yes | Human-readable segment description |
| `type` | string | Yes | Segment type |

### Valid Segment Types

- `warmup` - Warm-up period
- `interval` - High-intensity interval
- `work` - Work interval (similar to interval)
- `recovery` - Recovery period
- `cooldown` - Cool-down period
- `steady` - Steady-state effort
- `tempo` - Tempo effort

---

## Performance Analysis Object (Optional)

### Structure

```json
{
  "analysis_period": {
    "start_date": "2025-04-01",
    "end_date": "2025-10-29",
    "period_months": 6.9
  },
  "summary": {
    "total_rides": 120,
    "total_distance_km": 3500,
    "total_time_hours": 180,
    "rides_per_week": 4.5,
    "outdoor_rides": 80,
    "indoor_rides": 40
  },
  "consistency": {
    "score": 85,
    "description": "Excellent consistency with regular training schedule"
  },
  "power_metrics": {
    "average_power": 210,
    "normalized_power": 235,
    "power_trend_percent": 2.7
  },
  "time_in_zones": {
    "z1_percent": 15.2,
    "z2_percent": 68.5,
    "z3_percent": 8.1,
    "z4_percent": 5.7,
    "z5_percent": 2.5
  }
}
```

### Performance Analysis Fields

All fields in this object are optional as performance analysis may not be available.

| Field | Type | Description |
|-------|------|-------------|
| `analysis_period` | object | Time period for the analysis |
| `analysis_period.start_date` | string (ISO 8601) | Analysis start date |
| `analysis_period.end_date` | string (ISO 8601) | Analysis end date |
| `analysis_period.period_months` | float | Duration in months |
| `summary` | object | Summary statistics |
| `summary.total_rides` | integer | Total number of rides |
| `summary.total_distance_km` | float | Total distance in kilometers |
| `summary.total_time_hours` | float | Total training time in hours |
| `summary.rides_per_week` | float | Average rides per week |
| `summary.outdoor_rides` | integer | Number of outdoor rides |
| `summary.indoor_rides` | integer | Number of indoor rides |
| `consistency` | object | Consistency metrics |
| `consistency.score` | float | Consistency score (0-100) |
| `consistency.description` | string | Human-readable description |
| `power_metrics` | object | Power-based metrics |
| `power_metrics.average_power` | float | Average power (watts) |
| `power_metrics.normalized_power` | float | Normalized power (watts) |
| `power_metrics.power_trend_percent` | float | Power improvement trend (%) |
| `time_in_zones` | object | Time distribution across zones |
| `time_in_zones.z1_percent` | float | Percentage in Zone 1 |
| `time_in_zones.z2_percent` | float | Percentage in Zone 2 |
| `time_in_zones.z3_percent` | float | Percentage in Zone 3 |
| `time_in_zones.z4_percent` | float | Percentage in Zone 4 |
| `time_in_zones.z5_percent` | float | Percentage in Zone 5 |

---

## Metadata Object

### Structure

```json
{
  "sources": {
    "interaction_log": "logs/llm_interactions/session_20251029_092525.jsonl",
    "interaction_id": 4,
    "athlete_profile": "data/Athlete_Name/athlete_profile.json"
  },
  "generated_at": "2025-10-29T12:30:00Z",
  "llm_provider": "gemini",
  "llm_model": "gemini-2.5-flash",
  "generation_duration_ms": 29639.7
}
```

### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sources` | object | Yes | Information about data sources |
| `sources.interaction_log` | string | Yes | Path to interaction log file |
| `sources.interaction_id` | integer | No | Interaction ID in the log file |
| `sources.athlete_profile` | string | No | Path to athlete profile JSON |
| `generated_at` | string (ISO 8601) | Yes | When the training plan was generated |
| `llm_provider` | string | No | LLM provider (e.g., "anthropic", "gemini") |
| `llm_model` | string | No | LLM model used |
| `generation_duration_ms` | float | No | Time taken to generate plan (ms) |

---

## Complete Example

```json
{
  "version": "1.0",
  "generated_timestamp": "2025-10-29T12:30:00Z",
  "generator": {
    "tool": "cycling-ai",
    "version": "0.1.0",
    "command": "prepare-report --session logs/llm_interactions/session_20251029_092525.jsonl"
  },
  "athletes": [
    {
      "id": "athlete_name",
      "name": "Athlete Name",
      "profile": {
        "age": 51,
        "gender": "male",
        "ftp": 260,
        "weight_kg": 84.0,
        "power_to_weight": 3.095,
        "max_hr": 149,
        "training_availability": {
          "hours_per_week": 7,
          "week_days": "Sunday, Saturday, Tuesday, Wednesday",
          "available_training_days": ["Sunday", "Saturday", "Tuesday", "Wednesday"],
          "weekly_training_hours": 7.0
        },
        "goals": "Complete a 160km ride under 5 hours in 10 weeks",
        "current_training_status": "strong recreational"
      },
      "training_plan": {
        "current_ftp": 260,
        "target_ftp": 275,
        "ftp_gain": 15,
        "ftp_gain_percent": 5.77,
        "total_weeks": 12,
        "available_days_per_week": 4,
        "plan_structure": {
          "foundation_weeks": 4,
          "build_weeks": 4,
          "peak_weeks": 4,
          "recovery_weeks": [4, 8]
        },
        "power_zones": {
          "z1": {"name": "Active Recovery", "min": 0, "max": 156},
          "z2": {"name": "Endurance", "min": 156, "max": 208},
          "z3": {"name": "Tempo", "min": 208, "max": 234},
          "z4": {"name": "Threshold", "min": 234, "max": 286},
          "z5": {"name": "VO2 Max", "min": 286, "max": null},
          "sweet_spot": {"name": "Sweet Spot", "min": 228, "max": 241}
        },
        "weekly_workouts": [
          {
            "week": 1,
            "phase": "Foundation",
            "workouts": {
              "Tuesday": {
                "name": "Threshold",
                "description": "Build sustainable power at FTP",
                "total_duration_min": 60,
                "work_time_min": 30,
                "intensity_zone": "Z4",
                "segments": [
                  {
                    "duration_min": 15,
                    "power_low": 156,
                    "power_high": 195,
                    "description": "Warm-up 15 min (156-195W)",
                    "type": "warmup"
                  },
                  {
                    "duration_min": 15,
                    "power_low": 234,
                    "power_high": 247,
                    "description": "Threshold 15min @ 90-95% FTP",
                    "type": "interval"
                  },
                  {
                    "duration_min": 5,
                    "power_low": 143,
                    "power_high": 143,
                    "description": "Recovery 5 min @ 143W",
                    "type": "recovery"
                  },
                  {
                    "duration_min": 15,
                    "power_low": 234,
                    "power_high": 247,
                    "description": "Threshold 15min @ 90-95% FTP",
                    "type": "interval"
                  },
                  {
                    "duration_min": 10,
                    "power_low": 156,
                    "power_high": 130,
                    "description": "Cool-down 10 min (156-130W)",
                    "type": "cooldown"
                  }
                ],
                "svg": "<svg viewBox=\"0 0 600 120\" preserveAspectRatio=\"none\" style=\"width: 100%; height: 120px;\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
              },
              "Saturday": {
                "name": "Endurance",
                "description": "Aerobic base building",
                "total_duration_min": 192,
                "work_time_min": 0,
                "intensity_zone": "Z2",
                "segments": [
                  {
                    "duration_min": 192,
                    "power_low": 156,
                    "power_high": 195,
                    "description": "Endurance 192min @ Z2",
                    "type": "steady"
                  }
                ],
                "svg": "<svg>...</svg>"
              }
            }
          }
        ]
      },
      "performance_analysis": {
        "analysis_period": {
          "start_date": "2025-04-01",
          "end_date": "2025-10-29",
          "period_months": 6.9
        },
        "summary": {
          "total_rides": 120,
          "total_distance_km": 3500,
          "total_time_hours": 180,
          "rides_per_week": 4.5,
          "outdoor_rides": 80,
          "indoor_rides": 40
        },
        "consistency": {
          "score": 85,
          "description": "Excellent consistency with regular training schedule"
        }
      },
      "metadata": {
        "sources": {
          "interaction_log": "logs/llm_interactions/session_20251029_092525.jsonl",
          "interaction_id": 4,
          "athlete_profile": "data/Athlete_Name/athlete_profile.json"
        },
        "generated_at": "2025-10-29T09:26:17.139452",
        "llm_provider": "gemini",
        "llm_model": "gemini-2.5-flash",
        "generation_duration_ms": 29639.7
      }
    }
  ]
}
```

---

## Schema Validation

The data format can be validated using JSON Schema. See `schemas/report_data_schema.json` for the complete validation schema.

---

## Version History

### Version 1.0 (2025-10-29)
- Initial specification
- Support for training plans with weekly workouts
- Support for athlete profiles
- Optional performance analysis
- Metadata tracking

---

## Future Enhancements

Potential additions for future versions:

1. **Historical Plans** - Array of previous training plans for comparison
2. **Actual vs Planned** - Track completed workouts vs planned
3. **Performance Trends** - Time-series data for power, HR, etc.
4. **Race Results** - Record of race performances
5. **Nutrition Data** - Nutrition plans and tracking
6. **Recovery Metrics** - HRV, sleep quality, etc.
7. **Equipment** - Bike setup, gear used
8. **Photos/Media** - Links to workout photos, videos
9. **Notes** - Coach/athlete notes and feedback
10. **Export Formats** - Support for exporting to Garmin, TrainingPeaks, etc.
