# User Guide: Generate Command

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Command:** `cycling-ai generate`

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Command Options](#command-options)
4. [Data Preparation](#data-preparation)
5. [Understanding the Output](#understanding-the-output)
6. [Model Selection Guide](#model-selection-guide)
7. [Example Workflows](#example-workflows)
8. [Custom Prompts](#custom-prompts)
9. [Cost Optimization](#cost-optimization)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Overview

The `cycling-ai generate` command uses a multi-agent LLM system to analyze your cycling data and generate comprehensive performance reports and training plans.

**What it does:**
- Analyzes your cycling performance over a specified period
- Identifies strengths, weaknesses, and trends
- Generates a personalized training plan
- Creates 3 HTML reports with visualizations and insights

**What you need:**
- FIT files from your bike computer (automatic from device sync)
- Athlete profile (JSON file with FTP, zones, goals)
- LLM provider configured (Anthropic, OpenAI, Gemini, or Ollama)
- 5 minutes (typical execution time)

**Note:** CSV export is no longer required! The system works directly with FIT files.

**Output:**
- `index.html` - Main report with executive summary
- `coaching_insights.html` - Detailed coaching recommendations
- `performance_dashboard.html` - Metrics and visualizations

---

## Quick Start

### 5-Minute Setup

**Step 1: Locate your FIT files**

```bash
# FIT files are usually synced automatically to:
# - Garmin: ~/Library/Application Support/Garmin/GarminExpress/*/GARMIN/Activity/
# - Wahoo: Wahoo app exports to ~/Downloads/
# - Other: Check your device manufacturer's app
```

**Step 2: Create athlete profile**

```bash
cat > athlete_profile.json << 'EOF'
{
  "ftp": 265,
  "max_hr": 186,
  "weight_kg": 70,
  "age": 35,
  "goals": ["Improve FTP", "Complete century ride"]
}
EOF
```

**Step 3: Configure API key (if using cloud provider)**

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

**Step 4: Generate reports**

```bash
cycling-ai generate \
  --profile athlete_profile.json \
  --fit-dir ~/path/to/fit/files \
  --output-dir ./reports \
  --provider anthropic \
  --period-months 6 \
  --training-plan-weeks 12
```

**Step 5: Open reports**

```bash
open ./reports/index.html
```

Done! 🎉

---

## Command Options

### Required Options

#### `--profile PATH`
Path to your athlete profile JSON file.

```bash
--profile ./athlete_profile.json
```

**Required fields:**
- `ftp` (integer): Functional Threshold Power in watts
- `max_hr` (integer): Maximum heart rate in bpm
- `weight_kg` (number): Body weight in kilograms
- `age` (integer): Athlete age in years
- `goals` (array): List of training goals

**Optional fields:**
- `zones.power`: Custom power zones
- `zones.hr`: Custom heart rate zones
- `current_fitness`: Self-assessed fitness level (1-10)
- `injury_history`: List of past injuries
- `time_constraints`: Weekly training time availability

**Example:**
```json
{
  "ftp": 265,
  "max_hr": 186,
  "weight_kg": 70,
  "age": 35,
  "goals": [
    "Improve FTP by 20 watts",
    "Complete a century ride",
    "Improve climbing ability"
  ],
  "zones": {
    "power": {
      "zone1": [0, 143],
      "zone2": [144, 186],
      "zone3": [187, 224],
      "zone4": [225, 265],
      "zone5": [266, 318],
      "zone6": [319, 424],
      "zone7": [425, 999]
    }
  },
  "current_fitness": 7,
  "time_constraints": {
    "hours_per_week": 8,
    "days_available": [
      "Monday", "Wednesday", "Friday", "Saturday", "Sunday"
    ]
  }
}
```

### Optional Options

#### `--output-dir PATH`
Directory to save generated reports (default: `./reports`)

```bash
--output-dir ~/cycling-reports/2025-10
```

#### `--provider NAME`
LLM provider to use (default: `anthropic`)

```bash
--provider anthropic  # or openai, gemini, ollama
```

**See [Model Selection Guide](#model-selection-guide) for details.**

#### `--model NAME`
Specific model to use (overrides provider default)

```bash
# Anthropic
--model claude-3-5-sonnet-20241022

# OpenAI
--model gpt-4-turbo

# Ollama
--model llama3.1:8b
```

#### `--period-months INTEGER`
Number of months to analyze (default: 6, range: 1-24)

```bash
--period-months 3   # Last 3 months
--period-months 12  # Full year
```

**Recommendation:**
- 3 months: Quick progress check
- 6 months: Comprehensive analysis (default)
- 12 months: Annual review

#### `--training-plan-weeks INTEGER`
Length of training plan to generate (default: 12, range: 4-52)

```bash
--training-plan-weeks 8   # Short-term plan
--training-plan-weeks 16  # Medium-term plan
--training-plan-weeks 24  # Long-term plan
```

#### `--fit-dir PATH`
Directory containing FIT files for detailed power analysis (optional)

```bash
--fit-dir ~/Strava/activities/
```

**Benefits:**
- More accurate power zone distribution
- Interval detection
- Fatigue analysis
- Better training plan customization

**Note:** FIT files are optional but recommended for best results.

#### `--prompts-dir PATH`
Custom prompts directory (advanced usage)

```bash
--prompts-dir ~/.cycling-ai/custom_prompts/
```

See [Custom Prompts](#custom-prompts) for details.

#### `--verbose`
Enable detailed logging

```bash
--verbose
```

**Use when:**
- Debugging issues
- Monitoring token usage
- Understanding workflow progress
- Reporting bugs

---

## Data Preparation

### Exporting from Strava

**Method 1: Bulk Export (Recommended)**

1. Go to https://www.strava.com/settings/account
2. Scroll to "Download or Delete Your Account"
3. Click "Get Started" under "Download Request"
4. Wait for email (usually within 24 hours)
5. Download ZIP file
6. Extract `activities.csv`

**Method 2: Third-Party Tools**

- **Strava API:** Use tools like `stravalib` Python package
- **Export Services:** Services like StravaGear, VeloViewer

### Creating Athlete Profile

**Quick method (minimal):**

```bash
cycling-ai config create-profile
# Interactive prompts for FTP, max HR, etc.
```

**Manual creation:**

```json
{
  "ftp": 265,
  "max_hr": 186,
  "weight_kg": 70,
  "age": 35,
  "goals": ["Improve FTP", "Complete century ride"]
}
```

**How to determine FTP:**
1. Recent FTP test result
2. Best 20-min power × 0.95
3. Best 60-min power
4. Use Strava's estimated FTP

**How to determine max HR:**
1. Recent race or hard effort maximum
2. 220 - age (rough estimate)
3. Laboratory test result

### Optional: FIT Files

**Where to get FIT files:**
1. Download from Garmin Connect, Wahoo, etc.
2. Sync with Strava (download individual activities)
3. Export from training platforms (TrainingPeaks, etc.)

**Organize FIT files:**

```bash
mkdir -p ~/cycling-data/fit-files/2025/

# FIT files should be named descriptively
# Example structure:
~/cycling-data/fit-files/2025/
├── 2025-01-15_morning_ride.fit
├── 2025-01-18_interval_training.fit
└── 2025-01-22_long_endurance.fit
```

---

## Understanding the Output

### Report Files

#### 1. `index.html` - Executive Summary

**Contents:**
- Overall performance summary
- Key metrics and trends
- Training plan overview
- Next steps and recommendations

**Best for:**
- Quick overview
- Sharing with coaches
- Progress tracking

#### 2. `coaching_insights.html` - Detailed Analysis

**Contents:**
- Strengths and weaknesses analysis
- Zone distribution analysis
- Training load progression
- Recovery recommendations
- Specific workout suggestions
- Long-term periodization plan

**Best for:**
- Detailed training planning
- Understanding specific areas to improve
- Coaches and serious athletes

#### 3. `performance_dashboard.html` - Metrics & Visualizations

**Contents:**
- Power and heart rate trends
- TSS and training load charts
- Zone distribution pie charts
- Weekly volume graphs
- Performance progression

**Best for:**
- Visual learners
- Tracking metrics over time
- Presentations and reviews

### Key Metrics Explained

**FTP (Functional Threshold Power):**
- Maximum power you can sustain for ~1 hour
- Used to calculate training zones
- Benchmark for fitness improvements

**TSS (Training Stress Score):**
- Quantifies training load
- 100 TSS ≈ 1 hour at FTP
- Used for volume tracking and recovery planning

**CTL (Chronic Training Load):**
- Long-term fitness indicator
- 42-day moving average of TSS
- Higher CTL = better fitness

**ATL (Acute Training Load):**
- Short-term fatigue indicator
- 7-day moving average of TSS
- Higher ATL = more fatigue

**TSB (Training Stress Balance):**
- CTL - ATL
- Positive = rested, Negative = fatigued
- Guides taper and recovery timing

---

## Model Selection Guide

### Recommended Models by Use Case

#### Production / Regular Use
**Recommended: Anthropic Claude 3.5 Sonnet**

```bash
--provider anthropic --model claude-3-5-sonnet-20241022
```

**Pros:**
- Excellent tool-calling reliability
- High-quality insights and analysis
- Cost-effective ($0.25 per workflow)
- Fast response times
- Well-suited for complex reasoning

**Cost:** ~$25/month for 100 analyses

---

#### Budget-Conscious
**Recommended: Google Gemini 1.5 Pro**

```bash
--provider gemini --model gemini-1.5-pro
```

**Pros:**
- Very low cost ($0.09 per workflow)
- Good performance
- Acceptable reliability

**Cost:** ~$9/month for 100 analyses

---

#### Privacy-Focused / Offline
**Recommended: Ollama llama3.1:8b**

```bash
--provider ollama --model llama3.1:8b
```

**Pros:**
- Zero API costs (free)
- Complete data privacy (local execution)
- No internet required
- Unlimited usage

**Cons:**
- Requires capable hardware (16GB+ RAM)
- Setup more complex
- Slightly lower quality than cloud models

**Cost:** $0 (hardware investment only)

**Hardware Requirements:**
- CPU: 8+ cores or Apple Silicon
- RAM: 16 GB minimum
- Storage: 10 GB for model

---

### Model Size Requirements

**Critical Information:**

| Model Size | Tool Calling | Production Use |
|------------|--------------|----------------|
| < 3B parameters | ❌ Unreliable | Not recommended |
| 3-7B parameters | ⚠️ Limited | Testing only |
| 8-30B parameters | ✅ Good | Local production OK |
| 30B+ or Cloud | ✅ Excellent | Recommended |

**Do NOT use for production:**
- `llama3.2:3b` - Too small, cannot reliably call tools
- `llama2:7b` - Outdated, limited tool support

**Minimum for production:**
- `llama3.1:8b` - 8B parameters, acceptable tool calling
- `claude-3-haiku` - Small cloud model, good reliability
- `gpt-3.5-turbo` - Older but reliable

**Recommended for best results:**
- `claude-3-5-sonnet` - Best overall
- `gpt-4-turbo` - Excellent but more expensive
- `llama3:70b` - Best local option (requires 32GB+ RAM)

---

## Example Workflows

### Scenario 1: Monthly Progress Check

**Goal:** Quick review of the last month's training

```bash
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile ~/athlete_profile.json \
  --period-months 1 \
  --training-plan-weeks 4 \
  --provider anthropic
```

**Expected time:** ~2 minutes
**Cost:** ~$0.15 (Anthropic)
**Output:** Focus on recent trends, short-term plan

---

### Scenario 2: Comprehensive Annual Review

**Goal:** Full year analysis with detailed planning

```bash
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile ~/athlete_profile.json \
  --fit-dir ~/Strava/activities/ \
  --period-months 12 \
  --training-plan-weeks 24 \
  --output-dir ~/cycling-reports/2025-annual \
  --provider anthropic \
  --verbose
```

**Expected time:** ~3-4 minutes
**Cost:** ~$0.30 (Anthropic)
**Output:** Comprehensive insights, 6-month training plan

---

### Scenario 3: Budget-Friendly Weekly Check-In

**Goal:** Frequent monitoring with minimal cost

```bash
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile ~/athlete_profile.json \
  --period-months 1 \
  --training-plan-weeks 2 \
  --provider gemini
```

**Expected time:** ~2 minutes
**Cost:** ~$0.05 (Gemini)
**Output:** Recent performance, short-term adjustments

---

### Scenario 4: Privacy-Focused Local Analysis

**Goal:** Complete data privacy, no cloud services

```bash
# Ensure Ollama is running
ollama serve

# Run analysis locally
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile ~/athlete_profile.json \
  --fit-dir ~/Strava/activities/ \
  --period-months 6 \
  --training-plan-weeks 12 \
  --provider ollama \
  --model llama3.1:8b
```

**Expected time:** ~3-5 minutes (depends on hardware)
**Cost:** $0
**Output:** Same quality as cloud (with capable model)

---

### Scenario 5: Race Preparation (12 weeks out)

**Goal:** Targeted plan for upcoming event

```bash
# Update profile with race goal
cat > race_profile.json << 'EOF'
{
  "ftp": 265,
  "max_hr": 186,
  "weight_kg": 70,
  "age": 35,
  "goals": [
    "Complete Gran Fondo in under 5 hours",
    "Maintain power on climbs",
    "Improve pacing strategy"
  ],
  "target_event": {
    "name": "Local Gran Fondo",
    "date": "2025-04-15",
    "distance_km": 120,
    "elevation_m": 2000,
    "terrain": "hilly"
  }
}
EOF

cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile race_profile.json \
  --period-months 6 \
  --training-plan-weeks 12 \
  --provider anthropic
```

**Expected time:** ~3 minutes
**Cost:** ~$0.25 (Anthropic)
**Output:** Event-specific training plan with taper

---

## Custom Prompts

### Why Customize Prompts?

Default prompts are designed for general cycling analysis. Customize for:
- Specific coaching methodologies (e.g., polarized training)
- Discipline focus (road, mountain bike, gravel, track)
- Special populations (masters, juniors, adaptive athletes)
- Language preferences
- Coaching style (motivational vs. technical)

### Creating Custom Prompts

**Step 1: Create prompts directory**

```bash
mkdir -p ~/.cycling-ai/custom_prompts
```

**Step 2: Copy default prompts**

```bash
cp src/cycling_ai/orchestration/prompts/*.txt ~/.cycling-ai/custom_prompts/
```

**Step 3: Edit prompts**

Available prompt files:
- `data_preparation_agent.txt` - Validates input data
- `performance_analysis_agent.txt` - Analyzes performance
- `training_planning_agent.txt` - Creates training plans
- `report_generation_agent.txt` - Generates HTML reports

**Example: Customize for polarized training**

Edit `~/.cycling-ai/custom_prompts/training_planning_agent.txt`:

```text
You are an expert cycling coach specializing in POLARIZED TRAINING methodology.

Your analysis and recommendations must strictly follow polarized training principles:
- 80% of training time in Zone 1-2 (easy aerobic)
- 20% of training time in Zone 4-5 (threshold and above)
- AVOID Zone 3 (tempo/sweetspot) as much as possible

When creating training plans:
1. Structure workouts with clear easy/hard distinction
2. Emphasize recovery and easy aerobic volume
3. Include high-intensity intervals only 2-3x per week
4. Prioritize consistency over intensity
5. Reference scientific research (Seiler, etc.)

[Rest of prompt...]
```

**Step 4: Use custom prompts**

```bash
cycling-ai generate \
  --csv activities.csv \
  --profile athlete_profile.json \
  --prompts-dir ~/.cycling-ai/custom_prompts
```

---

## Cost Optimization

### Tips to Reduce Costs

#### 1. Choose Cost-Effective Providers

```bash
# Most expensive: OpenAI GPT-4 (~$0.60/workflow)
# Mid-range: Anthropic Claude (~$0.25/workflow)
# Budget: Google Gemini (~$0.09/workflow)
# Free: Ollama local (~$0.00/workflow)
```

#### 2. Analyze Shorter Periods

```bash
# Instead of:
--period-months 12  # Full year

# Use:
--period-months 3   # Last quarter (fewer tokens)
```

**Savings:** ~30-40% reduction in tokens

#### 3. Shorter Training Plans

```bash
# Instead of:
--training-plan-weeks 24  # 6-month plan

# Use:
--training-plan-weeks 8   # 2-month plan
```

**Savings:** ~20-25% reduction in tokens

#### 4. Skip FIT Files for Quick Checks

```bash
# FIT file analysis adds ~2,000-5,000 tokens
# Skip when you don't need detailed power analysis

cycling-ai generate \
  --csv activities.csv \
  --profile athlete_profile.json
  # No --fit-dir flag
```

#### 5. Use Local Models for Testing

```bash
# When experimenting with prompt changes or testing
# Use free local model to iterate quickly

--provider ollama --model llama3.1:8b
```

#### 6. Batch Monthly Updates

Instead of weekly check-ins (4× cost), do monthly reviews:

```bash
# Once per month:
cycling-ai generate --period-months 1 --training-plan-weeks 4
```

**Monthly cost:**
- Anthropic: $0.25/month (1 analysis)
- vs. Weekly: $1.00/month (4 analyses)

---

## Troubleshooting

### Common Issues

#### "No HTML reports generated"

**Symptoms:**
- Workflow completes without errors
- Output directory is empty or has no HTML files
- Warning message: "No report files were generated"

**Causes:**
1. Model too small (llama3.2:3b)
2. API rate limit exceeded
3. Insufficient disk space
4. Permissions issue

**Solutions:**

```bash
# 1. Check model size
ollama list  # Ensure 8B+ parameters

# 2. Use recommended model
--provider anthropic --model claude-3-5-sonnet-20241022

# 3. Check disk space
df -h

# 4. Check permissions
ls -ld ./reports
chmod 755 ./reports
```

#### "API key not found"

**Symptoms:**
- Error: "API key not configured"
- Error: "Authentication failed"

**Solution:**

```bash
# Set environment variable
export ANTHROPIC_API_KEY="sk-ant-your-key"

# Verify
echo $ANTHROPIC_API_KEY

# For persistence, add to shell profile
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
```

#### "CSV file invalid"

**Symptoms:**
- Error: "Unable to parse CSV file"
- Error: "Required columns missing"

**Required columns:**
- Activity Date
- Activity Name
- Activity Type
- Distance
- Moving Time

**Solution:**

```bash
# Check CSV format
head -1 activities.csv  # Should show column headers

# Re-export from Strava if corrupted
```

#### "Workflow extremely slow (> 10 minutes)"

**Causes:**
1. Large dataset (1000+ activities)
2. Many FIT files (500+)
3. Slow internet (cloud providers)
4. Underpowered hardware (local models)

**Solutions:**

```bash
# 1. Reduce period
--period-months 3  # Instead of 12

# 2. Skip FIT files
# Remove --fit-dir flag

# 3. Use cloud provider for speed
--provider anthropic  # Faster than local

# 4. Filter CSV to recent activities only
# Edit CSV to last 6 months
```

For more troubleshooting, see: `docs/TROUBLESHOOTING.md`

---

## FAQ

### General Questions

**Q: How long does it take to generate reports?**
A: Typically 2-5 minutes, depending on:
- Provider (cloud is faster than local)
- Period analyzed (shorter = faster)
- Model size (larger = slower)

**Q: Can I use this without a credit card?**
A: Yes! Use Ollama with a local model (llama3.1:8b). Completely free, no API costs.

**Q: Is my data private?**
A:
- **Local (Ollama):** 100% private, data never leaves your machine
- **Cloud providers:** Data sent to third-party APIs (see provider privacy policies)

**Q: Can I generate reports for multiple athletes?**
A: Yes, create separate profile files for each athlete:

```bash
cycling-ai generate --csv athlete1.csv --profile athlete1_profile.json
cycling-ai generate --csv athlete2.csv --profile athlete2_profile.json
```

### Data Questions

**Q: What if I don't have a power meter?**
A: You can still use the system with heart rate data. Provide your max HR in the profile, and the analysis will focus on HR zones instead of power zones.

**Q: Can I import from platforms other than Strava?**
A: Yes, as long as you can export to CSV with the required columns. Works with:
- Garmin Connect
- TrainingPeaks
- Wahoo
- Any platform that exports activity data

**Q: How often should I generate reports?**
A: Depends on your goals:
- **Monthly:** Good for active athletes tracking progress
- **Quarterly:** Sufficient for recreational cyclists
- **Before/after events:** Evaluate race prep and performance

### Technical Questions

**Q: Which model should I use?**
A:
- **Best quality:** `claude-3-5-sonnet` (Anthropic)
- **Best value:** `gemini-1.5-pro` (Google)
- **Best privacy:** `llama3.1:8b` (Ollama local)

**Q: Can I run this on Windows?**
A: Yes, using WSL2 (Windows Subsystem for Linux). Install WSL2, then follow Linux installation instructions.

**Q: Does this work offline?**
A: Yes, with Ollama local models. You'll need internet for initial model download, then fully offline.

**Q: What's the minimum FTP/fitness level to use this?**
A: Any level! Designed for cyclists from beginner to elite. The analysis adapts to your current fitness.

---

## Getting Help

**Resources:**
- **Troubleshooting Guide:** `docs/TROUBLESHOOTING.md`
- **Deployment Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
- **GitHub Issues:** https://github.com/yourusername/cycling-ai-analysis/issues

**When reporting issues, include:**
1. Command used (with `--verbose` flag)
2. Error message (full text)
3. Provider and model
4. System info (`uname -a`)
5. Log file: `~/.cycling-ai/logs/cycling-ai.log`

---

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Next:** See `TROUBLESHOOTING.md` for solutions to common problems
