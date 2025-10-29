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


def extract_training_plan_from_jsonl(jsonl_path: Path) -> Optional[Dict[str, Any]]:
    """
    Extract training plan from JSONL interaction log.

    Looks for interaction with generate_training_plan tool call and its result.

    Args:
        jsonl_path: Path to JSONL file

    Returns:
        Dict with training plan data or None if not found
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

        # Find the LAST interaction with generate_training_plan tool call
        # (there may be multiple if the agent made multiple attempts)
        tool_call_interaction_id = None
        for interaction in interactions:
            # Check output.tool_calls for the tool call
            if 'output' in interaction and interaction['output'].get('tool_calls'):
                for tool_call in interaction['output']['tool_calls']:
                    if tool_call.get('name') == 'generate_training_plan':
                        tool_call_interaction_id = interaction.get('interaction_id')
                        # Don't break - keep looking for the last one

        if not tool_call_interaction_id:
            logger.warning(f"No generate_training_plan tool call found in {jsonl_path}")
            return None

        # The tool result is in the NEXT interaction's input messages
        # as a JSON string embedded in an assistant message content
        next_interaction_id = tool_call_interaction_id + 1

        for interaction in interactions:
            if interaction.get('interaction_id') == next_interaction_id:
                return _parse_training_plan_output(interaction, jsonl_path)

        logger.warning(f"No training plan result found for tool call in interaction {tool_call_interaction_id}")
        return None

    except FileNotFoundError:
        logger.error(f"File not found: {jsonl_path}")
        return None


def _parse_training_plan_output(interaction: Dict[str, Any], source_path: Path) -> Dict[str, Any]:
    """
    Parse training plan from interaction.

    The tool result is embedded as JSON string in an assistant message's content.

    Args:
        interaction: Full interaction dict
        source_path: Path to source file

    Returns:
        Parsed training plan data
    """
    # Look for tool result in input messages
    if 'input' in interaction and 'messages' in interaction['input']:
        messages = interaction['input']['messages']

        # Search for assistant messages containing weekly_workouts (the tool result)
        for msg in messages:
            if msg.get('role') == 'assistant' and msg.get('content'):
                content = msg['content']

                # Check if content contains the training plan JSON
                if 'weekly_workouts' in content:
                    try:
                        # Parse the JSON from content
                        training_plan_data = json.loads(content)

                        # Add metadata
                        training_plan_data['metadata'] = {
                            'sources': {
                                'interaction_log': str(source_path),
                                'interaction_id': interaction.get('interaction_id')
                            },
                            'generated_at': interaction.get('timestamp'),
                            'llm_provider': interaction.get('provider'),
                            'llm_model': interaction.get('model'),
                            'generation_duration_ms': interaction.get('duration_ms')
                        }

                        return training_plan_data

                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse training plan JSON from content: {e}")
                        continue

    logger.warning(f"Could not find training plan data in interaction {interaction.get('interaction_id')}")
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

    Args:
        training_plan_data: Training plan from JSONL
        profile: Athlete profile
        athlete_id: Unique athlete ID
        athlete_name: Display name
        performance_analysis: Optional performance data

    Returns:
        Complete athlete object for report
    """
    # Strip SVG from workouts (will be generated client-side in HTML viewer)
    weekly_workouts = training_plan_data.get('weekly_workouts', [])

    athlete_obj = {
        'id': athlete_id,
        'name': athlete_name,
        'profile': profile,
        'training_plan': {
            'current_ftp': training_plan_data.get('current_ftp', profile.get('ftp')),
            'target_ftp': training_plan_data.get('target_ftp'),
            'ftp_gain': training_plan_data.get('ftp_gain'),
            'ftp_gain_percent': training_plan_data.get('ftp_gain_percent'),
            'total_weeks': training_plan_data.get('total_weeks', 12),
            'available_days_per_week': training_plan_data.get('available_days_per_week'),
            'power_zones': training_plan_data.get('power_zones', {}),
            'weekly_workouts': weekly_workouts
        },
        'metadata': training_plan_data.get('metadata', {})
    }

    # Add plan structure if available in llm_context
    llm_context = training_plan_data.get('llm_context', {})
    if 'plan_structure' in llm_context:
        athlete_obj['training_plan']['plan_structure'] = llm_context['plan_structure']

    # Add plan text if available
    if 'plan_text' in training_plan_data:
        athlete_obj['training_plan']['plan_text'] = training_plan_data['plan_text']

    # Add performance analysis if provided
    if performance_analysis:
        athlete_obj['performance_analysis'] = performance_analysis

    return athlete_obj


def create_report_data(
    athletes: List[Dict[str, Any]],
    generator_info: Dict[str, str]
) -> Dict[str, Any]:
    """
    Create final report_data.json structure.

    Args:
        athletes: List of athlete objects
        generator_info: Info about the tool that generated this

    Returns:
        Complete report data structure
    """
    return {
        'version': '1.0',
        'generated_timestamp': datetime.utcnow().isoformat() + 'Z',
        'generator': generator_info,
        'athletes': athletes
    }


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
        athlete_name=athlete_name
    )

    return athlete_data
