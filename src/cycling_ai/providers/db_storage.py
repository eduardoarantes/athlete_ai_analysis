"""
Database storage adapter for LLM interaction metadata.

This module provides utilities to store interaction metadata to Supabase
for analytics and cost tracking purposes.
"""

from __future__ import annotations

import logging
from typing import Any

from cycling_ai.providers.interaction_metrics import InteractionMetrics

logger = logging.getLogger(__name__)


class DatabaseStorage:
    """
    Stores interaction metadata to Supabase database.

    This class handles graceful degradation - if the database is unavailable
    or credentials are missing, logging operations will fail silently without
    crashing the application.
    """

    def __init__(self, supabase_url: str | None, supabase_key: str | None):
        """
        Initialize database storage adapter.

        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase service role key (with write access)
        """
        self.enabled = False
        self.client: Any = None

        # Check if credentials are provided
        if not supabase_url or not supabase_key:
            logger.info("Database logging disabled: Missing Supabase credentials")
            return

        # Try to initialize Supabase client
        try:
            from supabase import create_client

            self.client = create_client(supabase_url, supabase_key)
            self.enabled = True
            logger.info("Database logging enabled")
        except ImportError:
            logger.warning("Database logging disabled: supabase-py not installed")
        except Exception as e:
            logger.warning(f"Database logging disabled: Failed to initialize Supabase client: {e}")

    def store_interaction(self, metrics: InteractionMetrics) -> None:
        """
        Store interaction metadata to database.

        This method fails silently if the database is unavailable or if an
        error occurs during insertion. Logging should never crash the application.

        Args:
            metrics: Interaction metrics to store
        """
        if not self.enabled or not self.client:
            return

        try:
            # Convert metrics to dict for insertion
            data = metrics.to_dict()

            # Insert into llm_interactions table
            result = self.client.table("llm_interactions").insert(data).execute()

            logger.debug(f"Stored interaction metadata to database: {result.data}")

        except Exception as e:
            logger.error(f"Failed to store interaction to database: {e}")
            # Don't raise - graceful degradation
