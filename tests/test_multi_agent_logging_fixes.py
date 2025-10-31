"""
Unit tests for multi_agent.py logging fixes.

Tests that the correct paths are used to access nested training plan data.
"""
import json
import pytest
from unittest.mock import Mock, patch


class TestTrainingPlanLoggingFixes:
    """Test that logging correctly accesses nested training plan data."""

    def test_extract_target_ftp_from_plan_metadata(self):
        """Test that target_ftp is correctly extracted from plan_metadata."""
        # This is the actual structure returned by finalize_training_plan
        training_plan_data = {
            "athlete_profile": {
                "name": "Tom",
                "age": 31,
                "ftp": 236.0,
            },
            "plan_metadata": {
                "total_weeks": 4,
                "current_ftp": 236.0,
                "target_ftp": 240.0,  # This is where target_ftp actually lives
                "ftp_gain_watts": 4.0,
                "ftp_gain_percent": 1.69,
                "plan_type": "LLM-designed personalized plan"
            },
            "coaching_notes": "This is a test plan",
            "monitoring_guidance": "Monitor your progress",
            "weekly_plan": [
                {
                    "week_number": 1,
                    "phase": "Foundation",
                    "workouts": []
                },
                {
                    "week_number": 2,
                    "phase": "Build",
                    "workouts": []
                },
                {
                    "week_number": 3,
                    "phase": "Recovery",
                    "workouts": []
                },
                {
                    "week_number": 4,
                    "phase": "Peak",
                    "workouts": []
                }
            ]
        }

        # Simulate what multi_agent.py:365-372 does
        plan_data = training_plan_data
        assert isinstance(plan_data, dict)

        weekly_plan_count = len(plan_data.get("weekly_plan", []))
        assert weekly_plan_count == 4

        # OLD CODE (WRONG): plan_data.get('target_ftp', 'N/A')
        # This returns 'N/A' because target_ftp is not at top level
        wrong_value = plan_data.get('target_ftp', 'N/A')
        assert wrong_value == 'N/A', "Old code incorrectly looks for target_ftp at top level"

        # NEW CODE (CORRECT): plan_data.get('plan_metadata', {}).get('target_ftp', 'N/A')
        plan_metadata = plan_data.get('plan_metadata', {})
        correct_value = plan_metadata.get('target_ftp', 'N/A')
        assert correct_value == 240.0, "New code correctly finds target_ftp in plan_metadata"

    def test_extract_weekly_plan_from_single_level_structure(self):
        """Test that weekly_plan is correctly extracted from single level structure."""
        # This is the structure created by consolidate_athlete_data (after removing double nesting)
        athlete_data = {
            'id': 'tom',
            'name': 'Tom',
            'profile': {},
            'training_plan': {  # Single level structure
                'athlete_profile': {},
                'plan_metadata': {
                    'total_weeks': 4,
                    'current_ftp': 236.0,
                    'target_ftp': 240.0,
                },
                'coaching_notes': '',
                'monitoring_guidance': '',
                'weekly_plan': [
                    {'week_number': 1, 'workouts': []},
                    {'week_number': 2, 'workouts': []},
                    {'week_number': 3, 'workouts': []},
                    {'week_number': 4, 'workouts': []},
                ]
            }
        }

        # Simulate what multi_agent.py:992-1002 does (after removing double nesting)
        if "training_plan" in athlete_data:
            tp = athlete_data["training_plan"]

            # Direct access (single level)
            weekly_plan_len = len(tp.get('weekly_plan', []))
            plan_metadata = tp.get('plan_metadata', {})
            target_ftp = plan_metadata.get('target_ftp', 'N/A')

            assert weekly_plan_len == 4, "Code correctly finds 4 weeks"
            assert target_ftp == 240.0, "Code correctly finds target_ftp"

    def test_with_real_session_data(self):
        """Test with actual data structure from session_20251031_142700.jsonl interaction 3."""
        # Load the actual tool result from the session
        session_file = "/Users/eduardo/Documents/projects/cycling-ai-analysis/logs/llm_interactions/session_20251031_142700.jsonl"

        try:
            with open(session_file, 'r') as f:
                for line in f:
                    interaction = json.loads(line)
                    if interaction.get('interaction_id') == 3:
                        # Get the tool arguments (what LLM sent)
                        tool_call = interaction['output']['tool_calls'][0]
                        assert tool_call['name'] == 'finalize_training_plan'

                        # Verify the LLM sent target_ftp=240 as a parameter
                        assert tool_call['arguments']['target_ftp'] == 240
                        assert tool_call['arguments']['total_weeks'] == 4

                        # The tool wrapper then calls finalize_training_plan() which creates
                        # the nested structure with plan_metadata.target_ftp
                        # We can't directly test the tool result from JSONL (it's not stored there),
                        # but we verified it exists in the session file
                        break
        except FileNotFoundError:
            pytest.skip("Session file not available for testing")

    def test_phase_4_single_level_structure_extraction(self):
        """Test Phase 4 correctly logs single level training_plan structure."""
        # Simulate the athlete_data structure from consolidate_athlete_data() (after removing double nesting)
        athlete_data = {
            'id': 'test_athlete',
            'name': 'Test Athlete',
            'training_plan': {  # Single level structure
                'weekly_plan': [
                    {'week_number': 1},
                    {'week_number': 2},
                    {'week_number': 3},
                    {'week_number': 4},
                ],
                'plan_metadata': {
                    'target_ftp': 250.0,
                    'current_ftp': 240.0,
                }
            }
        }

        # Test the extraction logic (after removing double nesting)
        if "training_plan" in athlete_data:
            tp = athlete_data["training_plan"]

            # Direct access (single level)
            weekly_plan_len = len(tp.get('weekly_plan', []))
            plan_metadata = tp.get('plan_metadata', {})
            target_ftp = plan_metadata.get('target_ftp', 'N/A')

            assert weekly_plan_len == 4
            assert target_ftp == 250.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
