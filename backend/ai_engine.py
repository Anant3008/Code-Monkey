import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Literal, Set

from pydantic import BaseModel, Field, field_validator, ValidationError
from openai import OpenAI, APIError, APITimeoutError, AuthenticationError, RateLimitError

try:
    from backend.prompts import build_analysis_messages, SYSTEM_PROMPT
except ImportError:
    from prompts import build_analysis_messages, SYSTEM_PROMPT

logger = logging.getLogger("semantic_chaos_monkey.ai_engine")

# Hard Allowlist for Actions
ALLOWED_ACTION_TYPE = "delete_users"
ALLOWED_CONDITIONS = {"inactive_90_days", "created_90_days", "inactive_or_unknown"}
SUPPORTED_SCENARIOS = {"user_cleanup"}

# Keywords indicating out-of-scope instructions for MVP
UNSUPPORTED_KEYWORDS = ["backup", "restore", "drop table", "drop database", "restart", "deploy", "server", "payment"]


class AIEngineError(Exception):
    """Base exception for Semantic Chaos Monkey AI Engine failures."""
    pass


# ---------------------------------------------------------------------------
# Internal Pydantic Validation Models
# ---------------------------------------------------------------------------

class ActionSchema(BaseModel):
    type: Literal["delete_users"]
    condition: Literal["inactive_90_days", "created_90_days", "inactive_or_unknown"]


class InterpretationSchema(BaseModel):
    id: Literal["A", "B", "C"]
    title: str = Field(..., min_length=1)
    assumption: str = Field(..., min_length=5)
    action: ActionSchema
    explanation: str = Field(..., min_length=5)


class CandidateAmbiguitySchema(BaseModel):
    term: str = Field(..., min_length=1)
    description: str = Field(..., min_length=5)
    interpretation_ids: List[Literal["A", "B", "C"]] = Field(..., min_length=1)


class ModelInfoSchema(BaseModel):
    model: str
    mode: Literal["live", "fixture"]


class SuccessResponseSchema(BaseModel):
    status: Literal["ok"]
    interpretations: List[InterpretationSchema] = Field(..., min_length=3, max_length=3)
    candidate_ambiguities: List[CandidateAmbiguitySchema] = Field(..., min_length=1)
    suggested_rewrite: str = Field(..., min_length=5)
    model_info: ModelInfoSchema
    warnings: Optional[List[str]] = Field(default_factory=list)

    @field_validator("interpretations")
    @classmethod
    def validate_ids(cls, v: List[InterpretationSchema]) -> List[InterpretationSchema]:
        ids = [item.id for item in v]
        if set(ids) != {"A", "B", "C"}:
            raise ValueError(f"Interpretations must have IDs 'A', 'B', and 'C', got: {ids}")
        return v

    @field_validator("candidate_ambiguities")
    @classmethod
    def validate_ambiguity_ids(cls, v: List[CandidateAmbiguitySchema], info) -> List[CandidateAmbiguitySchema]:
        for amb in v:
            for iid in amb.interpretation_ids:
                if iid not in {"A", "B", "C"}:
                    raise ValueError(f"Invalid interpretation ID '{iid}' in ambiguity '{amb.term}'")
        return v


# ---------------------------------------------------------------------------
# AI Engine Implementation
# ---------------------------------------------------------------------------

class AIEngine:
    """
    Open-weight AI Engine for Semantic Chaos Monkey.
    Uses official OpenAI client, enforces hard allowlists, deduplicates interpretations,
    and supports deterministic fixture fallback.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        fixture_mode: Optional[bool] = None,
        client: Optional[OpenAI] = None
    ):
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", "https://inference.do-ai.run/v1")).rstrip("/")
        self.model = model or os.getenv("LLM_MODEL", "qwen2.5:7b")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.timeout = float(timeout or os.getenv("LLM_TIMEOUT_SECONDS", "60.0"))
        self.max_retries = int(max_retries or os.getenv("LLM_MAX_RETRIES", "2"))
        self.max_tokens = int(max_tokens or os.getenv("LLM_MAX_TOKENS", "2000"))
        self.temperature = float(temperature or os.getenv("LLM_TEMPERATURE", "0.4"))

        # Determine fixture mode
        env_fixture = os.getenv("CHAOS_FIXTURE_MODE", "").lower() in ("true", "1", "yes")
        if fixture_mode is not None:
            self.fixture_mode = fixture_mode
        elif env_fixture or not self.api_key:
            # If no API key configured or env set, use fixtures
            self.fixture_mode = True
        else:
            self.fixture_mode = False

        # Injected or default OpenAI client
        self._client = client
        self._fixtures: Optional[Dict[str, Any]] = None

    def _get_client(self) -> OpenAI:
        if self._client is not None:
            return self._client
        return OpenAI(
            base_url=self.base_url,
            api_key=self.api_key or "no-key",
            timeout=self.timeout
        )

    def _load_fixtures(self) -> Dict[str, Any]:
        if self._fixtures is not None:
            return self._fixtures
        # Search relative to this file
        current_dir = Path(__file__).resolve().parent
        fixture_path = current_dir / "fixtures" / "ai_fixtures.json"
        if not fixture_path.exists():
            fixture_path = current_dir.parent / "backend" / "fixtures" / "ai_fixtures.json"

        if fixture_path.exists():
            try:
                with open(fixture_path, "r", encoding="utf-8") as f:
                    self._fixtures = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load fixtures from {fixture_path}: {e}")
                self._fixtures = {}
        else:
            self._fixtures = {}
        return self._fixtures

    def is_scope_supported(self, instruction: str, scenario: str) -> bool:
        """Checks if the scenario and instruction are within the MVP user cleanup scope."""
        if scenario not in SUPPORTED_SCENARIOS:
            return False

        lowered = instruction.lower().strip()
        for kw in UNSUPPORTED_KEYWORDS:
            if kw in lowered:
                return False

        cleanup_indicators = ["user", "account", "record", "delete", "remove", "prune", "clean", "purge", "inactive"]
        return any(ind in lowered for ind in cleanup_indicators)

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Defensively strips markdown fences, reasoning blocks, and surrounding prose."""
        if not raw_text or not raw_text.strip():
            raise AIEngineError("Model emitted empty content.")

        text = raw_text.strip()
        # Strip markdown fences
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()
        else:
            # Match outermost curly braces
            brace_match = re.search(r"(\{[\s\S]*\})", text)
            if brace_match:
                text = brace_match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as err:
            raise AIEngineError(f"Malformed JSON from model: {err}. Snippet: {text[:150]}")

    def _validate_response(self, data: Dict[str, Any], mode: str) -> Dict[str, Any]:
        """Validates response against Pydantic schema and returns serialized dictionary."""
        # Check if model returned an unsupported status object
        if data.get("status") == "unsupported":
            return {
                "status": "unsupported",
                "reason": data.get("reason", "Instruction is outside the supported user cleanup scope."),
                "interpretations": [],
                "candidate_ambiguities": [],
                "suggested_rewrite": "",
                "model_info": {"model": self.model, "mode": mode}
            }

        data["model_info"] = {"model": self.model, "mode": mode}
        try:
            validated = SuccessResponseSchema.model_validate(data)
            return validated.model_dump()
        except ValidationError as err:
            raise AIEngineError(f"Response validation failed: {err}")

    def _detect_duplicate_conditions(self, interpretations: List[Dict[str, Any]]) -> List[str]:
        """Returns list of duplicate condition names if present."""
        seen = set()
        duplicates = []
        for interp in interpretations:
            cond = interp.get("action", {}).get("condition")
            if cond in seen and cond not in duplicates:
                duplicates.append(cond)
            seen.add(cond)
        return duplicates

    def _get_fixture(self, instruction: str) -> Dict[str, Any]:
        """Retrieves deterministic fixture for given instruction."""
        fixtures = self._load_fixtures()
        normalized = instruction.lower().strip()
        if not normalized.endswith("."):
            normalized_with_dot = normalized + "."
        else:
            normalized_with_dot = normalized

        match = fixtures.get(normalized) or fixtures.get(normalized_with_dot)
        if match:
            # Validate fixture using the same schema
            validated = self._validate_response(dict(match), mode="fixture")
            return validated

        return {
            "status": "unsupported",
            "reason": (
                f"No deterministic fixture exists for instruction '{instruction}' in fixture mode. "
                "Available fixtures: 'Delete old user records.', 'Remove inactive users.', 'Restore the latest backup if necessary.'"
            ),
            "interpretations": [],
            "candidate_ambiguities": [],
            "suggested_rewrite": "",
            "model_info": {"model": self.model, "mode": "fixture"}
        }

    def _call_model_with_retries(self, instruction: str, scenario: str) -> Dict[str, Any]:
        """Executes live chat completion with bounded retries and validation feedback."""
        client = self._get_client()
        messages = build_analysis_messages(instruction, scenario)
        last_error = ""
        warnings = []

        for attempt in range(self.max_retries + 1):
            if attempt > 0:
                # Add validation feedback to conversation for retry
                messages.append({
                    "role": "user",
                    "content": f"Your previous response had a validation error: {last_error}. Please correct it and output strictly valid JSON conforming to the schema with 3 distinct conditions."
                })

            try:
                # Attempt completion with response_format, fallback if unsupported
                try:
                    response = client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens,
                        response_format={"type": "json_object"}
                    )
                except Exception as rf_err:
                    logger.info(f"JSON response_format not supported ({rf_err}), attempting standard call.")
                    response = client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens
                    )

                choice = response.choices[0]
                content = choice.message.content or ""
                parsed = self._clean_and_parse_json(content)

                # Check for duplicate conditions across branches
                interps = parsed.get("interpretations", [])
                duplicates = self._detect_duplicate_conditions(interps)
                if duplicates and attempt < self.max_retries:
                    last_error = f"Interpretations use duplicate condition(s): {duplicates}. Each branch must test a distinct condition."
                    continue
                elif duplicates:
                    warnings.append("limited semantic divergence")

                # Validate
                parsed["status"] = "ok"
                validated = self._validate_response(parsed, mode="live")
                if warnings:
                    validated["warnings"] = warnings
                return validated

            except (APITimeoutError, TimeoutError) as e:
                last_error = f"LLM request timed out after {self.timeout}s: {e}"
                logger.warning(last_error)
            except AuthenticationError as e:
                # Do not retry auth errors
                raise AIEngineError(f"Authentication failed with LLM endpoint (401/403). Check LLM_API_KEY. Details: {e}")
            except RateLimitError as e:
                last_error = f"Rate limit encountered (429): {e}"
                logger.warning(last_error)
            except APIError as e:
                last_error = f"OpenAI API error: {e}"
                logger.warning(last_error)
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempt + 1} failed: {e}")

        # If retries exhausted, raise custom error
        raise AIEngineError(f"AI Engine failed after {self.max_retries + 1} attempts. Last error: {last_error}")

    def generate_interpretations(self, instruction: str, scenario: str = "user_cleanup") -> Dict[str, Any]:
        """
        Public engine method matching required contract:
        generate_interpretations(instruction: str, scenario: str) -> dict
        """
        # 1. Scenario scope check
        if scenario != "user_cleanup":
            return {
                "status": "unsupported",
                "reason": f"Scenario '{scenario}' is unsupported. Only 'user_cleanup' is currently simulated in MVP.",
                "interpretations": [],
                "candidate_ambiguities": [],
                "suggested_rewrite": "",
                "model_info": {"model": self.model, "mode": "fixture" if self.fixture_mode else "live"}
            }

        # 2. Instruction scope check
        if not self.is_scope_supported(instruction, scenario):
            return {
                "status": "unsupported",
                "reason": (
                    f"Instruction '{instruction}' is outside the supported user cleanup MVP simulation scope. "
                    "The simulator models user cleanup actions ('delete_users') only."
                ),
                "interpretations": [],
                "candidate_ambiguities": [],
                "suggested_rewrite": "",
                "model_info": {"model": self.model, "mode": "fixture" if self.fixture_mode else "live"}
            }

        # 3. Fixture mode branch
        if self.fixture_mode:
            return self._get_fixture(instruction)

        # 4. Live model branch with retries
        try:
            return self._call_model_with_retries(instruction, scenario)
        except AIEngineError as err:
            logger.error(f"Live model call failed: {err}. Falling back to fixture mode if available.")
            fixture_res = self._get_fixture(instruction)
            if fixture_res.get("status") == "ok":
                fixture_res["warnings"] = [f"live call failed ({err}); served deterministic fixture"]
                return fixture_res
            return {
                "status": "error",
                "reason": str(err),
                "interpretations": [],
                "candidate_ambiguities": [],
                "suggested_rewrite": "",
                "model_info": {"model": self.model, "mode": "live"}
            }


# Default module instance and exported function
_engine = AIEngine()

def generate_interpretations(instruction: str, scenario: str = "user_cleanup") -> Dict[str, Any]:
    """
    Exported function required by Person 3:
    generate_interpretations(instruction: str, scenario: str) -> dict
    """
    return _engine.generate_interpretations(instruction, scenario)


# CLI Entry Point for manual testing
if __name__ == "__main__":
    test_instruction = sys.argv[1] if len(sys.argv) > 1 else "Delete old user records."
    test_scenario = sys.argv[2] if len(sys.argv) > 2 else "user_cleanup"
    print(f"=== Semantic Chaos Monkey AI Engine ===")
    print(f"Instruction: {test_instruction}")
    print(f"Scenario:    {test_scenario}")
    output = generate_interpretations(test_instruction, test_scenario)
    print("\nResult:")
    print(json.dumps(output, indent=2))
