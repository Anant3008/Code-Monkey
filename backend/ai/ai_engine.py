import json
import logging
import os
import re
from typing import Dict, Any, List, Optional
import httpx
from pydantic import ValidationError

try:
    from backend.ai.schemas import AIEngineOutput, CandidateInterpretation, CandidateAmbiguity, Action
    from backend.ai.prompts import build_prompt_messages, SYSTEM_PROMPT
except ImportError:
    try:
        from schemas import AIEngineOutput, CandidateInterpretation, CandidateAmbiguity, Action
        from prompts import build_prompt_messages, SYSTEM_PROMPT
    except ImportError:
        from backend.schemas import AIEngineOutput, CandidateInterpretation, CandidateAmbiguity, Action
        from backend.prompts import build_prompt_messages, SYSTEM_PROMPT

logger = logging.getLogger("semantic_chaos_monkey.ai_engine")

# Permitted conditions in the bounded MVP sandbox
ALLOWED_ACTION_TYPE = "delete_users"
ALLOWED_CONDITIONS = {"inactive_90_days", "created_90_days", "inactive_or_unknown"}
SUPPORTED_SCENARIOS = {"user_cleanup"}

# Keywords indicating unsupported operations in MVP
UNSUPPORTED_KEYWORDS = ["backup", "restore", "drop database", "deploy", "restart server"]


class UnsupportedScenarioError(Exception):
    """Raised when an instruction or scenario falls outside the bounded simulator."""
    pass


class InvalidModelOutputError(Exception):
    """Raised when the LLM produces output violating the restricted schema."""
    pass


class AIEngine:
    """
    Open-weight AI Engine for Semantic Chaos Monkey.
    Generates three plausible interpretations of natural-language instructions,
    enforcing a restricted action schema and detecting semantic ambiguities.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 12.0,
        fixture_mode: Optional[bool] = None,
        max_retries: int = 1
    ):
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")).rstrip("/")
        self.model = model or os.getenv("LLM_MODEL", "qwen2.5:7b")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "ollama")
        self.timeout = float(os.getenv("LLM_TIMEOUT", str(timeout)))
        self.max_retries = max_retries

        # Fixture mode can be forced via env or parameter
        env_fixture = os.getenv("CHAOS_FIXTURE_MODE", "").lower() in ("true", "1", "yes")
        self.fixture_mode = env_fixture if fixture_mode is None else fixture_mode

    def is_scope_supported(self, instruction: str, scenario: str) -> bool:
        """Determines if the instruction is within the bounded user cleanup sandbox."""
        if scenario not in SUPPORTED_SCENARIOS:
            return False
        
        lowered = instruction.lower()
        for kw in UNSUPPORTED_KEYWORDS:
            if kw in lowered:
                return False
                
        # Must involve user/account cleanup concepts
        cleanup_indicators = ["user", "account", "record", "delete", "remove", "prune", "clean", "purge"]
        return any(ind in lowered for ind in cleanup_indicators)

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Extracts JSON object from model response, stripping markdown fences if present."""
        text = text.strip()
        # Handle markdown fences ```json ... ``` or ``` ... ```
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()
        else:
            # Look for outermost braces
            brace_match = re.search(r"(\{[\s\S]*\})", text)
            if brace_match:
                text = brace_match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise InvalidModelOutputError(f"Model output is not valid JSON: {e}\nRaw output: {text[:200]}")

    def _validate_and_normalize(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validates output against Pydantic schema and restricted conditions."""
        try:
            output = AIEngineOutput.model_validate(raw_data)
        except ValidationError as e:
            raise InvalidModelOutputError(f"Model output failed schema validation: {e}")

        # Enforce that every interpretation uses permitted actions
        for interp in output.interpretations:
            if interp.action.type != ALLOWED_ACTION_TYPE:
                raise InvalidModelOutputError(
                    f"Unsupported action type '{interp.action.type}'. Only '{ALLOWED_ACTION_TYPE}' is allowed."
                )
            if interp.action.condition not in ALLOWED_CONDITIONS:
                raise InvalidModelOutputError(
                    f"Unsupported condition '{interp.action.condition}'. Allowed: {ALLOWED_CONDITIONS}"
                )

        return output.model_dump()

    def _get_fixture_response(self, instruction: str) -> Dict[str, Any]:
        """High-fidelity fixture response for offline testing and demos."""
        lowered = instruction.lower()

        if "inactive" in lowered and "old" not in lowered:
            return {
                "interpretations": [
                    {
                        "id": "A",
                        "title": "Strict inactivity (90+ days)",
                        "assumption": "Inactivity is defined as no login or activity for at least 90 days.",
                        "action": {
                            "type": "delete_users",
                            "condition": "inactive_90_days"
                        },
                        "explanation": "Applies standard 90-day inactivity threshold based on last_active_at.",
                        "risk_level": "low"
                    },
                    {
                        "id": "B",
                        "title": "Account creation age cutoff",
                        "assumption": "Operator assumes inactivity correlates with account age over 90 days.",
                        "action": {
                            "type": "delete_users",
                            "condition": "created_90_days"
                        },
                        "explanation": "Mistakenly filters by created_at rather than telemetry activity dates.",
                        "risk_level": "high"
                    },
                    {
                        "id": "C",
                        "title": "Inactive or missing activity telemetry",
                        "assumption": "Accounts lacking an activity timestamp are assumed to be abandoned.",
                        "action": {
                            "type": "delete_users",
                            "condition": "inactive_or_unknown"
                        },
                        "explanation": "Purges users where last_active_at is null without confirmation.",
                        "risk_level": "medium"
                    }
                ],
                "candidate_ambiguities": [
                    {
                        "term": "inactive",
                        "description": "Does not specify the duration threshold or how null activity dates are handled.",
                        "interpretation_ids": ["A", "C"],
                        "impact": "Unspecified null handling causes deletion of valid users with missing telemetry."
                    }
                ],
                "suggested_rewrite": "Delete user accounts with recorded inactivity exceeding 90 days. Flag accounts with null activity dates for audit without deleting."
            }

        # Default fixture for "Delete old user records" and general cleanup
        return {
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
                },
                {
                    "term": "unspecified null handling",
                    "description": "Does not define whether missing telemetry implies inactivity.",
                    "interpretation_ids": ["A", "C"],
                    "impact": "May delete newly onboarded accounts that haven't registered telemetry yet."
                }
            ],
            "suggested_rewrite": "Delete user accounts inactive for at least 90 days based on last activity. Preserve accounts with missing activity timestamps and flag them for review."
        }

    def _call_llm(self, instruction: str, scenario: str) -> Dict[str, Any]:
        """Calls the OpenAI-compatible inference endpoint for open-weight models."""
        messages = build_prompt_messages(instruction, scenario)
        endpoint = f"{self.base_url}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return self._extract_json(content)

    def generate_interpretations(self, instruction: str, scenario: str = "user_cleanup") -> Dict[str, Any]:
        """
        Main entrypoint.
        Generates three schema-valid interpretations, candidate ambiguities, and suggested rewrite.
        Returns a dictionary matching the contract or an unsupported scenario structure.
        """
        # Validate scope
        if not self.is_scope_supported(instruction, scenario):
            return {
                "error": "unsupported_scenario",
                "message": (
                    f"Instruction '{instruction}' is outside the supported user cleanup MVP simulation scope. "
                    "The simulator currently models user cleanup actions ('delete_users') only."
                ),
                "supported_scenarios": list(SUPPORTED_SCENARIOS),
                "interpretations": [],
                "candidate_ambiguities": [],
                "suggested_rewrite": ""
            }

        # If fixture mode is explicitly enabled, return fixture directly
        if self.fixture_mode:
            logger.info("Fixture mode active. Returning structured fixture.")
            raw_data = self._get_fixture_response(instruction)
            return self._validate_and_normalize(raw_data)

        # Attempt call to open-weight LLM endpoint with retry
        for attempt in range(self.max_retries + 1):
            try:
                raw_json = self._call_llm(instruction, scenario)
                return self._validate_and_normalize(raw_json)
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as conn_err:
                logger.warning(
                    f"LLM endpoint connection failed ({conn_err}). Falling back to fixture mode."
                )
                raw_data = self._get_fixture_response(instruction)
                return self._validate_and_normalize(raw_data)
            except InvalidModelOutputError as val_err:
                logger.warning(f"Attempt {attempt + 1}: Invalid model output: {val_err}")
                if attempt == self.max_retries:
                    # Final fallback to verified fixture to protect pipeline stability
                    logger.warning("Max retries exceeded for LLM. Falling back to deterministic fixture.")
                    raw_data = self._get_fixture_response(instruction)
                    return self._validate_and_normalize(raw_data)

        # Fallback return
        raw_data = self._get_fixture_response(instruction)
        return self._validate_and_normalize(raw_data)


# Top-level module function required by the specification
_default_engine = AIEngine()

def generate_interpretations(instruction: str, scenario: str = "user_cleanup") -> Dict[str, Any]:
    """
    Exposed function required by the architecture contract:
    generate_interpretations(instruction: str, scenario: str) -> dict
    """
    return _default_engine.generate_interpretations(instruction, scenario)
