"""
AI-Powered Performance Analysis Service.

Fetches activity data from Supabase (synced from Strava) and runs performance analysis.
"""

from __future__ import annotations

import json
import logging
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

from cycling_ai.api.config import settings
from cycling_ai.api.models.analysis import PerformanceAnalysisRequest
from cycling_ai.core.performance import analyze_performance
from cycling_ai.providers.base import ProviderConfig, ProviderMessage
from cycling_ai.providers.factory import ProviderFactory

logger = logging.getLogger(__name__)


class AIAnalysisService:
    """
    Service for AI-powered performance analysis.

    Flow:
    1. Fetch activities from Supabase (strava_activities table)
    2. Convert to DataFrame and save as Parquet cache
    3. Run performance analysis (deterministic, no LLM)
    4. Synthesize insights with LLM
    """

    def __init__(self) -> None:
        """Initialize the AI analysis service."""
        self._provider = None
        self._provider_name = settings.ai_provider
        self._model_name = settings.get_default_model()

        # Supabase config
        self._supabase_url = settings.supabase_url
        self._supabase_key = settings.supabase_service_role_key

    def _get_provider(self) -> Any:
        """Get or create the LLM provider instance."""
        if self._provider is None:
            api_key = settings.get_provider_api_key()
            if not api_key:
                raise ValueError(
                    f"No API key configured for provider '{self._provider_name}'. "
                    f"Set the appropriate environment variable."
                )

            config = ProviderConfig(
                provider_name=self._provider_name,
                api_key=api_key,
                model=self._model_name,
                max_tokens=settings.ai_max_tokens,
                temperature=settings.ai_temperature,
            )

            self._provider = ProviderFactory.create_provider(config)
            logger.info(
                f"[AI ANALYSIS SERVICE] Created provider: {self._provider_name} "
                f"with model {self._model_name}"
            )

        return self._provider

    async def analyze_performance(
        self,
        request: PerformanceAnalysisRequest,
    ) -> dict[str, Any]:
        """
        Run performance analysis pipeline.

        Args:
            request: Performance analysis request with user_id

        Returns:
            Dictionary with performance_analysis and ai_metadata

        Raises:
            ValueError: If analysis fails
        """
        logger.info(
            f"[AI ANALYSIS SERVICE] Starting performance analysis for user {request.user_id}: "
            f"period_months={request.period_months}"
        )

        # Step 1: Fetch activities from Supabase
        logger.info("[AI ANALYSIS SERVICE] Step 1: Fetching activities from Supabase...")
        activities = await self._fetch_activities(
            user_id=request.user_id,
            period_months=request.period_months,
        )

        if not activities:
            raise ValueError(
                f"No activities found for user {request.user_id} in the last {request.period_months} months"
            )

        logger.info(f"[AI ANALYSIS SERVICE] Found {len(activities)} activities")

        # Step 2: Convert to DataFrame and save as Parquet cache
        logger.info("[AI ANALYSIS SERVICE] Step 2: Creating Parquet cache...")
        df = self._activities_to_dataframe(activities)
        cache_path = self._save_parquet_cache(df)

        try:
            # Step 3: Run performance analysis
            logger.info("[AI ANALYSIS SERVICE] Step 3: Running performance analysis...")
            analysis_result_str = analyze_performance(
                csv_file_path=str(cache_path),
                athlete_name=request.athlete_profile.name or "API User",
                athlete_age=request.athlete_profile.age,
                athlete_weight_kg=request.athlete_profile.weight_kg,
                athlete_ftp=float(request.athlete_profile.ftp) if request.athlete_profile.ftp else None,
                athlete_max_hr=request.athlete_profile.max_hr,
                period_months=request.period_months,
            )

            # Parse the JSON result
            if analysis_result_str.startswith("❌"):
                raise ValueError(analysis_result_str)

            analysis_result = json.loads(analysis_result_str)
            logger.info("[AI ANALYSIS SERVICE] Performance analysis completed")

            # Step 4: Synthesize insights with LLM
            logger.info("[AI ANALYSIS SERVICE] Step 4: Synthesizing insights...")
            enhanced_result = await self._synthesize_insights(analysis_result)

            result = {
                "performance_analysis": enhanced_result,
                "raw_data": analysis_result,
                "activities_analyzed": len(activities),
                "ai_metadata": {
                    "ai_provider": self._provider_name,
                    "ai_model": self._model_name,
                    "library_version": "1.0.0",
                },
            }

            logger.info("[AI ANALYSIS SERVICE] Analysis complete")
            return result

        finally:
            # Clean up temp cache file
            if cache_path.exists():
                cache_path.unlink()

    async def _fetch_activities(
        self,
        user_id: str,
        period_months: int,
    ) -> list[dict[str, Any]]:
        """
        Fetch activities from Supabase strava_activities table.

        Args:
            user_id: User ID
            period_months: Number of months to look back (doubled for comparison period)

        Returns:
            List of activity dictionaries
        """
        if not self._supabase_url or not self._supabase_key:
            raise ValueError("Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

        # Calculate date range - fetch double the period for comparison analysis
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_months * 30 * 2)

        url = f"{self._supabase_url}/rest/v1/strava_activities"
        params = {
            "user_id": f"eq.{user_id}",
            "start_date": f"gte.{start_date.isoformat()}",
            "order": "start_date.desc",
            "select": "*",
        }

        headers = {
            "apikey": self._supabase_key,
            "Authorization": f"Bearer {self._supabase_key}",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()

    def _activities_to_dataframe(self, activities: list[dict[str, Any]]) -> pd.DataFrame:
        """
        Convert Supabase activities to DataFrame format expected by analysis tools.

        Maps Supabase column names to the Parquet cache format used by
        load_activities_data() in cycling_ai.core.utils.
        """
        records = []
        for activity in activities:
            # Distance from Strava is in meters
            distance_m = activity.get("distance", 0) or 0
            elapsed_time = activity.get("elapsed_time", 0) or 0
            moving_time = activity.get("moving_time", 0) or 0

            # Calculate average speed (m/s) if moving time > 0
            avg_speed_ms = distance_m / moving_time if moving_time > 0 else 0

            records.append({
                "Activity Date": activity.get("start_date"),
                "Activity Name": activity.get("name") or "Untitled",
                "Activity Type": activity.get("type", "Ride"),
                "Elapsed Time": elapsed_time,
                "Moving Time": moving_time,
                "Distance": distance_m,  # Keep in meters - analysis code converts
                "Elevation Gain": activity.get("total_elevation_gain", 0) or 0,
                "Average Heart Rate": activity.get("average_heartrate", 0) or 0,
                "Max Heart Rate": activity.get("max_heartrate", 0) or 0,
                "Average Watts": activity.get("average_watts", 0) or 0,
                "Max Watts": activity.get("max_watts", 0) or 0,
                "Average Cadence": activity.get("average_cadence", 0) or 0,
                "Average Speed": avg_speed_ms,  # m/s
                "Weighted Average Power": activity.get("weighted_average_watts", 0) or 0,
            })

        df = pd.DataFrame(records)

        # Convert date column
        df["Activity Date"] = pd.to_datetime(df["Activity Date"])

        return df

    def _save_parquet_cache(self, df: pd.DataFrame) -> Path:
        """
        Save DataFrame to a temporary Parquet file.

        The file format matches what load_activities_data() expects.

        Returns:
            Path to the temporary Parquet file
        """
        # Create temp file for Parquet cache
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".parquet",
            delete=False,
        ) as f:
            cache_path = Path(f.name)

        # Save to Parquet
        df.to_parquet(cache_path, engine="pyarrow", compression="snappy", index=False)
        logger.info(f"[AI ANALYSIS SERVICE] Saved {len(df)} activities to temp cache: {cache_path}")

        return cache_path

    async def _synthesize_insights(
        self, performance_data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Use LLM to synthesize actionable insights from raw performance data.
        """
        try:
            provider = self._get_provider()

            system_prompt = """You are an expert cycling coach analyzing performance data.
Your task is to synthesize the raw performance metrics into actionable insights.

CRITICAL: Return ONLY valid JSON. No markdown, no explanations.

Required JSON structure:
{
    "summary": "Brief overall assessment (2-3 sentences)",
    "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
    "strengths": ["Strength 1", "Strength 2"],
    "areas_for_improvement": ["Area 1", "Area 2"],
    "recommendations": {
        "short_term": ["Action 1", "Action 2"],
        "long_term": ["Goal 1", "Goal 2"]
    },
    "training_focus": "Primary focus area for next training block"
}"""

            user_message = f"""Analyze this cycling performance data and provide insights:

```json
{json.dumps(performance_data, indent=2, default=str)}
```

Return ONLY the JSON insights object. No additional text."""

            messages = [
                ProviderMessage(role="system", content=system_prompt),
                ProviderMessage(role="user", content=user_message),
            ]

            response = provider.create_completion(messages=messages, tools=None)

            # Parse LLM response
            insights = self._parse_json_response(response.content)

            # Merge insights with original data
            enhanced_data = dict(performance_data)
            enhanced_data["ai_insights"] = insights

            return enhanced_data

        except Exception as e:
            logger.warning(f"[AI ANALYSIS SERVICE] LLM synthesis failed: {e}")
            return performance_data

    def _parse_json_response(self, response: str) -> dict[str, Any]:
        """Parse JSON from LLM response."""
        response = response.strip()

        if response.startswith("```json"):
            response = response[7:]
        elif response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]

        response = response.strip()

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r"\{[\s\S]*\}", response)
            if json_match:
                return json.loads(json_match.group())
            raise

    def get_ai_metadata(self) -> dict[str, str]:
        """Get metadata about the AI provider being used."""
        return {
            "ai_provider": self._provider_name,
            "ai_model": self._model_name,
            "library_version": "1.0.0",
        }
