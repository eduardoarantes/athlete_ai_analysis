"""
LLM agent orchestration.

Coordinates LLM-powered tool execution with multi-turn conversation support.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from cycling_ai.orchestration.executor import ToolExecutor
from cycling_ai.orchestration.session import (
    ConversationMessage,
    ConversationSession,
)
from cycling_ai.providers.base import BaseProvider, ProviderMessage
from cycling_ai.tools.base import ToolExecutionResult

logger = logging.getLogger(__name__)


class LLMAgent:
    """
    Orchestrates LLM-powered tool execution.

    Manages the loop:
    1. Send user message + available tools to LLM
    2. LLM decides which tool(s) to call
    3. Execute requested tools
    4. Send results back to LLM
    5. LLM interprets and provides final response
    """

    def __init__(
        self,
        provider: BaseProvider,
        executor: ToolExecutor,
        session: ConversationSession,
        max_iterations: int = 10,
        allowed_tools: list[str] | None = None,
        force_tool_call: bool = False,
    ):
        """
        Initialize LLM agent.

        Args:
            provider: LLM provider adapter
            executor: Tool executor
            session: Conversation session
            max_iterations: Maximum tool execution iterations (safety limit)
            allowed_tools: Optional list of tool names to make available to the LLM.
                If None, all tools from executor are available.
            force_tool_call: If True, force LLM to call tool instead of responding with text
        """
        self.provider = provider
        self.executor = executor
        self.session = session
        self.max_iterations = max_iterations
        self.allowed_tools = allowed_tools
        self.force_tool_call = force_tool_call

    def process_message(self, user_message: str) -> str:
        """
        Process user message through LLM agent loop.

        Args:
            user_message: User's natural language input

        Returns:
            LLM's final response after tool execution

        Raises:
            RuntimeError: If max iterations exceeded
        """
        # Add user message to session
        self.session.add_message(
            ConversationMessage(role="user", content=user_message)
        )

        # Get available tools (filtered if allowed_tools is set)
        all_tools = self.executor.registry.list_tools()

        # Filter tools if allowed_tools is specified
        if self.allowed_tools is not None:
            all_tool_names = [tool.name for tool in all_tools]
            tools = [
                tool for tool in all_tools
                if tool.name in self.allowed_tools and tool.name in all_tool_names
            ]
        else:
            tools = all_tools

        iteration = 0
        while iteration < self.max_iterations:
            iteration += 1

            # DEBUG: Log iteration start
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[AGENT LOOP] Iteration {iteration}/{self.max_iterations}")
            logger.info(f"[AGENT LOOP] Current session messages: {len(self.session.messages)}")

            # Get messages formatted for LLM and convert to ProviderMessage
            messages_data = self.session.get_messages_for_llm()
            messages = [
                self._convert_to_provider_message(msg) for msg in messages_data
            ]

            logger.info(f"[AGENT LOOP] Sending {len(messages)} messages to LLM")

            # Send to LLM with tools
            response = self.provider.create_completion(
                messages=messages,
                tools=tools if tools else None,
                force_tool_call=self.force_tool_call,
            )

            # Comprehensive response logging for observability
            logger.info(f"[AGENT LOOP] Response received from LLM")
            logger.debug(f"[AGENT LOOP] Response type: {type(response)}")
            logger.debug(f"[AGENT LOOP] Response content type: {type(response.content)}")
            logger.info(f"[AGENT LOOP] Content length: {len(response.content) if response.content else 0}")

            # Tool calls debugging
            logger.debug(f"[AGENT LOOP] response.tool_calls type: {type(response.tool_calls)}")
            logger.debug(f"[AGENT LOOP] response.tool_calls value: {response.tool_calls}")
            logger.debug(f"[AGENT LOOP] response.tool_calls bool evaluation: {bool(response.tool_calls)}")
            logger.info(f"[AGENT LOOP] Tool calls count: {len(response.tool_calls) if response.tool_calls else 0}")

            # Check if LLM wants to call tools
            if response.tool_calls:
                logger.info(f"[AGENT LOOP] Tool calls detected: {len(response.tool_calls)}")
                for tc in response.tool_calls:
                    tool_name = tc.get('name', 'unknown')
                    tool_args = tc.get('arguments', {})
                    logger.info(f"[AGENT LOOP]   - Tool: {tool_name}")
                    logger.debug(f"[AGENT LOOP]     Arguments: {tool_args}")

                # Execute tools and add results to session
                logger.debug(f"[AGENT LOOP] Calling _execute_tool_calls()...")
                try:
                    tool_results = self._execute_tool_calls(response.tool_calls)
                    logger.info(f"[AGENT LOOP] Tool execution completed successfully. {len(tool_results)} results.")
                    for i, result in enumerate(tool_results):
                        logger.debug(f"[AGENT LOOP]   Result {i+1}: success={result.success}, format={result.format}")
                        if not result.success:
                            logger.warning(f"[AGENT LOOP]   Result {i+1} errors: {result.errors}")
                except Exception as e:
                    logger.error(f"[AGENT LOOP] Tool execution failed with exception: {e}", exc_info=True)
                    raise

                logger.debug(f"[AGENT LOOP] Adding tool call and result messages to session...")

                # Add assistant message with tool calls
                self.session.add_message(
                    ConversationMessage(
                        role="assistant",
                        content=response.content or "",
                        tool_calls=response.tool_calls,
                    )
                )

                # Add tool results as separate messages
                for tool_call, result in zip(response.tool_calls, tool_results):
                    tool_result_msg = self._format_tool_result_message(
                        tool_call, result
                    )
                    self.session.add_message(tool_result_msg)

                # Check if finalize_training_plan was called AND succeeded - if so, force completion
                finalize_idx = None
                for idx, tc in enumerate(response.tool_calls):
                    if tc.get("name") == "finalize_training_plan":
                        finalize_idx = idx
                        break

                if finalize_idx is not None:
                    # Check if the tool execution was successful
                    finalize_result = tool_results[finalize_idx]
                    if finalize_result.success:
                        logger.info("[AGENT LOOP] finalize_training_plan succeeded. Forcing completion.")
                        final_msg = "Training plan has been successfully created and saved."
                        self.session.add_message(
                            ConversationMessage(role="assistant", content=final_msg)
                        )
                        return final_msg
                    else:
                        logger.warning(
                            f"[AGENT LOOP] finalize_training_plan failed with errors: {finalize_result.errors}. "
                            "Continuing to give LLM a chance to retry."
                        )

                logger.info(f"[AGENT LOOP] Session now has {len(self.session.messages)} messages. Continuing to next iteration...")

                # Continue loop to let LLM process results
                continue

            # No tool calls - this is the final response
            logger.info(f"[AGENT LOOP] No tool calls. Final response received. Exiting loop.")
            self.session.add_message(
                ConversationMessage(role="assistant", content=response.content)
            )

            return response.content

        raise RuntimeError(
            f"Maximum iterations ({self.max_iterations}) exceeded. "
            "Agent may be stuck in a loop."
        )

    def _execute_tool_calls(
        self, tool_calls: list[dict[str, Any]]
    ) -> list[ToolExecutionResult]:
        """
        Execute tools requested by LLM.

        Args:
            tool_calls: List of tool call specifications from LLM

        Returns:
            List of tool execution results
        """
        results = []

        for tool_call in tool_calls:
            tool_name = tool_call.get("name")
            # Support both "parameters" and "arguments" keys for compatibility
            parameters = tool_call.get("parameters") or tool_call.get("arguments", {})

            # Execute tool
            result = self.executor.execute_tool(tool_name, parameters)
            results.append(result)

        return results

    def _convert_to_provider_message(self, msg_data: dict[str, Any]) -> ProviderMessage:
        """
        Convert session message data to ProviderMessage.

        Args:
            msg_data: Message data dictionary from session

        Returns:
            ProviderMessage instance
        """
        # Extract basic fields
        role = msg_data.get("role", "user")
        content = msg_data.get("content", "")
        tool_calls = msg_data.get("tool_calls")
        tool_results = msg_data.get("tool_results")

        # Pass role unchanged - let each provider handle role conversion
        # Providers will convert as needed:
        # - OpenAI: role="tool" → role="tool"
        # - Anthropic: role="tool" → role="user" with type="tool_result"
        # - Gemini: role="tool" → role="function" with function_response
        return ProviderMessage(
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_results=tool_results,
        )

    def _format_tool_result_message(
        self, tool_call: dict[str, Any], result: ToolExecutionResult
    ) -> ConversationMessage:
        """
        Format tool execution result as conversation message.

        Args:
            tool_call: Original tool call specification
            result: Tool execution result

        Returns:
            Conversation message with tool result
        """
        # Format result content based on success
        if result.success:
            if result.format == "json":
                # If data is JSON, stringify it
                if isinstance(result.data, (dict, list)):
                    content = json.dumps(result.data, indent=2)
                else:
                    content = str(result.data)
            else:
                # For markdown, text, html - use as is
                content = str(result.data)
        else:
            # Format error message
            errors_str = "\n".join(result.errors)
            content = f"Error executing tool: {errors_str}"

        # Create tool result message
        return ConversationMessage(
            role="tool",
            content=content,
            tool_results=[
                {
                    "tool_call_id": tool_call.get("id"),
                    "tool_name": tool_call.get("name"),
                    "success": result.success,
                    "format": result.format,
                }
            ],
        )

    def get_conversation_history(self) -> list[ConversationMessage]:
        """
        Get full conversation history.

        Returns:
            List of all messages in the session
        """
        return self.session.messages

    def clear_history(self, keep_system: bool = True) -> None:
        """
        Clear conversation history.

        Args:
            keep_system: Whether to keep system message (if present)
        """
        if keep_system and self.session.messages:
            # Keep only system message if it exists
            system_messages = [
                msg for msg in self.session.messages if msg.role == "system"
            ]
            self.session.messages = system_messages
        else:
            self.session.messages = []


class AgentFactory:
    """
    Factory for creating LLM agents with proper configuration.
    """

    @staticmethod
    def create_agent(
        provider: BaseProvider,
        session: ConversationSession,
        system_prompt: str | None = None,
        max_iterations: int = 10,
        allowed_tools: list[str] | None = None,
        force_tool_call: bool = False,
    ) -> LLMAgent:
        """
        Create configured LLM agent.

        Args:
            provider: LLM provider adapter
            session: Conversation session
            system_prompt: Optional system prompt to set context
            max_iterations: Maximum tool execution iterations
            allowed_tools: Optional list of tool names to restrict agent access to
            force_tool_call: If True, force LLM to call tool instead of responding with text

        Returns:
            Configured LLM agent
        """
        # Add system prompt if provided and no system message exists
        if system_prompt:
            has_system = any(msg.role == "system" for msg in session.messages)
            if not has_system:
                session.add_message(
                    ConversationMessage(role="system", content=system_prompt)
                )

        # Create executor with tool filtering
        executor = ToolExecutor(allowed_tools=allowed_tools)

        # Create agent
        return LLMAgent(
            provider=provider,
            executor=executor,
            session=session,
            max_iterations=max_iterations,
            allowed_tools=allowed_tools,
            force_tool_call=force_tool_call,
        )

    @staticmethod
    def get_default_system_prompt() -> str:
        """
        Get default system prompt for cycling performance analyst.

        Returns:
            System prompt text
        """
        return """You are an expert cycling performance analyst with deep knowledge of:
- Training load and periodization
- Power-based training zones (based on FTP)
- FTP testing and improvement strategies
- Polarized training methodology (80/20 principle)
- Cross-training impact on cycling performance
- Training plan design for amateur and competitive cyclists

You have access to tools to analyze athlete data. When a user asks about their
performance, use the appropriate tools to gather data, then provide insightful
analysis and actionable recommendations.

**Guidelines:**
- Always explain your reasoning and cite specific data points
- When recommending training changes, explain the physiological basis
- Consider the athlete's goals, current fitness, and time availability
- Be encouraging but honest about areas needing improvement
- Use percentages and concrete numbers when discussing improvements

**Available Analysis Tools:**
- analyze_performance: Compare recent performance vs previous period
- analyze_zones: Calculate time spent in each power zone
- generate_training_plan: Create periodized training plan
- analyze_cross_training: Understand impact of non-cycling activities
- generate_report: Create comprehensive analysis report

**Tool Usage Strategy:**
1. Start with broad analysis (performance, zones)
2. Based on findings, dive deeper if needed
3. Provide actionable recommendations
4. Offer to generate training plan if improvements are needed"""
