#!/usr/bin/env python3
"""
Validate report data JSON against schema.

Usage:
    python scripts/validate_report_data.py logs/report_data.json
"""

import json
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import validate, ValidationError
except ImportError:
    print("Error: jsonschema package not installed")
    print("Install with: pip install jsonschema")
    sys.exit(1)


def load_schema() -> dict:
    """Load the JSON schema."""
    schema_path = Path(__file__).parent.parent / "schemas" / "report_data_schema.json"

    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")

    with open(schema_path, 'r') as f:
        return json.load(f)


def load_data(data_path: str) -> dict:
    """Load the report data JSON."""
    path = Path(data_path)

    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")

    with open(path, 'r') as f:
        return json.load(f)


def validate_report_data(data_path: str) -> bool:
    """
    Validate report data against schema.

    Args:
        data_path: Path to report data JSON file

    Returns:
        True if valid, False otherwise
    """
    try:
        print(f"Loading schema...")
        schema = load_schema()

        print(f"Loading data from {data_path}...")
        data = load_data(data_path)

        print(f"Validating data...")
        validate(instance=data, schema=schema)

        # Additional validation
        print(f"\nValidation successful!")
        print(f"\nData summary:")
        print(f"  Version: {data['version']}")
        print(f"  Generated: {data['generated_timestamp']}")
        print(f"  Number of athletes: {len(data['athletes'])}")

        for athlete in data['athletes']:
            print(f"\n  Athlete: {athlete['name']} (ID: {athlete['id']})")
            print(f"    FTP: {athlete['profile']['ftp']}W")
            print(f"    Training plan: {athlete['training_plan']['total_weeks']} weeks")
            print(f"    Target FTP: {athlete['training_plan']['target_ftp']}W")
            print(f"    Number of workouts: {sum(len(week['workouts']) for week in athlete['training_plan']['weekly_workouts'])}")

        return True

    except ValidationError as e:
        print(f"\n❌ Validation failed!")
        print(f"\nError: {e.message}")
        print(f"Path: {' -> '.join(str(p) for p in e.path)}")
        if e.schema_path:
            print(f"Schema path: {' -> '.join(str(p) for p in e.schema_path)}")
        return False

    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python scripts/validate_report_data.py <data_file.json>")
        print("\nExample:")
        print("  python scripts/validate_report_data.py logs/report_data.json")
        sys.exit(1)

    data_path = sys.argv[1]
    success = validate_report_data(data_path)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
