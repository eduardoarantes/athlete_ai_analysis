"""
RAG integration utilities for orchestration.

Provides PromptAugmenter for formatting retrieved documents into system prompts.
"""

from __future__ import annotations

import logging

from cycling_ai.rag.manager import RetrievalResult

logger = logging.getLogger(__name__)


class PromptAugmenter:
    """
    Formats retrieved documents for prompt injection.

    Handles:
    - Document ranking and filtering
    - Context formatting with sources and scores
    - Token budget management

    Examples:
        >>> from cycling_ai.rag.manager import RetrievalResult
        >>> augmenter = PromptAugmenter(max_context_tokens=2000)
        >>>
        >>> result = RetrievalResult(
        ...     documents=["Polarized training is 80/20..."],
        ...     metadata=[{"title": "Polarized Training"}],
        ...     scores=[0.85],
        ...     query="training",
        ...     collection="domain_knowledge"
        ... )
        >>>
        >>> base_prompt = "You are a cycling coach."
        >>> augmented = augmenter.augment_system_prompt(base_prompt, result)
    """

    def __init__(self, max_context_tokens: int = 2000):
        """
        Initialize prompt augmenter.

        Args:
            max_context_tokens: Maximum tokens for retrieved context (default: 2000)
                Rough estimate: 1 token ≈ 4 characters
        """
        self.max_context_tokens = max_context_tokens
        self.max_context_chars = max_context_tokens * 4  # Rough estimate

    def augment_system_prompt(self, base_prompt: str, retrieval_result: RetrievalResult) -> str:
        """
        Augment system prompt with retrieved context.

        Format:
        ```
        [Original System Prompt]

        ## Retrieved Knowledge Base

        The following relevant information has been retrieved from the
        knowledge base (collection: {collection}):

        ### Document 1 (Score: 0.85)
        [Content]

        ### Document 2 (Score: 0.78)
        [Content]

        Use this information to inform your analysis while maintaining
        objectivity and accuracy.
        ```

        Args:
            base_prompt: Original system prompt
            retrieval_result: Retrieved documents with metadata and scores

        Returns:
            Augmented prompt with retrieved context

        Examples:
            >>> result = RetrievalResult(
            ...     documents=["Content here"],
            ...     metadata=[{"title": "Doc"}],
            ...     scores=[0.9],
            ...     query="test",
            ...     collection="domain_knowledge"
            ... )
            >>> augmented = augmenter.augment_system_prompt("Base", result)
            >>> assert "Retrieved Knowledge Base" in augmented
        """
        # If no documents, return base prompt unchanged
        if not retrieval_result.documents:
            logger.info("RAG: No documents retrieved, using base prompt only")
            return base_prompt

        logger.info(
            f"RAG: Augmenting prompt with {len(retrieval_result.documents)} documents "
            f"from '{retrieval_result.collection}' (scores: "
            f"{[f'{s:.3f}' for s in retrieval_result.scores]})"
        )

        # Build context section
        context_section = self._format_retrieved_documents(retrieval_result)

        # Check token budget
        context_chars = len(context_section)
        if context_chars > self.max_context_chars:
            logger.warning(
                f"RAG: Context truncated from {context_chars} to {self.max_context_chars} chars "
                f"(~{self.max_context_tokens} tokens)"
            )
            # Truncate and add indicator
            context_section = context_section[: self.max_context_chars]
            context_section += "\n\n[...truncated due to length]"
        else:
            logger.info(f"RAG: Context size: {context_chars} chars (~{context_chars // 4} tokens)")

        # Combine base prompt with retrieved context
        augmented_prompt = f"""{base_prompt}

## Retrieved Knowledge Base

The following relevant information has been retrieved from the
knowledge base (collection: {retrieval_result.collection}):

{context_section}

Use this information to inform your analysis while maintaining
objectivity and accuracy. If retrieved context conflicts with
actual data, explain the discrepancy."""

        return augmented_prompt

    def _format_retrieved_documents(self, retrieval_result: RetrievalResult) -> str:
        """
        Format retrieved documents with scores and metadata.

        Args:
            retrieval_result: Retrieved documents

        Returns:
            Formatted string with document contents
        """
        sections = []

        for idx, (doc, metadata, score) in enumerate(
            zip(retrieval_result.documents, retrieval_result.metadata, retrieval_result.scores),
            start=1,
        ):
            # Build header with title if available
            title = metadata.get("title", metadata.get("source_file", f"Document {idx}"))
            header = f"### {title} (Score: {score:.2f})"

            # Format section
            section = f"{header}\n{doc}"
            sections.append(section)

        return "\n\n".join(sections)
