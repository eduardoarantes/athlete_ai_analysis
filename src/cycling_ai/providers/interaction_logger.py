"""
LLM Interaction Logger.

Logs all interactions with LLM providers including:
- System prompts
- User messages
- Tool definitions
- LLM responses
- Timestamps and metadata
- Token usage and cost estimation
- Database storage for analytics
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.logging_config import session_id_context
from cycling_ai.providers.base import CompletionResponse, ProviderMessage
from cycling_ai.providers.cost_estimator import ModelPricing
from cycling_ai.providers.db_storage import DatabaseStorage
from cycling_ai.providers.interaction_metrics import InteractionMetrics
from cycling_ai.providers.token_extractor import TokenExtractor
from cycling_ai.tools.base import ToolDefinition

# Configure logging
logger = logging.getLogger(__name__)


class InteractionLogger:
    """
    Logs all LLM interactions to structured files.

    Creates detailed logs of:
    - Input messages (system, user, assistant)
    - Available tools
    - LLM responses
    - Metadata (tokens, model, timing)
    """

    def __init__(self, log_dir: str | Path | None = None, enabled: bool = True):
        """
        Initialize interaction logger.

        Args:
            log_dir: Directory to store logs. Defaults to ./logs/llm_interactions
            enabled: Whether logging is enabled
        """
        self.enabled = enabled
        if not self.enabled:
            return

        if log_dir is None:
            log_dir = Path("./logs/llm_interactions")

        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Create session log file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_file = self.log_dir / f"session_{timestamp}.jsonl"
        self.interaction_count = 0

        # Generate unique session ID
        self.session_id = f"session_{timestamp}_{uuid.uuid4().hex[:8]}"

        # Set session ID in logging context for traceability
        session_id_context.set(self.session_id)

        # Initialize database storage (gracefully degrades if credentials missing)
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Need service role for insert
        self.db_storage = DatabaseStorage(supabase_url, supabase_key)

        logger.info(f"LLM interaction logging enabled. Log file: {self.session_file}")
        logger.info(f"Session ID: {self.session_id}")
        if self.db_storage.enabled:
            logger.info("Database logging enabled")

    def log_interaction(
        self,
        provider_name: str,
        model: str,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None,
        response: CompletionResponse,
        duration_ms: float | None = None,
        api_latency_ms: float | None = None,
        user_id: str | None = None,
        trigger_type: str = "system",
        triggered_by: str | None = None,
        prompt_version: str = "default",
        error_code: str | None = None,
        retry_count: int = 0,
    ) -> None:
        """
        Log a complete LLM interaction.

        Args:
            provider_name: Name of the provider (e.g., "gemini", "openai")
            model: Model name
            messages: Input messages sent to LLM
            tools: Available tools (if any)
            response: LLM response
            duration_ms: Total duration of operation in milliseconds
            api_latency_ms: Raw API response time in milliseconds
            user_id: ID of the user whose data is being analyzed
            trigger_type: How interaction was initiated (api_request, background_task, tool_call, system)
            triggered_by: What triggered this interaction (e.g., endpoint path, task name)
            prompt_version: Version identifier for the prompt template
            error_code: Error code if the interaction failed
            retry_count: Number of retries before success
        """
        if not self.enabled:
            return

        self.interaction_count += 1

        # Generate unique request ID for this interaction
        request_id = f"req_{uuid.uuid4().hex[:12]}"

        # Extract token counts from provider metadata
        input_tokens, output_tokens = TokenExtractor.extract_tokens(
            provider_name, response.metadata or {}
        )

        # Estimate cost
        estimated_cost = None
        if input_tokens is not None and output_tokens is not None:
            estimated_cost = ModelPricing.estimate_cost(
                provider_name, model, input_tokens, output_tokens
            )

        # Build interaction record for JSONL (includes prompts/responses)
        interaction = {
            "interaction_id": self.interaction_count,
            "session_id": self.session_id,
            "request_id": request_id,
            "timestamp": datetime.now().isoformat(),
            "provider": provider_name,
            "model": model,
            "prompt_version": prompt_version,
            "user_id": user_id,
            "trigger_type": trigger_type,
            "triggered_by": triggered_by,
            "duration_ms": duration_ms,
            "api_latency_ms": api_latency_ms,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost": estimated_cost,
            "error_code": error_code,
            "retry_count": retry_count,
            "input": {
                "messages": [self._format_message(msg) for msg in messages],
                "tools": [self._format_tool(tool) for tool in (tools or [])],
            },
            "output": {
                "content": response.content,
                "tool_calls": self._serialize_tool_calls(response.tool_calls),
                "metadata": self._serialize_metadata(response.metadata),
            },
        }

        # Write to JSONL file (one JSON object per line)
        try:
            with open(self.session_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(interaction, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to write interaction log: {e}")

        # Create metrics for database storage (excludes prompts/responses)
        metrics = InteractionMetrics(
            session_id=self.session_id,
            request_id=request_id,
            user_id=user_id,
            provider_name=provider_name,
            model=model,
            prompt_version=prompt_version,
            trigger_type=trigger_type,
            triggered_by=triggered_by,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=estimated_cost,
            duration_ms=duration_ms,
            api_latency_ms=api_latency_ms,
            error_code=error_code,
            retry_count=retry_count,
        )

        # Store to database
        self.db_storage.store_interaction(metrics)

        # Also log summary to console
        self._log_summary(interaction)

    def _format_message(self, msg: ProviderMessage) -> dict[str, Any]:
        """Format a message for logging."""
        return {
            "role": msg.role,
            "content": msg.content,
            "tool_calls": self._serialize_tool_calls(msg.tool_calls),
            "content_length": len(msg.content) if msg.content else 0,
        }

    def _format_tool(self, tool: ToolDefinition) -> dict[str, Any]:
        """Format a tool definition for logging."""
        return {
            "name": tool.name,
            "description": tool.description,
            "parameters": [
                {
                    "name": param.name,
                    "type": param.type,
                    "required": param.required,
                    "description": param.description,
                }
                for param in tool.parameters
            ],
        }

    def _serialize_tool_calls(self, tool_calls: Any) -> Any:
        """
        Serialize tool calls to JSON-compatible format.

        Handles both list of dicts and protobuf RepeatedComposite objects.
        """
        if tool_calls is None:
            return None

        # Convert to list if it's an iterable (handles RepeatedComposite)
        try:
            if not isinstance(tool_calls, (list, str)):
                tool_calls = list(tool_calls)
        except (TypeError, AttributeError):
            # Not iterable, convert to string
            return str(tool_calls)

        if isinstance(tool_calls, list):
            result = []
            for call in tool_calls:
                if isinstance(call, dict):
                    # Recursively serialize dict values
                    result.append(self._deep_serialize(call))
                else:
                    # Handle protobuf or other objects by converting to dict
                    try:
                        # Try to access common attributes
                        call_dict = {
                            "name": getattr(call, "name", None),
                            "id": getattr(call, "id", None),
                            "arguments": getattr(call, "arguments", None),
                        }
                        result.append(self._deep_serialize(call_dict))
                    except Exception:
                        # Fallback: convert to string
                        result.append(str(call))
            return result

        # If not a list, try to convert to string
        return str(tool_calls)

    def _deep_serialize(self, obj: Any) -> Any:
        """
        Recursively serialize an object to JSON-compatible format.

        Handles nested dicts, lists, and protobuf objects.
        """
        if obj is None:
            return None

        # Try direct JSON serialization first
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            pass

        # Handle dict
        if isinstance(obj, dict):
            result = {}
            for key, value in obj.items():
                result[key] = self._deep_serialize(value)
            return result

        # Handle list or iterable (including RepeatedComposite)
        if isinstance(obj, (list, tuple)):
            return [self._deep_serialize(item) for item in obj]

        # Try to convert iterables like RepeatedComposite
        try:
            if hasattr(obj, "__iter__") and not isinstance(obj, str):
                return [self._deep_serialize(item) for item in obj]
        except (TypeError, AttributeError):
            pass

        # Fallback: convert to string
        return str(obj)

    def _serialize_metadata(self, metadata: Any) -> Any:
        """
        Serialize metadata to JSON-compatible format.

        Handles nested dicts and converts non-serializable objects to strings.
        """
        if metadata is None:
            return None

        # Use deep serialization for all metadata
        return self._deep_serialize(metadata)

    def _log_summary(self, interaction: dict[str, Any]) -> None:
        """Log a summary to console."""
        # Build summary parts
        parts = [
            f"[Interaction #{interaction['interaction_id']}]",
            f"{interaction['provider']} / {interaction['model']}",
        ]

        # Add token and cost info
        if interaction.get("input_tokens") and interaction.get("output_tokens"):
            parts.append(
                f"Tokens: {interaction['input_tokens']} in / {interaction['output_tokens']} out"
            )

        if interaction.get("estimated_cost") is not None:
            parts.append(f"Cost: ${interaction['estimated_cost']:.4f}")

        # Add timing info
        if interaction.get("duration_ms") is not None:
            parts.append(f"Duration: {interaction['duration_ms']:.0f}ms")

        # Add trigger info
        if interaction.get("trigger_type"):
            parts.append(f"Trigger: {interaction['trigger_type']}")

        logger.info(" | ".join(parts))

    def get_session_log_path(self) -> Path:
        """Get the path to the current session log file."""
        return self.session_file


# Global logger instance
_global_logger: InteractionLogger | None = None


def get_interaction_logger() -> InteractionLogger:
    """Get or create the global interaction logger."""
    global _global_logger
    if _global_logger is None:
        _global_logger = InteractionLogger()
    return _global_logger


def set_interaction_logger(logger: InteractionLogger) -> None:
    """Set the global interaction logger."""
    global _global_logger
    _global_logger = logger
