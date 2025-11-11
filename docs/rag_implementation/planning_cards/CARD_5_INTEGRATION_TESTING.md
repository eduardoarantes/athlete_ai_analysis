# CARD 5: Integration Testing & Validation

**Status:** Pending
**Estimated Time:** 1.5 hours
**Dependencies:** Cards 1-4 (All modules complete)

---

## Objective

Perform comprehensive integration testing to verify the complete RAG system works end-to-end.

**Focus Areas:**
- Cross-module integration
- Performance validation
- Type safety verification
- Documentation completeness

---

## Integration Test Suite

### File: `tests/rag/test_integration.py`

```python
"""
Integration tests for complete RAG system.

Tests cover:
- End-to-end retrieval workflows
- Two-vectorstore interaction
- Cross-collection queries
- Performance characteristics
- Real-world usage patterns
"""

from __future__ import annotations

from pathlib import Path

import pytest
from langchain_core.documents import Document

from cycling_ai.rag import RAGManager, RetrievalResult


class TestEndToEndRetrieval:
    """Test complete retrieval workflows."""

    def test_complete_workflow_local_embeddings(self, tmp_path: Path) -> None:
        """Test complete workflow with local embeddings."""
        # Initialize manager
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        # Populate project vectorstore with domain knowledge
        domain_docs = [
            Document(
                page_content="Polarized training is characterized by 80% low-intensity "
                             "and 20% high-intensity work. Research by Seiler shows this "
                             "distribution optimizes aerobic development.",
                metadata={"category": "training_methodology", "source": "seiler_2006"}
            ),
            Document(
                page_content="FTP (Functional Threshold Power) is the highest power "
                             "sustainable for approximately 60 minutes. Common tests: "
                             "20-min (95% of avg), ramp test (75% of max 1-min).",
                metadata={"category": "testing", "source": "coggan_2003"}
            ),
            Document(
                page_content="Sweet spot training (88-93% FTP) provides optimal balance "
                             "between training stimulus and recovery cost.",
                metadata={"category": "training_methodology", "source": "friel_2009"}
            ),
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", domain_docs)

        # Populate user vectorstore with athlete history
        history_docs = [
            Document(
                page_content="Analysis Q3 2024: FTP increased from 250W to 265W (+6%). "
                             "Zone 2 time increased 15% following polarized approach.",
                metadata={"athlete_id": "test_athlete", "period": "Q3_2024"}
            ),
            Document(
                page_content="Analysis Q2 2024: FTP 250W. Recommendation: Add VO2max "
                             "intervals to complement base work.",
                metadata={"athlete_id": "test_athlete", "period": "Q2_2024"}
            ),
        ]
        manager.user_vectorstore.add_documents("athlete_history", history_docs)

        # Test retrieval from project vectorstore
        result_project = manager.retrieve(
            query="What is polarized training and how does it work?",
            collection="domain_knowledge",
            top_k=2,
            filter_metadata={"category": "training_methodology"}
        )

        assert len(result_project.documents) == 2
        assert any("polarized" in doc.lower() for doc in result_project.documents)
        assert result_project.collection == "domain_knowledge"

        # Test retrieval from user vectorstore
        result_user = manager.retrieve(
            query="How has my FTP changed recently?",
            collection="athlete_history",
            top_k=2
        )

        assert len(result_user.documents) == 2
        assert any("FTP" in doc for doc in result_user.documents)
        assert result_user.collection == "athlete_history"

    def test_multiple_collections_same_manager(self, tmp_path: Path) -> None:
        """Test managing multiple collections with same manager."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add to domain_knowledge
        domain_docs = [Document(page_content="Domain knowledge content")]
        manager.project_vectorstore.add_documents("domain_knowledge", domain_docs)

        # Add to training_templates
        template_docs = [Document(page_content="Training template content")]
        manager.project_vectorstore.add_documents("training_templates", template_docs)

        # Add to workout_library
        workout_docs = [Document(page_content="Workout library content")]
        manager.project_vectorstore.add_documents("workout_library", workout_docs)

        # Retrieve from each collection
        result1 = manager.retrieve("domain", "domain_knowledge", top_k=1)
        result2 = manager.retrieve("template", "training_templates", top_k=1)
        result3 = manager.retrieve("workout", "workout_library", top_k=1)

        assert len(result1.documents) == 1
        assert len(result2.documents) == 1
        assert len(result3.documents) == 1

    def test_persistence_across_sessions(self, tmp_path: Path) -> None:
        """Test that data persists across manager instances."""
        persist_dir = tmp_path / "persistent_vectorstore"

        # Session 1: Add documents
        manager1 = RAGManager(
            project_vectorstore_path=persist_dir,
            embedding_provider="local",
        )
        docs = [
            Document(
                page_content="Persistent document content.",
                metadata={"session": 1}
            )
        ]
        manager1.project_vectorstore.add_documents("domain_knowledge", docs)

        # Session 2: Retrieve documents (new manager instance)
        manager2 = RAGManager(
            project_vectorstore_path=persist_dir,
            embedding_provider="local",
        )
        result = manager2.retrieve(
            query="persistent",
            collection="domain_knowledge",
            top_k=1
        )

        assert len(result.documents) == 1
        assert "persistent" in result.documents[0].lower()


class TestRetrievalQuality:
    """Test retrieval quality and relevance."""

    def test_semantic_similarity_ranking(self, tmp_path: Path) -> None:
        """Test that results are ranked by semantic similarity."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add documents with varying relevance
        docs = [
            Document(
                page_content="Polarized training: 80% easy, 20% hard.",
                metadata={"relevance": "high"}
            ),
            Document(
                page_content="Training zones are based on physiological thresholds.",
                metadata={"relevance": "medium"}
            ),
            Document(
                page_content="Nutrition strategies for endurance athletes.",
                metadata={"relevance": "low"}
            ),
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Query specifically about polarized training
        result = manager.retrieve(
            query="explain polarized training methodology",
            collection="domain_knowledge",
            top_k=3
        )

        # First result should be most relevant
        assert "polarized" in result.documents[0].lower()
        # Scores should be descending
        assert result.scores[0] >= result.scores[1] >= result.scores[2]

    def test_metadata_filtering_accuracy(self, tmp_path: Path) -> None:
        """Test metadata filtering returns only matching documents."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add documents with different categories
        docs = [
            Document(
                page_content="Training methodology A",
                metadata={"category": "training", "difficulty": "beginner"}
            ),
            Document(
                page_content="Training methodology B",
                metadata={"category": "training", "difficulty": "advanced"}
            ),
            Document(
                page_content="Testing protocol A",
                metadata={"category": "testing", "difficulty": "beginner"}
            ),
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Filter by category and difficulty
        result = manager.retrieve(
            query="training",
            collection="domain_knowledge",
            top_k=5,
            filter_metadata={"category": "training", "difficulty": "beginner"}
        )

        # Should only return training + beginner
        assert len(result.documents) == 1
        assert all(
            meta["category"] == "training" and meta["difficulty"] == "beginner"
            for meta in result.metadata
        )

    def test_score_threshold_filtering(self, tmp_path: Path) -> None:
        """Test that min_score filters low-relevance results."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add documents
        docs = [
            Document(page_content="Cycling performance analysis and training."),
            Document(page_content="Swimming technique for triathletes."),
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Query with high min_score
        result = manager.retrieve(
            query="cycling performance",
            collection="domain_knowledge",
            top_k=2,
            min_score=0.6  # Require strong similarity
        )

        # All returned documents should meet threshold
        assert all(score >= 0.6 for score in result.scores)
        # Should primarily return cycling-related content
        assert any("cycling" in doc.lower() for doc in result.documents)


class TestPerformance:
    """Test performance characteristics."""

    def test_retrieval_latency_acceptable(self, tmp_path: Path) -> None:
        """Test that retrieval completes in reasonable time."""
        import time

        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add 100 documents
        docs = [
            Document(
                page_content=f"Document {i} with various cycling training content "
                             f"including intervals, endurance, and recovery methods.",
                metadata={"index": i}
            )
            for i in range(100)
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Time retrieval
        start = time.time()
        result = manager.retrieve(
            query="cycling training methods",
            collection="domain_knowledge",
            top_k=10
        )
        elapsed = time.time() - start

        assert len(result.documents) == 10
        # Should complete in < 1 second (generous threshold)
        assert elapsed < 1.0

    def test_batch_retrieval_efficiency(self, tmp_path: Path) -> None:
        """Test multiple retrievals are efficient."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add documents
        docs = [
            Document(page_content=f"Training topic {i % 10}")
            for i in range(50)
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Perform multiple retrievals
        queries = [
            "training topic 0",
            "training topic 5",
            "training topic 9",
        ]

        results = []
        for query in queries:
            result = manager.retrieve(
                query=query,
                collection="domain_knowledge",
                top_k=5
            )
            results.append(result)

        # All should succeed
        assert len(results) == 3
        assert all(len(r.documents) == 5 for r in results)


class TestErrorHandling:
    """Test error handling and edge cases."""

    def test_invalid_collection_name(self, tmp_path: Path) -> None:
        """Test that invalid collection names raise clear errors."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        with pytest.raises(ValueError) as exc_info:
            manager.retrieve(
                query="test",
                collection="invalid_collection_name",
                top_k=1
            )

        assert "Unknown collection" in str(exc_info.value)
        assert "invalid_collection_name" in str(exc_info.value)

    def test_empty_collection_retrieval(self, tmp_path: Path) -> None:
        """Test retrieval from empty collection."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Retrieve from empty collection
        result = manager.retrieve(
            query="test query",
            collection="domain_knowledge",
            top_k=5
        )

        # Should return empty result (not error)
        assert len(result.documents) == 0
        assert len(result.metadata) == 0
        assert len(result.scores) == 0

    def test_top_k_larger_than_collection(self, tmp_path: Path) -> None:
        """Test that top_k larger than collection size works."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add 3 documents
        docs = [
            Document(page_content=f"Document {i}")
            for i in range(3)
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Request 10 documents (more than available)
        result = manager.retrieve(
            query="document",
            collection="domain_knowledge",
            top_k=10
        )

        # Should return all available (3), not error
        assert len(result.documents) == 3
```

---

## Comprehensive Validation Script

### File: `scripts/validate_rag_phase1.py`

```python
#!/usr/bin/env python
"""
Validation script for RAG Phase 1 implementation.

Runs comprehensive checks:
- Type checking (mypy)
- Test suite (pytest)
- Coverage analysis
- Import validation
- Documentation completeness
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], description: str) -> bool:
    """Run command and report result."""
    print(f"\n{'=' * 60}")
    print(f"RUNNING: {description}")
    print(f"Command: {' '.join(cmd)}")
    print('=' * 60)

    result = subprocess.run(cmd, capture_output=False)

    if result.returncode == 0:
        print(f"✓ {description} PASSED")
        return True
    else:
        print(f"✗ {description} FAILED")
        return False


def main() -> int:
    """Run all validation checks."""
    project_root = Path(__file__).parent.parent

    checks = []

    # 1. Type checking
    checks.append(run_command(
        ["mypy", "src/cycling_ai/rag/", "--strict"],
        "Type checking (mypy --strict)"
    ))

    # 2. Run tests
    checks.append(run_command(
        ["pytest", "tests/rag/", "-v"],
        "Test suite (pytest)"
    ))

    # 3. Coverage analysis
    checks.append(run_command(
        [
            "pytest",
            "tests/rag/",
            "--cov=src/cycling_ai/rag",
            "--cov-report=term-missing",
            "--cov-fail-under=90"
        ],
        "Coverage analysis (≥90% required)"
    ))

    # 4. Import validation
    checks.append(run_command(
        [
            "python",
            "-c",
            "from cycling_ai.rag import RAGManager, RetrievalResult, "
            "ChromaVectorStore, EmbeddingFactory; print('All imports OK')"
        ],
        "Import validation"
    ))

    # 5. Integration test
    checks.append(run_command(
        ["pytest", "tests/rag/test_integration.py", "-v"],
        "Integration tests"
    ))

    # Summary
    print(f"\n{'=' * 60}")
    print("VALIDATION SUMMARY")
    print('=' * 60)

    passed = sum(checks)
    total = len(checks)

    print(f"\nPassed: {passed}/{total}")

    if passed == total:
        print("\n✓ ALL CHECKS PASSED - Phase 1 complete!")
        return 0
    else:
        print(f"\n✗ {total - passed} checks failed - Phase 1 incomplete")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

Make executable:
```bash
chmod +x scripts/validate_rag_phase1.py
```

---

## Manual Verification Checklist

### Functionality Verification

- [ ] Can create RAGManager with local embeddings
- [ ] Can create RAGManager with OpenAI embeddings (if API key set)
- [ ] Can add documents to project vectorstore
- [ ] Can add documents to user vectorstore
- [ ] Can retrieve from domain_knowledge collection
- [ ] Can retrieve from athlete_history collection
- [ ] Retrieval routes to correct vectorstore
- [ ] Metadata filtering works correctly
- [ ] Score filtering works correctly
- [ ] Results ranked by relevance
- [ ] Data persists across manager instances

### Code Quality Verification

- [ ] `mypy src/cycling_ai/rag/ --strict` passes (0 errors)
- [ ] All tests pass (`pytest tests/rag/`)
- [ ] Test coverage ≥90% (`pytest tests/rag/ --cov`)
- [ ] No regressions in existing tests
- [ ] Docstrings complete with examples
- [ ] Type hints on all functions
- [ ] Imports work from `cycling_ai.rag`

### Documentation Verification

- [ ] README.md mentions RAG module (if applicable)
- [ ] Each module has comprehensive docstring
- [ ] Each class has comprehensive docstring
- [ ] Each method has docstring with examples
- [ ] Type hints are clear and accurate
- [ ] Error messages are helpful

---

## Acceptance Criteria

Phase 1 is **COMPLETE** when:

- [ ] All 5 cards (1-5) completed
- [ ] All tests pass (unit + integration)
- [ ] Test coverage ≥90% for `src/cycling_ai/rag/`
- [ ] `mypy --strict` passes with 0 errors
- [ ] No regressions in existing tests
- [ ] `scripts/validate_rag_phase1.py` succeeds
- [ ] Two-vectorstore routing works correctly
- [ ] Can retrieve documents with LangChain Chroma
- [ ] Can embed with HuggingFaceEmbeddings
- [ ] Metadata filtering works
- [ ] Score filtering works
- [ ] Data persists across sessions
- [ ] All manual verification items checked

---

## Validation Commands

```bash
# Run validation script
./scripts/validate_rag_phase1.py

# Or run checks individually:

# Type check
mypy src/cycling_ai/rag/ --strict

# All RAG tests
pytest tests/rag/ -v

# Coverage report
pytest tests/rag/ --cov=src/cycling_ai/rag --cov-report=term-missing

# Integration tests only
pytest tests/rag/test_integration.py -v

# Verify no regressions
pytest tests/ -v  # All tests
```

---

## Success Metrics

After completion, we should have:

- **~600 lines** of implementation code (`embeddings.py`, `vectorstore.py`, `manager.py`)
- **~800 lines** of test code (comprehensive coverage)
- **90%+ test coverage** for RAG module
- **0 type errors** with mypy --strict
- **All existing tests** still passing
- **Working two-vectorstore** system
- **Production-ready** foundation for Phase 2

---

## Time Estimate Breakdown

- Write integration tests: 45 min
- Write validation script: 15 min
- Run full validation suite: 10 min
- Fix any issues: 15 min
- Final verification: 5 min

**Total: ~1.5 hours**

---

## Next Steps After Completion

Once Phase 1 is validated and complete:

1. **Commit changes** with clear message
2. **Update CLAUDE.md** with RAG section (brief mention)
3. **Create GitHub issue** for Phase 2 (Knowledge Base Creation)
4. **Celebrate** - Foundation is solid!

Phase 2 will build on this foundation to create domain knowledge content and indexing tools.
