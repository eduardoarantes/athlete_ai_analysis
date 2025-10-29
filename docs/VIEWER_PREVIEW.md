# HTML Training Plan Viewer - Visual Preview

## Overview

This document provides a visual preview and description of the interactive HTML training plan viewer.

## Screenshot Descriptions

### 1. Main View - Training Calendar

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🚴  Cycling Training Plan Viewer                    [Athlete_Name ▼]   │
└──────────────────────────────────────────────────────────────────────────┘
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👤  Athlete_Name (athlete_name)                                 │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │  Age: 51  │  Weight: 84 kg  │  FTP: 260W → 275W  │  12 weeks    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Mon    Tue        Wed     Thu         Fri    Sat         Sun      │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Week 1 - Foundation                                               │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Rest │ Threshold │ Rest │ Sweet Spot │ Rest │ Endurance │ Long   │  │
│  │      │ 60 min    │      │ 75 min     │      │ 90 min    │ Ride   │  │
│  │      │ █         │      │ ██         │      │ █         │ 120min │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Week 2 - Foundation                                               │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Rest │ VO2 Max   │ Rest │ Tempo      │ Rest │ Sweet Spot│ Endur. │  │
│  │      │ 45 min    │      │ 60 min     │      │ 75 min    │ 105min │  │
│  │      │ ███       │      │ ██         │      │ ██        │ █      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Features shown:**
- Gradient header with cycling icon and athlete selector
- Athlete profile card with key metrics
- 12-week calendar grid layout
- Week groupings with phase labels
- Individual workout cells with:
  - Workout name
  - Duration
  - Intensity indicator (colored bars)
- Rest days clearly marked
- Responsive column layout

### 2. Workout Detail Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  Threshold - Tuesday                                          ✕  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Duration: 60 minutes  │  TSS: 75                                │
│                                                                   │
│  ──────────────────────────────────────────────────────────────  │
│                                                                   │
│  📊 Power Profile:                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         ┌─────────┐      ┌─────────┐                       │ │
│  │    ┌────┤         ├──────┤         ├────┐                  │ │
│  │────┘    └─────────┘      └─────────┘    └────              │ │
│  │ Warmup    2x 10min @ FTP    Cooldown                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  📋 Workout Structure:                                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Warmup                                15 min │ Zone 2  │  │
│  │    Progressive increase from easy to moderate             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 2. Interval: 2 sets                      10 min │ Zone 4  │  │
│  │    Hold steady power at threshold                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3. Recovery                               5 min │ Zone 1  │  │
│  │    Easy spinning between intervals                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 4. Cooldown                              10 min │ Zone 1  │  │
│  │    Easy spinning to finish                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Features shown:**
- Modal overlay with gradient header
- Workout name and day
- Total duration and TSS
- SVG power profile chart (visual representation)
- Segment-by-segment breakdown:
  - Segment name and type
  - Duration
  - Power zone
  - Description/intensity
- Color-coded zones
- Close button (× in corner)

### 3. Color Palette

The viewer uses a distinctive, cycling-inspired color scheme:

```
Primary Colors:
┌──────────────────────────────────────────────────────────┐
│ Deep Navy      #1a2332  ████████████████████████████████ │
│ Mid-tone Navy  #2d3e50  ████████████████████████████████ │
└──────────────────────────────────────────────────────────┘

Accent Colors:
┌──────────────────────────────────────────────────────────┐
│ Vibrant Orange #ff6b35  ████████████████████████████████ │
│ Deep Teal      #004e89  ████████████████████████████████ │
│ Warm Yellow    #ffc857  ████████████████████████████████ │
└──────────────────────────────────────────────────────────┘

Status Colors:
┌──────────────────────────────────────────────────────────┐
│ Success Green  #06d6a0  ████████████████████████████████ │
└──────────────────────────────────────────────────────────┘

Gradients:
┌──────────────────────────────────────────────────────────┐
│ Header: Navy → Darker Navy (subtle depth)                │
│ Phase Badges: Orange → Yellow (energy)                   │
│ Buttons: Teal with shadow (professionalism)              │
└──────────────────────────────────────────────────────────┘
```

**Why This Palette:**
- Avoids typical LLM-generated blue/purple schemes
- Cycling-inspired: Orange (energy), Teal (endurance), Yellow (power)
- Professional and modern
- High contrast for readability
- Distinctive brand identity

### 4. Responsive Design

**Desktop (> 1200px):**
- Full 7-column calendar grid (Mon-Sun)
- Large athlete card with expanded metrics
- Modal width: 600px centered
- Side margins for comfortable reading

**Tablet (768px - 1200px):**
- Maintained 7-column layout (slightly narrower)
- Condensed athlete card
- Modal width: 90% of screen
- Touch-friendly click targets

**Mobile (< 768px):**
- Scrollable calendar (horizontal scroll if needed)
- Stacked athlete metrics (vertical layout)
- Full-width modal
- Larger touch targets for fingers
- Simplified header with smaller font

### 5. Interactive Elements

**Hover States:**
```
Workout Cell (default):
┌──────────────┐
│ Threshold    │
│ 60 min       │
│ █            │
└──────────────┘

Workout Cell (hover):
┌──────────────┐
│ Threshold    │  ← Slight scale increase
│ 60 min       │  ← Shadow appears
│ █            │  ← Cursor: pointer
└──────────────┘
```

**Click States:**
- Workout cell → Opens modal with smooth fade-in
- Modal background → Click to close
- Close button (×) → Closes modal
- Athlete dropdown → Shows all athletes

**Keyboard Support:**
- Escape → Close modal
- Tab → Navigate through workouts
- Enter/Space → Open workout detail

### 6. Phase Indicators

Each training phase has a distinctive visual identity:

```
Foundation Phase (Weeks 1-4):
┌──────────────────────────────────┐
│ Week 1 - Foundation              │  ← Blue badge
│ [Base building workouts...]      │
└──────────────────────────────────┘

Build Phase (Weeks 5-8):
┌──────────────────────────────────┐
│ Week 5 - Build                   │  ← Green badge
│ [Intensity increasing...]        │
└──────────────────────────────────┘

Peak Phase (Weeks 9-11):
┌──────────────────────────────────┐
│ Week 9 - Peak                    │  ← Yellow/orange badge
│ [Maximum intensity...]           │
└──────────────────────────────────┘

Recovery Phase (Week 12):
┌──────────────────────────────────┐
│ Week 12 - Recovery               │  ← Muted badge
│ [Taper and rest...]              │
└──────────────────────────────────┘
```

### 7. Power Zone Legend

Displayed in workout modals:

```
Zone 1 - Active Recovery  ████  < 55% FTP   (< 143W)
Zone 2 - Endurance       █████  56-75% FTP  (146-195W)
Zone 3 - Tempo           █████  76-90% FTP  (198-234W)
Zone 4 - Threshold       █████  91-105% FTP (237-273W)
Zone 5 - VO2 Max         █████  106-120% FTP (276-312W)
Zone 6 - Anaerobic       █████  121-150% FTP (315-390W)
Zone 7 - Neuromuscular   █████  > 150% FTP  (> 390W)
```

Each zone has a distinct color for easy visual identification.

### 8. Animation & Transitions

**Smooth Transitions:**
- Modal open/close: 0.3s fade with scale
- Hover effects: 0.2s all properties
- Athlete switch: Instant (< 0.1s)
- Phase scroll: Smooth scroll behavior

**Performance:**
- No janky animations
- Hardware-accelerated transforms
- Optimized repaints
- Smooth 60fps throughout

## Design Philosophy

### Why Not Standard LLM Layout?

Most LLM-generated UIs follow predictable patterns:
- ❌ Generic blue/purple color schemes
- ❌ Standard Material Design / Bootstrap layouts
- ❌ Predictable card-based structures
- ❌ Overuse of shadows and borders
- ❌ Generic sans-serif typography

**This viewer is different:**
- ✅ Unique cycling-inspired palette (orange/teal/yellow)
- ✅ Custom gradient treatments
- ✅ Distinctive header with brand icon
- ✅ Calendar-first layout (not card-grid)
- ✅ Purposeful use of white space
- ✅ Intentional contrast and hierarchy

### Professional Touch

**Attention to Detail:**
- Consistent 8px spacing grid
- Carefully chosen font sizes (16px base)
- Proper typography hierarchy
- Accessible color contrast ratios (WCAG AA)
- Touch-friendly 44px minimum targets

**Modern Techniques:**
- CSS custom properties (variables)
- Flexbox and Grid layouts
- Glass-morphism effects (backdrop blur)
- Subtle gradients (not overdone)
- Clean, minimal aesthetic

## Usage in Workflow

### Automatic Integration

```
User runs: cycling-ai generate ...
    ↓
Phase 1-4: Analysis, Planning, Reports
    ↓
Phase 5: Report Data Preparation
    ├── Extract training plan
    ├── Create report_data.json
    └── Copy training_plan_viewer.html  ← Automatic!
    ↓
Output directory contains:
    ├── report_data.json
    ├── training_plan_viewer.html       ← Ready to open!
    ├── performance_report.md
    └── training_plan.md
```

### One-Click Access

```bash
# Generate everything
cycling-ai generate --profile athlete.json --output-dir /tmp/report

# Open viewer
open /tmp/report/training_plan_viewer.html

# Done! Interactive training plan loads automatically
```

## Technical Highlights

### Self-Contained
- Zero external dependencies
- No CDN links or web fonts
- All CSS and JavaScript inline
- Works completely offline

### Fast Loading
- Small file size (~36 KB HTML)
- Data loads via single fetch (~125 KB JSON)
- No render-blocking resources
- Instant interaction after load

### Browser Compatible
- Modern JavaScript (ES6+)
- Flexbox and Grid layout
- Fetch API for data loading
- Graceful degradation

### Accessible
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support
- High contrast color choices
- Screen reader friendly

## Future Enhancements

**Planned v1.1 Features:**
1. Week-by-week TSS chart (line graph)
2. Print stylesheet for clean PDF output
3. Dark mode toggle
4. Export calendar to .ics format

**Planned v1.2 Features:**
1. Workout notes/comments field
2. Completed workout tracking
3. Actual vs. planned comparison
4. Progressive web app (PWA) support

## Summary

The HTML Training Plan Viewer provides a professional, interactive interface for viewing cycling training plans. Its distinctive design stands out from typical LLM-generated UIs while maintaining excellent usability and performance.

**Key Differentiators:**
- Unique cycling-inspired color palette
- Professional gradient treatments
- Custom calendar-first layout
- Smooth animations and interactions
- Self-contained and fast loading
- Automatic workflow integration

The viewer is automatically generated during Phase 5 of the cycling-ai workflow and requires no setup or configuration. Simply open the HTML file to see your training plan come to life!
