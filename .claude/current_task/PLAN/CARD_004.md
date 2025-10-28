# Task Card 004: Production Documentation

**Sub-Phase:** 4D - Production Documentation
**Priority:** HIGH
**Duration:** 1-2 days
**Dependencies:** CARD_001, CARD_003 (Real-world testing and benchmarking complete)
**Status:** PENDING

---

## Objective

Create comprehensive production documentation to enable successful deployment and user onboarding.

---

## Acceptance Criteria

- [ ] Deployment checklist created
- [ ] User guide for generate command complete
- [ ] Troubleshooting guide created
- [ ] Performance benchmarks documented (from CARD_003)
- [ ] README.md updated with Phase 4 status
- [ ] All documentation reviewed for clarity and completeness

---

## Documents to Create

### 1. Deployment Checklist

**File:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/DEPLOYMENT_CHECKLIST.md`

**Contents:**

```markdown
# Deployment Checklist - Cycling AI Analysis

## Pre-Deployment

### System Requirements
- [ ] Python 3.11 or higher installed
- [ ] 2 GB RAM minimum (4 GB recommended)
- [ ] 500 MB disk space for installation
- [ ] 1 GB disk space for data and reports

### Software Dependencies
- [ ] `uv` or `pip` package manager
- [ ] Git (for cloning repository)
- [ ] Modern web browser (for viewing reports)

### LLM Provider Setup

**Choose at least one:**

**Ollama (Local, Free):**
- [ ] Ollama installed: `brew install ollama` (macOS) or [ollama.ai](https://ollama.ai)
- [ ] Model pulled: `ollama pull llama3.2:3b`
- [ ] Ollama running: `ollama serve`

**Anthropic (Cloud, Recommended):**
- [ ] API key obtained from [console.anthropic.com](https://console.anthropic.com)
- [ ] Environment variable set: `export ANTHROPIC_API_KEY="sk-ant-..."`
- [ ] Verify: `echo $ANTHROPIC_API_KEY`

**OpenAI (Cloud, Optional):**
- [ ] API key from [platform.openai.com](https://platform.openai.com)
- [ ] Environment variable set: `export OPENAI_API_KEY="sk-..."`

**Google Gemini (Cloud, Optional):**
- [ ] API key from [makersuite.google.com](https://makersuite.google.com)
- [ ] Environment variable set: `export GOOGLE_API_KEY="..."`

## Installation

### Clone Repository
```bash
git clone https://github.com/yourusername/cycling-ai-analysis.git
cd cycling-ai-analysis
```

### Install Dependencies
```bash
# Using uv (recommended)
uv venv
source .venv/bin/activate  # On Windows: .venv\\Scripts\\activate
uv pip install -e ".[dev]"

# Or using pip
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

### Verify Installation
```bash
# Check CLI is available
cycling-ai --version

# List providers
cycling-ai providers list

# Should show installed providers
```

## Configuration

### Environment Variables
```bash
# Required (choose one)
export ANTHROPIC_API_KEY="sk-ant-..."  # Anthropic
export OPENAI_API_KEY="sk-..."        # OpenAI
export GOOGLE_API_KEY="..."            # Gemini

# Optional
export CYCLING_AI_CONFIG="~/.cycling-ai/config.yaml"
```

### Config File (Optional)
```bash
mkdir -p ~/.cycling-ai
cat > ~/.cycling-ai/config.yaml << EOF
default_provider: anthropic
default_model: claude-3-5-sonnet-20241022
max_iterations: 5
EOF
```

## Verification Tests

### Provider Health Checks
```bash
# Test Ollama (if used)
ollama list  # Should show llama3.2:3b
curl http://localhost:11434/api/tags  # Should return JSON

# Test API key (Anthropic)
curl https://api.anthropic.com/v1/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
# Should not return authentication error
```

### Run Test Suite
```bash
# Quick smoke test
.venv/bin/pytest tests/orchestration/test_multi_agent.py -v

# Full test suite (optional)
.venv/bin/pytest tests/ -v
```

### Generate Test Report
```bash
# Use sample data
cycling-ai generate \\
  --csv tests/data/real_activities.csv \\
  --profile tests/data/test_profile.json \\
  --output-dir /tmp/test_reports \\
  --provider ollama

# Verify reports created
ls -lh /tmp/test_reports/
# Should show: index.html, coaching_insights.html, performance_dashboard.html

# Open in browser
open /tmp/test_reports/index.html  # macOS
```

## Security Considerations

### API Key Protection
- [ ] API keys stored in environment variables (not code)
- [ ] `.env` files in `.gitignore` (if using)
- [ ] No API keys in logs or error messages
- [ ] Restricted file permissions: `chmod 600 ~/.cycling-ai/config.yaml`

### Data Privacy
- [ ] Cycling data stored locally
- [ ] No data uploaded to cloud (except via LLM API)
- [ ] Session data encrypted (if sensitive)
- [ ] Reports contain no API keys or secrets

### Network Security
- [ ] HTTPS for all API calls (enforced by libraries)
- [ ] Ollama local-only (no external connections)
- [ ] Firewall allows Ollama port 11434 (if using)

## Monitoring Setup

### Logging
```bash
# Enable debug logging
export CYCLING_AI_LOG_LEVEL=DEBUG

# Log file location
mkdir -p ~/.cycling-ai/logs
export CYCLING_AI_LOG_FILE=~/.cycling-ai/logs/cycling-ai.log
```

### Error Tracking
- [ ] Monitor log files for errors
- [ ] Set up alerts for failures (optional)
- [ ] Track token usage (for cost management)

## Post-Deployment

### Initial User Setup
- [ ] Prepare sample athlete profile JSON
- [ ] Export Strava activities CSV
- [ ] Run first `cycling-ai generate` command
- [ ] Verify reports look correct

### Documentation Access
- [ ] User guide available: `docs/USER_GUIDE_GENERATE.md`
- [ ] Troubleshooting guide: `docs/TROUBLESHOOTING.md`
- [ ] README: `README.md`

### Performance Validation
- [ ] First workflow completes in < 5 minutes
- [ ] Reports are readable and professional
- [ ] No errors in output

## Rollback Procedure

If deployment fails:
```bash
# 1. Deactivate virtual environment
deactivate

# 2. Remove installation
rm -rf .venv venv

# 3. Check for issues in installation log
cat ~/.cycling-ai/logs/install.log

# 4. Try alternative installation method (pip vs uv)
```

## Support Resources

- **GitHub Issues:** [github.com/yourusername/cycling-ai-analysis/issues](https://github.com)
- **Documentation:** [docs/](https://github.com)
- **Troubleshooting:** `docs/TROUBLESHOOTING.md`

---

**Deployment Complete!** ✅
```

---

### 2. User Guide for Generate Command

**File:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/USER_GUIDE_GENERATE.md`

**Contents:** See detailed template in next section...

---

### 3. Troubleshooting Guide

**File:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/TROUBLESHOOTING.md`

**Contents:** See detailed template in next section...

---

### 4. Performance Benchmarks

**File:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/PERFORMANCE_BENCHMARKS.md`

**Note:** This is created in CARD_003. In this task, just verify it exists and is complete.

---

## Documentation Quality Checklist

For each document:
- [ ] Clear section headers with table of contents
- [ ] Code examples are tested and work
- [ ] File paths are absolute or clearly explained
- [ ] Commands have expected output documented
- [ ] Screenshots or examples where helpful
- [ ] Links are valid (no 404s)
- [ ] Formatting is consistent (Markdown)
- [ ] No TODO or FIXME placeholders
- [ ] Spell-checked and grammar-checked
- [ ] Reviewed by at least one person (or agent!)

---

## README.md Updates

**File:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/README.md`

**Changes:**

1. Update status badge:
```markdown
**Status:** ✅ **Production Ready** - Phase 4 Complete
```

2. Add Phase 4 completion link:
```markdown
## 📚 Documentation

- [Phase 1 Completion](PHASE1_COMPLETION.md)
- [Phase 2 Architecture](PHASE2_ARCHITECTURE.md)
- [Phase 3 Implementation](plans/PHASE3_COMPLETION.md)
- [Phase 4 Production Readiness](plans/PHASE4_COMPLETION.md) ✨ NEW
- [Architecture Plan](plans/MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md)
```

3. Update test count:
```markdown
**Total Tests:** 253 passing ✅
```

4. Add performance metrics:
```markdown
## 📈 Performance

- **Workflow Time:** < 5 minutes
- **Token Usage:** ~24,000 tokens
- **Cost:** $0 (Ollama) to $0.30 (Claude)
```

5. Add generate command to quick start:
```markdown
# Generate comprehensive reports (NEW!)
cycling-ai generate \\
  --csv activities.csv \\
  --profile athlete.json \\
  --provider anthropic
```

---

## Success Criteria

- [ ] All 4 documentation files created
- [ ] Documentation quality checklist passed for each file
- [ ] README.md updated
- [ ] All code examples tested and verified
- [ ] No broken links
- [ ] Documentation reviewed

---

## Deliverables

1. **Deployment Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
2. **User Guide:** `docs/USER_GUIDE_GENERATE.md`
3. **Troubleshooting Guide:** `docs/TROUBLESHOOTING.md`
4. **Performance Benchmarks:** `docs/PERFORMANCE_BENCHMARKS.md` (verify exists)
5. **Updated README:** `README.md`

---

## Definition of Done

Task is complete when:
- [ ] All 4 documentation files exist and are complete
- [ ] README.md updated with Phase 4 information
- [ ] All documentation reviewed for quality
- [ ] All code examples tested
- [ ] No TODOs or placeholders remain
- [ ] Files committed to git

---

**Status:** PENDING
**Depends On:** CARD_001, CARD_003
**Next Task:** CARD_005 (User Acceptance Testing)

---

## Note on User Guide and Troubleshooting Guide

These files are extensive. The full content templates are provided in the main PLAN.md document. During implementation:

1. Create the files with full structure
2. Fill in actual data from benchmarks (CARD_003)
3. Test all command examples
4. Add real screenshots if helpful
5. Review and refine based on UAT feedback (CARD_005)
