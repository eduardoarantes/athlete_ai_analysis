"""
CLI commands for RAG knowledge indexing.

Provides commands to index domain knowledge and training templates
into the project vectorstore for RAG-enhanced agent context.
"""

from __future__ import annotations

from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from cycling_ai.rag.indexing import KnowledgeIndexer
from cycling_ai.rag.manager import RAGManager

console = Console()


@click.group()
def index() -> None:
    """
    Index knowledge content into RAG vectorstore.

    Commands for populating the project vectorstore with domain knowledge
    and training templates that enhance AI agent responses.
    """
    pass


@index.command()
@click.option(
    "--knowledge-dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "knowledge" / "domain",
    help="Path to domain knowledge directory",
    show_default=True,
)
@click.option(
    "--vectorstore-dir",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "vectorstore",
    help="Path to project vectorstore directory",
    show_default=True,
)
@click.option(
    "--embedding-provider",
    type=click.Choice(["local", "openai"], case_sensitive=False),
    default="local",
    help="Embedding provider to use",
    show_default=True,
)
@click.option(
    "--embedding-model",
    type=str,
    default=None,
    help="Embedding model name (uses provider defaults if not specified)",
)
def domain(
    knowledge_dir: Path,
    vectorstore_dir: Path,
    embedding_provider: str,
    embedding_model: str | None,
) -> None:
    """
    Index domain knowledge markdown files.

    Indexes all markdown files in the knowledge directory into the
    domain_knowledge collection of the project vectorstore.

    Examples:
        # Index with default paths (from project root)
        cycling-ai index domain

        # Index with custom paths
        cycling-ai index domain --knowledge-dir ./my_knowledge --vectorstore-dir ./my_vectorstore

        # Use OpenAI embeddings instead of local
        cycling-ai index domain --embedding-provider openai
    """
    try:
        console.print("[bold]Indexing domain knowledge...[/bold]")

        # Validate knowledge directory
        if not knowledge_dir.exists():
            console.print(f"[red]Error:[/red] Knowledge directory not found: {knowledge_dir}")
            raise SystemExit(1)

        # Initialize RAG manager
        console.print(f"Initializing RAG manager with {embedding_provider} embeddings...")
        rag_manager = RAGManager(
            project_vectorstore_path=vectorstore_dir,
            embedding_provider=embedding_provider,
            embedding_model=embedding_model,
        )

        # Create indexer
        indexer = KnowledgeIndexer(rag_manager=rag_manager)

        # Index domain knowledge
        console.print(f"Scanning markdown files in: {knowledge_dir}")
        stats = indexer.index_domain_knowledge(knowledge_dir)

        # Display results
        total_chunks = sum(stats.values())
        console.print(f"\n[green]Successfully indexed {total_chunks} document chunks![/green]")

        # Create results table
        table = Table(title="Indexing Results by Category")
        table.add_column("Category", style="cyan")
        table.add_column("Chunks Indexed", justify="right", style="green")

        for category, count in sorted(stats.items()):
            table.add_row(category, str(count))

        console.print(table)
        console.print(f"\nVectorstore location: {vectorstore_dir}")

    except Exception as e:
        console.print(f"[red]Error during indexing:[/red] {str(e)}")
        raise SystemExit(1) from None


@index.command()
@click.option(
    "--templates-file",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "knowledge" / "templates" / "training_plans.json",
    help="Path to training templates JSON file",
    show_default=True,
)
@click.option(
    "--vectorstore-dir",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "vectorstore",
    help="Path to project vectorstore directory",
    show_default=True,
)
@click.option(
    "--embedding-provider",
    type=click.Choice(["local", "openai"], case_sensitive=False),
    default="local",
    help="Embedding provider to use",
    show_default=True,
)
@click.option(
    "--embedding-model",
    type=str,
    default=None,
    help="Embedding model name (uses provider defaults if not specified)",
)
def templates(
    templates_file: Path,
    vectorstore_dir: Path,
    embedding_provider: str,
    embedding_model: str | None,
) -> None:
    """
    Index training plan templates.

    Indexes all training templates from JSON file into the
    training_templates collection of the project vectorstore.

    Examples:
        # Index with default paths (from project root)
        cycling-ai index templates

        # Index with custom file
        cycling-ai index templates --templates-file ./my_templates.json

        # Use OpenAI embeddings
        cycling-ai index templates --embedding-provider openai
    """
    try:
        console.print("[bold]Indexing training templates...[/bold]")

        # Validate templates file
        if not templates_file.exists():
            console.print(f"[red]Error:[/red] Templates file not found: {templates_file}")
            raise SystemExit(1)

        # Initialize RAG manager
        console.print(f"Initializing RAG manager with {embedding_provider} embeddings...")
        rag_manager = RAGManager(
            project_vectorstore_path=vectorstore_dir,
            embedding_provider=embedding_provider,
            embedding_model=embedding_model,
        )

        # Create indexer
        indexer = KnowledgeIndexer(rag_manager=rag_manager)

        # Index templates
        console.print(f"Reading templates from: {templates_file}")
        count = indexer.index_training_templates(templates_file)

        # Display results
        console.print(f"\n[green]Successfully indexed {count} training templates![/green]")
        console.print(f"Vectorstore location: {vectorstore_dir}")

    except Exception as e:
        console.print(f"[red]Error during indexing:[/red] {str(e)}")
        raise SystemExit(1) from None


@index.command()
@click.option(
    "--knowledge-dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "knowledge" / "domain",
    help="Path to domain knowledge directory",
    show_default=True,
)
@click.option(
    "--templates-file",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "knowledge" / "templates" / "training_plans.json",
    help="Path to training templates JSON file",
    show_default=True,
)
@click.option(
    "--vectorstore-dir",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path.cwd() / "data" / "vectorstore",
    help="Path to project vectorstore directory",
    show_default=True,
)
@click.option(
    "--embedding-provider",
    type=click.Choice(["local", "openai"], case_sensitive=False),
    default="local",
    help="Embedding provider to use",
    show_default=True,
)
@click.option(
    "--embedding-model",
    type=str,
    default=None,
    help="Embedding model name (uses provider defaults if not specified)",
)
def all(
    knowledge_dir: Path,
    templates_file: Path,
    vectorstore_dir: Path,
    embedding_provider: str,
    embedding_model: str | None,
) -> None:
    """
    Index all knowledge content (domain + templates).

    Convenience command that indexes both domain knowledge and training
    templates in a single operation.

    Examples:
        # Index everything with defaults
        cycling-ai index all

        # Index with custom paths
        cycling-ai index all --knowledge-dir ./knowledge --templates-file ./templates.json

        # Use OpenAI embeddings
        cycling-ai index all --embedding-provider openai
    """
    try:
        console.print("[bold]Indexing all knowledge content...[/bold]\n")

        # Validate inputs
        if not knowledge_dir.exists():
            console.print(f"[red]Error:[/red] Knowledge directory not found: {knowledge_dir}")
            raise SystemExit(1)

        if not templates_file.exists():
            console.print(f"[red]Error:[/red] Templates file not found: {templates_file}")
            raise SystemExit(1)

        # Initialize RAG manager
        console.print(f"Initializing RAG manager with {embedding_provider} embeddings...")
        rag_manager = RAGManager(
            project_vectorstore_path=vectorstore_dir,
            embedding_provider=embedding_provider,
            embedding_model=embedding_model,
        )

        # Create indexer
        indexer = KnowledgeIndexer(rag_manager=rag_manager)

        # Index domain knowledge
        console.print("\n[bold cyan]1. Indexing domain knowledge[/bold cyan]")
        console.print(f"Scanning markdown files in: {knowledge_dir}")
        domain_stats = indexer.index_domain_knowledge(knowledge_dir)
        total_domain_chunks = sum(domain_stats.values())
        console.print(f"[green]✓[/green] Indexed {total_domain_chunks} domain knowledge chunks")

        # Index templates
        console.print("\n[bold cyan]2. Indexing training templates[/bold cyan]")
        console.print(f"Reading templates from: {templates_file}")
        template_count = indexer.index_training_templates(templates_file)
        console.print(f"[green]✓[/green] Indexed {template_count} training templates")

        # Display summary
        console.print("\n[bold green]Indexing complete![/bold green]")

        # Domain knowledge table
        table = Table(title="Domain Knowledge by Category")
        table.add_column("Category", style="cyan")
        table.add_column("Chunks", justify="right", style="green")

        for category, count in sorted(domain_stats.items()):
            table.add_row(category, str(count))

        table.add_row("", "")  # Separator
        table.add_row("[bold]Total[/bold]", f"[bold]{total_domain_chunks}[/bold]")

        console.print(table)

        # Summary stats
        console.print("\n[bold]Summary:[/bold]")
        console.print(f"  Domain knowledge chunks: {total_domain_chunks}")
        console.print(f"  Training templates: {template_count}")
        console.print(f"  Total documents: {total_domain_chunks + template_count}")
        console.print(f"\nVectorstore location: {vectorstore_dir}")

    except Exception as e:
        console.print(f"[red]Error during indexing:[/red] {str(e)}")
        raise SystemExit(1) from None
