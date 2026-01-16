#!/usr/bin/env python3
"""
Convert existing report from inline Plotly to CDN to reduce file size.

This script:
1. Extracts all inline Plotly.js code
2. Replaces with a single CDN script tag
3. Significantly reduces file size (from ~71MB to ~5-10MB)
"""

import re
import sys
from pathlib import Path

REPORT_PATH = "workout_comparison_report_dtw.html"
PLOTLY_CDN = '<script src="https://cdn.plot.ly/plotly-2.27.0.min.js" charset="utf-8"></script>'


def convert_to_cdn():
    """Convert inline Plotly to CDN."""
    print(f"Reading {REPORT_PATH}...")

    report_file = Path(REPORT_PATH)
    if not report_file.exists():
        print(f"Error: {REPORT_PATH} not found")
        return 1

    content = report_file.read_text(encoding='utf-8')
    original_size = len(content) / 1024 / 1024
    print(f"Original file size: {original_size:.1f} MB")

    # Count inline Plotly scripts
    inline_plotly_count = content.count('!function(t,e)')
    print(f"Found {inline_plotly_count} inline Plotly.js instances")

    # Replace all inline Plotly.js with empty string (first occurrence only in each script tag)
    # Pattern: <script type="text/javascript">window.PlotlyConfig=...huge plotly code...</script>
    pattern = r'<script type="text/javascript">!function\(t,e\).*?</script>\s*<script type="text/javascript">window\.PlotlyConfig=.*?</script>'

    # Find all matches
    matches = list(re.finditer(pattern, content, re.DOTALL))
    print(f"Found {len(matches)} Plotly script blocks to remove")

    if not matches:
        # Try alternative pattern
        pattern = r'<script type="text/javascript">.*?window\.PlotlyConfig.*?</script>'
        matches = list(re.finditer(pattern, content, re.DOTALL))
        print(f"Using alternative pattern, found {len(matches)} blocks")

    # Remove all inline Plotly.js code
    new_content = content
    for match in reversed(matches):  # Reverse to maintain indices
        new_content = new_content[:match.start()] + new_content[match.end():]

    # Add CDN script tag in the <head> section, after the closing </style> tag
    head_pattern = r'(</style>\s*</head>)'
    new_content = re.sub(
        head_pattern,
        f'</style>\n    {PLOTLY_CDN}\n  </head>',
        new_content,
        count=1
    )

    new_size = len(new_content) / 1024 / 1024
    reduction = ((original_size - new_size) / original_size) * 100

    print(f"New file size: {new_size:.1f} MB")
    print(f"Size reduction: {reduction:.1f}%")

    # Backup original
    backup_path = report_file.with_suffix('.html.bak')
    print(f"Creating backup at {backup_path}...")
    backup_path.write_text(content, encoding='utf-8')

    # Write updated content
    print(f"Writing updated report...")
    report_file.write_text(new_content, encoding='utf-8')

    print(f"✓ Successfully converted {REPORT_PATH} to use Plotly CDN")
    print(f"  Original: {original_size:.1f} MB")
    print(f"  Updated: {new_size:.1f} MB")
    print(f"  Saved: {original_size - new_size:.1f} MB ({reduction:.1f}% reduction)")
    print(f"  Backup: {backup_path}")

    return 0


if __name__ == '__main__':
    sys.exit(convert_to_cdn())
