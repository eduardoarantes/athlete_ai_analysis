"""Tool definitions and registry for cycling AI analysis."""
from __future__ import annotations

# Import loader to make it available
from .loader import load_all_tools

# Trigger auto-registration of tools on import
load_all_tools()

__all__ = ["load_all_tools"]
