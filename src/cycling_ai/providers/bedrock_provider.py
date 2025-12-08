"""
AWS Bedrock provider adapter.

Implements the provider interface for AWS Bedrock foundation models.
Supports Anthropic Claude, Amazon Nova, Meta Llama, and other models
via the unified Converse API.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.interaction_logger import get_interaction_logger
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult

logger = logging.getLogger(__name__)


def _normalize_schema_types(schema: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively normalize type values to lowercase for JSON Schema compliance.

    Bedrock requires strict adherence to JSON Schema specification, which mandates
    lowercase type values (e.g., "object", not "OBJECT").

    Args:
        schema: Schema dictionary to normalize

    Returns:
        Normalized schema with lowercase types
    """
    result: dict[str, Any] = {}

    for key, value in schema.items():
        if key == "type" and isinstance(value, str):
            # Normalize type to lowercase
            result[key] = value.lower()
        elif key == "properties" and isinstance(value, dict):
            # Recursively normalize nested properties
            result[key] = {
                prop_name: _normalize_schema_types(prop_value)
                for prop_name, prop_value in value.items()
            }
        elif key == "items" and isinstance(value, dict):
            # Recursively normalize array item schemas
            result[key] = _normalize_schema_types(value)
        else:
            # Copy other fields as-is
            result[key] = value

    return result


class BedrockProvider(BaseProvider):
    """
    AWS Bedrock provider adapter using Converse API.

    Supports multiple foundation models through AWS Bedrock's unified API.
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize Bedrock provider with AWS credentials.

        Args:
            config: Provider configuration with model and AWS settings

        Example:
            >>> config = ProviderConfig(
            ...     provider_name="bedrock",
            ...     api_key="",
            ...     model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            ...     additional_params={"region": "us-east-1"}
            ... )
            >>> provider = BedrockProvider(config)
        """
        super().__init__(config)

        # Extract AWS configuration
        region = config.additional_params.get("region", "us-east-1")
        profile_name = config.additional_params.get("profile_name")

        # Create boto3 session
        session = boto3.Session(profile_name=profile_name) if profile_name else boto3.Session()

        # Create Bedrock Runtime client
        self.bedrock_client = session.client("bedrock-runtime", region_name=region)

    def _extract_system_prompts(self, messages: list[ProviderMessage]) -> list[dict[str, Any]]:
        """
        Extract system prompts from messages.

        Bedrock Converse API requires system messages to be passed separately
        from the main messages array.

        Args:
            messages: List of conversation messages

        Returns:
            List of system prompt dictionaries in Bedrock format

        Example:
            >>> system = provider._extract_system_prompts(messages)
            >>> system[0]["text"]
            'You are a helpful assistant'
        """
        system_prompts: list[dict[str, Any]] = []

        for message in messages:
            if message.role == "system":
                system_prompts.append({"text": message.content})

        return system_prompts

    def _convert_messages(self, messages: list[ProviderMessage]) -> list[dict[str, Any]]:
        """
        Convert messages to Bedrock Converse API format.

        Key transformations:
        - System messages → filtered (handled separately)
        - User messages → {role: "user", content: [{text: "..."}]}
        - Assistant messages → {role: "assistant", content: [{text: "..."} | {toolUse: {...}}]}
        - Tool results → {role: "user", content: [{toolResult: {...}}]}

        Args:
            messages: List of conversation messages

        Returns:
            List of messages in Bedrock format

        Example:
            >>> converted = provider._convert_messages(messages)
            >>> converted[0]["role"]
            'user'
        """
        bedrock_messages: list[dict[str, Any]] = []

        for message in messages:
            # Skip system messages (handled separately)
            if message.role == "system":
                continue

            # Handle tool results: convert to user role with toolResult content
            if message.role == "tool" and message.tool_results:
                tool_result = message.tool_results[0]
                bedrock_messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "toolResult": {
                                    "toolUseId": tool_result.get("tool_call_id"),
                                    "content": [{"text": message.content}],
                                }
                            }
                        ],
                    }
                )
                continue

            # Handle user messages
            if message.role == "user":
                bedrock_messages.append({"role": "user", "content": [{"text": message.content}]})
                continue

            # Handle assistant messages
            if message.role == "assistant":
                content_blocks: list[dict[str, Any]] = []

                # Add text content if present
                if message.content:
                    content_blocks.append({"text": message.content})

                # Add tool calls if present
                if message.tool_calls:
                    for tool_call in message.tool_calls:
                        content_blocks.append(
                            {
                                "toolUse": {
                                    "toolUseId": tool_call.get("id"),
                                    "name": tool_call.get("name"),
                                    "input": tool_call.get("arguments", {}),
                                }
                            }
                        )

                bedrock_messages.append({"role": "assistant", "content": content_blocks})

        return bedrock_messages

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """
        Convert generic tool definitions to Bedrock toolSpec format.

        Args:
            tools: List of generic tool definitions

        Returns:
            List of Bedrock tool specifications

        Example:
            >>> schema = provider.convert_tool_schema([tool_def])
            >>> schema[0]["toolSpec"]["name"]
            'analyze_performance'
        """
        bedrock_tools = []

        for tool in tools:
            properties: dict[str, Any] = {}
            required: list[str] = []

            for param in tool.parameters:
                properties[param.name] = {
                    "type": param.type.lower(),  # Normalize to lowercase for JSON Schema compliance
                    "description": param.description,
                }
                if param.enum:
                    properties[param.name]["enum"] = param.enum
                if param.items:
                    # Handle array/object item schemas (normalize types recursively)
                    properties[param.name]["items"] = _normalize_schema_types(param.items)
                if param.required:
                    required.append(param.name)

            bedrock_tools.append(
                {
                    "toolSpec": {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": {
                            "json": {
                                "type": "object",
                                "properties": properties,
                                "required": required,
                            }
                        },
                    }
                }
            )

        return bedrock_tools

    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> ToolExecutionResult:
        """
        Execute a tool by delegating to the tool registry.

        Args:
            tool_name: Name of the tool to invoke
            parameters: Tool parameters

        Returns:
            Tool execution result

        Example:
            >>> result = provider.invoke_tool("analyze_performance", {"period_months": 6})
        """
        from cycling_ai.tools.registry import get_global_registry

        logger.debug(f"[BEDROCK PROVIDER] invoke_tool called: {tool_name}")
        logger.debug(f"[BEDROCK PROVIDER] Parameters: {parameters}")

        try:
            registry = get_global_registry()
            tool = registry.get_tool(tool_name)
            logger.debug(f"[BEDROCK PROVIDER] Tool retrieved from registry: {tool.definition.name}")

            result = tool.execute(**parameters)
            logger.info(f"[BEDROCK PROVIDER] Tool {tool_name} executed: success={result.success}")
            if not result.success:
                logger.warning(f"[BEDROCK PROVIDER] Tool {tool_name} errors: {result.errors}")
            return result
        except Exception as e:
            logger.error(
                f"[BEDROCK PROVIDER] Tool {tool_name} execution failed: {e}", exc_info=True
            )
            raise

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """
        Format tool execution result for Bedrock.

        Args:
            result: Tool execution result

        Returns:
            Bedrock-format tool message

        Example:
            >>> formatted = provider.format_response(result)
            >>> formatted["role"]
            'tool'
        """
        return {"role": "tool", "content": json.dumps(result.to_dict())}

    @retry_with_exponential_backoff(max_retries=3, initial_delay=1.0)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
        force_tool_call: bool = False,
    ) -> CompletionResponse:
        """
        Create completion using AWS Bedrock Converse API.

        Args:
            messages: Conversation messages
            tools: Available tools (optional)
            force_tool_call: If True, force LLM to call tool instead of responding with text

        Returns:
            Standardized completion response

        Raises:
            ValueError: If authentication fails or model not found
            RuntimeError: If API error occurs

        Example:
            >>> messages = [ProviderMessage(role="user", content="Hello")]
            >>> response = provider.create_completion(messages)
        """
        try:
            # Convert messages to Bedrock format
            bedrock_messages = self._convert_messages(messages)
            system_prompts = self._extract_system_prompts(messages)

            # Build request parameters
            request_params: dict[str, Any] = {
                "modelId": self.config.model,
                "messages": bedrock_messages,
                "inferenceConfig": {
                    "maxTokens": self.config.max_tokens,
                    "temperature": self.config.temperature,
                },
            }

            # Add system prompts if present
            if system_prompts:
                request_params["system"] = system_prompts

            # Add tools if provided
            if tools:
                bedrock_tools = self.convert_tool_schema(tools)
                request_params["toolConfig"] = {"tools": bedrock_tools}

                # Force tool call if requested
                if force_tool_call:
                    request_params["toolChoice"] = {"any": {}}

            # Add guardrails if configured (NOT compatible with tools)
            guardrail_id = self.config.additional_params.get("guardrail_id")
            guardrail_version = self.config.additional_params.get("guardrail_version")

            if guardrail_id and not tools:
                # Guardrails cannot be used with tool calling
                request_params["guardrailConfig"] = {
                    "guardrailIdentifier": guardrail_id,
                    "guardrailVersion": guardrail_version or "DRAFT",
                }
                # Optionally enable trace for debugging
                if self.config.additional_params.get("guardrail_trace"):
                    request_params["guardrailConfig"]["trace"] = "enabled"
            elif guardrail_id and tools:
                logger.warning(
                    "Guardrails are not compatible with tool use in Bedrock. "
                    "Skipping guardrail configuration."
                )

            # Call Bedrock Converse API
            start_time = time.time()
            response = self.bedrock_client.converse(**request_params)
            duration = time.time() - start_time

            # Extract response content
            output_message = response["output"]["message"]
            content_blocks = output_message["content"]

            # Parse content blocks for text and tool calls
            text_parts: list[str] = []
            tool_calls: list[dict[str, Any]] = []

            for block in content_blocks:
                if "text" in block:
                    text_parts.append(block["text"])
                elif "toolUse" in block:
                    tool_use = block["toolUse"]
                    tool_calls.append(
                        {
                            "id": tool_use["toolUseId"],
                            "name": tool_use["name"],
                            "arguments": tool_use.get("input", {}),
                        }
                    )

            # Combine text parts
            content = " ".join(text_parts) if text_parts else ""

            # Extract usage metrics
            usage = response.get("usage", {})
            metadata = {
                "usage": {
                    "input_tokens": usage.get("inputTokens", 0),
                    "output_tokens": usage.get("outputTokens", 0),
                    "total_tokens": usage.get("totalTokens", 0),
                },
                "duration": duration,
            }

            # Add guardrail trace if present
            if "trace" in response:
                metadata["guardrail_trace"] = response["trace"]

            # Create completion response
            completion_response = CompletionResponse(
                content=content,
                tool_calls=tool_calls if tool_calls else None,
                metadata=metadata,
            )

            # Log the interaction
            try:
                interaction_logger = get_interaction_logger()
                interaction_logger.log_interaction(
                    provider_name=self.config.provider_name,
                    model=self.config.model,
                    messages=messages,
                    tools=tools,
                    response=completion_response,
                    duration_ms=duration * 1000,
                )
            except Exception as log_error:
                # Don't fail the request if logging fails
                logger.warning(f"Failed to log interaction: {log_error}")

            return completion_response

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            error_message = e.response["Error"]["Message"]

            # Map AWS errors to appropriate exception types
            if error_code == "AccessDeniedException":
                raise ValueError(f"Access denied to AWS Bedrock: {error_message}") from e
            elif error_code == "ResourceNotFoundException":
                raise ValueError(f"Model not found: {error_message}") from e
            elif error_code == "ThrottlingException":
                raise RuntimeError(f"AWS Bedrock throttling error: {error_message}") from e
            else:
                raise RuntimeError(f"AWS Bedrock API error ({error_code}): {error_message}") from e
        except BotoCoreError as e:
            raise RuntimeError(f"AWS SDK error: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in Bedrock provider: {e}", exc_info=True)
            raise RuntimeError(f"Bedrock provider error: {e}") from e
