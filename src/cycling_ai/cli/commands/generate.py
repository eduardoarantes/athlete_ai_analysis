"""
Generate command for comprehensive report generation.

Orchestrates multi-agent workflow to produce comprehensive HTML reports
from cycling data in a single command.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import click
from rich.live import Live
from rich.panel import Panel
from rich.table import Table

from cycling_ai.cli.formatting import console
from cycling_ai.config.loader import load_config
from cycling_ai.orchestration.base import PhaseStatus, RAGConfig, WorkflowConfig, WorkflowResult
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.providers.base import BaseProvider, ProviderConfig
from cycling_ai.providers.factory import ProviderFactory


class PhaseProgressTracker:
    """
    Tracks and displays progress of workflow phases.

    Maintains phase status dictionary and generates Rich tables for
    live display during workflow execution.
    """

    def __init__(self) -> None:
        """Initialize progress tracker with pending phases."""
        self.phases: dict[str, dict[str, Any]] = {
            "data_preparation": {
                "name": "Data Preparation",
                "status": PhaseStatus.PENDING,
            },
            "performance_analysis": {
                "name": "Performance Analysis",
                "status": PhaseStatus.PENDING,
            },
            "training_planning": {
                "name": "Training Planning",
                "status": PhaseStatus.PENDING,
            },
            "report_data_preparation": {
                "name": "Report Data Preparation",
                "status": PhaseStatus.PENDING,
            },
        }
        self._live: Live | None = None

    def update_phase(self, phase_name: str, status: PhaseStatus) -> None:
        """
        Update phase status.

        Called by orchestrator when phase status changes.

        Args:
            phase_name: Name of the phase (e.g., "data_preparation")
            status: New status for the phase
        """
        if phase_name in self.phases:
            self.phases[phase_name]["status"] = status
            # Refresh live display if it exists
            if self._live:
                self._live.update(self.get_table())

    def get_table(self) -> Table:
        """
        Generate Rich table showing current phase status.

        Returns:
            Formatted Rich Table for display
        """
        table = Table(show_header=True, header_style="bold magenta", box=None)
        table.add_column("Phase", style="cyan", width=30)
        table.add_column("Status", width=20)

        for phase_id, phase_info in self.phases.items():
            name = phase_info["name"]
            status = phase_info["status"]

            # Format status with emoji and color
            status_str = self._format_status(status)

            table.add_row(name, status_str)

        return table

    def _format_status(self, status: PhaseStatus) -> str:
        """
        Format phase status with emoji and color.

        Args:
            status: PhaseStatus enum value

        Returns:
            Formatted status string with Rich markup
        """
        if status == PhaseStatus.PENDING:
            return "[dim]⏳ Pending[/dim]"
        elif status == PhaseStatus.IN_PROGRESS:
            return "[yellow]🔄 In Progress[/yellow]"
        elif status == PhaseStatus.COMPLETED:
            return "[green]✓ Completed[/green]"
        elif status == PhaseStatus.FAILED:
            return "[red]✗ Failed[/red]"
        elif status == PhaseStatus.SKIPPED:
            return "[dim]⊘ Skipped[/dim]"
        else:
            return str(status.value)


def create_rag_config(
    enabled: bool,
    top_k: int,
    min_score: float,
) -> RAGConfig:
    """
    Create RAG configuration for workflow.

    Sets up vectorstore paths and validates configuration.
    Shows warnings if RAG enabled but vectorstore not available.

    Args:
        enabled: Whether RAG is enabled
        top_k: Number of documents to retrieve
        min_score: Minimum similarity score

    Returns:
        RAGConfig instance with appropriate settings
    """

    # Load configuration to get RAG paths
    config = load_config()

    # Determine vectorstore paths from config
    project_vectorstore = Path(config.rag.project_vectorstore).expanduser().resolve()
    user_vectorstore = Path(config.rag.user_vectorstore).expanduser().resolve()

    # Check if project vectorstore exists
    if enabled and not project_vectorstore.exists():
        console.print(
            "\n[yellow]⚠️  Warning: RAG enabled but vectorstore not found[/yellow]",
            style="bold",
        )
        console.print(f"[yellow]   Expected location: {project_vectorstore}[/yellow]")
        console.print("\n[yellow]   To populate the vectorstore, run:[/yellow]")
        console.print("[yellow]      cycling-ai index domain[/yellow]")
        console.print("[yellow]      cycling-ai index templates[/yellow]")
        console.print("\n[yellow]   RAG will be disabled for this run.[/yellow]\n")

    # Create configuration
    rag_config = RAGConfig(
        enabled=enabled and project_vectorstore.exists(),  # Disable if vectorstore missing
        top_k=top_k,
        min_score=min_score,
        project_vectorstore_path=(project_vectorstore if project_vectorstore.exists() else None),
        user_vectorstore_path=(user_vectorstore if user_vectorstore.exists() else None),
        embedding_provider="local",
        embedding_model=None,  # Use provider defaults
    )

    # Log RAG status
    if enabled:
        if rag_config.enabled:
            console.print(f"[green]✓[/green] RAG enabled with top_k={top_k}, min_score={min_score}")
        else:
            console.print("[yellow]⚠️  RAG disabled (vectorstore not found)[/yellow]")

    return rag_config


@click.command()
@click.option(
    "--csv",
    "csv_file",
    type=click.Path(exists=True, path_type=Path),
    required=False,
    help="Path to Strava activities CSV export (optional if using --fit-dir or profile's raw_training_data_path)",
)
@click.option(
    "--profile",
    "profile_file",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Path to athlete profile JSON",
)
@click.option(
    "--fit-dir",
    type=click.Path(exists=True, path_type=Path),
    help="Directory containing FIT files (optional if specified in athlete profile as 'raw_training_data_path')",
)
@click.option(
    "--output-dir",
    type=click.Path(path_type=Path),
    default="./reports",
    help="Output directory for generated reports",
)
@click.option(
    "--period-months",
    type=int,
    default=6,
    help="Number of months for performance comparison",
)
@click.option(
    "--skip-training-plan",
    is_flag=True,
    help="Skip training plan generation phase",
)
@click.option(
    "--skip-data-prep",
    is_flag=True,
    help="Skip data preparation phase and use existing cache (cache must exist)",
)
@click.option(
    "--cross-training/--no-cross-training",
    default=None,
    help="Analyze cross-training impact (auto-detect if not specified)",
)
@click.option(
    "--provider",
    type=click.Choice(["openai", "anthropic", "gemini", "ollama", "bedrock"]),
    default="anthropic",
    help="LLM provider to use",
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
    "--guardrail-id",
    help="AWS Bedrock Guardrail ID (optional, for content filtering)",
)
@click.option(
    "--guardrail-version",
    default="DRAFT",
    help="AWS Bedrock Guardrail version (default: DRAFT)",
)
@click.option(
    "--prompts-dir",
    type=click.Path(exists=True, path_type=Path),
    help="Base directory containing prompt files (defaults to ./prompts)",
)
@click.option(
    "--prompt-model",
    default="default",
    help="Prompt model to use (e.g., 'default', 'gemini')",
)
@click.option(
    "--prompt-version",
    default=None,
    help="Prompt version to use (e.g., '1.0', '1.1', '1.3'). Defaults to version from .cycling-ai.yaml",
)
@click.option(
    "--workout-source",
    type=click.Choice(["library", "llm"]),
    default="library",
    help=(
        "Source for training plan workouts: 'library' (fast, deterministic) "
        "or 'llm' (flexible, uses tokens)"
    ),
)
@click.option(
    "--enable-rag/--disable-rag",
    default=True,
    help="Enable/disable RAG-enhanced prompts using knowledge base retrieval (enabled by default)",
)
@click.option(
    "--rag-top-k",
    type=int,
    default=3,
    help="Number of documents to retrieve per phase (default: 3)",
)
@click.option(
    "--rag-min-score",
    type=float,
    default=0.5,
    help="Minimum similarity score for retrieval (0-1, default: 0.5)",
)
def generate(
    csv_file: Path | None,
    profile_file: Path,
    fit_dir: Path | None,
    output_dir: Path,
    period_months: int,
    skip_training_plan: bool,
    skip_data_prep: bool,
    cross_training: bool | None,
    provider: str,
    model: str | None,
    aws_region: str,
    aws_profile: str | None,
    guardrail_id: str | None,
    guardrail_version: str,
    prompts_dir: Path | None,
    prompt_model: str,
    prompt_version: str | None,
    workout_source: str,
    enable_rag: bool,
    rag_top_k: int,
    rag_min_score: float,
) -> None:
    """
    Generate comprehensive cycling analysis reports.

    Orchestrates a multi-agent workflow to analyze cycling data and produce
    professional HTML reports including performance analysis, zone distribution,
    training recommendations, and visual dashboards.

    \b
    Examples:
        # Using profile with raw_training_data_path (simplest)
        cycling-ai generate --profile athlete.json

        # Explicit data sources
        cycling-ai generate \\
            --csv activities.csv \\
            --profile athlete.json \\
            --fit-dir ./fit_files \\
            --output-dir ./my_reports

    \b
    Output Files:
        - index.html - Executive summary and navigation
        - coaching_insights.html - Detailed analysis and recommendations
        - performance_dashboard.html - Visual data dashboard
    """
    try:
        # Load athlete profile early to check for raw_training_data_path
        try:
            import json

            with open(profile_file) as f:
                athlete_profile = json.load(f)
        except Exception as e:
            console.print(f"[red]Error loading athlete profile: {str(e)}[/red]")
            raise click.Abort()

        # Read training_plan_weeks from profile (required field)
        training_plan_weeks = athlete_profile.get("training_plan_weeks")
        if training_plan_weeks is None:
            console.print("[red]Error: 'training_plan_weeks' not found in athlete profile.[/red]")
            console.print(
                "[yellow]Please add 'training_plan_weeks' field to your athlete_profile.json[/yellow]"
            )
            raise click.Abort()

        if (
            not isinstance(training_plan_weeks, int)
            or training_plan_weeks < 1
            or training_plan_weeks > 52
        ):
            console.print(
                f"[red]Error: 'training_plan_weeks' must be an integer between 1 and 52, got: {training_plan_weeks}[/red]"
            )
            raise click.Abort()

        # Determine data sources (CLI args override profile)
        profile_data_path = athlete_profile.get("raw_training_data_path")

        # Use profile path as fallback if CLI args not provided
        if fit_dir is None and profile_data_path:
            fit_dir = Path(profile_data_path)
            console.print(f"[dim]Using data path from athlete profile: {fit_dir}[/dim]")
            console.print()

        # Validate that we have at least one data source
        if csv_file is None and fit_dir is None:
            console.print(
                "[red]Error: No data source found[/red]\n"
                "[dim]Provide either:[/dim]\n"
                "[dim]  1. --csv and/or --fit-dir arguments[/dim]\n"
                "[dim]  2. 'raw_training_data_path' in athlete profile JSON[/dim]"
            )
            raise click.Abort()

        # Validate that FIT directory exists if provided/inferred
        if fit_dir and not fit_dir.is_dir():
            console.print(
                f"[red]Error: FIT directory not found: {fit_dir}[/red]\n"
                "[dim]Check the path in your athlete profile or --fit-dir argument[/dim]"
            )
            raise click.Abort()

        # Display header
        console.print()
        fit_only_mode = csv_file is None

        # Build workout source description
        if not skip_training_plan:
            if workout_source == "library":
                workout_mode = "[dim]Training Plan: Library-based workouts (fast, 0 tokens)[/dim]"
            else:
                workout_mode = "[dim]Training Plan: LLM-generated workouts (flexible)[/dim]"
        else:
            workout_mode = "[dim]Training Plan: Skipped[/dim]"

        if fit_only_mode:
            console.print(
                Panel.fit(
                    "[bold cyan]Multi-Agent Report Generator (FIT-only mode)[/bold cyan]\n"
                    "[dim]Building activity data from FIT files[/dim]\n"
                    f"{workout_mode}",
                    border_style="cyan",
                )
            )
        else:
            console.print(
                Panel.fit(
                    "[bold cyan]Multi-Agent Report Generator[/bold cyan]\n"
                    "[dim]Orchestrating specialized agents for comprehensive analysis[/dim]\n"
                    f"{workout_mode}",
                    border_style="cyan",
                )
            )
        console.print()

        # Validate output directory is writable
        _validate_output_directory(Path(output_dir))

        # Load configuration (finds .cycling-ai.yaml)
        try:
            config = load_config()
        except Exception as e:
            console.print(
                f"[yellow]Warning: Could not load config file (.cycling-ai.yaml): {str(e)}[/yellow]"
            )
            console.print("[dim]Continuing with defaults and environment variables...[/dim]")
            config = None

        # Initialize provider
        console.print("[cyan]Initializing LLM provider...[/cyan]")
        try:
            provider_instance = _initialize_provider(
                provider, model, config, aws_region, aws_profile, guardrail_id, guardrail_version
            )
            console.print(
                f"[green]✓ Provider initialized: {provider} ({provider_instance.config.model})[/green]"
            )
        except ValueError as e:
            console.print(f"[red]Provider initialization failed: {str(e)}[/red]")
            _print_provider_help(provider)
            raise click.Abort() from e
        console.print()

        # Get prompt version from config if not specified via CLI
        if prompt_version is None:
            prompt_version = config.version if config else "1.3"
            console.print(f"[dim]Using prompt version from config: {prompt_version}[/dim]")

        # Initialize prompts manager
        prompts_manager = AgentPromptsManager(
            prompts_dir=prompts_dir,
            model=prompt_model,
            version=prompt_version,
        )
        if prompts_dir:
            console.print(
                f"[cyan]Using prompts from: {prompts_dir}/{prompt_model}/{prompt_version}[/cyan]"
            )
        else:
            console.print(f"[cyan]Using default prompts: {prompt_model}/{prompt_version}[/cyan]")
        console.print()

        # Setup RAG configuration
        rag_config = create_rag_config(
            enabled=enable_rag,
            top_k=rag_top_k,
            min_score=rag_min_score,
        )
        console.print()

        # Create workflow configuration
        workflow_config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            fit_dir_path=fit_dir,
            output_dir=Path(output_dir),
            period_months=period_months,
            generate_training_plan=not skip_training_plan,
            training_plan_weeks=training_plan_weeks,
            fit_only_mode=fit_only_mode,
            skip_data_prep=skip_data_prep,
            analyze_cross_training=cross_training,
            workout_source=workout_source,
            rag_config=rag_config,
        )

        # Validate configuration
        try:
            workflow_config.validate()
        except ValueError as e:
            console.print(f"[red]Configuration validation failed: {str(e)}[/red]")
            _print_validation_help(e)
            raise click.Abort() from e

        # Display configuration summary
        _display_config_summary(workflow_config)
        console.print()

        # Initialize orchestrator with progress tracking
        phase_tracker = PhaseProgressTracker()

        orchestrator = MultiAgentOrchestrator(
            provider=provider_instance,
            prompts_manager=prompts_manager,
            progress_callback=phase_tracker.update_phase,
        )

        # Execute workflow with live progress display
        console.print("[bold]Executing Multi-Agent Workflow[/bold]")
        console.print()

        try:
            # Temporarily suppress console logging during Live display to prevent flickering
            root_logger = logging.getLogger()
            console_handlers = [
                h
                for h in root_logger.handlers
                if isinstance(h, logging.StreamHandler) and h.stream.name == "<stderr>"
            ]
            original_levels = {}

            # Store original levels and set to WARNING (suppress INFO/DEBUG)
            for handler in console_handlers:
                original_levels[handler] = handler.level
                handler.setLevel(logging.WARNING)

            try:
                with Live(phase_tracker.get_table(), refresh_per_second=4, console=console) as live:
                    # Update live display reference in phase tracker
                    phase_tracker._live = live
                    result = orchestrator.execute_workflow(workflow_config)
            finally:
                # Restore original logging levels
                for handler, level in original_levels.items():
                    handler.setLevel(level)
        except KeyboardInterrupt:
            console.print()
            console.print("[yellow]Workflow interrupted by user[/yellow]")
            raise click.Abort()
        except Exception as e:
            console.print()
            console.print(f"[red]Workflow execution error: {str(e)}[/red]")
            raise

        console.print()

        # Generate HTML report from report_data.json if workflow succeeded
        if result.success and workflow_config.generate_training_plan:
            console.print("[cyan]Generating HTML report...[/cyan]")
            try:
                html_path = _generate_html_report(workflow_config.output_dir, result)
                if html_path:
                    console.print(f"[green]✓ HTML report generated: {html_path}[/green]")
                    # Add HTML path to result output files
                    result.output_files.append(html_path)
            except Exception as e:
                console.print(f"[yellow]⚠ HTML report generation failed: {str(e)}[/yellow]")
                console.print("[dim]Report data is still available in report_data.json[/dim]")
            console.print()

        # Display results
        if result.success:
            _display_success_results(result)
        else:
            _display_failure_results(result)
            raise click.Abort()

    except click.Abort:
        # User cancelled or explicit abort
        raise
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        raise click.Abort()
    except Exception as e:
        console.print(f"\n[red]Unexpected error: {str(e)}[/red]")
        console.print("\n[dim]If this error persists, please report it as an issue.[/dim]")
        raise


def _generate_html_report(output_dir: Path, result: WorkflowResult) -> Path | None:
    """
    Generate HTML report from report_data.json.

    Args:
        output_dir: Output directory containing report_data.json
        result: Workflow result

    Returns:
        Path to generated HTML file, or None if generation failed

    Raises:
        Exception: If HTML generation fails
    """
    import json

    from cycling_ai.tools.performance_report_generator import generate_performance_html_from_json

    # Find report_data.json path from Phase 4 result
    phase4_result = next(
        (r for r in result.phase_results if r.phase_name == "report_data_preparation"), None
    )

    if not phase4_result or not phase4_result.success:
        return None

    report_data_path = phase4_result.extracted_data.get("report_data_path")
    if not report_data_path:
        # Fallback to default location
        report_data_path = output_dir / "report_data.json"

    report_data_file = Path(report_data_path)
    if not report_data_file.exists():
        raise FileNotFoundError(f"report_data.json not found at {report_data_path}")

    # Load report data
    with open(report_data_file) as f:
        report_data = json.load(f)

    # Generate HTML
    output_html_path = output_dir / "performance_report.html"
    generate_performance_html_from_json(report_data=report_data, output_path=output_html_path)

    return output_html_path


def _initialize_provider(
    provider_name: str,
    model: str | None,
    config: Any,
    aws_region: str = "us-east-1",
    aws_profile: str | None = None,
    guardrail_id: str | None = None,
    guardrail_version: str = "DRAFT",
) -> BaseProvider:
    """
    Initialize LLM provider from configuration.

    Args:
        provider_name: Name of provider (openai, anthropic, gemini, ollama, bedrock)
        model: Optional specific model name
        config: Configuration object
        aws_region: AWS region for Bedrock (default: us-east-1)
        aws_profile: AWS profile name for Bedrock (optional)
        guardrail_id: AWS Bedrock Guardrail ID (optional)
        guardrail_version: AWS Bedrock Guardrail version (default: DRAFT)

    Returns:
        Initialized provider instance

    Raises:
        ValueError: If API key is missing or provider initialization fails
    """
    # Get provider config from configuration
    provider_config_data: dict[str, Any] | Any = {}
    if config and hasattr(config, "providers"):
        # config.providers is a dict, not an object with attributes
        provider_config_data = config.providers.get(provider_name, {})

    # Determine model (explicit CLI arg > config file)
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

    # Validate API key for non-local providers (bedrock uses AWS credentials)
    if not api_key and provider_name not in ["ollama", "bedrock"]:
        env_var_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "ollama": "",
            "bedrock": "",
        }
        env_var = env_var_map.get(provider_name, "")
        raise ValueError(
            f"API key not found for {provider_name}. "
            f"Please set {env_var} environment variable or configure in config file."
        )

    # Create ProviderConfig with AWS parameters for Bedrock
    additional_params: dict[str, Any] = {}
    if provider_name == "bedrock":
        additional_params["region"] = aws_region
        if aws_profile:
            additional_params["profile_name"] = aws_profile
        if guardrail_id:
            additional_params["guardrail_id"] = guardrail_id
            additional_params["guardrail_version"] = guardrail_version

    provider_config = ProviderConfig(
        provider_name=provider_name,
        api_key=api_key,
        model=model,
        temperature=0.7,
        max_tokens=4096,
        additional_params=additional_params,
    )

    # Create provider instance
    try:
        provider = ProviderFactory.create_provider(provider_config)
        return provider
    except Exception as e:
        raise ValueError(f"Failed to initialize {provider_name} provider: {str(e)}") from e


def _display_config_summary(config: WorkflowConfig) -> None:
    """
    Display workflow configuration summary.

    Args:
        config: Workflow configuration
    """
    table = Table(title="Workflow Configuration", show_header=False, box=None)
    table.add_column("Setting", style="cyan", width=18)
    table.add_column("Value", style="white")

    table.add_row("CSV File", str(config.csv_file_path))
    table.add_row("Athlete Profile", str(config.athlete_profile_path))
    table.add_row(
        "FIT Directory",
        str(config.fit_dir_path) if config.fit_dir_path else "[dim]Not provided[/dim]",
    )
    table.add_row("Output Directory", str(config.output_dir))
    table.add_row("Analysis Period", f"{config.period_months} months")
    table.add_row(
        "Training Plan",
        f"{config.training_plan_weeks} weeks"
        if config.generate_training_plan
        else "[dim]Disabled[/dim]",
    )

    # Show workout library location when using library-based workouts
    if config.generate_training_plan and config.workout_source == "library":
        table.add_row("Workout Library", "data/workout_library.json")

    console.print(table)


def _display_success_results(result: WorkflowResult) -> None:
    """
    Display successful workflow results.

    Args:
        result: Workflow result
    """
    console.print(
        Panel.fit(
            "[bold green]✓ Workflow Completed Successfully[/bold green]",
            border_style="green",
        )
    )
    console.print()

    # Execution summary
    summary_table = Table(title="Execution Summary", show_header=False, box=None)
    summary_table.add_column("Metric", style="cyan", width=18)
    summary_table.add_column("Value", style="white")

    summary_table.add_row("Total Time", f"{result.total_execution_time_seconds:.1f}s")
    summary_table.add_row("Total Tokens", f"{result.total_tokens_used:,}")
    summary_table.add_row(
        "Phases Completed",
        str(sum(1 for r in result.phase_results if r.success)),
    )

    console.print(summary_table)
    console.print()

    # Output files
    if result.output_files:
        console.print("[bold]Generated Reports:[/bold]")
        for file_path in result.output_files:
            console.print(f"  [green]✓[/green] {file_path}")
        console.print()
        console.print("[dim]Open the reports in your browser to view the analysis.[/dim]")
    else:
        console.print(
            "[yellow]⚠[/yellow] [bold yellow]Warning:[/bold yellow] "
            "No report files were generated. The LLM may not have called the report generation tool."
        )
        console.print(
            "[dim]This is a known issue. Check the logs for more details or try again.[/dim]"
        )


def _display_failure_results(result: WorkflowResult) -> None:
    """
    Display failed workflow results.

    Args:
        result: Workflow result
    """
    console.print(
        Panel.fit(
            "[bold red]✗ Workflow Failed[/bold red]",
            border_style="red",
        )
    )
    console.print()

    # Find failed phase
    for phase_result in result.phase_results:
        if phase_result.status == PhaseStatus.FAILED:
            console.print(f"[red]Failed at phase: {phase_result.phase_name}[/red]")
            if phase_result.errors:
                console.print("[red]Errors:[/red]")
                for error in phase_result.errors:
                    console.print(f"  • {error}")
            console.print()
            break

    console.print("[dim]Please check the error messages above and try again.[/dim]")


def _validate_output_directory(output_dir: Path) -> None:
    """
    Validate output directory exists or can be created and is writable.

    Args:
        output_dir: Output directory path

    Raises:
        ValueError: If directory cannot be created or is not writable
    """
    # Create directory if it doesn't exist
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError as e:
        raise ValueError(
            f"Cannot create output directory: {output_dir}. "
            "Permission denied. Try a different location."
        ) from e
    except Exception as e:
        raise ValueError(f"Cannot create output directory: {output_dir}. Error: {str(e)}") from e

    # Check if writable
    if not os.access(output_dir, os.W_OK):
        raise ValueError(f"Output directory is not writable: {output_dir}. Check permissions.")


def _print_provider_help(provider_name: str) -> None:
    """
    Print helpful information for provider initialization failures.

    Args:
        provider_name: Name of the provider
    """
    console.print("\n[bold]Troubleshooting Tips:[/bold]")

    if provider_name == "openai":
        console.print("  1. Set your API key: export OPENAI_API_KEY='sk-...'")
        console.print("  2. Get API key from: https://platform.openai.com/api-keys")
        console.print("  3. Or configure in ~/.cycling-ai/config.yaml")
    elif provider_name == "anthropic":
        console.print("  1. Set your API key: export ANTHROPIC_API_KEY='sk-ant-...'")
        console.print("  2. Get API key from: https://console.anthropic.com/")
        console.print("  3. Or configure in ~/.cycling-ai/config.yaml")
    elif provider_name == "gemini":
        console.print("  1. Set your API key: export GOOGLE_API_KEY='...'")
        console.print("  2. Get API key from: https://aistudio.google.com/app/apikey")
        console.print("  3. Or configure in ~/.cycling-ai/config.yaml")
    elif provider_name == "ollama":
        console.print("  1. Make sure Ollama is running: ollama serve")
        console.print("  2. Install Ollama from: https://ollama.ai/")
        console.print("  3. Pull a model: ollama pull llama3.2:3b")
    elif provider_name == "bedrock":
        console.print("  1. Configure AWS credentials (5 methods available):")
        console.print("     a. AWS CLI: aws configure")
        console.print("     b. Environment: export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...")
        console.print("     c. Profile: Use --aws-profile <profile-name>")
        console.print("     d. Credentials file: ~/.aws/credentials")
        console.print("     e. IAM role (when running on AWS)")
        console.print("  2. Ensure Bedrock model access is enabled in AWS console")
        console.print("  3. Specify region with --aws-region (default: us-east-1)")
        console.print("  4. Example model: anthropic.claude-3-5-sonnet-20241022-v2:0")

    console.print()


def _print_validation_help(error: ValueError) -> None:
    """
    Print helpful information for validation errors.

    Args:
        error: Validation error
    """
    error_msg = str(error).lower()

    console.print("\n[bold]Troubleshooting Tips:[/bold]")

    if "csv file not found" in error_msg:
        console.print("  1. Check the CSV file path is correct")
        console.print("  2. Export your Strava activities:")
        console.print("     - Go to strava.com → Settings → My Account → Download/Export")
        console.print("     - Use the 'activities.csv' file from the export")
    elif "athlete profile not found" in error_msg:
        console.print("  1. Check the profile file path is correct")
        console.print("  2. Create profile.json with format:")
        console.print('     {"name": "...", "age": 35, "weight_kg": 70, "ftp": 250}')
    elif "fit directory not found" in error_msg:
        console.print("  1. Check the FIT directory path is correct")
        console.print("  2. Or omit --fit-dir if you don't have FIT files")
    elif "period_months" in error_msg:
        console.print("  1. Period months must be between 1 and 24")
        console.print("  2. Use --period-months <number>")

    console.print()
