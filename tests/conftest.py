"""Pytest configuration for cycling-ai tests."""

from typing import Any
from unittest.mock import patch

import pytest

from cycling_ai.orchestration.prompt_loader import PromptLoader


@pytest.fixture
def anyio_backend() -> str:
    """Configure anyio to use asyncio only (trio is not installed)."""
    return "asyncio"


# Default prompt version for tests
DEFAULT_TEST_PROMPT_VERSION = "1.3"


def _patched_get_prompt_loader(
    model: str | None = None,
    version: str | None = None,
    prompts_dir: Any = None,
) -> PromptLoader:
    """Patched get_prompt_loader that provides default version for tests."""
    return PromptLoader(
        prompts_base_dir=prompts_dir,
        model=model or "default",
        version=version or DEFAULT_TEST_PROMPT_VERSION,
    )


@pytest.fixture(autouse=True)
def patch_prompt_loader_version():
    """Auto-patch get_prompt_loader to use default version for tests."""
    with patch(
        "cycling_ai.orchestration.prompt_loader.get_prompt_loader",
        _patched_get_prompt_loader
    ):
        yield
