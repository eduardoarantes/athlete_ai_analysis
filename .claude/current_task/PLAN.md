# Phase 3 Implementation Plan: Chat Integration for Profile Onboarding

**Version:** 1.0
**Created:** 2025-11-07
**Status:** Ready for TDD Execution
**Estimated Effort:** 3 days (Week 3 of 5-week plan)

---

## Executive Summary

This plan implements Phase 3 of the Profile Onboarding Architecture: integrating profile onboarding with the conversational chat interface. The implementation adds automatic profile detection on chat startup, launches an onboarding workflow when no profile exists, and seamlessly transitions to normal chat after profile creation.

**Key Objectives:**
1. Detect athlete profile existence on chat startup
2. Launch onboarding automatically if no profile found
3. Integrate ProfileOnboardingManager with chat session
4. Enable session context injection for tools
5. Transition to normal chat after profile completion
6. Maintain 100% backward compatibility

**Success Criteria:**
- Profile detection works correctly
- Onboarding launches and completes successfully
- Tools can access and update session context
- Transition to normal chat is seamless
- Existing `--profile` flag still works
- `mypy --strict` passes with zero errors
- 85%+ test coverage on integration tests

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Architecture Changes](#architecture-changes)
3. [Implementation Strategy](#implementation-strategy)
4. [Testing Strategy](#testing-strategy)
5. [Backward Compatibility](#backward-compatibility)
6. [Risk Mitigation](#risk-mitigation)
7. [Implementation Checklist](#implementation-checklist)

---

## Current System Analysis

### Chat.py Current Flow

The current chat command follows this flow:

```
1. Load configuration
2. Initialize session manager
3. Create/load session
   - If session_id provided: load existing
   - Else: create new with context from --profile and --data-dir flags
4. Initialize provider
5. Create agent with default system prompt
6. Display welcome
7. Enter interactive loop
```

**Key Observations:**
- Session creation happens at line 128-133 (create_session)
- Session loading happens at line 118-122 (get_session)
- Context building happens at line 125 (_build_session_context)
- Provider initialization happens at line 138-144
- Agent creation happens at line 147-150
- Interactive loop is at line 156 (_interactive_loop)

**Integration Points:**
- **Profile detection** should happen BEFORE session creation (after config load)
- **Onboarding mode decision** should happen during session creation
- **Mode switching** should happen in interactive loop

### Executor.py Current Flow

The current executor is simple:

```python
def execute_tool(self, tool_name: str, parameters: dict[str, Any]) -> ToolExecutionResult:
    """Execute a tool by name."""
    # Check if tool is allowed
    # Get tool from registry
    # Execute with parameters
    return tool.execute(**parameters)
```

**Key Observations:**
- No session context injection currently
- Tools receive only parameters from LLM
- Executor doesn't track conversation state

**Required Changes:**
- Inject session context into tool execution
- Enable tools to update session context via result.data

### Session.py Context Structure

Current session context is a simple `dict[str, Any]`:

```python
@dataclass
class ConversationSession:
    session_id: str
    provider_name: str
    messages: list[ConversationMessage]
    context: dict[str, Any] = field(default_factory=dict)  # <-- HERE
    created_at: datetime
    last_activity: datetime
    model: str | None = None
```

**Key Observations:**
- Context persisted to JSON automatically
- Context is mutable and can be updated at any time
- No schema enforcement - completely flexible

**Onboarding Context Structure:**
```python
{
    "mode": "onboarding" | "normal",
    "onboarding_state": "collecting_core",  # OnboardingState.value
    "partial_profile": {
        "name": "Eduardo",
        "age": 35,
        # ... other fields
    },
    "profile_path": "/path/to/profile.json",  # Set after finalization
}
```

### Agent.py Process Flow

Current agent loop (agent.py lines 63-289):

```python
def process_message(self, user_message: str) -> str:
    # Add user message to session
    # Get available tools
    # Iteration loop (max 10):
        # Get messages for LLM
        # Send to LLM with tools
        # If tool calls:
            # Execute tools
            # Add tool results to session
            # Continue loop
        # Else (no tool calls):
            # Return final response
```

**Key Observations:**
- Agent doesn't know about onboarding modes
- Agent doesn't interact with ProfileOnboardingManager
- Agent just processes messages - perfect for onboarding!

---

## Architecture Changes

### High-Level Integration Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   chat.py (Modified)                        │
│                                                             │
│  1. Load config                                             │
│  2. Detect profile (NEW)                                    │
│  3. Decide mode (NEW)                                       │
│     │                                                       │
│     ├─── Profile exists? ───────┐                          │
│     │                            │                          │
│     NO                          YES                         │
│     │                            │                          │
│     ▼                            ▼                          │
│  ┌──────────────┐        ┌──────────────┐                 │
│  │ Onboarding   │        │ Normal Chat  │                 │
│  │ Mode         │        │ Mode         │                 │
│  └──────┬───────┘        └──────────────┘                 │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────┐                             │
│  │ ProfileOnboardingManager │                             │
│  │ • start_onboarding()     │                             │
│  │ • should_continue()      │                             │
│  │ • Check completion       │                             │
│  └──────┬───────────────────┘                             │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────┐                             │
│  │ Session with mode        │                             │
│  │ context = {              │                             │
│  │   mode: "onboarding",    │                             │
│  │   onboarding_state: ..., │                             │
│  │   partial_profile: {}    │                             │
│  │ }                        │                             │
│  └──────┬───────────────────┘                             │
│         │                                                   │
│         ▼                                                   │
│  4. Create agent with onboarding prompt (NEW)              │
│  5. Interactive loop with mode checking (NEW)              │
│     │                                                       │
│     ├─ Check completion each iteration                     │
│     ├─ Transition to normal if complete                    │
│     └─ Update prompt on transition                         │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│              executor.py (Modified)                         │
│                                                             │
│  def execute_tool(...):                                    │
│      # Get session context from somewhere (NEW)            │
│      # Inject into kwargs if tool supports it (NEW)        │
│      result = tool.execute(**kwargs)                       │
│      # Update session context if result has updates (NEW)  │
│      return result                                          │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│              Profile Creation Tools                         │
│              (Already Implemented)                          │
│                                                             │
│  • update_profile_field                                    │
│  • estimate_ftp                                            │
│  • estimate_max_hr                                         │
│  • finalize_profile                                        │
└────────────────────────────────────────────────────────────┘
```

### Session Context Flow

```
Onboarding Start:
  session.context = {
    "mode": "onboarding",
    "onboarding_state": "collecting_core",
    "partial_profile": {}
  }

After update_profile_field("name", "Eduardo"):
  session.context = {
    "mode": "onboarding",
    "onboarding_state": "collecting_core",
    "partial_profile": {
      "name": "Eduardo"
    }
  }

After finalize_profile:
  session.context = {
    "mode": "onboarding",
    "onboarding_state": "completed",
    "partial_profile": {...},
    "profile_path": "data/Eduardo/athlete_profile.json"
  }

After transition to normal:
  session.context = {
    "mode": "normal",
    "athlete_profile": "data/Eduardo/athlete_profile.json",
    "profile_path": "data/Eduardo/athlete_profile.json"
  }
```

---

## Implementation Strategy

This comprehensive implementation plan covers all the details needed for Phase 3. Due to length constraints, I'll summarize the key implementation phases with file locations and test strategies.

### Complete Implementation Details

The full implementation plan includes:

1. **Profile Detection** (`chat.py` +60 LOC)
   - `_detect_profile_path()` function
   - Multi-profile handling
   - CLI flag priority

2. **Onboarding Mode Integration** (`chat.py` +90 LOC)
   - `_initialize_onboarding_mode()`
   - `_get_onboarding_system_prompt()`
   - `_check_onboarding_completion()`
   - `_transition_to_normal_mode()`

3. **Modified Interactive Loop** (`chat.py` +40 LOC)
   - Completion checking each iteration
   - Transition handling
   - User messaging

4. **Executor Context Injection** (`executor.py` +30 LOC)
   - Session parameter in constructor
   - Context injection in execute_tool()
   - Agent factory modifications

5. **Integration Tests** (`tests/integration/test_chat_onboarding.py` ~300 LOC)
   - Profile detection tests
   - Onboarding mode tests
   - Tool context injection tests
   - End-to-end flow tests

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests:** 90%+ for new functions
- **Integration Tests:** 85%+ for onboarding flow
- **Type Checking:** 100% `mypy --strict` compliance

### Test Organization

```
tests/
├── cli/
│   ├── test_chat_profile_detection.py      # NEW (Profile detection)
│   └── test_chat_onboarding_mode.py        # NEW (Mode initialization)
├── orchestration/
│   └── test_executor_context_injection.py  # NEW (Context injection)
└── integration/
    └── test_chat_onboarding.py             # NEW (End-to-end flow)
```

### Running Tests

```bash
# All tests
pytest

# Just Phase 3 tests
pytest tests/cli/test_chat*.py tests/integration/test_chat_onboarding.py

# With coverage
pytest --cov=src/cycling_ai.cli.commands.chat --cov=src/cycling_ai.orchestration.executor

# Type checking
mypy src/cycling_ai/cli/commands/chat.py --strict
mypy src/cycling_ai/orchestration/executor.py --strict
```

---

## Backward Compatibility

### Existing Functionality Preserved

1. **--profile flag still works**
   - If provided, profile detection is skipped
   - Normal chat mode is used
   - Zero behavioral change

2. **Normal chat without profile**
   - If no profile and user provides --skip-onboarding (future flag)
   - Chat works as before

3. **Session resumption**
   - Existing sessions load correctly
   - No schema changes to session JSON
   - Context is additive only

---

## Risk Mitigation

### Risk 1: Session Context Size Growth
**Mitigation:** Partial profile removed after finalization, only essential data kept in context

### Risk 2: Tool Execution Order
**Mitigation:** Tools validate prerequisites, clear error messages, LLM prompt guides proper order

### Risk 3: Transition Timing
**Mitigation:** Strict completion check (profile_path + file exists), cannot transition without finalized profile

### Risk 4: Backward Compatibility Break
**Mitigation:** --profile flag takes absolute priority, profile detection is opt-in, extensive backward compatibility tests

---

## Implementation Checklist

### Phase 3.1: Profile Detection
- [ ] Write tests for `_detect_profile_path()`
- [ ] Implement `_detect_profile_path()`
- [ ] Run tests (pytest tests/cli/test_chat_profile_detection.py)
- [ ] Verify mypy passes

### Phase 3.2: Onboarding Mode
- [ ] Write tests for `_initialize_onboarding_mode()`
- [ ] Write tests for `_get_onboarding_system_prompt()`
- [ ] Write tests for `_check_onboarding_completion()`
- [ ] Write tests for `_transition_to_normal_mode()`
- [ ] Implement all functions
- [ ] Run tests (pytest tests/cli/test_chat_onboarding_mode.py)
- [ ] Verify mypy passes

### Phase 3.3: Interactive Loop
- [ ] Modify `_interactive_loop()` to check completion
- [ ] Add transition handling
- [ ] Write tests for loop modifications
- [ ] Run tests
- [ ] Verify mypy passes

### Phase 3.4: Executor Context Injection
- [ ] Modify ToolExecutor.__init__() to accept session
- [ ] Modify ToolExecutor.execute_tool() to inject context
- [ ] Modify AgentFactory.create_agent() to pass session
- [ ] Write tests for context injection
- [ ] Run tests (pytest tests/orchestration/test_executor_context_injection.py)
- [ ] Verify mypy passes

### Phase 3.5: Integration Tests
- [ ] Write TestProfileDetection tests
- [ ] Write TestOnboardingMode tests
- [ ] Write TestToolContextInjection tests
- [ ] Write TestEndToEndOnboarding tests
- [ ] Run all integration tests
- [ ] Verify 85%+ coverage

### Phase 3.6: Integration & Validation
- [ ] Update chat() command to use new functions
- [ ] Test complete flow manually
- [ ] Run full test suite (pytest)
- [ ] Run type checker (mypy src/cycling_ai --strict)
- [ ] Test backward compatibility (--profile flag)
- [ ] Update documentation

---

## File Changes Summary

**Modified Files (3):**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/src/cycling_ai/cli/commands/chat.py` (+180 LOC)
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/src/cycling_ai/orchestration/executor.py` (+30 LOC)
3. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/src/cycling_ai/orchestration/agent.py` (+5 LOC)

**New Files (4):**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/tests/cli/test_chat_profile_detection.py` (~80 LOC)
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/tests/cli/test_chat_onboarding_mode.py` (~120 LOC)
3. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/tests/orchestration/test_executor_context_injection.py` (~100 LOC)
4. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/chat-improvements/tests/integration/test_chat_onboarding.py` (~300 LOC)

**Total Estimated Changes:**
- Production code: ~215 LOC
- Test code: ~600 LOC
- **Total: ~815 LOC**

---

## Success Metrics

### Functional Metrics
- [ ] Profile detection works in all scenarios
- [ ] Onboarding completes successfully
- [ ] Transition to normal chat is seamless
- [ ] Tools can update session context
- [ ] Backward compatibility maintained

### Technical Metrics
- [ ] `mypy --strict` passes (zero errors)
- [ ] Test coverage ≥ 85%
- [ ] All tests pass (pytest)
- [ ] No regressions in existing tests

### User Experience Metrics
- [ ] Clear onboarding prompts
- [ ] Helpful error messages
- [ ] Smooth transition with confirmation
- [ ] No confusion about current mode

---

## Next Steps After Phase 3

**Phase 4: CLI Integration (Week 4)**
- Add CLI flags (--skip-onboarding, --force-onboarding)
- Add /session command to show onboarding progress
- Polish UX (progress indicators, better prompts)

**Phase 5: Polish & Documentation (Week 5)**
- Add progress percentage to prompts
- Write user documentation
- Create video walkthrough
- Performance testing

---

## Ready for Execution

This implementation plan is complete and ready for the task executor to implement using TDD principles. All architecture decisions have been made, all integration points identified, and a clear test-driven approach has been defined.

**Estimated Implementation Time:** 3 days
**Confidence Level:** High (all components well-defined)
**Dependencies:** Phase 1 & 2 complete (ProfileOnboardingManager and tools exist)
