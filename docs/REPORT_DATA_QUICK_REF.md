# Report Data Format - Quick Reference

## File Structure Overview

```
report_data.json
├── version: "1.0"
├── generated_timestamp: ISO 8601 timestamp
├── generator: {tool, version, command}
└── athletes: [
    ├── id: "athlete_name"
    ├── name: "Display Name"
    ├── profile: {age, ftp, weight_kg, training_availability, goals}
    ├── training_plan: {
    │   ├── current_ftp, target_ftp, ftp_gain
    │   ├── power_zones: {z1, z2, z3, z4, z5, sweet_spot}
    │   └── weekly_workouts: [
    │       ├── week: 1, phase: "Foundation"
    │       └── workouts: {
    │           ├── "Tuesday": {name, description, segments, svg}
    │           └── "Saturday": {name, description, segments, svg}
    │       }
    │   ]
    ├── performance_analysis: {...} (optional)
    └── metadata: {sources, generated_at, llm_provider}
]
```

## Minimal Valid Example

```json
{
  "version": "1.0",
  "generated_timestamp": "2025-10-29T12:30:00Z",
  "generator": {
    "tool": "cycling-ai",
    "version": "0.1.0"
  },
  "athletes": [
    {
      "id": "athlete_1",
      "name": "Athlete One",
      "profile": {
        "age": 51,
        "ftp": 260,
        "weight_kg": 84.0,
        "power_to_weight": 3.095,
        "training_availability": {
          "hours_per_week": 7,
          "available_training_days": ["Tuesday", "Saturday"],
          "weekly_training_hours": 7.0
        },
        "goals": "Improve FTP by 10%"
      },
      "training_plan": {
        "current_ftp": 260,
        "target_ftp": 275,
        "ftp_gain": 15,
        "ftp_gain_percent": 5.77,
        "total_weeks": 12,
        "available_days_per_week": 2,
        "power_zones": {
          "z1": {"name": "Active Recovery", "min": 0, "max": 156},
          "z2": {"name": "Endurance", "min": 156, "max": 208},
          "z3": {"name": "Tempo", "min": 208, "max": 234},
          "z4": {"name": "Threshold", "min": 234, "max": 286},
          "z5": {"name": "VO2 Max", "min": 286, "max": null}
        },
        "weekly_workouts": [
          {
            "week": 1,
            "phase": "Foundation",
            "workouts": {
              "Tuesday": {
                "name": "Threshold",
                "description": "Build FTP",
                "total_duration_min": 60,
                "segments": [
                  {
                    "duration_min": 15,
                    "power_low": 156,
                    "power_high": 195,
                    "description": "Warmup",
                    "type": "warmup"
                  },
                  {
                    "duration_min": 30,
                    "power_low": 234,
                    "power_high": 247,
                    "description": "Threshold work",
                    "type": "interval"
                  },
                  {
                    "duration_min": 15,
                    "power_low": 130,
                    "power_high": 156,
                    "description": "Cooldown",
                    "type": "cooldown"
                  }
                ]
              }
            }
          }
        ]
      },
      "metadata": {
        "sources": {
          "interaction_log": "logs/session.jsonl"
        },
        "generated_at": "2025-10-29T09:26:17Z"
      }
    }
  ]
}
```

## Field Requirements

### Required Fields

```
✓ version
✓ generated_timestamp
✓ generator.tool
✓ generator.version
✓ athletes[]
  ✓ id
  ✓ name
  ✓ profile
    ✓ age
    ✓ ftp
    ✓ weight_kg
    ✓ power_to_weight
    ✓ training_availability
      ✓ hours_per_week
      ✓ available_training_days[]
      ✓ weekly_training_hours
    ✓ goals
  ✓ training_plan
    ✓ current_ftp
    ✓ target_ftp
    ✓ ftp_gain
    ✓ ftp_gain_percent
    ✓ total_weeks
    ✓ available_days_per_week
    ✓ power_zones (z1-z5)
    ✓ weekly_workouts[]
      ✓ week
      ✓ phase
      ✓ workouts{}
        ✓ name
        ✓ description
        ✓ total_duration_min
        ✓ segments[]
          ✓ duration_min
          ✓ power_low
          ✓ power_high
          ✓ description
          ✓ type
  ✓ metadata
    ✓ sources.interaction_log
    ✓ generated_at
```

### Optional Fields

```
○ generator.command
○ profile.gender
○ profile.max_hr
○ profile.resting_hr
○ profile.current_training_status
○ training_plan.plan_structure
○ training_plan.plan_text
○ workout.work_time_min
○ workout.intensity_zone
○ workout.svg
○ performance_analysis (entire object)
○ metadata.sources.interaction_id
○ metadata.sources.athlete_profile
○ metadata.llm_provider
○ metadata.llm_model
○ metadata.generation_duration_ms
```

## Data Types & Constraints

| Field | Type | Constraints |
|-------|------|-------------|
| age | integer | 1-120 |
| ftp | number | > 0 |
| weight_kg | number | > 0 |
| power_to_weight | number | > 0 |
| max_hr | integer | 0-300 |
| total_weeks | integer | ≥ 1 |
| available_days_per_week | integer | 1-7 |
| phase | string | "Foundation", "Build", "Peak", "Recovery" |
| segment.type | string | "warmup", "interval", "work", "recovery", "cooldown", "steady", "tempo" |
| workout day | string | "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" |

## Common Patterns

### Adding Multiple Athletes

```json
{
  "version": "1.0",
  "generated_timestamp": "2025-10-29T12:30:00Z",
  "generator": {...},
  "athletes": [
    {
      "id": "athlete_1",
      "name": "Athlete One",
      ...
    },
    {
      "id": "athlete_2",
      "name": "Athlete Two",
      ...
    }
  ]
}
```

### Workout with Repeating Intervals

The segments array stores individual segments. Grouping logic is handled by the viewer.

```json
{
  "name": "VO2 Max",
  "segments": [
    {"duration_min": 15, "type": "warmup", ...},
    {"duration_min": 5, "type": "interval", ...},
    {"duration_min": 3, "type": "recovery", ...},
    {"duration_min": 5, "type": "interval", ...},
    {"duration_min": 3, "type": "recovery", ...},
    {"duration_min": 5, "type": "interval", ...},
    {"duration_min": 10, "type": "cooldown", ...}
  ]
}
```

The viewer will detect the pattern and display as "3x: 5min interval + 3min recovery".

### Rest Days

Rest days are simply omitted from the workouts object:

```json
{
  "week": 1,
  "phase": "Foundation",
  "workouts": {
    "Tuesday": {...},
    "Thursday": {...},
    "Saturday": {...}
    // Monday, Wednesday, Friday, Sunday = rest
  }
}
```

### Power Zones with FTP

Zones are calculated as percentages of FTP:

```python
# Example for FTP = 260W
zones = {
  "z1": {"name": "Active Recovery", "min": 0, "max": 156},        # 0-60%
  "z2": {"name": "Endurance", "min": 156, "max": 208},            # 60-80%
  "z3": {"name": "Tempo", "min": 208, "max": 234},                # 80-90%
  "z4": {"name": "Threshold", "min": 234, "max": 286},            # 90-110%
  "z5": {"name": "VO2 Max", "min": 286, "max": null},             # 110%+
  "sweet_spot": {"name": "Sweet Spot", "min": 228, "max": 241}    # 88-93%
}
```

### SVG Power Profile

SVG should be a complete, valid SVG element:

```json
{
  "svg": "<svg viewBox=\"0 0 600 120\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"0\" y=\"40\" width=\"150\" height=\"80\" fill=\"#10B981\"/></svg>"
}
```

## Validation

Validate your data file:

```bash
python scripts/validate_report_data.py logs/report_data.json
```

Or programmatically:

```python
import json
import jsonschema

# Load schema
with open('schemas/report_data_schema.json') as f:
    schema = json.load(f)

# Load data
with open('logs/report_data.json') as f:
    data = json.load(f)

# Validate
jsonschema.validate(instance=data, schema=schema)
print("✓ Valid!")
```

## Tips

1. **Athlete IDs**: Use lowercase with underscores (e.g., `john_doe`, `athlete_1`)
2. **Timestamps**: Always use ISO 8601 format with timezone (`2025-10-29T12:30:00Z`)
3. **Power Values**: Store as integers (watts)
4. **Durations**: Store as integers (minutes)
5. **SVG**: Keep inline, ensure it's valid XML
6. **Optional Fields**: Omit rather than setting to `null` (except for z5.max)
7. **Phases**: Use exact capitalization: "Foundation", "Build", "Peak", "Recovery"
8. **Days**: Use full names: "Monday", "Tuesday", etc.

## See Also

- [Full Specification](REPORT_DATA_FORMAT.md) - Complete documentation
- [JSON Schema](../schemas/report_data_schema.json) - Machine-readable schema
- [Validation Script](../scripts/validate_report_data.py) - Validation tool
