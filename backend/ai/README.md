# Semantic Chaos Monkey — AI Engine (Person 4)

This folder contains the complete, isolated AI engine responsible for generating candidate interpretations, detecting unstated assumptions, extracting ambiguous terms, and suggesting unambiguous rewrites for operational instructions.

## Ownership
- **Owner**: Person 4 (AI Owner)
- **Scope**: Natural language interpretation generation using open-weight models (e.g., Qwen 2.5:7b via Ollama), JSON validation against the restricted action schema, candidate ambiguities, and rewrites.
- **Contract Boundary**: Does **NOT** compute affected record IDs or counts (those are computed by Person 3's simulator).

---

## Quick Integration for Person 3

Import `generate_interpretations` directly into your API or orchestrator:

```python
from backend.ai import generate_interpretations

# Example invocation
result = generate_interpretations(
    instruction="Delete old user records.",
    scenario="user_cleanup"
)
```

### Return Contract
```json
{
  "interpretations": [
    {
      "id": "A",
      "title": "Inactive accounts (90+ days)",
      "assumption": "'Old' refers to account inactivity for at least 90 days.",
      "action": {
        "type": "delete_users",
        "condition": "inactive_90_days"
      },
      "explanation": "Interprets 'old' as dormant user accounts based on last login timestamp.",
      "risk_level": "low"
    },
    {
      "id": "B",
      "title": "Account creation age (90+ days)",
      "assumption": "'Old' refers to account creation date, deleting any account older than 90 days.",
      "action": {
        "type": "delete_users",
        "condition": "created_90_days"
      },
      "explanation": "Filters strictly on creation date, inadvertently deleting active loyal users.",
      "risk_level": "high"
    },
    {
      "id": "C",
      "title": "Missing activity fallback",
      "assumption": "Accounts with missing or null activity dates are assumed to be old and dormant.",
      "action": {
        "type": "delete_users",
        "condition": "inactive_or_unknown"
      },
      "explanation": "Deletes accounts lacking last_active_at timestamps without verifying state.",
      "risk_level": "medium"
    }
  ],
  "candidate_ambiguities": [
    {
      "term": "old",
      "description": "Fails to distinguish between account creation age and duration of inactivity.",
      "interpretation_ids": ["A", "B"],
      "impact": "Interpreting age as creation timestamp deletes active users, causing severe data loss."
    }
  ],
  "suggested_rewrite": "Delete user accounts inactive for at least 90 days based on last activity. Preserve accounts with missing activity timestamps and flag them for review."
}
```

If an instruction is outside the bounded simulator's capabilities (e.g., `"Restore the latest backup if necessary."`), the engine returns:
```json
{
  "error": "unsupported_scenario",
  "message": "Instruction '...' is outside the supported user cleanup MVP simulation scope. The simulator currently models user cleanup actions ('delete_users') only.",
  "supported_scenarios": ["user_cleanup"],
  "interpretations": [],
  "candidate_ambiguities": [],
  "suggested_rewrite": ""
}
```

---

## Configuration & Open-Weight Models

Create a `.env` in `backend/` or `backend/ai/` based on `.env.example`:

```bash
# Point to your Ollama or OpenAI-compatible inference server
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b
LLM_API_KEY=ollama
LLM_TIMEOUT=12.0

# Optional: Force deterministic fixture mode (zero network dependencies)
CHAOS_FIXTURE_MODE=false
```

### Automatic Fixture Fallback
If the inference server is not running or times out, the engine automatically falls back to deterministic fixtures so the rest of the application never crashes during development, demos, or testing.

---

## Running the Tests

To run the AI engine tests from anywhere:

```bash
python -m pytest backend/ai/tests/test_ai_engine.py -v
```
