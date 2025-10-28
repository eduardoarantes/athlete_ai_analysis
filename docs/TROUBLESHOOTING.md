# Troubleshooting Guide: Cycling AI Analysis

**Version:** 1.0.0
**Last Updated:** 2025-10-27

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Errors](#common-errors)
3. [Report Generation Issues](#report-generation-issues)
4. [LLM Provider Issues](#llm-provider-issues)
5. [Performance Issues](#performance-issues)
6. [Data Import Issues](#data-import-issues)
7. [Installation Issues](#installation-issues)
8. [Debugging Tools](#debugging-tools)
9. [Getting Help](#getting-help)

---

## Quick Diagnostics

### Run System Health Check

```bash
# 1. Check installation
cycling-ai --version

# 2. Check providers
cycling-ai providers list

# 3. Run test command
cycling-ai generate --help

# 4. Check logs
tail -50 ~/.cycling-ai/logs/cycling-ai.log
```

### Check Environment

```bash
# Python version (must be 3.11+)
python3 --version

# Virtual environment active?
which cycling-ai

# API keys set?
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# Disk space available?
df -h ~
```

---

## Common Errors

### Error 1: "Command not found: cycling-ai"

**Full Error:**
```
zsh: command not found: cycling-ai
```

**Cause:** Virtual environment not activated or package not installed

**Solution:**

```bash
# Activate virtual environment
cd /path/to/cycling-ai-analysis
source .venv/bin/activate

# Verify activation (should show .venv/bin/cycling-ai)
which cycling-ai

# If still not found, reinstall
pip install -e .
```

---

### Error 2: "API key not configured"

**Full Error:**
```
Error: API key not configured for provider 'anthropic'
Set the ANTHROPIC_API_KEY environment variable
```

**Cause:** Missing or incorrectly set API key

**Solution:**

```bash
# Set API key for current session
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Verify it's set
echo $ANTHROPIC_API_KEY

# Make it permanent (choose your shell)
# For bash:
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc

# For zsh (macOS default):
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc

# Test
cycling-ai providers list
```

**Alternative:** Use config file

```bash
# Create config with API key
cat > ~/.cycling-ai/config.yaml << 'EOF'
providers:
  anthropic:
    api_key: "sk-ant-your-key-here"
EOF

chmod 600 ~/.cycling-ai/config.yaml
```

---

### Error 3: "CSV file invalid" or "Unable to parse CSV"

**Full Error:**
```
Error: Unable to parse CSV file: /path/to/activities.csv
Required columns missing: ['Activity Date', 'Activity Name', ...]
```

**Cause:** CSV file doesn't match expected Strava format

**Diagnosis:**

```bash
# Check first few lines
head -5 activities.csv

# Check column headers
head -1 activities.csv

# Count columns
head -1 activities.csv | tr ',' '\n' | nl
```

**Required Columns:**
- Activity Date
- Activity Name
- Activity Type
- Distance
- Moving Time
- Elapsed Time
- Elevation Gain

**Solution:**

1. **Re-export from Strava:**
   - Go to Strava → Settings → My Account
   - Download or Delete Your Account → Download Request
   - Wait for email, download fresh export

2. **Check file encoding:**
   ```bash
   # Should be UTF-8
   file -I activities.csv

   # If not UTF-8, convert
   iconv -f ISO-8859-1 -t UTF-8 activities.csv > activities_utf8.csv
   ```

3. **Check for corrupted data:**
   ```bash
   # Look for malformed rows (varying column counts)
   awk -F',' '{print NF}' activities.csv | sort -u

   # Should show consistent number (usually 20-30)
   # If multiple numbers, CSV is corrupted
   ```

---

### Error 4: "No power data found in processed files"

**Full Error:**
```
Error: No power data found in processed files
Analysis requires power meter data
```

**Cause:** Activities don't contain power data (no power meter used)

**Solution:**

**Option 1: Use heart rate instead**

```bash
# Don't specify --fit-dir
cycling-ai generate \
  --csv activities.csv \
  --profile athlete_profile.json

# System will use heart rate zones instead
```

**Option 2: Filter to power-only activities**

Edit your CSV to include only activities with power data, or:

```bash
# Extract only rows with power data
awk -F',' 'NR==1 || $12 > 0' activities.csv > power_activities.csv

# Column 12 is typically "Average Power"
# Adjust if your CSV format differs
```

**Option 3: Update athlete profile**

```json
{
  "ftp": 265,
  "max_hr": 186,
  "use_heart_rate_fallback": true
}
```

---

### Error 5: "DID NOT RAISE ValueError" (in tests)

**Full Error:**
```
tests/tools/wrappers/test_zones.py::test_execute_invalid_period_months FAILED
Expected ValueError but got ToolExecutionResult(success=False, ...)
```

**Cause:** Tests expecting validation errors, but tool returns graceful failures

**This is expected behavior:** Tools return structured errors (`ToolExecutionResult`) instead of raising exceptions.

**No action needed** - this is handled in Phase 4B test fixes.

---

## Report Generation Issues

### Issue 1: No HTML Reports Generated

**Symptoms:**
- Workflow completes successfully
- No errors shown
- Output directory empty or missing HTML files
- Warning: "No report files were generated"

**Diagnosis:**

```bash
# Check output directory
ls -la ./reports/

# Check session logs
ls -la ~/.cycling-ai/workflow_sessions/

# Check for most recent session
ls -lt ~/.cycling-ai/workflow_sessions/ | head -5

# Examine session file
cat ~/.cycling-ai/workflow_sessions/<session-id>.json | python3 -m json.tool
```

**Common Causes:**

#### Cause A: Model Too Small (MOST COMMON)

**Evidence:**
- Using `llama3.2:3b` or other small model
- Session file shows no tool calls
- Workflow completes quickly (< 2 min)

**Solution:**

```bash
# Use larger model
--provider ollama --model llama3.1:8b  # Minimum 8B parameters

# Or use cloud provider
--provider anthropic --model claude-3-5-sonnet-20241022
```

**Model Requirements:**
| Model | Parameters | Tool Calling | Recommended |
|-------|------------|--------------|-------------|
| llama3.2:3b | 3B | ❌ No | Testing only |
| llama3.1:8b | 8B | ✅ Yes | Minimum |
| llama3:70b | 70B | ✅ Yes | Best local |
| claude-3-5-sonnet | N/A (cloud) | ✅ Yes | Best overall |

#### Cause B: API Rate Limit

**Evidence:**
- Error in logs: "Rate limit exceeded"
- Multiple requests in short time

**Solution:**

```bash
# Wait and retry
sleep 60
cycling-ai generate ...

# Or use different provider
--provider gemini  # Often has higher free tier limits
```

#### Cause C: Disk Space

**Evidence:**
- Error: "No space left on device"
- `df -h` shows full disk

**Solution:**

```bash
# Check disk space
df -h

# Clean up old sessions
rm -rf ~/.cycling-ai/workflow_sessions/*.json

# Clean up old reports
rm -rf ~/old_reports

# Change output directory to different disk
--output-dir /path/to/disk/with/space
```

#### Cause D: Permissions

**Evidence:**
- Error: "Permission denied"
- Cannot write to output directory

**Solution:**

```bash
# Check permissions
ls -ld ./reports

# Fix permissions
chmod 755 ./reports

# Or use directory you own
--output-dir ~/my-cycling-reports
```

---

### Issue 2: Incomplete Reports (Some Files Missing)

**Symptoms:**
- Some HTML files generated but not all
- Expected 3 files, got 1-2

**Diagnosis:**

```bash
# List output files
ls -la ./reports/

# Check which phase failed
grep "Phase.*complete" ~/.cycling-ai/logs/cycling-ai.log | tail -10
```

**Solution:**

```bash
# Run with verbose logging
cycling-ai generate \
  --csv activities.csv \
  --profile athlete_profile.json \
  --verbose

# Check logs for specific phase failure
grep "ERROR" ~/.cycling-ai/logs/cycling-ai.log

# Retry with same session (if supported)
# Or start fresh with different model
```

---

### Issue 3: Reports Generated But Content is Poor Quality

**Symptoms:**
- HTML files exist
- Content is generic, vague, or unhelpful
- No specific insights for your data

**Causes:**
- Model too small
- Insufficient input data
- Poor quality input data

**Solutions:**

**1. Use more capable model:**

```bash
# Upgrade from:
--provider ollama --model llama3.1:8b

# To:
--provider anthropic --model claude-3-5-sonnet-20241022
```

**2. Provide more data:**

```bash
# Include FIT files
--fit-dir ~/Strava/activities/

# Analyze longer period
--period-months 6  # Instead of 1
```

**3. Improve athlete profile:**

```json
{
  "ftp": 265,
  "max_hr": 186,
  "weight_kg": 70,
  "age": 35,
  "goals": [
    "Increase FTP from 265 to 285 watts",
    "Complete century ride in under 5 hours",
    "Improve climbing power-to-weight ratio"
  ],
  "current_fitness": 7,
  "injury_history": ["Lower back pain from 2023"],
  "time_constraints": {
    "hours_per_week": 8,
    "days_available": ["Mon", "Wed", "Fri", "Sat", "Sun"]
  }
}
```

---

## LLM Provider Issues

### Anthropic Issues

#### Error: "Invalid API key"

**Solution:**

```bash
# Verify key format (should start with sk-ant-)
echo $ANTHROPIC_API_KEY

# Generate new key at https://console.anthropic.com/settings/keys

# Set environment variable
export ANTHROPIC_API_KEY="sk-ant-new-key"
```

#### Error: "Rate limit exceeded"

**Solution:**

```bash
# Check rate limits in Anthropic console
# Wait for rate limit reset (usually 60 seconds)

# Or upgrade to higher tier plan
```

---

### OpenAI Issues

#### Error: "Incorrect API key provided"

**Solution:**

```bash
# Verify key format (should start with sk-)
echo $OPENAI_API_KEY

# Generate new key at https://platform.openai.com/api-keys

export OPENAI_API_KEY="sk-new-key"
```

#### Error: "You exceeded your current quota"

**Cause:** No credits or payment method on OpenAI account

**Solution:**

1. Go to https://platform.openai.com/account/billing
2. Add payment method
3. Buy credits or set up auto-recharge

---

### Ollama Issues

#### Error: "Connection refused" or "Failed to connect to Ollama"

**Cause:** Ollama service not running

**Solution:**

```bash
# Start Ollama service
ollama serve

# In another terminal, test
ollama list

# Then run cycling-ai generate
```

#### Error: "Model not found: llama3.1:8b"

**Cause:** Model not downloaded

**Solution:**

```bash
# List available models
ollama list

# Pull required model
ollama pull llama3.1:8b

# Verify
ollama list
```

#### Issue: Ollama running but very slow

**Cause:** Insufficient RAM or CPU resources

**Diagnosis:**

```bash
# Check memory usage
top -l 1 | grep PhysMem

# Check if swap being used
vm_stat | grep "page outs"
```

**Solutions:**

1. **Use smaller model:**
   ```bash
   ollama pull llama3.1:8b  # Instead of llama3:70b
   ```

2. **Close other applications:**
   ```bash
   # Free up RAM by closing browsers, IDEs, etc.
   ```

3. **Use cloud provider instead:**
   ```bash
   --provider anthropic  # Much faster
   ```

---

### Gemini Issues

#### Error: "API key not valid"

**Solution:**

```bash
# Generate key at https://makersuite.google.com/app/apikey

export GOOGLE_API_KEY="your-key"

# Verify
cycling-ai providers list
```

---

## Performance Issues

### Issue 1: Workflow Takes > 10 Minutes

**Expected:** 2-5 minutes
**Actual:** 10+ minutes

**Diagnosis:**

```bash
# Run with verbose logging
cycling-ai generate --verbose ...

# Check which phase is slow
grep "Phase.*complete" logs/cycling-ai.log
```

**Causes and Solutions:**

#### Cause A: Large Dataset

**Evidence:**
- CSV has 1000+ activities
- Many years of data

**Solution:**

```bash
# Reduce period
--period-months 6  # Instead of 24

# Or filter CSV to recent activities
tail -500 activities.csv > recent_activities.csv
```

#### Cause B: Many FIT Files

**Evidence:**
- FIT directory has 500+ files
- Slow on Phase 2 (Performance Analysis)

**Solution:**

```bash
# Skip FIT files for faster analysis
# Remove --fit-dir flag

# Or filter FIT directory
mkdir recent_fit
cp fit_dir/2025-*.fit recent_fit/
--fit-dir recent_fit
```

#### Cause C: Slow Internet (Cloud Providers)

**Evidence:**
- Slow on all phases
- Cloud provider (Anthropic, OpenAI, Gemini)

**Solution:**

```bash
# Switch to local model
--provider ollama --model llama3.1:8b

# Or check internet speed
speedtest-cli
```

#### Cause D: Underpowered Hardware (Local Models)

**Evidence:**
- Using Ollama
- CPU usage high
- RAM usage high

**Solution:**

```bash
# Use smaller model
ollama pull llama3.1:8b  # Instead of llama3:70b

# Or switch to cloud
--provider anthropic
```

---

### Issue 2: High Memory Usage / System Freezing

**Symptoms:**
- System becomes unresponsive
- RAM usage near 100%
- Swap usage very high

**Cause:** Model too large for available RAM

**Solution:**

```bash
# Check RAM
sysctl hw.memsize  # macOS
free -h            # Linux

# Use smaller model
ollama pull llama3.1:8b  # 4.7 GB
# Instead of llama3:70b  # 39 GB

# Or use cloud provider (minimal local memory)
--provider anthropic
```

---

## Data Import Issues

### Issue 1: Activities from Multiple Athletes in CSV

**Symptoms:**
- CSV contains activities from group rides, friends, etc.
- Analysis includes others' data

**Solution:**

```bash
# Filter CSV to your activities only
# Option 1: Export fresh CSV from Strava (recommended)

# Option 2: Filter by athlete name
grep "YourName" activities.csv > my_activities.csv

# Ensure header row is included
head -1 activities.csv > filtered.csv
grep "YourName" activities.csv >> filtered.csv
```

---

### Issue 2: Missing Heart Rate or Power Data

**Symptoms:**
- Many activities show 0 for power or HR
- Analysis incomplete

**Solution:**

**For missing power data:**
```bash
# Use heart rate analysis instead
# Don't specify --fit-dir
# System will use HR zones

# Update profile to indicate HR-based training
{
  "max_hr": 186,
  "zones": {
    "hr": {
      "zone1": [0, 130],
      "zone2": [131, 149],
      ...
    }
  }
}
```

**For missing HR data:**
```bash
# Filter to power-only activities
# Or accept limited analysis
```

---

### Issue 3: Incorrect FTP or Zones

**Symptoms:**
- Training zones seem wrong
- TSS values unrealistic
- Plan too easy or too hard

**Solution:**

```bash
# Update athlete profile with correct FTP
# Test FTP:
# Option 1: 20-min max power × 0.95
# Option 2: 60-min max power
# Option 3: Ramp test

cat > athlete_profile.json << 'EOF'
{
  "ftp": 285,  // Updated FTP
  "max_hr": 186,
  ...
}
EOF

# Regenerate reports
cycling-ai generate --csv activities.csv --profile athlete_profile.json
```

---

## Installation Issues

### Issue 1: Python Version Too Old

**Error:**
```
ERROR: Python 3.11 or higher is required
```

**Solution:**

```bash
# Check current version
python3 --version

# Install Python 3.11+ using pyenv (recommended)
curl https://pyenv.run | bash
pyenv install 3.11.7
pyenv global 3.11.7

# Verify
python3 --version  # Should show 3.11.7
```

---

### Issue 2: pip/uv Installation Fails

**Error:**
```
ERROR: Could not find a version that satisfies the requirement cycling-ai
```

**Solution:**

```bash
# Ensure you're in the project directory
cd /path/to/cycling-ai-analysis

# Install in editable mode
pip install -e .

# Or with uv
uv pip install -e .
```

---

### Issue 3: Missing Dependencies

**Error:**
```
ModuleNotFoundError: No module named 'anthropic'
```

**Solution:**

```bash
# Reinstall dependencies
pip install -e ".[dev]"

# Or individual package
pip install anthropic
```

---

## Debugging Tools

### Enable Debug Logging

```bash
# Set log level
export CYCLING_AI_LOG_LEVEL="DEBUG"

# Run with verbose flag
cycling-ai generate --verbose ...

# Check detailed logs
tail -f ~/.cycling-ai/logs/cycling-ai.log
```

### Inspect Session Data

```bash
# Find most recent session
ls -lt ~/.cycling-ai/workflow_sessions/ | head -5

# View session file (formatted)
cat ~/.cycling-ai/workflow_sessions/<session-id>.json | python3 -m json.tool

# Check for tool calls
jq '.messages[] | select(.role == "tool")' ~/.cycling-ai/workflow_sessions/<session-id>.json
```

### Test Provider Connectivity

```bash
# Test Anthropic
python3 << 'EOF'
import os
from cycling_ai.providers import AnthropicProvider

provider = AnthropicProvider(api_key=os.environ["ANTHROPIC_API_KEY"])
response = provider.chat(messages=[{"role": "user", "content": "Hello"}])
print("Success:", response.content)
EOF

# Test Ollama
curl http://localhost:11434/api/tags

# Test model
ollama run llama3.1:8b "Hello, test message"
```

### Check File Permissions

```bash
# Config directory
ls -ld ~/.cycling-ai
# Should be: drwxr-xr-x (755)

# Config file
ls -l ~/.cycling-ai/config.yaml
# Should be: -rw------- (600)

# Session directories
ls -ld ~/.cycling-ai/sessions
ls -ld ~/.cycling-ai/workflow_sessions
# Should be: drwxr-xr-x (755)

# Fix if needed
chmod 755 ~/.cycling-ai
chmod 600 ~/.cycling-ai/config.yaml
chmod 755 ~/.cycling-ai/sessions
chmod 755 ~/.cycling-ai/workflow_sessions
```

### Validate CSV Format

```bash
# Check CSV structure
csvlook activities.csv | head

# Count rows
wc -l activities.csv

# Check for required columns
head -1 activities.csv | tr ',' '\n' | grep -i "activity date\|activity name\|distance"

# Validate with Python
python3 << 'EOF'
import pandas as pd
df = pd.read_csv('activities.csv')
print("Rows:", len(df))
print("Columns:", df.columns.tolist())
print("Date range:", df['Activity Date'].min(), "to", df['Activity Date'].max())
EOF
```

---

## Getting Help

### Before Asking for Help

Collect this information:

```bash
# 1. System information
uname -a
python3 --version
cycling-ai --version

# 2. Provider information
echo "Provider: $PROVIDER"
echo "Model: $MODEL"
ollama list  # If using Ollama

# 3. Error message (full text)
# Copy from terminal or logs

# 4. Command used
# Copy the exact cycling-ai generate command

# 5. Log file
tail -100 ~/.cycling-ai/logs/cycling-ai.log > debug_log.txt
```

### Resources

**Documentation:**
- User Guide: `docs/USER_GUIDE_GENERATE.md`
- Deployment Checklist: `docs/DEPLOYMENT_CHECKLIST.md`
- Performance Report: `.claude/current_task/PLAN/phase4c_performance_report.md`

**GitHub:**
- Issues: https://github.com/yourusername/cycling-ai-analysis/issues
- Discussions: https://github.com/yourusername/cycling-ai-analysis/discussions

**Community:**
- Discord: [Link to community Discord]
- Reddit: r/cyclingai

### How to Report a Bug

Create GitHub issue with:

**Title:** Clear, specific description
**Example:** "No HTML reports generated with llama3.2:3b"

**Body Template:**
```markdown
## Description
[What went wrong?]

## Steps to Reproduce
1. Command used: `cycling-ai generate --csv ... --provider ...`
2. [Step 2]
3. [Step 3]

## Expected Behavior
[What should have happened?]

## Actual Behavior
[What actually happened?]

## Environment
- OS: [macOS 14.6 / Ubuntu 22.04 / Windows 11]
- Python Version: [3.11.7]
- cycling-ai Version: [1.0.0]
- Provider: [anthropic / openai / ollama]
- Model: [claude-3-5-sonnet / llama3.1:8b]

## Error Message
```
[Full error message]
```

## Logs
[Paste relevant log excerpts or attach debug_log.txt]

## Additional Context
[Any other relevant information]
```

---

## Known Limitations

### Model Size Limitation

**Issue:** Models with < 8B parameters (e.g., llama3.2:3b) cannot reliably execute tool calls

**Symptom:** Workflow completes but no HTML reports generated

**Workaround:** Use llama3.1:8b (minimum) or cloud models

**Documented in:** `.claude/current_task/PLAN/phase4c_performance_report.md`

### CSV Format Variations

**Issue:** Some CSV exports from non-Strava platforms may have different column names

**Workaround:** Rename columns to match Strava format

**Example:**
```bash
# If your CSV has "Date" instead of "Activity Date"
sed -i.bak 's/^Date,/Activity Date,/' activities.csv
```

### FIT File Parsing

**Issue:** Some FIT files from older devices may not parse correctly

**Workaround:** Skip FIT files or use newer activity exports

### Large Datasets

**Issue:** Analyzing > 2000 activities may be slow or hit token limits

**Workaround:** Filter to recent period (--period-months 6)

---

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Feedback:** Please report issues or suggest improvements via GitHub Issues
