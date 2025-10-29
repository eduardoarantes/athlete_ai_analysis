# Data Format Specification - Summary

## What We Created

We've defined a comprehensive JSON data format for cycling training plan reports that separates data preparation from presentation.

## Files Created

1. **`docs/REPORT_DATA_FORMAT.md`** - Complete specification with examples
2. **`schemas/report_data_schema.json`** - JSON Schema for validation
3. **`scripts/validate_report_data.py`** - Validation script
4. **`docs/REPORT_DATA_QUICK_REF.md`** - Quick reference guide

## Key Design Decisions

### 1. Multi-Athlete Support
- Single JSON file can contain multiple athletes
- Each athlete has unique ID
- Viewer can switch between athletes with dropdown

### 2. Separation of Concerns
- **Data Preparation Tool** (Python) - Extracts from logs, generates JSON
- **HTML Viewer** (Static HTML/JS) - Loads JSON, displays interactively
- No server needed, just open HTML file in browser

### 3. Complete Self-Contained Data
Each athlete object contains:
- Profile (age, FTP, weight, goals)
- Training plan (12 weeks of workouts)
- Power zones (calculated from FTP)
- Workout details (segments, SVG visualizations)
- Performance analysis (optional - historical data)
- Metadata (data sources, generation info)

### 4. Optional Performance Analysis
The `performance_analysis` field is optional, allowing:
- Just training plans initially
- Add historical performance data later
- Mix of athletes with/without performance data

### 5. Workout Structure
Segments stored as flat array:
```json
[
  {"type": "warmup", "duration_min": 15, ...},
  {"type": "interval", "duration_min": 5, ...},
  {"type": "recovery", "duration_min": 3, ...},
  {"type": "interval", "duration_min": 5, ...},
  {"type": "recovery", "duration_min": 3, ...}
]
```

Viewer detects repeating patterns and displays as:
"Warmup 15min, then 2x: 5min interval + 3min recovery"

## Data Flow Architecture

```
┌─────────────────────────────────────────────┐
│ Step 1: Generate Training Plans             │
│                                             │
│ $ cycling-ai generate --athlete Athlete_1  │
│ $ cycling-ai generate --athlete Athlete_2  │
│                                             │
│ Output: logs/llm_interactions/*.jsonl      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Step 2: Prepare Report Data                │
│                                             │
│ $ cycling-ai prepare-report \              │
│     --sessions logs/*.jsonl \              │
│     --output logs/report_data.json         │
│                                             │
│ Extracts training plans from logs          │
│ Loads athlete profiles                     │
│ Consolidates into single JSON              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Step 3: View Interactive Report            │
│                                             │
│ $ open logs/training_plan_viewer.html      │
│                                             │
│ - Loads report_data.json                   │
│ - Populates athlete dropdown                │
│ - Displays calendar view                   │
│ - Click workouts for modal popups          │
└─────────────────────────────────────────────┘
```

## Example Use Cases

### Use Case 1: Single Athlete
```bash
# Generate plan
cycling-ai generate --athlete data/John_Doe

# Prepare report
cycling-ai prepare-report \
  --session logs/session_latest.jsonl \
  --output logs/report_data.json

# View
open logs/training_plan_viewer.html
```

### Use Case 2: Multiple Athletes
```bash
# Generate plans
cycling-ai generate --athlete data/Athlete_1
cycling-ai generate --athlete data/Athlete_2
cycling-ai generate --athlete data/Athlete_3

# Prepare combined report
cycling-ai prepare-report \
  --sessions "logs/llm_interactions/*.jsonl" \
  --output logs/report_data.json

# View - select athlete from dropdown
open logs/training_plan_viewer.html
```

### Use Case 3: Share with Athlete
```bash
# Prepare report
cycling-ai prepare-report --session logs/latest.jsonl --output reports/

# Share folder with athlete
# reports/
#   ├── report_data.json
#   └── training_plan_viewer.html

# Athlete opens HTML file in browser
# No server, no installation needed
```

## JSON Structure Overview

```json
{
  "version": "1.0",
  "generated_timestamp": "...",
  "generator": {...},
  "athletes": [
    {
      "id": "athlete_1",
      "name": "Athlete Name",
      "profile": {
        "age": 51,
        "ftp": 260,
        "weight_kg": 84,
        "goals": "..."
      },
      "training_plan": {
        "current_ftp": 260,
        "target_ftp": 275,
        "power_zones": {...},
        "weekly_workouts": [
          {
            "week": 1,
            "phase": "Foundation",
            "workouts": {
              "Tuesday": {
                "name": "Threshold",
                "segments": [...],
                "svg": "..."
              }
            }
          }
        ]
      },
      "metadata": {
        "sources": {...},
        "generated_at": "..."
      }
    }
  ]
}
```

## Next Steps

Now that we have the data format specification:

1. **Implement Data Preparation Tool**
   - Create `src/cycling_ai/cli/prepare_report.py`
   - Extract training plans from interaction logs
   - Load athlete profiles
   - Generate `report_data.json`

2. **Create HTML Viewer**
   - Design interactive calendar view
   - Implement athlete selector
   - Add modal popups for workout details
   - Include SVG power profile visualizations

3. **Test with Real Data**
   - Use existing training plan from logs
   - Validate against schema
   - Test viewer functionality

## Benefits

✓ **Clean Separation** - Data prep (Python) vs presentation (HTML/JS)
✓ **Multi-Athlete** - Single viewer for multiple athletes
✓ **Portable** - Share single folder, no dependencies
✓ **Extensible** - Easy to add new fields/features
✓ **Validated** - JSON Schema ensures data quality
✓ **Version Controlled** - Git-friendly JSON format
✓ **Offline** - No server required
✓ **Professional** - Beautiful interactive calendar view

## Validation

Ensure data quality with validation:

```bash
# Validate your data
python scripts/validate_report_data.py logs/report_data.json

# Output:
# ✓ Validation successful!
#
# Data summary:
#   Version: 1.0
#   Generated: 2025-10-29T12:30:00Z
#   Number of athletes: 2
#
#   Athlete: John Doe (ID: john_doe)
#     FTP: 260W
#     Training plan: 12 weeks
#     Target FTP: 275W
#     Number of workouts: 48
```

## Documentation

- **Full Spec**: `docs/REPORT_DATA_FORMAT.md` - Complete documentation with all fields
- **Quick Ref**: `docs/REPORT_DATA_QUICK_REF.md` - Common patterns and examples
- **Schema**: `schemas/report_data_schema.json` - Machine-readable validation
- **Validator**: `scripts/validate_report_data.py` - Validation tool

Ready to implement the data preparation tool!
