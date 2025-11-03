# Quick Start Guide - Week Validation Rework

**Time to Complete:** 2-3 hours
**Risk Level:** LOW
**Current Status:** Ready to execute

---

## TL;DR

Fix 24 linting errors → Enable 35 tests → Extract 14 constants → Validate → Merge

---

## Step-by-Step Execution

### Step 1: Fix Linting (1 hour)

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# See current errors
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py

# Open file
code src/cycling_ai/tools/wrappers/add_week_tool.py

# Follow CARD_1_LINTING_FIXES.md instructions

# Verify
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
# Expected: All checks passed!

# Commit
git add src/cycling_ai/tools/wrappers/add_week_tool.py
git commit -m "fix: Resolve 24 linting errors in add_week_tool"
```

### Step 2: Enable Tests (1-2 hours)

```bash
# Open test file
code tests/tools/wrappers/test_add_week_tool_validation.py

# Follow CARD_2_TEST_IMPLEMENTATION.md instructions
# Remove @pytest.mark.skip decorators
# Uncomment test bodies

# Test each class as you go
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestCalculateWeekMetrics -v
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestValidateTimeAndTSS -v
# ... etc

# Verify all pass
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v
# Expected: 36 passed

# Commit
git add tests/tools/wrappers/test_add_week_tool_validation.py
git commit -m "test: Enable all 35 validation tests for add_week_tool"
```

### Step 3: Extract Constants (30 min)

```bash
# Open file
code src/cycling_ai/tools/wrappers/add_week_tool.py

# Follow CARD_3_CONSTANT_EXTRACTION.md instructions
# Add constants after line 23
# Replace magic numbers with constant names

# Verify tests still pass
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v
# Expected: 36 passed

# Commit
git add src/cycling_ai/tools/wrappers/add_week_tool.py
git commit -m "refactor: Extract magic numbers to named constants in add_week_tool"
```

### Step 4: Final Validation (30 min)

```bash
# Run all checks
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v

# Generate coverage
pytest tests/tools/wrappers/test_add_week_tool_validation.py \
  --cov=src/cycling_ai/tools/wrappers/add_week_tool \
  --cov-report=html -v

# Check for regressions
pytest tests/tools/ -v

# Review changes
git diff origin/main src/cycling_ai/tools/wrappers/add_week_tool.py
git diff origin/main tests/tools/wrappers/test_add_week_tool_validation.py

# All good? Push!
git push origin feature/fit-workout-parser
```

---

## Quick Checks

**After Card 1 (Linting):**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
# Expected: All checks passed!
```

**After Card 2 (Tests):**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v | grep passed
# Expected: 36 passed
```

**After Card 3 (Constants):**
```bash
grep -E "^[A-Z_]+.*=.*[0-9]" src/cycling_ai/tools/wrappers/add_week_tool.py | wc -l
# Expected: ~14 (constant definitions)
```

**Final Check:**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py && \
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict && \
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v && \
echo "✓ ALL CHECKS PASSED - READY TO MERGE"
```

---

## File Paths

**Implementation:**
```
/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/tools/wrappers/add_week_tool.py
```

**Tests:**
```
/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/tools/wrappers/test_add_week_tool_validation.py
```

**Documentation:**
```
/Users/eduardo/Documents/projects/cycling-ai-analysis/.claude/current_task/REWORK/
├── CARD_1_LINTING_FIXES.md
├── CARD_2_TEST_IMPLEMENTATION.md
├── CARD_3_CONSTANT_EXTRACTION.md
└── CARD_4_FINAL_VALIDATION.md
```

---

## Common Issues

**Issue:** Float comparison fails
**Fix:** Use `pytest.approx(value, abs=0.01)`

**Issue:** String matching fails
**Fix:** Use `"substring" in string.lower()`

**Issue:** Linting error persists
**Fix:** Run `ruff format` to auto-fix

**Issue:** Test import error
**Fix:** Check function name, ensure it's defined

---

## Success Checklist

- [ ] `ruff check` → 0 errors
- [ ] `mypy --strict` → Success
- [ ] 36/36 tests passing
- [ ] 0 tests skipped
- [ ] Coverage > 85%
- [ ] Git diff clean
- [ ] Ready for merge

---

## When Complete

1. Push changes to feature branch
2. Update PR description with:
   - "All blocking issues resolved"
   - "36/36 tests passing"
   - "Zero linting errors"
3. Request final review
4. Merge after approval
5. Celebrate! 🎉

---

## Help

**Stuck?** Reference:
- Main plan: `REWORK_PLAN.md`
- Card details: `REWORK/CARD_*.md`
- Project guide: `CLAUDE.md`

**Need to rollback?**
```bash
git reset --hard HEAD~1  # Undo last commit
```

---

**Ready? Start with CARD_1_LINTING_FIXES.md**
