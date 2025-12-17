"""
Logging configuration for cycling-ai.

Provides centralized logging setup with configurable levels, formatters,
and output destinations (console and optional file logging).
"""

import contextvars
import logging
import sys
from pathlib import Path

# Context variable to track current session ID across the call stack
# Default is "in-progress" for logs outside of a session context
session_id_context: contextvars.ContextVar[str] = contextvars.ContextVar(
    "session_id", default="in-progress"
)


class SessionLogFilter(logging.Filter):
    """
    Inject session_id from context into every log record.

    This filter automatically adds the session_id from the context variable
    to each log record, enabling correlation between application logs and
    LLM interaction logs stored in logs/llm_interactions/session_*.jsonl files.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add session_id attribute to log record from context."""
        record.session_id = session_id_context.get()
        return True


def configure_logging(
    level: int = logging.INFO,
    log_file: Path | None = None,
    verbose: bool = False,
) -> None:
    """
    Configure logging for cycling-ai.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional file path for log output
        verbose: If True, uses detailed formatter even for console output

    Example:
        >>> from cycling_ai.logging_config import configure_logging
        >>> import logging
        >>> configure_logging(level=logging.DEBUG, log_file=Path("logs/debug.log"))
    """
    # Create formatters with session_id as FIRST field
    detailed_formatter = logging.Formatter(
        "[%(session_id)s] - %(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    simple_formatter = logging.Formatter("[%(session_id)s] - %(levelname)s - %(message)s")

    # Create session filter
    session_filter = SessionLogFilter()

    # Console handler
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(level)
    console_handler.addFilter(session_filter)

    # Use detailed formatter for DEBUG level or if verbose is True
    if level <= logging.DEBUG or verbose:
        console_handler.setFormatter(detailed_formatter)
    else:
        console_handler.setFormatter(simple_formatter)

    # Build handlers list
    handlers = [console_handler]

    # File handler (optional)
    if log_file:
        # Ensure parent directory exists
        log_file.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)  # Always DEBUG to file
        file_handler.setFormatter(detailed_formatter)
        file_handler.addFilter(session_filter)
        handlers.append(file_handler)

    # Configure root logger
    logging.basicConfig(
        level=logging.DEBUG,  # Capture everything at root level
        handlers=handlers,
        force=True,  # Override any existing configuration
    )

    # Set specific log levels for noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("anthropic").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    # Google libraries can be very verbose
    logging.getLogger("google").setLevel(logging.WARNING)
    logging.getLogger("google.auth").setLevel(logging.WARNING)
    logging.getLogger("google.api_core").setLevel(logging.WARNING)

    # Log configuration complete
    logger = logging.getLogger(__name__)
    logger.debug(f"Logging configured: level={logging.getLevelName(level)}, file={log_file}")


def get_log_level_from_string(level_str: str) -> int:
    """
    Convert string log level to logging constant.

    Args:
        level_str: Log level as string (DEBUG, INFO, WARNING, ERROR)

    Returns:
        Logging level constant

    Raises:
        ValueError: If level_str is not a valid log level

    Example:
        >>> level = get_log_level_from_string("DEBUG")
        >>> level == logging.DEBUG
        True
    """
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }

    level_upper = level_str.upper()
    if level_upper not in level_map:
        valid_levels = ", ".join(level_map.keys())
        raise ValueError(f"Invalid log level: {level_str}. Must be one of: {valid_levels}")

    return level_map[level_upper]
