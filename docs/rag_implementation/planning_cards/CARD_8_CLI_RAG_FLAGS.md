# Implementation Card 8: CLI RAG Integration

**Priority:** High
**Estimated Time:** 3-4 hours
**Card Status:** Ready for Implementation
**Dependencies:** Cards 6 & 7 (RAG infrastructure working)

---

## Objective

Add CLI flags to enable and configure RAG in the `generate` command. Users need a simple way to activate RAG without modifying code.

---

## Files to Modify

### File: `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/cli/commands/generate.py`

**Current Signature (around line ~340):**
```python
@click.command()
@click.option("--csv", ...)
@click.option("--profile", ...)
# ... many existing options ...
def generate(
    csv: str | None,
    profile: str,
    # ... existing params ...
) -> None:
```

**Changes Needed:**

#### Change 1: Add Click Options (after existing options, around line ~320)

```python
@click.option(
    "--enable-rag",
    is_flag=True,
    default=False,
    help="Enable RAG-enhanced prompts using knowledge base retrieval",
)
@click.option(
    "--rag-top-k",
    type=int,
    default=3,
    help="Number of documents to retrieve per phase (default: 3)",
)
@click.option(
    "--rag-min-score",
    type=float,
    default=0.5,
    help="Minimum similarity score for retrieval (0-1, default: 0.5)",
)
```

#### Change 2: Update Function Signature (around line ~340)

```python
def generate(
    # ... existing params ...
    enable_rag: bool,
    rag_top_k: int,
    rag_min_score: float,
) -> None:
    """
    Generate comprehensive cycling performance reports.

    Analyzes cycling data from CSV and FIT files to produce:
    - Performance analysis and trends
    - Training zone distributions
    - Personalized training plan (optional)
    - Professional HTML reports

    RAG Enhancement:
        Use --enable-rag to augment agent prompts with relevant
        knowledge from the cycling science database. Requires
        vectorstore to be populated first:

            cycling-ai index domain-knowledge
            cycling-ai generate --enable-rag --profile profile.json

    Examples:
        # Basic generation
        cycling-ai generate --profile profile.json

        # With RAG enhancement
        cycling-ai generate --profile profile.json --enable-rag

        # Custom RAG settings
        cycling-ai generate --profile profile.json \\
            --enable-rag --rag-top-k 5 --rag-min-score 0.7
    """
```

#### Change 3: Create RAGConfig (around line ~480, after WorkflowConfig creation starts)

Add near top of function after imports:
```python
from pathlib import Path
from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig

# ... existing code ...

# Setup RAG configuration
rag_config = create_rag_config(
    enabled=enable_rag,
    top_k=rag_top_k,
    min_score=rag_min_score,
)
```

#### Change 4: Add Helper Function (before generate() function, around line ~300)

```python
def create_rag_config(
    enabled: bool,
    top_k: int,
    min_score: float,
) -> RAGConfig:
    """
    Create RAG configuration for workflow.

    Sets up vectorstore paths and validates configuration.
    Shows warnings if RAG enabled but vectorstore not available.

    Args:
        enabled: Whether RAG is enabled
        top_k: Number of documents to retrieve
        min_score: Minimum similarity score

    Returns:
        RAGConfig instance with appropriate settings
    """
    from pathlib import Path
    from cycling_ai.orchestration.base import RAGConfig
    from cycling_ai.cli.formatting import console

    # Determine vectorstore paths
    project_root = Path(__file__).parent.parent.parent.parent
    project_vectorstore = project_root / "data" / "vectorstore"
    user_vectorstore = Path.home() / ".cycling-ai" / "athlete_history"

    # Check if project vectorstore exists
    if enabled and not project_vectorstore.exists():
        console.print(
            "\n[yellow]⚠️  Warning: RAG enabled but vectorstore not found[/yellow]",
            style="bold",
        )
        console.print(
            f"[yellow]   Expected location: {project_vectorstore}[/yellow]"
        )
        console.print(
            "\n[yellow]   To populate the vectorstore, run:[/yellow]"
        )
        console.print(
            "[yellow]      cycling-ai index domain-knowledge[/yellow]"
        )
        console.print(
            "[yellow]      cycling-ai index training-templates[/yellow]"
        )
        console.print(
            "\n[yellow]   RAG will be disabled for this run.[/yellow]\n"
        )

    # Create configuration
    rag_config = RAGConfig(
        enabled=enabled,
        top_k=top_k,
        min_score=min_score,
        project_vectorstore_path=(
            project_vectorstore if project_vectorstore.exists() else None
        ),
        user_vectorstore_path=(
            user_vectorstore if user_vectorstore.exists() else None
        ),
        embedding_provider="local",
        embedding_model=None,  # Use provider defaults
    )

    # Log RAG status
    if enabled:
        if rag_config.project_vectorstore_path:
            console.print(
                f"[green]✓[/green] RAG enabled with top_k={top_k}, "
                f"min_score={min_score}"
            )
        else:
            console.print("[yellow]⚠️  RAG disabled (vectorstore not found)[/yellow]")

    return rag_config
```

#### Change 5: Pass RAGConfig to WorkflowConfig (around line ~550)

```python
config = WorkflowConfig(
    # ... existing fields ...
    rag_config=rag_config,  # ADD THIS LINE
)
```

---

## Testing

### Unit Tests

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/cli/test_generate_rag.py` (NEW FILE)

```python
"""
Tests for RAG CLI integration in generate command.
"""
from pathlib import Path
import pytest
from click.testing import CliRunner
from cycling_ai.cli.main import app


class TestGenerateRAGFlags:
    """Test RAG flags in generate command."""

    def test_generate_with_enable_rag_flag(self, tmp_path, mock_workflow):
        """Test --enable-rag flag is recognized."""
        runner = CliRunner()

        # Create minimal test files
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 250}')

        result = runner.invoke(
            app,
            [
                "generate",
                "--profile", str(profile_file),
                "--csv", str(csv_file),
                "--enable-rag",  # Test this flag
            ]
        )

        # Should not fail on unknown option
        assert "--enable-rag" not in result.output
        assert result.exit_code != 2  # 2 = usage error

    def test_generate_with_custom_rag_params(self, tmp_path, mock_workflow):
        """Test custom RAG parameters."""
        runner = CliRunner()

        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 250}')

        result = runner.invoke(
            app,
            [
                "generate",
                "--profile", str(profile_file),
                "--csv", str(csv_file),
                "--enable-rag",
                "--rag-top-k", "5",
                "--rag-min-score", "0.7",
            ]
        )

        # Flags should be accepted
        assert result.exit_code != 2

    def test_generate_warns_if_vectorstore_missing(
        self, tmp_path, mock_workflow, capsys
    ):
        """Test warning when RAG enabled but vectorstore missing."""
        from cycling_ai.cli.commands.generate import create_rag_config

        # Call helper directly
        rag_config = create_rag_config(
            enabled=True,
            top_k=3,
            min_score=0.5,
        )

        captured = capsys.readouterr()

        # Should show warning (if vectorstore doesn't exist)
        # Note: Test might pass if vectorstore actually exists
        if not rag_config.project_vectorstore_path:
            assert "warning" in captured.out.lower() or "⚠" in captured.out

    def test_generate_backward_compat_no_rag(self, tmp_path, mock_workflow):
        """Test backward compatibility when RAG flags omitted."""
        runner = CliRunner()

        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Activity Name,Distance\\n")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"ftp": 250}')

        # Run WITHOUT RAG flags (backward compatibility)
        result = runner.invoke(
            app,
            [
                "generate",
                "--profile", str(profile_file),
                "--csv", str(csv_file),
                # No --enable-rag flag
            ]
        )

        # Should work fine without RAG
        assert result.exit_code != 2


@pytest.fixture
def mock_workflow(monkeypatch):
    """Mock MultiAgentOrchestrator to avoid actual workflow execution."""
    from unittest.mock import Mock

    mock_orchestrator = Mock()
    mock_result = Mock()
    mock_result.success = True
    mock_result.phase_results = []
    mock_result.output_files = []
    mock_orchestrator.execute_workflow.return_value = mock_result

    monkeypatch.setattr(
        "cycling_ai.cli.commands.generate.MultiAgentOrchestrator",
        lambda *args, **kwargs: mock_orchestrator
    )

    return mock_orchestrator
```

**Run Tests:**
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement
pytest tests/cli/test_generate_rag.py -v
```

---

## Manual Validation

### Test 1: Help Text
```bash
cycling-ai generate --help | grep -A 5 "enable-rag"
```

**Expected Output:**
```
  --enable-rag            Enable RAG-enhanced prompts using knowledge base
                          retrieval
  --rag-top-k INTEGER     Number of documents to retrieve per phase
                          (default: 3)
  --rag-min-score FLOAT   Minimum similarity score for retrieval (0-1,
                          default: 0.5)
```

### Test 2: RAG Enabled (with vectorstore)
```bash
# First, populate vectorstore
cycling-ai index domain-knowledge

# Then run with RAG
cycling-ai generate \
    --profile test_data/athlete_profile.json \
    --csv test_data/activities.csv \
    --enable-rag \
    --verbose

# Check logs for RAG initialization
tail -100 ~/.cycling-ai/logs/cycling-ai.log | grep -i rag
```

**Expected in logs:**
```
INFO - Initializing RAG with vectorstore: .../data/vectorstore
INFO - RAG manager initialized successfully
INFO - [performance_analysis] RAG retrieval: query='performance analysis...'
INFO - [performance_analysis] Retrieved 3 documents
```

### Test 3: RAG Enabled (without vectorstore)
```bash
# Don't index first - simulate missing vectorstore

cycling-ai generate \
    --profile test_data/athlete_profile.json \
    --csv test_data/activities.csv \
    --enable-rag
```

**Expected Output:**
```
⚠️  Warning: RAG enabled but vectorstore not found
   Expected location: .../data/vectorstore

   To populate the vectorstore, run:
      cycling-ai index domain-knowledge
      cycling-ai index training-templates

   RAG will be disabled for this run.
```

### Test 4: Custom RAG Parameters
```bash
cycling-ai generate \
    --profile test_data/athlete_profile.json \
    --csv test_data/activities.csv \
    --enable-rag \
    --rag-top-k 5 \
    --rag-min-score 0.7 \
    --verbose
```

**Expected in logs:**
```
INFO - RAG enabled with top_k=5, min_score=0.7
```

### Test 5: Backward Compatibility
```bash
# Run WITHOUT any RAG flags (should work as before)
cycling-ai generate \
    --profile test_data/athlete_profile.json \
    --csv test_data/activities.csv
```

**Expected:** Works normally, no RAG mentioned

---

## Acceptance Criteria

- [ ] 3 new Click options added (--enable-rag, --rag-top-k, --rag-min-score)
- [ ] Function signature updated with new parameters
- [ ] create_rag_config() helper function added
- [ ] Warning shown when RAG enabled but vectorstore missing
- [ ] Success message when RAG enabled and vectorstore found
- [ ] RAGConfig created and passed to WorkflowConfig
- [ ] Help text updated with RAG examples
- [ ] 4 CLI tests pass
- [ ] Manual validation shows:
  - Help text displays correctly
  - Warning appears when vectorstore missing
  - RAG activates when vectorstore present
  - Custom parameters work
  - Backward compatibility maintained

---

## Documentation Updates

### Update in generate() docstring:

Add RAG section:
```python
"""
Generate comprehensive cycling performance reports.

... existing docs ...

RAG Enhancement:
    Use --enable-rag to augment agent prompts with relevant
    knowledge from the cycling science database. This retrieves
    domain knowledge and training templates to inform analysis
    and plan generation.

    Prerequisites:
        Vectorstore must be populated first:
        $ cycling-ai index domain-knowledge
        $ cycling-ai index training-templates

    Examples with RAG:
        # Enable RAG with defaults
        $ cycling-ai generate --profile profile.json --enable-rag

        # Custom retrieval settings
        $ cycling-ai generate --profile profile.json \\
            --enable-rag --rag-top-k 5 --rag-min-score 0.7

        # RAG increases prompt quality but adds ~20% token overhead
"""
```

---

## Troubleshooting

### Issue: "Unknown option: --enable-rag"
**Cause:** Options not added before function decorator
**Solution:** Ensure options are added BEFORE @click.command()

### Issue: Warning always shows even with vectorstore
**Cause:** Path calculation incorrect
**Solution:** Verify project_root calculation:
```python
project_root = Path(__file__).parent.parent.parent.parent
print(f"Project root: {project_root}")
print(f"Vectorstore: {project_root / 'data' / 'vectorstore'}")
```

### Issue: RAG config not propagating
**Cause:** Forgot to pass to WorkflowConfig
**Solution:** Ensure this line exists:
```python
config = WorkflowConfig(
    # ... other fields ...
    rag_config=rag_config,  # MUST BE PRESENT
)
```

---

## Dependencies

**Before this card:**
- Card 6: RAGManager workflow integration
- Card 7: Phase-specific retrieval methods

**After this card:**
- Card 9: End-to-end integration testing
- Card 10: Documentation updates

---

## Estimated Time Breakdown

- Code changes (generate.py): 1.5 hours
- Helper function: 0.5 hours
- CLI tests: 1 hour
- Manual validation: 0.5 hours
- Documentation: 0.5 hours
- **Total: 3-4 hours**

---

## Notes

- This card makes RAG user-accessible via CLI
- Warning message is important for UX
- Backward compatibility is critical - all existing commands must work
- Help text should be clear and include examples
- Default values (top_k=3, min_score=0.5) chosen based on testing in Phase 2
