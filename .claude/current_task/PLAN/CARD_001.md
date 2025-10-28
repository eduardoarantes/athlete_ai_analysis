# Task Card 001: Real-World Testing with LLM Providers

**Sub-Phase:** 4A - Real-World Testing
**Priority:** CRITICAL
**Duration:** 1-2 days
**Dependencies:** None (can start immediately)
**Status:** PENDING

---

## Objective

Validate the multi-agent workflow with actual LLM providers (not mocks) using real cycling data to ensure production readiness.

---

## Acceptance Criteria

- [ ] Ollama (local) tested successfully
- [ ] Anthropic Claude tested successfully
- [ ] All 4 phases execute without errors
- [ ] 3 HTML files generated for each provider
- [ ] HTML reports contain valid, readable content
- [ ] Execution time < 5 minutes per workflow
- [ ] Token usage measured and documented
- [ ] Test logs saved for each provider

---

## Test Matrix

| Provider | Model | Status | Output Dir | Log File |
|----------|-------|--------|------------|----------|
| Ollama | llama3.2:3b | ⏳ | `/tmp/reports_ollama` | `test_results_ollama.log` |
| Anthropic | claude-3-5-sonnet | ⏳ | `/tmp/reports_anthropic` | `test_results_anthropic.log` |
| OpenAI | gpt-4-turbo | Optional | `/tmp/reports_openai` | `test_results_openai.log` |
| Gemini | gemini-1.5-pro | Optional | `/tmp/reports_gemini` | `test_results_gemini.log` |

---

## Test Procedure

### Setup

```bash
# 1. Verify Ollama is running
ollama list  # Should show llama3.2:3b

# If not, install and pull:
ollama pull llama3.2:3b
ollama serve  # In separate terminal

# 2. Verify API keys
echo $ANTHROPIC_API_KEY  # Should not be empty
# If empty:
# export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Verify test data exists
ls -la tests/data/real_activities.csv
ls -la tests/data/test_profile.json
ls -la tests/data/fit_files/

# 4. Create output directories
mkdir -p /tmp/reports_ollama
mkdir -p /tmp/reports_anthropic
```

### Test with Ollama

```bash
# Execute workflow
time .venv/bin/cycling-ai generate \
  --csv tests/data/real_activities.csv \
  --profile tests/data/test_profile.json \
  --fit-dir tests/data/fit_files \
  --output-dir /tmp/reports_ollama \
  --period-months 6 \
  --training-plan-weeks 10 \
  --provider ollama \
  --model llama3.2:3b \
  2>&1 | tee .claude/current_task/PLAN/test_results_ollama.log

# Validation
ls -lh /tmp/reports_ollama/
# Should show:
# - index.html
# - coaching_insights.html
# - performance_dashboard.html

# Open in browser for visual inspection
open /tmp/reports_ollama/index.html  # macOS
# or
firefox /tmp/reports_ollama/index.html  # Linux
```

### Test with Anthropic

```bash
# Execute workflow
time .venv/bin/cycling-ai generate \
  --csv tests/data/real_activities.csv \
  --profile tests/data/test_profile.json \
  --fit-dir tests/data/fit_files \
  --output-dir /tmp/reports_anthropic \
  --period-months 6 \
  --training-plan-weeks 10 \
  --provider anthropic \
  --model claude-3-5-sonnet-20241022 \
  2>&1 | tee .claude/current_task/PLAN/test_results_anthropic.log

# Validation
ls -lh /tmp/reports_anthropic/
open /tmp/reports_anthropic/index.html
```

### Test with OpenAI (Optional)

```bash
# Only if OPENAI_API_KEY is available
if [ -n "$OPENAI_API_KEY" ]; then
  time .venv/bin/cycling-ai generate \
    --csv tests/data/real_activities.csv \
    --profile tests/data/test_profile.json \
    --fit-dir tests/data/fit_files \
    --output-dir /tmp/reports_openai \
    --period-months 6 \
    --training-plan-weeks 10 \
    --provider openai \
    --model gpt-4-turbo-2024-04-09 \
    2>&1 | tee .claude/current_task/PLAN/test_results_openai.log
fi
```

### Test with Gemini (Optional)

```bash
# Only if GOOGLE_API_KEY is available
if [ -n "$GOOGLE_API_KEY" ]; then
  time .venv/bin/cycling-ai generate \
    --csv tests/data/real_activities.csv \
    --profile tests/data/test_profile.json \
    --fit-dir tests/data/fit_files \
    --output-dir /tmp/reports_gemini \
    --period-months 6 \
    --training-plan-weeks 10 \
    --provider gemini \
    --model gemini-1.5-pro \
    2>&1 | tee .claude/current_task/PLAN/test_results_gemini.log
fi
```

---

## Validation Checklist

For each provider tested, verify:

### Phase Execution
- [ ] Phase 1 (Data Preparation) completes
- [ ] Phase 2 (Performance Analysis) completes
- [ ] Phase 3 (Training Planning) completes
- [ ] Phase 4 (Report Generation) completes
- [ ] No errors in terminal output
- [ ] Progress display shows all phases completed

### Output Files
- [ ] `index.html` exists
- [ ] `coaching_insights.html` exists
- [ ] `performance_dashboard.html` exists
- [ ] All files are non-empty (> 1 KB)
- [ ] HTML is valid (no parsing errors in browser)

### Report Content
- [ ] Athlete name appears in index.html
- [ ] Performance metrics are populated (not "N/A")
- [ ] Zone distribution shows actual data
- [ ] Training plan has weekly structure
- [ ] Reports are visually professional
- [ ] No "Error" or "Failed" messages in reports

### Performance
- [ ] Total execution time < 5 minutes
- [ ] No crashes or hangs
- [ ] Memory usage reasonable (< 2 GB)

---

## Performance Metrics to Collect

For each provider, record in a CSV file:

```csv
provider,model,phase,duration_sec,tokens_used,success,errors
ollama,llama3.2:3b,phase_1_data_prep,5.2,850,true,
ollama,llama3.2:3b,phase_2_performance,42.1,7500,true,
ollama,llama3.2:3b,phase_3_training,35.3,4800,true,
ollama,llama3.2:3b,phase_4_reports,58.7,9200,true,
anthropic,claude-3-5-sonnet,phase_1_data_prep,3.1,900,true,
...
```

Save as: `.claude/current_task/PLAN/performance_metrics.csv`

---

## Expected Issues & Troubleshooting

### Issue: Ollama not responding
**Symptom:** Connection refused error
**Fix:**
```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama
ollama serve
```

### Issue: API key not found
**Symptom:** "API key not found" error
**Fix:**
```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify
echo $ANTHROPIC_API_KEY
```

### Issue: Test data not found
**Symptom:** "File not found" error
**Fix:**
```bash
# Check if test data exists
ls tests/data/

# If missing, use alternative data or create sample data
```

### Issue: Phase failure
**Symptom:** One phase fails, workflow stops
**Action:**
1. Check error message in logs
2. Identify which tool failed
3. Verify tool can run standalone
4. Check tool wrapper tests
5. Report issue if unexpected

---

## Success Criteria

**Minimum Requirements:**
- [ ] Ollama tested successfully
- [ ] Anthropic tested successfully
- [ ] Both providers generate 3 HTML files
- [ ] All reports are valid and readable
- [ ] Execution time < 5 minutes for both

**Optional (Nice to Have):**
- [ ] OpenAI tested
- [ ] Gemini tested
- [ ] Performance comparison documented

---

## Deliverables

1. **Test logs** (saved in `.claude/current_task/PLAN/`):
   - `test_results_ollama.log`
   - `test_results_anthropic.log`
   - `test_results_openai.log` (if tested)
   - `test_results_gemini.log` (if tested)

2. **Performance metrics CSV**:
   - `performance_metrics.csv`

3. **Generated reports** (for inspection):
   - `/tmp/reports_ollama/*.html`
   - `/tmp/reports_anthropic/*.html`

4. **Quality assessment** (written summary):
   - Compare report quality across providers
   - Identify any provider-specific issues
   - Document insights quality differences

---

## Files to Create/Modify

**New Files:**
- `.claude/current_task/PLAN/test_results_ollama.log`
- `.claude/current_task/PLAN/test_results_anthropic.log`
- `.claude/current_task/PLAN/performance_metrics.csv`
- `.claude/current_task/PLAN/provider_comparison.md`

**No Code Changes:** This is a testing-only task.

---

## Definition of Done

Task is complete when:
- [ ] Minimum 2 providers tested (Ollama + Anthropic)
- [ ] All tests documented in log files
- [ ] Performance metrics collected
- [ ] Reports visually inspected and validated
- [ ] Provider comparison documented
- [ ] Any issues identified and documented

---

**Status:** PENDING → Execute this task first
**Next Task:** CARD_002 (Fix Pre-Existing Test Failures)
