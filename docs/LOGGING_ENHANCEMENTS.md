# Logging Enhancements for Observability

## Summary

Enhanced logging throughout the cycling-ai codebase to improve observability and debugging capabilities. Proper log levels (DEBUG/INFO/WARNING/ERROR) are now used throughout the system.

## Files Modified

### 1. `src/cycling_ai/orchestration/agent.py` ✓ COMPLETED

**Added**:
- Comprehensive DEBUG logging for LLM response analysis
- Response type, content type, and tool_calls debugging
- Tool execution logging with success/failure tracking
- Exception handling with full stack traces

**Log Levels**:
```python
logger.info(f"[AGENT LOOP] Response received from LLM")
logger.debug(f"[AGENT LOOP] Response type: {type(response)}")
logger.debug(f"[AGENT LOOP] response.tool_calls type: {type(response.tool_calls)}")
logger.debug(f"[AGENT LOOP] response.tool_calls bool evaluation: {bool(response.tool_calls)}")
logger.info(f"[AGENT LOOP] Tool calls count: {len(response.tool_calls)}")
logger.debug(f"[AGENT LOOP] Calling _execute_tool_calls()...")
logger.info(f"[AGENT LOOP] Tool execution completed successfully.")
logger.warning(f"[AGENT LOOP] Result errors: {result.errors}")
logger.error(f"[AGENT LOOP] Tool execution failed with exception", exc_info=True)
```

### 2. `src/cycling_ai/providers/openai_provider.py` ✓ COMPLETED

**Added**:
- Tool invocation logging with parameters
- Success/failure tracking for tool execution
- Exception handling with stack traces

**Log Levels**:
```python
logger.debug(f"[OPENAI PROVIDER] invoke_tool called: {tool_name}")
logger.debug(f"[OPENAI PROVIDER] Parameters: {parameters}")
logger.info(f"[OPENAI PROVIDER] Tool {tool_name} executed: success={result.success}")
logger.warning(f"[OPENAI PROVIDER] Tool {tool_name} errors: {result.errors}")
logger.error(f"[OPENAI PROVIDER] Tool {tool_name} execution failed", exc_info=True)
```

### 3. `src/cycling_ai/orchestration/multi_agent.py` ✓ COMPLETED

**Added**:
- Phase execution start/end logging
- Session creation and persistence logging
- Agent execution tracking
- Data extraction logging with keys
- Execution time and token usage tracking
- Exception handling with stack traces

**Log Levels**:
```python
logger.info(f"[PHASE {phase_name.upper()}] Starting execution")
logger.debug(f"[PHASE {phase_name.upper()}] Available tools: {tools}")
logger.debug(f"[PHASE {phase_name.upper()}] Context keys: {list(phase_context.keys())}")
logger.info(f"[PHASE {phase_name.upper()}] Session created: {session.session_id}")
logger.info(f"[PHASE {phase_name.upper()}] Starting agent execution...")
logger.info(f"[PHASE {phase_name.upper()}] Agent completed successfully")
logger.info(f"[PHASE {phase_name.upper()}] Extracted data keys: {list(extracted_data.keys())}")
logger.info(f"[PHASE {phase_name.upper()}] Execution time: {execution_time:.2f}s")
logger.info(f"[PHASE {phase_name.upper()}] Estimated tokens used: {tokens_used}")
logger.info(f"[PHASE {phase_name.upper()}] Status: COMPLETED")
logger.error(f"[PHASE {phase_name.upper()}] Failed with exception: {e}", exc_info=True)
logger.warning(f"[PHASE {phase_name.upper()}] Failed to persist session: {persist_error}")
```

### 4. `src/cycling_ai/providers/gemini_provider.py` ✓ COMPLETED

**Added**:
- Tool invocation logging matching OpenAI provider
- Success/failure tracking
- Exception handling with stack traces

**Log Levels**:
```python
logger.debug(f"[GEMINI PROVIDER] invoke_tool called: {tool_name}")
logger.debug(f"[GEMINI PROVIDER] Parameters: {parameters}")
logger.debug(f"[GEMINI PROVIDER] Tool retrieved from registry: {tool.definition.name}")
logger.info(f"[GEMINI PROVIDER] Tool {tool_name} executed: success={result.success}")
logger.warning(f"[GEMINI PROVIDER] Tool {tool_name} errors: {result.errors}")
logger.error(f"[GEMINI PROVIDER] Tool {tool_name} execution failed: {e}", exc_info=True)
```

### 5. `src/cycling_ai/tools/wrappers/*.py` (TODO - Optional)

**Consider Adding**:
- Tool execution entry/exit logging
- Parameter validation logging
- Result data size/structure logging

**Example**:
```python
logger.debug(f"[TOOL {self.definition.name}] Executing with params: {list(kwargs.keys())}")
logger.info(f"[TOOL {self.definition.name}] Completed: success={result.success}")
```

## Logging Configuration ✓ COMPLETED

### Current State
- Centralized logging configuration in `src/cycling_ai/logging_config.py`
- CLI supports --debug and --log-file flags
- DEBUG level available via command line flag
- File logging captures all DEBUG output while console respects log level

### Implementation

Created `src/cycling_ai/logging_config.py`:

```python
import logging
import sys
from pathlib import Path

def configure_logging(level=logging.INFO, log_file=None):
    """
    Configure logging for cycling-ai.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional file path for log output
    """
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    simple_formatter = logging.Formatter(
        '%(levelname)s - %(message)s'
    )

    # Console handler
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(level)
    console_handler.setFormatter(simple_formatter if level >= logging.INFO else detailed_formatter)

    # File handler (optional)
    handlers = [console_handler]
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)  # Always DEBUG to file
        file_handler.setFormatter(detailed_formatter)
        handlers.append(file_handler)

    # Configure root logger
    logging.basicConfig(
        level=logging.DEBUG,  # Capture everything
        handlers=handlers
    )

    # Set specific log levels for noisy libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('openai').setLevel(logging.WARNING)
    logging.getLogger('anthropic').setLevel(logging.WARNING)
```

### Usage in CLI ✓ IMPLEMENTED

In `src/cycling_ai/cli/main.py`:

```python
from cycling_ai.logging_config import configure_logging
import logging
from pathlib import Path

@click.group()
@click.option('--debug', is_flag=True, help='Enable debug logging (verbose output)')
@click.option('--log-file', type=click.Path(), help='Write logs to file (always DEBUG level)')
@click.pass_context
def cli(ctx: click.Context, config: str | None, debug: bool, log_file: str | None):
    # Configure logging early in CLI startup
    log_level = logging.DEBUG if debug else logging.INFO
    log_file_path = Path(log_file) if log_file else None
    configure_logging(level=log_level, log_file=log_file_path)

    # Store settings in context
    ctx.obj["debug"] = debug
    ctx.obj["log_file"] = log_file_path
```

**Usage Examples:**
```bash
# Normal output (INFO level)
cycling-ai generate --profile profile.json

# Debug output to console
cycling-ai --debug generate --profile profile.json

# Debug output to file only
cycling-ai --log-file logs/debug.log generate --profile profile.json

# Both console debug and file logging
cycling-ai --debug --log-file logs/debug.log generate --profile profile.json
```

## Log Levels Guide

### DEBUG
- Variable types and values
- Response object internals
- Tool parameters and arguments
- Internal state changes
- Data structure contents

**When**: Debugging issues, development

### INFO
- Phase/workflow start/end
- Tool execution start/completion
- Major state transitions
- User-facing progress updates

**When**: Normal operation, user feedback

### WARNING
- Tool execution failures (non-fatal)
- Data validation issues
- Deprecated API usage
- Performance concerns

**When**: Issues that don't stop execution

### ERROR
- Exceptions and stack traces
- Fatal tool failures
- Phase execution failures
- Invalid configuration

**When**: Errors that prevent completion

## Testing Logging

### Quick Test Script

```bash
# Test with DEBUG level
PYTHONPATH=src .venv/bin/python -c "
import logging
from cycling_ai.logging_config import configure_logging

configure_logging(level=logging.DEBUG, log_file='logs/debug_test.log')

# Your test code here
from cycling_ai.tools.registry import get_global_registry
registry = get_global_registry()
"
```

### Verify Logs

```bash
# Watch logs in real-time
tail -f logs/debug_test.log

# Filter for specific levels
grep "ERROR" logs/debug_test.log
grep "\\[AGENT LOOP\\]" logs/debug_test.log
grep "\\[PHASE" logs/debug_test.log
```

## Benefits

1. **Faster Debugging**: See exactly what's happening at each step
2. **Issue Diagnosis**: Identify where workflows hang or fail
3. **Performance Analysis**: Track timing and resource usage
4. **User Support**: Better error messages and troubleshooting
5. **Development**: Understand code flow during implementation

## Next Steps

1. ✓ Complete agent.py logging
2. ✓ Complete OpenAI provider logging
3. ✓ Add multi_agent.py phase logging
4. ✓ Add Gemini provider logging
5. ✓ Create logging configuration module
6. ✓ Update CLI to support --debug flag
7. ⏳ Add logging to tool wrappers (optional)
8. ⏳ Document logging in README

## Summary

All core logging enhancements have been completed:

**Files Modified:**
- `src/cycling_ai/orchestration/agent.py` - Comprehensive agent loop logging
- `src/cycling_ai/orchestration/multi_agent.py` - Phase execution logging
- `src/cycling_ai/providers/openai_provider.py` - Tool execution logging
- `src/cycling_ai/providers/gemini_provider.py` - Tool execution logging
- `src/cycling_ai/logging_config.py` - New centralized logging configuration
- `src/cycling_ai/cli/main.py` - CLI support for --debug and --log-file flags

**Log Coverage:**
- Agent conversation loop (iterations, tool calls, responses)
- Phase execution (start/end, data extraction, timing, tokens)
- Provider tool invocations (OpenAI and Gemini)
- LLM interactions (already logging to JSONL files)
- Exception handling with full stack traces throughout

**Usage:**
```bash
# Test with DEBUG logging to console and file
cycling-ai --debug --log-file logs/test.log generate \
  --profile profile.json \
  --fit-dir activities \
  --output-dir /tmp/test \
  --provider openai \
  --skip-data-prep \
  --period-months 3
```

## Related Issues

- Investigation Report: `INVESTIGATION_REPORT.md`
- Workflow hang issue with OpenAI provider
- Phase 4 data extraction fix
