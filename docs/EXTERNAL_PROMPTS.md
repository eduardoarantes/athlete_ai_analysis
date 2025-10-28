# External Prompt Management

This document describes the external prompt loading system for multi-agent workflows in the cycling-ai-analysis project.

## Overview

The system allows prompts to be stored in external files organized by model and version, making it easy to:
- Version control prompts independently from code
- Customize prompts for different LLM models
- Iterate on prompts without code changes
- Share and compare prompt strategies

## Directory Structure

```
prompts/
├── default/
│   └── 1.0/
│       ├── metadata.json
│       ├── data_preparation.txt
│       ├── performance_analysis.txt
│       ├── training_planning.txt
│       └── report_generation.txt
├── gemini/
│   └── 1.0/
│       ├── metadata.json
│       └── ...
└── gpt4/
    └── 2.0/
        ├── metadata.json
        └── ...
```

### Directory Levels

1. **Model directory** (`default`, `gemini`, `gpt4`, etc.)
   - Represents the target LLM model or strategy
   - Use `default` for general-purpose prompts

2. **Version directory** (`1.0`, `1.1`, `2.0`, etc.)
   - Semantic versioning for prompt iterations
   - Allows A/B testing and rollback

3. **Prompt files** (`.txt` files)
   - **System prompts**: `{agent_name}.txt` - Defines agent role and expertise
   - **User prompts**: `{agent_name}_user.txt` - Task instructions with template variables
   - Plain text format
   - UTF-8 encoding

4. **Metadata file** (`metadata.json`)
   - Describes the prompt set
   - Lists available agents
   - References both system and user prompt files

## Metadata Format

Each prompt version requires a `metadata.json` file:

```json
{
  "model": "default",
  "version": "1.0",
  "description": "Default multi-agent workflow prompts",
  "created": "2025-10-28",
  "agents": {
    "data_preparation": {
      "file": "data_preparation.txt",
      "user_file": "data_preparation_user.txt",
      "description": "Data validation and preparation specialist"
    },
    "performance_analysis": {
      "file": "performance_analysis.txt",
      "user_file": "performance_analysis_user.txt",
      "description": "Cycling performance analysis expert"
    },
    "training_planning": {
      "file": "training_planning.txt",
      "user_file": "training_planning_user.txt",
      "description": "Training plan design specialist"
    },
    "report_generation": {
      "file": "report_generation.txt",
      "user_file": "report_generation_user.txt",
      "description": "Report generation specialist"
    }
  }
}
```

## Usage

### Programmatic Usage

```python
from cycling_ai.orchestration.prompts import AgentPromptsManager

# Use default model/version
manager = AgentPromptsManager()

# Specify model and version
manager = AgentPromptsManager(model="gemini", version="1.0")

# Get system prompts (defines agent role and expertise)
data_prompt = manager.get_data_preparation_prompt()
analysis_prompt = manager.get_performance_analysis_prompt()
planning_prompt = manager.get_training_planning_prompt()
report_prompt = manager.get_report_generation_prompt()

# Get user prompts (task instructions with variables)
user_prompt = manager.get_data_preparation_user_prompt(
    csv_file_path="/path/to/activities.csv",
    athlete_profile_path="/path/to/profile.json",
    fit_dir_path="/path/to/fit"
)

analysis_user_prompt = manager.get_performance_analysis_user_prompt(
    period_months=6
)

planning_user_prompt = manager.get_training_planning_user_prompt(
    training_plan_weeks=12
)

report_user_prompt = manager.get_report_generation_user_prompt(
    output_dir="/tmp/reports"
)
```

### Direct PromptLoader Usage

```python
from cycling_ai.orchestration.prompt_loader import PromptLoader, get_prompt_loader

# Create loader with defaults
loader = get_prompt_loader()

# Or specify model/version
loader = PromptLoader(model="gemini", version="1.0")

# Check if prompts exist
if loader.exists():
    # Load metadata
    metadata = loader.load_metadata()

    # Load specific prompt
    prompt = loader.load_prompt("performance_analysis")

    # Load all prompts
    all_prompts = loader.load_all_prompts()
```

### List Available Prompts

```python
from cycling_ai.orchestration.prompt_loader import PromptLoader

# List all models
models = PromptLoader.list_available_models()
# Returns: ['default', 'gemini', 'gpt4']

# List versions for a model
versions = PromptLoader.list_available_versions("gemini")
# Returns: ['1.0', '1.1', '2.0']
```

## Fallback Behavior

The system provides robust fallback behavior:

1. **First attempt**: Load from external files using PromptLoader
2. **Fallback**: Use embedded prompts from `prompts.py`

This ensures the system always works even if external prompt files are missing.

## Testing

Run the test suite to verify prompt loading:

```bash
.venv/bin/python scripts/test_prompt_loading.py
```

The test suite verifies:
- PromptLoader can find and load external prompts
- AgentPromptsManager correctly uses PromptLoader
- Fallback to embedded prompts works
- Model and version listing functions work

## Creating New Prompt Versions

### 1. Create Directory Structure

```bash
mkdir -p prompts/gemini/1.0
```

### 2. Create metadata.json

```json
{
  "model": "gemini",
  "version": "1.0",
  "description": "Gemini-optimized prompts",
  "created": "2025-10-28",
  "agents": {
    "data_preparation": {
      "file": "data_preparation.txt",
      "description": "Data validation specialist"
    },
    ...
  }
}
```

### 3. Create Prompt Files

Create `.txt` files for each agent:
- `data_preparation.txt`
- `performance_analysis.txt`
- `training_planning.txt`
- `report_generation.txt`

### 4. Test Your Prompts

```python
from cycling_ai.orchestration.prompts import AgentPromptsManager

manager = AgentPromptsManager(model="gemini", version="1.0")
prompt = manager.get_data_preparation_prompt()
print(prompt)
```

## Best Practices

1. **Version your prompts**: Use semantic versioning (1.0, 1.1, 2.0)
2. **Document changes**: Update metadata.json description with changes
3. **Test thoroughly**: Run test suite after creating new prompts
4. **Keep backups**: Don't delete old versions immediately
5. **Model-specific tuning**: Create separate model directories for different LLMs
6. **Clear structure**: Use consistent formatting in prompt files
7. **UTF-8 encoding**: Always use UTF-8 for prompt files

## Prompt Writing Guidelines

When creating or modifying prompts:

1. **Clear role definition**: Start with who the agent is
2. **Specific expertise**: List the agent's areas of knowledge
3. **Clear objectives**: Define what the agent should accomplish
4. **Tool awareness**: List available tools explicitly
5. **Output requirements**: Specify expected output format
6. **Guidelines**: Provide operational constraints and best practices

Example structure:
```
You are a [role description].

**Your Role:**
[1-2 sentence description]

**Expertise:**
- Area 1
- Area 2

**Objectives:**
1. Objective 1
2. Objective 2

**Available Tools:**
- tool_name: Description

**Output Requirements:**
- Requirement 1
- Requirement 2

**Guidelines:**
- Guideline 1
- Guideline 2
```

## Integration with CLI

Currently, the system uses default model/version automatically. Future enhancements may include:

```bash
# Specify prompt version in CLI
cycling-ai generate \
  --csv activities.csv \
  --profile athlete.json \
  --prompt-model gemini \
  --prompt-version 1.0
```

## Architecture

```
┌─────────────────────────────────────┐
│     AgentPromptsManager             │
│  (High-level prompt management)     │
└──────────────┬──────────────────────┘
               │
               ├──> Try PromptLoader (external files)
               │    └─> prompts/{model}/{version}/
               │
               └──> Fallback to embedded prompts
                    └─> DATA_PREPARATION_PROMPT, etc.
```

## Related Files

- `src/cycling_ai/orchestration/prompt_loader.py` - PromptLoader class
- `src/cycling_ai/orchestration/prompts.py` - AgentPromptsManager class
- `scripts/test_prompt_loading.py` - Test suite
- `prompts/` - External prompt files

## Future Enhancements

Potential improvements:
1. CLI flags for model/version selection
2. Prompt validation and linting
3. Prompt performance metrics tracking
4. A/B testing framework
5. Prompt template system with variables
6. Web UI for prompt editing
