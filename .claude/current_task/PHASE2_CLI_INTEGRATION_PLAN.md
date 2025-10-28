# Phase 2: CLI Command Integration - Implementation Plan

**Document Version:** 1.0.0
**Date:** 2025-10-27
**Status:** Ready for Implementation
**Prepared by:** Task Preparation Architect Agent

---

## Executive Summary

This plan provides comprehensive, step-by-step implementation guidance for Phase 2 of the Multi-Agent Orchestrator Architecture. Phase 1 has been successfully completed with the `MultiAgentOrchestrator` and `AgentPromptsManager` classes fully implemented and tested. Phase 2 focuses on creating the user-facing CLI command that integrates with the orchestrator to provide an excellent developer experience.

### Phase 2 Objectives

1. Create `cycling-ai generate` CLI command with Click framework
2. Implement real-time progress tracking using Rich library
3. Integrate with Phase 1 orchestrator for workflow execution
4. Provide comprehensive error handling and user feedback
5. Follow existing CLI patterns from the `chat` command
6. Ensure consistent project architecture and conventions

### Key Success Metrics

- Command executes end-to-end workflow successfully
- Progress display shows real-time phase status updates
- Error messages are clear, actionable, and user-friendly
- Test coverage >85% for new CLI code
- Follows existing CLI patterns and Rich usage
- Integration with Phase 1 orchestrator is seamless

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│          User invokes: cycling-ai generate              │
│                                                         │
│  $ cycling-ai generate --csv data.csv --profile p.json │
└─────────────────────────┬───────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────┐
│         generate.py (NEW CLI Command)                   │
│                                                         │
│  • Argument parsing (Click decorators)                  │
│  • Provider initialization                              │
│  • Configuration validation                             │
│  • Progress display (PhaseProgressTracker)              │
│  • Error handling and formatting                        │
└─────────────────────────┬───────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────┐
│    MultiAgentOrchestrator (Phase 1 - COMPLETE)          │
│                                                         │
│  • Executes 4-phase workflow                            │
│  • Calls progress_callback on status changes            │
│  • Returns WorkflowResult                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│    PhaseProgressTracker (NEW - in generate.py)          │
│                                                         │
│  • Maintains phase status dictionary                    │
│  • Generates Rich Table for live display                │
│  • Updates on callback from orchestrator                │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase A: CLI Command Structure (Card 1-2)

**Timeline:** Day 1
**Complexity:** Medium
**Dependencies:** Phase 1 complete

Create the basic CLI command structure following the existing `chat` command pattern:

1. Create `src/cycling_ai/cli/commands/generate.py`
2. Define command with Click decorators and all required options
3. Implement provider initialization (similar to chat.py)
4. Register command in `main.py` and `__init__.py`

### Phase B: Progress Tracking System (Card 3-4)

**Timeline:** Day 1-2
**Complexity:** Medium
**Dependencies:** Phase A complete

Implement the progress tracking system using Rich library:

1. Create `PhaseProgressTracker` class
2. Implement Rich Table generation for live display
3. Add progress callback integration
4. Test progress display updates

### Phase C: Integration & Error Handling (Card 5-6)

**Timeline:** Day 2
**Complexity:** Medium
**Dependencies:** Phase A, B complete

Connect all components and handle errors gracefully:

1. Integrate orchestrator with progress tracker
2. Implement comprehensive error handling
3. Add result formatting (success/failure displays)
4. Validate user inputs early

### Phase D: Testing & Validation (Card 7-8)

**Timeline:** Day 2-3
**Complexity:** High
**Dependencies:** Phase A, B, C complete

Create comprehensive test coverage:

1. Unit tests for CLI command functions
2. Integration tests with mocked orchestrator
3. Progress tracker tests
4. End-to-end validation

---

## File Structure

```
src/cycling_ai/
├── cli/
│   ├── commands/
│   │   ├── __init__.py           # MODIFIED: Add generate import
│   │   ├── chat.py               # REFERENCE: Pattern to follow
│   │   └── generate.py           # NEW: 350-400 lines
│   └── main.py                   # MODIFIED: Register generate command
│
└── orchestration/
    ├── multi_agent.py            # EXISTING: Phase 1 (654 lines)
    └── prompts.py                # EXISTING: Phase 1 (229 lines)

tests/
└── cli/
    └── test_generate.py          # NEW: 250-300 lines
```

---

## Key Design Decisions

### 1. Progress Tracker Location

**Decision:** Embed `PhaseProgressTracker` in `generate.py`

**Rationale:**
- It's tightly coupled to the CLI command
- Simpler than separate module for ~50 lines
- Follows pattern from architecture plan
- Easy to test within CLI test file

### 2. Provider Initialization Pattern

**Decision:** Follow exact pattern from `chat.py`

**Rationale:**
- Consistency across CLI commands
- Proven working implementation
- Handles environment variables, defaults, fallbacks
- Users familiar with chat command will understand

### 3. Error Handling Strategy

**Decision:** Fail-fast with clear, actionable messages

**Rationale:**
- Better UX than silent failures
- Consistent with Phase 1 orchestrator design
- Helps users debug configuration issues
- Follows Click best practices

### 4. Rich Library Usage

**Decision:** Use Live display for progress, Panels for results

**Rationale:**
- Already used in existing codebase
- Provides professional, clean UI
- Live display updates without flicker
- Consistent with existing CLI styling

---

## Integration Points with Phase 1

### Orchestrator Interface

```python
# Phase 1 provides this interface:
orchestrator = MultiAgentOrchestrator(
    provider=provider_instance,
    prompts_manager=prompts_manager,  # Optional
    progress_callback=callback_fn,     # Our tracker
)

result = orchestrator.execute_workflow(config)
```

### Progress Callback Contract

```python
# Phase 2 must provide callback with this signature:
def progress_callback(phase_name: str, status: PhaseStatus) -> None:
    """
    Called by orchestrator when phase status changes.

    Args:
        phase_name: "data_preparation", "performance_analysis", etc.
        status: PhaseStatus enum value (PENDING, IN_PROGRESS, etc.)
    """
    pass
```

### WorkflowResult Processing

```python
# Phase 1 returns WorkflowResult with:
result.success: bool                    # Overall success flag
result.phase_results: list[PhaseResult] # Individual phase results
result.total_execution_time_seconds: float
result.total_tokens_used: int
result.output_files: list[Path]         # Generated reports
```

---

## Rich UI Design

### Welcome Header

```
┌────────────────────────────────────────────┐
│     Multi-Agent Report Generator            │
│   Orchestrating specialized agents for     │
│       comprehensive analysis                │
└────────────────────────────────────────────┘
```

### Configuration Display

```
Workflow Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CSV File          activities.csv
  Athlete Profile   profile.json
  FIT Directory     ./fit_files
  Output Directory  ./reports
  Analysis Period   6 months
  Training Plan     12 weeks
```

### Live Progress Table

```
Phase                       Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data Preparation            ✓ Completed
Performance Analysis        🔄 In Progress
Training Planning           ⏳ Pending
Report Generation           ⏳ Pending
```

### Success Output

```
┌────────────────────────────────────────────┐
│     ✓ Workflow Completed Successfully      │
└────────────────────────────────────────────┘

Execution Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Time          45.3s
  Total Tokens        12,547
  Phases Completed    4

Generated Reports:
  ✓ /path/to/reports/index.html
  ✓ /path/to/reports/coaching_insights.html
  ✓ /path/to/reports/performance_dashboard.html

Open the reports in your browser to view the analysis.
```

### Failure Output

```
┌────────────────────────────────────────────┐
│           ✗ Workflow Failed                 │
└────────────────────────────────────────────┘

Failed at phase: performance_analysis

Errors:
  • CSV file missing required column 'Average Power'
  • Unable to calculate performance metrics

Please check your CSV file format and try again.
```

---

## Testing Strategy

### Unit Tests (test_generate.py)

```python
class TestProviderInitialization:
    """Test _initialize_provider function."""

    def test_provider_with_explicit_model()
    def test_provider_with_default_model()
    def test_provider_with_env_api_key()
    def test_provider_missing_api_key_raises_error()

class TestConfigSummaryDisplay:
    """Test _display_config_summary function."""

    def test_displays_all_config_values()
    def test_handles_optional_fit_dir()
    def test_handles_skipped_training_plan()

class TestResultsDisplay:
    """Test _display_success_results and _display_failure_results."""

    def test_success_display_shows_all_metrics()
    def test_success_display_lists_output_files()
    def test_failure_display_shows_phase_and_errors()

class TestPhaseProgressTracker:
    """Test PhaseProgressTracker class."""

    def test_initialization()
    def test_update_phase_status()
    def test_get_table_formats_correctly()
    def test_status_emoji_mapping()
```

### Integration Tests

```python
class TestGenerateCommandIntegration:
    """Integration tests with mocked orchestrator."""

    def test_generate_command_with_minimal_args()
    def test_generate_command_with_all_args()
    def test_generate_command_with_skip_training_plan()
    def test_generate_command_handles_validation_error()
    def test_generate_command_handles_workflow_failure()
    def test_generate_command_calls_progress_callback()
```

### Mock Strategy

```python
# Mock the orchestrator to test CLI in isolation
@patch('cycling_ai.cli.commands.generate.MultiAgentOrchestrator')
def test_generate_calls_orchestrator(mock_orchestrator_class):
    # Setup mock
    mock_instance = Mock()
    mock_instance.execute_workflow.return_value = WorkflowResult(...)
    mock_orchestrator_class.return_value = mock_instance

    # Invoke CLI
    result = runner.invoke(generate, [...args])

    # Assert
    assert result.exit_code == 0
    mock_instance.execute_workflow.assert_called_once()
```

---

## Risk Analysis & Mitigation

### Risk 1: Provider Initialization Failures

**Severity:** High
**Probability:** Medium
**Impact:** Command fails to start

**Mitigation:**
- Comprehensive error messages citing missing API keys
- Clear instructions on setting environment variables
- Validate provider early before orchestrator creation
- Test with all four providers (OpenAI, Anthropic, Gemini, Ollama)

### Risk 2: Progress Display Flicker

**Severity:** Low
**Probability:** Low
**Impact:** Poor UX, but functional

**Mitigation:**
- Use Rich `Live` context manager (handles refresh correctly)
- Set appropriate refresh rate (4 fps is good balance)
- Test on different terminal types
- Follow Rich best practices from docs

### Risk 3: Long-Running Workflow UX

**Severity:** Medium
**Probability:** High
**Impact:** User uncertainty during execution

**Mitigation:**
- Real-time progress updates via callback
- Clear status indicators (spinner, checkmarks)
- Execution time tracking
- Option to add verbose logging (future enhancement)

### Risk 4: Inconsistent CLI Patterns

**Severity:** Medium
**Probability:** Low
**Impact:** Confusing for users

**Mitigation:**
- Follow chat.py patterns exactly
- Use same argument naming conventions
- Consistent error message formatting
- Review by comparing side-by-side with chat.py

---

## Code Patterns from Existing Codebase

### Pattern 1: Click Command Structure

From `chat.py`:

```python
@click.command()
@click.option(
    "--provider",
    type=click.Choice(["openai", "anthropic", "gemini", "ollama"]),
    default="anthropic",
    help="LLM provider to use",
)
@click.option("--model", help="Specific model to use")
def command_name(...):
    """Docstring with examples."""
    try:
        # Main logic
        pass
    except click.Abort:
        console.print("[yellow]Cancelled[/yellow]")
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        raise
```

### Pattern 2: Provider Initialization

From `chat.py` lines 191-274:

```python
def _initialize_provider(
    provider_name: str,
    model: str | None,
    temperature: float,
    max_tokens: int,
    config: Any,
) -> BaseProvider:
    # Get config
    # Determine model (explicit -> config -> default)
    # Get API key (config -> env var)
    # Create ProviderConfig
    # Create provider via factory
    # Handle errors with helpful messages
```

### Pattern 3: Rich Formatting

From `formatting.py`:

```python
# Use global console instance
from cycling_ai.cli.formatting import console

# Panels for headers
console.print(Panel.fit(
    "[bold cyan]Title[/bold cyan]\n[dim]Subtitle[/dim]",
    border_style="cyan"
))

# Tables for structured data
table = Table(title="Title", show_header=False)
table.add_column("Key", style="cyan")
table.add_column("Value", style="white")
table.add_row("Key", "Value")
console.print(table)
```

### Pattern 4: Error Handling

From `chat.py`:

```python
try:
    # Initialization
    console.print("[cyan]Initializing...[/cyan]")
    provider = _initialize_provider(...)
    console.print(f"[green]✓ Initialized[/green]")

    # Main logic
    ...

except click.Abort:
    console.print("[yellow]Cancelled[/yellow]")
    raise
except Exception as e:
    console.print(f"[red]Error: {str(e)}[/red]")
    console.print("[yellow]Tip: ...[/yellow]")
    raise
```

---

## CLI Command Specification

### Command Signature

```bash
cycling-ai generate [OPTIONS]
```

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `--csv` | Path | Path to Strava activities CSV export |
| `--profile` | Path | Path to athlete profile JSON |

### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--fit-dir` | Path | None | Directory containing FIT files |
| `--output-dir` | Path | ./reports | Output directory for reports |
| `--period-months` | int | 6 | Months for performance comparison |
| `--training-plan-weeks` | int | 12 | Weeks for training plan |
| `--skip-training-plan` | flag | False | Skip training plan generation |
| `--provider` | choice | anthropic | LLM provider to use |
| `--model` | str | (auto) | Specific model name |
| `--prompts-dir` | Path | None | Custom prompts directory |

### Usage Examples

```bash
# Minimal usage
cycling-ai generate --csv activities.csv --profile athlete.json

# Full usage
cycling-ai generate \
  --csv ~/data/activities.csv \
  --profile ~/data/athlete.json \
  --fit-dir ~/data/fit_files \
  --output-dir ~/reports/2025-01 \
  --period-months 12 \
  --training-plan-weeks 16 \
  --provider anthropic \
  --model claude-3-5-sonnet-20241022

# Skip training plan
cycling-ai generate \
  --csv activities.csv \
  --profile athlete.json \
  --skip-training-plan

# Use custom prompts
cycling-ai generate \
  --csv activities.csv \
  --profile athlete.json \
  --prompts-dir ~/.cycling-ai/custom-prompts
```

---

## Implementation Cards Breakdown

The detailed implementation is broken down into 8 sequential cards in the `PLAN/` directory:

1. **CARD_1.md**: Create generate.py command structure
2. **CARD_2.md**: Implement provider initialization
3. **CARD_3.md**: Create PhaseProgressTracker class
4. **CARD_4.md**: Implement Rich progress display
5. **CARD_5.md**: Integrate orchestrator with CLI
6. **CARD_6.md**: Add error handling and result formatting
7. **CARD_7.md**: Create unit tests
8. **CARD_8.md**: Integration testing and validation

Each card contains:
- Specific files to create/modify
- Exact code to write with line numbers
- Acceptance criteria
- Testing instructions
- Dependencies on previous cards

---

## Validation Checklist

### Phase 2 Complete When:

- [ ] `cycling-ai generate --help` displays correct help text
- [ ] Command accepts all required and optional arguments
- [ ] Provider initialization works for all four providers
- [ ] Progress table displays and updates in real-time
- [ ] Successful workflow shows completion summary
- [ ] Failed workflow shows clear error messages
- [ ] Output files are created in specified directory
- [ ] Test coverage >85% for new code
- [ ] All tests pass (pytest tests/cli/test_generate.py)
- [ ] Integration with Phase 1 orchestrator works seamlessly
- [ ] Code follows existing patterns from chat.py
- [ ] Rich formatting is consistent with existing commands
- [ ] Type hints pass mypy --strict validation
- [ ] Command is registered in main.py
- [ ] Documentation is complete

---

## Next Steps After Phase 2

Once Phase 2 is complete and validated:

1. **User Acceptance Testing**: Test with real data and all providers
2. **Performance Optimization**: Profile execution, optimize if needed
3. **Documentation**: Update README with generate command examples
4. **Phase 3 Planning**: Plan additional features (verbose mode, custom templates, etc.)

---

## References

- Architecture Plan: `/Users/eduardo/Documents/projects/cycling-ai-analysis/plans/MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md`
- Phase 1 Orchestrator: `src/cycling_ai/orchestration/multi_agent.py`
- Phase 1 Prompts: `src/cycling_ai/orchestration/prompts.py`
- Chat Command Pattern: `src/cycling_ai/cli/commands/chat.py`
- Rich Formatting: `src/cycling_ai/cli/formatting.py`
- Provider Factory: `src/cycling_ai/providers/factory.py`

---

**Ready to begin implementation with Card 1.**
