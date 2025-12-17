"""JSON validation utilities for LLM outputs."""

from __future__ import annotations

import json
import logging
import re

from pydantic import ValidationError

from cycling_ai.models.performance_analysis import PerformanceAnalysis

logger = logging.getLogger(__name__)


def extract_and_validate_performance_analysis(llm_output: str) -> PerformanceAnalysis:
    """
    Extract JSON from LLM output and validate against schema.

    Handles cases where LLM wraps JSON in markdown code blocks or adds extra text.

    Args:
        llm_output: Raw output from LLM

    Returns:
        Validated PerformanceAnalysis object

    Raises:
        ValueError: If JSON cannot be extracted or validated
    """
    # Try to extract JSON from the output
    json_str = _extract_json(llm_output)

    if not json_str:
        raise ValueError(
            f"No valid JSON found in LLM output. Output preview: {llm_output[:200]}..."
        )

    # Parse JSON
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        logger.error(f"Attempted to parse: {json_str[:500]}...")
        raise ValueError(f"Invalid JSON in LLM output: {e}") from e

    # Validate against Pydantic model
    try:
        return PerformanceAnalysis(**data)
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        logger.error(f"Data received: {json.dumps(data, indent=2)}")
        raise ValueError(f"LLM output does not match expected schema: {e}") from e


def _extract_json(text: str) -> str | None:
    """
    Extract JSON from text that may contain markdown code blocks or extra content.

    Tries multiple strategies:
    1. Look for JSON in markdown code blocks
    2. Look for raw JSON objects
    3. Strip common prefixes/suffixes

    Args:
        text: Text potentially containing JSON

    Returns:
        Extracted JSON string or None
    """
    text = text.strip()

    # Strategy 1: Extract from markdown code blocks
    # Matches: ```json\n{...}\n``` or ```\n{...}\n```
    code_block_patterns = [
        r"```json\s*\n(.*?)\n```",
        r"```\s*\n(.*?)\n```",
    ]

    for pattern in code_block_patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
            if _is_valid_json_start(json_str):
                return json_str

    # Strategy 2: Look for JSON object boundaries
    # Find outermost { ... } that looks like JSON
    start_idx = text.find("{")
    if start_idx != -1:
        # Find matching closing brace
        end_idx = _find_matching_brace(text, start_idx)
        if end_idx != -1:
            json_str = text[start_idx : end_idx + 1]
            if _is_valid_json_start(json_str):
                return json_str

    # Strategy 3: Try the whole text (maybe it's already clean JSON)
    if _is_valid_json_start(text):
        return text

    return None


def _is_valid_json_start(text: str) -> bool:
    """Check if text starts like valid JSON."""
    text = text.strip()
    return text.startswith("{") or text.startswith("[")


def _find_matching_brace(text: str, start_idx: int) -> int:
    """
    Find the index of the closing brace that matches the opening brace at start_idx.

    Args:
        text: Text containing braces
        start_idx: Index of opening brace

    Returns:
        Index of matching closing brace, or -1 if not found
    """
    if text[start_idx] != "{":
        return -1

    depth = 0
    in_string = False
    escape_next = False

    for i in range(start_idx, len(text)):
        char = text[i]

        if escape_next:
            escape_next = False
            continue

        if char == "\\":
            escape_next = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return i

    return -1
