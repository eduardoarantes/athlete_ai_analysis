# Card 4: Implement KnowledgeIndexer Module

**Status:** Pending
**Estimated Time:** 6-8 hours
**Dependencies:** Card 1, Card 2, Card 3

---

## Goal

Create `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py` with `KnowledgeIndexer` class for indexing markdown and JSON content into Chroma vectorstore.

---

## File to Create

`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py`

---

## Implementation Specifications

### Imports

```python
"""
Knowledge indexing module for RAG.

Provides KnowledgeIndexer class for indexing domain knowledge (markdown)
and training templates (JSON) into Chroma vectorstore.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import re
import json
from langchain_core.documents import Document

from .manager import RAGManager
```

### ChunkConfig Dataclass

```python
@dataclass
class ChunkConfig:
    """Configuration for text chunking."""
    chunk_size: int = 512  # tokens
    chunk_overlap: int = 50  # tokens
    separator: str = "\n\n"  # Split on paragraphs
```

### KnowledgeIndexer Class

```python
class KnowledgeIndexer:
    """
    Indexes knowledge content into vectorstore.

    Supports:
    - Domain knowledge (markdown files)
    - Training templates (JSON)
    """

    def __init__(
        self,
        rag_manager: RAGManager,
        chunk_config: ChunkConfig | None = None,
    ) -> None:
        """Initialize indexer."""
        self.rag_manager = rag_manager
        self.chunk_config = chunk_config or ChunkConfig()

    def index_domain_knowledge(
        self,
        knowledge_dir: Path,
    ) -> dict[str, int]:
        """
        Index markdown files into domain_knowledge collection.

        Args:
            knowledge_dir: Path to data/knowledge/domain/

        Returns:
            {category: document_count} dictionary
        """
        pass  # TODO: Implement

    def index_training_templates(
        self,
        templates_file: Path,
    ) -> int:
        """
        Index JSON templates into training_templates collection.

        Args:
            templates_file: Path to training_plans.json

        Returns:
            Number of templates indexed
        """
        pass  # TODO: Implement

    def _chunk_markdown(
        self,
        content: str,
        metadata: dict[str, Any],
    ) -> list[Document]:
        """
        Chunk markdown content with overlap.

        Strategy:
        - Split on double newlines (paragraphs)
        - Combine paragraphs until chunk_size reached
        - Add overlap from previous chunk
        - Preserve section headers in chunks

        Returns:
            List of LangChain Documents with chunked content
        """
        pass  # TODO: Implement

    def _parse_frontmatter(
        self,
        content: str,
    ) -> tuple[dict[str, Any], str]:
        """
        Parse YAML frontmatter from markdown.

        Returns:
            (metadata_dict, content_without_frontmatter)
        """
        pass  # TODO: Implement

    def _estimate_tokens(self, text: str) -> int:
        """
        Estimate token count (rough approximation).

        Uses: 1 token ≈ 4 characters rule of thumb
        """
        return len(text) // 4
```

---

## Key Implementation Details

### 1. index_domain_knowledge()

**Algorithm:**
1. Walk `knowledge_dir` recursively with `rglob("*.md")`
2. For each markdown file:
   - Read content
   - Parse YAML frontmatter → metadata dict
   - Determine category from parent directory name
   - Chunk content (512 tokens, 50 overlap)
   - Create LangChain Documents
3. Add all documents to `domain_knowledge` collection in project vectorstore
4. Return `{category: count}` stats

**Example:**
```python
stats: dict[str, int] = {}
documents: list[Document] = []

for md_file in knowledge_dir.rglob("*.md"):
    category = md_file.parent.name
    
    with open(md_file) as f:
        content = f.read()
    
    # Parse frontmatter
    metadata, body = self._parse_frontmatter(content)
    metadata["category"] = category
    metadata["source_file"] = md_file.name
    
    # Chunk
    chunks = self._chunk_markdown(body, metadata)
    documents.extend(chunks)
    
    stats[category] = stats.get(category, 0) + len(chunks)

# Add to vectorstore
self.rag_manager.project_vectorstore.add_documents(
    collection_name="domain_knowledge",
    documents=documents
)

return stats
```

### 2. _parse_frontmatter()

**Algorithm:**
1. Check if content starts with `---`
2. Find closing `---`
3. Extract YAML between markers
4. Parse YAML to dict
5. Return (metadata, remaining_content)

**Example:**
```python
frontmatter_pattern = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
match = frontmatter_pattern.match(content)

if match:
    yaml_str = match.group(1)
    metadata = yaml.safe_load(yaml_str)
    body = content[match.end():]
    return metadata, body
else:
    return {}, content
```

### 3. _chunk_markdown()

**Algorithm:**
1. Split content on double newlines (paragraphs)
2. Combine paragraphs until ~512 tokens reached
3. Add 50-token overlap from previous chunk
4. Create Document for each chunk with metadata

**Pseudocode:**
```python
paragraphs = content.split(self.chunk_config.separator)
chunks: list[Document] = []
current_chunk = []
previous_chunk_end = ""

for para in paragraphs:
    current_chunk.append(para)
    chunk_text = self.chunk_config.separator.join(current_chunk)
    
    if self._estimate_tokens(chunk_text) >= self.chunk_config.chunk_size:
        # Save chunk
        full_chunk = previous_chunk_end + chunk_text
        chunks.append(Document(
            page_content=full_chunk,
            metadata={**metadata, "chunk_index": len(chunks)}
        ))
        
        # Prepare overlap for next chunk
        words = chunk_text.split()
        overlap_words = words[-(self.chunk_config.chunk_overlap):]
        previous_chunk_end = " ".join(overlap_words) + " "
        
        # Reset
        current_chunk = []

# Handle remaining content
if current_chunk:
    # ... similar logic

return chunks
```

---

## Type Safety

All methods must have full type hints:
- Return types specified
- Parameter types specified
- Use `dict[str, Any]` for JSON-like data
- Use `list[Document]` for LangChain documents

---

## Acceptance Criteria

- [ ] KnowledgeIndexer class implemented
- [ ] All methods have type hints
- [ ] index_domain_knowledge() walks directories recursively
- [ ] _parse_frontmatter() handles with/without frontmatter
- [ ] _chunk_markdown() creates chunks with overlap
- [ ] Chunks preserve section headers where possible
- [ ] Metadata correctly extracted and attached
- [ ] mypy --strict passes on module
- [ ] Docstrings complete

---

## Testing

Create `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/test_indexing.py` with these test cases (see CARD_6 for details):

- Test ChunkConfig default values
- Test KnowledgeIndexer initialization
- Test _parse_frontmatter with/without metadata
- Test _chunk_markdown with small/large documents
- Test index_domain_knowledge with real markdown files
- Test index_training_templates with real JSON

---

## Validation

```bash
# Type check
mypy /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py --strict

# Run tests
pytest /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/test_indexing.py -v
```

---

## Next Card

Once complete, proceed to **CARD_5_CLI_COMMANDS.md** to create CLI interface for indexing.
