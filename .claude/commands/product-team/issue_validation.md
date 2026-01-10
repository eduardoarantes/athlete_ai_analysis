---
description: Validate GitHub issues, enhance descriptions, and ensure answers are captured
allowed-tools: Bash(gh issue:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue comment:*), Bash(gh issue create:*)
argument-hint: [issue-number]
---

# Issue Response Validation

Validate GitHub issues, enhance unclear descriptions, and ensure all answers are captured in the issue description (source of truth).

## Input
- **Issue ID**: $ARGUMENTS (GitHub issue number, e.g., "47")

## Core Principle
**The issue description is the source of truth.** All decisions, answers, and clarifications from comments MUST be incorporated into the main issue description. Comments are for discussion; the description is the final specification.

## Instructions

1. **Fetch the issue with labels and all comments**
   ```bash
   gh issue view $ARGUMENTS --json title,body,labels,comments,author
   ```

2. **Check if the issue has labels**
   - If labels array is empty, suggest an appropriate label based on issue content
   - Common labels: `enhancement`, `bug`, `documentation`, `refactor`, `feature`, `chore`, `performance`
   - Add the suggested label:
     ```bash
     gh issue edit $ARGUMENTS --add-label "suggested-label"
     ```

3. **Reformat the title** for consistency:
   - First letter must be uppercase
   - Format acronyms properly (e.g., "api" → "API", "url" → "URL", "html" → "HTML", "css" → "CSS", "json" → "JSON", "sql" → "SQL", "http" → "HTTP", "ui" → "UI", "ux" → "UX", "cli" → "CLI", "sdk" → "SDK", "aws" → "AWS", "gcp" → "GCP")
   - Format symbols and technical terms properly (e.g., "github" → "GitHub", "javascript" → "JavaScript", "typescript" → "TypeScript", "nodejs" → "Node.js", "graphql" → "GraphQL", "oauth" → "OAuth", "mongodb" → "MongoDB", "postgresql" → "PostgreSQL")
   - Preserve intentional casing in code references (e.g., function names, variable names in backticks)
   - Update if needed:
     ```bash
     gh issue edit $ARGUMENTS --title "Properly Formatted Title"
     ```

4. **Assess issue quality** - If the issue is new or lacks detail:
   - **Title**: If vague or unclear, suggest a more descriptive title
     ```bash
     gh issue edit $ARGUMENTS --title "New clearer title"
     ```
   - **Description**: Enhance with:
     - Clear problem statement or feature description
     - Acceptance criteria (if missing)
     - Technical context from codebase investigation
     - Structured sections (Description, Current State, Proposed Solution, Tasks, etc.)

5. **Identify all questions** in the issue body and comments that were asked by the maintainer/author

6. **Check each comment** for answers provided by the user (issue owner)

7. **For each question, determine if it has been answered:**
   - Mark as answered if a clear response was provided
   - Mark as unanswered/unclear if no response or ambiguous answer

8. **Handle "Future Implementation" answers:**
   - If an answer contains phrases like "for future implementation", "future enhancement", "out of scope for now", "later phase", or similar deferred-work indicators:
     - Create a new backlog issue for the deferred item:
       ```bash
       gh issue create --title "[To be Refined] <descriptive title of the deferred feature>" --body "## Context\nSpun off from issue #$ARGUMENTS\n\n## Description\n<description of the deferred feature/requirement>\n\n## Original Discussion\n<relevant context from the original issue>"
       ```
     - Add the `backlog` label to the new issue:
       ```bash
       gh issue edit <new-issue-number> --add-label "backlog"
       ```
     - Reference the new issue in the original issue's description under a "Related Issues" or "Deferred Items" section

9. **Update the issue description immediately** when answers are found:
   - DO NOT leave answers only in comments
   - Incorporate every answered question into the main description
   - Add/update a "Decisions" section with resolved items
   - Update relevant sections (requirements, acceptance criteria, etc.)
   - Use clear formatting (tables, bullet points) for readability

10. **If questions remain unanswered:**
    - Create a comment listing the unanswered questions
    - Tag the original issue creator (from the `author` field) to request clarification
    - Example:
      ```bash
      gh issue comment $ARGUMENTS --body "@<author-login> Could you please clarify the following questions?\n\n1. <question 1>\n2. <question 2>"
      ```

## Updating the Issue Description

When updating, use this command:
```bash
gh issue edit $ARGUMENTS --body "updated body content"
```

Structure the description with clear sections:
- **Description**: What and why
- **Current State**: How it works now (if applicable)
- **Decisions**: All resolved questions/answers from discussion
- **Implementation Tasks**: Checklist of work items
- **Acceptance Criteria**: How to verify completion

## Output Format

Provide a summary:
- Title formatting: (reformatted / already correct)
- Issue quality: (enhanced title/description / already clear)
- Label status: (existing: X / added: Y)
- Total questions identified: X
- Questions answered: Y
- Questions pending: Z
- Description updates: (X decisions incorporated)
- Backlog issues created: X (list issue numbers if any)
- Actions taken: (reformatted title / updated issue / added label / enhanced description / created backlog issues / commented with pending questions)
