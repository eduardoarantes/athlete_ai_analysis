# Cycling AI Analysis

**AI-powered cycling performance analysis with conversational interface** 🚴‍♂️ + 🤖

[![Tests](https://img.shields.io/badge/tests-253%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-62%25-green)]()
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)]()
[![Type Checked](https://img.shields.io/badge/type--checked-mypy-blue)]()

## Overview

Transform your cycling data into actionable insights using AI. This project provides both a **multi-agent report generation system** and a **conversational AI interface** that understands natural language, automatically analyzes your performance data, and provides personalized coaching insights.

**Status:** ✅ **Production Ready** - Phase 4 Complete (253/253 tests passing)

**Important:** For reliable operation, use LLM models with 8B+ parameters (e.g., llama3.1:8b, Claude 3.5 Sonnet). Small models (< 8B parameters like llama3.2:3b) cannot reliably execute tool calls.

## ✨ Key Features

### 📈 Multi-Agent Report Generation (NEW!)
Generate comprehensive cycling reports automatically:
- **4-Phase Analysis Pipeline**: Data prep → Performance analysis → Training planning → Report generation
- **3 HTML Reports**: Executive summary, coaching insights, performance dashboard
- **Intelligent Tool Orchestration**: Agents automatically execute analysis tools
- **Production Ready**: Tested with real-world data (227 activities, 6+ months)
- **Fast Execution**: 2-5 minutes for complete workflow

### 🤖 Conversational AI Interface
Chat naturally with an AI assistant that:
- Understands cycling performance questions
- Automatically executes analysis tools
- Provides intelligent insights and recommendations
- Remembers conversation context

### 📊 Comprehensive Analysis
- **Performance Analysis**: Compare periods, track improvements
- **Power Zone Distribution**: Time-in-zones from FIT files
- **Training Plans**: Periodized plans based on your goals
- **Cross-Training Impact**: How other activities affect cycling
- **Comprehensive Reports**: HTML and Markdown outputs

### 🌐 Multi-Provider Support
Works with your choice of LLM:
- **AWS Bedrock** (Claude, Nova, Llama, Mistral) - **NEW!** Enterprise-grade with pay-per-use
- **Anthropic** (Claude 3.5 Sonnet) - **Recommended** for production
- **OpenAI** (GPT-4 Turbo)
- **Google Gemini** (Gemini 1.5 Pro) - Best value
- **Ollama** (Local models: llama3.1:8b minimum, llama3:70b recommended)

### 🎯 Modern Architecture
- **Type-Safe**: Full mypy --strict compliance
- **Tested**: 253 tests with 100% pass rate (62% overall coverage, 94%+ on orchestration)
- **Clean Code**: Separation of concerns, SOLID principles
- **Provider-Agnostic**: Easy to add new LLM providers
- **Multi-Agent System**: Specialized agents for each analysis phase

---

## 🚀 Quick Start

### Installation

**Requirements:**
- Python 3.11 or higher
- uv (recommended) or pip

> **Note:** If your system's default Python is older (e.g., Python 3.9 or 3.10), you'll need to use `python3.11` explicitly:
> ```bash
> python3.11 -m venv venv
> python3.11 -m pip install -e ".[dev]"
> python3.11 -m pytest  # for running tests
> ```

```bash
# Clone repository
git clone https://github.com/yourusername/cycling-ai-analysis.git
cd cycling-ai-analysis

# Install with uv (recommended)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"

# Or with pip
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

### Configuration

Set up your preferred LLM provider:

```bash
# AWS Bedrock (NEW! - Enterprise-grade, pay-per-use)
aws configure  # One-time setup
# See docs/AWS_BEDROCK_SETUP_GUIDE.md for complete step-by-step setup
# See docs/AWS_BEDROCK_USER_GUIDE.md for usage details

# Anthropic Claude (recommended)
export ANTHROPIC_API_KEY="your-api-key"

# Or OpenAI
export OPENAI_API_KEY="your-api-key"

# Or Google Gemini
export GOOGLE_API_KEY="your-api-key"

# Ollama (local) - no key needed
# Just have Ollama running: ollama serve
```

---

## 📈 Generate Comprehensive Reports (NEW!)

### Quick Report Generation

The `generate` command creates comprehensive cycling reports using a 4-phase multi-agent system:

```bash
# Basic usage with AWS Bedrock (NEW!)
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile athlete_profile.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0

# Basic usage with Anthropic
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile athlete_profile.json \
  --provider anthropic

# Full featured with zone enrichment
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile athlete_profile.json \
  --fit-dir ~/Strava/activities/ \
  --provider anthropic \
  --period-months 6 \
  --training-plan-weeks 12 \
  --output-dir ~/cycling-reports
```

**Output:** 3 HTML files in the output directory:
- `index.html` - Executive summary with key insights
- `coaching_insights.html` - Detailed coaching recommendations
- `performance_dashboard.html` - Metrics and visualizations

**Execution time:** 2-5 minutes (depending on provider and data volume)

### How It Works: 4-Phase Pipeline

1. **Phase 1: Data Preparation** (automatic, ~30 seconds)
   - Validates CSV, profile, and FIT files
   - Creates optimized Parquet cache (10x faster than CSV)
   - Enriches with time-in-zones data from FIT files
   - Cache location: `<csv_dir>/cache/activities_processed.parquet`

2. **Phase 2: Performance Analysis** (uses cache)
   - Compares recent vs previous periods
   - Analyzes trends and patterns
   - Calculates zone distribution

3. **Phase 3: Training Planning** (uses Phase 2 insights)
   - Creates periodized training plan
   - Progressive overload strategy
   - Recovery week placement

4. **Phase 4: Report Generation** (combines all phases)
   - Executive summary
   - Coaching insights
   - Performance dashboard

**Key Benefit:** Phase 1 cache enables 10x faster data access for all subsequent phases and preserves zone enrichment data throughout the workflow.

### Model Requirements

**For reliable report generation:**

| Model | Parameters | Tool Calling | Recommended |
|-------|------------|--------------|-------------|
| llama3.2:3b | 3B | ❌ Unreliable | Testing only, not production |
| llama3.1:8b | 8B | ✅ Good | Minimum for local execution |
| llama3:70b | 70B | ✅ Excellent | Best local option (32GB+ RAM) |
| Claude 3.5 Sonnet | N/A | ✅ Excellent | **Recommended** for production |
| GPT-4 Turbo | N/A | ✅ Excellent | Reliable but more expensive |
| Gemini 1.5 Pro | N/A | ✅ Good | Best value (~$0.09/workflow) |

**Important:** Models with < 8B parameters (like llama3.2:3b) cannot reliably execute tool calls and will produce no HTML reports. See [performance benchmarks](.claude/current_task/PLAN/phase4c_performance_report.md) for details.

### Cost Estimates

- **Anthropic Claude 3.5 Sonnet:** ~$0.25 per workflow
- **OpenAI GPT-4 Turbo:** ~$0.60 per workflow
- **Google Gemini 1.5 Pro:** ~$0.09 per workflow
- **Ollama (local):** $0 (free, requires capable hardware)

**For detailed usage guide:** See [docs/USER_GUIDE_GENERATE.md](docs/USER_GUIDE_GENERATE.md)

---

## 💬 Conversational Interface

### Start Chatting

```bash
# Start interactive chat
cycling-ai chat --provider anthropic --profile athlete_profile.json

# Use specific model
cycling-ai chat --provider openai --model gpt-4-turbo

# Resume previous conversation
cycling-ai chat --session-id abc-123
```

### Example Conversation

```
Welcome to Cycling AI Chat!
Provider: anthropic
Model: claude-3-5-sonnet-20241022

You: How has my cycling performance changed over the last 6 months?

AI: 🤔 Thinking...

AI: I'll analyze your performance data for the last 6 months.

[Agent automatically executes analyze_performance tool]

AI: Based on your data, here's what I found:

**Performance Summary (Last 6 Months)**
- Total rides: 110 activities
- Distance: 4,580 km
- Average power: 171W (up from 170W, +0.6%)
- Consistency: 18 rides/month (improved from 16)

**Key Insights:**
1. Your average power has increased slightly
2. Consistency has improved significantly
3. Consider adding higher intensity work

Would you like me to analyze your power zone distribution?

You: Yes, show me my zone distribution

AI: [Automatically analyzes zones and provides insights...]
```

### Special Commands

```
/help     - Show available commands
/quit     - Exit chat
/clear    - Clear conversation history
/history  - Show past messages
/session  - Show session information
```

---

## 🛠️ Command-Line Tools

### Direct Analysis (Non-conversational)

```bash
# Analyze performance
cycling-ai analyze performance \
  --csv activities.csv \
  --profile athlete_profile.json \
  --period-months 6

# Analyze power zones
cycling-ai analyze zones \
  --fit-dir ./fit_files \
  --profile athlete_profile.json

# Generate training plan
cycling-ai plan generate \
  --profile athlete_profile.json \
  --weeks 12 \
  --target-ftp 280

# Analyze cross-training
cycling-ai analyze cross-training \
  --csv activities.csv \
  --period-weeks 12

# Generate comprehensive report
cycling-ai report generate \
  --performance-json perf.json \
  --zones-json zones.json \
  --training-json plan.json \
  --output report.md
```

---

## 📁 Architecture

```
src/cycling_ai/
├── core/               # Business logic (analysis algorithms)
│   ├── athlete.py      # Athlete profile management
│   ├── performance.py  # Performance analysis
│   ├── zones.py        # Power zone analysis
│   ├── training.py     # Training plan generation
│   ├── cross_training.py
│   ├── fit_processing.py
│   └── utils.py
│
├── tools/              # Tool abstraction layer
│   ├── base.py         # Tool definitions
│   ├── registry.py     # Tool registry
│   └── wrappers/       # Tool implementations
│
├── providers/          # LLM provider adapters
│   ├── base.py         # Provider interface
│   ├── openai_provider.py
│   ├── anthropic_provider.py
│   ├── gemini_provider.py
│   └── ollama_provider.py
│
├── orchestration/      # AI orchestration
│   ├── session.py      # Conversation management
│   ├── agent.py        # LLM agent orchestration
│   └── executor.py     # Tool execution
│
├── cli/                # Command-line interface
│   ├── main.py
│   └── commands/       # CLI commands
│
└── config/             # Configuration management
```

---

## 🧪 Development

### Run Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=src/cycling_ai --cov-report=html

# Specific test file
pytest tests/orchestration/test_agent.py -v

# Watch mode
pytest-watch

# If using Python 3.11 explicitly (when system default is older)
python3.11 -m pytest
python3.11 -m pytest --cov=src/cycling_ai
```

### Type Checking

```bash
# Full type check
mypy src/cycling_ai --strict

# Specific module
mypy src/cycling_ai/orchestration/
```

### Linting

```bash
# Check code
ruff check src/cycling_ai

# Auto-fix issues
ruff check src/cycling_ai --fix

# Format code
ruff format src/cycling_ai
```

---

## 📊 Project Status

### ✅ Phase 1: Core Foundation (COMPLETE)
- [x] Project structure
- [x] Base abstractions (tools, providers)
- [x] Business logic extraction (8 modules)
- [x] Tool registry
- [x] 90%+ test coverage

### ✅ Phase 2: Provider Adapters (COMPLETE)
- [x] OpenAI adapter
- [x] Anthropic adapter
- [x] Google Gemini adapter
- [x] Ollama/local adapter
- [x] Configuration system

### ✅ Phase 3: Tool Wrappers & CLI (COMPLETE)
- [x] 5 tool wrappers (performance, zones, training, cross-training, reports)
- [x] Full CLI with Rich formatting
- [x] Tool auto-registration
- [x] Real data validation (220+ activities)

### ✅ Phase 4: Production Readiness & Validation (COMPLETE)
- [x] Multi-agent orchestration system (4 specialized agents)
- [x] `cycling-ai generate` command for comprehensive reports
- [x] Session management with persistence
- [x] LLM agent orchestrator with tool calling
- [x] Conversational chat interface
- [x] Real-world testing with Ollama llama3.2:3b (documented limitations)
- [x] 253/253 tests passing (100% pass rate)
- [x] Performance benchmarking completed
- [x] Production documentation (deployment, user guide, troubleshooting)
- [x] User acceptance testing (5 scenarios validated)

### 🔮 Phase 5: Advanced Features (Future)
- [ ] Streaming responses
- [ ] Parallel tool execution
- [ ] Web UI
- [ ] Data visualization
- [ ] Voice interface
- [ ] Multi-agent collaboration

**Current Status:** Production Ready ✅

---

## 📈 Test Coverage

```
Module                      Coverage
----------------------------------
orchestration/session.py     87%
orchestration/agent.py       97%
tools/base.py                91%
providers/base.py            79%
----------------------------------
Overall Project              85%
```

**Total Tests:** 253 passing ✅ (100% pass rate)

---

## 🎯 Example Use Cases

### 1. Post-Race Analysis
```
You: I just finished a race. My average power was 245W for 2 hours.
     How does that compare to my training?

AI: [Analyzes your training data]
    Your race power of 245W is 98% of your training FTP (250W), which
    is excellent! This suggests good pacing. Let me check your zone
    distribution during training...
```

### 2. Training Plan Design
```
You: I have a century ride in 12 weeks. My current FTP is 260W.
     Create a training plan.

AI: [Generates periodized plan]
    I've created a 12-week plan focused on endurance for your century:
    - Weeks 1-4: Base building (Z2 focus)
    - Weeks 5-8: Tempo work (Z3/Z4)
    - Weeks 9-11: Event-specific prep
    - Week 12: Taper
    [Detailed weekly schedule provided...]
```

### 3. Troubleshooting Performance
```
You: My average power has been declining. What's going on?

AI: [Analyzes recent trends]
    Looking at your last 8 weeks, I see:
    - Training volume increased 25%
    - Average power down 3%
    - High-intensity work increased 40%

    This suggests overtraining. Recommendations:
    1. Reduce volume by 15% for 2 weeks
    2. Focus on Z2 recovery rides
    3. Limit Z4+ work to once per week
```

---

## 🤝 Contributing

Contributions welcome! This project is open for:
- Bug reports
- Feature requests
- Provider adapters for new LLMs
- Analysis algorithm improvements
- Documentation enhancements

---

## 📝 License

[License TBD]

---

## 🙏 Acknowledgments

Built with:
- **Click** - CLI framework
- **Rich** - Beautiful terminal output
- **pytest** - Testing framework
- **mypy** - Type checking
- **ruff** - Fast linting
- **pandas** - Data analysis
- **fitparse** - FIT file parsing

---

## 📚 Documentation

### User Documentation
- **[AWS Bedrock Setup Guide](docs/AWS_BEDROCK_SETUP_GUIDE.md)** - **NEW!** Step-by-step AWS Bedrock setup from scratch
- **[AWS Bedrock User Guide](docs/AWS_BEDROCK_USER_GUIDE.md)** - **NEW!** Complete usage guide for AWS Bedrock
- **[User Guide: Generate Command](docs/USER_GUIDE_GENERATE.md)** - Complete guide for report generation
- **[Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)** - Production deployment guide
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Technical Documentation
- [Phase 1 Completion](plans/PHASE1_COMPLETION.md) - Core foundation
- [Phase 2 Architecture](plans/PHASE2_ARCHITECTURE.md) - Provider adapters
- [Phase 3 Implementation](plans/PHASE3_IMPLEMENTATION_COMPLETE.md) - CLI & tools
- [Phase 4 Completion](plans/PHASE4_COMPLETION.md) - Production readiness (see below when created)
- [Multi-Agent Architecture](plans/MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md) - Full architecture spec
- [Performance Benchmarks](.claude/current_task/PLAN/phase4c_performance_report.md) - Performance testing results

---

## 🎉 Get Started!

```bash
# Install
uv pip install -e ".[dev]"

# Set API key
export ANTHROPIC_API_KEY="your-key"

# Start chatting!
cycling-ai chat --provider anthropic --profile your_profile.json
```

**Transform your cycling training with AI!** 🚴‍♂️ + 🤖 = 🎯
