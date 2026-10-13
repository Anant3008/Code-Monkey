# Semantic Chaos Monkey — AI Engine (Person 4 Documentation)

This module provides the open-weight AI interpretation and ambiguity analysis engine for Semantic Chaos Monkey.

**Core Principle**: *The AI discovers alternative meanings; the simulator verifies their real-world consequences.*
The model output is strictly data, never code or SQL.

---

## 1. Output Contract for Person 3

Person 3's FastAPI orchestrator calls:

```python
from backend.ai_engine import generate_interpretations

response = generate_interpretations(
    instruction="Delete old user records.",
    scenario="user_cleanup"
)
```

### A. Success Response (`status: "ok"`)
```json
{
  "status": "ok",
  "interpretations": [
    {
      "id": "A",
      "title": "Inactive for 90 days",
      "assumption": "'Old' means inactive for at least 90 days based on last activity.",
      "action": {
        "type": "delete_users",
        "condition": "inactive_90_days"
      },
      "explanation": "Interprets 'old' as dormant accounts based on last recorded activity timestamp."
    },
    {
      "id": "B",
      "title": "Account created 90+ days ago",
      "assumption": "'Old' means created more than 90 days ago, regardless of recent activity.",
      "action": {
        "type": "delete_users",
        "condition": "created_90_days"
      },
      "explanation": "Interprets 'old' strictly by account creation date, which endangers active long-term customers."
    },
    {
      "id": "C",
      "title": "Inactive or missing activity dates",
      "assumption": "Accounts lacking an activity timestamp are assumed to be old and dormant.",
      "action": {
        "type": "delete_users",
        "condition": "inactive_or_unknown"
      },
      "explanation": "Treats missing telemetry as inactivity without verifying account state."
    }
  ],
  "candidate_ambiguities": [
    {
      "term": "old",
      "description": "Could refer to duration since account creation or duration since last user activity.",
      "interpretation_ids": ["A", "B"]
    },
    {
      "term": "missing activity dates",
      "description": "Does not specify whether accounts with null activity dates are preserved or purged.",
      "interpretation_ids": ["A", "C"]
    }
  ],
  "suggested_rewrite": "Delete user accounts inactive for at least 90 days based on last recorded activity. Preserve accounts with missing activity dates and flag them for audit.",
  "model_info": {
    "model": "qwen2.5:7b",
    "mode": "live"
  },
  "warnings": []
}
```

*Note: Per the architecture, `affected_ids`, `affected_count`, and `risk_level` are computed by the deterministic simulator, NOT the AI.*

### B. Out-of-Scope Response (`status: "unsupported"`)
For instructions outside the user-cleanup domain (e.g., `"Restore the latest backup if necessary."`) or unsupported scenarios:
```json
{
  "status": "unsupported",
  "reason": "Backup and restore operations are outside the MVP simulator's supported action scope. Only user-cleanup actions ('delete_users') are supported.",
  "interpretations": [],
  "candidate_ambiguities": [],
  "suggested_rewrite": "",
  "model_info": {
    "model": "qwen2.5:7b",
    "mode": "fixture"
  }
}
```

### C. Failure Contract (`status: "error"`)
If model communication fails after bounded retries and no fixture is available, the engine returns a clean JSON error response (so FastAPI never crashes):
```json
{
  "status": "error",
  "reason": "AI Engine failed after 3 attempts. Last error: ...",
  "interpretations": [],
  "candidate_ambiguities": [],
  "suggested_rewrite": "",
  "model_info": {
    "model": "qwen2.5:7b",
    "mode": "live"
  }
}
```
*(An `AIEngineError` exception is also defined for internal catch-and-raise semantics).*

---

## 2. Hard Action Allowlist

The model output is strictly validated against this allowlist:
- `type`: `"delete_users"` (only allowed type)
- `condition`:
  - `"inactive_90_days"`: last activity at least 90 days ago
  - `"created_90_days"`: account created at least 90 days ago
  - `"inactive_or_unknown"`: inactive 90+ days OR last activity date is missing

Any other action or condition (e.g. `drop_table`, `rm -rf`) is rejected by the Pydantic validation gate.

---

## 3. Configuration & DigitalOcean / Ollama Setup

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Configuration Variables
```env
# DigitalOcean Serverless Inference (Default)
LLM_BASE_URL=https://inference.do-ai.run/v1
LLM_MODEL=qwen2.5:7b
LLM_API_KEY=your_digitalocean_model_access_key
LLM_TIMEOUT_SECONDS=60
LLM_MAX_RETRIES=2
LLM_MAX_TOKENS=2000
LLM_TEMPERATURE=0.4
CHAOS_FIXTURE_MODE=false
```

### How to get a DigitalOcean Model Access Key:
1. Log into your DigitalOcean Control Panel.
2. Navigate to **GenAI / Serverless Inference** -> **Model Access Keys**.
3. Generate a new Model Access Key and set `LLM_API_KEY=<your_key>`.

### Discover Available Models
Run the helper script to query model IDs:
```bash
python backend/list_models.py
```

### Running with Local Ollama
1. Start Ollama with an open-weight model: `ollama run qwen2.5:7b`
2. Update `.env`:
   ```env
   LLM_BASE_URL=http://localhost:11434/v1
   LLM_MODEL=qwen2.5:7b
   LLM_API_KEY=ollama
   ```

---

## 4. Fixture Mode (Offline / Hackathon Demo)

When `CHAOS_FIXTURE_MODE=true` (or when no API key is set), the engine skips the network and serves deterministic verified fixtures from `backend/fixtures/ai_fixtures.json`.

Supported benchmark fixtures:
- `"Delete old user records."`
- `"Remove inactive users."`
- `"Restore the latest backup if necessary."` (returns `status: "unsupported"`)

---

## 5. Quick Manual Check (CLI)

You can run the engine directly from the command line:

```bash
# Test primary benchmark instruction
python -m backend.ai_engine "Delete old user records."

# Test secondary benchmark instruction
python -m backend.ai_engine "Remove inactive users."

# Test out-of-scope instruction
python -m backend.ai_engine "Restore the latest backup if necessary."
```

---

## 6. Running Tests

Run the full pytest suite (14 unit tests, all offline with mocked clients and fixtures):

```bash
python -m pytest backend/tests/test_ai_engine.py -v
```

### To run the optional live test against the real model:
```bash
$env:RUN_LIVE_TESTS="1"
$env:LLM_API_KEY="<your-access-key>"
python -m pytest backend/tests/test_ai_engine.py -k test_live_open_weight_model -v
```
