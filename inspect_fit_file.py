#!/usr/bin/env python3
"""
Inspect FIT Workout File

Dumps raw steps from a FIT workout file to debug parsing issues.
"""
import sys
from pathlib import Path
import fitdecode

def inspect_fit(fit_path):
    print(f"Inspecting: {fit_path}")
    
    try:
        with fitdecode.FitReader(fit_path) as fit_file:
            for frame in fit_file:
                if not isinstance(frame, fitdecode.FitDataMessage):
                    continue
                
                if frame.name == "workout_step":
                    print("\n--- Workout Step ---")
                    for field in frame.fields:
                        if field.value is not None:
                            print(f"{field.name}: {field.value} (Raw: {field.raw_value})")
                            
                elif frame.name == "workout":
                    print("\n--- Workout Metadata ---")
                    for field in frame.fields:
                        if field.value is not None:
                            print(f"{field.name}: {field.value}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_fit_file.py <fit_file>")
        sys.exit(1)
    
    inspect_fit(sys.argv[1])
