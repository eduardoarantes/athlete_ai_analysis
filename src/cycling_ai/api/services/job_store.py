"""
In-memory job storage for background task tracking.

Simple dictionary-based storage for MVP. Can be replaced with database later.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Job execution status."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Job:
    """Represents a background job."""

    job_id: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    result: dict[str, Any] | None = None
    error: str | None = None
    progress: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert job to dictionary for API responses."""
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "result": self.result,
            "error": self.error,
            "progress": self.progress,
        }


class JobStore:
    """
    In-memory storage for background jobs.

    Thread-safe job storage using asyncio locks.
    """

    def __init__(self) -> None:
        """Initialize job store."""
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()

    async def create_job(self) -> str:
        """
        Create a new job and return its ID.

        Returns:
            Job ID string
        """
        job_id = f"plan_{int(datetime.now().timestamp())}_{uuid4().hex[:8]}"

        async with self._lock:
            job = Job(
                job_id=job_id,
                status=JobStatus.QUEUED,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            self._jobs[job_id] = job

        logger.info(f"[JOB STORE] Created job: {job_id}")
        return job_id

    async def get_job(self, job_id: str) -> Job | None:
        """
        Get job by ID.

        Args:
            job_id: Job identifier

        Returns:
            Job object or None if not found
        """
        async with self._lock:
            return self._jobs.get(job_id)

    async def update_status(
        self,
        job_id: str,
        status: JobStatus,
        result: dict[str, Any] | None = None,
        error: str | None = None,
        progress: dict[str, Any] | None = None,
    ) -> None:
        """
        Update job status and data.

        Args:
            job_id: Job identifier
            status: New status
            result: Job result data (for completed jobs)
            error: Error message (for failed jobs)
            progress: Progress information
        """
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                logger.warning(f"[JOB STORE] Job not found: {job_id}")
                return

            job.status = status
            job.updated_at = datetime.now()

            if result is not None:
                job.result = result

            if error is not None:
                job.error = error

            if progress is not None:
                job.progress = progress

        logger.info(f"[JOB STORE] Updated job {job_id}: status={status.value}")

    async def delete_job(self, job_id: str) -> None:
        """
        Delete job from store.

        Args:
            job_id: Job identifier
        """
        async with self._lock:
            if job_id in self._jobs:
                del self._jobs[job_id]
                logger.info(f"[JOB STORE] Deleted job: {job_id}")

    async def get_all_jobs(self) -> list[Job]:
        """
        Get all jobs.

        Returns:
            List of all jobs
        """
        async with self._lock:
            return list(self._jobs.values())


# Global singleton instance
_job_store: JobStore | None = None


def get_job_store() -> JobStore:
    """
    Get global job store instance.

    Returns:
        JobStore singleton
    """
    global _job_store
    if _job_store is None:
        _job_store = JobStore()
    return _job_store
