# Task Card 005: User Acceptance Testing

**Sub-Phase:** 4E - User Acceptance Testing
**Priority:** HIGH
**Duration:** 1 day
**Dependencies:** ALL previous cards (CARD_001-004)
**Status:** PENDING

---

## Objective

Conduct comprehensive user acceptance testing to validate the system works end-to-end from a real user's perspective and documentation is sufficient.

---

## Acceptance Criteria

- [ ] All 5 test scenarios executed successfully
- [ ] No blocking issues identified
- [ ] Documentation is sufficient for self-service
- [ ] Error messages are clear and actionable
- [ ] User experience is smooth
- [ ] Production go/no-go decision made

---

## Test Scenarios

### Scenario 1: New User - First Time Setup

**Actor:** New user with no prior experience with cycling-ai-analysis
**Goal:** Install system and generate first report
**Duration:** Expected 15-20 minutes

#### Test Steps

1. **Fresh Environment Setup**
   ```bash
   # Simulate fresh install on clean system
   cd /tmp
   rm -rf cycling-ai-analysis
   git clone https://github.com/yourusername/cycling-ai-analysis.git
   cd cycling-ai-analysis
   ```

2. **Follow README Installation**
   ```bash
   # Follow README.md quick start EXACTLY as written
   uv venv
   source .venv/bin/activate
   uv pip install -e ".[dev]"
   ```

3. **Configure Provider**
   ```bash
   # Follow docs/DEPLOYMENT_CHECKLIST.md for Anthropic setup
   export ANTHROPIC_API_KEY="sk-ant-..."

   # Verify
   cycling-ai providers list
   ```

4. **Prepare Test Data**
   ```bash
   # Use provided test data
   ls tests/data/real_activities.csv
   ls tests/data/test_profile.json
   ls tests/data/fit_files/
   ```

5. **Generate First Report**
   ```bash
   # Follow docs/USER_GUIDE_GENERATE.md quick start
   cycling-ai generate \
     --csv tests/data/real_activities.csv \
     --profile tests/data/test_profile.json \
     --fit-dir tests/data/fit_files \
     --output-dir /tmp/my_first_report \
     --provider anthropic
   ```

6. **View Reports**
   ```bash
   # Open reports in browser
   open /tmp/my_first_report/index.html
   ```

#### Success Criteria

- [ ] Installation completes without errors
- [ ] README instructions are clear and sufficient
- [ ] No confusing error messages encountered
- [ ] Reports generate successfully in < 5 minutes
- [ ] Reports are readable and professional
- [ ] User understands what the reports show
- [ ] No need to consult external resources

#### Issues to Watch For

- Confusing error messages
- Missing instructions
- Unclear terminology
- Unexpected failures
- Documentation gaps

---

### Scenario 2: Regular User - Monthly Analysis

**Actor:** Cyclist performing monthly performance review
**Goal:** Generate updated reports with new data
**Duration:** Expected 5-10 minutes

#### Test Steps

1. **Update CSV Data**
   ```bash
   # Simulate adding new activities
   cp tests/data/real_activities.csv /tmp/updated_activities.csv
   # (In real use, user would export from Strava)
   ```

2. **Update Athlete Profile** (if FTP changed)
   ```bash
   # Edit athlete profile JSON
   vim /tmp/updated_profile.json
   # Update FTP value
   ```

3. **Generate Updated Reports**
   ```bash
   cycling-ai generate \
     --csv /tmp/updated_activities.csv \
     --profile /tmp/updated_profile.json \
     --output-dir /tmp/reports_november \
     --provider anthropic
   ```

4. **Compare with Previous Month**
   ```bash
   # Open both reports side-by-side
   open /tmp/reports_october/index.html
   open /tmp/reports_november/index.html
   ```

#### Success Criteria

- [ ] Workflow completes in < 5 minutes
- [ ] Reports reflect new data accurately
- [ ] Easy to compare with previous month
- [ ] Insights are actionable and relevant
- [ ] No data loss or corruption

---

### Scenario 3: Advanced User - Custom Prompts

**Actor:** User wanting customized coaching perspective
**Goal:** Use custom prompts for specialized analysis
**Duration:** Expected 10-15 minutes

#### Test Steps

1. **Create Prompts Directory**
   ```bash
   mkdir -p ~/.cycling-ai/prompts
   ```

2. **Write Custom Performance Analysis Prompt**
   ```bash
   cat > ~/.cycling-ai/prompts/performance_analysis.txt << 'EOF'
   You are an expert cycling coach specializing in criterium racing.

   Analyze cycling performance data with focus on:
   - High-intensity sprint power (> 500W)
   - Repeatability of efforts
   - Recovery between hard efforts
   - Race-specific fitness markers

   Be direct and concise. Focus on what matters for crit racing.
   EOF
   ```

3. **Generate Report with Custom Prompts**
   ```bash
   cycling-ai generate \
     --csv tests/data/real_activities.csv \
     --profile tests/data/test_profile.json \
     --output-dir /tmp/reports_custom \
     --provider anthropic \
     --prompts-dir ~/.cycling-ai/prompts
   ```

4. **Compare Default vs Custom**
   ```bash
   # Generate with default prompts
   cycling-ai generate \
     --csv tests/data/real_activities.csv \
     --profile tests/data/test_profile.json \
     --output-dir /tmp/reports_default \
     --provider anthropic

   # Compare outputs
   diff /tmp/reports_default/coaching_insights.html \
        /tmp/reports_custom/coaching_insights.html
   ```

#### Success Criteria

- [ ] Custom prompts loaded successfully
- [ ] Agent behavior reflects customizations
- [ ] Reports show expected differences
- [ ] Documentation explains custom prompts clearly
- [ ] Easy to revert to defaults

---

### Scenario 4: Error Handling & Recovery

**Actor:** User encountering various error conditions
**Goal:** Understand errors and recover successfully
**Duration:** Expected 20-30 minutes

#### Test Cases

**4a. Invalid CSV File**
```bash
# Create invalid CSV
echo "not,a,valid,csv" > /tmp/bad.csv

# Try to generate
cycling-ai generate \
  --csv /tmp/bad.csv \
  --profile tests/data/test_profile.json \
  --output-dir /tmp/reports_test \
  --provider ollama

# Expected: Clear error message about CSV format
```

**4b. Missing API Key**
```bash
# Unset API key
unset ANTHROPIC_API_KEY

# Try to generate
cycling-ai generate \
  --csv tests/data/real_activities.csv \
  --profile tests/data/test_profile.json \
  --output-dir /tmp/reports_test \
  --provider anthropic

# Expected: Clear error about missing API key with setup instructions
```

**4c. Empty FIT Directory**
```bash
# Create empty directory
mkdir /tmp/empty_fit

# Try to generate
cycling-ai generate \
  --csv tests/data/real_activities.csv \
  --profile tests/data/test_profile.json \
  --fit-dir /tmp/empty_fit \
  --output-dir /tmp/reports_test \
  --provider ollama

# Expected: Warning about no FIT files, but workflow continues
```

**4d. Insufficient Disk Space** (simulation)
```bash
# Create small partition (if possible) or skip this test
# Expected: Clear error about disk space
```

**4e. Network Failure** (simulation)
```bash
# Disconnect network mid-execution (difficult to test)
# Or use firewall to block API
# Expected: Retry logic kicks in, then clear error message
```

#### Success Criteria

- [ ] All errors produce clear, actionable messages
- [ ] Troubleshooting guide helps resolve issues
- [ ] No crashes or data corruption
- [ ] Easy to recover from errors
- [ ] Error messages suggest next steps

---

### Scenario 5: Multi-Provider Comparison

**Actor:** User evaluating provider options
**Goal:** Compare quality and cost across providers
**Duration:** Expected 30-45 minutes

#### Test Steps

1. **Generate with Ollama (Local, Free)**
   ```bash
   time cycling-ai generate \
     --csv tests/data/real_activities.csv \
     --profile tests/data/test_profile.json \
     --output-dir /tmp/reports_ollama \
     --provider ollama \
     --model llama3.2:3b

   # Record time and cost ($0)
   ```

2. **Generate with Anthropic (Cloud, Paid)**
   ```bash
   time cycling-ai generate \
     --csv tests/data/real_activities.csv \
     --profile tests/data/test_profile.json \
     --output-dir /tmp/reports_anthropic \
     --provider anthropic \
     --model claude-3-5-sonnet-20241022

   # Record time and estimate cost from docs/PERFORMANCE_BENCHMARKS.md
   ```

3. **Compare Reports**

   **Quality Assessment:**
   - Open both `coaching_insights.html` files
   - Compare depth of insights
   - Compare actionability of recommendations
   - Compare professional polish

   **Performance Assessment:**
   - Compare execution times
   - Compare report generation quality

   **Cost Assessment:**
   - Ollama: $0 (free)
   - Anthropic: ~$0.25 per workflow

4. **Make Informed Decision**
   ```bash
   # Document findings in UAT report
   ```

#### Success Criteria

- [ ] User can run same workflow with different providers
- [ ] Quality differences are noticeable and documented
- [ ] Cost information is available and clear
- [ ] User can make informed provider choice
- [ ] Documentation guides provider selection

---

## UAT Execution Process

### Before Each Scenario

```bash
# 1. Clean environment (except Scenario 1)
rm -rf /tmp/reports_* /tmp/*.csv /tmp/*.json

# 2. Reset to known state
cd /Users/eduardo/Documents/projects/cycling-ai-analysis
git status  # Should be clean

# 3. Prepare test data
ls tests/data/  # Verify test data exists

# 4. Note current state
date
df -h  # Disk space
free -h  # Memory (Linux) or vm_stat (macOS)
```

### During Each Scenario

1. **Follow steps EXACTLY as written**
2. **Note any confusion or issues**
3. **Time each major step**
4. **Capture screenshots** (if helpful)
5. **Document errors** (verbatim)
6. **Check against success criteria**

### After Each Scenario

```bash
# Record results
cat >> .claude/current_task/PLAN/UAT_REPORT.md << EOF

## Scenario X: [Name]

**Status:** [PASS/FAIL/PARTIAL]
**Duration:** [X] minutes
**Issues Found:** [Number]

### Execution Notes
[Observations during execution]

### Issues
1. [Issue description]
   - **Severity:** [BLOCKER/MAJOR/MINOR/COSMETIC]
   - **Expected:** [What should happen]
   - **Actual:** [What actually happened]
   - **Fix:** [Suggested fix]

### Success Criteria
- [x] Criterion 1 - Passed
- [ ] Criterion 2 - Failed (see Issue 1)
...

EOF
```

---

## Issue Severity Definitions

**BLOCKER:**
- System doesn't work
- Data loss
- Security vulnerability
- No workaround exists

**MAJOR:**
- Feature doesn't work as expected
- Poor user experience
- Workaround exists but difficult
- Affects core functionality

**MINOR:**
- Cosmetic issue
- Documentation gap
- Unclear error message
- Easy workaround exists

**COSMETIC:**
- Typo
- Formatting issue
- Nice-to-have feature
- Doesn't affect functionality

---

## Go/No-Go Decision Criteria

### GO (Deploy to Production)

**Required:**
- [ ] All 5 scenarios completed
- [ ] No BLOCKER issues
- [ ] ≤ 2 MAJOR issues (with fix plan)
- [ ] Documentation is sufficient
- [ ] Performance is acceptable
- [ ] Error handling is robust

### NO-GO (More work needed)

**Any of:**
- [ ] Any BLOCKER issues found
- [ ] > 2 MAJOR issues without fixes
- [ ] Documentation has critical gaps
- [ ] Performance unacceptable (> 7 min)
- [ ] Poor user experience

---

## Success Criteria

- [ ] All 5 scenarios executed
- [ ] UAT report written
- [ ] All issues documented
- [ ] Severity assigned to each issue
- [ ] Go/no-go decision made
- [ ] If no-go, fix plan created

---

## Deliverables

1. **UAT Report:**
   - `.claude/current_task/PLAN/UAT_REPORT.md`
   - Contains results for all 5 scenarios
   - Lists all issues found
   - Go/no-go recommendation

2. **Issues List:**
   - `.claude/current_task/PLAN/UAT_ISSUES.md`
   - Detailed list of all issues
   - Severity and priority
   - Suggested fixes

3. **User Feedback:**
   - Qualitative observations
   - User experience assessment
   - Documentation feedback

4. **Production Readiness Assessment:**
   - Go/no-go decision with justification
   - Remaining work (if any)
   - Deployment timeline

---

## Example UAT Report Structure

```markdown
# User Acceptance Testing Report

**Date:** 2025-10-27
**Tester:** [Name/Agent]
**System:** Cycling AI Analysis - Multi-Agent Orchestrator
**Version:** Phase 4

## Executive Summary

**Overall Status:** [PASS/FAIL]
**Scenarios Executed:** 5/5
**Pass Rate:** X/5 (X%)
**Blocking Issues:** X
**Recommendation:** [GO/NO-GO]

## Scenario Results

### Scenario 1: New User - First Time Setup
**Status:** PASS ✅
**Duration:** 18 minutes
**Issues:** 1 MINOR

[Details...]

### Scenario 2: Regular User - Monthly Analysis
**Status:** PASS ✅
**Duration:** 7 minutes
**Issues:** 0

[Details...]

### Scenario 3: Advanced User - Custom Prompts
**Status:** PASS ✅
**Duration:** 12 minutes
**Issues:** 1 MINOR

[Details...]

### Scenario 4: Error Handling
**Status:** PARTIAL ⚠️
**Duration:** 28 minutes
**Issues:** 2 MAJOR

[Details...]

### Scenario 5: Multi-Provider Comparison
**Status:** PASS ✅
**Duration:** 42 minutes
**Issues:** 0

[Details...]

## Issues Summary

| ID | Severity | Scenario | Description | Status |
|----|----------|----------|-------------|--------|
| 1 | MAJOR | 4 | Missing API key error unclear | OPEN |
| 2 | MAJOR | 4 | No retry on network failure | OPEN |
| 3 | MINOR | 1 | Typo in README | OPEN |
| 4 | MINOR | 3 | Custom prompts docs lacking examples | OPEN |

## Detailed Issues

### Issue 1: Missing API Key Error Unclear
**Severity:** MAJOR
**Scenario:** 4
**Description:** When ANTHROPIC_API_KEY is missing, error message says "Provider initialization failed" which doesn't help user understand what to do.
**Expected:** "Anthropic API key not found. Please set ANTHROPIC_API_KEY environment variable. See docs/DEPLOYMENT_CHECKLIST.md for setup instructions."
**Actual:** "Error: Provider initialization failed"
**Fix:** Update error message in `src/cycling_ai/cli/commands/generate.py` to be more specific.
**Priority:** HIGH

[... more issues ...]

## Recommendations

### GO for Production ✅
**Justification:**
- All core functionality works
- 2 MAJOR issues have known fixes that can be applied quickly
- MINOR issues are cosmetic and don't block usage
- Performance is excellent (< 5 min)
- Documentation is comprehensive

### Conditions:
1. Fix Issue 1 and 2 before public release
2. Update documentation based on feedback
3. Monitor first 10 real-world users for additional issues

### Timeline:
- Fix issues: 2 hours
- Re-test: 1 hour
- Deploy: Immediate after fixes

## User Feedback

**Positive:**
- System is easy to use
- Reports are professional and insightful
- Documentation is thorough
- Performance is fast

**Needs Improvement:**
- Error messages could be more helpful
- Would like progress bar during long phases
- Custom prompts documentation could be expanded

## Conclusion

The system is production-ready with minor fixes required. Once Issue 1 and 2 are addressed, deployment is recommended.

**Next Steps:**
1. Fix 2 MAJOR issues
2. Quick re-test
3. Deploy to production
4. Monitor usage
5. Address MINOR issues in next sprint

---

**Prepared By:** task-executor-tdd
**Date:** 2025-10-27
**Recommendation:** GO (with fixes)
```

---

## Definition of Done

Task is complete when:
- [ ] All 5 scenarios executed and documented
- [ ] UAT report written
- [ ] All issues cataloged with severity
- [ ] Go/no-go decision made with justification
- [ ] If no-go, detailed fix plan created
- [ ] User feedback documented
- [ ] Production readiness assessment complete

---

**Status:** PENDING
**Depends On:** CARD_001, CARD_002, CARD_003, CARD_004
**Next Task:** Phase 4 Completion (write PHASE4_COMPLETION.md)

---

## Note

This is the final validation step before production deployment. Be thorough but pragmatic. Not every minor issue needs to block deployment if there's a workaround or it's cosmetic.
