# Implementation Card 7: Phase-Specific Retrieval Methods

**Priority:** High
**Estimated Time:** 4-5 hours
**Card Status:** Ready for Implementation
**Dependencies:** Card 6 (RAGManager initialization)

---

## Objective

Implement phase-specific `_get_retrieval_query()` and `_get_retrieval_collection()` methods in all 4 workflow phases. Each phase needs customized retrieval queries that include relevant context from the workflow state.

---

## Background

Currently all phases use generic default implementations from BasePhase:
```python
def _get_retrieval_query(self, context: PhaseContext) -> str:
    return f"{self.phase_name} cycling analysis"  # Too generic!

def _get_retrieval_collection(self) -> str:
    return "domain_knowledge"  # Always same collection
```

These need to be overridden in each phase to retrieve relevant, context-specific knowledge.

---

## Files to Modify

### File 1: DataPreparationPhase

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/data_preparation.py`

**Add after line ~350 (end of class):**
```python
def _get_retrieval_query(self, context: PhaseContext) -> str:
    """
    Build retrieval query for data validation best practices.

    Phase 1 validates data files, so retrieve guidance on:
    - Data validation best practices
    - FIT file processing
    - CSV data quality checks

    Args:
        context: Phase execution context

    Returns:
        Query string for domain knowledge retrieval
    """
    return "data validation best practices cycling FIT file CSV processing quality checks"

def _get_retrieval_collection(self) -> str:
    """
    Get collection name for data preparation retrieval.

    Returns:
        "domain_knowledge" - Use cycling science knowledge
    """
    return "domain_knowledge"
```

**Rationale:** Data preparation phase validates input files, so we retrieve best practices for validation and file processing.

---

### File 2: PerformanceAnalysisPhase

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/performance_analysis.py`

**Add after line ~565 (end of class):**
```python
def _get_retrieval_query(self, context: PhaseContext) -> str:
    """
    Build retrieval query for performance analysis context.

    Phase 2 analyzes performance, so retrieve guidance on:
    - Training zones and power-based analysis
    - FTP testing and comparison methodologies
    - Period-specific analysis (e.g., 6 months)
    - Cross-training impact (if applicable)

    Args:
        context: Phase execution context

    Returns:
        Query string for domain knowledge retrieval with context
    """
    period_months = context.config.period_months

    # Check if cross-training analysis will be done
    cache_info = context.previous_phase_data.get("cache_info", {})
    cross_training = cache_info.get("has_cross_training_activities", False)

    # Build context-aware query
    query = (
        f"performance analysis training zones FTP power-based metrics "
        f"{period_months} months comparison period testing protocols"
    )

    if cross_training:
        query += " cross-training impact complementary training"

    return query

def _get_retrieval_collection(self) -> str:
    """
    Get collection name for performance analysis retrieval.

    Returns:
        "domain_knowledge" - Use cycling science knowledge
    """
    return "domain_knowledge"
```

**Rationale:** Performance analysis phase needs training zone science, testing protocols, and (conditionally) cross-training guidance. Query includes period_months for better context.

---

### File 3: TrainingPlanningPhase

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/training_planning.py`

**Add after line ~970 (end of class):**
```python
def _get_retrieval_query(self, context: PhaseContext) -> str:
    """
    Build retrieval query for training plan templates.

    Phase 3 creates training plans, so retrieve:
    - Structured training plan templates
    - Periodization strategies for the specified duration
    - Plans appropriate for athlete's FTP level

    Args:
        context: Phase execution context

    Returns:
        Query string for training template retrieval with FTP and duration
    """
    weeks = context.config.training_plan_weeks

    # Extract athlete's current FTP from performance analysis
    # Performance data might be JSON string or dict
    perf_data = context.previous_phase_data.get("performance_analysis", {})
    if isinstance(perf_data, str):
        import json
        try:
            perf_data = json.loads(perf_data)
        except json.JSONDecodeError:
            perf_data = {}

    # Get current FTP, default to 250W if not available
    ftp = perf_data.get("current_ftp", 250)

    # Build query with athlete-specific context
    query = (
        f"training plan periodization {weeks} weeks duration "
        f"FTP {ftp} watts base building structured plan template"
    )

    return query

def _get_retrieval_collection(self) -> str:
    """
    Get collection name for training planning retrieval.

    This is the ONLY phase that uses training_templates collection.
    All other phases use domain_knowledge.

    Returns:
        "training_templates" - Use structured training plan templates
    """
    return "training_templates"
```

**Rationale:** Training planning phase needs actual plan templates, not just domain knowledge. Retrieves plans matching athlete's FTP and desired duration. This is the ONLY phase using training_templates collection.

---

### File 4: ReportPreparationPhase

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/report_preparation.py`

**Add after line ~317 (end of class):**
```python
def _get_retrieval_query(self, context: PhaseContext) -> str:
    """
    Build retrieval query for report generation guidance.

    Phase 4 generates reports, so retrieve guidance on:
    - Report generation and data presentation
    - Coaching insights and recommendations
    - Performance summary best practices

    Args:
        context: Phase execution context

    Returns:
        Query string for domain knowledge retrieval
    """
    return (
        "report generation coaching insights performance summary "
        "recommendations data presentation athlete communication"
    )

def _get_retrieval_collection(self) -> str:
    """
    Get collection name for report preparation retrieval.

    Returns:
        "domain_knowledge" - Use cycling science knowledge
    """
    return "domain_knowledge"
```

**Rationale:** Report preparation phase needs guidance on presenting insights and making recommendations to athletes.

---

## Testing

### Unit Tests

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/orchestration/test_phase_retrieval.py` (NEW FILE)

**Test Structure:**
```python
"""
Tests for phase-specific RAG retrieval methods.
"""
from pathlib import Path
import pytest
from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig, PhaseContext
from cycling_ai.orchestration.phases import (
    DataPreparationPhase,
    PerformanceAnalysisPhase,
    TrainingPlanningPhase,
    ReportPreparationPhase,
)


class TestDataPreparationRetrieval:
    """Test DataPreparationPhase retrieval methods."""

    def test_data_prep_retrieval_query(self, tmp_path):
        """Test data preparation retrieval query."""
        phase = DataPreparationPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        context = self._create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should mention data validation and file types
        assert "data validation" in query.lower()
        assert "fit" in query.lower() or "csv" in query.lower()

    def test_data_prep_retrieval_collection(self):
        """Test data preparation uses domain_knowledge collection."""
        phase = DataPreparationPhase()

        collection = phase._get_retrieval_collection()

        assert collection == "domain_knowledge"


class TestPerformanceAnalysisRetrieval:
    """Test PerformanceAnalysisPhase retrieval methods."""

    def test_performance_retrieval_query_basic(self, tmp_path):
        """Test performance analysis retrieval query."""
        phase = PerformanceAnalysisPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            period_months=6,
        )

        context = self._create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should mention performance analysis and period
        assert "performance" in query.lower()
        assert "zones" in query.lower() or "ftp" in query.lower()
        assert "6" in query  # period_months

    def test_performance_retrieval_query_with_cross_training(self, tmp_path):
        """Test performance query includes cross-training when applicable."""
        phase = PerformanceAnalysisPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
            period_months=6,
        )

        # Simulate cache info with cross-training
        previous_data = {
            "cache_info": {
                "has_cross_training_activities": True
            }
        }

        context = self._create_mock_context(config, previous_data)

        query = phase._get_retrieval_query(context)

        # Should mention cross-training
        assert "cross-training" in query.lower() or "cross training" in query.lower()

    def test_performance_retrieval_collection(self):
        """Test performance analysis uses domain_knowledge collection."""
        phase = PerformanceAnalysisPhase()

        collection = phase._get_retrieval_collection()

        assert collection == "domain_knowledge"


class TestTrainingPlanningRetrieval:
    """Test TrainingPlanningPhase retrieval methods."""

    def test_training_retrieval_query_with_ftp(self, tmp_path):
        """Test training planning query includes FTP from performance data."""
        phase = TrainingPlanningPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        # Simulate performance analysis result with FTP
        previous_data = {
            "performance_analysis": {
                "current_ftp": 265
            }
        }

        context = self._create_mock_context(config, previous_data)

        query = phase._get_retrieval_query(context)

        # Should include weeks and FTP
        assert "12" in query  # weeks
        assert "265" in query  # FTP

    def test_training_retrieval_query_default_ftp(self, tmp_path):
        """Test training planning uses default FTP if not available."""
        phase = TrainingPlanningPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        # No performance data
        context = self._create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should use default FTP (250W)
        assert "250" in query

    def test_training_retrieval_collection_is_templates(self):
        """Test training planning uses training_templates collection."""
        phase = TrainingPlanningPhase()

        collection = phase._get_retrieval_collection()

        # CRITICAL: Only phase that uses templates!
        assert collection == "training_templates"


class TestReportPreparationRetrieval:
    """Test ReportPreparationPhase retrieval methods."""

    def test_report_prep_retrieval_query(self, tmp_path):
        """Test report preparation retrieval query."""
        phase = ReportPreparationPhase()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "test.csv",
            athlete_profile_path=tmp_path / "profile.json",
            training_plan_weeks=12,
        )

        context = self._create_mock_context(config, {})

        query = phase._get_retrieval_query(context)

        # Should mention report generation
        assert "report" in query.lower()
        assert "insights" in query.lower() or "recommendations" in query.lower()

    def test_report_prep_retrieval_collection(self):
        """Test report preparation uses domain_knowledge collection."""
        phase = ReportPreparationPhase()

        collection = phase._get_retrieval_collection()

        assert collection == "domain_knowledge"


# Helper method for all test classes
def _create_mock_context(config, previous_data):
    """Create mock PhaseContext for testing."""
    from unittest.mock import Mock

    return PhaseContext(
        config=config,
        previous_phase_data=previous_data,
        session_manager=Mock(),
        provider=Mock(),
        prompts_manager=Mock(),
        rag_manager=None,
    )


# Add helper to all test classes
TestDataPreparationRetrieval._create_mock_context = _create_mock_context
TestPerformanceAnalysisRetrieval._create_mock_context = _create_mock_context
TestTrainingPlanningRetrieval._create_mock_context = _create_mock_context
TestReportPreparationRetrieval._create_mock_context = _create_mock_context
```

**Run Tests:**
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement
pytest tests/orchestration/test_phase_retrieval.py -v
```

**Expected:** 8 tests pass

---

## Manual Validation

### Validation Script
**File:** `/tmp/validate_phase_retrieval.py`
```python
#!/usr/bin/env python3
"""
Validate phase-specific retrieval queries.
"""
from pathlib import Path
from cycling_ai.orchestration.base import WorkflowConfig, PhaseContext
from cycling_ai.orchestration.phases import (
    DataPreparationPhase,
    PerformanceAnalysisPhase,
    TrainingPlanningPhase,
    ReportPreparationPhase,
)
from unittest.mock import Mock

# Create mock context
def create_context(period_months=6, training_weeks=12, performance_data=None):
    config = WorkflowConfig(
        csv_file_path=Path("/tmp/test.csv"),
        athlete_profile_path=Path("/tmp/profile.json"),
        training_plan_weeks=training_weeks,
        period_months=period_months,
    )

    previous_data = {}
    if performance_data:
        previous_data["performance_analysis"] = performance_data

    return PhaseContext(
        config=config,
        previous_phase_data=previous_data,
        session_manager=Mock(),
        provider=Mock(),
        prompts_manager=Mock(),
        rag_manager=None,
    )


print("=" * 60)
print("Phase-Specific Retrieval Validation")
print("=" * 60)

# Test 1: Data Preparation
print("\n1. Data Preparation Phase")
phase1 = DataPreparationPhase()
context1 = create_context()
query1 = phase1._get_retrieval_query(context1)
collection1 = phase1._get_retrieval_collection()
print(f"   Query: {query1}")
print(f"   Collection: {collection1}")
assert "validation" in query1.lower(), "Missing 'validation' in query"
assert collection1 == "domain_knowledge", f"Wrong collection: {collection1}"
print("   ✓ Pass")

# Test 2: Performance Analysis
print("\n2. Performance Analysis Phase")
phase2 = PerformanceAnalysisPhase()
context2 = create_context(period_months=6)
query2 = phase2._get_retrieval_query(context2)
collection2 = phase2._get_retrieval_collection()
print(f"   Query: {query2}")
print(f"   Collection: {collection2}")
assert "6" in query2, "Missing period_months in query"
assert "performance" in query2.lower(), "Missing 'performance' in query"
assert collection2 == "domain_knowledge", f"Wrong collection: {collection2}"
print("   ✓ Pass")

# Test 3: Training Planning
print("\n3. Training Planning Phase")
phase3 = TrainingPlanningPhase()
context3 = create_context(
    training_weeks=12,
    performance_data={"current_ftp": 265}
)
query3 = phase3._get_retrieval_query(context3)
collection3 = phase3._get_retrieval_collection()
print(f"   Query: {query3}")
print(f"   Collection: {collection3}")
assert "12" in query3, "Missing weeks in query"
assert "265" in query3, "Missing FTP in query"
assert collection3 == "training_templates", f"Wrong collection: {collection3}"
print("   ✓ Pass")

# Test 4: Report Preparation
print("\n4. Report Preparation Phase")
phase4 = ReportPreparationPhase()
context4 = create_context()
query4 = phase4._get_retrieval_query(context4)
collection4 = phase4._get_retrieval_collection()
print(f"   Query: {query4}")
print(f"   Collection: {collection4}")
assert "report" in query4.lower(), "Missing 'report' in query"
assert collection4 == "domain_knowledge", f"Wrong collection: {collection4}"
print("   ✓ Pass")

print("\n" + "=" * 60)
print("All validation checks passed!")
print("=" * 60)
```

**Run Validation:**
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement
python /tmp/validate_phase_retrieval.py
```

---

## Acceptance Criteria

- [ ] DataPreparationPhase implements both retrieval methods
- [ ] PerformanceAnalysisPhase implements both retrieval methods
- [ ] TrainingPlanningPhase implements both retrieval methods
- [ ] ReportPreparationPhase implements both retrieval methods
- [ ] TrainingPlanningPhase uses "training_templates" collection
- [ ] Other 3 phases use "domain_knowledge" collection
- [ ] Performance query includes period_months context
- [ ] Training query includes FTP and weeks context
- [ ] Training query handles missing FTP gracefully (defaults to 250W)
- [ ] 8 unit tests pass
- [ ] Manual validation script passes all checks
- [ ] mypy --strict passes
- [ ] Code follows existing patterns

---

## Troubleshooting

### Issue: JSON parsing error in TrainingPlanningPhase
**Cause:** performance_analysis might be JSON string or dict
**Solution:** Code handles both cases:
```python
perf_data = context.previous_phase_data.get("performance_analysis", {})
if isinstance(perf_data, str):
    import json
    try:
        perf_data = json.loads(perf_data)
    except json.JSONDecodeError:
        perf_data = {}
```

### Issue: FTP not found in performance data
**Solution:** Default to 250W:
```python
ftp = perf_data.get("current_ftp", 250)
```

---

## Dependencies

**Before this card:**
- Card 6: RAGManager initialization (provides rag_manager to phases)

**After this card:**
- Card 8: CLI integration (enables RAG via flags)
- Card 9: Integration testing (validates retrieval works end-to-end)

---

## Estimated Time Breakdown

- Code changes (4 files): 1.5 hours
- Unit test file creation: 1.5 hours
- Manual validation: 0.5 hours
- Debugging/fixes: 0.5-1 hour
- **Total: 4-5 hours**
