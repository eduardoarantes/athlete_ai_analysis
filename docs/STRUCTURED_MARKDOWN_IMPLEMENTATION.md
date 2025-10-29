# Structured Markdown Implementation

## Overview

This document describes the implementation of structured markdown for the performance analysis workflow. The system now generates beautiful HTML reports from markdown output instead of requiring JSON-based data structures.

## Architecture Changes

### 1. Performance Analysis Agent (Phase 2)

**File:** `prompts/default/1.0/performance_analysis.txt`

The agent now outputs structured markdown with predefined section headers:

```markdown
## ATHLETE_PROFILE
[Bullet list with athlete details]

## PERFORMANCE_COMPARISON
[Markdown table comparing periods]

## TIME_IN_ZONES
[Zone distribution table or explanation]

## KEY_TRENDS
[Numbered list of 3-5 trends]

## INSIGHTS
[Numbered list of 3-5 insights]

## RECOMMENDATIONS
[Bullet list of actionable recommendations]
```

### 2. Markdown Parser

**File:** `src/cycling_ai/tools/markdown_parser.py`

New component that:
- Parses structured markdown by section headers
- Converts each section to beautifully styled HTML
- Handles different content types (tables, lists, paragraphs)
- Provides enhanced CSS with gradient styling

Key features:
- Section-specific rendering (profile cards, comparison tables, trend lists)
- Responsive design
- Print-friendly styles
- Professional gradient theme

### 3. Report Generation Tool

**File:** `src/cycling_ai/tools/wrappers/report_tool.py`

Updated to accept both:
- **New:** `performance_analysis_markdown` - structured markdown text
- **Legacy:** `performance_analysis_json` + `zones_analysis_json` - JSON data

The tool automatically:
1. Detects which format is provided
2. Parses structured markdown using `StructuredMarkdownParser`
3. Generates a comprehensive HTML report with embedded CSS
4. Saves to `performance_report.html`

### 4. Multi-Agent Orchestrator

**File:** `src/cycling_ai/orchestration/multi_agent.py`

Updated `_execute_phase` method:
- For Phase 2 (performance_analysis), stores the agent's markdown response in `extracted_data["performance_analysis_markdown"]`
- This markdown is then passed to Phase 4 for report generation

### 5. Report Generation Agent (Phase 4)

**File:** `prompts/default/1.0/report_generation.txt`

Simplified prompt:
- Instructs agent to pass structured markdown from Phase 2 to the tool
- Tool handles all HTML generation and styling
- Agent just needs to extract and forward the data correctly

## Benefits

### 1. **Better LLM Output**
- LLMs naturally generate better narrative analysis in markdown
- More nuanced insights and recommendations
- Easier for agents to produce quality content

### 2. **Cleaner Architecture**
- Clear separation: agents write markdown, tools render HTML
- No need for rigid JSON schemas for narrative content
- Easier to extend with new section types

### 3. **Beautiful HTML Output**
- Professional gradient design
- Responsive layout
- Print-friendly
- Visual hierarchy with cards, tables, and styled lists

### 4. **Flexibility**
- Easy to modify section layouts via CSS
- Can add new section types without changing agent prompts
- Maintains backward compatibility with legacy JSON format

## HTML Output Features

The generated HTML includes:

1. **Header Section**
   - Gradient blue header
   - Athlete name and generation timestamp

2. **Athlete Profile**
   - Card-style grid layout
   - Hover effects
   - Key metrics highlighted

3. **Performance Comparison**
   - Professional table styling
   - Color-coded changes (green ↑ positive, red ↓ negative)
   - Zebra striping on hover

4. **Zone Distribution**
   - Visual table representation
   - Percentage breakdowns
   - Clear zone labels

5. **Key Trends & Insights**
   - Numbered list with circular badges
   - Highlighted important text
   - Structured narrative format

6. **Recommendations**
   - Checkmark bullets
   - Action-oriented layout
   - Clear next steps

7. **Training Plan** (if available)
   - Summary metrics in card grid
   - Detailed plan text in formatted box

## Migration Path

The system supports both formats:

### New Format (Recommended)
```python
generate_report(
    performance_analysis_markdown="## ATHLETE_PROFILE\n...",
    training_plan_json='{"total_weeks": 12, ...}',
    output_dir="/path/to/reports"
)
```

### Legacy Format (Deprecated)
```python
generate_report(
    performance_analysis_json='{"athlete_profile": {...}, ...}',
    zones_analysis_json='{"zones": {...}, ...}',
    training_plan_json='{"total_weeks": 12, ...}',
    output_dir="/path/to/reports"
)
```

The tool automatically detects which format is used and processes accordingly.

## Testing

Run a test with sample data:

```bash
# Create a test markdown file
cat > /tmp/test_performance.md << 'EOF'
## ATHLETE_PROFILE
* **Name:** Test Athlete
* **FTP:** 280 W
...
EOF

# Test the parser
python -c "
from src.cycling_ai.tools.markdown_parser import StructuredMarkdownParser
parser = StructuredMarkdownParser(open('/tmp/test_performance.md').read())
print(parser.to_html())
"
```

## File Structure

```
src/cycling_ai/
├── tools/
│   ├── markdown_parser.py              # NEW: Structured markdown parser
│   └── wrappers/
│       └── report_tool.py              # UPDATED: Support markdown input
├── orchestration/
│   └── multi_agent.py                  # UPDATED: Store markdown response
prompts/default/1.0/
├── performance_analysis.txt            # UPDATED: Output structured markdown
└── report_generation.txt               # UPDATED: Use markdown parameter
```

## Future Enhancements

1. **Interactive Charts**: Add JavaScript-based charts for zone distribution
2. **PDF Export**: Add option to export reports as PDF
3. **Custom Themes**: Allow users to customize color schemes
4. **Section Toggling**: Add collapsible sections for long reports
5. **Comparison Views**: Side-by-side comparison of multiple reports

## Example Output

The generated HTML creates a modern, professional report with:
- Gradient purple/blue background
- White content container with shadow
- Responsive grid layouts
- Professional typography
- Visual hierarchy through color and spacing
- Print-optimized styles

View the sample report at: `file:///tmp/test_performance_report.html`
