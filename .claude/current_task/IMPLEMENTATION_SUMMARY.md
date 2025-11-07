# Phase 2 Implementation Summary

**Created:** 2025-11-07
**Status:** Ready for Execution
**Architect:** Task Implementation Preparation Agent

---

## Overview

This implementation plan prepares Phase 2 (Knowledge Base Creation) of the RAG Integration project. Phase 1 (Foundation) is complete with 41/41 tests passing and 100% coverage.

---

## Documents Created

1. **PHASE_2_PLAN.md** - Master implementation plan
   - Executive summary
   - Architecture design
   - Content format standards
   - Testing strategy
   - Success metrics
   - Timeline (7 days, 40-50 hours)

2. **PLAN/CARD_1_DIRECTORY_AND_INITIAL_CONTENT.md** - First implementation card
   - Directory structure creation
   - 5 initial markdown files (polarized_training, threshold_training, ftp_testing, power_zones, base_phase)
   - Content requirements and templates
   - 6-8 hours estimated

3. **PLAN/CARD_4_KNOWLEDGE_INDEXER.md** - Core indexing module
   - KnowledgeIndexer class implementation
   - Chunking logic (512 tokens, 50 overlap)
   - Frontmatter parsing
   - Domain knowledge and template indexing
   - 6-8 hours estimated

---

## Key Architecture Decisions

### Two-Vectorstore Design (from Phase 1)

**Project Vectorstore:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore/`
- Collections: domain_knowledge, training_templates, workout_library
- Version controlled (source files), users build locally
- Shared knowledge across all users

**User Vectorstore:** `~/.cycling-ai/athlete_history/`
- Collections: athlete_history
- User-specific, not version controlled
- Privacy-focused (never leaves user's machine)

### Content Organization

**Domain Knowledge:** 20+ markdown files in 5 categories
- training_methodologies/ (5 files)
- testing_protocols/ (4 files)
- physiology/ (5 files)
- nutrition/ (3 files)
- periodization/ (5 files)

**Training Templates:** 10+ JSON templates
- Various goals (base_building, race_prep, etc.)
- FTP ranges (150W - 400W)
- Duration ranges (6-16 weeks)

### Indexing Strategy

**Chunking:**
- Chunk size: 512 tokens (~2000 chars)
- Overlap: 50 tokens (~200 chars)
- Split on paragraph boundaries (\n\n)
- Preserve section headers in chunks

**Metadata:**
- Category (from directory structure)
- Source file name
- Chunk index
- YAML frontmatter (difficulty, source, last_updated)

---

## Implementation Order

### Phase Sequence

1. **Card 1** - Directory structure + 5 initial markdown files (Day 1)
2. **Card 2** - Complete 15 more markdown files (Day 2)
3. **Card 3** - Create 10+ training templates JSON (Day 3)
4. **Card 4** - Implement KnowledgeIndexer module (Day 4)
5. **Card 5** - Implement CLI commands (Day 5)
6. **Card 6** - Write 20+ unit tests (Day 5-6)
7. **Card 7** - Populate vectorstore and validate (Day 6-7)

### After Each Card

```bash
# Run tests
pytest /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/ -v

# Type check
mypy /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag --strict

# Commit progress
git add .
git commit -m "Phase 2: Complete [CARD_X_NAME]"
```

---

## Critical Files with Absolute Paths

### Files to Create

**Knowledge Content:**
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/training_methodologies/*.md` (5 files)
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/testing_protocols/*.md` (4 files)
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/physiology/*.md` (5 files)
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/nutrition/*.md` (3 files)
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/periodization/*.md` (5 files)
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/templates/training_plans.json`

**Code:**
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py`
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/cli/commands/index.py`

**Tests:**
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/test_indexing.py`

**Vectorstore:**
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore/` (populated via CLI)

---

## Success Criteria

### Quantitative

- [ ] 20+ domain knowledge markdown files created
- [ ] 10+ training template JSON entries created
- [ ] KnowledgeIndexer module implemented (type-safe)
- [ ] CLI commands implemented (`cycling-ai index domain-knowledge`, `cycling-ai index training-templates`)
- [ ] 60+ documents indexed into domain_knowledge collection
- [ ] 10+ templates indexed into training_templates collection
- [ ] 20+ unit tests pass (90%+ coverage on indexing.py)
- [ ] mypy --strict passes (zero errors)

### Qualitative

- [ ] Content is accurate, well-researched, cited
- [ ] Retrieval tests return relevant results (score > 0.7)
- [ ] Chunking preserves context
- [ ] CLI commands are user-friendly
- [ ] Documentation updated

---

## Testing Commands

```bash
# Run all RAG tests
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement
pytest tests/rag/ -v

# Check coverage
pytest tests/rag/ --cov=src/cycling_ai/rag --cov-report=html

# Type check
mypy src/cycling_ai/rag --strict

# Test CLI commands
cycling-ai index domain-knowledge
cycling-ai index training-templates

# Validate retrieval
python << 'PYEOF'
from pathlib import Path
from cycling_ai.rag.manager import RAGManager

project_root = Path("/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement")
manager = RAGManager(
    project_vectorstore_path=project_root / "data" / "vectorstore",
    embedding_provider="local"
)

# Test domain knowledge retrieval
result = manager.retrieve(
    query="polarized training 80/20 distribution",
    collection="domain_knowledge",
    top_k=3
)
print(f"Domain knowledge: {len(result.documents)} documents")
for i, (doc, score) in enumerate(zip(result.documents, result.scores), 1):
    print(f"{i}. Score: {score:.3f}, Preview: {doc[:100]}...")

# Test training templates retrieval
result = manager.retrieve(
    query="12 week base building plan 250W FTP",
    collection="training_templates",
    top_k=3
)
print(f"\nTraining templates: {len(result.documents)} documents")
for i, (doc, score) in enumerate(zip(result.documents, result.scores), 1):
    print(f"{i}. Score: {score:.3f}, Preview: {doc[:100]}...")
PYEOF
```

---

## Risk Mitigation

### Risk 1: Content Quality
**Mitigation:** Research thoroughly, cite sources, peer review
**Contingency:** Content can be updated iteratively

### Risk 2: Chunking Breaks Context
**Mitigation:** Split on paragraphs, use overlap, test thoroughly
**Validation:** Manual review + retrieval tests

### Risk 3: Embedding Quality (Local)
**Mitigation:** Use proven model (all-MiniLM-L6-v2), support OpenAI fallback
**Validation:** Compare retrieval quality with test queries

---

## Next Steps After Phase 2

Once Phase 2 complete (vectorstore populated with knowledge), proceed to:

**Phase 3: RAG Manager Integration**
- Modify `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/multi_agent.py`
- Add RAG prompt augmentation in Phase 2 (Performance Analysis Agent)
- Add `--enable-rag` flag to `cycling-ai generate`
- Validate token reduction and analysis quality improvement

---

## Contact Information

**Current Working Directory:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement`

**Branch:** `rag-vectorstore-improvement`

**Git Status:** Clean (Phase 1 complete)

---

## Ready for Execution

This plan is complete and ready for the task implementation execution agent to begin work on Card 1.

All absolute paths are specified, architecture is clear, and success criteria are defined.
