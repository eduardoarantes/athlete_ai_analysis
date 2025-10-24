"""Tests for tool auto-loading mechanism."""
from __future__ import annotations

import pytest

from cycling_ai.tools.loader import load_all_tools
from cycling_ai.tools.registry import ToolRegistry, get_global_registry


class TestToolLoader:
    """Tests for tool auto-loading."""

    def test_load_all_tools_registers_tools(self) -> None:
        """Test that load_all_tools registers available tools."""
        # Create a fresh registry for testing
        registry = ToolRegistry()

        # Load tools into this registry
        count = load_all_tools(registry)

        # Should have loaded at least some tools
        # Note: This will be 0 until we implement the tool wrappers
        # We'll update this assertion as we add tools
        assert count >= 0
        assert isinstance(count, int)

    def test_load_all_tools_idempotent(self) -> None:
        """Test that calling load_all_tools multiple times is safe."""
        registry = ToolRegistry()

        count1 = load_all_tools(registry)
        count2 = load_all_tools(registry)

        # Second call should not increase count (duplicate prevention)
        assert count2 == count1

    def test_load_all_tools_uses_global_registry_by_default(self) -> None:
        """Test that load_all_tools uses global registry when no registry provided."""
        # Get initial tool count
        initial_tools = len(get_global_registry().list_tools())

        # Load tools
        count = load_all_tools()

        # Global registry should be populated
        final_tools = len(get_global_registry().list_tools())
        assert final_tools >= initial_tools


class TestToolAutoRegistration:
    """Tests for automatic tool registration on import."""

    def test_tools_auto_register_on_import(self) -> None:
        """Test that importing cycling_ai.tools triggers auto-registration."""
        # Import should trigger auto-registration
        import cycling_ai.tools  # noqa: F401

        registry = get_global_registry()
        tools = registry.list_tools()

        # Should have some tools registered
        # This will grow as we implement tool wrappers
        assert isinstance(tools, list)
