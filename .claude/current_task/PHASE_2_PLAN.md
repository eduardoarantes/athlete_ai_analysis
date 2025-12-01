# Phase 2 Implementation Plan: Knowledge Base Creation

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Planning Complete
**Branch:** `rag-vectorstore-improvement`
**Phase:** 2 of 8 (Knowledge Base Creation)
**Architect:** Task Implementation Preparation Agent

---

## Executive Summary

This plan details the implementation of **Phase 2: Knowledge Base Creation** for the RAG Integration project. Phase 1 (Foundation) is complete with 41/41 tests passing and 100% coverage on the RAG core modules (embeddings, vectorstore, manager).

**Phase 2 Goals:**
1. Create domain knowledge content (cycling science markdown files)
2. Create training plan templates (JSON)
3. Implement indexing infrastructure (`KnowledgeIndexer`)
4. Build CLI commands for indexing (`cycling-ai index`)
5. Populate project vectorstore with initial knowledge

**Key Deliverable:** A fully populated project vectorstore at `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore/` containing 20+ domain knowledge documents and 10+ training templates, ready for Phase 3 RAG-enhanced agent integration.

---

## Current State Analysis

### Phase 1 Status: COMPLETE ✅

**Implemented Components:**
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/embeddings.py` - EmbeddingFactory (local + OpenAI)
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/vectorstore.py` - ChromaVectorStore wrapper
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/manager.py` - RAGManager (two-vectorstore design)
- 41 unit tests with 100% coverage on RAG modules
- Full `mypy --strict` compliance

**Architecture Pattern:**
- **Two-vectorstore design:**
  - Project vectorstore: `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore/` (version controlled, shared knowledge)
  - User vectorstore: `~/.cycling-ai/athlete_history/` (athlete-specific, not version controlled)
- **Collection routing:** RAGManager automatically routes queries to appropriate vectorstore based on collection name
- **Embedding support:** Local (sentence-transformers) and OpenAI

**What Works:**
```python
# Initialize manager with two vectorstores
manager = RAGManager(
    project_vectorstore_path=Path("/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore"),
    user_vectorstore_path=Path("~/.cycling-ai/athlete_history"),
    embedding_provider="local"
)

# Add documents to project vectorstore
from langchain_core.documents import Document
docs = [Document(page_content="...", metadata={"category": "training"})]
manager.project_vectorstore.add_documents("domain_knowledge", docs)

# Retrieve from project vectorstore
result = manager.retrieve(
    query="polarized training",
    collection="domain_knowledge",
    top_k=5
)
```

### What's Missing (Phase 2 Scope)

1. **Knowledge content** - No markdown files in `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/`
2. **Training templates** - No JSON templates in `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/templates/`
3. **Indexing module** - `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py` doesn't exist
4. **CLI commands** - `cycling-ai index` doesn't exist
5. **Populated vectorstore** - `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore/` is empty

---

## Architecture Design

### Directory Structure (NEW)

```
/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/
├── data/                              # NEW: RAG data directory
│   ├── knowledge/                     # NEW: Source content (version controlled)
│   │   ├── domain/                    # Markdown files with cycling science
│   │   │   ├── training_methodologies/
│   │   │   │   ├── polarized_training.md
│   │   │   │   ├── threshold_training.md
│   │   │   │   ├── sweet_spot_training.md
│   │   │   │   ├── vo2max_intervals.md
│   │   │   │   └── endurance_training.md
│   │   │   ├── testing_protocols/
│   │   │   │   ├── ftp_testing.md
│   │   │   │   ├── vo2max_testing.md
│   │   │   │   ├── lactate_threshold_testing.md
│   │   │   │   └── ramp_test.md
│   │   │   ├── physiology/
│   │   │   │   ├── power_zones.md
│   │   │   │   ├── heart_rate_zones.md
│   │   │   │   ├── recovery_science.md
│   │   │   │   ├── overtraining.md
│   │   │   │   └── adaptation_principles.md
│   │   │   ├── nutrition/
│   │   │   │   ├── endurance_fueling.md
│   │   │   │   ├── recovery_nutrition.md
│   │   │   │   └── hydration.md
│   │   │   └── periodization/
│   │   │       ├── base_phase.md
│   │   │       ├── build_phase.md
│   │   │       ├── peak_phase.md
│   │   │       ├── taper_phase.md
│   │   │       └── recovery_weeks.md
│   │   │
│   │   └── templates/                 # JSON training plan templates
│   │       └── training_plans.json    # 10+ structured templates
│   │
│   └── vectorstore/                   # NEW: Chroma database (initially empty, populated via CLI)
│       └── .gitignore                 # Exclude Chroma files (users build locally)
│
├── src/cycling_ai/
│   ├── rag/
│   │   ├── indexing.py                # NEW: KnowledgeIndexer
│   │   └── ...                        # Existing: embeddings, vectorstore, manager
│   │
│   └── cli/commands/
│       └── index.py                   # NEW: CLI commands
│
└── tests/
    └── rag/
        └── test_indexing.py           # NEW: Unit tests for indexing
```

### Content Format Standards

#### Domain Knowledge (Markdown)

**Template Structure:**
```markdown
# [Title]

## Overview
[1-2 paragraph introduction]

## Scientific Basis
[Evidence-based explanation with citations]

### Key Studies
- Author, Year. "Title". Journal.

## Implementation Guidelines
[Practical application]

### [Subsection 1]
- **Key Point:** Description
- **Example:** Concrete example

## Common Mistakes
1. Mistake description
2. Why it matters
3. How to avoid

## Monitoring and Progression
[How to track and progress]

---

**Metadata (YAML frontmatter):**
category: [training_methodology|testing|physiology|nutrition|periodization]
difficulty: [beginner|intermediate|advanced]
source: [sports_science|coaching|research]
last_updated: YYYY-MM-DD
```

**Chunking Strategy:**
- Chunk size: 512 tokens (~2000 characters)
- Overlap: 50 tokens (~200 characters)
- Split on section boundaries when possible
- Preserve context (include section headers in chunks)

#### Training Templates (JSON)

**Schema:**
```json
{
  "templates": [
    {
      "id": "12_week_base_building",
      "name": "12-Week Base Building Plan",
      "description": "Aerobic foundation plan for 200-300W FTP athletes",
      "goal": "base_building",
      "duration_weeks": 12,
      "ftp_range": [200, 300],
      "weekly_hours_range": [6, 10],
      "experience_level": "intermediate",
      "structure": {
        "phase_1": {
          "weeks": [1, 2, 3, 4],
          "focus": "Aerobic Foundation",
          "volume_hours": [6, 7, 8, 6],
          "intensity_distribution": {"z1_z2": 85, "z3": 10, "z4_plus": 5},
          "key_workouts": ["3hr endurance", "tempo intervals"]
        },
        "phase_2": {
          "weeks": [5, 6, 7, 8],
          "focus": "Strength Endurance",
          "volume_hours": [8, 9, 10, 7],
          "intensity_distribution": {"z1_z2": 75, "z3": 15, "z4_plus": 10},
          "key_workouts": ["2x20 sweet spot", "3x15 sweet spot"]
        },
        "phase_3": {
          "weeks": [9, 10, 11, 12],
          "focus": "Power Development",
          "volume_hours": [8, 9, 8, 5],
          "intensity_distribution": {"z1_z2": 70, "z3": 15, "z4_plus": 15},
          "key_workouts": ["VO2max intervals", "threshold work"]
        }
      },
      "notes": "Suitable for time-crunched athletes building winter base"
    }
  ]
}
```

---

## Implementation Cards

I'll create detailed implementation cards in separate files for the executor agent to follow step-by-step. These will be created in `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/` directory.

---

## Testing Strategy

### Unit Tests (20+ tests)

**Module:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/test_indexing.py`

**Test Categories:**
1. **ChunkConfig** - Default values, custom config
2. **KnowledgeIndexer Init** - Initialization with default/custom config
3. **Frontmatter Parsing** - With/without metadata, malformed YAML
4. **Chunking Logic** - Small docs, large docs, overlap verification
5. **Domain Knowledge Indexing** - Single file, multiple categories, error cases
6. **Training Template Indexing** - Valid JSON, invalid JSON, empty templates
7. **Integration** - End-to-end index + retrieve

**Coverage Goal:** 90%+ on `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py`

---

## Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Domain knowledge files | 20+ | Count markdown files in data/knowledge/domain/ |
| Training templates | 10+ | Count templates in JSON |
| Indexed documents | 60+ | Document count in domain_knowledge collection |
| Indexed templates | 10+ | Document count in training_templates collection |
| Test coverage | 90%+ | pytest --cov on indexing module |
| Type safety | 100% | mypy --strict passes |

### Acceptance Criteria for Phase 2 Completion

- [ ] 20+ domain knowledge markdown files created
- [ ] 10+ training template JSON entries created
- [ ] KnowledgeIndexer module implemented and tested
- [ ] CLI commands (`cycling-ai index`) implemented
- [ ] 60+ documents indexed into domain_knowledge collection
- [ ] 10+ templates indexed into training_templates collection
- [ ] 20+ unit tests pass (90%+ coverage)
- [ ] mypy --strict passes
- [ ] Manual retrieval tests show relevant results
- [ ] Documentation updated (README, CLAUDE.md)

---

## Implementation Timeline

### Day-by-Day Breakdown

**Day 1: Directory Structure + Initial Content (5 files)**
- Create data/knowledge/ directory structure
- Write 5 initial markdown files (polarized_training, threshold_training, ftp_testing, power_zones, base_phase)
- 6-8 hours

**Day 2: Complete Domain Knowledge (15 more files)**
- Write remaining 15 markdown files across 5 categories
- 8-10 hours (30-40 min per file)

**Day 3: Training Templates**
- Create training_plans.json with 10+ templates
- Research training plan structures
- 4-6 hours

**Day 4: KnowledgeIndexer Module**
- Implement src/cycling_ai/rag/indexing.py
- Chunking logic, frontmatter parsing
- 6-8 hours

**Day 5: CLI Commands + Tests**
- Implement src/cycling_ai/cli/commands/index.py
- Write tests/rag/test_indexing.py (20+ tests)
- 6-8 hours

**Day 6: Populate Vectorstore + Validation**
- Run CLI commands to index knowledge
- Validate retrieval quality
- Fix any issues discovered
- 4-6 hours

**Day 7: Documentation + Cleanup**
- Update CLAUDE.md, README
- Create KNOWLEDGE_AUTHORING_GUIDE.md
- Final testing, mypy check
- 4-6 hours

**Total:** 7 days (~40-50 hours)

---

## Next Steps for Executor Agent

The executor agent should now proceed with creating detailed implementation cards in:
`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_*.md`

Each card will contain:
- Specific files to create/modify (with absolute paths)
- Code snippets and examples
- Acceptance criteria
- Testing requirements

Cards to create:
1. CARD_1_DIRECTORY_AND_INITIAL_CONTENT.md
2. CARD_2_COMPLETE_DOMAIN_KNOWLEDGE.md
3. CARD_3_TRAINING_TEMPLATES.md
4. CARD_4_KNOWLEDGE_INDEXER.md
5. CARD_5_CLI_COMMANDS.md
6. CARD_6_UNIT_TESTS.md
7. CARD_7_POPULATE_AND_VALIDATE.md

---

## Summary

Phase 2 transforms the RAG foundation (Phase 1) into a functional knowledge base by:
1. Creating high-quality domain knowledge content (20+ markdown files)
2. Creating structured training templates (10+ JSON entries)
3. Building indexing infrastructure (KnowledgeIndexer)
4. Providing CLI tools for knowledge management
5. Populating the project vectorstore with searchable knowledge

This enables Phase 3 to enhance agent prompts with relevant cycling science and training templates, improving analysis quality and reducing token usage.

**Key Achievement:** A production-ready knowledge base that can be queried semantically, providing targeted context for LLM agents without overwhelming their context windows.
