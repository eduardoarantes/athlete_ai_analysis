"""
RAG (Retrieval Augmented Generation) module for cycling AI analysis.

This module provides RAG capabilities using LangChain:
- EmbeddingFactory: Create embedding providers (local/cloud)
- ChromaVectorStore: Wrapper around LangChain Chroma
- RAGManager: Orchestrate two vectorstores (project + user)
- RetrievalResult: Dataclass for retrieval results
"""

from cycling_ai.rag.embeddings import EmbeddingFactory
from cycling_ai.rag.manager import RAGManager, RetrievalResult
from cycling_ai.rag.vectorstore import ChromaVectorStore

__all__ = ["EmbeddingFactory", "ChromaVectorStore", "RAGManager", "RetrievalResult"]
