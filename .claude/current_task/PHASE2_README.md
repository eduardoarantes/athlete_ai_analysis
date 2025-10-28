# Phase 2: CLI Command Integration - Task Overview

**Status:** READY FOR IMPLEMENTATION
**Created:** 2025-10-27
**Task Architect:** Task Preparation Agent
**Prerequisites:** Phase 1 Complete (MultiAgentOrchestrator + AgentPromptsManager)

---

## Summary

This directory contains a comprehensive implementation plan for **Phase 2: CLI Command Integration** of the Multi-Agent Orchestrator Architecture. Phase 1 (core orchestrator and prompts) has been successfully completed and approved. Phase 2 focuses on creating the user-facing `cycling-ai generate` command.

## Documents

### Main Planning Document

**File:** `PHASE2_CLI_INTEGRATION_PLAN.md`

Comprehensive plan covering:
- Architecture overview and design decisions
- Implementation phases (A-D)
- Integration points with Phase 1
- Rich UI design specifications
- Testing strategy and risk analysis
- CLI command specification
- Code patterns from existing codebase

### Implementation Cards

Located in `PLAN/` directory - **Execute in sequential order:**

| # | Card | Description | Time | Complexity |
|---|------|-------------|------|------------|
| 1 | `CARD_01_command_structure.md` | Create generate.py structure | 2-3h | Medium |
| 2 | `CARD_02_provider_initialization.md` | Provider init and config display | 2h | Medium |
| 3 | `CARD_03_progress_tracker.md` | PhaseProgressTracker class | 1.5h | Medium |
| 4 | `CARD_04_progress_display.md` | Rich Live progress display | 1h | Low |
| 5 | `CARD_05_orchestrator_integration.md` | Connect orchestrator to CLI | 2h | High |
| 6 | `CARD_06_error_handling.md` | Comprehensive error handling | 1.5h | Medium |
| 7 | `CARD_07_unit_tests.md` | Unit tests (>85% coverage) | 3h | High |
| 8 | `CARD_08_integration_validation.md` | Integration tests and validation | 2-3h | High |

**Total estimated time:** 15-18 hours (2-3 days)

---

## Quick Start for Implementation

### Prerequisites Checklist

- [x] Phase 1 complete (`MultiAgentOrchestrator` and `AgentPromptsManager` implemented)
- [x] Python environment set up with dependencies
- [x] Rich library installed
- [x] Click framework in place
- [x] Existing CLI structure (`src/cycling_ai/cli/`)

### Implementation Workflow

**Day 1: Command Structure & Progress Tracking**
```bash
# Morning
- Implement CARD 1: Command structure with Click decorators
- Register command in main.py and __init__.py
- Validate: cycling-ai generate --help

# Afternoon
- Implement CARD 2: Provider initialization
- Test with all providers (Anthropic, OpenAI, Gemini, Ollama)
- Implement CARD 3: PhaseProgressTracker class
- Implement CARD 4: Rich Live display
- Validate: Progress table displays correctly
```

**Day 2: Integration & Error Handling**
```bash
# Morning
- Implement CARD 5: Orchestrator integration
- Connect progress callback
- Test end-to-end workflow
- Validate: Reports are generated

# Afternoon
- Implement CARD 6: Error handling
- Add validation and help messages
- Test all error scenarios
- Implement CARD 7: Unit tests
- Validate: pytest passes with >85% coverage
```

**Day 3: Integration Testing & Validation**
```bash
# Full Day
- Implement CARD 8: Integration tests
- Test with real data and API keys
- Manual testing of all scenarios
- Final validation checklist
- Documentation updates
```

### Validation at Each Step

Each card includes:
- ✅ Acceptance criteria
- 🧪 Testing steps
- ⚡ Validation commands
- 🎯 Success indicators

**IMPORTANT:** Don't proceed to next card until current card is fully validated.

---

## Key Files

### New Files to Create

1. **`src/cycling_ai/cli/commands/generate.py`** (~350-400 lines)
   - CLI command with Click decorators
   - Provider initialization
   - PhaseProgressTracker class
   - Progress display logic
   - Result formatting functions
   - Error handling and validation

2. **`tests/cli/test_generate.py`** (~250-300 lines)
   - Unit tests for all functions
   - PhaseProgressTracker tests
   - CLI command invocation tests
   - Mocked orchestrator tests
   - Coverage >85%

3. **`tests/integration/test_generate_integration.py`** (~150 lines)
   - Real LLM provider tests
   - End-to-end workflow tests
   - Real data tests

### Files to Modify

1. **`src/cycling_ai/cli/commands/__init__.py`**
   - Add `generate` to imports
   - Add `generate` to `__all__` list

2. **`src/cycling_ai/cli/main.py`**
   - Import `generate` command
   - Register with `cli.add_command(generate.generate)`

---

## Architecture Quick Reference

```
┌─────────────────────────────────────────────┐
│  User runs: cycling-ai generate             │
│    --csv data.csv --profile profile.json    │
└───────────────────┬─────────────────────────┘
                    │
                    v
┌─────────────────────────────────────────────┐
│  generate.py (NEW - Phase 2)                │
│  • Parse arguments (Click)                  │
│  • Initialize provider                      │
│  • Validate configuration                   │
│  • Create PhaseProgressTracker              │
└───────────────────┬─────────────────────────┘
                    │
                    v
┌─────────────────────────────────────────────┐
│  MultiAgentOrchestrator (Phase 1)           │
│  • Execute 4-phase workflow                 │
│  • Call progress_callback on status changes │
│  • Return WorkflowResult                    │
└───────────────────┬─────────────────────────┘
                    │
                    v
┌─────────────────────────────────────────────┐
│  PhaseProgressTracker (NEW - Phase 2)       │
│  • Receive callback from orchestrator       │
│  • Update phase status                      │
│  • Generate Rich Table for display          │
└─────────────────────────────────────────────┘

Display: Rich Live with real-time updates
Result: Success/failure panel with details
```

---

## Testing Strategy

### Unit Tests (CARD 7)

**Coverage:** >85% of generate.py

Tests include:
- `PhaseProgressTracker` initialization and updates
- `_initialize_provider()` with all providers
- `_validate_output_directory()` with various scenarios
- `_display_config_summary()` output
- `_display_success_results()` and `_display_failure_results()`
- CLI command invocation (mocked orchestrator)
- Error handling paths

**Run:**
```bash
pytest tests/cli/test_generate.py -v
pytest tests/cli/test_generate.py --cov=cycling_ai.cli.commands.generate --cov-report=term-missing
```

### Integration Tests (CARD 8)

**Requirements:** API keys for providers

Tests include:
- Full workflow with Anthropic Claude
- Workflow with OpenAI GPT-4
- Skip training plan scenario
- Custom parameters
- Different providers

**Run:**
```bash
# Requires: export ANTHROPIC_API_KEY="your-key"
pytest tests/integration/test_generate_integration.py -v -m integration
```

### Manual Testing

See CARD_08 for comprehensive manual testing checklist:
- 6 major scenarios
- Multiple providers
- Error conditions
- Edge cases

---

## Success Criteria Checklist

Phase 2 is **COMPLETE** when all items are checked:

### CLI Command

- [ ] `cycling-ai --help` lists generate command
- [ ] `cycling-ai generate --help` shows full help text
- [ ] Required arguments (`--csv`, `--profile`) are enforced
- [ ] Optional arguments have correct defaults
- [ ] Provider choice validation works (openai, anthropic, gemini, ollama)

### Provider Integration

- [ ] Works with Anthropic (claude-3-5-sonnet)
- [ ] Works with OpenAI (gpt-4)
- [ ] Works with Gemini (gemini-1.5-pro)
- [ ] Works with Ollama (llama3.2)
- [ ] API keys read from environment variables
- [ ] Missing API keys show helpful, provider-specific errors
- [ ] Model selection follows: explicit > config > default

### Progress Display

- [ ] Live table displays without flicker
- [ ] Phases update in real-time during execution
- [ ] Status emojis and colors show correctly
- [ ] Works on different terminal types (iTerm, Terminal, VS Code)

### Workflow Execution

- [ ] Phase 1 (Data Preparation) executes and completes
- [ ] Phase 2 (Performance Analysis) executes and completes
- [ ] Phase 3 (Training Planning) executes/skips based on flag
- [ ] Phase 4 (Report Generation) executes and completes
- [ ] Output files are created in specified directory
- [ ] HTML files are valid and well-formatted
- [ ] Reports contain expected content

### Error Handling

- [ ] Missing CSV file shows helpful error with tips
- [ ] Missing profile shows helpful error with example format
- [ ] Invalid output directory shows permission guidance
- [ ] Missing API key shows provider-specific setup instructions
- [ ] Keyboard interrupt (Ctrl+C) handled gracefully
- [ ] Workflow failures show which phase failed and why

### Results Display

- [ ] Success shows green completion panel
- [ ] Success shows execution summary (time, tokens, phases)
- [ ] Success lists all generated output files
- [ ] Failure shows red failure panel
- [ ] Failure identifies failed phase
- [ ] Failure lists all error messages

### Testing

- [ ] Unit tests pass: `pytest tests/cli/test_generate.py -v`
- [ ] Coverage >85%: `pytest --cov=cycling_ai.cli.commands.generate`
- [ ] Integration tests pass: `pytest tests/integration/test_generate_integration.py -v -m integration`
- [ ] Type checking passes: `mypy src/cycling_ai/cli/commands/generate.py --strict`
- [ ] Linting passes: `ruff check src/cycling_ai/cli/commands/generate.py`

### Code Quality

- [ ] Follows patterns from existing `chat.py` command
- [ ] Type hints are complete and correct
- [ ] Docstrings are comprehensive (all public functions)
- [ ] Error messages are actionable and user-friendly
- [ ] Rich formatting is consistent with existing commands
- [ ] No hardcoded values (uses configuration)
- [ ] No code duplication (DRY principle)

---

## Risk Mitigation Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Provider init failures | High | Clear error messages with setup URLs |
| Progress display flicker | Low | Use Rich Live properly, test terminals |
| Long execution times | Medium | Real-time progress keeps users informed |
| Pattern inconsistency | Medium | Follow chat.py exactly, review side-by-side |
| API rate limits | Medium | Retry with backoff, offer local option (Ollama) |

All risks have detailed mitigation strategies in PHASE2_CLI_INTEGRATION_PLAN.md.

---

## Code Patterns

### Following chat.py Patterns

Phase 2 implementation follows these exact patterns from `chat.py`:

1. **Click Command Structure**
   ```python
   @click.command()
   @click.option(...) # Multiple options
   def command_name(...):
       """Docstring with examples."""
       try:
           # Main logic
       except click.Abort:
           console.print("[yellow]Cancelled[/yellow]")
   ```

2. **Provider Initialization**
   ```python
   # Priority: explicit > config > default
   # Fallback: config file > environment variable
   # Validation: helpful errors with setup instructions
   ```

3. **Rich Formatting**
   ```python
   # Use global console instance
   from cycling_ai.cli.formatting import console

   # Panels for headers
   console.print(Panel.fit("[bold cyan]Title[/bold cyan]", border_style="cyan"))

   # Tables for data
   table = Table(title="Title", show_header=False, box=None)
   ```

4. **Error Handling**
   ```python
   try:
       # Initialization with progress messages
       console.print("[cyan]Initializing...[/cyan]")
       result = operation()
       console.print(f"[green]✓ Success[/green]")
   except ValueError as e:
       console.print(f"[red]Error: {str(e)}[/red]")
       raise click.Abort() from e
   ```

---

## References

**Architecture:**
- Main architecture plan: `plans/MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md`
- Phase 2 detailed plan: `.claude/current_task/PHASE2_CLI_INTEGRATION_PLAN.md`

**Phase 1 Implementation:**
- Orchestrator: `src/cycling_ai/orchestration/multi_agent.py` (654 lines)
- Prompts: `src/cycling_ai/orchestration/prompts.py` (229 lines)

**Existing Patterns:**
- Chat command: `src/cycling_ai/cli/commands/chat.py` (492 lines)
- Rich formatting: `src/cycling_ai/cli/formatting.py` (153 lines)
- Provider factory: `src/cycling_ai/providers/factory.py` (118 lines)

---

## Support During Implementation

### If you encounter issues:

1. **Check the specific card** - Each card has detailed implementation notes
2. **Review PHASE2_CLI_INTEGRATION_PLAN.md** - Comprehensive architecture details
3. **Reference existing code** - Especially chat.py for patterns
4. **Consult architecture plan** - For understanding overall design
5. **Run validation commands** - Each card has specific validation steps

### Common Questions:

**Q: Why PhaseProgressTracker in generate.py vs separate file?**
A: It's tightly coupled to the CLI command, ~50 lines, easier to test together.

**Q: Why follow chat.py so closely?**
A: Consistency across CLI commands, proven patterns, user familiarity.

**Q: Can I skip testing cards?**
A: No - testing is critical for production quality. >85% coverage required.

**Q: What if an integration test fails?**
A: Check API keys, network connection, provider status. See card troubleshooting section.

---

## Next Steps After Phase 2

Once all validation criteria are met:

1. **User Acceptance Testing**
   - Test with real users
   - Gather feedback on UX
   - Identify improvement areas

2. **Performance Optimization**
   - Profile execution
   - Optimize slow paths
   - Reduce token usage if high

3. **Documentation**
   - Update README.md with examples
   - Create user guide
   - Update CHANGELOG.md

4. **Phase 3 Planning**
   - Verbose/debug modes
   - Report templates
   - Additional output formats

---

**Implementation is ready to begin with CARD 1!**

Navigate to `PLAN/CARD_01_command_structure.md` to start.
