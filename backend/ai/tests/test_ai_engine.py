import pytest
import os
import sys

# Ensure backend/ai directory and repo root are in python path
ai_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ai_dir not in sys.path:
    sys.path.insert(0, ai_dir)

from ai_engine import (
    AIEngine,
    generate_interpretations,
    ALLOWED_ACTION_TYPE,
    ALLOWED_CONDITIONS
)
from schemas import AIEngineOutput, Action
from prompts import build_prompt_messages, SYSTEM_PROMPT


def test_prompt_generation():
    """Verify prompt formatting and system instructions."""
    messages = build_prompt_messages("Delete old user records.", "user_cleanup")
    assert len(messages) == 4
    assert messages[0]["role"] == "system"
    assert "delete_users" in messages[0]["content"]
    assert "inactive_90_days" in messages[0]["content"]
    assert messages[3]["role"] == "user"
    assert "Delete old user records." in messages[3]["content"]


def test_fixture_delete_old_user_records():
    """Verify primary demo instruction: 'Delete old user records.'"""
    engine = AIEngine(fixture_mode=True)
    res = engine.generate_interpretations("Delete old user records.", "user_cleanup")

    assert "interpretations" in res
    assert len(res["interpretations"]) == 3

    # Check branch IDs
    ids = [i["id"] for i in res["interpretations"]]
    assert ids == ["A", "B", "C"]

    # Check actions and conditions are strictly permitted
    conditions = set()
    for interp in res["interpretations"]:
        action = interp["action"]
        assert action["type"] == ALLOWED_ACTION_TYPE
        assert action["condition"] in ALLOWED_CONDITIONS
        conditions.add(action["condition"])
        assert len(interp["assumption"]) > 5
        assert len(interp["explanation"]) > 5

    assert len(conditions) == 3, "Interpretations must test distinct conditions"

    # Check candidate ambiguities
    assert "candidate_ambiguities" in res
    assert len(res["candidate_ambiguities"]) >= 1
    terms = [a["term"] for a in res["candidate_ambiguities"]]
    assert any("old" in t for t in terms)

    # Check rewrite
    assert "suggested_rewrite" in res
    assert len(res["suggested_rewrite"]) > 10


def test_fixture_remove_inactive_users():
    """Verify second test example: 'Remove inactive users.'"""
    engine = AIEngine(fixture_mode=True)
    res = engine.generate_interpretations("Remove inactive users.", "user_cleanup")

    assert len(res["interpretations"]) == 3
    for interp in res["interpretations"]:
        assert interp["action"]["type"] == ALLOWED_ACTION_TYPE
        assert interp["action"]["condition"] in ALLOWED_CONDITIONS

    assert len(res["candidate_ambiguities"]) >= 1
    assert "suggested_rewrite" in res


def test_unsupported_scenario_backup_restore():
    """Verify third test example: 'Restore the latest backup if necessary.' is recognized as unsupported."""
    engine = AIEngine(fixture_mode=True)
    res = engine.generate_interpretations("Restore the latest backup if necessary.", "user_cleanup")

    assert "error" in res
    assert res["error"] == "unsupported_scenario"
    assert "outside the supported" in res["message"]


def test_unsupported_scenario_non_user_cleanup():
    """Verify non-supported scenario parameter."""
    engine = AIEngine(fixture_mode=True)
    res = engine.generate_interpretations("Delete old user records.", "payment_processing")

    assert "error" in res
    assert res["error"] == "unsupported_scenario"


def test_reject_unsupported_action_type():
    """Verify that an illegal action type (e.g. 'drop_table') is rejected."""
    engine = AIEngine(fixture_mode=True)
    malicious_data = {
        "interpretations": [
            {
                "id": "A",
                "title": "Drop table",
                "assumption": "Drop users",
                "action": {"type": "drop_table", "condition": "all"},
                "explanation": "Dangerous",
                "risk_level": "critical"
            },
            {
                "id": "B",
                "title": "B",
                "assumption": "B",
                "action": {"type": "delete_users", "condition": "inactive_90_days"},
                "explanation": "B"
            },
            {
                "id": "C",
                "title": "C",
                "assumption": "C",
                "action": {"type": "delete_users", "condition": "created_90_days"},
                "explanation": "C"
            }
        ],
        "candidate_ambiguities": [
            {"term": "old", "description": "ambiguous", "interpretation_ids": ["A", "B"], "impact": "bad"}
        ],
        "suggested_rewrite": "Be safe."
    }

    with pytest.raises(Exception):
        engine._validate_and_normalize(malicious_data)


def test_json_markdown_fence_extraction():
    """Verify JSON extractor correctly strips markdown blocks produced by LLMs."""
    engine = AIEngine(fixture_mode=True)
    sample_text = """```json
    {
        "interpretations": [
            {
                "id": "A",
                "title": "Inactive accounts",
                "assumption": "Assumption A",
                "action": {"type": "delete_users", "condition": "inactive_90_days"},
                "explanation": "Explanation A"
            },
            {
                "id": "B",
                "title": "Creation age",
                "assumption": "Assumption B",
                "action": {"type": "delete_users", "condition": "created_90_days"},
                "explanation": "Explanation B"
            },
            {
                "id": "C",
                "title": "Missing telemetry",
                "assumption": "Assumption C",
                "action": {"type": "delete_users", "condition": "inactive_or_unknown"},
                "explanation": "Explanation C"
            }
        ],
        "candidate_ambiguities": [
            {
                "term": "old",
                "description": "ambiguous age",
                "interpretation_ids": ["A", "B"],
                "impact": "accidental deletion"
            }
        ],
        "suggested_rewrite": "Delete users inactive for 90 days."
    }
    ```"""

    extracted = engine._extract_json(sample_text)
    validated = engine._validate_and_normalize(extracted)
    assert len(validated["interpretations"]) == 3
    assert validated["interpretations"][0]["action"]["condition"] == "inactive_90_days"


def test_top_level_generate_interpretations():
    """Verify top-level function exported for Person 3."""
    res = generate_interpretations("Delete old user records.")
    assert "interpretations" in res
    assert len(res["interpretations"]) == 3
    assert "candidate_ambiguities" in res
    assert "suggested_rewrite" in res
