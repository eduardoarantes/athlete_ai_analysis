#!/usr/bin/env python3
"""
Report Data Extractor

Extracts training plan data from LLM interaction logs and consolidates
into the report_data.json format.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import re

logger = logging.getLogger(__name__)


def extract_tool_result_from_jsonl(
    jsonl_path: Path,
    tool_name: str,
    result_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Extract tool result from JSONL interaction log.

    Looks for interaction with specified tool call and its result.

    Args:
        jsonl_path: Path to JSONL file
        tool_name: Name of the tool to search for
        result_key: Optional key to look for in content (for validation)

    Returns:
        Dict with tool result data or None if not found
    """
    try:
        with open(jsonl_path, 'r') as f:
            interactions = []
            for line in f:
                try:
                    interaction = json.loads(line.strip())
                    interactions.append(interaction)
                except json.JSONDecodeError:
                    continue

        # Find the LAST interaction with the specified tool call
        # (there may be multiple if the agent made multiple attempts)
        tool_call_interaction_id = None
        for interaction in interactions:
            # Check output.tool_calls for the tool call
            if 'output' in interaction and interaction['output'].get('tool_calls'):
                for tool_call in interaction['output']['tool_calls']:
                    if tool_call.get('name') == tool_name:
                        tool_call_interaction_id = interaction.get('interaction_id')
                        # Don't break - keep looking for the last one

        if not tool_call_interaction_id:
            logger.warning(f"No {tool_name} tool call found in {jsonl_path}")
            return None

        # The tool result can be in TWO places:
        # 1. SAME interaction's output.content (for direct JSON responses like analyze_performance)
        # 2. NEXT interaction's input messages (for tool results that return in subsequent calls)

        # First check if the result is in the SAME interaction's output
        for interaction in interactions:
            if interaction.get('interaction_id') == tool_call_interaction_id:
                # Check if output.content has JSON data
                if 'output' in interaction and interaction['output'].get('content'):
                    content = interaction['output']['content']
                    # Check if content contains the expected key (if provided)
                    if result_key and result_key in content:
                        try:
                            tool_data = json.loads(content)
                            return tool_data
                        except json.JSONDecodeError:
                            pass  # Fall through to check next interaction

        # If not found in same interaction, check NEXT interaction
        next_interaction_id = tool_call_interaction_id + 1

        for interaction in interactions:
            if interaction.get('interaction_id') == next_interaction_id:
                # First try the output.content (for direct JSON responses)
                if 'output' in interaction and interaction['output'].get('content'):
                    content = interaction['output']['content']
                    if result_key and result_key in content:
                        try:
                            tool_data = json.loads(content)
                            return tool_data
                        except json.JSONDecodeError:
                            pass  # Fall through to check input messages

                # Then try input messages (for tool results)
                result = _parse_tool_output(interaction, jsonl_path, result_key)
                if result:
                    return result

        logger.warning(f"No {tool_name} result found for tool call in interaction {tool_call_interaction_id}")
        return None

    except FileNotFoundError:
        logger.error(f"File not found: {jsonl_path}")
        return None


def extract_training_plan_from_jsonl(jsonl_path: Path) -> Optional[Dict[str, Any]]:
    """
    Extract training plan from JSONL interaction log.

    Looks for interaction with generate_training_plan tool call and its result.

    Args:
        jsonl_path: Path to JSONL file

    Returns:
        Dict with training plan data or None if not found
    """
    return extract_tool_result_from_jsonl(jsonl_path, 'finalize_training_plan', 'weekly_plan')


def extract_performance_analysis_from_jsonl(jsonl_path: Path) -> Optional[Dict[str, Any]]:
    """
    Extract performance analysis from JSONL interaction log.

    Looks for interaction with analyze_performance tool call and its result.

    Args:
        jsonl_path: Path to JSONL file

    Returns:
        Dict with performance analysis data or None if not found
    """
    return extract_tool_result_from_jsonl(jsonl_path, 'analyze_performance', 'key_trends')


def _parse_tool_output(
    interaction: Dict[str, Any],
    source_path: Path,
    result_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Parse tool output from interaction.

    The tool result is embedded as JSON string in an assistant message's content.

    Args:
        interaction: Full interaction dict
        source_path: Path to source file
        result_key: Optional key to validate presence in result

    Returns:
        Parsed tool output data
    """
    # Look for tool result in input messages
    if 'input' in interaction and 'messages' in interaction['input']:
        messages = interaction['input']['messages']

        # Search for assistant messages containing the tool result
        for msg in messages:
            if msg.get('role') == 'assistant' and msg.get('content'):
                content = msg['content']

                # Check if content contains the expected key (if provided)
                if result_key and result_key not in content:
                    continue

                try:
                    # Parse the JSON from content
                    tool_data = json.loads(content)

                    # Add metadata
                    tool_data['metadata'] = {
                        'sources': {
                            'interaction_log': str(source_path),
                            'interaction_id': interaction.get('interaction_id')
                        },
                        'generated_at': interaction.get('timestamp'),
                        'llm_provider': interaction.get('provider'),
                        'llm_model': interaction.get('model'),
                        'generation_duration_ms': interaction.get('duration_ms')
                    }

                    return tool_data

                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse tool output JSON from content: {e}")
                    continue

    logger.warning(f"Could not find tool output data in interaction {interaction.get('interaction_id')}")
    return None


def load_athlete_profile(profile_path: Path) -> Dict[str, Any]:
    """
    Load athlete profile from JSON file.

    Args:
        profile_path: Path to athlete_profile.json

    Returns:
        Athlete profile dict
    """
    try:
        with open(profile_path, 'r') as f:
            profile = json.load(f)

        # Normalize the profile to match our format
        normalized = {
            'age': profile.get('age'),
            'gender': profile.get('gender'),
            'ftp': _parse_power_value(profile.get('FTP', profile.get('ftp'))),
            'weight_kg': _parse_weight_value(profile.get('weight', profile.get('weight_kg'))),
            'max_hr': profile.get('critical_HR', profile.get('max_hr')),
            'training_availability': profile.get('training_availability', {}),
            'goals': profile.get('goals'),
            'current_training_status': profile.get('current_training_status')
        }

        # Calculate power to weight
        if normalized['ftp'] and normalized['weight_kg']:
            normalized['power_to_weight'] = round(normalized['ftp'] / normalized['weight_kg'], 3)

        # Normalize training availability
        if 'training_availability' in normalized:
            avail = normalized['training_availability']
            if 'week_days' in avail and 'available_training_days' not in avail:
                # Parse week_days string into list
                days_str = avail['week_days']
                avail['available_training_days'] = [d.strip() for d in days_str.split(',')]

            if 'hours_per_week' in avail and 'weekly_training_hours' not in avail:
                avail['weekly_training_hours'] = avail['hours_per_week']

        return normalized

    except FileNotFoundError:
        logger.error(f"Profile not found: {profile_path}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in profile: {e}")
        return {}


def _parse_power_value(value: Any) -> Optional[int]:
    """Parse power value from various formats (260, '260w', '260W')."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        # Remove 'w' or 'W' suffix
        match = re.match(r'(\d+)', value.lower().replace('w', ''))
        if match:
            return int(match.group(1))
    return None


def _parse_weight_value(value: Any) -> Optional[float]:
    """Parse weight value from various formats (84, '84kg', '84.5 kg')."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove 'kg' suffix and whitespace
        match = re.match(r'([\d.]+)', value.lower().replace('kg', '').strip())
        if match:
            return float(match.group(1))
    return None


def find_athlete_id_from_path(profile_path: Path) -> str:
    """
    Derive athlete ID from profile path.

    Args:
        profile_path: Path like data/Athlete_Name/athlete_profile.json

    Returns:
        Athlete ID like 'athlete_name'
    """
    # Get the parent directory name
    athlete_dir = profile_path.parent.name
    # Convert to lowercase with underscores
    athlete_id = athlete_dir.lower().replace(' ', '_').replace('-', '_')
    return athlete_id

def consolidate_athlete_data(
    training_plan_data: Dict[str, Any],
    profile: Dict[str, Any],
    athlete_id: str,
    athlete_name: str,
    performance_analysis: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Consolidate all athlete data into report format.

    Expects NEW format with plan_metadata and weekly_plan (from prompts/default/1.1).
    Legacy format support has been removed.

    Args:
        training_plan_data: Training plan with plan_metadata and weekly_plan
        profile: Athlete profile
        athlete_id: Unique athlete ID
        athlete_name: Display name
        performance_analysis: Optional performance data

    Returns:
        Complete athlete object for report

    Raises:
        ValueError: If training_plan_data doesn't have expected NEW format structure
    """
    logger.info(f"[CONSOLIDATE] Starting consolidation for athlete: {athlete_name} (id={athlete_id})")
    logger.debug(f"[CONSOLIDATE] training_plan_data type: {type(training_plan_data)}")
    logger.debug(f"[CONSOLIDATE] training_plan_data keys: {list(training_plan_data.keys()) if isinstance(training_plan_data, dict) else 'N/A'}")

    # Validate NEW format structure (required fields)
    if 'plan_metadata' not in training_plan_data or 'weekly_plan' not in training_plan_data:
        raise ValueError(
            f"Invalid training plan format. Expected 'plan_metadata' and 'weekly_plan', "
            f"got keys: {list(training_plan_data.keys())}. "
            f"Legacy format is no longer supported. Use prompts/default/1.1 or later."
        )

    # Extract NEW format data
    plan_metadata = training_plan_data['plan_metadata']
    weekly_plan = training_plan_data['weekly_plan']
    coaching_notes = training_plan_data.get('coaching_notes', '')
    monitoring_guidance = training_plan_data.get('monitoring_guidance', '')

    logger.info(f"[CONSOLIDATE] Processing NEW format: {len(weekly_plan)} weeks, "
                f"target_ftp={plan_metadata.get('target_ftp')}")
    logger.debug(f"[CONSOLIDATE] plan_metadata keys: {list(plan_metadata.keys())}")
    logger.debug(f"[CONSOLIDATE] coaching_notes length: {len(coaching_notes)} chars")
    logger.debug(f"[CONSOLIDATE] monitoring_guidance length: {len(monitoring_guidance)} chars")

    # Create athlete object with training plan data
    athlete_obj = {
        'id': athlete_id,
        'name': athlete_name,
        'profile': profile,
        'training_plan': {
            'athlete_profile': training_plan_data.get('athlete_profile', {}),
            'plan_metadata': plan_metadata,
            'coaching_notes': coaching_notes,
            'monitoring_guidance': monitoring_guidance,
            'weekly_plan': weekly_plan,
        },
        'metadata': {}
    }

    # Add performance analysis if provided
    if performance_analysis:
        logger.info("[CONSOLIDATE] Adding performance_analysis to athlete_obj")
        athlete_obj['performance_analysis'] = performance_analysis
    else:
        logger.info("[CONSOLIDATE] No performance_analysis provided")

    logger.info(f"[CONSOLIDATE] Final athlete_obj keys: {list(athlete_obj.keys())}")
    logger.debug(f"[CONSOLIDATE] Returning consolidated athlete data")

    return athlete_obj


def create_report_data(
    athletes: List[Dict[str, Any]],
    generator_info: Dict[str, str],
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create final report_data.json structure.

    Args:
        athletes: List of athlete objects
        generator_info: Info about the tool that generated this
        session_id: Optional session ID for traceability

    Returns:
        Complete report data structure
    """
    logger.info(f"[CREATE_REPORT] Creating report_data with {len(athletes)} athlete(s)")

    for i, athlete in enumerate(athletes):
        logger.debug(f"[CREATE_REPORT] Athlete {i+1}: id={athlete.get('id', 'N/A')}, name={athlete.get('name', 'N/A')}")
        if 'training_plan' in athlete:
            tp = athlete['training_plan']
            logger.debug(f"[CREATE_REPORT] Athlete {i+1} training_plan keys: {list(tp.keys())}")
            # Check for weekly_plan in training_plan (NEW format)
            if 'weekly_plan' in tp:
                plan_metadata = tp.get('plan_metadata', {})
                target_ftp = plan_metadata.get('target_ftp', 'N/A')
                logger.info(f"[CREATE_REPORT] Athlete {i+1} has {len(tp['weekly_plan'])} weeks, target_ftp={target_ftp}")
            else:
                logger.warning(f"[CREATE_REPORT] Athlete {i+1} missing weekly_plan in training_plan")

    report_data = {
        'version': '1.0',
        'generated_timestamp': datetime.utcnow().isoformat() + 'Z',
        'generator': generator_info,
        'athletes': athletes
    }

    # Add session_id if provided
    if session_id:
        report_data['session_id'] = session_id

    logger.info("[CREATE_REPORT] report_data structure created successfully")
    return report_data


def extract_from_session_file(
    session_path: Path,
    athlete_profile_path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """
    Extract complete athlete data from a single session file.

    Args:
        session_path: Path to session JSONL file
        athlete_profile_path: Optional path to athlete profile JSON

    Returns:
        Athlete object or None if extraction failed
    """
    # Extract training plan from JSONL
    training_plan_data = extract_training_plan_from_jsonl(session_path)
    if not training_plan_data:
        logger.error(f"Failed to extract training plan from {session_path}")
        return None

    # Extract performance analysis from JSONL (optional - may not exist)
    performance_analysis = extract_performance_analysis_from_jsonl(session_path)
    if performance_analysis:
        logger.info(f"Extracted performance analysis from {session_path}")
    else:
        logger.warning(f"No performance analysis found in {session_path}")

    # Load athlete profile
    profile = {}
    athlete_id = 'athlete'
    athlete_name = 'Athlete'

    if athlete_profile_path and athlete_profile_path.exists():
        profile = load_athlete_profile(athlete_profile_path)
        athlete_id = find_athlete_id_from_path(athlete_profile_path)
        athlete_name = athlete_profile_path.parent.name
    elif 'athlete_profile' in training_plan_data:
        # Use profile from training plan data
        profile = training_plan_data['athlete_profile']
        athlete_id = profile.get('name', 'athlete').lower().replace(' ', '_')
        athlete_name = profile.get('name', 'Athlete')

    # Consolidate
    athlete_data = consolidate_athlete_data(
        training_plan_data=training_plan_data,
        profile=profile,
        athlete_id=athlete_id,
        athlete_name=athlete_name,
        performance_analysis=performance_analysis
    )

    return athlete_data
