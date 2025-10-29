"""
Structured markdown parser for performance analysis reports.

Parses structured markdown with predefined section headers and converts
them into HTML with beautiful styling.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass
class MarkdownSection:
    """A parsed section from structured markdown."""

    header: str
    content: str
    raw_content: str


class StructuredMarkdownParser:
    """
    Parser for structured markdown with predefined section headers.

    Expected sections:
    - ATHLETE_PROFILE
    - PERFORMANCE_COMPARISON
    - TIME_IN_ZONES
    - KEY_TRENDS
    - INSIGHTS
    - RECOMMENDATIONS
    """

    # Section headers we expect
    EXPECTED_SECTIONS = [
        "ATHLETE_PROFILE",
        "PERFORMANCE_COMPARISON",
        "TIME_IN_ZONES",
        "KEY_TRENDS",
        "INSIGHTS",
        "RECOMMENDATIONS",
    ]

    def __init__(self, markdown_text: str):
        """
        Initialize parser with markdown text.

        Args:
            markdown_text: The structured markdown content to parse
        """
        self.markdown_text = markdown_text
        self.sections: dict[str, MarkdownSection] = {}
        self._parse()

    def _parse(self) -> None:
        """Parse markdown into sections."""
        # Split by ## headers
        pattern = r'^## ([A-Z_]+)$'
        parts = re.split(pattern, self.markdown_text, flags=re.MULTILINE)

        # parts[0] is content before first header (usually empty or intro)
        # parts[1] is first header name, parts[2] is its content, etc.
        for i in range(1, len(parts), 2):
            if i + 1 < len(parts):
                header = parts[i].strip()
                content = parts[i + 1].strip()

                # Store section
                self.sections[header] = MarkdownSection(
                    header=header,
                    content=content,
                    raw_content=f"## {header}\n{content}",
                )

    def get_section(self, section_name: str) -> MarkdownSection | None:
        """
        Get a specific section by name.

        Args:
            section_name: Name of the section (e.g., "ATHLETE_PROFILE")

        Returns:
            MarkdownSection if found, None otherwise
        """
        return self.sections.get(section_name)

    def has_section(self, section_name: str) -> bool:
        """Check if a section exists."""
        return section_name in self.sections

    def to_html(self, css_class_prefix: str = "section") -> str:
        """
        Convert all sections to HTML.

        Args:
            css_class_prefix: Prefix for CSS classes

        Returns:
            HTML string with all sections rendered
        """
        html_parts = []

        for section_name in self.EXPECTED_SECTIONS:
            if section := self.get_section(section_name):
                html = self._render_section_html(section, css_class_prefix)
                html_parts.append(html)

        return "\n".join(html_parts)

    def _render_section_html(
        self, section: MarkdownSection, css_class_prefix: str
    ) -> str:
        """
        Render a single section to HTML.

        Args:
            section: The section to render
            css_class_prefix: Prefix for CSS classes

        Returns:
            HTML string for the section
        """
        section_id = section.header.lower()
        css_class = f"{css_class_prefix}-{section_id}"

        # Convert header to title case for display
        display_title = section.header.replace("_", " ").title()

        html = f'<div class="{css_class}" id="{section_id}">\n'
        html += f'<h2>{display_title}</h2>\n'

        # Render content based on section type
        if section.header == "ATHLETE_PROFILE":
            html += self._render_profile(section.content)
        elif section.header == "PERFORMANCE_COMPARISON":
            html += self._render_comparison_table(section.content)
        elif section.header == "TIME_IN_ZONES":
            html += self._render_zones(section.content)
        elif section.header in ["KEY_TRENDS", "INSIGHTS"]:
            html += self._render_numbered_list(section.content)
        elif section.header == "RECOMMENDATIONS":
            html += self._render_bullet_list(section.content)
        else:
            # Fallback: render as-is with basic markdown
            html += self._render_markdown(section.content)

        html += '</div>\n'
        return html

    def _render_profile(self, content: str) -> str:
        """Render athlete profile as a card-style layout."""
        # Parse bullet points
        lines = [line.strip() for line in content.split('\n') if line.strip()]

        html = '<div class="profile-grid">\n'

        for line in lines:
            # Remove leading bullet/asterisk
            line = re.sub(r'^[\*\-]\s*', '', line)

            # Split on first colon or **label:**
            match = re.match(r'\*\*([^:]+):\*\*\s*(.+)', line)
            if not match:
                match = re.match(r'([^:]+):\s*(.+)', line)

            if match:
                label = match.group(1).strip('* ')
                value = match.group(2).strip()

                html += f'  <div class="profile-item">\n'
                html += f'    <div class="profile-label">{label}</div>\n'
                html += f'    <div class="profile-value">{value}</div>\n'
                html += f'  </div>\n'

        html += '</div>\n'
        return html

    def _render_comparison_table(self, content: str) -> str:
        """Render markdown table as HTML."""
        # Parse markdown table
        lines = [line.strip() for line in content.split('\n') if line.strip()]

        if not lines:
            return '<p>No comparison data available.</p>'

        # Extract headers and separator
        if len(lines) < 2:
            return self._render_markdown(content)

        # Parse table headers
        headers = [h.strip() for h in lines[0].split('|') if h.strip()]

        # Skip separator line (usually line 1)
        data_rows = lines[2:] if len(lines) > 2 else []

        html = '<table class="comparison-table">\n'
        html += '  <thead>\n    <tr>\n'

        for header in headers:
            html += f'      <th>{header}</th>\n'

        html += '    </tr>\n  </thead>\n'
        html += '  <tbody>\n'

        for row in data_rows:
            cells = [c.strip() for c in row.split('|') if c.strip()]

            if not cells:
                continue

            html += '    <tr>\n'

            for i, cell in enumerate(cells):
                # Always strip markdown bold formatting first
                cell = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', cell)

                # Check for percentage change in last column
                if i == len(cells) - 1 and '%' in cell:
                    # Add class for positive/negative
                    if '+' in cell or cell.startswith('+'):
                        cell_class = ' class="positive"'
                    elif '-' in cell:
                        cell_class = ' class="negative"'
                    else:
                        cell_class = ''

                    html += f'      <td{cell_class}>{cell}</td>\n'
                else:
                    html += f'      <td>{cell}</td>\n'

            html += '    </tr>\n'

        html += '  </tbody>\n'
        html += '</table>\n'

        return html

    def _render_zones(self, content: str) -> str:
        """Render time-in-zones section."""
        # Check if it's a table or plain text
        if '|' in content:
            return self._render_comparison_table(content)
        else:
            # Plain text explanation
            return f'<div class="zones-info">{self._render_markdown(content)}</div>'

    def _render_numbered_list(self, content: str) -> str:
        """Render numbered list with rich formatting."""
        # Parse numbered items
        items = re.split(r'^\d+\.\s+', content, flags=re.MULTILINE)
        items = [item.strip() for item in items if item.strip()]

        html = '<ol class="insights-list">\n'

        for item in items:
            # Convert markdown bold to HTML
            item = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', item)

            html += f'  <li>{item}</li>\n'

        html += '</ol>\n'
        return html

    def _render_bullet_list(self, content: str) -> str:
        """Render bullet list."""
        # Parse bullet items
        lines = [line.strip() for line in content.split('\n') if line.strip()]

        html = '<ul class="recommendations-list">\n'

        for line in lines:
            # Remove leading bullet
            line = re.sub(r'^[\*\-]\s*', '', line)

            # Convert markdown bold to HTML
            line = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', line)

            html += f'  <li>{line}</li>\n'

        html += '</ul>\n'
        return html

    def _render_markdown(self, content: str) -> str:
        """
        Basic markdown rendering for fallback.

        Handles: bold, paragraphs
        """
        # Convert bold
        content = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', content)

        # Convert paragraphs
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        if len(paragraphs) == 1:
            return f'<p>{paragraphs[0]}</p>'

        return '\n'.join(f'<p>{p}</p>' for p in paragraphs)


def get_enhanced_css() -> str:
    """
    Get enhanced CSS for structured markdown sections.

    Matches the training plan viewer design system with professional styling,
    interactive elements, and responsive layout.

    Returns:
        CSS string for beautiful section rendering
    """
    return """
    <style>
        /* Custom Professional Palette - Cycling Inspired (matches training plan viewer) */
        :root {
            --primary-dark: #1a2332;
            --primary-mid: #2d3e50;
            --accent-orange: #ff6b35;
            --accent-teal: #004e89;
            --accent-yellow: #ffc857;
            --success-green: #06d6a0;
            --bg-light: #f8f9fa;
            --bg-card: #ffffff;
            --text-primary: #1a2332;
            --text-secondary: #5a6c7d;
            --text-light: #8492a6;
            --border-light: #e1e8ed;
            --shadow-sm: 0 2px 8px rgba(26, 35, 50, 0.08);
            --shadow-md: 0 4px 16px rgba(26, 35, 50, 0.12);
            --shadow-lg: 0 8px 32px rgba(26, 35, 50, 0.16);
        }

        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 0;
            border-radius: 16px;
            box-shadow: var(--shadow-lg);
            overflow: hidden;
        }

        /* Modern Header with Gradient */
        .report-header {
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-mid) 100%);
            color: white;
            padding: 2.5rem 2rem;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: var(--shadow-lg);
        }

        .report-header h1 {
            font-size: 2.5em;
            margin-bottom: 0.75rem;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .report-header .metadata {
            font-size: 0.95em;
            opacity: 0.9;
            display: flex;
            gap: 2rem;
            flex-wrap: wrap;
            margin-top: 1rem;
        }

        .report-header .metadata span {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        /* Navigation */
        .nav-links {
            background: var(--bg-light);
            padding: 1.25rem 2rem;
            border-bottom: 1px solid var(--border-light);
            display: flex;
            gap: 1.5rem;
            flex-wrap: wrap;
        }

        .nav-links a {
            color: var(--primary-dark);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95em;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            transition: all 0.2s ease;
        }

        .nav-links a:hover {
            background: var(--accent-orange);
            color: white;
            transform: translateY(-2px);
        }

        /* Content area */
        .content {
            padding: 2.5rem;
        }

        /* Section styles */
        [class^="section-"] {
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid var(--border-light);
        }

        [class^="section-"]:last-child {
            border-bottom: none;
        }

        [class^="section-"] h2 {
            color: var(--primary-dark);
            font-size: 1.75em;
            font-weight: 700;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 3px solid var(--accent-orange);
            display: inline-block;
        }

        /* Athlete Profile - Modern Card Style */
        .profile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.25rem;
            margin-top: 1.5rem;
        }

        .profile-item {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 1.5rem;
            border-radius: 12px;
            border-left: 4px solid var(--accent-orange);
            transition: all 0.3s ease;
            box-shadow: var(--shadow-sm);
        }

        .profile-item:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-md);
            border-left-color: var(--accent-teal);
        }

        .profile-label {
            font-size: 0.75em;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }

        .profile-value {
            font-size: 1.5em;
            color: var(--text-primary);
            font-weight: 700;
            line-height: 1.3;
        }

        /* Performance Comparison Table */
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            box-shadow: var(--shadow-sm);
            border-radius: 12px;
            overflow: hidden;
        }

        .comparison-table thead {
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-mid) 100%);
            color: white;
        }

        .comparison-table th {
            padding: 1rem 1.25rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .comparison-table td {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--border-light);
            font-size: 0.95em;
        }

        .comparison-table tbody tr {
            transition: background-color 0.2s ease;
        }

        .comparison-table tbody tr:hover {
            background-color: #fff5f0;
        }

        .comparison-table tbody tr:last-child td {
            border-bottom: none;
        }

        /* Positive/Negative indicators with enhanced styling */
        .positive {
            color: var(--success-green);
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
        }

        .positive::before {
            content: "↑";
            font-size: 1.2em;
        }

        .negative {
            color: #e74c3c;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
        }

        .negative::before {
            content: "↓";
            font-size: 1.2em;
        }

        /* Enhanced Lists with Circular Badges */
        .insights-list, .recommendations-list {
            margin: 1.5rem 0;
            padding-left: 0;
            list-style: none;
            counter-reset: item;
        }

        .insights-list li, .recommendations-list li {
            background: var(--bg-light);
            margin-bottom: 1rem;
            padding: 1.5rem 1.5rem 1.5rem 4rem;
            border-left: 4px solid var(--accent-orange);
            border-radius: 10px;
            position: relative;
            transition: all 0.2s ease;
            box-shadow: var(--shadow-sm);
        }

        .insights-list li:hover, .recommendations-list li:hover {
            background: #fff5f0;
            transform: translateX(4px);
            box-shadow: var(--shadow-md);
        }

        .insights-list li::before {
            content: counter(item);
            counter-increment: item;
            position: absolute;
            left: 1.25rem;
            top: 1.5rem;
            background: linear-gradient(135deg, var(--accent-orange) 0%, #ff8c5a 100%);
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1.1em;
            box-shadow: rgba(255, 107, 53, 0.3) 0px 4px 12px;
        }

        .recommendations-list li::before {
            content: "✓";
            position: absolute;
            left: 1.25rem;
            top: 1.5rem;
            background: var(--success-green);
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1.3em;
            box-shadow: rgba(6, 214, 160, 0.3) 0px 4px 12px;
        }

        /* Zones info box */
        .zones-info {
            background: #fff5f0;
            border-left: 4px solid var(--accent-orange);
            padding: 1.5rem;
            border-radius: 12px;
            margin: 1.5rem 0;
            box-shadow: var(--shadow-sm);
        }

        .zones-info p {
            color: var(--text-secondary);
            line-height: 1.7;
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
            .content {
                padding: 2rem;
            }

            .profile-grid {
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            }
        }

        @media (max-width: 768px) {
            body {
                padding: 0.5rem;
            }

            .container {
                border-radius: 12px;
            }

            .report-header {
                padding: 2rem 1.5rem;
            }

            .report-header h1 {
                font-size: 2em;
            }

            .report-header .metadata {
                flex-direction: column;
                gap: 0.5rem;
            }

            .content {
                padding: 1.5rem;
            }

            .profile-grid {
                grid-template-columns: 1fr;
            }

            .nav-links {
                padding: 1rem;
                flex-direction: column;
                gap: 0.5rem;
            }

            .nav-links a {
                display: block;
                text-align: center;
            }

            [class^="section-"] h2 {
                font-size: 1.5em;
            }

            .comparison-table {
                font-size: 0.9em;
            }

            .comparison-table th,
            .comparison-table td {
                padding: 0.75rem 0.5rem;
            }
        }

        /* Print styles */
        @media print {
            body {
                background: white;
                padding: 0;
            }

            .container {
                box-shadow: none;
                border-radius: 0;
            }

            .report-header {
                position: static;
            }

            .nav-links {
                display: none;
            }

            [class^="section-"] {
                page-break-inside: avoid;
            }

            .profile-item:hover,
            .insights-list li:hover,
            .recommendations-list li:hover {
                transform: none;
                box-shadow: none;
            }
        }
    </style>
    """
