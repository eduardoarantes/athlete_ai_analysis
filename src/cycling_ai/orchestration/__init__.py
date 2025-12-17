"""
Orchestration layer for tool execution.

Provides modular orchestration of multi-phase workflows with specialized agents.

Main Components:
- MultiAgentOrchestrator: Backward compatibility wrapper (deprecated)
- FullReportWorkflow: Complete 4-phase report generation workflow
- BaseWorkflow: Abstract base for custom workflows
- Individual phases: DataPreparationPhase, PerformanceAnalysisPhase, etc.
- ToolExecutor: Direct tool execution
"""

from __future__ import annotations

from .executor import ToolExecutor
from .multi_agent import MultiAgentOrchestrator
from .workflows.base_workflow import BaseWorkflow
from .workflows.full_report import FullReportWorkflow

__all__ = [
    "ToolExecutor",
    "MultiAgentOrchestrator",  # Deprecated - use FullReportWorkflow
    "FullReportWorkflow",
    "BaseWorkflow",
]
