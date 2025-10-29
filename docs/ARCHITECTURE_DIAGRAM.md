# Training Plan Report Architecture

## System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                    Cycling AI Analysis System                      │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│                     Phase 1: Generate Plans                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ cycling-ai generate --athlete data/Athlete_Name             │  │
│  │                                                             │  │
│  │ Multi-Agent Workflow:                                       │  │
│  │  1. Data Preparation  → Parquet cache                       │  │
│  │  2. Performance Analysis → Analysis results                 │  │
│  │  3. Training Planning → Training plan JSON                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              ↓                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Output: logs/llm_interactions/session_YYYYMMDD_HHMMSS.jsonl│  │
│  │                                                             │  │
│  │ Contains:                                                   │  │
│  │  - interaction_id: 4                                        │  │
│  │  - provider: "gemini"                                       │  │
│  │  - model: "gemini-2.5-flash"                                │  │
│  │  - output:                                                  │  │
│  │      - athlete_profile: {...}                               │  │
│  │      - training_plan: {...}                                 │  │
│  │      - weekly_workouts: [...]                               │  │
│  │      - power_zones: {...}                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│                 Phase 2: Prepare Report Data                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ cycling-ai prepare-report \                                 │  │
│  │   --sessions logs/llm_interactions/*.jsonl \                │  │
│  │   --output logs/report_data.json                            │  │
│  │                                                             │  │
│  │ Data Extraction Tool:                                       │  │
│  │  ├─ Parse JSONL interaction logs                            │  │
│  │  ├─ Find training plan interactions (ID 4)                  │  │
│  │  ├─ Extract weekly_workouts, power_zones, etc.              │  │
│  │  ├─ Load athlete profiles from JSON files                   │  │
│  │  ├─ Consolidate into single structure                       │  │
│  │  └─ Validate against JSON schema                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              ↓                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Output: logs/report_data.json                               │  │
│  │                                                             │  │
│  │ {                                                           │  │
│  │   "version": "1.0",                                         │  │
│  │   "generated_timestamp": "2025-10-29T12:30:00Z",            │  │
│  │   "athletes": [                                             │  │
│  │     {                                                       │  │
│  │       "id": "athlete_name",                                 │  │
│  │       "name": "Athlete Name",                               │  │
│  │       "profile": {...},                                     │  │
│  │       "training_plan": {                                    │  │
│  │         "weekly_workouts": [...],                           │  │
│  │         "power_zones": {...}                                │  │
│  │       },                                                    │  │
│  │       "metadata": {...}                                     │  │
│  │     }                                                       │  │
│  │   ]                                                         │  │
│  │ }                                                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│                  Phase 3: Interactive Viewer                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ open logs/training_plan_viewer.html                         │  │
│  │                                                             │  │
│  │ Static HTML File (No Server Required):                      │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │ <html>                                                │  │  │
│  │  │   <head>                                              │  │  │
│  │  │     <style>/* Calendar CSS */</style>                 │  │  │
│  │  │   </head>                                             │  │  │
│  │  │   <body>                                              │  │  │
│  │  │     <!-- Athlete Selector -->                        │  │  │
│  │  │     <select id="athlete-selector">                    │  │  │
│  │  │       <option>Athlete 1</option>                      │  │  │
│  │  │       <option>Athlete 2</option>                      │  │  │
│  │  │     </select>                                         │  │  │
│  │  │                                                       │  │  │
│  │  │     <!-- Training Calendar -->                        │  │  │
│  │  │     <div class="calendar">                            │  │  │
│  │  │       <!-- Dynamically generated from JSON -->        │  │  │
│  │  │     </div>                                            │  │  │
│  │  │                                                       │  │  │
│  │  │     <script>                                          │  │  │
│  │  │       // Fetch report_data.json                      │  │  │
│  │  │       // Populate athlete dropdown                   │  │  │
│  │  │       // Render calendar for selected athlete        │  │  │
│  │  │       // Handle modal popups                         │  │  │
│  │  │     </script>                                         │  │  │
│  │  │   </body>                                             │  │  │
│  │  │ </html>                                               │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              ↓                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Browser View:                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  12-Week Training Plan          [Athlete: John Doe ▼] │  │  │
│  │  │  ─────────────────────────────────────────────────────│  │  │
│  │  │  FTP: 260W → 275W (+5.8%)                            │  │  │
│  │  │  ─────────────────────────────────────────────────────│  │  │
│  │  │                                                       │  │  │
│  │  │  Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun     │  │  │
│  │  │  ─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────    │  │  │
│  │  │   W1  │ Rest│Thrs │Rest │Tempo│Rest │Endu │Rest     │  │  │
│  │  │  Fnd  │     │60min│     │75min│     │192m │         │  │  │
│  │  │  ─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────    │  │  │
│  │  │   W2  │ Rest│Thrs │Rest │Tempo│Rest │Endu │Rest     │  │  │
│  │  │  Fnd  │     │60min│     │75min│     │204m │         │  │  │
│  │  │  ─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────    │  │  │
│  │  │                                                       │  │  │
│  │  │  Click any workout for details ↓                     │  │  │
│  │  │                                                       │  │  │
│  │  │  ┌─────────────────────────────────────────────────┐ │  │  │
│  │  │  │ Week 1 - Tuesday: Threshold             [Close]│ │  │  │
│  │  │  │ ─────────────────────────────────────────────── │ │  │  │
│  │  │  │ Total: 60min | Work: 30min | Intensity: Z4    │ │  │  │
│  │  │  │                                                 │ │  │  │
│  │  │  │ Description:                                    │ │  │  │
│  │  │  │ Build sustainable power at FTP                  │ │  │  │
│  │  │  │                                                 │ │  │  │
│  │  │  │ Power Profile:                                  │ │  │  │
│  │  │  │ ┌─────────────────────────────────────────┐    │ │  │  │
│  │  │  │ │     ██          ██                      │    │ │  │  │
│  │  │  │ │    █  █   █    █  █                     │    │ │  │  │
│  │  │  │ │   █    █ █ █  █    █              █     │    │ │  │  │
│  │  │  │ │  █            █      █            █      │    │ │  │  │
│  │  │  │ │ █                     █          █       │    │ │  │  │
│  │  │  │ └─────────────────────────────────────────┘    │ │  │  │
│  │  │  │                                                 │ │  │  │
│  │  │  │ Workout Structure:                              │ │  │  │
│  │  │  │  • Warmup: 15min @ 156-195W                    │ │  │  │
│  │  │  │  • Interval: 15min @ 234-247W (90-95% FTP)     │ │  │  │
│  │  │  │  • Recovery: 5min @ 143W                       │ │  │  │
│  │  │  │  • Interval: 15min @ 234-247W (90-95% FTP)     │ │  │  │
│  │  │  │  • Cooldown: 10min @ 130-156W                  │ │  │  │
│  │  │  └─────────────────────────────────────────────────┘ │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐
│   FIT Files │
└─────────────┘
       │
       ↓ [Phase 1: Data Prep]
┌─────────────┐
│   Parquet   │ ──────┐
└─────────────┘       │
                      ↓ [Phase 2: Analysis]
            ┌──────────────────┐
            │ Performance Data │
            └──────────────────┘
                      │
                      ↓ [Phase 3: Planning]
            ┌──────────────────┐
            │  Training Plan   │
            └──────────────────┘
                      │
                      ↓ [Logged to JSONL]
            ┌──────────────────┐
            │ Interaction Log  │
            │   (session.jsonl)│
            └──────────────────┘
                      │
                      ↓ [Extract & Consolidate]
            ┌──────────────────┐
┌──────────▶│ report_data.json │
│           └──────────────────┘
│                     │
│                     ↓ [Load in Browser]
│           ┌──────────────────┐
│           │   HTML Viewer    │
│           │  (Static File)   │
│           └──────────────────┘
│                     │
│                     ↓
│           ┌──────────────────┐
│           │   Interactive    │
│           │     Calendar     │
│           └──────────────────┘
│
└── Can include multiple athletes


Multiple Athletes Flow:
══════════════════════

Athlete 1 → Generate → session_1.jsonl ─┐
Athlete 2 → Generate → session_2.jsonl ─┼─→ prepare-report → report_data.json
Athlete 3 → Generate → session_3.jsonl ─┘                          │
                                                                    ↓
                                                        training_plan_viewer.html
                                                                    │
                                                        ┌───────────┴───────────┐
                                                        │  Athlete Selector:    │
                                                        │  [Athlete 1 ▼]        │
                                                        │   - Athlete 1         │
                                                        │   - Athlete 2         │
                                                        │   - Athlete 3         │
                                                        └───────────────────────┘
```

## Component Responsibilities

```
┌────────────────────────────────────────────────────────────┐
│ Component 1: Training Plan Generator (existing)            │
│ ─────────────────────────────────────────────────────────  │
│ Language: Python                                           │
│ Location: src/cycling_ai/orchestration/multi_agent.py      │
│ Input: Athlete data, FIT files                             │
│ Output: Interaction log (JSONL)                            │
│ Responsibilities:                                          │
│   - Run multi-agent workflow                               │
│   - Generate training plans via LLM                        │
│   - Log all interactions with metadata                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Component 2: Report Data Extractor (NEW)                   │
│ ─────────────────────────────────────────────────────────  │
│ Language: Python                                           │
│ Location: src/cycling_ai/cli/prepare_report.py             │
│ Input: Interaction logs (JSONL), athlete profiles          │
│ Output: report_data.json                                   │
│ Responsibilities:                                          │
│   - Parse JSONL logs                                       │
│   - Extract training plan data                             │
│   - Load athlete profiles                                  │
│   - Consolidate multi-athlete data                         │
│   - Validate against schema                                │
│   - Generate final JSON                                    │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Component 3: Interactive HTML Viewer (NEW)                 │
│ ─────────────────────────────────────────────────────────  │
│ Language: HTML/CSS/JavaScript                              │
│ Location: templates/training_plan_viewer.html              │
│ Input: report_data.json                                    │
│ Output: Interactive web page                               │
│ Responsibilities:                                          │
│   - Fetch JSON data via JavaScript                         │
│   - Render athlete selector dropdown                       │
│   - Display calendar grid layout                           │
│   - Show workout cards with intensity colors               │
│   - Handle modal popup interactions                        │
│   - Display SVG power profiles                             │
│   - Support keyboard navigation                            │
│   - Responsive mobile layout                               │
└────────────────────────────────────────────────────────────┘
```

## File System Layout

```
cycling-ai-analysis/
│
├── data/
│   ├── Athlete_1/
│   │   ├── athlete_profile.json
│   │   └── fit_files/
│   ├── Athlete_2/
│   │   ├── athlete_profile.json
│   │   └── fit_files/
│   └── Athlete_3/
│       ├── athlete_profile.json
│       └── fit_files/
│
├── logs/
│   ├── llm_interactions/
│   │   ├── session_20251029_092525.jsonl  ← Generated plans
│   │   ├── session_20251029_143012.jsonl
│   │   └── session_20251029_165543.jsonl
│   │
│   ├── report_data.json                    ← Consolidated data
│   └── training_plan_viewer.html           ← Viewer (copied from templates)
│
├── templates/
│   └── training_plan_viewer.html           ← Viewer template
│
├── schemas/
│   └── report_data_schema.json             ← JSON Schema
│
├── scripts/
│   └── validate_report_data.py             ← Validation tool
│
├── docs/
│   ├── REPORT_DATA_FORMAT.md               ← Full specification
│   ├── REPORT_DATA_QUICK_REF.md            ← Quick reference
│   ├── DATA_FORMAT_SUMMARY.md              ← Summary
│   └── ARCHITECTURE_DIAGRAM.md             ← This file
│
└── src/
    └── cycling_ai/
        ├── cli/
        │   └── prepare_report.py           ← NEW: Data prep CLI
        └── tools/
            └── report_data_extractor.py    ← NEW: Extraction logic
```

## Sharing with Athletes

```
Option 1: Share Folder
════════════════════

reports/
├── report_data.json
└── training_plan_viewer.html

→ Zip and email
→ Athlete extracts and opens HTML


Option 2: Share via Cloud
══════════════════════════

Upload to:
  - Google Drive
  - Dropbox
  - OneDrive

→ Athlete downloads folder
→ Opens HTML file


Option 3: Host on Web
══════════════════════

Upload to:
  - GitHub Pages
  - Netlify
  - Any static host

→ Athlete visits URL
→ No download needed
```

## Technology Stack

```
Backend (Data Preparation):
  - Python 3.11+
  - Standard library (json, pathlib)
  - jsonschema (validation)

Frontend (Viewer):
  - HTML5
  - CSS3 (Grid, Flexbox)
  - Vanilla JavaScript (ES6+)
  - No frameworks needed
  - No build process

Data Format:
  - JSON
  - JSON Schema Draft 7
  - ISO 8601 timestamps

Styling:
  - Inline CSS (self-contained)
  - Gradient backgrounds
  - Modal overlays
  - SVG visualizations
```

## Security & Privacy

```
✓ All data stored locally
✓ No external API calls
✓ No tracking or analytics
✓ Works offline
✓ No user data transmission
✓ Self-contained HTML file

Athletes can:
  - View without internet
  - Keep data private
  - No account needed
  - No installation required
```
