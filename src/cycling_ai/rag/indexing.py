"""
Knowledge indexing module for RAG.

Provides KnowledgeIndexer class for indexing domain knowledge (markdown)
and training templates (JSON) into Chroma vectorstore.

Examples:
    >>> from pathlib import Path
    >>> from cycling_ai.rag.manager import RAGManager
    >>> from cycling_ai.rag.indexing import KnowledgeIndexer
    >>>
    >>> # Initialize manager and indexer
    >>> manager = RAGManager(
    ...     project_vectorstore_path=Path("./data/vectorstore"),
    ...     embedding_provider="local"
    ... )
    >>> indexer = KnowledgeIndexer(rag_manager=manager)
    >>>
    >>> # Index domain knowledge
    >>> stats = indexer.index_domain_knowledge(
    ...     knowledge_dir=Path("./data/knowledge/domain")
    ... )
    >>> print(f"Indexed {sum(stats.values())} chunks across {len(stats)} categories")
    >>>
    >>> # Index training templates
    >>> count = indexer.index_training_templates(
    ...     templates_file=Path("./data/knowledge/templates/training_plans.json")
    ... )
    >>> print(f"Indexed {count} training templates")
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from langchain_core.documents import Document

from .manager import RAGManager


@dataclass
class ChunkConfig:
    """
    Configuration for text chunking.

    Attributes:
        chunk_size: Target chunk size in tokens (approximate)
        chunk_overlap: Overlap between chunks in tokens (approximate)
        separator: Text separator for splitting (default: paragraph breaks)
    """

    chunk_size: int = 512  # tokens
    chunk_overlap: int = 50  # tokens
    separator: str = "\n\n"  # Split on paragraphs


class KnowledgeIndexer:
    """
    Indexes knowledge content into vectorstore.

    Supports:
    - Domain knowledge (markdown files with YAML frontmatter)
    - Training templates (JSON)

    The indexer chunks documents to optimal sizes for retrieval,
    preserves metadata, and adds documents to the appropriate
    collections in the project vectorstore.

    Examples:
        >>> indexer = KnowledgeIndexer(rag_manager=manager)
        >>> stats = indexer.index_domain_knowledge(Path("./data/knowledge/domain"))
        >>> stats
        {'training_methodologies': 15, 'testing_protocols': 8, ...}
    """

    def __init__(
        self,
        rag_manager: RAGManager,
        chunk_config: ChunkConfig | None = None,
    ) -> None:
        """
        Initialize indexer.

        Args:
            rag_manager: RAGManager instance with project vectorstore
            chunk_config: Optional chunking configuration (uses defaults if None)
        """
        self.rag_manager = rag_manager
        self.chunk_config = chunk_config or ChunkConfig()

    def index_domain_knowledge(
        self,
        knowledge_dir: Path,
    ) -> dict[str, int]:
        """
        Index markdown files into domain_knowledge collection.

        Recursively walks knowledge_dir, parses markdown files with YAML frontmatter,
        chunks content with overlap, and indexes into project vectorstore.

        Args:
            knowledge_dir: Path to data/knowledge/domain/ directory

        Returns:
            Dictionary mapping category names to number of chunks indexed
            Example: {'training_methodologies': 15, 'testing_protocols': 8}

        Raises:
            FileNotFoundError: If knowledge_dir doesn't exist
            ValueError: If no markdown files found

        Examples:
            >>> stats = indexer.index_domain_knowledge(Path("./data/knowledge/domain"))
            >>> print(f"Categories indexed: {list(stats.keys())}")
            ['training_methodologies', 'testing_protocols', ...]
        """
        if not knowledge_dir.exists():
            raise FileNotFoundError(f"Knowledge directory not found: {knowledge_dir}")

        stats: dict[str, int] = {}
        all_documents: list[Document] = []

        # Find all markdown files recursively
        md_files = list(knowledge_dir.rglob("*.md"))
        if not md_files:
            raise ValueError(f"No markdown files found in {knowledge_dir}")

        for md_file in md_files:
            # Determine category from parent directory name
            category = md_file.parent.name

            # Read file content
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()

            # Parse YAML frontmatter
            metadata, body = self._parse_frontmatter(content)

            # Add category and source file to metadata
            metadata["category"] = category
            metadata["source_file"] = md_file.name

            # Sanitize metadata (convert dates, etc. to strings)
            metadata = self._sanitize_metadata(metadata)

            # Chunk the content
            chunks = self._chunk_markdown(body, metadata)
            all_documents.extend(chunks)

            # Update stats
            stats[category] = stats.get(category, 0) + len(chunks)

        # Add all documents to vectorstore in one operation
        self.rag_manager.project_vectorstore.add_documents(
            collection_name="domain_knowledge",
            documents=all_documents,
        )

        return stats

    def index_training_templates(
        self,
        templates_file: Path,
    ) -> int:
        """
        Index JSON templates into training_templates collection.

        Parses training_plans.json, converts each template to a searchable
        document, and indexes into project vectorstore.

        Args:
            templates_file: Path to training_plans.json

        Returns:
            Number of templates indexed

        Raises:
            FileNotFoundError: If templates_file doesn't exist
            json.JSONDecodeError: If file contains invalid JSON
            ValueError: If JSON doesn't contain 'templates' key

        Examples:
            >>> count = indexer.index_training_templates(
            ...     Path("./data/knowledge/templates/training_plans.json")
            ... )
            >>> print(f"Indexed {count} training templates")
            Indexed 12 training templates
        """
        if not templates_file.exists():
            raise FileNotFoundError(f"Templates file not found: {templates_file}")

        # Read and parse JSON
        with open(templates_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "templates" not in data:
            raise ValueError(
                f"Invalid template file: missing 'templates' key in {templates_file}"
            )

        templates = data["templates"]
        documents: list[Document] = []

        # Convert each template to a Document
        for template in templates:
            # Create searchable text from template
            content = self._template_to_text(template)

            # Create metadata (preserve template structure for reference)
            metadata = {
                "template_id": template.get("id", "unknown"),
                "template_name": template.get("name", "Unknown"),
                "goal": template.get("goal", "general"),
                "duration_weeks": template.get("duration_weeks", 0),
                "experience_level": template.get("experience_level", "intermediate"),
                "source_file": templates_file.name,
            }

            # Create Document
            doc = Document(page_content=content, metadata=metadata)
            documents.append(doc)

        # Add to vectorstore
        self.rag_manager.project_vectorstore.add_documents(
            collection_name="training_templates",
            documents=documents,
        )

        return len(documents)

    def _chunk_markdown(
        self,
        content: str,
        metadata: dict[str, Any],
    ) -> list[Document]:
        """
        Chunk markdown content with overlap.

        Strategy:
        - Split on double newlines (paragraph boundaries)
        - Combine paragraphs until chunk_size reached
        - Add overlap from previous chunk
        - Preserve context across chunks

        Args:
            content: Markdown content (without frontmatter)
            metadata: Base metadata to attach to all chunks

        Returns:
            List of LangChain Documents with chunked content

        Examples:
            >>> chunks = indexer._chunk_markdown(
            ...     "# Title\\n\\nPara 1.\\n\\nPara 2.",
            ...     {"category": "test"}
            ... )
            >>> len(chunks)
            1
        """
        # Split on paragraph boundaries
        paragraphs = content.split(self.chunk_config.separator)

        # Remove empty paragraphs
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        chunks: list[Document] = []
        current_chunk_paras: list[str] = []
        previous_overlap_text = ""

        for para in paragraphs:
            current_chunk_paras.append(para)
            chunk_text = self.chunk_config.separator.join(current_chunk_paras)
            current_tokens = self._estimate_tokens(chunk_text)

            # Check if chunk has reached target size
            if current_tokens >= self.chunk_config.chunk_size:
                # Create full chunk with overlap from previous
                full_chunk_text = previous_overlap_text + chunk_text

                # Create Document
                chunk_metadata = {
                    **metadata,
                    "chunk_index": len(chunks),
                    "chunk_tokens": self._estimate_tokens(full_chunk_text),
                }
                doc = Document(
                    page_content=full_chunk_text,
                    metadata=chunk_metadata,
                )
                chunks.append(doc)

                # Prepare overlap for next chunk
                # Take last N tokens worth of text
                words = chunk_text.split()
                # Estimate words needed for overlap tokens
                overlap_words_count = self.chunk_config.chunk_overlap * 4  # ~4 words per token
                if len(words) > overlap_words_count:
                    overlap_words = words[-overlap_words_count:]
                    previous_overlap_text = " ".join(overlap_words) + "\n\n"
                else:
                    previous_overlap_text = chunk_text + "\n\n"

                # Reset current chunk
                current_chunk_paras = []

        # Handle remaining content
        if current_chunk_paras:
            chunk_text = self.chunk_config.separator.join(current_chunk_paras)
            full_chunk_text = previous_overlap_text + chunk_text

            chunk_metadata = {
                **metadata,
                "chunk_index": len(chunks),
                "chunk_tokens": self._estimate_tokens(full_chunk_text),
            }
            doc = Document(
                page_content=full_chunk_text,
                metadata=chunk_metadata,
            )
            chunks.append(doc)

        return chunks

    def _parse_frontmatter(
        self,
        content: str,
    ) -> tuple[dict[str, Any], str]:
        """
        Parse YAML frontmatter from markdown.

        Expects frontmatter delimited by '---' at start of file:
        ---
        key: value
        ---
        # Content starts here

        Args:
            content: Full markdown file content

        Returns:
            Tuple of (metadata_dict, content_without_frontmatter)
            If no frontmatter found, returns (empty_dict, original_content)

        Examples:
            >>> content = "---\\nkey: value\\n---\\n# Title\\nText"
            >>> metadata, body = indexer._parse_frontmatter(content)
            >>> metadata
            {'key': 'value'}
            >>> body.startswith("# Title")
            True
        """
        # Regex to match YAML frontmatter
        frontmatter_pattern = re.compile(
            r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL | re.MULTILINE
        )
        match = frontmatter_pattern.match(content)

        if match:
            yaml_str = match.group(1)
            try:
                metadata = yaml.safe_load(yaml_str)
                if metadata is None:
                    metadata = {}
            except yaml.YAMLError:
                # If YAML parsing fails, return empty metadata
                metadata = {}

            # Extract body (content after frontmatter)
            body = content[match.end() :]
            return metadata, body
        else:
            # No frontmatter found
            return {}, content

    def _estimate_tokens(self, text: str) -> int:
        """
        Estimate token count (rough approximation).

        Uses rule of thumb: 1 token ≈ 4 characters

        Args:
            text: Text to estimate tokens for

        Returns:
            Estimated token count

        Examples:
            >>> indexer._estimate_tokens("This is a test")
            3
        """
        return len(text) // 4

    def _sanitize_metadata(self, metadata: dict[str, Any]) -> dict[str, Any]:
        """
        Sanitize metadata for vectorstore compatibility.

        Converts non-primitive types to strings to ensure Chroma compatibility.
        Chroma only accepts str, int, float, bool, or None as metadata values.

        Args:
            metadata: Raw metadata dictionary

        Returns:
            Sanitized metadata dictionary

        Examples:
            >>> from datetime import date
            >>> meta = {"date": date(2025, 11, 7), "name": "test"}
            >>> indexer._sanitize_metadata(meta)
            {'date': '2025-11-07', 'name': 'test'}
        """
        sanitized = {}
        for key, value in metadata.items():
            if value is None or isinstance(value, (str, int, float, bool)):
                sanitized[key] = value
            else:
                # Convert complex types to strings
                sanitized[key] = str(value)
        return sanitized

    def _template_to_text(self, template: dict[str, Any]) -> str:
        """
        Convert training template to searchable text.

        Creates a natural language representation of the template
        that captures key information for semantic search.

        Args:
            template: Training template dictionary

        Returns:
            Searchable text representation

        Examples:
            >>> template = {"name": "12-Week Base", "goal": "base_building"}
            >>> text = indexer._template_to_text(template)
            >>> "base_building" in text
            True
        """
        parts: list[str] = []

        # Title and description
        parts.append(f"Training Plan: {template.get('name', 'Unknown')}")
        if "description" in template:
            parts.append(template["description"])

        # Key attributes
        parts.append(f"Goal: {template.get('goal', 'general')}")
        parts.append(f"Duration: {template.get('duration_weeks', 0)} weeks")
        parts.append(f"Experience Level: {template.get('experience_level', 'intermediate')}")

        if "ftp_range" in template:
            ftp_range = template["ftp_range"]
            parts.append(f"FTP Range: {ftp_range[0]}-{ftp_range[1]}W")

        if "weekly_hours_range" in template:
            hours_range = template["weekly_hours_range"]
            parts.append(f"Weekly Hours: {hours_range[0]}-{hours_range[1]} hours")

        # Phase information
        if "structure" in template:
            parts.append("\nTraining Structure:")
            for phase_name, phase_data in template["structure"].items():
                parts.append(f"\n{phase_name.replace('_', ' ').title()}:")
                if "focus" in phase_data:
                    parts.append(f"  Focus: {phase_data['focus']}")
                if "key_workouts" in phase_data:
                    workouts = ", ".join(phase_data["key_workouts"])
                    parts.append(f"  Key Workouts: {workouts}")

        # Notes
        if "notes" in template:
            parts.append(f"\nNotes: {template['notes']}")

        return "\n".join(parts)
