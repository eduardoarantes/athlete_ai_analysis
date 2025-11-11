"""Configuration schema models using Pydantic."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ProviderSettings(BaseModel):
    """Settings for a single LLM provider."""

    model: str
    max_tokens: int = Field(default=4096, ge=1, le=128000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    api_key_env: str = ""


class AnalysisSettings(BaseModel):
    """Default analysis settings."""

    period_months: int = Field(default=6, ge=1, le=24)
    use_cache: bool = True


class TrainingSettings(BaseModel):
    """Training plan settings."""

    total_weeks: int = Field(default=12, ge=4, le=24)


class PathSettings(BaseModel):
    """File path settings."""

    athlete_profile: str = ""
    activities_csv: str = ""
    fit_files_directory: str = ""


class OutputSettings(BaseModel):
    """Output formatting settings."""

    format: Literal["json", "markdown", "rich"] = "rich"
    verbose: bool = False
    color: bool = True


class RAGSettings(BaseModel):
    """RAG (Retrieval Augmented Generation) settings."""

    project_vectorstore: str = "data/vectorstore"
    user_vectorstore: str = "~/.cycling-ai/athlete_history"


class CyclingAIConfig(BaseModel):
    """Complete configuration for cycling AI analysis."""

    version: str = "1.3"
    default_provider: str = "anthropic"
    providers: dict[str, ProviderSettings]
    analysis: AnalysisSettings = Field(default_factory=AnalysisSettings)
    training: TrainingSettings = Field(default_factory=TrainingSettings)
    paths: PathSettings = Field(default_factory=PathSettings)
    output: OutputSettings = Field(default_factory=OutputSettings)
    rag: RAGSettings = Field(default_factory=RAGSettings)

    @model_validator(mode="after")
    def validate_default_provider(self) -> CyclingAIConfig:
        """Ensure default_provider exists in providers."""
        if self.default_provider not in self.providers:
            raise ValueError(
                f"default_provider '{self.default_provider}' not found in providers. "
                f"Available providers: {', '.join(self.providers.keys())}"
            )
        return self
