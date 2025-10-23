# Cycling AI Analysis

Generic AI-powered cycling performance analysis with multi-provider LLM support.

## Overview

This project provides a provider-agnostic framework for cycling performance analysis, supporting multiple LLM providers (OpenAI, Anthropic, Google Gemini, Ollama, and local models).

**Status:** Phase 1 - Core Foundation (In Development)

## Features

- **Multi-Provider Support**: Works with OpenAI, Anthropic, Google Gemini, Ollama, and local models
- **Comprehensive Analysis**: Performance metrics, time-in-zones, training plans, cross-training impact
- **Modern Python**: Built with Python 3.11+, fully typed, tested
- **Clean Architecture**: Separation of business logic, tool abstractions, and provider adapters

## Architecture

```
src/cycling_ai/
├── core/           # Pure business logic (performance, zones, training)
├── tools/          # Tool abstraction layer
└── providers/      # Provider adapter layer
```

## Installation

**Requirements:**
- Python 3.11 or higher
- uv (recommended) or pip

**Install for development:**
```bash
# Using uv (recommended)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"

# Using pip
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

## Development

**Run tests:**
```bash
pytest
```

**Type checking:**
```bash
mypy src/cycling_ai
```

**Linting:**
```bash
ruff check src/cycling_ai
ruff format src/cycling_ai
```

## Project Status

### Phase 1: Core Foundation (Current)
- [x] Project structure
- [ ] Base abstractions (tools, providers)
- [ ] Business logic extraction
- [ ] Testing infrastructure

### Phase 2: Tool Registration (Planned)
- [ ] Tool wrapper implementations
- [ ] Tool registry population
- [ ] Schema generation

### Phase 3: Provider Adapters (Planned)
- [ ] OpenAI adapter
- [ ] Anthropic adapter
- [ ] Google Gemini adapter
- [ ] Ollama/local adapter

## License

[License TBD]

## Contributing

This project is in active development. Contribution guidelines coming soon.
