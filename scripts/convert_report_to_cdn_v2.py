#!/usr/bin/env python3
"""
Convert existing report from inline Plotly to CDN to reduce file size.

This script:
1. Removes only the Plotly.js library code (the huge inline script)
2. Keeps all Plotly.newPlot calls (the actual chart rendering code)
3. Adds a single CDN script tag in the <head>
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

    # Count workout sections before conversion
    workout_count = content.count('<section class="workout">')
    print(f"Found {workout_count} workout sections")

    # Strategy: Remove the big Plotly.js library code, but keep Plotly.newPlot calls
    # The library code is a massive script that starts with specific patterns

    # Pattern 1: The main Plotly library (starts with !function or window.PlotlyConfig)
    # This is the huge code block we want to remove
    # It's usually in a script tag before the first chart div

    # Find the first chart div to know where the library code ends
    first_chart_match = re.search(r'<div id="[^"]+" class="plotly-graph-div"', content)
    if not first_chart_match:
        print("Error: Could not find any plotly-graph-div elements")
        return 1

    first_chart_pos = first_chart_match.start()
    print(f"First chart div at position: {first_chart_pos:,}")

    # The library code should be before the first chart
    # Look for script tags in the head section
    head_end = content.find('</head>')
    if head_end == -1:
        print("Error: Could not find </head> tag")
        return 1

    # Find all script tags before the first chart
    # The Plotly library is typically a very large script tag
    pattern = r'<script type="text/javascript">.*?</script>'

    new_content = content
    removed_count = 0
    total_removed_size = 0

    # Find all script tags before the first chart
    for match in re.finditer(pattern, content[:first_chart_pos], re.DOTALL):
        script_content = match.group(0)
        script_size = len(script_content)

        # Only remove very large scripts (> 100KB) that contain Plotly library code
        # These will have patterns like "!function" or "window.PlotlyConfig"
        if script_size > 100000 and ('!function' in script_content or 'PlotlyConfig' in script_content):
            print(f"Removing script tag ({script_size / 1024:.1f} KB)")
            new_content = new_content.replace(script_content, '', 1)
            removed_count += 1
            total_removed_size += script_size

    print(f"Removed {removed_count} large Plotly library script(s) ({total_removed_size / 1024 / 1024:.1f} MB)")

    # Verify we didn't remove chart divs or Plotly.newPlot calls
    new_workout_count = new_content.count('<section class="workout">')
    new_chart_count = new_content.count('Plotly.newPlot')

    print(f"Workout sections after: {new_workout_count} (was {workout_count})")
    print(f"Plotly.newPlot calls: {new_chart_count}")

    if new_workout_count != workout_count:
        print(f"ERROR: Lost workout sections! {workout_count} -> {new_workout_count}")
        return 1

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

    print(f"\nNew file size: {new_size:.1f} MB")
    print(f"Size reduction: {reduction:.1f}%")

    # Backup original
    backup_path = report_file.with_suffix('.html.cdn_backup')
    print(f"Creating backup at {backup_path}...")
    backup_path.write_text(content, encoding='utf-8')

    # Write updated content
    print(f"Writing updated report...")
    report_file.write_text(new_content, encoding='utf-8')

    print(f"\n✓ Successfully converted {REPORT_PATH} to use Plotly CDN")
    print(f"  Original: {original_size:.1f} MB")
    print(f"  Updated: {new_size:.1f} MB")
    print(f"  Saved: {original_size - new_size:.1f} MB ({reduction:.1f}% reduction)")
    print(f"  Workouts: {new_workout_count}")
    print(f"  Charts: {new_chart_count}")
    print(f"  Backup: {backup_path}")

    return 0


if __name__ == '__main__':
    sys.exit(convert_to_cdn())
