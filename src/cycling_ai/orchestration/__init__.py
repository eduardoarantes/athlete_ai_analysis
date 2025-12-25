"""
Orchestration layer for API services.

Provides prompt loading and training plan generation support for the API.

Main Components:
- PromptLoader: Load and manage agent prompts
- RAG integration: Retrieval-augmented generation support
- TrainingPlanningLibrary: Library-based workout selection
"""

from __future__ import annotations

from .prompt_loader import PromptLoader
from .rag_integration import PromptAugmenter

__all__ = [
    "PromptLoader",
    "PromptAugmenter",
]
