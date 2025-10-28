# Deployment Checklist: Cycling AI Analysis System

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Target Audience:** System Administrators, DevOps Engineers

---

## Overview

This checklist guides you through deploying the Cycling AI Analysis system, which uses multi-agent LLM orchestration to analyze cycling performance data and generate training plans.

**Important:** This system requires an LLM provider with reliable tool-calling capabilities. Models with less than 8 billion parameters (e.g., llama3.2:3b) are **not recommended** for production use.

---

## Pre-Deployment Requirements

### System Requirements

#### Minimum Requirements
- **OS:** macOS 10.15+, Linux (Ubuntu 20.04+), Windows 10+ with WSL2
- **Python:** 3.11 or higher
- **Memory:** 2 GB RAM (for cloud-based LLM providers)
- **Storage:** 1 GB free disk space
- **Network:** Stable internet connection (for cloud providers)

#### Recommended Requirements (for local LLM execution)
- **OS:** macOS 12+ or Linux
- **Python:** 3.11 or higher
- **Memory:** 16 GB RAM (32 GB for large models)
- **Storage:** 50 GB free disk space (for model storage)
- **CPU:** 8+ cores or Apple Silicon
- **GPU:** 8+ GB VRAM (optional but recommended for NVIDIA GPUs)

### Software Prerequisites

```bash
# Check Python version (must be 3.11+)
python3 --version

# Check uv installation (recommended) or pip
uv --version || pip3 --version

# Check git
git --version
```

---

## Step 1: LLM Provider Setup

**CRITICAL:** Choose and configure your LLM provider before installation.

### Option A: Anthropic Claude (Recommended for Production)

**Pros:**
- Excellent tool-calling reliability
- High-quality analysis and insights
- Cost-effective ($0.25 per workflow)
- Fast response times

**Setup:**

1. **Create Anthropic Account:**
   - Visit: https://console.anthropic.com
   - Sign up for an account
   - Navigate to API Keys section

2. **Generate API Key:**
   ```bash
   # Copy your API key (starts with sk-ant-...)
   ```

3. **Set Environment Variable:**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"

   # Add to your shell profile for persistence
   echo 'export ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> ~/.bashrc
   # or for macOS
   echo 'export ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> ~/.zshrc
   ```

4. **Verify:**
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

**Model Requirements:**
- Recommended: `claude-3-5-sonnet-20241022`
- Minimum: `claude-3-haiku-20240307`

### Option B: OpenAI GPT-4

**Pros:**
- Very reliable tool calling
- Excellent code generation
- Wide ecosystem

**Setup:**

1. **Create OpenAI Account:**
   - Visit: https://platform.openai.com
   - Sign up and add payment method
   - Navigate to API Keys

2. **Generate API Key:**
   ```bash
   # Copy your API key (starts with sk-...)
   ```

3. **Set Environment Variable:**
   ```bash
   export OPENAI_API_KEY="sk-your-key-here"

   # Add to shell profile
   echo 'export OPENAI_API_KEY="sk-your-key-here"' >> ~/.bashrc
   ```

**Model Requirements:**
- Recommended: `gpt-4-turbo`
- Minimum: `gpt-3.5-turbo` (may have reduced reliability)

### Option C: Ollama (Local Execution, Privacy-Focused)

**Pros:**
- Free (no API costs)
- Complete privacy (data stays local)
- Unlimited usage
- No internet required for inference

**Cons:**
- Requires capable hardware
- Setup more complex
- Smaller models less reliable than cloud options

**Setup:**

1. **Install Ollama:**

   **macOS:**
   ```bash
   brew install ollama
   ```

   **Linux:**
   ```bash
   curl https://ollama.ai/install.sh | sh
   ```

   **Windows:**
   Download from https://ollama.ai/download

2. **Start Ollama Service:**
   ```bash
   ollama serve
   ```

3. **Pull Required Model:**

   **Recommended (8B+ parameters):**
   ```bash
   # Option 1: llama3.1:8b (4.7 GB)
   ollama pull llama3.1:8b

   # Option 2: llama3:70b (39 GB, requires 32GB+ RAM)
   ollama pull llama3:70b
   ```

   **Not Recommended for Production:**
   ```bash
   # llama3.2:3b - Too small for reliable tool calling
   ollama pull llama3.2:3b
   ```

4. **Verify Installation:**
   ```bash
   ollama list
   ollama run llama3.1:8b "Hello, can you help with cycling analysis?"
   ```

**Model Size Requirements:**
- **Minimum:** 8B parameters (llama3.1:8b)
- **Recommended:** 13B+ parameters
- **Optimal:** 70B+ parameters (requires significant hardware)

### Option D: Google Gemini (Cost-Effective)

**Pros:**
- Very low cost ($0.09 per workflow)
- Good performance
- Acceptable reliability

**Setup:**

1. **Create Google Cloud Account:**
   - Visit: https://console.cloud.google.com
   - Enable Gemini API
   - Create API key

2. **Set Environment Variable:**
   ```bash
   export GOOGLE_API_KEY="your-google-api-key"

   # Add to shell profile
   echo 'export GOOGLE_API_KEY="your-google-api-key"' >> ~/.bashrc
   ```

**Model Requirements:**
- Recommended: `gemini-1.5-pro`

---

## Step 2: Installation

### Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/cycling-ai-analysis.git
cd cycling-ai-analysis
```

### Install Dependencies

**Option A: Using uv (Recommended)**

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"
```

**Option B: Using pip**

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"
```

### Verify Installation

```bash
# Check CLI is installed
cycling-ai --version

# Should output: cycling-ai, version X.X.X

# Check providers are available
cycling-ai providers list

# Should list configured providers
```

---

## Step 3: Configuration

### Create Configuration Directory

```bash
# Create ~/.cycling-ai directory
mkdir -p ~/.cycling-ai
mkdir -p ~/.cycling-ai/sessions
mkdir -p ~/.cycling-ai/workflow_sessions
```

### Create Configuration File (Optional)

```bash
# Create config file
cat > ~/.cycling-ai/config.yaml << 'EOF'
# Cycling AI Analysis Configuration

# Default LLM Provider
default_provider: "anthropic"  # or "openai", "gemini", "ollama"

# Provider-specific settings
providers:
  anthropic:
    model: "claude-3-5-sonnet-20241022"
    max_tokens: 4096

  openai:
    model: "gpt-4-turbo"
    max_tokens: 4096

  ollama:
    model: "llama3.1:8b"
    base_url: "http://localhost:11434"

  gemini:
    model: "gemini-1.5-pro"

# Output preferences
output:
  default_dir: "./reports"

# Analysis defaults
analysis:
  default_period_months: 6
  default_training_weeks: 12
EOF
```

### Set File Permissions

```bash
# Protect sensitive configuration
chmod 600 ~/.cycling-ai/config.yaml

# Ensure session directories are writable
chmod 755 ~/.cycling-ai/sessions
chmod 755 ~/.cycling-ai/workflow_sessions
```

---

## Step 4: Verification & Testing

### Basic Verification

```bash
# 1. Check installation
cycling-ai --version

# 2. Check help system
cycling-ai --help
cycling-ai generate --help

# 3. List providers
cycling-ai providers list

# Expected output should show your configured provider(s)
```

### Provider Health Check

**For Anthropic:**
```bash
# Set API key if not in environment
export ANTHROPIC_API_KEY="your-key"

# Test simple query
python3 << 'EOF'
from cycling_ai.providers import AnthropicProvider

provider = AnthropicProvider(api_key=os.environ["ANTHROPIC_API_KEY"])
response = provider.chat(messages=[{"role": "user", "content": "Hello"}])
print("✅ Anthropic provider working")
EOF
```

**For Ollama:**
```bash
# Ensure service is running
ollama list

# Test model
ollama run llama3.1:8b "Hello"

# If successful, you'll see a response
```

### Test Data Preparation

```bash
# Create test data directory
mkdir -p ./test_data

# Download or prepare sample data
# You'll need:
# - activities.csv (Strava export)
# - athlete_profile.json
# - activities/ (FIT files, optional)
```

**Create sample athlete profile:**
```bash
cat > ./test_data/athlete_profile.json << 'EOF'
{
  "ftp": 265,
  "max_hr": 186,
  "zones": {
    "power": {
      "zone1": [0, 143],
      "zone2": [144, 186],
      "zone3": [187, 224],
      "zone4": [225, 265],
      "zone5": [266, 318],
      "zone6": [319, 424],
      "zone7": [425, 999]
    },
    "hr": {
      "zone1": [0, 130],
      "zone2": [131, 149],
      "zone3": [150, 167],
      "zone4": [168, 177],
      "zone5": [178, 999]
    }
  },
  "weight_kg": 70,
  "age": 35,
  "goals": [
    "Improve FTP",
    "Complete century ride"
  ]
}
EOF
```

### Run Test Workflow

```bash
# Run generate command with test data
cycling-ai generate \
  --csv ./test_data/activities.csv \
  --profile ./test_data/athlete_profile.json \
  --output-dir ./test_reports \
  --provider anthropic \
  --period-months 3 \
  --training-plan-weeks 8

# Expected: Workflow completes in < 5 minutes
# Expected output: 3 HTML files in ./test_reports/
```

### Validate Output

```bash
# Check for generated reports
ls -lh ./test_reports/

# Should see:
# - index.html
# - coaching_insights.html
# - performance_dashboard.html

# Open reports in browser
open ./test_reports/index.html  # macOS
# xdg-open ./test_reports/index.html  # Linux
# start ./test_reports/index.html  # Windows
```

---

## Step 5: Security Considerations

### API Key Protection

```bash
# Never commit API keys to version control
echo ".env" >> .gitignore
echo "*.key" >> .gitignore

# Use environment variables, not hardcoded values
# ✅ Good: export ANTHROPIC_API_KEY="..."
# ❌ Bad: api_key = "sk-ant-..."

# For production, use secrets management
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
```

### File Permissions

```bash
# Protect session data
chmod 700 ~/.cycling-ai/sessions
chmod 700 ~/.cycling-ai/workflow_sessions

# Protect config file
chmod 600 ~/.cycling-ai/config.yaml

# Protect API key files (if using file-based storage)
chmod 600 ~/.cycling-ai/*.key
```

### Data Privacy

**For local execution (Ollama):**
- ✅ All data stays on local machine
- ✅ No external API calls
- ✅ Maximum privacy

**For cloud providers (Anthropic, OpenAI, Gemini):**
- ⚠️ Data sent to third-party APIs
- ⚠️ Review provider privacy policies
- ⚠️ Consider data anonymization for sensitive users
- ⚠️ Check compliance requirements (GDPR, HIPAA, etc.)

---

## Step 6: Monitoring & Logging

### Configure Logging

```bash
# Create logs directory
mkdir -p ~/.cycling-ai/logs

# Set log level (optional)
export CYCLING_AI_LOG_LEVEL="INFO"  # DEBUG, INFO, WARNING, ERROR
```

### Log File Locations

```
~/.cycling-ai/logs/
├── cycling-ai.log          # Main application log
├── workflows/
│   └── YYYY-MM-DD.log      # Daily workflow logs
└── errors/
    └── YYYY-MM-DD.log      # Error logs
```

### Monitor Resource Usage

```bash
# Monitor memory usage during workflow
top -pid $(pgrep -f cycling-ai)

# Monitor disk usage
du -sh ~/.cycling-ai/

# Monitor API usage (for cloud providers)
# Check your provider's dashboard for usage metrics
```

---

## Step 7: Post-Deployment Validation

### Validation Checklist

- [ ] Python 3.11+ installed and verified
- [ ] Virtual environment created and activated
- [ ] Dependencies installed (`cycling-ai --version` works)
- [ ] LLM provider configured (API key set or Ollama running)
- [ ] Model meets minimum requirements (8B+ parameters or cloud model)
- [ ] Configuration directory created (`~/.cycling-ai/`)
- [ ] Test workflow executed successfully
- [ ] 3 HTML reports generated
- [ ] Reports open in browser correctly
- [ ] No errors in logs
- [ ] API keys secured (not in version control)
- [ ] File permissions set correctly

### Common Post-Deployment Issues

#### Issue 1: "Command not found: cycling-ai"

**Solution:**
```bash
# Ensure virtual environment is activated
source .venv/bin/activate

# Reinstall in editable mode
pip install -e .
```

#### Issue 2: "API key not found"

**Solution:**
```bash
# Check environment variable
echo $ANTHROPIC_API_KEY

# If empty, set it
export ANTHROPIC_API_KEY="your-key"

# Add to shell profile for persistence
```

#### Issue 3: "No HTML reports generated"

**Possible causes:**
1. Model too small (llama3.2:3b) → Use 8B+ model
2. API rate limit exceeded → Wait and retry
3. Insufficient disk space → Check `df -h`
4. Permissions issue → Check `~/.cycling-ai/` permissions

**Solution:**
```bash
# Check model size
ollama list  # Should show 8B+ model

# Verify output directory is writable
ls -ld ./test_reports

# Check logs for errors
tail -n 50 ~/.cycling-ai/logs/cycling-ai.log
```

---

## Step 8: Rollback Procedures

### If Deployment Fails

**1. Deactivate virtual environment:**
```bash
deactivate
```

**2. Remove installation:**
```bash
rm -rf .venv
rm -rf ~/.cycling-ai  # WARNING: Deletes all sessions and config
```

**3. Revert to previous version (if upgrading):**
```bash
git checkout <previous-tag>
# Re-run installation from Step 2
```

### Preserve User Data During Rollback

```bash
# Backup sessions and config before rollback
tar -czf cycling-ai-backup-$(date +%Y%m%d).tar.gz ~/.cycling-ai/

# After rollback, restore if needed
tar -xzf cycling-ai-backup-YYYYMMDD.tar.gz -C ~
```

---

## Production Deployment Recommendations

### For Small Teams (1-10 users)

**Recommended setup:**
- Provider: Anthropic Claude 3.5 Sonnet
- Cost: ~$25-250/month (100-1000 workflows)
- Deployment: Local installation on each user's machine
- Support: Shared documentation and Slack channel

### For Medium Organizations (10-100 users)

**Recommended setup:**
- Provider: Anthropic Claude 3.5 Sonnet (centralized billing)
- Cost: ~$250-2500/month
- Deployment: Centralized server with web interface (future)
- Support: Dedicated admin, ticketing system

### For Enterprise (100+ users)

**Recommended setup:**
- Provider: Ollama (self-hosted) with llama3:70b+ on GPU servers
- Cost: Hardware investment (~$10-50k), no API costs
- Deployment: Kubernetes cluster with load balancing
- Support: DevOps team, SLA agreements, 24/7 monitoring

---

## Cost Management

### Estimate Your Costs

**Per workflow:**
- Anthropic Claude 3.5 Sonnet: ~$0.25
- OpenAI GPT-4 Turbo: ~$0.60
- Google Gemini 1.5 Pro: ~$0.09
- Ollama (local): ~$0.00

**Monthly costs (example: 100 workflows/month):**
- Anthropic: $25/month
- OpenAI: $60/month
- Gemini: $9/month
- Ollama: $0/month (hardware only)

### Cost Optimization Tips

1. **Use caching:** Reuse analysis results when possible
2. **Choose appropriate models:** Don't use GPT-4 when GPT-3.5 suffices
3. **Batch processing:** Run multiple analyses together
4. **Limit period:** Analyze 3 months instead of 12 for quick checks
5. **Local execution:** Use Ollama for development/testing

---

## Support & Troubleshooting

### Resources

- **Documentation:** `docs/USER_GUIDE_GENERATE.md`
- **Troubleshooting:** `docs/TROUBLESHOOTING.md`
- **Performance:** `.claude/current_task/PLAN/phase4c_performance_report.md`
- **GitHub Issues:** https://github.com/yourusername/cycling-ai-analysis/issues

### Getting Help

1. Check troubleshooting guide
2. Review logs: `~/.cycling-ai/logs/cycling-ai.log`
3. Search existing GitHub issues
4. Create new issue with:
   - System info (`uname -a`, `python --version`)
   - Provider and model used
   - Full error message
   - Steps to reproduce

---

## Conclusion

If all checklist items are complete, your Cycling AI Analysis system is ready for production use.

**Next steps:**
1. Train users on the `generate` command (see `USER_GUIDE_GENERATE.md`)
2. Set up monitoring and alerting
3. Establish backup procedures for session data
4. Plan for scaling as usage grows

**Remember:**
- Use 8B+ parameter models for reliable results
- Monitor API costs and usage
- Keep API keys secure
- Regular backups of `~/.cycling-ai/`

---

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Status:** Production Ready (with model requirements met)
