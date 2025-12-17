"""
AWS Lambda handler for FastAPI application.

Uses Mangum to adapt ASGI FastAPI app to AWS Lambda.
Supports Lambda Function URLs and API Gateway.
"""

from __future__ import annotations

import logging
from typing import Any

from mangum import Mangum

from cycling_ai.api.main import app

# Configure logging for Lambda
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create Mangum handler for Lambda
# lifespan="off" because Lambda handles its own lifecycle
handler = Mangum(app, lifespan="off")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AWS Lambda entry point.

    Wraps the Mangum handler to add additional logging and error handling.

    Args:
        event: Lambda event (from Function URL or API Gateway)
        context: Lambda context

    Returns:
        HTTP response dictionary
    """
    # Log request info (helpful for debugging)
    request_context = event.get("requestContext", {})
    http_info = request_context.get("http", {})

    logger.info(
        f"Request: {http_info.get('method', 'UNKNOWN')} {http_info.get('path', '/')}"
    )

    try:
        response: dict[str, Any] = handler(event, context)
        logger.info(f"Response status: {response.get('statusCode', 'unknown')}")
        return response
    except Exception as e:
        logger.error(f"Lambda handler error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": '{"error": "Internal server error"}',
        }
