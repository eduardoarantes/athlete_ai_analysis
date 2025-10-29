#!/usr/bin/env python3
"""
Prepare Report CLI Command

Extracts training plan data from interaction logs and creates report_data.json
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import List, Optional

from cycling_ai.tools.report_data_extractor import (
    extract_from_session_file,
    create_report_data
)

logger = logging.getLogger(__name__)


def setup_logging(verbose: bool = False):
    """Configure logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(levelname)s: %(message)s'
    )


def find_session_files(patterns: List[str]) -> List[Path]:
    """
    Find all session files matching patterns.

    Args:
        patterns: List of file paths or glob patterns

    Returns:
        List of Path objects for session files
    """
    files = []
    for pattern in patterns:
        path = Path(pattern)
        if path.is_file():
            files.append(path)
        elif '*' in pattern or '?' in pattern:
            # Glob pattern
            parent = Path(pattern).parent
            glob_pattern = Path(pattern).name
            if parent.exists():
                files.extend(parent.glob(glob_pattern))
        else:
            logger.warning(f"Pattern did not match any files: {pattern}")

    return sorted(set(files))


def find_athlete_profile(session_path: Path, athlete_dir: Optional[Path] = None) -> Optional[Path]:
    """
    Try to find athlete profile for a session.

    Args:
        session_path: Path to session JSONL
        athlete_dir: Optional base directory for athlete data

    Returns:
        Path to athlete_profile.json or None
    """
    # Strategy 1: Look for athlete_profile.json mentioned in session file
    # (We could parse the session to find it, but that's expensive)

    # Strategy 2: If athlete_dir provided, look there
    if athlete_dir:
        athlete_dir = Path(athlete_dir)
        if athlete_dir.is_dir():
            # Check if it's directly the athlete directory
            profile = athlete_dir / 'athlete_profile.json'
            if profile.exists():
                return profile

            # Check subdirectories
            for subdir in athlete_dir.iterdir():
                if subdir.is_dir():
                    profile = subdir / 'athlete_profile.json'
                    if profile.exists():
                        return profile

    # Strategy 3: Look in common locations relative to session
    # e.g., logs/llm_interactions/session.jsonl -> data/*/athlete_profile.json
    project_root = session_path.parent.parent.parent  # go up from logs/llm_interactions
    data_dir = project_root / 'data'

    if data_dir.exists():
        for athlete_subdir in data_dir.iterdir():
            if athlete_subdir.is_dir():
                profile = athlete_subdir / 'athlete_profile.json'
                if profile.exists():
                    # For now, return the first one found
                    # In multi-athlete scenarios, we'd need better matching
                    return profile

    return None


def prepare_report(
    session_patterns: List[str],
    output_path: Path,
    athlete_dir: Optional[Path] = None,
    validate: bool = True
) -> bool:
    """
    Prepare report data from session files.

    Args:
        session_patterns: List of session file patterns
        output_path: Where to save report_data.json
        athlete_dir: Optional directory containing athlete profiles
        validate: Whether to validate output against schema

    Returns:
        True if successful
    """
    logger.info("Finding session files...")
    session_files = find_session_files(session_patterns)

    if not session_files:
        logger.error("No session files found")
        return False

    logger.info(f"Found {len(session_files)} session file(s)")

    # Extract data from each session
    athletes = []
    for session_path in session_files:
        logger.info(f"Processing {session_path}...")

        # Find athlete profile
        profile_path = find_athlete_profile(session_path, athlete_dir)
        if profile_path:
            logger.info(f"  Found profile: {profile_path}")
        else:
            logger.warning(f"  No athlete profile found (will use data from session)")

        # Extract athlete data
        athlete_data = extract_from_session_file(session_path, profile_path)

        if athlete_data:
            athletes.append(athlete_data)
            logger.info(f"  ✓ Extracted data for {athlete_data['name']}")
        else:
            logger.warning(f"  ✗ Failed to extract data from {session_path}")

    if not athletes:
        logger.error("No athlete data extracted")
        return False

    logger.info(f"\nSuccessfully extracted data for {len(athletes)} athlete(s)")

    # Create report data structure
    generator_info = {
        'tool': 'cycling-ai',
        'version': '0.1.0',
        'command': ' '.join(sys.argv)
    }

    report_data = create_report_data(athletes, generator_info)

    # Validate if requested
    if validate:
        logger.info("Validating output...")
        if not validate_report_data(report_data):
            logger.error("Validation failed")
            return False
        logger.info("✓ Validation passed")

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(report_data, f, indent=2)

    logger.info(f"\n✓ Report data saved to: {output_path}")
    logger.info(f"\nSummary:")
    logger.info(f"  Athletes: {len(athletes)}")
    for athlete in athletes:
        logger.info(f"    - {athlete['name']} (ID: {athlete['id']})")
        logger.info(f"      FTP: {athlete['profile']['ftp']}W → {athlete['training_plan']['target_ftp']}W")
        logger.info(f"      Weeks: {athlete['training_plan']['total_weeks']}")

    return True


def validate_report_data(data: dict) -> bool:
    """
    Validate report data against schema.

    Args:
        data: Report data dict

    Returns:
        True if valid
    """
    try:
        import jsonschema

        # Load schema
        schema_path = Path(__file__).parent.parent.parent.parent / 'schemas' / 'report_data_schema.json'

        if not schema_path.exists():
            logger.warning(f"Schema not found at {schema_path}, skipping validation")
            return True

        with open(schema_path, 'r') as f:
            schema = json.load(f)

        # Validate
        jsonschema.validate(instance=data, schema=schema)
        return True

    except ImportError:
        logger.warning("jsonschema not installed, skipping validation")
        logger.warning("Install with: pip install jsonschema")
        return True

    except jsonschema.ValidationError as e:
        logger.error(f"Validation error: {e.message}")
        if e.path:
            logger.error(f"Path: {' -> '.join(str(p) for p in e.path)}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Prepare training plan report data from interaction logs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single session
  cycling-ai prepare-report --session logs/session_latest.jsonl

  # Multiple sessions
  cycling-ai prepare-report --sessions logs/llm_interactions/*.jsonl

  # With athlete directory
  cycling-ai prepare-report \\
    --session logs/session.jsonl \\
    --athlete-dir data/

  # Custom output location
  cycling-ai prepare-report \\
    --session logs/session.jsonl \\
    --output reports/report_data.json
        """
    )

    parser.add_argument(
        '--session',
        type=str,
        help='Single session JSONL file'
    )

    parser.add_argument(
        '--sessions',
        nargs='+',
        help='Multiple session files or glob pattern'
    )

    parser.add_argument(
        '--athlete-dir',
        type=Path,
        help='Directory containing athlete profiles (e.g., data/)'
    )

    parser.add_argument(
        '--output',
        '-o',
        type=Path,
        default=Path('logs/report_data.json'),
        help='Output file path (default: logs/report_data.json)'
    )

    parser.add_argument(
        '--no-validate',
        action='store_true',
        help='Skip validation against schema'
    )

    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Verbose output'
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    # Collect session patterns
    session_patterns = []
    if args.session:
        session_patterns.append(args.session)
    if args.sessions:
        session_patterns.extend(args.sessions)

    if not session_patterns:
        parser.error("Must specify --session or --sessions")

    # Prepare report
    success = prepare_report(
        session_patterns=session_patterns,
        output_path=args.output,
        athlete_dir=args.athlete_dir,
        validate=not args.no_validate
    )

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
