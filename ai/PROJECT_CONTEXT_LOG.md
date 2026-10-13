# Semantic Chaos Monkey — AI Project Context & Changelog

> **Tracking Rule**: This document is updated with every change to maintain complete chat context, architecture decisions, code explanations, and a chronological changelog.

---

## 1. Project Background & Core Mission

### The Problem
Operational and database instructions written in natural language (e.g., runbooks, agent skills, deployment checklists) can be grammatically correct English while being dangerously ambiguous:
> *"Delete old user records and restore the latest backup if necessary."*
- Operator A interprets "old" as accounts inactive for 90 days.
- Operator B interprets "old" as accounts created more than 90 days ago (deleting loyal active customers!).
- Operator C deletes accounts with missing activity dates.

### The Solution: Semantic Chaos Monkey
- **AI Discovers**: An open-weight LLM analyzes the instruction, identifies unstated assumptions, and translates competing interpretations into restricted declarative plans.
- **Simulator Verifies**: A deterministic Python simulator (owned by Person 3) executes each plan on identical synthetic data and computes exact row diffs and blast radius.
- **Ambiguity Exposed**: The system highlights the divergence, pinpoints the culprit assumptions, and produces a safe, clarified rewrite.
- **Safety Principle**: **The AI NEVER outputs executable code, SQL, or shell commands.** Its output is strictly validated declarative AST data.

---

## 2. Team Division & Ownership Boundaries

A 5-hour hackathon project with 4 team members:
- **Person 1 & 2**: Frontend (Next.js / UI dashboard, branch visualizers, diff view).
- **Person 3**: Backend orchestrator (FastAPI), deterministic sandbox simulator, divergence comparator.
- **Person 4 (This Codebase)**: **AI Owner**.
  - **Rule**: All code, schemas, tests, and configuration must stay **exclusively inside the `ai/` folder**.
  - No edits to `simulator.py`, `main.py`, `ambiguity.py`, or frontend files.

---

## 3. What Each File in `ai/` Does

| File | Purpose & Responsibilities |
| :--- | :--- |
| **`ai/plan_schema.py`** | **Safe Declarative Plan Language (AST)**.<br>- Strict operation allowlist: `delete`, `archive`, `update`, `flag`, `restore`.<br>- Strict field types: `string`, `int`, `float`, `bool`, `date`.<br>- Predicate AST: `compare`, `older_than_days`, `newer_than_days`, `is_null`, `not_null`, `in`, `and`, `or`, `not`, `term_ref`.<br>- Complexity limits: AST depth ≤ 4, node count ≤ 12.<br>- Schema cross-checks: fields must exist, operators must match field types, no unresolved `term_ref` in executable plans. |
| **`ai/ai_engine.py`** | **Core Hybrid AI Engine & Router**.<br>- **Generic Pipeline**: `ANALYZE` (LLM) → `WORLD` (LLM) → Deterministic Edge-Case Injection (Code) → Branch Permutations (Code, cap 8, dedup) → Plan validation.<br>- **Legacy Demo Fallback**: Hardcoded `user_cleanup` path preserved for 100% demo reliability.<br>- **Automatic Plan Converter**: Converts legacy A/B/C conditions into universal `plan_schema` format so Person 3 only needs one simulator engine.<br>- **Post-Simulation Rewrite**: `generate_rewrite()` clarifying criteria based on simulation outcomes.<br>- **Source Labeling**: Every response carries `"source": "live_generic" \| "live_hardcoded" \| "fixture_fallback"`.<br>- **Safety & Reliability**: Bounded retries, time budget (`LLM_TOTAL_BUDGET_SECONDS`), and demo switch (`CHAOS_FORCE_FALLBACK`). |
| **`ai/prompts.py`** | **Prompt Engineering & Injection Defense**.<br>- Delimits untrusted instructions inside `<instruction>...</instruction>` tags to prevent prompt injection.<br>- System prompts enforcing analyst persona (never an executor).<br>- Few-shot examples across multiple domains (`user_management`, `file_management`).<br>- Synthetic world generator prompt and rewrite prompt. |
| **`ai/fixtures/ai_fixtures.json`** | **Deterministic Local Fixtures**.<br>- Offline canned responses for zero-network demos and test runs.<br>- Covers: `"Delete old user records."`, `"Archive old log files."`, `"Remove inactive users."`, and out-of-scope `"Restore the latest backup if necessary."`. |
| **`ai/schemas.py`** | Legacy Pydantic schemas for the initial hardcoded contract. |
| **`ai/list_models.py`** | Utility script calling `GET {LLM_BASE_URL}/models` to inspect available open-weight models on DigitalOcean or Ollama. |
| **`ai/AI_ENGINE_README.md`** | Comprehensive developer guide, routing architecture diagram, configuration, and simulator integration instructions for Person 3. |
| **`ai/tests/test_ai_engine.py`** | **Pytest Test Suite (31 tests total: 29 offline passed, 2 live skipped)**.<br>- Unit tests mocking OpenAI client.<br>- Plan validation & AST boundary tests.<br>- Deduplication and branch builder tests.<br>- Source labeling and fallback routing tests.<br>- Prompt injection defense tests.<br>- Zero-network fixture mode tests. |
| **`ai/.env.example`** | Environment variable template (DigitalOcean inference primary, Ollama commented alternative). |
| **`ai/requirements.txt`** | Dependency declarations (`openai`, `pydantic`, `pytest`, `httpx`, `fastapi`, `uvicorn`, `python-dotenv`). |
| **`ai/CHANGELOG_CONTEXT.md`** | This file: Tracks complete context, chat decisions, and changes. |

---

## 4. API & Integration Contract for Person 3

### Primary Router: `analyze_and_branch(instruction, scenario="auto")`
```python
from ai.ai_engine import analyze_and_branch

result = analyze_and_branch("Archive old log files.")
```
**Output Shape:**
```json
{
  "status": "ok",
  "source": "live_generic",
  "fallback_reason": null,
  "domain": "file_management",
  "entity_schema": { "name": "log_file", "fields": [...] },
  "world": { "entity": "log_file", "today": "2026-10-13", "records": [...] },
  "branches": [
    {
      "id": "A",
      "title": "Created 30+ days ago",
      "assumption": "'Old' means created at least 30 days ago.",
      "operation": "archive",
      "update_set": {"is_archived": true},
      "where": {
        "op": "and",
        "args": [
          {"op": "compare", "field": "is_archived", "cmp": "eq", "value": false},
          {"op": "older_than_days", "field": "created_at", "days": 30}
        ]
      },
      "explanation": "..."
    }
  ],
  "suggested_rewrite": "Archive unarchived log files whose creation date is older than 30 days.",
  "model_info": {"model": "qwen2.5:7b", "mode": "live"},
  "warnings": []
}
```

### Legacy Entry Point: `generate_interpretations(instruction, scenario="user_cleanup")`
Preserved for 100% backward compatibility with the initial contract.

---

## 5. Chronological Changelog & Git History

### Entry 1: Initial AI Engine & Allowlist Gate
- Created `ai_engine.py`, `prompts.py`, `schemas.py`.
- Enforced hard allowlist: `type: "delete_users"`, conditions: `inactive_90_days`, `created_90_days`, `inactive_or_unknown`.
- Set up OpenAI SDK client targeting open-weight model (`qwen2.5:7b`).
- Built initial test suite (8 tests).

### Entry 2: Isolation into `ai/` Directory
- Restructured files so that Person 4 works exclusively within the `ai/` folder to prevent merge conflicts with team members owning `backend/` and `frontend/`.
- Committed and pushed to GitHub `main` branch.

### Entry 3: Hybrid Generic Pipeline & Declarative Plan Schema
- Added safe plan language (`ai/plan_schema.py`) supporting recursive predicate ASTs (`compare`, `older_than_days`, `newer_than_days`, `is_null`, `not_null`, `in`, `and`, `or`, `not`).
- Implemented AST complexity limits (depth ≤ 4, nodes ≤ 12) and type cross-checks.
- Built 4-stage generic pipeline:
  1. **Analyze**: Extracts entity schema, ambiguous terms, and operational templates with `term_ref`.
  2. **World**: LLM generates fictional records; code deterministically injects edge cases (null date, boundary record, no-match record).
  3. **Branches**: Pure code combines meanings into branches (cap 8, dedup identical predicates, assign IDs A..H).
  4. **Rewrite**: Post-simulation rewrite generation (`generate_rewrite`).
- Implemented automatic legacy-to-plan bridge (`convert_hardcoded_to_plan`).
- Implemented labeled router (`analyze_and_branch`) with provenance tags (`"live_generic"`, `"live_hardcoded"`, `"fixture_fallback"`).
- Added demo switches: `CHAOS_FORCE_FALLBACK=true` and time budget `LLM_TOTAL_BUDGET_SECONDS`.
- Expanded test suite to 31 tests (29 passed offline, 2 live skipped).
- Committed and pushed commit `a4f60b8` to GitHub.

### Entry 4: Ongoing Context Tracking Protocol
- Created `ai/PROJECT_CONTEXT_LOG.md` to permanently capture all chat history, context, and code explanations.

### Entry 5: Part 1 Audit Completed
- Conducted deep code audit across `ai/ai_engine.py`, `ai/plan_schema.py`, `ai/prompts.py`, `ai/tests/test_ai_engine.py`, and `ai/fixtures/ai_fixtures.json`.
- Produced comprehensive audit artifact at `ai/docs/AUDIT.md` covering all 9 specific architectural, security, and schema validation questions with exact file and line references.
- Verified test suite status: `29 passed, 2 skipped in 1.06s` (100% offline pass rate).

