"""Tool auto-loading and registration."""
from __future__ import annotations

import importlib
import logging
import pkgutil
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .registry import ToolRegistry

logger = logging.getLogger(__name__)


def load_all_tools(registry: ToolRegistry | None = None) -> int:
    """
    Load and register all available tool wrappers.

    Automatically discovers and imports all tool wrapper modules from
    the wrappers package, triggering their registration.

    Args:
        registry: Tool registry to use. If None, uses global registry.

    Returns:
        Number of tools loaded
    """
    if registry is None:
        from .registry import get_global_registry

        registry = get_global_registry()

    initial_count = len(registry.list_tools())

    try:
        # Import wrappers package to trigger registrations
        import cycling_ai.tools.wrappers  # noqa: F401

        # Discover and import all wrapper modules
        wrappers_package = importlib.import_module("cycling_ai.tools.wrappers")
        wrappers_path = getattr(wrappers_package, "__path__", [])

        for _, module_name, _ in pkgutil.iter_modules(wrappers_path):
            if module_name.startswith("_"):
                # Skip private modules
                continue

            try:
                importlib.import_module(f"cycling_ai.tools.wrappers.{module_name}")
                logger.debug(f"Loaded tool wrapper module: {module_name}")
            except Exception as e:
                logger.warning(f"Failed to load tool wrapper {module_name}: {e}")

    except ImportError:
        # Wrappers package doesn't exist yet - this is okay during early development
        logger.debug("Wrappers package not found, no tools loaded")

    final_count = len(registry.list_tools())
    tools_loaded = final_count - initial_count

    logger.info(f"Loaded {tools_loaded} tools ({final_count} total in registry)")

    return tools_loaded
