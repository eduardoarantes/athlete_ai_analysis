"""
Logging configuration for cycling-ai.

Provides centralized logging setup with configurable levels, formatters,
and output destinations (console and optional file logging).
"""
import logging
import sys
from pathlib import Path
from typing import Optional


def configure_logging(
    level: int = logging.INFO,
    log_file: Optional[Path] = None,
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
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    simple_formatter = logging.Formatter(
        '%(levelname)s - %(message)s'
    )

    # Console handler
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(level)

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
        handlers.append(file_handler)

    # Configure root logger
    logging.basicConfig(
        level=logging.DEBUG,  # Capture everything at root level
        handlers=handlers,
        force=True,  # Override any existing configuration
    )

    # Set specific log levels for noisy libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('openai').setLevel(logging.WARNING)
    logging.getLogger('anthropic').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)

    # Google libraries can be very verbose
    logging.getLogger('google').setLevel(logging.WARNING)
    logging.getLogger('google.auth').setLevel(logging.WARNING)
    logging.getLogger('google.api_core').setLevel(logging.WARNING)

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
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL,
    }

    level_upper = level_str.upper()
    if level_upper not in level_map:
        valid_levels = ', '.join(level_map.keys())
        raise ValueError(
            f"Invalid log level: {level_str}. "
            f"Must be one of: {valid_levels}"
        )

    return level_map[level_upper]
