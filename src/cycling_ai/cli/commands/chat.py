"""
Chat command for interactive AI conversations.

Provides a conversational interface where users can interact with an AI assistant
that has access to cycling analysis tools.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import click
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from cycling_ai.cli.formatting import console
from cycling_ai.config.loader import load_config
from cycling_ai.orchestration.agent import AgentFactory, LLMAgent
from cycling_ai.orchestration.profile_onboarding import ProfileOnboardingManager
from cycling_ai.orchestration.session import (
    ConversationSession,
    SessionManager,
    get_default_session_manager,
)
from cycling_ai.orchestration.session_context import SessionContextKey, SessionMode
from cycling_ai.providers.base import BaseProvider
from cycling_ai.providers.factory import ProviderFactory


def _detect_existing_profile(profile_path: Path | None) -> Path | None:
    """
    Detect existing athlete profile for chat session.

    Priority logic:
    1. If profile_path provided via CLI --profile flag, use that (takes priority)
    2. Otherwise, search for profiles in data/*/athlete_profile.json
    3. If multiple profiles found, use most recently modified
    4. If no profiles found, return None (triggers onboarding)

    Args:
        profile_path: Explicit profile path from --profile CLI flag (optional)

    Returns:
        Path to detected profile, or None if no profile exists

    Raises:
        FileNotFoundError: If explicit profile_path provided but doesn't exist

    Examples:
        >>> # Explicit path takes priority
        >>> _detect_existing_profile(Path("athlete.json"))
        Path("athlete.json")

        >>> # Auto-detect from data/ directory
        >>> _detect_existing_profile(None)
        Path("data/Eduardo/athlete_profile.json")

        >>> # No profiles found
        >>> _detect_existing_profile(None)
        None
    """
    # Priority 1: Use explicit path if provided
    if profile_path is not None:
        if not profile_path.exists():
            raise FileNotFoundError(
                f"Profile not found at specified path: {profile_path}"
            )
        return profile_path

    # Priority 2: Search for profiles in data/ directory
    current_dir = Path.cwd()
    data_dir = current_dir / "data"

    # Check if data directory exists
    if not data_dir.exists() or not data_dir.is_dir():
        return None

    # Search for athlete_profile.json files in data/*/
    found_profiles: list[Path] = []

    try:
        # Iterate through athlete directories
        for athlete_dir in data_dir.iterdir():
            if not athlete_dir.is_dir():
                continue

            profile_file = athlete_dir / "athlete_profile.json"
            if profile_file.exists() and profile_file.is_file():
                found_profiles.append(profile_file)
    except (OSError, PermissionError):
        # Handle permission errors gracefully
        return None

    # No profiles found
    if not found_profiles:
        return None

    # Single profile found - use it
    if len(found_profiles) == 1:
        return found_profiles[0]

    # Multiple profiles found - use most recently modified
    most_recent = max(found_profiles, key=lambda p: p.stat().st_mtime)
    return most_recent


def _initialize_onboarding_mode(session: ConversationSession) -> None:
    """
    Initialize session for profile onboarding mode.

    Sets up session context with:
    - mode: "onboarding"
    - onboarding_manager: ProfileOnboardingManager instance

    Args:
        session: Conversation session to initialize

    Examples:
        >>> session = ConversationSession(...)
        >>> _initialize_onboarding_mode(session)
        >>> session.context["mode"]
        'onboarding'
        >>> isinstance(session.context["onboarding_manager"], ProfileOnboardingManager)
        True
    """
    session.context[SessionContextKey.MODE] = SessionMode.ONBOARDING
    session.context[SessionContextKey.ONBOARDING_MANAGER] = ProfileOnboardingManager()


def _get_onboarding_system_prompt(config: Any) -> str:
    """
    Get system prompt for profile onboarding mode.

    Loads prompt from external file using AgentPromptsManager.
    This ensures prompt is version-controlled and externalized.

    Args:
        config: Configuration object containing prompt version

    Returns:
        System prompt string for onboarding mode

    Raises:
        FileNotFoundError: If prompt file doesn't exist for configured version

    Examples:
        >>> config = load_config()
        >>> prompt = _get_onboarding_system_prompt(config)
        >>> "profile" in prompt.lower()
        True
    """
    from cycling_ai.orchestration.prompts import AgentPromptsManager

    # Get prompt version from config (defaults to "1.3")
    prompt_version = config.version if config else "1.3"

    # Initialize prompts manager
    prompts_manager = AgentPromptsManager(
        prompts_dir=None,  # Use default prompts directory
        model="default",
        version=prompt_version,
    )

    # Load and return onboarding prompt
    return prompts_manager.get_profile_onboarding_prompt()


def _check_onboarding_completion(session: ConversationSession) -> bool:
    """
    Check if profile onboarding is complete.

    Completion criteria:
    1. Session mode must be "onboarding"
    2. profile_path must exist in context
    3. Profile file must exist at that path

    Args:
        session: Conversation session to check

    Returns:
        True if onboarding is complete, False otherwise

    Examples:
        >>> session = ConversationSession(...)
        >>> session.context = {"mode": "onboarding"}
        >>> _check_onboarding_completion(session)
        False

        >>> session.context["profile_path"] = "/path/to/profile.json"
        >>> # Assuming file exists
        >>> _check_onboarding_completion(session)
        True
    """
    # Must be in onboarding mode
    if session.context.get("mode") != "onboarding":
        return False

    # Must have profile_path in context
    profile_path_str = session.context.get("profile_path")
    if not profile_path_str:
        return False

    # Profile file must exist
    profile_path = Path(profile_path_str)
    if not profile_path.exists() or not profile_path.is_file():
        return False

    return True


def _transition_to_normal_mode(session: ConversationSession) -> None:
    """
    Transition session from onboarding to normal chat mode.

    Changes:
    - mode: "onboarding" → "normal"
    - Removes onboarding_manager from context
    - Sets athlete_profile to profile_path (if exists)
    - Preserves profile_path and other context fields

    Args:
        session: Conversation session to transition

    Examples:
        >>> session = ConversationSession(...)
        >>> session.context = {
        ...     "mode": "onboarding",
        ...     "profile_path": "/path/to/profile.json"
        ... }
        >>> _transition_to_normal_mode(session)
        >>> session.context["mode"]
        'normal'
        >>> session.context.get("athlete_profile")
        '/path/to/profile.json'
    """
    # Change mode to normal
    session.context["mode"] = "normal"

    # Remove onboarding manager if exists
    session.context.pop("onboarding_manager", None)

    # Set athlete_profile to profile_path if available
    if "profile_path" in session.context:
        session.context["athlete_profile"] = session.context["profile_path"]


@click.command()
@click.option(
    "--provider",
    type=click.Choice(["openai", "anthropic", "gemini", "ollama", "bedrock"]),
    default="anthropic",
    help="LLM provider to use for conversation",
)
@click.option(
    "--model",
    help="Specific model to use (e.g., gpt-4, claude-3-5-sonnet)",
)
@click.option(
    "--aws-region",
    default="us-east-1",
    help="AWS region for Bedrock (default: us-east-1)",
)
@click.option(
    "--aws-profile",
    help="AWS profile name for Bedrock (optional)",
)
@click.option(
    "--profile",
    type=click.Path(exists=True, path_type=Path),
    help="Path to athlete profile JSON (sets conversation context)",
)
@click.option(
    "--data-dir",
    type=click.Path(exists=True, path_type=Path),
    help="Path to data directory containing activities",
)
@click.option(
    "--session-id",
    help="Resume existing conversation session",
)
@click.option(
    "--temperature",
    type=float,
    default=0.7,
    help="LLM temperature (0.0-2.0, lower = more focused)",
)
@click.option(
    "--max-tokens",
    type=int,
    default=4096,
    help="Maximum tokens in LLM response",
)
def chat(
    provider: str,
    model: str | None,
    aws_region: str,
    aws_profile: str | None,
    profile: Path | None,
    data_dir: Path | None,
    session_id: str | None,
    temperature: float,
    max_tokens: int,
) -> None:
    """
    Start interactive AI conversation.

    Chat with an AI assistant that can analyze your cycling data, generate
    training plans, and provide performance insights using natural language.

    \b
    Examples:
        # Start new chat with Anthropic Claude
        cycling-ai chat --provider anthropic --profile athlete.json

        # Use OpenAI GPT-4
        cycling-ai chat --provider openai --model gpt-4-turbo

        # Resume existing session
        cycling-ai chat --session-id abc123

    \b
    Once in chat mode, you can ask questions like:
        "Analyze my performance for the last 6 months"
        "What's my time in zone 2 vs zone 4?"
        "Create a 12-week training plan to increase my FTP"
        "How does my swimming affect my cycling?"

    \b
    Special Commands:
        /quit or /exit  - Exit chat
        /clear          - Clear conversation history
        /history        - Show conversation history
        /help           - Show available commands
        /session        - Show current session info
    """
    try:
        # Load configuration
        config = load_config()

        # Initialize session manager
        session_manager = get_default_session_manager()

        # Create or load session
        if session_id:
            console.print(f"[cyan]Loading session {session_id}...[/cyan]")
            try:
                session = session_manager.get_session(session_id)
                console.print("[green]✓ Session loaded[/green]")
            except KeyError as e:
                console.print(f"[red]Session '{session_id}' not found[/red]")
                raise click.Abort() from e
        else:
            # NEW: Detect existing profile
            detected_profile_path = _detect_existing_profile(profile)

            # Determine if we need onboarding
            needs_onboarding = detected_profile_path is None

            # Create new session with appropriate mode
            if needs_onboarding:
                # NEW: Onboarding mode
                context: dict[str, Any] = {}
                system_prompt = _get_onboarding_system_prompt(config)

                session = session_manager.create_session(
                    provider_name=provider,
                    context=context,
                    model=model,
                    system_prompt=system_prompt,
                )

                # Initialize onboarding after session creation
                _initialize_onboarding_mode(session)

                console.print(f"[green]✓ New session created: {session.session_id}[/green]")
            else:
                # Existing: Normal mode
                context = _build_session_context(detected_profile_path, data_dir)
                system_prompt = AgentFactory.get_default_system_prompt()

                session = session_manager.create_session(
                    provider_name=provider,
                    context=context,
                    model=model,
                    system_prompt=system_prompt,
                )

                console.print(f"[green]✓ New session created: {session.session_id}[/green]")

        # Initialize provider
        provider_instance = _initialize_provider(
            provider_name=provider,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            config=config,
            aws_region=aws_region,
            aws_profile=aws_profile,
        )

        # Create agent
        agent = AgentFactory.create_agent(
            provider=provider_instance,
            session=session,
        )

        # Display welcome message
        _display_welcome(session, provider)

        # Enter interactive loop
        _interactive_loop(agent, session, session_manager)

    except click.Abort:
        console.print("[yellow]Chat cancelled[/yellow]")
    except KeyboardInterrupt:
        console.print("\n[yellow]Chat interrupted[/yellow]")
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        raise


def _build_session_context(
    profile: Path | None, data_dir: Path | None
) -> dict[str, Any]:
    """
    Build session context from provided paths.

    Args:
        profile: Path to athlete profile
        data_dir: Path to data directory

    Returns:
        Context dictionary
    """
    context: dict[str, Any] = {}

    if profile:
        context["athlete_profile"] = str(profile.absolute())

    if data_dir:
        context["data_dir"] = str(data_dir.absolute())

    return context


def _initialize_provider(
    provider_name: str,
    model: str | None,
    temperature: float,
    max_tokens: int,
    config: Any,
    aws_region: str = "us-east-1",
    aws_profile: str | None = None,
) -> BaseProvider:
    """
    Initialize LLM provider from configuration.

    Args:
        provider_name: Name of provider
        model: Optional specific model
        temperature: LLM temperature
        max_tokens: Maximum tokens
        config: Configuration object
        aws_region: AWS region for Bedrock (default: us-east-1)
        aws_profile: AWS profile name for Bedrock (optional)

    Returns:
        Provider instance
    """
    from cycling_ai.providers.base import ProviderConfig

    # Get provider config from configuration
    provider_config_data: dict[str, Any] | Any = {}
    if config and hasattr(config, "providers"):
        # config.providers is a dict, not an object with attributes
        provider_config_data = config.providers.get(provider_name, {})

    # Use specified model or default from config
    if not model:
        if isinstance(provider_config_data, dict):
            model = provider_config_data.get("model")
        elif hasattr(provider_config_data, "model"):
            model = provider_config_data.model

        if not model:
            # No fallback - fail explicitly with clear error message
            raise click.ClickException(
                f"Model not specified for provider '{provider_name}'.\n\n"
                f"Please specify a model either:\n"
                f"  1. Via CLI: --model <model-name>\n"
                f"  2. In config file (.cycling-ai.yaml) under providers.{provider_name}.model\n\n"
                f"Example models:\n"
                f"  - OpenAI: gpt-4o, gpt-4-turbo\n"
                f"  - Anthropic: claude-sonnet-4, claude-3-5-sonnet-20241022\n"
                f"  - Gemini: gemini-2.0-flash-exp, gemini-1.5-pro\n"
                f"  - Ollama: llama3.2:3b, llama3.1:8b\n"
                f"  - Bedrock: anthropic.claude-3-5-sonnet-20241022-v2:0"
            )

    # Get API key from config or environment
    api_key = ""
    if isinstance(provider_config_data, dict):
        api_key = provider_config_data.get("api_key", "")
    elif hasattr(provider_config_data, "api_key"):
        api_key = provider_config_data.api_key

    # Fallback to environment variable
    if not api_key:
        import os

        env_var_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "ollama": "",  # Local, no key needed
            "bedrock": "",  # AWS credentials, no key needed
        }
        env_var = env_var_map.get(provider_name, "")
        if env_var:
            api_key = os.getenv(env_var, "")

    # Create ProviderConfig with AWS parameters for Bedrock
    additional_params: dict[str, Any] = {}
    if provider_name == "bedrock":
        additional_params["region"] = aws_region
        if aws_profile:
            additional_params["profile_name"] = aws_profile

    provider_config = ProviderConfig(
        provider_name=provider_name,
        api_key=api_key,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        additional_params=additional_params,
    )

    # Create provider instance
    try:
        provider = ProviderFactory.create_provider(provider_config)
        return provider
    except Exception as e:
        console.print(f"[red]Failed to initialize provider: {str(e)}[/red]")
        console.print(
            f"[yellow]Tip: Make sure you have set the API key for {provider_name}[/yellow]"
        )
        raise click.Abort() from e


def _display_welcome(session: ConversationSession, provider: str) -> None:
    """
    Display welcome message and instructions.

    Args:
        session: Current conversation session
        provider: Provider name
    """
    # Check if we're in onboarding mode
    if session.context.get("mode") == "onboarding":
        # Onboarding welcome message
        welcome = Panel.fit(
            """[bold cyan]🚴 Welcome to Cycling AI![/bold cyan]

[yellow]Let's set up your athlete profile to get started.[/yellow]

[white]I'll help you create your personalized profile through a friendly conversation.[/white]
[white]We'll collect information like your FTP, training experience, and goals.[/white]

[dim]Use /help for commands or /quit to exit.[/dim]
""",
            border_style="cyan",
        )
    else:
        # Normal chat welcome message
        profile_info = ""
        if "athlete_profile" in session.context:
            profile_info = f"\n[white]Profile:[/white] [dim]{session.context['athlete_profile']}[/dim]"

        welcome = Panel.fit(
            f"""[bold cyan]Welcome to Cycling AI Chat![/bold cyan]

[white]Provider:[/white] [green]{provider}[/green]
[white]Model:[/white] [green]{session.model or 'default'}[/green]
[white]Session:[/white] [dim]{session.session_id}[/dim]{profile_info}

[yellow]Type your questions about cycling performance, training, or analysis.[/yellow]
[dim]Use /help for available commands or /quit to exit.[/dim]
""",
            border_style="cyan",
        )
    console.print(welcome)
    console.print()


def _interactive_loop(
    agent: LLMAgent,
    session: ConversationSession,
    session_manager: SessionManager,
) -> None:
    """
    Main interactive conversation loop.

    Args:
        agent: LLM agent
        session: Current session
        session_manager: Session manager
    """
    while True:
        try:
            # Get user input
            user_input = console.input("[bold cyan]You:[/bold cyan] ")

            if not user_input.strip():
                continue

            # Handle special commands
            if user_input.startswith("/"):
                command_result = _handle_command(
                    user_input, agent, session, session_manager
                )
                if command_result == "quit":
                    break
                continue

            # Process message through agent
            console.print()
            with console.status(
                "[bold yellow]🤔 Thinking...[/bold yellow]", spinner="dots"
            ):
                response = agent.process_message(user_input)

            # Display response
            console.print()
            console.print(
                Panel(
                    Markdown(response),
                    title="[bold green]AI Assistant[/bold green]",
                    border_style="green",
                )
            )
            console.print()

            # Save session
            session_manager.update_session(session)

            # NEW: Check if onboarding just completed
            if _check_onboarding_completion(session):
                profile_path = session.context.get("profile_path")
                _transition_to_normal_mode(session)

                console.print("\n[green]✅ Profile setup complete![/green]")
                console.print(f"[dim]Profile saved to: {profile_path}[/dim]\n")
                console.print("You can now ask me questions about your training!\n")

                # Save session with updated mode
                session_manager.update_session(session)

                # Continue loop in normal mode
                continue

        except KeyboardInterrupt:
            console.print("\n[yellow]Use /quit to exit[/yellow]")
        except Exception as e:
            console.print(f"\n[red]Error: {str(e)}[/red]")
            console.print("[yellow]Try rephrasing your question[/yellow]\n")


def _handle_command(
    command: str,
    agent: LLMAgent,
    session: ConversationSession,
    session_manager: SessionManager,
) -> str | None:
    """
    Handle special commands.

    Args:
        command: Command string (e.g., "/help")
        agent: LLM agent
        session: Current session
        session_manager: Session manager

    Returns:
        "quit" if should exit, None otherwise
    """
    cmd = command.lower().strip()

    if cmd in ["/quit", "/exit"]:
        console.print("[cyan]Goodbye! 👋[/cyan]")
        return "quit"

    elif cmd == "/clear":
        agent.clear_history(keep_system=True)
        session_manager.update_session(session)
        console.print("[green]✓ Conversation history cleared[/green]")

    elif cmd == "/history":
        _display_history(agent)

    elif cmd == "/help":
        _display_help()

    elif cmd == "/session":
        _display_session_info(session)

    else:
        console.print(f"[red]Unknown command: {cmd}[/red]")
        console.print("[yellow]Type /help for available commands[/yellow]")

    return None


def _display_history(agent: LLMAgent) -> None:
    """
    Display conversation history.

    Args:
        agent: LLM agent
    """
    history = agent.get_conversation_history()

    if not history:
        console.print("[yellow]No conversation history[/yellow]")
        return

    console.print("\n[bold cyan]Conversation History:[/bold cyan]\n")

    for i, msg in enumerate(history, 1):
        if msg.role == "system":
            continue  # Skip system messages

        # Format role
        if msg.role == "user":
            role_str = "[bold cyan]You[/bold cyan]"
        elif msg.role == "assistant":
            role_str = "[bold green]AI[/bold green]"
        else:
            role_str = f"[dim]{msg.role}[/dim]"

        # Display message
        console.print(f"{i}. {role_str}: {msg.content[:100]}...")

    console.print()


def _display_help() -> None:
    """Display help information."""
    help_table = Table(title="Available Commands", show_header=True)
    help_table.add_column("Command", style="cyan")
    help_table.add_column("Description", style="white")

    commands = [
        ("/quit, /exit", "Exit the chat"),
        ("/clear", "Clear conversation history (keeps system prompt)"),
        ("/history", "Show conversation history"),
        ("/session", "Show current session information"),
        ("/help", "Show this help message"),
    ]

    for cmd, desc in commands:
        help_table.add_row(cmd, desc)

    console.print()
    console.print(help_table)
    console.print()


def _display_session_info(session: ConversationSession) -> None:
    """
    Display session information.

    Args:
        session: Current session
    """
    info_table = Table(title="Session Information", show_header=False)
    info_table.add_column("Property", style="cyan")
    info_table.add_column("Value", style="white")

    info_table.add_row("Session ID", session.session_id)
    info_table.add_row("Provider", session.provider_name)
    info_table.add_row("Model", session.model or "default")
    info_table.add_row("Created", session.created_at.strftime("%Y-%m-%d %H:%M:%S"))
    info_table.add_row(
        "Last Activity", session.last_activity.strftime("%Y-%m-%d %H:%M:%S")
    )
    info_table.add_row("Messages", str(len(session.messages)))

    # Display context if available
    if session.context:
        context_items = []
        if "athlete_profile" in session.context:
            context_items.append(f"Profile: {session.context['athlete_profile']}")
        if "data_dir" in session.context:
            context_items.append(f"Data: {session.context['data_dir']}")
        if context_items:
            info_table.add_row("Context", "\n".join(context_items))

    console.print()
    console.print(info_table)
    console.print()
