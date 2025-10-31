# Console Display Flickering Fix

## Problem

During workflow execution with the `generate` command, the console progress display was flickering and showing repeated "Phase" / "Status" headers:

```
 Phase                           Status
 Phase                           Status
 Phase                           Status
 Phase                           Status
 Phase                           Status
 Phase                           Status
 Data Preparation                ⏳ Pending
 Performance Analysis            ⏳ Pending
 Phase                           Status
```

## Root Cause

The issue was caused by **concurrent writes to stderr** from two sources:

1. **Rich Live Display**: The `Live` context manager from Rich library manages a continuously updating table display
2. **Console Logging**: The logging system (`logging.StreamHandler`) was configured to write INFO-level messages to stderr

When orchestration code logged messages like:
```
INFO - [PHASE DATA_PREPARATION] Starting direct execution (no LLM)
```

These log messages interfered with Rich's Live display, causing:
- Repeated table headers
- Flickering output
- Visual corruption of the progress display

## Solution

**File**: `src/cycling_ai/cli/commands/generate.py:380-398`

Temporarily suppress INFO/DEBUG console logging during the Live display by:

1. **Before Live Display**: Find all console handlers and raise their level to WARNING
2. **During Live Display**: Only WARNING+ messages appear (errors/warnings still visible)
3. **After Live Display**: Restore original logging levels

### Implementation

```python
# Temporarily suppress console logging during Live display to prevent flickering
root_logger = logging.getLogger()
console_handlers = [h for h in root_logger.handlers if isinstance(h, logging.StreamHandler) and h.stream.name == '<stderr>']
original_levels = {}

# Store original levels and set to WARNING (suppress INFO/DEBUG)
for handler in console_handlers:
    original_levels[handler] = handler.level
    handler.setLevel(logging.WARNING)

try:
    with Live(phase_tracker.get_table(), refresh_per_second=4, console=console) as live:
        # Update live display reference in phase tracker
        phase_tracker._live = live
        result = orchestrator.execute_workflow(workflow_config)
finally:
    # Restore original logging levels
    for handler, level in original_levels.items():
        handler.setLevel(level)
```

## Benefits

1. **Clean Display**: Live progress table updates smoothly without interference
2. **Critical Messages Preserved**: WARNING and ERROR messages still appear during execution
3. **Reversible**: Original logging levels restored after Live display completes
4. **Safe**: try/finally ensures restoration even if workflow crashes

## Before vs After

### Before (Flickering):
```
 Phase                           Status
 Phase                           Status
INFO - [PHASE DATA_PREPARATION] Starting direct execution
 Phase                           Status
 Performance Analysis            ⏳ Pending
INFO - [PHASE PERFORMANCE_ANALYSIS] Starting execution
 Phase                           Status
```

### After (Clean):
```
 Phase                           Status
 Data Preparation                ✓ Completed
 Performance Analysis            ⏳ In Progress
 Training Planning               ⏳ Pending
 Report Data Preparation         ⏳ Pending
 Report Generation               ⏳ Pending
```

## Alternative Solutions Considered

1. **RichHandler**: Use Rich's logging handler instead of StreamHandler
   - **Pros**: Integrates well with Rich display
   - **Cons**: Would require changing logging_config.py, affects all commands

2. **Redirect stderr**: Temporarily redirect stderr to /dev/null
   - **Pros**: Simple
   - **Cons**: Would also hide error messages, too aggressive

3. **File-only logging**: Disable console logging entirely during workflow
   - **Pros**: Guaranteed no interference
   - **Cons**: Loses all console feedback, bad UX for errors

**Chosen Solution (#1 above)** provides the best balance of clean display while preserving important error messages.

## Related Files

- `src/cycling_ai/cli/commands/generate.py` - Command implementation
- `src/cycling_ai/logging_config.py` - Logging configuration
- `src/cycling_ai/orchestration/multi_agent.py` - Workflow orchestration (emits the logs)
