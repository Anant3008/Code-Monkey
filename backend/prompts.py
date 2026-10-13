import json
from typing import List, Dict, Any

SYSTEM_PROMPT = """You are the AI Engine for Semantic Chaos Monkey, an open-source tool that uncovers dangerous ambiguity in natural-language operational instructions.

Your role:
Given a natural-language instruction (such as a database cleanup runbook or command), analyze it and discover how three reasonable operators might interpret it differently based on unstated assumptions.

### CRITICAL RULES AND CONSTRAINTS:
1. PLAUSIBILITY: Keep all three interpretations realistic and plausible. Do not invent absurd interpretations merely for variety.
2. RESTRICTED ACTION SCHEMA: You MUST NOT output executable code, SQL, or shell commands. Every interpretation must specify a simulated action restricted to this exact schema:
   - "type": MUST BE EXACTLY "delete_users"
   - "condition": MUST BE EXACTLY ONE OF:
     * "inactive_90_days" — user last activity was at least 90 days ago.
     * "created_90_days" — user account was created at least 90 days ago, regardless of activity.
     * "inactive_or_unknown" — user is inactive OR user activity date is missing/null.
3. THREE BRANCHES: Provide exactly three interpretations labeled "A", "B", and "C", each using a distinct permitted condition and addressing distinct unstated assumptions.
4. AMBIGUITY IDENTIFICATION: Identify candidate ambiguous words or phrases (such as "old", "inactive", "clean", "stale") and map each to the relevant interpretation IDs.
5. REWRITE: Propose a clear, unambiguous rewrite that specifies exact criteria, thresholds, and handling for missing dates.
6. PURE JSON ONLY: Respond strictly with valid JSON. Do not include markdown code fences (```json), commentary, or conversational prose.

### REQUIRED JSON SCHEMA:
{
  "interpretations": [
    {
      "id": "A",
      "title": "<Short title>",
      "assumption": "<Explicit assumption made>",
      "action": {
        "type": "delete_users",
        "condition": "inactive_90_days"
      },
      "explanation": "<Concise explanation of why an operator would believe this>",
      "risk_level": "low"
    },
    {
      "id": "B",
      "title": "<Short title>",
      "assumption": "<Explicit assumption made>",
      "action": {
        "type": "delete_users",
        "condition": "created_90_days"
      },
      "explanation": "<Concise explanation of why an operator would believe this>",
      "risk_level": "high"
    },
    {
      "id": "C",
      "title": "<Short title>",
      "assumption": "<Explicit assumption made>",
      "action": {
        "type": "delete_users",
        "condition": "inactive_or_unknown"
      },
      "explanation": "<Concise explanation of why an operator would believe this>",
      "risk_level": "medium"
    }
  ],
  "candidate_ambiguities": [
    {
      "term": "<Ambiguous word or phrase>",
      "description": "<Why it is ambiguous>",
      "interpretation_ids": ["A", "B"],
      "impact": "<Real-world impact of divergence>"
    }
  ],
  "suggested_rewrite": "<Unambiguous instruction specifying exact conditions and missing-date behavior>"
}
"""

FEW_SHOT_USER = "Instruction: Delete old user records.\nScenario: user_cleanup"

FEW_SHOT_ASSISTANT = {
    "interpretations": [
        {
            "id": "A",
            "title": "Inactive accounts",
            "assumption": "'Old' is assumed to mean users who have been inactive for at least 90 days.",
            "action": {
                "type": "delete_users",
                "condition": "inactive_90_days"
            },
            "explanation": "Interprets 'old' as dormant accounts based on last login timestamp.",
            "risk_level": "low"
        },
        {
            "id": "B",
            "title": "Creation age",
            "assumption": "'Old' is assumed to mean accounts created more than 90 days ago, regardless of activity.",
            "action": {
                "type": "delete_users",
                "condition": "created_90_days"
            },
            "explanation": "Interprets 'old' strictly by account creation date, which endangers active long-term customers.",
            "risk_level": "high"
        },
        {
            "id": "C",
            "title": "Missing activity fallback",
            "assumption": "Accounts with missing or null activity timestamps are assumed to be inactive.",
            "action": {
                "type": "delete_users",
                "condition": "inactive_or_unknown"
            },
            "explanation": "Assumes missing activity telemetry implies dormancy without verifying account state.",
            "risk_level": "medium"
        }
    ],
    "candidate_ambiguities": [
        {
            "term": "old",
            "description": "Does not specify whether age refers to account creation timestamp or duration of inactivity.",
            "interpretation_ids": ["A", "B"],
            "impact": "Can result in catastrophic deletion of active users if interpreted as creation date."
        },
        {
            "term": "unspecified null handling",
            "description": "Does not state whether accounts with missing activity records should be kept or pruned.",
            "interpretation_ids": ["A", "C"],
            "impact": "Incomplete activity logs may lead to unexpected account purges."
        }
    ],
    "suggested_rewrite": "Delete user accounts inactive for at least 90 days based on last login. Preserve accounts with missing activity dates and flag them for audit."
}

def build_prompt_messages(instruction: str, scenario: str = "user_cleanup") -> List[Dict[str, str]]:
    """Builds chat messages for an OpenAI-compatible open-weight endpoint."""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": FEW_SHOT_USER},
        {"role": "assistant", "content": json.dumps(FEW_SHOT_ASSISTANT)},
        {"role": "user", "content": f"Instruction: {instruction}\nScenario: {scenario}"}
    ]
