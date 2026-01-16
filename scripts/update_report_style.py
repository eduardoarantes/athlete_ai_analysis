#!/usr/bin/env python3
"""Update the CSS styling in the existing workout comparison report."""

import re
import sys

REPORT_PATH = "workout_comparison_report_dtw.html"

NEW_CSS = """    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      :root {
        color-scheme: light;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        line-height: 1.6;
        color: #1a1a2e;
        background: #f8fafc;
      }

      .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
      }

      header {
        text-align: center;
        margin-bottom: 3rem;
        padding-bottom: 2rem;
        border-bottom: 2px solid #e2e8f0;
      }

      h1 {
        font-size: 2.5rem;
        color: #1e293b;
        margin-bottom: 0.5rem;
        text-align: center;
        padding-bottom: 2rem;
        border-bottom: 2px solid #e2e8f0;
      }

      h2 {
        font-size: 1.5rem;
        color: #1e293b;
        margin-bottom: 1rem;
      }

      h3 {
        font-size: 1rem;
        margin-bottom: 0.5rem;
        color: #475569;
      }

      h4 {
        font-size: 0.875rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 0.75rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 1rem;
        align-items: start;
      }

      .chart {
        margin: 1rem 0 1.5rem;
      }

      .panels {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .panel {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .workout-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #475569;
      }

      .workout-section + .workout-section {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e2e8f0;
      }

      .workout-label {
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 0.5rem;
      }

      .workout-section ul {
        margin: 0;
        padding-left: 1.25rem;
      }

      .workout-section li {
        margin: 0.25rem 0;
      }

      .summary table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
      }

      .summary th,
      .summary td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
      }

      .summary th {
        background: #f1f5f9;
        font-weight: 600;
        color: #475569;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        font-size: 0.875rem;
      }

      .coach-table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        box-shadow: none;
      }

      .coach-table th,
      .coach-table td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
        font-size: 0.875rem;
        vertical-align: top;
      }

      .coach-table th {
        width: 180px;
        background: #f1f5f9;
        font-weight: 600;
        color: #475569;
      }

      th,
      td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
      }

      th {
        background: #f1f5f9;
        font-weight: 600;
        color: #475569;
      }

      tr:last-child td {
        border-bottom: none;
      }

      tr:hover {
        background: #f8fafc;
      }

      .workout {
        background: white;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .algo {
        background: #f8fafc;
        padding: 1rem;
        border-radius: 8px;
      }

      details {
        background: white;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin: 0.75rem 0;
        border: 1px solid #e2e8f0;
      }

      summary {
        cursor: pointer;
        font-weight: 600;
        color: #475569;
        list-style: none;
        padding: 0.5rem 0;
      }

      summary::-webkit-details-marker {
        display: none;
      }

      summary:hover {
        color: #1e293b;
      }

      details[open] summary {
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #e2e8f0;
      }

      details pre {
        margin: 0.75rem 0 0;
        background: #f1f5f9;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        font-size: 0.75rem;
        overflow-x: auto;
      }

      .coach-feedback {
        border-left: 4px solid #3b82f6;
      }
    </style>"""


def update_report_css():
    """Update the CSS in the workout comparison report."""
    print(f"Reading {REPORT_PATH}...")

    try:
        with open(REPORT_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: {REPORT_PATH} not found")
        return 1

    print(f"File size: {len(content) / 1024 / 1024:.1f} MB")

    # Find and replace the <style>...</style> section
    pattern = r'<style>.*?</style>'

    match = re.search(pattern, content, re.DOTALL)
    if not match:
        print("Error: Could not find <style> section in HTML")
        return 1

    print("Replacing CSS...")
    new_content = content[:match.start()] + NEW_CSS + content[match.end():]

    # Backup the original
    backup_path = REPORT_PATH + '.backup'
    print(f"Creating backup at {backup_path}...")
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)

    # Write the updated content
    print(f"Writing updated report...")
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"✓ Successfully updated {REPORT_PATH}")
    print(f"  Original backed up to {backup_path}")
    return 0


if __name__ == '__main__':
    sys.exit(update_report_css())
