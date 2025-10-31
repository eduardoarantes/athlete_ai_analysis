  ┌─────────────────────────────────────────────────────────────┐
  │  MULTI-AGENT WORKFLOW (execute_workflow)                    │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  Phase 1: Data Preparation (Python)                         │
  │     ↓ outputs: cache_file_path, athlete_profile_path        │
  │                                                             │
  │  Phase 2: Performance Analysis (LLM)                        │
  │     ↓ outputs: performance_analysis_json                    │
  │                                                             │
  │  Phase 3: Training Planning (LLM)                           │
  │     ↓ outputs: training_plan (with weekly_plan)             │
  │                                                             │
  │  Phase 4: Report Data Consolidation (Python)                │
  │     ↓ outputs: report_data.json                             │
  │                                                             │
  │  Phase 5: HTML Generation (Python)                          │
  │     ↓ outputs: performance_report.html                      │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
