"""
LLM Interaction Logger.

Logs all interactions with LLM providers including:
- System prompts
- User messages
- Tool definitions
- LLM responses
- Timestamps and metadata
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.providers.base import CompletionResponse, ProviderMessage
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

        logger.info(f"LLM interaction logging enabled. Log file: {self.session_file}")

    def log_interaction(
        self,
        provider_name: str,
        model: str,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None,
        response: CompletionResponse,
        duration_ms: float | None = None,
    ) -> None:
        """
        Log a complete LLM interaction.

        Args:
            provider_name: Name of the provider (e.g., "gemini", "openai")
            model: Model name
            messages: Input messages sent to LLM
            tools: Available tools (if any)
            response: LLM response
            duration_ms: Duration of API call in milliseconds
        """
        if not self.enabled:
            return

        self.interaction_count += 1

        # Build interaction record
        interaction = {
            "interaction_id": self.interaction_count,
            "timestamp": datetime.now().isoformat(),
            "provider": provider_name,
            "model": model,
            "duration_ms": duration_ms,
            "input": {
                "messages": [self._format_message(msg) for msg in messages],
                "tools": [self._format_tool(tool) for tool in (tools or [])],
            },
            "output": {
                "content": response.content,
                "tool_calls": response.tool_calls,
                "metadata": response.metadata,
            },
        }

        # Write to JSONL file (one JSON object per line)
        try:
            with open(self.session_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(interaction, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to write interaction log: {e}")

        # Also log summary to console
        self._log_summary(interaction)

    def _format_message(self, msg: ProviderMessage) -> dict[str, Any]:
        """Format a message for logging."""
        return {
            "role": msg.role,
            "content": msg.content,
            "tool_calls": msg.tool_calls,
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

    def _log_summary(self, interaction: dict[str, Any]) -> None:
        """Log a summary to console."""
        logger.info(
            f"[Interaction #{interaction['interaction_id']}] "
            f"{interaction['provider']} / {interaction['model']} | "
            f"Messages: {len(interaction['input']['messages'])} | "
            f"Tools: {len(interaction['input']['tools'])} | "
            f"Response length: {len(interaction['output']['content']) if interaction['output']['content'] else 0} | "
            f"Tool calls: {len(interaction['output']['tool_calls']) if interaction['output']['tool_calls'] else 0} | "
            f"Duration: {interaction['duration_ms']:.0f}ms" if interaction['duration_ms'] else ""
        )

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
