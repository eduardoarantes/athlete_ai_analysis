#!/usr/bin/env python3
"""
Convert existing report from inline Plotly to CDN to reduce file size.

This script removes all inline Plotly.js library instances and replaces them with a single CDN script tag.
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

    # Pattern to match the entire Plotly library inline code
    # Each chart has: window.PlotlyConfig + huge library code
    # We want to remove from window.PlotlyConfig to the end of the library script
    # but keep the Plotly.newPlot calls

    # The pattern is:
    # <script type="text/javascript">window.PlotlyConfig = ...</script>
    # <script type="text/javascript">/**  [HUGE LIBRARY CODE] ...</script>

    # We need to match these two consecutive script tags
    pattern = (
        r'<script type="text/javascript">window\.PlotlyConfig = \{MathJaxConfig: \'local\'\};</script>\s*'
        r'<script type="text/javascript">/\*\*.*?</script>'
    )

    new_content = content
    matches = list(re.finditer(pattern, content, re.DOTALL))

    print(f"Found {len(matches)} Plotly library instances")

    total_removed_size = 0
    for i, match in enumerate(reversed(matches)):  # Reverse to maintain indices
        removed_size = len(match.group(0))
        total_removed_size += removed_size
        print(f"  Removing instance {len(matches) - i} ({removed_size / 1024:.1f} KB)")
        new_content = new_content[:match.start()] + new_content[match.end():]

    print(f"Removed {len(matches)} library instance(s) ({total_removed_size / 1024 / 1024:.1f} MB)")

    # Verify we didn't remove chart divs or Plotly.newPlot calls
    new_workout_count = new_content.count('<section class="workout">')
    new_chart_count = new_content.count('Plotly.newPlot')

    print(f"\nVerification:")
    print(f"  Workout sections: {new_workout_count} (was {workout_count})")
    print(f"  Plotly.newPlot calls: {new_chart_count}")

    if new_workout_count != workout_count:
        print(f"\nERROR: Lost workout sections! {workout_count} -> {new_workout_count}")
        return 1

    # Add CDN script tag in the <head> section, after the closing </style> tag
    head_pattern = r'(</style>\s*</head>)'
    if not re.search(head_pattern, new_content):
        print("ERROR: Could not find </style></head> in content")
        return 1

    new_content = re.sub(
        head_pattern,
        f'</style>\n    {PLOTLY_CDN}\n  </head>',
        new_content,
        count=1
    )

    # Verify CDN was added
    if PLOTLY_CDN not in new_content:
        print("ERROR: Failed to add CDN script tag")
        return 1

    new_size = len(new_content) / 1024 / 1024
    reduction = ((original_size - new_size) / original_size) * 100

    print(f"\nResults:")
    print(f"  Original size: {original_size:.1f} MB")
    print(f"  New size: {new_size:.1f} MB")
    print(f"  Reduction: {original_size - new_size:.1f} MB ({reduction:.1f}%)")

    # Backup original
    backup_path = report_file.with_suffix('.html.cdn_backup')
    print(f"\nCreating backup at {backup_path}...")
    backup_path.write_text(content, encoding='utf-8')

    # Write updated content
    print(f"Writing updated report...")
    report_file.write_text(new_content, encoding='utf-8')

    print(f"\n✓ Successfully converted {REPORT_PATH} to use Plotly CDN")
    print(f"  Workouts: {new_workout_count}")
    print(f"  Charts: {new_chart_count}")

    return 0


if __name__ == '__main__':
    sys.exit(convert_to_cdn())
