# Task Card 003: Performance Benchmarking & Optimization

**Sub-Phase:** 4C - Performance Benchmarking
**Priority:** MEDIUM
**Duration:** 1 day
**Dependencies:** CARD_001 (Real-world testing complete)
**Status:** PENDING

---

## Objective

Measure and document performance characteristics of the multi-agent workflow to validate the < 5 min requirement and provide cost estimates for users.

---

## Acceptance Criteria

- [ ] Performance data collected for all tested providers
- [ ] Token usage measured per phase
- [ ] Execution time measured per phase
- [ ] Cost analysis complete for cloud providers
- [ ] Benchmark report written
- [ ] Performance within acceptable range (< 5 min total)

---

## Metrics to Collect

### 1. Token Usage per Phase

**Expected (from architecture):**
```
Phase 1: Data Preparation      ~  1,000 tokens
Phase 2: Performance Analysis  ~  8,000 tokens
Phase 3: Training Planning     ~  5,000 tokens
Phase 4: Report Generation     ~ 10,000 tokens
──────────────────────────────────────────────
Total:                         ~ 24,000 tokens
```

**Actual (to be measured):**
```
Provider: Ollama (llama3.2:3b)
Phase 1: _____ tokens
Phase 2: _____ tokens
Phase 3: _____ tokens
Phase 4: _____ tokens
Total:   _____ tokens

Provider: Anthropic (claude-3-5-sonnet)
Phase 1: _____ tokens
Phase 2: _____ tokens
Phase 3: _____ tokens
Phase 4: _____ tokens
Total:   _____ tokens
```

### 2. Execution Time per Phase

**Target:**
```
Phase 1: <  10 seconds
Phase 2: <  60 seconds
Phase 3: <  45 seconds
Phase 4: <  90 seconds
──────────────────────────
Total:   < 300 seconds (5 min)
```

**Actual (to be measured):**
```
Provider: Ollama
Phase 1: _____ sec
Phase 2: _____ sec
Phase 3: _____ sec
Phase 4: _____ sec
Total:   _____ sec

Provider: Anthropic
Phase 1: _____ sec
Phase 2: _____ sec
Phase 3: _____ sec
Phase 4: _____ sec
Total:   _____ sec
```

### 3. Cost Analysis

**Pricing (as of 2025-10-27):**

**Claude Sonnet 3.5 (Anthropic):**
- Input:  $3.00 per million tokens
- Output: $15.00 per million tokens

**GPT-4 Turbo (OpenAI):**
- Input:  $10.00 per million tokens
- Output: $30.00 per million tokens

**Gemini 1.5 Pro (Google):**
- Input:  $1.25 per million tokens
- Output: $5.00 per million tokens

**Ollama (Local):**
- Cost: $0 (compute only)

**Calculate per workflow:**
```
Cost = (input_tokens × input_price) + (output_tokens × output_price)
```

### 4. Resource Usage

- **Memory:** Peak memory usage (MB)
- **Disk:** Session storage size (MB)
- **Reports:** Total size of 3 HTML files (KB)
- **CPU:** Average CPU usage (%)

---

## Benchmark Procedure

### Step 1: Prepare Environment

```bash
# Create benchmark directory
mkdir -p .claude/current_task/PLAN/benchmarks

# Verify test data
ls -lh tests/data/real_activities.csv
ls -lh tests/data/test_profile.json
ls -lh tests/data/fit_files/

# Clean previous outputs
rm -rf /tmp/benchmark_*
```

### Step 2: Run Benchmarks

**For Each Provider (Ollama, Anthropic, OpenAI if available):**

```bash
# Set provider
PROVIDER="ollama"  # or "anthropic", "openai", etc.
MODEL="llama3.2:3b"  # or "claude-3-5-sonnet-20241022", etc.

# Run 3 times for average
for RUN in 1 2 3; do
  echo "===== Run $RUN for $PROVIDER ====="

  # Measure time and memory
  /usr/bin/time -l .venv/bin/cycling-ai generate \
    --csv tests/data/real_activities.csv \
    --profile tests/data/test_profile.json \
    --fit-dir tests/data/fit_files \
    --output-dir /tmp/benchmark_${PROVIDER}_run${RUN} \
    --provider $PROVIDER \
    --model $MODEL \
    --period-months 6 \
    --training-plan-weeks 10 \
    2>&1 | tee .claude/current_task/PLAN/benchmarks/${PROVIDER}_run${RUN}.log

  # Extract metrics from log
  echo "Extracting metrics..."

  # Record file sizes
  du -sh /tmp/benchmark_${PROVIDER}_run${RUN}/*.html

  echo "---"
  sleep 5  # Cool-down between runs
done
```

### Step 3: Extract and Analyze Data

Create Python script to parse logs and extract metrics:

```python
# .claude/current_task/PLAN/benchmarks/analyze_benchmarks.py

import re
import csv
from pathlib import Path

def parse_log(log_file):
    """Extract metrics from benchmark log."""
    with open(log_file) as f:
        content = f.read()

    metrics = {
        'provider': '',
        'run': 0,
        'phase_1_time': 0.0,
        'phase_2_time': 0.0,
        'phase_3_time': 0.0,
        'phase_4_time': 0.0,
        'total_time': 0.0,
        'tokens_used': 0,
    }

    # Extract phase times (if logged)
    # Extract total time from /usr/bin/time output
    # Extract token usage (if available)

    return metrics

def main():
    log_dir = Path('.claude/current_task/PLAN/benchmarks')
    results = []

    for log_file in log_dir.glob('*.log'):
        metrics = parse_log(log_file)
        results.append(metrics)

    # Write to CSV
    with open(log_dir / 'benchmark_results.csv', 'w') as f:
        writer = csv.DictWriter(f, fieldnames=metrics.keys())
        writer.writeheader()
        writer.writerows(results)

    print("Benchmark results saved to benchmark_results.csv")

if __name__ == '__main__':
    main()
```

Run analysis:
```bash
.venv/bin/python .claude/current_task/PLAN/benchmarks/analyze_benchmarks.py
```

### Step 4: Calculate Statistics

For each provider:
- Average execution time across 3 runs
- Standard deviation
- Min/max times
- Average token usage
- Cost per workflow

---

## Performance Targets

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| Total Time | < 5 min | < 7 min |
| Phase 1 Time | < 10 sec | < 20 sec |
| Phase 2 Time | < 60 sec | < 90 sec |
| Phase 3 Time | < 45 sec | < 60 sec |
| Phase 4 Time | < 90 sec | < 120 sec |
| Token Usage | < 30k | < 40k |
| Cost (Claude) | < $0.30 | < $0.50 |
| Memory | < 1 GB | < 2 GB |

**If targets not met:** Document reasons and optimization recommendations.

---

## Optimization Opportunities

If performance is below targets, consider:

### 1. Prompt Optimization
- Reduce prompt verbosity
- Remove unnecessary context
- More concise system prompts

### 2. Tool Result Filtering
- Extract only necessary data
- Compress verbose JSON outputs
- Remove redundant information

### 3. Parallel Execution
- Run independent tool calls in parallel (future enhancement)
- Parallel phase execution where possible

### 4. Model Selection
- Use faster models for less critical phases
- Use smaller models where appropriate
- Test quantized models (Ollama)

### 5. Caching
- Cache tool results
- Reuse computations
- Session-level caching

---

## Cost Comparison

Create cost comparison table:

| Provider | Model | Total Tokens | Input Cost | Output Cost | Total Cost | Time (min) | Quality Score |
|----------|-------|--------------|------------|-------------|------------|-----------|---------------|
| Ollama | llama3.2:3b | N/A | $0.00 | $0.00 | $0.00 | ___ | ___/10 |
| Anthropic | claude-3-5-sonnet | ___ | $___ | $___ | $___ | ___ | ___/10 |
| OpenAI | gpt-4-turbo | ___ | $___ | $___ | $___ | ___ | ___/10 |
| Gemini | gemini-1.5-pro | ___ | $___ | $___ | $___ | ___ | ___/10 |

**Quality Score:** Subjective assessment of report quality (1-10).

---

## Success Criteria

- [ ] At least 2 providers benchmarked (Ollama + 1 cloud)
- [ ] 3 runs per provider for statistical validity
- [ ] All metrics collected and documented
- [ ] Cost analysis complete
- [ ] Performance comparison table created
- [ ] If < 5 min target not met, optimization plan documented

---

## Deliverables

1. **Benchmark Logs:**
   - `.claude/current_task/PLAN/benchmarks/{provider}_run{N}.log`

2. **Benchmark Results:**
   - `.claude/current_task/PLAN/benchmarks/benchmark_results.csv`

3. **Performance Report:**
   - `/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/PERFORMANCE_BENCHMARKS.md`
   - Contains:
     - Methodology
     - Results summary
     - Cost comparison
     - Performance targets vs actual
     - Optimization recommendations (if needed)

4. **Cost Calculator:**
   - Simple script or spreadsheet for users to estimate costs
   - Based on benchmark data

---

## Performance Report Template

```markdown
# Performance Benchmarks - Multi-Agent Workflow

**Date:** 2025-10-27
**System:** [Hardware specs]
**Test Data:** 220 cycling activities, 6 months, 42 FIT files

## Executive Summary

- **Total Time:** [X] minutes average
- **Token Usage:** [X] tokens average
- **Cost per Workflow:** $[X] (Anthropic Claude)
- **Performance Rating:** [PASS/ACCEPTABLE/NEEDS OPTIMIZATION]

## Detailed Results

### Ollama (llama3.2:3b) - Local, Free

| Phase | Time (sec) | Tokens | Notes |
|-------|-----------|--------|-------|
| Data Preparation | X.X | XXX | |
| Performance Analysis | XX.X | XXXX | |
| Training Planning | XX.X | XXXX | |
| Report Generation | XX.X | XXXX | |
| **Total** | **XXX.X** | **XXXXX** | |

**Runs:** 3
**Average Time:** XXX.X seconds (X.X minutes)
**Cost:** $0.00

### Anthropic (claude-3-5-sonnet-20241022)

| Phase | Time (sec) | Tokens In | Tokens Out | Cost |
|-------|-----------|-----------|------------|------|
| Data Preparation | X.X | XXX | XXX | $X.XX |
| Performance Analysis | XX.X | XXXX | XXXX | $X.XX |
| Training Planning | XX.X | XXXX | XXXX | $X.XX |
| Report Generation | XX.X | XXXX | XXXX | $X.XX |
| **Total** | **XXX.X** | **XXXXX** | **XXXXX** | **$X.XX** |

**Runs:** 3
**Average Time:** XXX.X seconds (X.X minutes)
**Average Cost:** $X.XX per workflow

## Cost Projections

| Usage Frequency | Ollama | Anthropic | OpenAI | Gemini |
|----------------|--------|-----------|--------|--------|
| 1/week (4/month) | $0 | $X | $X | $X |
| 1/day (30/month) | $0 | $X | $X | $X |
| 10/day (300/month) | $0 | $X | $X | $X |

## Performance Analysis

### Targets vs Actual

- Total Time: [PASS/FAIL] - Target < 5 min, Actual X.X min
- Token Usage: [PASS/FAIL] - Target < 30k, Actual XXk
- Cost: [PASS/FAIL] - Target < $0.50, Actual $X.XX

### Bottlenecks Identified

1. [Phase name]: [Description of bottleneck]
2. ...

### Optimization Recommendations

1. [Recommendation 1]
2. [Recommendation 2]
...

## Provider Recommendations

**For Cost-Conscious Users:** Ollama (local, free)
**For Quality:** Anthropic Claude
**For Speed:** [Provider with best time]
**For Balance:** [Best cost/quality tradeoff]

## Conclusion

[Summary and final recommendations]
```

---

## Definition of Done

Task is complete when:
- [ ] Benchmarks run for at least 2 providers
- [ ] All metrics collected and analyzed
- [ ] Performance report written and saved
- [ ] Cost comparison documented
- [ ] Performance targets evaluated
- [ ] Optimization recommendations provided (if needed)
- [ ] Results validate < 5 min requirement (or explain why not)

---

**Status:** PENDING
**Depends On:** CARD_001 (Real-world testing)
**Next Task:** CARD_004 (Production Documentation)
