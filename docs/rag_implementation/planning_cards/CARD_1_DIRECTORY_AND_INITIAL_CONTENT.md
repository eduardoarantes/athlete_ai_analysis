# Card 1: Create Directory Structure and Initial Content

**Status:** Pending
**Estimated Time:** 6-8 hours
**Dependencies:** None

---

## Goal

Set up `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/` directory structure and create 5 initial domain knowledge markdown files.

---

## Files to Create

### Directory Structure

```bash
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/training_methodologies
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/testing_protocols
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/physiology
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/nutrition
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/periodization
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/templates
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/vectorstore
```

### Markdown Files (5 initial files)

1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/training_methodologies/polarized_training.md`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/training_methodologies/threshold_training.md`
3. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/testing_protocols/ftp_testing.md`
4. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/physiology/power_zones.md`
5. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/periodization/base_phase.md`

---

## Content Requirements

Each markdown file should be 1000-2000 words and follow this structure:

```markdown
---
category: [training_methodology|testing|physiology|periodization]
difficulty: [beginner|intermediate|advanced]
source: sports_science
last_updated: 2025-11-07
---

# [Title]

## Overview
[1-2 paragraph introduction explaining the concept]

## Scientific Basis
[Evidence-based explanation with research background]

### Key Studies
- Citation 1
- Citation 2

## Implementation Guidelines
[Practical how-to information]

### [Specific aspect 1]
- Details
- Examples

### [Specific aspect 2]
- Details
- Examples

## Common Mistakes
1. Mistake 1 - Description and how to avoid
2. Mistake 2 - Description and how to avoid
3. Mistake 3 - Description and how to avoid

## Monitoring and Progression
[How to track progress and adapt]

---
```

---

## Research Sources

- **Polarized Training:** Seiler & Kjerland (2006), Stöggl & Sperlich (2015)
- **Threshold Training:** Coggan power zones, lactate threshold research
- **FTP Testing:** Hunter Allen, Andy Coggan protocols
- **Power Zones:** Coggan 7-zone model
- **Base Phase:** Joe Friel periodization, Seiler endurance research

---

## Acceptance Criteria

- [ ] All 5 directories created
- [ ] 5 markdown files created with YAML frontmatter
- [ ] Each file 1000+ words
- [ ] Each file includes 2+ citations
- [ ] Content follows template structure
- [ ] Metadata complete (category, difficulty, source, last_updated)
- [ ] Readable at intermediate cycling knowledge level
- [ ] No grammar/spelling errors

---

## Validation

```bash
# Check directory structure
ls -R /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/

# Check file word counts
wc -w /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/*/*.md

# Validate YAML frontmatter
head -10 /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/data/knowledge/domain/training_methodologies/polarized_training.md
```

---

## Next Card

Once complete, proceed to **CARD_2_COMPLETE_DOMAIN_KNOWLEDGE.md** to create the remaining 15 markdown files.
