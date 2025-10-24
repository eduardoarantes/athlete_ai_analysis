# Phase 3: Tool Wrappers and CLI - Task Checklist

**Status:** Ready for Implementation
**Timeline:** 7 days
**Current Phase:** 3 of 4

---

## Quick Reference

- **Main Plan:** [PHASE3_IMPLEMENTATION_PLAN.md](./PHASE3_IMPLEMENTATION_PLAN.md)
- **Tool Specs:** [PHASE3_TOOL_SPECIFICATIONS.md](./PHASE3_TOOL_SPECIFICATIONS.md)
- **Coverage Target:** >85%
- **Type Safety:** mypy --strict compliant

---

## Phase 3A: Foundation (Days 1-2)

### Day 1: Configuration System

- [ ] **config/schema.py** - Pydantic configuration models
  - [ ] `ProviderSettings` class
  - [ ] `AnalysisSettings` class
  - [ ] `TrainingSettings` class
  - [ ] `PathSettings` class
  - [ ] `OutputSettings` class
  - [ ] `CyclingAIConfig` class with validators
  - [ ] Type hints: mypy --strict compliant

- [ ] **config/defaults.py** - Default configuration values
  - [ ] `DEFAULT_CONFIG` dictionary
  - [ ] All 4 providers (anthropic, openai, gemini, ollama)
  - [ ] Sensible defaults for all settings

- [ ] **config/loader.py** - YAML loading and environment integration
  - [ ] `get_config_path()` - Config file location logic
  - [ ] `load_config()` - Load from YAML
  - [ ] `create_default_config()` - Initialize new config
  - [ ] `get_api_key()` - Environment variable lookup
  - [ ] Error handling for missing/invalid config

- [ ] **Tests: tests/config/**
  - [ ] `test_schema.py` - Pydantic model validation
  - [ ] `test_loader.py` - Config loading scenarios
  - [ ] `test_defaults.py` - Default config validity
  - [ ] Coverage: >85%

- [ ] **Checkpoint:** Run `pytest tests/config/ -v`
  - [ ] All config tests pass
  - [ ] Coverage >85%
  - [ ] mypy passes

---

### Day 2: Tool Loader & Registry Integration

- [ ] **tools/wrappers/__init__.py** - Package initialization
  - [ ] Empty file for package recognition

- [ ] **tools/loader.py** - Auto-registration mechanism
  - [ ] `load_all_tools()` - Import and register all tools
  - [ ] Registration on module import
  - [ ] Error handling for failed registrations

- [ ] **Update tools/__init__.py**
  - [ ] Trigger auto-load on import
  - [ ] Export commonly used classes

- [ ] **Tests: tests/tools/test_loader.py**
  - [ ] Test auto-registration
  - [ ] Test duplicate registration prevention
  - [ ] Test error handling

- [ ] **Checkpoint:** Run `pytest tests/tools/ -v`
  - [ ] Tool loading works
  - [ ] Registry populated correctly
  - [ ] mypy passes

---

## Phase 3B: Tool Wrappers (Days 3-4)

### Day 3: Core Analysis Tools

- [ ] **tools/wrappers/performance.py** - PerformanceAnalysisTool
  - [ ] `PerformanceAnalysisTool` class
  - [ ] `definition` property with 3 parameters
  - [ ] `execute()` method
  - [ ] Path validation (CSV, profile)
  - [ ] AthleteProfile loading
  - [ ] Call `analyze_performance()` from core
  - [ ] JSON parsing and error handling
  - [ ] Type hints complete

- [ ] **tests/tools/wrappers/test_performance.py**
  - [ ] `test_definition_structure()`
  - [ ] `test_execute_success()`
  - [ ] `test_execute_missing_csv()`
  - [ ] `test_execute_missing_profile()`
  - [ ] `test_validate_parameters_missing_required()`
  - [ ] `test_execute_invalid_period_months()`
  - [ ] Coverage: >90%

- [ ] **tools/wrappers/zones.py** - ZoneAnalysisTool
  - [ ] `ZoneAnalysisTool` class
  - [ ] `definition` property with 4 parameters
  - [ ] `execute()` method
  - [ ] Directory validation
  - [ ] AthleteProfile loading for FTP
  - [ ] Call `analyze_time_in_zones()` from core
  - [ ] JSON parsing and error handling
  - [ ] Type hints complete

- [ ] **tests/tools/wrappers/test_zones.py**
  - [ ] `test_definition_structure()`
  - [ ] `test_execute_success()`
  - [ ] `test_execute_missing_directory()`
  - [ ] `test_execute_missing_profile()`
  - [ ] `test_execute_with_cache()`
  - [ ] `test_execute_without_cache()`
  - [ ] Coverage: >90%

- [ ] **Checkpoint:** Run `pytest tests/tools/wrappers/ -v`
  - [ ] 2 tools fully tested
  - [ ] Integration with core business logic works
  - [ ] Coverage >90% for wrappers

---

### Day 4: Planning & Cross-Training Tools

- [ ] **tools/wrappers/training.py** - TrainingPlanTool
  - [ ] `TrainingPlanTool` class
  - [ ] `definition` property with 3 parameters
  - [ ] `execute()` method
  - [ ] Profile validation and loading
  - [ ] Extract training days from profile
  - [ ] Call `generate_training_plan()` from core
  - [ ] JSON parsing and error handling
  - [ ] Type hints complete

- [ ] **tests/tools/wrappers/test_training.py**
  - [ ] `test_definition_structure()`
  - [ ] `test_execute_success()`
  - [ ] `test_execute_with_target_ftp()`
  - [ ] `test_execute_invalid_weeks()`
  - [ ] `test_execute_missing_profile()`
  - [ ] Coverage: >90%

- [ ] **core/utils.py** - Add helper function
  - [ ] `load_and_categorize_activities()` function
  - [ ] Load CSV using existing utilities
  - [ ] Apply cross-training categorization
  - [ ] Return categorized DataFrame
  - [ ] Error handling

- [ ] **tools/wrappers/cross_training.py** - CrossTrainingTool
  - [ ] `CrossTrainingTool` class
  - [ ] `definition` property with 2 parameters
  - [ ] `execute()` method
  - [ ] CSV validation
  - [ ] Call `load_and_categorize_activities()`
  - [ ] Call `analyze_cross_training_impact()` from core
  - [ ] JSON parsing and error handling
  - [ ] Type hints complete

- [ ] **tests/tools/wrappers/test_cross_training.py**
  - [ ] `test_definition_structure()`
  - [ ] `test_execute_success()`
  - [ ] `test_execute_missing_csv()`
  - [ ] `test_execute_invalid_period()`
  - [ ] Coverage: >90%

- [ ] **Checkpoint:** Run `pytest tests/tools/wrappers/ -v`
  - [ ] 4 tools fully implemented
  - [ ] All tests passing
  - [ ] Coverage >90%

---

## Phase 3C: CLI Interface (Days 5-6)

### Day 5: CLI Core & Analyze Commands

- [ ] **Update pyproject.toml**
  - [ ] Add `click>=8.1.0` to dependencies
  - [ ] Add `rich>=13.0.0` to dependencies
  - [ ] Add `pyyaml>=6.0.0` to dependencies
  - [ ] Add `pydantic>=2.0.0` to dependencies
  - [ ] Add entry point: `cycling-ai = "cycling_ai.cli.main:main"`

- [ ] **cli/__init__.py** - Package initialization
  - [ ] Empty file for package recognition

- [ ] **cli/main.py** - Main CLI entry point
  - [ ] `cli()` Click group
  - [ ] `--config` option
  - [ ] `--version` option
  - [ ] Load configuration on startup
  - [ ] Error handling for config loading
  - [ ] Register command groups
  - [ ] `main()` entry point function

- [ ] **cli/formatting.py** - Rich console utilities
  - [ ] `console` instance
  - [ ] `format_json_as_rich()` - JSON syntax highlighting
  - [ ] `format_performance_analysis()` - Rich tables for performance
  - [ ] `format_zone_analysis()` - Rich tables for zones
  - [ ] Color themes and styling

- [ ] **cli/commands/__init__.py** - Command package
  - [ ] Export all command groups

- [ ] **cli/commands/analyze.py** - Analyze commands
  - [ ] `analyze` Click group
  - [ ] `performance` command
    - [ ] `--csv` option (required)
    - [ ] `--profile` option (required)
    - [ ] `--period-months` option (default: 6)
    - [ ] `--output` option (optional)
    - [ ] `--format` option (json/rich)
    - [ ] Execute PerformanceAnalysisTool
    - [ ] Format and display results
  - [ ] `zones` command
    - [ ] `--fit-dir` option (required)
    - [ ] `--profile` option (required)
    - [ ] `--period-months` option (default: 6)
    - [ ] `--no-cache` flag
    - [ ] Execute ZoneAnalysisTool
    - [ ] Format and display results
  - [ ] `cross-training` command
    - [ ] `--csv` option (required)
    - [ ] `--period-weeks` option (default: 12)
    - [ ] Execute CrossTrainingTool
    - [ ] Format and display results

- [ ] **Tests: tests/cli/**
  - [ ] `test_main.py` - Main CLI initialization
  - [ ] `test_analyze_commands.py` - All analyze commands
  - [ ] `test_formatting.py` - Rich formatting functions
  - [ ] Use `CliRunner` from Click
  - [ ] Coverage: >80%

- [ ] **Checkpoint:** Run CLI manually
  ```bash
  pip install -e .
  cycling-ai --help
  cycling-ai analyze --help
  cycling-ai analyze performance --help
  ```
  - [ ] CLI installs correctly
  - [ ] Help text displays
  - [ ] Commands execute

---

### Day 6: Remaining Commands & Polish

- [ ] **cli/commands/plan.py** - Plan generation commands
  - [ ] `plan` Click group
  - [ ] `generate` command
    - [ ] `--profile` option (required)
    - [ ] `--weeks` option (default: 12)
    - [ ] `--target-ftp` option (optional)
    - [ ] Execute TrainingPlanTool
    - [ ] Format and display plan

- [ ] **cli/commands/report.py** - Report generation commands
  - [ ] `report` Click group
  - [ ] `generate` command
    - [ ] `--performance-json` option (required)
    - [ ] `--zones-json` option (required)
    - [ ] `--training-json` option (optional)
    - [ ] `--output` option (required)
    - [ ] Execute ReportGenerationTool
    - [ ] Display success message

- [ ] **cli/commands/config.py** - Configuration commands
  - [ ] `config` Click group (aliased as `config_cmd`)
  - [ ] `show` command - Display current config
  - [ ] `init` command - Initialize default config
  - [ ] `set` command - Set config value

- [ ] **cli/commands/providers.py** - Provider management
  - [ ] `providers` Click group
  - [ ] `list` command - List available providers
  - [ ] Display provider info (models, status)

- [ ] **Add progress indicators**
  - [ ] Use `rich.status` for long operations
  - [ ] Spinner for FIT file processing
  - [ ] Progress bar for multi-file operations

- [ ] **Enhanced error messages**
  - [ ] User-friendly error formatting
  - [ ] Suggestions for common errors
  - [ ] Path validation with helpful hints

- [ ] **Tests: tests/cli/**
  - [ ] `test_plan_commands.py` - Plan generation
  - [ ] `test_report_commands.py` - Report generation
  - [ ] `test_config_commands.py` - Config management
  - [ ] `test_provider_commands.py` - Provider listing
  - [ ] Coverage: >80%

- [ ] **Checkpoint:** Full CLI test
  ```bash
  cycling-ai config init
  cycling-ai providers list
  cycling-ai analyze performance --csv data.csv --profile profile.json
  cycling-ai plan generate --profile profile.json
  ```
  - [ ] All commands work
  - [ ] Output is well-formatted
  - [ ] Errors are helpful

---

## Phase 3D: Integration & Polish (Day 7)

### Day 7: Orchestration & Documentation

- [ ] **orchestration/__init__.py** - Package initialization
  - [ ] Export main classes

- [ ] **orchestration/executor.py** - Tool execution layer
  - [ ] `ToolExecutor` class
  - [ ] `__init__()` - Get global registry
  - [ ] `execute_tool()` - Execute by name
  - [ ] Error handling and logging
  - [ ] Type hints complete

- [ ] **orchestration/interpreter.py** - LLM interpretation (basic)
  - [ ] `ResultInterpreter` class
  - [ ] `__init__()` - Accept provider
  - [ ] `interpret_result()` - Send to LLM
  - [ ] Build system prompt for analysis
  - [ ] Handle user questions
  - [ ] Type hints complete

- [ ] **Tests: tests/orchestration/**
  - [ ] `test_executor.py` - Tool execution
  - [ ] `test_interpreter.py` - LLM interpretation
  - [ ] Mock providers and tools
  - [ ] Coverage: >85%

- [ ] **Integration tests**
  - [ ] End-to-end workflow tests
  - [ ] Real data if available
  - [ ] Multi-tool orchestration
  - [ ] Provider integration

- [ ] **Documentation updates**
  - [ ] Update README.md with CLI examples
  - [ ] Create CLI_USAGE.md guide
  - [ ] Document configuration format
  - [ ] Add troubleshooting section

- [ ] **Create examples**
  - [ ] Example config file
  - [ ] Example workflow scripts
  - [ ] Sample data for testing

- [ ] **Final validation**
  - [ ] Run full test suite: `pytest -v`
  - [ ] Check coverage: `pytest --cov`
  - [ ] Run mypy: `mypy src/cycling_ai --strict`
  - [ ] Run ruff: `ruff check src/`
  - [ ] Test on real data

- [ ] **Checkpoint:** Phase 3 Complete
  - [ ] All 5 tools implemented and tested
  - [ ] Configuration system working
  - [ ] CLI fully functional
  - [ ] Tests passing (>85% coverage)
  - [ ] Type checking passing
  - [ ] Documentation complete

---

## Quality Gates

### Before Merging to Main

- [ ] **Test Coverage:** Overall >85%, wrappers >90%
- [ ] **Type Safety:** `mypy --strict` passes with zero errors
- [ ] **Linting:** `ruff check` passes with zero errors
- [ ] **Tests:** All pytest tests pass
- [ ] **Integration:** End-to-end workflows tested
- [ ] **Documentation:** All public APIs documented
- [ ] **Examples:** Working examples provided

### Code Review Checklist

- [ ] All tool wrappers follow common patterns
- [ ] Error handling is comprehensive
- [ ] Parameter validation is thorough
- [ ] File paths use `pathlib.Path`
- [ ] JSON parsing includes error handling
- [ ] Metadata is meaningful
- [ ] Type hints are complete
- [ ] Docstrings are clear

---

## Post-Phase 3 Validation

### Manual Testing Scenarios

```bash
# Scenario 1: Performance Analysis
cycling-ai analyze performance \
  --csv ~/data/activities.csv \
  --profile ~/data/athlete_profile.json \
  --period-months 6

# Scenario 2: Zone Analysis
cycling-ai analyze zones \
  --fit-dir ~/data/fit_files \
  --profile ~/data/athlete_profile.json

# Scenario 3: Training Plan
cycling-ai plan generate \
  --profile ~/data/athlete_profile.json \
  --weeks 12 \
  --target-ftp 270

# Scenario 4: Full Report
cycling-ai analyze performance --csv data.csv --profile profile.json --format json > perf.json
cycling-ai analyze zones --fit-dir fits/ --profile profile.json --format json > zones.json
cycling-ai plan generate --profile profile.json --format json > plan.json
cycling-ai report generate \
  --performance-json perf.json \
  --zones-json zones.json \
  --training-json plan.json \
  --output report.md

# Scenario 5: Cross-Training
cycling-ai analyze cross-training \
  --csv ~/data/all_activities.csv \
  --period-weeks 12
```

---

## Dependencies Installation

```bash
# Install with new dependencies
pip install -e ".[dev]"

# Verify installation
cycling-ai --version
pytest --version
mypy --version
```

---

## File Count Summary

**New Files to Create:** 41
- Configuration: 4 files + 3 tests
- Tool Wrappers: 5 files + 5 tests
- CLI: 7 files + 5 tests
- Orchestration: 2 files + 2 tests
- Documentation: 3 files

**Modified Files:** 3
- `pyproject.toml` (dependencies + entry point)
- `tools/__init__.py` (auto-load trigger)
- `core/utils.py` (helper function)

---

## Success Metrics

- [ ] 5 tool wrappers implemented
- [ ] All tools auto-register
- [ ] Configuration loads from YAML
- [ ] CLI accepts all planned commands
- [ ] Rich console output works
- [ ] Test coverage >85%
- [ ] mypy --strict passes
- [ ] End-to-end workflows functional

---

**Ready for Implementation:** ✅
**Estimated Completion:** Day 7
**Next Phase:** Phase 4 (Advanced Features)
