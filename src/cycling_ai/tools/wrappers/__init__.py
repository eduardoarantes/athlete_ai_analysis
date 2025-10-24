"""
Tool wrappers package.

This package contains concrete implementations of BaseTool that wrap
core business logic functions for use with LLM providers.

All tools are automatically registered with the global registry on import.
"""
from __future__ import annotations

from .cross_training_tool import CrossTrainingTool
from .performance import PerformanceAnalysisTool
from .report_tool import ReportGenerationTool
from .training_plan_tool import TrainingPlanTool
from .zones_tool import ZoneAnalysisTool

__all__ = [
    "PerformanceAnalysisTool",
    "ZoneAnalysisTool",
    "TrainingPlanTool",
    "CrossTrainingTool",
    "ReportGenerationTool",
]
