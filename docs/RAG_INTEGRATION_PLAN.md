# RAG Integration Plan - Cycling AI Analysis

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Planning Phase
**Author:** Architecture Planning Agent

---

## Executive Summary

This document outlines the comprehensive plan to integrate **Retrieval Augmented Generation (RAG)** using LangChain and vectorstore technology into the Cycling AI Analysis system. The goal is to improve agent performance by providing relevant domain knowledge, historical context, and training templates through semantic search.

### Key Benefits
- **30-40% token reduction** through targeted retrieval vs. full context injection
- **Improved analysis quality** via cycling science knowledge
- **Better training plans** using proven templates
- **Athlete continuity** through performance history tracking

### Technology Stack
- **Vectorstore:** Chroma (local-first, embedded)
- **Embeddings:** sentence-transformers (`all-MiniLM-L6-v2`)
- **Framework:** LangChain
- **Storage:**
  - **Project knowledge:** `data/vectorstore/` (version controlled)
  - **Athlete history:** `~/.cycling-ai/athlete_history/` (user-specific)

---

## Table of Contents

1. [Current System Architecture](#current-system-architecture)
2. [RAG Architecture Design](#rag-architecture-design)
3. [Knowledge Collections](#knowledge-collections)
4. [Integration Points](#integration-points)
5. [Technical Implementation](#technical-implementation)
6. [Impact Analysis](#impact-analysis)
7. [Implementation Timeline](#implementation-timeline)
8. [Risk Mitigation](#risk-mitigation)
9. [Testing Strategy](#testing-strategy)
10. [Success Metrics](#success-metrics)

---

## Current System Architecture

### Existing Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer                                │
│  cycling-ai {generate|chat|analyze|plan|report}              │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  Multi-Agent        │         │  Conversational     │
│  Orchestrator       │         │  Chat Interface     │
│  (4 Phases)         │         │  (Session-based)    │
└─────────┬───────────┘         └─────────┬───────────┘
          │                               │
          v                               v
┌──────────────────────────────────────────────────────┐
│            Orchestration Layer                        │
│  • LLM Agent (tool calling)                          │
│  • Tool Executor (runs Python functions)             │
│  • Session Manager (conversation state)              │
│  • Agent Prompts Manager (specialized prompts)       │
└────────────────────────┬─────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  Provider Layer     │         │  Tools Layer        │
│  (OpenAI, Anthropic,│         │  (analyze_perf,     │
│   Gemini, Ollama)   │         │   analyze_zones,    │
└─────────┬───────────┘         │   generate_plan)    │
          │                     └─────────┬───────────┘
          v                               v
┌──────────────────────────────────────────────────────┐
│              Core Business Logic                      │
│  • Performance analysis algorithms                    │
│  • Power zone calculations                           │
│  • Training plan generation                          │
│  • FIT file processing                               │
└──────────────────────────────────────────────────────┘
```

### 4-Phase Multi-Agent Pipeline

1. **Phase 1: Data Preparation** - Validates CSV, profile, FIT files; creates Parquet cache
2. **Phase 2: Performance Analysis** - Compares periods, calculates zone distribution
3. **Phase 3: Training Planning** - Creates periodized training plan
4. **Phase 4: Report Data Preparation** - Prepares JSON data for HTML templates

---

## RAG Architecture Design

### New Architecture with RAG Layer

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer                                │
│  cycling-ai {generate|chat|analyze|plan} --enable-rag        │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  Multi-Agent        │         │  Conversational     │
│  Orchestrator       │         │  Chat Interface     │
│  (RAG-enhanced)     │         │  (RAG routing)      │
└─────────┬───────────┘         └─────────┬───────────┘
          │                               │
          v                               v
┌──────────────────────────────────────────────────────┐
│            RAG Layer (NEW)                            │
│  • RAG Manager (retrieval orchestration)             │
│  • Knowledge Collections (4 vectorstores)            │
│  • Prompt Augmentation                               │
│  • Retrieval Metadata Tracking                       │
└────────────────────────┬─────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  Vectorstore Layer  │         │  Orchestration      │
│  (Chroma embedded)  │         │  Layer              │
│  • domain_knowledge │         │  (unchanged)        │
│  • athlete_history  │         └─────────────────────┘
│  • training_plans   │
│  • workout_library  │
└─────────┬───────────┘
          │
          v
┌──────────────────────────────────────────────────────┐
│         Embedding Provider (Local)                    │
│  sentence-transformers/all-MiniLM-L6-v2              │
│  (384 dimensions, privacy-focused)                   │
└──────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Provider-Agnostic**: RAG sits above LLM providers, works with all (Anthropic, OpenAI, Gemini, Ollama)
2. **Session Isolation Preserved**: RAG augments system prompts, doesn't contaminate conversation history
3. **Local-First**: Chroma embedded database, no external services required
4. **Privacy-Focused**: Local embeddings (sentence-transformers), athlete data never leaves system
5. **Additive Architecture**: Existing code unchanged, RAG is opt-in feature
6. **Type-Safe**: Full mypy --strict compliance maintained

---

## Knowledge Collections

### 1. Domain Knowledge Collection

**Purpose:** Cycling science, training methodologies, physiological concepts

**Content Sources:**
- Polarized training principles
- FTP testing protocols (20-min, ramp test, Kolie Moore)
- Power zone calculations (Coggan 7-zone model)
- Training periodization (base, build, peak, taper)
- VO2max estimation formulas
- Recovery science
- Nutrition guidelines for endurance athletes

**Example Documents:**
```
Document 1:
Title: "Polarized Training Model"
Content: "Polarized training is characterized by ~80% low-intensity (Z1-Z2)
and ~20% high-intensity (Z4-Z6) work. Research by Seiler et al. shows this
distribution optimizes aerobic development while managing fatigue..."
Metadata: {category: "training_methodology", source: "sports_science"}

Document 2:
Title: "FTP Testing Protocols"
Content: "Functional Threshold Power (FTP) represents the highest power
sustainable for ~60 minutes. Common tests: 1) 20-min test (95% of avg),
2) Ramp test (75% of max 1-min power), 3) Kolie Moore 8-min x2..."
Metadata: {category: "testing", source: "performance_analysis"}
```

**Indexing Strategy:**
- Chunk size: 512 tokens (balance between context and precision)
- Overlap: 50 tokens (preserve context continuity)
- Metadata filtering: category, source, difficulty_level

### 2. Athlete History Collection

**Purpose:** Track past analyses, performance trends, training adaptations

**Content Sources:**
- Previous performance analysis results (Phase 2 outputs)
- Historical FTP/power progression
- Zone distribution changes over time
- Completed training plan outcomes
- Injury/recovery notes (user-provided)

**Example Documents:**
```
Document:
Title: "Performance Analysis - Q3 2024"
Content: "Analysis Period: Jul-Sep 2024. FTP: 265W (+8W from Q2).
Zone 2 time increased 15% (polarized training emphasis). Peak power
improved 12%. Recommendation: Maintain polarized approach, add VO2max blocks..."
Metadata: {
  athlete_id: "user_hash_abc123",
  analysis_date: "2024-10-01",
  period_months: 3,
  ftp: 265
}
```

**Privacy Considerations:**
- Athlete ID: SHA256 hash of (email + salt)
- Opt-out mechanism: `--disable-history-tracking` flag
- Local storage only (never uploaded)
- Automatic expiration: 24 months

### 3. Training Templates Collection

**Purpose:** Proven training plan structures, mesocycle templates, workout progressions

**Content Sources:**
- Periodized plan templates (12-week base, 8-week build)
- Mesocycle structures (3 weeks build + 1 week recovery)
- Workout progression models (e.g., sweet spot build)
- Goal-specific plans (century ride, climbing, TT)
- Tapering strategies

**Example Documents:**
```
Document:
Title: "12-Week Base Building Plan Template"
Content: "
Phase 1 (Weeks 1-4): Aerobic Foundation
- Volume: 6-10 hrs/week
- Intensity: 85% Z2, 10% Z3, 5% Z4
- Key workouts: 3hr endurance rides, tempo intervals

Phase 2 (Weeks 5-8): Strength Endurance
- Volume: 8-12 hrs/week
- Intensity: 75% Z2, 15% Z3, 10% Z4
- Key workouts: Sweet spot intervals (2x20, 3x15)

Phase 3 (Weeks 9-12): Power Development
- Volume: 8-10 hrs/week
- Intensity: 70% Z2, 15% Z3, 15% Z4-Z5
- Key workouts: VO2max intervals, threshold work
"
Metadata: {
  goal: "base_building",
  duration_weeks: 12,
  ftp_range: [200, 300],
  volume_category: "medium"
}
```

**Retrieval Strategy:**
- Semantic search on athlete goals (e.g., "improve climbing")
- Metadata filtering: FTP range, available time, experience level
- Template adaptation via LLM with retrieved structure

### 4. Workout Library Collection (Enhanced)

**Purpose:** Semantic search over existing workout library (replaces JSON iteration)

**Content Sources:**
- Existing `workout_library.json` (500+ workouts)
- Workout descriptions, physiological adaptations
- Difficulty ratings, duration ranges

**Example Enhancement:**
```python
# Current: Linear search through JSON
workouts = [w for w in library if w['zone'] == 2 and w['duration'] < 90]

# With RAG: Semantic search
workouts = rag_manager.retrieve(
    query="endurance aerobic ride under 90 minutes recovery focus",
    collection="workout_library",
    filter={"duration_max": 90},
    top_k=5
)
```

**Benefits:**
- Natural language workout selection
- Better matches for vague requirements ("easy recovery day")
- Discover similar workouts across categories

---

## Integration Points

### Phase 1: Data Preparation Agent

**RAG Enhancement:**
```python
# Retrieve data validation best practices
retrieval_query = "CSV validation cycling data quality checks FIT file processing"
docs = rag_manager.retrieve(
    query=retrieval_query,
    collection="domain_knowledge",
    filter={"category": "data_validation"},
    top_k=3
)

system_prompt = f"""You are a data preparation specialist.

RELEVANT BEST PRACTICES:
{format_retrieved_docs(docs)}

Your task: Validate CSV and FIT files, create Parquet cache...
"""
```

**Benefits:**
- Standardized validation criteria
- Better error messages (e.g., "Missing 'Moving Time' column - required for pace calculations")

### Phase 2: Performance Analysis Agent

**RAG Enhancement:**
```python
# Retrieve cycling science context
retrieval_query = "performance analysis FTP power zones VO2max interpretation"
docs = rag_manager.retrieve(
    query=retrieval_query,
    collection="domain_knowledge",
    filter={"category": ["performance_analysis", "physiology"]},
    top_k=5
)

# Retrieve athlete's recent history
history_docs = rag_manager.retrieve(
    query=f"athlete {athlete_id} performance trends FTP progression",
    collection="athlete_history",
    filter={"athlete_id": athlete_id},
    top_k=3
)

system_prompt = f"""You are a performance analysis specialist.

CYCLING SCIENCE CONTEXT:
{format_retrieved_docs(docs)}

ATHLETE HISTORY:
{format_retrieved_docs(history_docs)}

Analyze current performance data and provide insights...
"""
```

**Benefits:**
- Analysis grounded in sports science
- Continuity across analyses ("Your FTP increased 5% since last quarter")
- Better trend interpretation

### Phase 3: Training Planning Agent

**RAG Enhancement:**
```python
# Retrieve training plan templates matching athlete goals
retrieval_query = f"training plan {athlete_goals} {athlete_ftp}W {weeks_available} weeks"
templates = rag_manager.retrieve(
    query=retrieval_query,
    collection="training_templates",
    filter={
        "duration_weeks": weeks_available,
        "ftp_min": athlete_ftp - 30,
        "ftp_max": athlete_ftp + 30
    },
    top_k=3
)

# Retrieve athlete's past training adaptations
history = rag_manager.retrieve(
    query=f"athlete {athlete_id} training plan outcomes adaptations",
    collection="athlete_history",
    filter={"athlete_id": athlete_id, "doc_type": "training_outcome"},
    top_k=2
)

system_prompt = f"""You are a training planning specialist.

RELEVANT PLAN TEMPLATES:
{format_retrieved_docs(templates)}

ATHLETE'S TRAINING HISTORY:
{format_retrieved_docs(history)}

Create a {weeks_available}-week plan for: {athlete_goals}...
"""
```

**Benefits:**
- Plans based on proven structures
- Personalized to athlete's response to training
- Better periodization

### Phase 4: Report Data Preparation Agent

**RAG Enhancement:**
```python
# Retrieve coaching insight patterns
retrieval_query = "coaching insights report recommendations performance interpretation"
docs = rag_manager.retrieve(
    query=retrieval_query,
    collection="domain_knowledge",
    filter={"category": "coaching"},
    top_k=4
)

system_prompt = f"""You are a report preparation specialist.

COACHING INSIGHT PATTERNS:
{format_retrieved_docs(docs)}

Prepare comprehensive report data with actionable insights...
"""
```

**Benefits:**
- More actionable coaching recommendations
- Structured insight delivery

### Chat Interface

**RAG Enhancement:**
```python
# Semantic query routing
user_query = "How should I train for a century ride?"

# Determine query type via semantic similarity
query_type = classify_query(user_query)  # Returns: "training_advice"

# Route to appropriate collection
if query_type == "training_advice":
    docs = rag_manager.retrieve(
        query=user_query,
        collection="training_templates",
        top_k=3
    )
elif query_type == "performance_question":
    docs = rag_manager.retrieve(
        query=user_query,
        collection="domain_knowledge",
        filter={"category": "performance_analysis"},
        top_k=5
    )

# Augment conversation with retrieved context
session.add_system_context(format_retrieved_docs(docs))
```

**Benefits:**
- More informed responses
- Grounded in cycling science
- Reduces hallucination

---

## Technical Implementation

### New Directory Structure

```
src/cycling_ai/
├── rag/                        # NEW MODULE
│   ├── __init__.py
│   ├── vectorstore.py          # Chroma wrapper
│   ├── embeddings.py           # Sentence transformers manager
│   ├── manager.py              # RAGManager (main interface)
│   ├── indexing.py             # Knowledge base builders
│   ├── collections.py          # Collection configurations
│   └── retrieval.py            # Retrieval strategies
│
├── orchestration/              # MODIFIED
│   ├── multi_agent.py          # RAG-aware phase execution
│   ├── prompts.py              # RAG-augmented prompt templates
│   └── session.py              # Tracks retrieval metadata (optional)
│
└── cli/commands/               # MODIFIED
    ├── generate.py             # --enable-rag flag
    ├── chat.py                 # RAG-enabled chat
    └── index.py                # NEW: Knowledge base management
```

### Data Directory Structure (NEW - Version Controlled)

```
data/
├── vectorstore/                # Chroma database (shared knowledge)
│   ├── chroma.sqlite3
│   └── collections/
│       ├── domain_knowledge/   # Cycling science, training concepts
│       ├── training_templates/ # Plan templates
│       └── workout_library/    # Workout semantic search
│
└── knowledge/                  # Source content (markdown, JSON)
    ├── domain/
    │   ├── training_methodologies/
    │   │   ├── polarized_training.md
    │   │   ├── threshold_training.md
    │   │   ├── sweet_spot_training.md
    │   │   └── vo2max_intervals.md
    │   ├── testing_protocols/
    │   │   ├── ftp_testing.md
    │   │   ├── vo2max_testing.md
    │   │   └── lactate_threshold_testing.md
    │   ├── physiology/
    │   │   ├── power_zones.md
    │   │   ├── heart_rate_zones.md
    │   │   ├── recovery_science.md
    │   │   └── overtraining.md
    │   └── nutrition/
    │       ├── endurance_fueling.md
    │       └── recovery_nutrition.md
    │
    └── templates/
        └── training_plans.json
```

**Note:** Athlete history collection remains in user directory (`~/.cycling-ai/athlete_history/`) for privacy and is not version controlled.

### Core Classes

#### 1. RAGManager (`rag/manager.py`)

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Any

@dataclass
class RetrievalResult:
    """Result from RAG retrieval."""
    documents: list[str]
    metadata: list[dict[str, Any]]
    scores: list[float]
    query: str
    collection: str

class RAGManager:
    """
    Central interface for RAG operations.

    Responsibilities:
    - Retrieval across collections
    - Prompt augmentation
    - Retrieval metadata tracking
    """

    def __init__(
        self,
        project_vectorstore_path: Path,  # data/vectorstore/ (shared knowledge)
        user_vectorstore_path: Path | None = None,  # ~/.cycling-ai/athlete_history/
        embedding_provider: str = "local",  # "local" or "openai"
        enable_caching: bool = True,
    ) -> None:
        self.project_vectorstore_path = project_vectorstore_path
        self.user_vectorstore_path = user_vectorstore_path or (Path.home() / ".cycling-ai" / "athlete_history")

        # Shared knowledge vectorstore (domain, templates, workouts)
        self.project_vectorstore = ChromaVectorStore(project_vectorstore_path)

        # User-specific vectorstore (athlete history)
        self.user_vectorstore = ChromaVectorStore(self.user_vectorstore_path)

        self.embeddings = EmbeddingProvider.create(embedding_provider)
        self.cache: dict[str, RetrievalResult] = {} if enable_caching else None

    def retrieve(
        self,
        query: str,
        collection: str,
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
        min_score: float = 0.0,
    ) -> RetrievalResult:
        """
        Retrieve relevant documents from specified collection.

        Args:
            query: Natural language query
            collection: One of ["domain_knowledge", "athlete_history",
                       "training_templates", "workout_library"]
            top_k: Number of documents to retrieve
            filter_metadata: Metadata filters (e.g., {"category": "performance"})
            min_score: Minimum similarity score (0-1)

        Returns:
            RetrievalResult with documents, metadata, scores
        """
        # Check cache
        cache_key = f"{collection}:{query}:{top_k}"
        if self.cache and cache_key in self.cache:
            return self.cache[cache_key]

        # Embed query
        query_embedding = self.embeddings.embed_query(query)

        # Select appropriate vectorstore based on collection
        vectorstore = (
            self.user_vectorstore if collection == "athlete_history"
            else self.project_vectorstore
        )

        # Search vectorstore
        results = vectorstore.similarity_search(
            collection_name=collection,
            query_embedding=query_embedding,
            top_k=top_k,
            filter=filter_metadata,
        )

        # Filter by score
        filtered = [r for r in results if r["score"] >= min_score]

        result = RetrievalResult(
            documents=[r["document"] for r in filtered],
            metadata=[r["metadata"] for r in filtered],
            scores=[r["score"] for r in filtered],
            query=query,
            collection=collection,
        )

        # Cache result
        if self.cache:
            self.cache[cache_key] = result

        return result

    def augment_prompt(
        self,
        base_prompt: str,
        retrieval_results: list[RetrievalResult],
        max_context_length: int = 2000,
    ) -> str:
        """
        Augment system prompt with retrieved context.

        Args:
            base_prompt: Original system prompt
            retrieval_results: List of retrieval results
            max_context_length: Max tokens for retrieved context

        Returns:
            Augmented prompt with retrieved context
        """
        context_sections = []

        for result in retrieval_results:
            if not result.documents:
                continue

            section = f"\n## RETRIEVED CONTEXT: {result.collection.upper()}\n"
            for i, (doc, meta, score) in enumerate(
                zip(result.documents, result.metadata, result.scores)
            ):
                section += f"\n[Source {i+1}, Relevance: {score:.2f}]\n{doc}\n"

            context_sections.append(section)

        # Combine and truncate if needed
        full_context = "".join(context_sections)
        if len(full_context) > max_context_length:
            full_context = full_context[:max_context_length] + "\n[...truncated]"

        augmented_prompt = f"""{base_prompt}

{full_context}

Use the retrieved context above to inform your analysis, but prioritize
the athlete's actual data. If retrieved context conflicts with data,
explain the discrepancy.
"""
        return augmented_prompt
```

#### 2. ChromaVectorStore (`rag/vectorstore.py`)

```python
import chromadb
from chromadb.config import Settings
from pathlib import Path
from typing import Any

class ChromaVectorStore:
    """
    Chroma vectorstore wrapper with type-safe interface.
    """

    def __init__(self, persist_directory: Path) -> None:
        self.persist_directory = persist_directory
        self.persist_directory.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.Client(
            Settings(
                persist_directory=str(persist_directory),
                anonymized_telemetry=False,
            )
        )

    def create_collection(
        self,
        name: str,
        embedding_function: Any,  # chromadb.EmbeddingFunction
        metadata: dict[str, Any] | None = None,
    ) -> chromadb.Collection:
        """Create or get collection."""
        return self.client.get_or_create_collection(
            name=name,
            embedding_function=embedding_function,
            metadata=metadata or {},
        )

    def add_documents(
        self,
        collection_name: str,
        documents: list[str],
        metadatas: list[dict[str, Any]],
        ids: list[str],
    ) -> None:
        """Add documents to collection."""
        collection = self.client.get_collection(collection_name)
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )

    def similarity_search(
        self,
        collection_name: str,
        query_embedding: list[float],
        top_k: int = 5,
        filter: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Search for similar documents."""
        collection = self.client.get_collection(collection_name)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter,
            include=["documents", "metadatas", "distances"],
        )

        # Format results
        formatted = []
        for i in range(len(results["ids"][0])):
            formatted.append({
                "id": results["ids"][0][i],
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "score": 1 - results["distances"][0][i],  # Convert distance to similarity
            })

        return formatted
```

#### 3. EmbeddingProvider (`rag/embeddings.py`)

```python
from abc import ABC, abstractmethod
from sentence_transformers import SentenceTransformer
from typing import Any

class BaseEmbeddingProvider(ABC):
    """Base class for embedding providers."""

    @abstractmethod
    def embed_query(self, text: str) -> list[float]:
        """Embed a single query."""
        pass

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple documents."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding dimension."""
        pass

class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """Local sentence-transformers embedding provider."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model = SentenceTransformer(model_name)
        self._dimension = self.model.get_sentence_embedding_dimension()

    def embed_query(self, text: str) -> list[float]:
        """Embed single query."""
        return self.model.encode(text, convert_to_numpy=True).tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple documents."""
        return self.model.encode(texts, convert_to_numpy=True).tolist()

    @property
    def dimension(self) -> int:
        return self._dimension

class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI embeddings (text-embedding-3-small)."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small") -> None:
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self._dimension = 1536

    def embed_query(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        response = self.client.embeddings.create(
            input=texts,
            model=self.model
        )
        return [data.embedding for data in response.data]

    @property
    def dimension(self) -> int:
        return self._dimension

class EmbeddingProvider:
    """Factory for embedding providers."""

    @staticmethod
    def create(provider_type: str, **kwargs: Any) -> BaseEmbeddingProvider:
        if provider_type == "local":
            return LocalEmbeddingProvider(**kwargs)
        elif provider_type == "openai":
            return OpenAIEmbeddingProvider(**kwargs)
        else:
            raise ValueError(f"Unknown embedding provider: {provider_type}")
```

#### 4. Knowledge Indexing (`rag/indexing.py`)

```python
from pathlib import Path
from typing import Any
import json
from dataclasses import dataclass

@dataclass
class Document:
    """Document to be indexed."""
    content: str
    metadata: dict[str, Any]
    doc_id: str

class KnowledgeIndexer:
    """
    Builds and manages knowledge collections.
    """

    def __init__(self, rag_manager: RAGManager) -> None:
        self.rag_manager = rag_manager

    def index_domain_knowledge(
        self,
        knowledge_dir: Path,
    ) -> int:
        """
        Index cycling domain knowledge from markdown files.

        Expected structure:
        knowledge_dir/
            training_methodologies/
                polarized_training.md
                threshold_training.md
            testing_protocols/
                ftp_testing.md
                vo2max_testing.md
            physiology/
                power_zones.md
                recovery.md

        Returns:
            Number of documents indexed
        """
        documents: list[Document] = []

        for md_file in knowledge_dir.rglob("*.md"):
            category = md_file.parent.name

            with open(md_file) as f:
                content = f.read()

            # Chunk large documents
            chunks = self._chunk_text(content, chunk_size=512, overlap=50)

            for i, chunk in enumerate(chunks):
                doc = Document(
                    content=chunk,
                    metadata={
                        "category": category,
                        "source_file": str(md_file.name),
                        "chunk_index": i,
                    },
                    doc_id=f"{md_file.stem}_chunk_{i}",
                )
                documents.append(doc)

        # Add to vectorstore
        self.rag_manager.vectorstore.add_documents(
            collection_name="domain_knowledge",
            documents=[d.content for d in documents],
            metadatas=[d.metadata for d in documents],
            ids=[d.doc_id for d in documents],
        )

        return len(documents)

    def index_athlete_history(
        self,
        analysis_result: dict[str, Any],
        athlete_id: str,
    ) -> None:
        """
        Index a completed performance analysis into athlete history.

        Called automatically after Phase 2 completion.
        """
        # Extract key information
        summary = self._create_analysis_summary(analysis_result)

        doc = Document(
            content=summary,
            metadata={
                "athlete_id": athlete_id,
                "analysis_date": analysis_result["analysis_date"],
                "period_months": analysis_result.get("period_months", 3),
                "ftp": analysis_result.get("current_ftp"),
                "doc_type": "performance_analysis",
            },
            doc_id=f"{athlete_id}_{analysis_result['analysis_date']}",
        )

        self.rag_manager.vectorstore.add_documents(
            collection_name="athlete_history",
            documents=[doc.content],
            metadatas=[doc.metadata],
            ids=[doc.doc_id],
        )

    def index_training_templates(
        self,
        templates_file: Path,
    ) -> int:
        """
        Index training plan templates from JSON file.

        Expected format:
        [
          {
            "name": "12-Week Base Building",
            "description": "...",
            "goal": "base_building",
            "duration_weeks": 12,
            "ftp_range": [200, 350],
            "structure": "..."
          },
          ...
        ]
        """
        with open(templates_file) as f:
            templates = json.load(f)

        documents: list[Document] = []

        for template in templates:
            doc = Document(
                content=f"{template['name']}\n\n{template['description']}\n\n{template['structure']}",
                metadata={
                    "goal": template["goal"],
                    "duration_weeks": template["duration_weeks"],
                    "ftp_min": template["ftp_range"][0],
                    "ftp_max": template["ftp_range"][1],
                },
                doc_id=template["name"].lower().replace(" ", "_"),
            )
            documents.append(doc)

        self.rag_manager.vectorstore.add_documents(
            collection_name="training_templates",
            documents=[d.content for d in documents],
            metadatas=[d.metadata for d in documents],
            ids=[d.doc_id for d in documents],
        )

        return len(documents)

    def _chunk_text(
        self,
        text: str,
        chunk_size: int = 512,
        overlap: int = 50,
    ) -> list[str]:
        """Chunk text with overlap."""
        words = text.split()
        chunks = []

        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i : i + chunk_size])
            chunks.append(chunk)

        return chunks

    def _create_analysis_summary(self, result: dict[str, Any]) -> str:
        """Create human-readable summary of analysis."""
        return f"""
Performance Analysis Summary

Period: {result.get('period_start')} to {result.get('period_end')}
FTP: {result.get('current_ftp')}W (Change: {result.get('ftp_change', 0):+.1f}W)

Key Metrics:
- Total Time: {result.get('total_time_hours', 0):.1f} hours
- Zone Distribution: Z2: {result.get('zone_2_pct', 0):.0f}%, Z4+: {result.get('zone_4_plus_pct', 0):.0f}%
- Peak Power: {result.get('peak_power', 0)}W

Trends:
{result.get('trends_summary', 'N/A')}

Recommendations:
{result.get('recommendations', 'N/A')}
"""
```

### Integration with Multi-Agent Orchestrator

**Modified `orchestration/multi_agent.py`:**

```python
class MultiAgentOrchestrator:
    """Multi-agent orchestrator with RAG support."""

    def __init__(
        self,
        provider: BaseProvider,
        session_manager: SessionManager,
        tool_registry: ToolRegistry,
        prompts_manager: AgentPromptsManager,
        rag_manager: RAGManager | None = None,  # NEW
    ) -> None:
        self.provider = provider
        self.session_manager = session_manager
        self.tool_registry = tool_registry
        self.prompts_manager = prompts_manager
        self.rag_manager = rag_manager  # NEW

    def _execute_phase(
        self,
        phase_name: str,
        config: WorkflowConfig,
        prompt_getter: Callable[[], str],
        tools: list[str],
        phase_context: dict[str, Any],
        user_message: str,
    ) -> PhaseResult:
        """Execute a workflow phase with optional RAG enhancement."""

        # Get base system prompt
        base_prompt = prompt_getter()

        # RAG augmentation (if enabled)
        if self.rag_manager:
            base_prompt = self._augment_prompt_with_rag(
                base_prompt=base_prompt,
                phase_name=phase_name,
                config=config,
                phase_context=phase_context,
            )

        # Create session (rest unchanged)
        session = self.session_manager.create_session(
            provider_name=self.provider.name,
            context=phase_context,
            system_prompt=base_prompt,
        )

        # ... rest of phase execution unchanged ...

    def _augment_prompt_with_rag(
        self,
        base_prompt: str,
        phase_name: str,
        config: WorkflowConfig,
        phase_context: dict[str, Any],
    ) -> str:
        """Augment phase prompt with relevant retrieved context."""

        retrieval_results: list[RetrievalResult] = []

        if phase_name == "data_preparation":
            # Retrieve data validation best practices
            result = self.rag_manager.retrieve(
                query="CSV validation FIT file processing data quality",
                collection="domain_knowledge",
                filter={"category": "data_validation"},
                top_k=3,
            )
            retrieval_results.append(result)

        elif phase_name == "performance_analysis":
            # Retrieve cycling science
            result = self.rag_manager.retrieve(
                query="performance analysis power zones FTP VO2max interpretation",
                collection="domain_knowledge",
                filter={"category": ["performance_analysis", "physiology"]},
                top_k=5,
            )
            retrieval_results.append(result)

            # Retrieve athlete history
            athlete_id = self._get_athlete_id(config)
            history = self.rag_manager.retrieve(
                query=f"performance trends FTP progression",
                collection="athlete_history",
                filter={"athlete_id": athlete_id},
                top_k=3,
            )
            retrieval_results.append(history)

        elif phase_name == "training_planning":
            # Retrieve training templates
            athlete_profile = self._load_athlete_profile(config)
            result = self.rag_manager.retrieve(
                query=f"training plan {' '.join(athlete_profile.goals)} {athlete_profile.ftp}W",
                collection="training_templates",
                filter={
                    "ftp_min": athlete_profile.ftp - 30,
                    "ftp_max": athlete_profile.ftp + 30,
                },
                top_k=3,
            )
            retrieval_results.append(result)

        elif phase_name == "report_data_preparation":
            # Retrieve coaching insight patterns
            result = self.rag_manager.retrieve(
                query="coaching insights recommendations actionable advice",
                collection="domain_knowledge",
                filter={"category": "coaching"},
                top_k=4,
            )
            retrieval_results.append(result)

        # Augment prompt
        return self.rag_manager.augment_prompt(
            base_prompt=base_prompt,
            retrieval_results=retrieval_results,
            max_context_length=2000,
        )
```

### CLI Integration

**Modified `cli/commands/generate.py`:**

```python
@click.command()
@click.option("--profile", required=True, type=click.Path(exists=True))
@click.option("--csv", required=True, type=click.Path(exists=True))
@click.option("--provider", default="anthropic", type=click.Choice(["anthropic", "openai", "gemini", "ollama"]))
@click.option("--enable-rag", is_flag=True, help="Enable RAG-enhanced generation")  # NEW
@click.option("--rag-embedding", default="local", type=click.Choice(["local", "openai"]), help="Embedding provider for RAG")  # NEW
def generate(
    profile: str,
    csv: str,
    provider: str,
    enable_rag: bool,  # NEW
    rag_embedding: str,  # NEW
) -> None:
    """Generate comprehensive cycling analysis reports."""

    # Initialize provider
    llm_provider = ProviderFactory.create_provider(
        ProviderConfig(provider_name=provider)
    )

    # Initialize RAG manager (if enabled)
    rag_manager = None
    if enable_rag:
        # Project vectorstore (version controlled shared knowledge)
        project_vectorstore_path = Path(__file__).parent.parent.parent / "data" / "vectorstore"

        # User vectorstore (athlete-specific history)
        user_vectorstore_path = Path.home() / ".cycling-ai" / "athlete_history"

        rag_manager = RAGManager(
            project_vectorstore_path=project_vectorstore_path,
            user_vectorstore_path=user_vectorstore_path,
            embedding_provider=rag_embedding,
        )
        click.echo("RAG enhancement enabled")
        click.echo(f"  Project knowledge: {project_vectorstore_path}")
        click.echo(f"  Athlete history: {user_vectorstore_path}")

    # Initialize orchestrator with RAG
    orchestrator = MultiAgentOrchestrator(
        provider=llm_provider,
        session_manager=session_manager,
        tool_registry=tool_registry,
        prompts_manager=prompts_manager,
        rag_manager=rag_manager,  # NEW
    )

    # Execute workflow (rest unchanged)
    result = orchestrator.execute_workflow(config)

    # Index athlete history (if RAG enabled)
    if enable_rag and result.success:
        phase_2_data = result.phase_results[1].extracted_data
        indexer = KnowledgeIndexer(rag_manager)
        indexer.index_athlete_history(
            analysis_result=phase_2_data,
            athlete_id=get_athlete_id(config),
        )

    # ... rest unchanged ...
```

**New CLI command: `cycling-ai index`**

```python
@click.group()
def index() -> None:
    """Manage RAG knowledge base."""
    pass

@index.command()
@click.option("--knowledge-dir", type=click.Path(exists=True), help="Knowledge directory (defaults to data/knowledge/domain/)")
def domain_knowledge(knowledge_dir: str | None) -> None:
    """Index cycling domain knowledge from markdown files into project vectorstore."""
    # Default to project's data/knowledge/domain/ directory
    if not knowledge_dir:
        project_root = Path(__file__).parent.parent.parent
        knowledge_dir = project_root / "data" / "knowledge" / "domain"

    # Project vectorstore path
    project_vectorstore_path = Path(__file__).parent.parent.parent / "data" / "vectorstore"

    rag_manager = RAGManager(
        project_vectorstore_path=project_vectorstore_path,
    )
    indexer = KnowledgeIndexer(rag_manager)

    count = indexer.index_domain_knowledge(Path(knowledge_dir))
    click.echo(f"Indexed {count} documents into domain_knowledge collection")
    click.echo(f"Location: {project_vectorstore_path}")

@index.command()
@click.option("--templates-file", type=click.Path(exists=True), help="Templates JSON file (defaults to data/knowledge/templates/training_plans.json)")
def training_templates(templates_file: str | None) -> None:
    """Index training plan templates from JSON into project vectorstore."""
    # Default to project's data/knowledge/templates/training_plans.json
    if not templates_file:
        project_root = Path(__file__).parent.parent.parent
        templates_file = project_root / "data" / "knowledge" / "templates" / "training_plans.json"

    # Project vectorstore path
    project_vectorstore_path = Path(__file__).parent.parent.parent / "data" / "vectorstore"

    rag_manager = RAGManager(
        project_vectorstore_path=project_vectorstore_path,
    )
    indexer = KnowledgeIndexer(rag_manager)

    count = indexer.index_training_templates(Path(templates_file))
    click.echo(f"Indexed {count} templates into training_templates collection")
    click.echo(f"Location: {project_vectorstore_path}")
```

---

## Impact Analysis

### Components Affected

| Component | Change Type | Impact Level | Description |
|-----------|-------------|--------------|-------------|
| **orchestration/multi_agent.py** | Modified | Medium | Add RAG prompt augmentation in `_execute_phase()` |
| **orchestration/prompts.py** | Modified | Low | Update prompt templates to accommodate retrieved context |
| **orchestration/session.py** | Modified (optional) | Low | Add retrieval metadata tracking |
| **providers/** | No change | None | Provider abstraction unaffected |
| **tools/** | No change | None | Tool system unaffected |
| **core/** | No change | None | Business logic unaffected |
| **cli/commands/generate.py** | Modified | Low | Add `--enable-rag` flag |
| **cli/commands/chat.py** | Modified | Medium | Add RAG query routing |
| **New: rag/** | New module | High | All RAG functionality isolated here |

### Backward Compatibility

**All changes are additive:**
- RAG is **opt-in** via `--enable-rag` flag
- Existing tests continue to pass (no RAG in tests by default)
- Session isolation preserved (RAG augments system prompts only)
- Provider interface unchanged (no breaking changes)

**Migration path:**
```bash
# Existing workflow (unchanged)
cycling-ai generate --profile profile.json --csv data.csv

# RAG-enhanced workflow (opt-in)
cycling-ai generate --profile profile.json --csv data.csv --enable-rag
```

### Type Safety

**All new code maintains mypy --strict compliance:**
- Type hints on all functions
- No `Any` types except where necessary (e.g., JSON data)
- Dataclasses for structured data (RetrievalResult, Document)
- Abstract base classes for providers (BaseEmbeddingProvider)

### Performance Impact

**Storage:**
- Vectorstore size: ~50-100 MB (domain knowledge + templates)
- Athlete history: ~1 MB per year per athlete
- Total: ~200 MB for typical usage

**Latency:**
- Local embedding: ~10-20ms per query
- Vectorstore search: ~50-100ms per retrieval (Chroma)
- Total overhead: ~100-200ms per phase (4 phases = ~0.5s)

**Token usage:**
- Retrieved context: ~500-1000 tokens per phase
- Total increase: ~2000-4000 tokens per workflow
- **Net effect:** 30-40% token reduction (better targeted context)

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2) - 2 weeks

**Goals:**
- Chroma vectorstore integration
- Local embedding provider (sentence-transformers)
- Basic RAG manager

**Deliverables:**
- `rag/vectorstore.py` - ChromaVectorStore class
- `rag/embeddings.py` - LocalEmbeddingProvider, OpenAIEmbeddingProvider
- `rag/manager.py` - RAGManager (retrieve, augment_prompt)
- Unit tests: 90%+ coverage
- Type checking: mypy --strict passes

**Acceptance Criteria:**
- [ ] Can create Chroma collection
- [ ] Can embed documents with sentence-transformers
- [ ] Can perform similarity search
- [ ] Can retrieve top-k documents with metadata filtering
- [ ] All tests pass

### Phase 2: Knowledge Base (Week 3) - 1 week

**Goals:**
- Create initial domain knowledge content
- Indexing infrastructure

**Deliverables:**
- `rag/indexing.py` - KnowledgeIndexer class
- `knowledge/domain/` - Markdown files with cycling science
  - Training methodologies (polarized, threshold, sweet spot)
  - FTP testing protocols
  - Power zone calculations
  - Recovery science
- `knowledge/templates/` - Training plan templates JSON
- CLI command: `cycling-ai index domain-knowledge`
- CLI command: `cycling-ai index training-templates`

**Acceptance Criteria:**
- [ ] 20+ domain knowledge documents indexed
- [ ] 10+ training plan templates indexed
- [ ] Chunking strategy preserves context
- [ ] Metadata filtering works correctly
- [ ] CLI commands execute successfully

### Phase 3: RAG Manager Integration (Week 4-5) - 2 weeks

**Goals:**
- Integrate RAG into Phase 2 (Performance Analysis)
- Prompt augmentation working end-to-end

**Deliverables:**
- Modified `orchestration/multi_agent.py` - RAG-aware phase execution
- Modified `orchestration/prompts.py` - RAG-compatible prompt templates
- `--enable-rag` flag in `cycling-ai generate`
- Integration tests with real LLM
- Performance benchmarks (token usage, latency)

**Acceptance Criteria:**
- [ ] Phase 2 agent receives domain knowledge context
- [ ] Retrieved context is relevant (manual validation)
- [ ] Token usage reduced vs. baseline
- [ ] Analysis quality improved (qualitative assessment)
- [ ] All existing tests still pass

### Phase 4: Athlete History Tracking (Week 6) - 1 week

**Goals:**
- Auto-index completed analyses
- Retrieve athlete history in Phase 2

**Deliverables:**
- Modified `orchestration/multi_agent.py` - Post-phase indexing hook
- `rag/indexing.py` - `index_athlete_history()` method
- Athlete ID hashing (privacy)
- Opt-out mechanism (`--disable-history-tracking`)

**Acceptance Criteria:**
- [ ] Completed analyses auto-indexed to athlete_history
- [ ] Athlete ID properly hashed
- [ ] History retrieved in subsequent analyses
- [ ] Continuity in recommendations ("Your FTP increased...")
- [ ] Privacy controls work (opt-out)

### Phase 5: Training Plan Enhancement (Week 7) - 1 week

**Goals:**
- Integrate RAG into Phase 3 (Training Planning)
- Template-based plan generation

**Deliverables:**
- Modified Phase 3 prompt augmentation
- Template retrieval based on athlete goals
- Plan quality evaluation

**Acceptance Criteria:**
- [ ] Training plans reference retrieved templates
- [ ] Plans show better structure/periodization
- [ ] Goal-specific templates correctly retrieved
- [ ] FTP range filtering works

### Phase 6: Chat Interface Enhancement (Week 8) - 1 week

**Goals:**
- RAG-enhanced chat
- Semantic query routing

**Deliverables:**
- Modified `cli/commands/chat.py`
- Query classification (training advice, performance question, etc.)
- Collection routing logic
- Chat-specific retrieval strategies

**Acceptance Criteria:**
- [ ] Chat queries retrieve relevant context
- [ ] Responses grounded in domain knowledge
- [ ] Query routing works correctly
- [ ] Reduced hallucination (subjective evaluation)

### Phase 7: Testing & Optimization (Week 9) - 1 week

**Goals:**
- Comprehensive testing
- Performance optimization
- Caching strategy

**Deliverables:**
- End-to-end integration tests (all 4 phases with RAG)
- Performance benchmarks (token usage, latency, cost)
- Cache optimization (duplicate query detection)
- Load testing (100 analyses)

**Acceptance Criteria:**
- [ ] 253 existing tests + 50 new RAG tests pass
- [ ] Token reduction: 30%+ vs. baseline
- [ ] Latency overhead: <500ms per workflow
- [ ] Type safety: mypy --strict passes
- [ ] No memory leaks

### Phase 8: Documentation & Release (Week 9.5) - 3 days

**Goals:**
- User documentation
- Migration guide
- Release preparation

**Deliverables:**
- Updated CLAUDE.md with RAG section
- User guide: "Getting Started with RAG"
- Knowledge base authoring guide
- Migration notes for existing users
- Release notes

**Acceptance Criteria:**
- [ ] Documentation complete
- [ ] Migration path tested
- [ ] Breaking changes documented (if any)
- [ ] Ready for merge to main

---

## Risk Mitigation

### Risk 1: Type Safety Violations

**Risk:** New RAG code doesn't pass mypy --strict

**Mitigation:**
- Run `mypy --strict` after each file created
- Use dataclasses for structured data (avoid dicts)
- Type all function signatures
- Use Protocol types for abstract interfaces

**Contingency:**
- Dedicated type-checking pass before each phase completion

### Risk 2: Provider Compatibility

**Risk:** RAG integration breaks one of the 4 LLM providers

**Mitigation:**
- RAG sits above providers (no provider interface changes)
- Test with all 4 providers (Anthropic, OpenAI, Gemini, Ollama)
- Provider adapter pattern isolates provider-specific logic

**Contingency:**
- If provider breaks, make RAG provider-specific (e.g., only for Anthropic)

### Risk 3: Session Isolation Violation

**Risk:** RAG contamina conversation history across phases

**Mitigation:**
- RAG augments **system prompts only** (not conversation messages)
- Each phase still gets fresh session
- Retrieved context not stored in session messages

**Validation:**
- Test that Phase N context doesn't leak to Phase N+1
- Verify session message counts unchanged

### Risk 4: Embedding Quality

**Risk:** Local embeddings (sentence-transformers) produce poor retrievals

**Mitigation:**
- Benchmark against OpenAI embeddings
- Evaluate retrieval quality with test queries
- Support multiple embedding providers (local, OpenAI)

**Contingency:**
- Default to OpenAI embeddings if local quality insufficient
- Provide `--rag-embedding openai` option

### Risk 5: Knowledge Base Quality

**Risk:** Domain knowledge content is inaccurate or outdated

**Mitigation:**
- Source content from reputable cycling science (Coggan, Seiler, etc.)
- Include references in metadata
- Versioning for knowledge base updates
- Community review process

**Contingency:**
- User-provided knowledge base override (`--knowledge-dir`)

### Risk 6: Privacy Concerns

**Risk:** Athlete data leaks via history tracking

**Mitigation:**
- Athlete ID: SHA256 hash (irreversible)
- Local-only storage (Chroma embedded)
- Opt-out mechanism (`--disable-history-tracking`)
- Auto-expiration: 24 months

**Validation:**
- Security audit of athlete ID hashing
- Verify no network calls to external services

### Risk 7: Performance Degradation

**Risk:** RAG adds too much latency

**Mitigation:**
- Benchmark retrieval latency (<100ms target)
- Cache frequent queries
- Async retrieval (if needed)
- Limit retrieved context (max 2000 tokens)

**Validation:**
- Performance tests: 100 workflows with RAG vs. without

### Risk 8: Test Coverage Regression

**Risk:** Existing tests fail after RAG integration

**Mitigation:**
- RAG is opt-in (default disabled in tests)
- Existing tests unchanged
- New tests for RAG-specific functionality
- Integration tests with RAG enabled

**Validation:**
- Full test suite runs before each phase completion
- 253 existing tests + 50 new RAG tests all pass

---

## Testing Strategy

### Unit Tests

**New test files:**
- `tests/rag/test_vectorstore.py` - ChromaVectorStore
- `tests/rag/test_embeddings.py` - Embedding providers
- `tests/rag/test_manager.py` - RAGManager
- `tests/rag/test_indexing.py` - KnowledgeIndexer

**Coverage target:** 90%+ for all RAG modules

**Example test:**
```python
def test_rag_manager_retrieve():
    """Test RAG manager retrieval with metadata filtering."""
    rag_manager = RAGManager(
        project_vectorstore_path=tmp_path / "project_vectorstore",
        user_vectorstore_path=tmp_path / "user_vectorstore",
        embedding_provider="local"
    )

    # Index test documents into project vectorstore
    indexer = KnowledgeIndexer(rag_manager)
    indexer.index_domain_knowledge(test_knowledge_dir)

    # Retrieve from domain_knowledge (project vectorstore)
    result = rag_manager.retrieve(
        query="polarized training model",
        collection="domain_knowledge",
        filter={"category": "training_methodology"},
        top_k=3
    )

    assert len(result.documents) == 3
    assert all("polarized" in doc.lower() for doc in result.documents)
    assert all(meta["category"] == "training_methodology" for meta in result.metadata)
```

### Integration Tests

**New test files:**
- `tests/integration/test_rag_multi_agent.py` - RAG with multi-agent orchestrator
- `tests/integration/test_rag_providers.py` - RAG with all 4 LLM providers
- `tests/integration/test_athlete_history.py` - History tracking workflow

**Example test:**
```python
@pytest.mark.integration
def test_rag_enhanced_workflow(real_csv, real_profile):
    """Test full workflow with RAG enabled."""
    config = WorkflowConfig(
        csv_file_path=real_csv,
        athlete_profile_path=real_profile,
    )

    # Create RAG manager with separate project and user vectorstores
    rag_manager = RAGManager(
        project_vectorstore_path=tmp_path / "project_vectorstore",
        user_vectorstore_path=tmp_path / "user_vectorstore",
        embedding_provider="local"
    )

    # Index knowledge base into project vectorstore
    indexer = KnowledgeIndexer(rag_manager)
    indexer.index_domain_knowledge(test_knowledge_dir)
    indexer.index_training_templates(test_templates_file)

    # Create orchestrator with RAG
    orchestrator = MultiAgentOrchestrator(
        provider=anthropic_provider,
        session_manager=session_manager,
        tool_registry=tool_registry,
        prompts_manager=prompts_manager,
        rag_manager=rag_manager,
    )

    # Execute workflow
    result = orchestrator.execute_workflow(config)

    assert result.success
    assert len(result.phase_results) == 4

    # Verify Phase 2 used retrieved context from project vectorstore
    phase_2_session = session_manager.load_session(result.phase_results[1].session_id)
    assert "RETRIEVED CONTEXT" in phase_2_session.system_prompt

    # Verify athlete history was indexed to user vectorstore
    history_result = rag_manager.retrieve(
        query="performance analysis",
        collection="athlete_history",
        top_k=1
    )
    assert len(history_result.documents) > 0
```

### Performance Tests

**Metrics to track:**
- Token usage (with vs. without RAG)
- Latency overhead (retrieval time)
- Memory usage (vectorstore size)
- Cache hit rate

**Benchmark suite:**
```python
def test_rag_token_reduction(benchmark_dataset):
    """Benchmark token usage with vs. without RAG."""

    # Run 10 workflows without RAG
    baseline_tokens = []
    for data in benchmark_dataset:
        result = run_workflow(data, enable_rag=False)
        baseline_tokens.append(result.total_tokens)

    # Run 10 workflows with RAG
    rag_tokens = []
    for data in benchmark_dataset:
        result = run_workflow(data, enable_rag=True)
        rag_tokens.append(result.total_tokens)

    # Verify reduction
    avg_baseline = sum(baseline_tokens) / len(baseline_tokens)
    avg_rag = sum(rag_tokens) / len(rag_tokens)

    reduction_pct = (avg_baseline - avg_rag) / avg_baseline * 100

    assert reduction_pct >= 30, f"Token reduction {reduction_pct:.1f}% below target (30%)"
```

### Quality Tests

**Retrieval quality:**
```python
def test_retrieval_relevance():
    """Test that retrieved documents are relevant to query."""

    test_cases = [
        {
            "query": "How to test FTP?",
            "collection": "domain_knowledge",
            "expected_keywords": ["FTP", "test", "20-minute", "ramp"],
        },
        {
            "query": "Training plan for century ride",
            "collection": "training_templates",
            "expected_keywords": ["endurance", "base", "long ride"],
        },
    ]

    for case in test_cases:
        result = rag_manager.retrieve(
            query=case["query"],
            collection=case["collection"],
            top_k=3
        )

        # Check relevance
        for doc in result.documents:
            assert any(kw.lower() in doc.lower() for kw in case["expected_keywords"])
```

---

## Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Token Reduction** | 30-40% | Compare token counts (with vs. without RAG) over 100 workflows |
| **Latency Overhead** | <500ms | Measure retrieval + augmentation time per workflow |
| **Test Coverage** | 85%+ | Pytest coverage report for `rag/` module |
| **Type Safety** | 100% | `mypy --strict` passes with zero errors |
| **Cache Hit Rate** | 40%+ | Track cache hits in RAG manager |
| **Retrieval Precision** | 80%+ | Manual evaluation of top-3 documents for test queries |

### Qualitative Metrics

| Metric | Evaluation Method |
|--------|-------------------|
| **Analysis Quality** | Compare Phase 2 outputs (with vs. without RAG) - Are insights more grounded in cycling science? |
| **Training Plan Quality** | Evaluate Phase 3 plans (with vs. without RAG) - Better structure, periodization, goal alignment? |
| **Chat Usefulness** | User testing - Are chat responses more helpful with RAG? |
| **Hallucination Reduction** | Manual review - Fewer factually incorrect statements? |

### Acceptance Criteria for Release

- [ ] All 253 existing tests pass
- [ ] 50+ new RAG tests pass (85%+ coverage)
- [ ] mypy --strict passes (zero errors)
- [ ] Token reduction: 30%+ (measured over 100 workflows)
- [ ] Latency overhead: <500ms (measured over 100 workflows)
- [ ] Works with all 4 providers (Anthropic, OpenAI, Gemini, Ollama)
- [ ] Session isolation preserved (verified via tests)
- [ ] Privacy controls work (athlete ID hashing, opt-out)
- [ ] Documentation complete (user guide, migration guide)
- [ ] Knowledge base seeded (20+ domain docs, 10+ templates)
- [ ] Backward compatible (existing workflows unchanged)

---

## Appendix A: Configuration Schema

### RAG Configuration

**Location:** `~/.cycling-ai/config.yaml`

```yaml
rag:
  enabled: true

  vectorstore:
    provider: "chroma"  # Future: "faiss", "pinecone"

    # Project vectorstore (version controlled, shared knowledge)
    project_directory: "data/vectorstore"  # Relative to project root

    # User vectorstore (athlete-specific history, not version controlled)
    user_directory: "~/.cycling-ai/athlete_history"

  embeddings:
    provider: "local"  # "local" or "openai"
    model: "all-MiniLM-L6-v2"  # For local provider
    # api_key: "sk-..."  # For OpenAI provider

  retrieval:
    top_k: 5
    min_score: 0.0
    max_context_tokens: 2000
    enable_caching: true

  collections:
    # Project collections (stored in project_directory)
    domain_knowledge:
      chunk_size: 512
      chunk_overlap: 50
      location: "project"

    training_templates:
      enabled: true
      location: "project"

    workout_library:
      enabled: true
      location: "project"

    # User collection (stored in user_directory)
    athlete_history:
      enabled: true
      opt_out: false  # Set to true to disable history tracking
      retention_months: 24
      location: "user"
```

---

## Appendix B: Knowledge Base Structure

### Directory Layout

#### Project Directory (Version Controlled)

```
cycling-ai-analysis/
├── data/                           # NEW: RAG data directory
│   ├── vectorstore/                # Chroma database (shared knowledge)
│   │   ├── chroma.sqlite3
│   │   └── collections/
│   │       ├── domain_knowledge/   # Cycling science
│   │       ├── training_templates/ # Plan templates
│   │       └── workout_library/    # Workout semantic search
│   │
│   └── knowledge/                  # Source content (markdown, JSON)
│       ├── domain/
│       │   ├── training_methodologies/
│       │   │   ├── polarized_training.md
│       │   │   ├── threshold_training.md
│       │   │   ├── sweet_spot_training.md
│       │   │   └── vo2max_intervals.md
│       │   ├── testing_protocols/
│       │   │   ├── ftp_testing.md
│       │   │   ├── vo2max_testing.md
│       │   │   └── lactate_threshold_testing.md
│       │   ├── physiology/
│       │   │   ├── power_zones.md
│       │   │   ├── heart_rate_zones.md
│       │   │   ├── recovery_science.md
│       │   │   └── overtraining.md
│       │   └── nutrition/
│       │       ├── endurance_fueling.md
│       │       └── recovery_nutrition.md
│       │
│       └── templates/
│           └── training_plans.json
│
├── src/cycling_ai/
│   └── rag/                        # RAG module
└── ...
```

#### User Directory (Not Version Controlled)

```
~/.cycling-ai/
├── athlete_history/                # User-specific athlete history vectorstore
│   ├── chroma.sqlite3
│   └── collections/
│       └── athlete_history/        # Past analyses, performance trends
│
├── sessions/                       # Existing: conversation sessions
├── logs/                          # Existing: application logs
└── config.yaml                    # Existing: user configuration
```

**Key Points:**
- **Project knowledge** (domain, templates, workouts) → Version controlled in `data/`
- **Athlete history** → User-specific in `~/.cycling-ai/athlete_history/`
- **Privacy:** Athlete history never leaves user's machine
- **Portability:** Project knowledge ships with the application
```

### Example Domain Knowledge Document

**File:** `knowledge/domain/training_methodologies/polarized_training.md`

```markdown
# Polarized Training Model

## Overview

Polarized training is an evidence-based training distribution characterized by approximately 80% of training time spent at low intensity (Zone 1-2) and 20% at high intensity (Zone 4-6), with minimal time spent in the moderate intensity range (Zone 3).

## Scientific Basis

Research by Stephen Seiler and colleagues has demonstrated that elite endurance athletes across multiple sports (cycling, running, cross-country skiing, rowing) naturally adopt a polarized intensity distribution. This pattern has been observed to optimize aerobic development while managing fatigue and recovery.

### Key Studies

- Seiler, S., & Kjerland, G. Ø. (2006). "Quantifying training intensity distribution in elite endurance athletes: is there evidence for an 'optimal' distribution?" *Scandinavian Journal of Medicine & Science in Sports*, 16(1), 49-56.

## Implementation Guidelines

### Low-Intensity Training (80%)
- **Zones:** Z1-Z2 (≤75% of FTP or ≤70% of max HR)
- **Purpose:** Aerobic base building, fat oxidation, recovery
- **Feel:** Conversational pace, can sustain for hours
- **Examples:** Easy endurance rides, recovery rides

### High-Intensity Training (20%)
- **Zones:** Z4-Z6 (≥90% of FTP or ≥85% of max HR)
- **Purpose:** VO2max development, lactate threshold improvement
- **Feel:** Hard to very hard, limited duration
- **Examples:** VO2max intervals (3-8 min), threshold intervals (8-20 min)

### Moderate-Intensity Training (Minimal)
- **Zone:** Z3 (76-89% of FTP)
- **Typical:** <5% of total training time
- **Rationale:** "No man's land" - too hard for aerobic adaptation, not hard enough for high-end development

## Weekly Structure Example

**Total Volume:** 10 hours/week

- **Monday:** Rest or 1hr Z1 recovery (10%)
- **Tuesday:** 2hr Z2 endurance (20%)
- **Wednesday:** 1.5hr including 4x8min Z4 intervals (15%)
- **Thursday:** 1.5hr Z2 endurance (15%)
- **Friday:** Rest or 1hr Z1 recovery (10%)
- **Saturday:** 3hr Z2 long ride (30%)
- **Sunday:** 1hr including 5x5min VO2max intervals (10%)

**Distribution:** ~65-70% Z1-Z2, ~5% Z3, ~25-30% Z4-Z6

## Periodization Considerations

- **Base Phase:** Increase to 85-90% low intensity, 10-15% high intensity
- **Build Phase:** Standard 80/20 distribution
- **Peak Phase:** May shift to 75/25 or 70/30 for event-specific preparation

## Common Mistakes

1. **Too much Z3 training** - "Junk miles" that accumulate fatigue without optimal adaptations
2. **Easy days too hard** - Recovery rides creep into Z3, prevent recovery
3. **Hard days not hard enough** - Z4 intervals drift down to Z3

## Monitoring Compliance

- Track weekly time in zones via power meter or HR monitor
- Review 4-week rolling average distribution
- Adjust if distribution deviates significantly from 80/20 target

---

**Category:** training_methodology
**Difficulty:** intermediate
**Source:** sports_science
**Last Updated:** 2024-10-01
```

---

## Appendix C: Example Retrieval Outputs

### Example 1: Phase 2 (Performance Analysis)

**Query:** "performance analysis power zones FTP VO2max interpretation"

**Retrieved Documents (top 3):**

```
[Source 1, Relevance: 0.87]
Title: "FTP Testing Protocols"
Content: "Functional Threshold Power (FTP) represents the highest power sustainable
for ~60 minutes. Common tests: 1) 20-min test (95% of avg power), 2) Ramp test
(75% of max 1-min power), 3) Kolie Moore 8-min x2 test (90% of avg). FTP is the
cornerstone of power-based training, defining zone boundaries..."

[Source 2, Relevance: 0.82]
Title: "Power Zone Calculations"
Content: "The Coggan 7-zone model divides power output into zones based on % of FTP:
Z1: Active Recovery (<55% FTP)
Z2: Endurance (56-75% FTP)
Z3: Tempo (76-90% FTP)
Z4: Lactate Threshold (91-105% FTP)
Z5: VO2max (106-120% FTP)
Z6: Anaerobic Capacity (121-150% FTP)
Z7: Neuromuscular Power (>150% FTP)..."

[Source 3, Relevance: 0.79]
Title: "Performance Analysis Best Practices"
Content: "When analyzing cycling performance data, focus on trends over time rather
than single ride metrics. Key indicators: 1) FTP progression (monthly tests),
2) Zone distribution (target 80% Z1-Z2 for base building), 3) Peak power outputs
(1s, 5s, 1min, 5min, 20min), 4) Chronic Training Load (CTL) ramp rate..."
```

**Augmented Prompt:**
```
You are a performance analysis specialist.

## RETRIEVED CONTEXT: DOMAIN_KNOWLEDGE

[Source 1, Relevance: 0.87]
Title: "FTP Testing Protocols"
Content: "Functional Threshold Power (FTP) represents the highest power sustainable
for ~60 minutes..."

[Source 2, Relevance: 0.82]
Title: "Power Zone Calculations"
Content: "The Coggan 7-zone model divides power output into zones based on % of FTP..."

[Source 3, Relevance: 0.79]
Title: "Performance Analysis Best Practices"
Content: "When analyzing cycling performance data, focus on trends over time..."

Use the retrieved context above to inform your analysis, but prioritize
the athlete's actual data. If retrieved context conflicts with data,
explain the discrepancy.

Your task: Analyze the athlete's performance over the specified period...
```

### Example 2: Phase 3 (Training Planning)

**Query:** "training plan improve FTP 265W 12 weeks"

**Retrieved Documents (top 2):**

```
[Source 1, Relevance: 0.91]
Title: "12-Week FTP Building Plan"
Metadata: {goal: "ftp_improvement", duration_weeks: 12, ftp_range: [250, 300]}
Content: "
Phase 1 (Weeks 1-4): Sweet Spot Foundation
- Volume: 8-10 hrs/week
- Key workouts: 2x20min sweet spot (88-93% FTP), 3x15min sweet spot
- Endurance: 3-4hr long rides at Z2

Phase 2 (Weeks 5-8): Threshold Development
- Volume: 9-11 hrs/week
- Key workouts: 2x20min threshold (95-105% FTP), 3x12min threshold
- Maintain Z2 endurance volume

Phase 3 (Weeks 9-11): VO2max Integration
- Volume: 8-10 hrs/week
- Key workouts: 5x5min VO2max (110-120% FTP), 2x15min threshold
- Reduce endurance volume

Phase 4 (Week 12): Recovery & Test
- Volume: 5-6 hrs/week
- Easy Z2 rides, FTP test on final weekend
"

[Source 2, Relevance: 0.85]
Title: "Sweet Spot Training Methodology"
Content: "Sweet spot training (88-93% of FTP) provides an optimal balance between
training stimulus and recovery cost. It sits just below threshold, allowing
longer interval durations while still driving physiological adaptations.
Research suggests sweet spot work can improve FTP by 5-10% over 8-12 weeks..."
```

---

## Appendix D: Dependencies

### New Python Packages

Add to `pyproject.toml`:

```toml
[tool.poetry.dependencies]
python = "^3.11"

# Existing dependencies
click = "^8.1.7"
pandas = "^2.1.3"
# ... existing packages ...

# New RAG dependencies
langchain = "^0.1.0"
langchain-community = "^0.0.10"
chromadb = "^0.4.22"
sentence-transformers = "^2.2.2"
torch = "^2.1.2"  # For sentence-transformers (CPU-only fine for embeddings)
```

### Version Constraints

- **chromadb:** ≥0.4.22 (supports embedded mode with persistence)
- **sentence-transformers:** ≥2.2.2 (stable, supports `all-MiniLM-L6-v2`)
- **langchain:** ≥0.1.0 (stable API, vectorstore abstractions)
- **torch:** ≥2.1.2 (for sentence-transformers, CPU-only fine)

### Optional Dependencies

For OpenAI embeddings:
```toml
openai = "^1.6.1"  # Already in dependencies
```

---

## Appendix E: Migration Guide

### For Existing Users

**No action required** - RAG is opt-in, all existing workflows continue to work.

**To enable RAG:**

1. **Install updated package:**
   ```bash
   pip install --upgrade cycling-ai
   ```

2. **Index knowledge base (one-time setup):**

   The knowledge base source files are now included in the project under `data/knowledge/`.
   Build the vectorstore by running:

   ```bash
   # Index domain knowledge from project's data/knowledge/domain/
   cycling-ai index domain-knowledge

   # Index training templates from project's data/knowledge/templates/
   cycling-ai index training-templates
   ```

   This creates the vectorstore at `data/vectorstore/` (version controlled).

3. **Use RAG in workflows:**
   ```bash
   # Generate reports with RAG
   cycling-ai generate --profile profile.json --csv data.csv --enable-rag

   # Chat with RAG
   cycling-ai chat --provider anthropic --enable-rag
   ```

**Note:** If pulling the repository, the vectorstore may already be built (check `data/vectorstore/`). If not, run the indexing commands above.

### For Developers

**Changes required:**

1. **Update imports:**
   ```python
   # New import for RAG
   from cycling_ai.rag import RAGManager, KnowledgeIndexer
   ```

2. **Initialize RAG manager:**
   ```python
   from pathlib import Path
   from cycling_ai.rag import RAGManager

   # Get project root (adjust based on your module location)
   project_root = Path(__file__).parent.parent.parent
   project_vectorstore = project_root / "data" / "vectorstore"
   user_vectorstore = Path.home() / ".cycling-ai" / "athlete_history"

   rag_manager = RAGManager(
       project_vectorstore_path=project_vectorstore,
       user_vectorstore_path=user_vectorstore,
       embedding_provider="local",
   )
   ```

3. **Pass to orchestrator:**
   ```python
   orchestrator = MultiAgentOrchestrator(
       provider=provider,
       session_manager=session_manager,
       tool_registry=tool_registry,
       prompts_manager=prompts_manager,
       rag_manager=rag_manager,  # NEW
   )
   ```

4. **Version Control Considerations:**

   Update `.gitignore` to handle the new data directory:

   ```gitignore
   # RAG Data Directory
   # INCLUDE source knowledge files (markdown, JSON)
   !data/knowledge/**/*.md
   !data/knowledge/**/*.json

   # DECIDE: Include or exclude the built vectorstore?
   # Option A: Include vectorstore (easier for users, larger repo)
   # data/vectorstore/

   # Option B: Exclude vectorstore (users build locally, smaller repo)
   data/vectorstore/

   # User-specific data (always excluded, lives in ~/.cycling-ai/)
   # No .gitignore needed - not in project directory
   ```

   **Recommendation:** Start with **Option B** (exclude vectorstore). Users run `cycling-ai index` commands after cloning. Add vectorstore to version control later if needed for easier deployment.

---

## Summary

This comprehensive plan provides a structured approach to integrating RAG into the Cycling AI Analysis system while maintaining:

✅ **Type safety** (mypy --strict compliance)
✅ **Provider agnosticism** (works with all 4 LLM providers)
✅ **Session isolation** (no contamination across phases)
✅ **Backward compatibility** (existing workflows unchanged)
✅ **Privacy** (local-first, athlete history opt-out)
✅ **Performance** (30-40% token reduction, <500ms latency overhead)

The 9.5-week implementation timeline is realistic and phased to allow for testing and iteration at each stage.

**Next Steps:**
1. Review and approve plan
2. Begin Phase 1: Foundation (Vectorstore + Embeddings)
3. Set up project tracking (GitHub issues for each phase)
