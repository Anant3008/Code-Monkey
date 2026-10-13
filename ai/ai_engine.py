import json
import logging
import os
import re
import sys
import time
from copy import deepcopy
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Literal, Set, Tuple

from pydantic import BaseModel, Field, field_validator, ValidationError
from openai import OpenAI, APIError, APITimeoutError, AuthenticationError, RateLimitError

try:
    from ai.prompts import (
        build_analysis_messages,
        build_generic_analyze_messages,
        build_world_gen_messages,
        build_rewrite_messages,
        SYSTEM_PROMPT
    )
    from ai.plan_schema import (
        EntitySchema,
        World,
        BranchPlan,
        AmbiguousTerm,
        OperationTemplate,
        GenericAnalysisOutput,
        parse_predicate,
        validate_predicate_limits,
        validate_predicate_schema
    )
except ImportError:
    from prompts import (
        build_analysis_messages,
        build_generic_analyze_messages,
        build_world_gen_messages,
        build_rewrite_messages,
        SYSTEM_PROMPT
    )
    from plan_schema import (
        EntitySchema,
        World,
        BranchPlan,
        AmbiguousTerm,
        OperationTemplate,
        GenericAnalysisOutput,
        parse_predicate,
        validate_predicate_limits,
        validate_predicate_schema
    )

logger = logging.getLogger("semantic_chaos_monkey.ai_engine")

# ---------------------------------------------------------------------------
# Constants & Allowlisted Definitions
# ---------------------------------------------------------------------------

ALLOWED_ACTION_TYPE = "delete_users"
ALLOWED_CONDITIONS = {"inactive_90_days", "created_90_days", "inactive_or_unknown"}
SUPPORTED_SCENARIOS = {"user_cleanup"}
UNSUPPORTED_KEYWORDS = ["drop table", "drop database", "restart", "deploy", "server", "format disk"]
FIXED_TODAY = "2026-10-13"


class AIEngineError(Exception):
    """Base exception for Semantic Chaos Monkey AI Engine failures."""
    pass


# ---------------------------------------------------------------------------
# Hardcoded Legacy Validation Schemas (Pydantic)
# ---------------------------------------------------------------------------

class LegacyActionSchema(BaseModel):
    type: Literal["delete_users"]
    condition: Literal["inactive_90_days", "created_90_days", "inactive_or_unknown"]


class LegacyInterpretationSchema(BaseModel):
    id: Literal["A", "B", "C"]
    title: str = Field(..., min_length=1)
    assumption: str = Field(..., min_length=5)
    action: LegacyActionSchema
    explanation: str = Field(..., min_length=5)


class LegacyCandidateAmbiguitySchema(BaseModel):
    term: str = Field(..., min_length=1)
    description: str = Field(..., min_length=5)
    interpretation_ids: List[Literal["A", "B", "C"]] = Field(..., min_length=1)


class ModelInfoSchema(BaseModel):
    model: str
    mode: Literal["live", "fixture"]


# ---------------------------------------------------------------------------
# Generic Predicate Normalization and Substitution Helpers
# ---------------------------------------------------------------------------

def normalize_predicate_dict(pred: Dict[str, Any]) -> Dict[str, Any]:
    """Returns a canonicalized dictionary representation of a predicate for deduplication."""
    op = pred.get("op")
    if op in ("and", "or"):
        args = [normalize_predicate_dict(a) for a in pred.get("args", [])]
        args_sorted = sorted(args, key=lambda x: json.dumps(x, sort_keys=True))
        return {"op": op, "args": args_sorted}
    elif op == "not":
        return {"op": "not", "arg": normalize_predicate_dict(pred.get("arg", {}))}
    return deepcopy(pred)


def substitute_term_refs(where_tree: Dict[str, Any], chosen_meanings: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Recursively replaces any {"op": "term_ref", "term": T} with the chosen meaning's predicate."""
    op = where_tree.get("op")
    if op == "term_ref":
        term = where_tree.get("term")
        if term in chosen_meanings:
            return deepcopy(chosen_meanings[term])
        raise ValueError(f"Unresolved term_ref('{term}') - no chosen meaning provided.")
    elif op in ("and", "or"):
        return {
            "op": op,
            "args": [substitute_term_refs(a, chosen_meanings) for a in where_tree.get("args", [])]
        }
    elif op == "not":
        return {
            "op": "not",
            "arg": substitute_term_refs(where_tree.get("arg", {}), chosen_meanings)
        }
    return deepcopy(where_tree)


# ---------------------------------------------------------------------------
# AI Engine
# ---------------------------------------------------------------------------

class AIEngine:
    """
    Hybrid AI Engine for Semantic Chaos Monkey:
    1. Primary Generic Pipeline: Arbitrary instructions -> Entity Schema -> World -> Branches (Cap 8).
    2. Reliable Demo Fallback: Hardcoded user_cleanup path + deterministic fixtures.
    3. Source Labeling: Every result carries source ("live_generic", "live_hardcoded", "fixture_fallback").
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
        total_budget_seconds: Optional[float] = None,
        client: Optional[OpenAI] = None
    ):
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", "https://inference.do-ai.run/v1")).rstrip("/")
        self.model = model or os.getenv("LLM_MODEL", "qwen2.5:7b")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.timeout = float(timeout or os.getenv("LLM_TIMEOUT_SECONDS", "60.0"))
        self.max_retries = int(max_retries or os.getenv("LLM_MAX_RETRIES", "2"))
        self.max_tokens = int(max_tokens or os.getenv("LLM_MAX_TOKENS", "2000"))
        self.temperature = float(temperature or os.getenv("LLM_TEMPERATURE", "0.4"))
        self.total_budget = float(total_budget_seconds or os.getenv("LLM_TOTAL_BUDGET_SECONDS", "45.0"))

        # Demo switch flags
        env_fixture = os.getenv("CHAOS_FIXTURE_MODE", "").lower() in ("true", "1", "yes")
        env_force = os.getenv("CHAOS_FORCE_FALLBACK", "").lower() in ("true", "1", "yes")
        self.force_fallback = env_force
        if fixture_mode is not None:
            self.fixture_mode = fixture_mode
        elif env_fixture or not self.api_key or env_force:
            self.fixture_mode = True
        else:
            self.fixture_mode = False

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
        current_dir = Path(__file__).resolve().parent
        fixture_path = current_dir / "fixtures" / "ai_fixtures.json"
        if fixture_path.exists():
            try:
                with open(fixture_path, "r", encoding="utf-8") as f:
                    self._fixtures = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load fixtures: {e}")
                self._fixtures = {}
        else:
            self._fixtures = {}
        return self._fixtures

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Strips markdown fences and surrounding prose."""
        if not raw_text or not raw_text.strip():
            raise AIEngineError("Model emitted empty response.")

        text = raw_text.strip()
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()
        else:
            brace_match = re.search(r"(\{[\s\S]*\})", text)
            if brace_match:
                text = brace_match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as err:
            raise AIEngineError(f"Malformed JSON: {err}. Snippet: {text[:150]}")

    def is_user_cleanup(self, instruction: str) -> bool:
        """Determines if an instruction conceptually maps to user/account cleanup."""
        lowered = instruction.lower()
        user_words = ["user", "account", "customer", "member"]
        clean_words = ["delete", "remove", "clean", "purge", "prune", "inactive", "old"]
        return any(u in lowered for u in user_words) and any(c in lowered for c in clean_words)

    # -----------------------------------------------------------------------
    # Edge-Case Injection Algorithm (Code)
    # -----------------------------------------------------------------------

    def inject_world_edge_cases(self, entity_schema: EntitySchema, base_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deterministically injects edge cases into the fictional world:
        1. Null values on referenced date fields.
        2. Boundary records at exact threshold (e.g. 90 days ago).
        3. A guaranteed no-match record.
        Capped at 14 records total.
        """
        records = list(base_records)[:9]  # reserve room for edge cases
        date_fields = [f.name for f in entity_schema.fields if f.type == "date"]
        today = date.fromisoformat(FIXED_TODAY)

        # 1. Null date record
        if date_fields:
            target_df = date_fields[-1]
            null_rec = {"id": f"INJ-NULL-01", "_injected": True}
            for f in entity_schema.fields:
                if f.name == "id":
                    continue
                elif f.name == target_df:
                    null_rec[f.name] = None
                elif f.type == "string":
                    null_rec[f.name] = "null_edge_case"
                elif f.type in ("int", "float"):
                    null_rec[f.name] = 0
                elif f.type == "bool":
                    null_rec[f.name] = False
                elif f.type == "date":
                    null_rec[f.name] = (today - timedelta(days=120)).isoformat()
            records.append(null_rec)

        # 2. Boundary record (exact 90-day threshold)
        if date_fields:
            boundary_df = date_fields[0]
            boundary_date = (today - timedelta(days=90)).isoformat()
            boundary_rec = {"id": "INJ-BOUND-90", "_injected": True}
            for f in entity_schema.fields:
                if f.name == "id":
                    continue
                elif f.name == boundary_df:
                    boundary_rec[f.name] = boundary_date
                elif f.type == "string":
                    boundary_rec[f.name] = "exact_boundary"
                elif f.type in ("int", "float"):
                    boundary_rec[f.name] = 10
                elif f.type == "bool":
                    boundary_rec[f.name] = True
                elif f.type == "date":
                    boundary_rec[f.name] = (today - timedelta(days=10)).isoformat()
            records.append(boundary_rec)

        # 3. Guaranteed no-match record (brand new today)
        nomatch_rec = {"id": "INJ-NOMATCH-01", "_injected": True}
        for f in entity_schema.fields:
            if f.name == "id":
                continue
            elif f.type == "date":
                nomatch_rec[f.name] = today.isoformat()
            elif f.type == "string":
                nomatch_rec[f.name] = "active_fresh"
            elif f.type in ("int", "float"):
                nomatch_rec[f.name] = 100
            elif f.type == "bool":
                nomatch_rec[f.name] = True
        records.append(nomatch_rec)

        # Enforce unique IDs and cap at 14
        seen_ids = set()
        final_records = []
        for r in records[:14]:
            rid = r.get("id")
            if rid in seen_ids:
                rid = f"{rid}-dup"
                r["id"] = rid
            seen_ids.add(rid)
            final_records.append(r)

        return final_records

    # -----------------------------------------------------------------------
    # Branch Builder (Pure Code)
    # -----------------------------------------------------------------------

    def build_branches(
        self,
        ambiguous_terms: List[AmbiguousTerm],
        operation_template: OperationTemplate,
        field_types: Dict[str, str]
    ) -> Tuple[List[BranchPlan], List[str]]:
        """
        Combines term meanings into deterministic branch plans:
        - Baseline combination first.
        - Vary one term at a time.
        - Pairwise combinations.
        - Cap at 8 branches (IDs A..H).
        - Structural deduplication of predicates.
        """
        warnings = []
        if not ambiguous_terms:
            warnings.append("no ambiguity found; single baseline branch generated")
            resolved_where = substitute_term_refs(operation_template.where_template, {})
            validate_predicate_limits(parse_predicate(resolved_where))
            validate_predicate_schema(parse_predicate(resolved_where), field_types, allow_term_ref=False)
            plan = BranchPlan(
                id="A",
                title="Baseline Execution",
                assumption="Standard reading without ambiguity",
                operation=operation_template.operation,
                update_set=operation_template.update_set,
                where=resolved_where,
                chosen_meanings={},
                explanation="Executes operation directly."
            )
            return [plan], warnings

        combinations = []
        
        # 1. Baseline: First meaning of each term
        baseline_combo = {t.term: t.meanings[0] for t in ambiguous_terms}
        combinations.append(baseline_combo)

        # 2. Vary one term at a time
        for term_obj in ambiguous_terms:
            for meaning in term_obj.meanings[1:]:
                combo = dict(baseline_combo)
                combo[term_obj.term] = meaning
                combinations.append(combo)

        # 3. Combinations across multiple terms if available
        if len(ambiguous_terms) > 1:
            for t1_m in ambiguous_terms[0].meanings[1:]:
                for t2_m in ambiguous_terms[1].meanings[1:]:
                    combo = dict(baseline_combo)
                    combo[ambiguous_terms[0].term] = t1_m
                    combo[ambiguous_terms[1].term] = t2_m
                    combinations.append(combo)

        # Build BranchPlans with deduplication
        branch_ids = ["A", "B", "C", "D", "E", "F", "G", "H"]
        seen_predicates = set()
        branches = []

        for combo in combinations:
            if len(branches) >= 8:
                break

            meaning_pred_map = {term: m.predicate for term, m in combo.items()}
            meaning_id_map = {term: m.id for term, m in combo.items()}

            # Resolve template
            resolved_where = substitute_term_refs(operation_template.where_template, meaning_pred_map)
            
            # Normalize and dedup
            normalized = normalize_predicate_dict(resolved_where)
            norm_key = json.dumps(normalized, sort_keys=True)
            if norm_key in seen_predicates:
                continue
            seen_predicates.add(norm_key)

            # Validate limits and schema
            parsed = parse_predicate(resolved_where)
            validate_predicate_limits(parsed, max_depth=4, max_nodes=12)
            validate_predicate_schema(parsed, field_types, allow_term_ref=False)

            bid = branch_ids[len(branches)]
            titles = [f"{t}: {m.label}" for t, m in combo.items()]
            assumptions = [m.assumption for t, m in combo.items()]

            branch = BranchPlan(
                id=bid,
                title="; ".join(titles),
                assumption="; ".join(assumptions),
                operation=operation_template.operation,
                update_set=operation_template.update_set,
                where=resolved_where,
                chosen_meanings=meaning_id_map,
                explanation=f"Branch {bid} tests the assumption combination: {'; '.join(assumptions)}."
            )
            branches.append(branch)

        if len(branches) <= 1:
            warnings.append("no ambiguity found; do not invent variety")

        return branches, warnings

    # -----------------------------------------------------------------------
    # Generic Pipeline Execution
    # -----------------------------------------------------------------------

    def _execute_generic_pipeline(self, instruction: str) -> Dict[str, Any]:
        """Executes LLM Analyze -> World -> Code Edge Cases -> Branch Builder."""
        client = self._get_client()

        # Step 1: Analyze
        analyze_messages = build_generic_analyze_messages(instruction)
        resp = client.chat.completions.create(
            model=self.model,
            messages=analyze_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            response_format={"type": "json_object"}
        )
        content = resp.choices[0].message.content or ""
        parsed = self._clean_and_parse_json(content)

        if parsed.get("status") == "unsupported":
            return {
                "status": "unsupported",
                "reason": parsed.get("reason", "Instruction unsupported by generic analyzer."),
                "source": "live_generic",
                "fallback_reason": None,
                "model_info": {"model": self.model, "mode": "live"}
            }

        # Validate analyzed structure
        analysis_out = GenericAnalysisOutput.model_validate(parsed)
        field_types = analysis_out.entity_schema.get_field_types()

        # Step 2: Generate World Records via LLM
        world_messages = build_world_gen_messages(
            analysis_out.entity_schema.name,
            [f.model_dump() for f in analysis_out.entity_schema.fields]
        )
        world_resp = client.chat.completions.create(
            model=self.model,
            messages=world_messages,
            temperature=self.temperature,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        world_content = world_resp.choices[0].message.content or ""
        parsed_world = self._clean_and_parse_json(world_content)
        base_records = parsed_world.get("records", [])
        if not base_records:
            base_records = [{"id": f"REC-0{i}", analysis_out.entity_schema.fields[0].name: f"item-{i}"} for i in range(1, 9)]

        # Step 3: Inject Code Edge Cases
        injected_records = self.inject_world_edge_cases(analysis_out.entity_schema, base_records)
        world = World(
            entity=analysis_out.entity_schema.name,
            today=FIXED_TODAY,
            records=injected_records
        )

        # Step 4: Combine Branches (Pure Code)
        branches, warnings = self.build_branches(
            analysis_out.ambiguous_terms,
            analysis_out.operation_template,
            field_types
        )

        return {
            "status": "ok",
            "source": "live_generic",
            "fallback_reason": None,
            "domain": analysis_out.domain,
            "entity_schema": analysis_out.entity_schema.model_dump(),
            "world": world.model_dump(),
            "branches": [b.model_dump() for b in branches],
            "ambiguous_terms": [t.model_dump() for t in analysis_out.ambiguous_terms],
            "suggested_rewrite": analysis_out.suggested_rewrite,
            "model_info": {"model": self.model, "mode": "live"},
            "warnings": warnings
        }

    # -----------------------------------------------------------------------
    # Conversion Bridge (Hardcoded A/B/C -> Plan Format)
    # -----------------------------------------------------------------------

    def convert_hardcoded_to_plan(self, hardcoded_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Converts legacy 3-condition output (A/B/C) into universal plan_schema format:
        Creates an EntitySchema for 'user', fixed 10-user World with edge cases,
        and BranchPlans using allowlisted older_than_days and is_null predicates.
        """
        out = dict(hardcoded_data)
        out["domain"] = "user_management"
        out["entity_schema"] = {
            "name": "user",
            "fields": [
                {"name": "id", "type": "string", "description": "Unique user ID"},
                {"name": "email", "type": "string", "description": "Email address"},
                {"name": "created_at", "type": "date", "description": "Account created timestamp"},
                {"name": "last_active_at", "type": "date", "description": "Last active timestamp"},
                {"name": "status", "type": "string", "description": "Account status"}
            ]
        }
        out["world"] = {
            "entity": "user",
            "today": FIXED_TODAY,
            "records": [
                {"id": "U01", "email": "alice@corp.com", "created_at": "2025-01-10", "last_active_at": "2026-10-10", "status": "active"},
                {"id": "U02", "email": "bob@dormant.com", "created_at": "2024-05-01", "last_active_at": "2026-05-01", "status": "dormant"},
                {"id": "U03", "email": "carol@active.org", "created_at": "2026-01-15", "last_active_at": "2026-10-12", "status": "active"},
                {"id": "U04", "email": "dave@old.io", "created_at": "2023-11-20", "last_active_at": "2026-01-10", "status": "dormant"},
                {"id": "U05", "email": "eve@recent.com", "created_at": "2026-09-01", "last_active_at": "2026-09-20", "status": "active"},
                {"id": "U06", "email": "frank@test.net", "created_at": "2025-08-14", "last_active_at": "2026-03-15", "status": "active"},
                {"id": "U07", "email": "grace@loyal.com", "created_at": "2024-02-11", "last_active_at": "2026-10-11", "status": "active"},
                {"id": "U08", "email": "heidi@edge.org", "created_at": "2026-07-15", "last_active_at": "2026-07-15", "status": "active", "_injected": True},
                {"id": "U09", "email": "ivan@null.com", "created_at": "2025-10-01", "last_active_at": None, "status": "pending", "_injected": True},
                {"id": "U10", "email": "judy@boundary.com", "created_at": "2026-07-15", "last_active_at": "2026-07-15", "status": "active", "_injected": True}
            ]
        }

        # Map A, B, C to BranchPlan
        branches = []
        for interp in hardcoded_data.get("interpretations", []):
            cid = interp["id"]
            cond = interp["action"]["condition"]
            if cond == "inactive_90_days":
                where_pred = {"op": "older_than_days", "field": "last_active_at", "days": 90}
            elif cond == "created_90_days":
                where_pred = {"op": "older_than_days", "field": "created_at", "days": 90}
            else:  # inactive_or_unknown
                where_pred = {
                    "op": "or",
                    "args": [
                        {"op": "older_than_days", "field": "last_active_at", "days": 90},
                        {"op": "is_null", "field": "last_active_at"}
                    ]
                }
            branches.append({
                "id": cid,
                "title": interp["title"],
                "assumption": interp["assumption"],
                "operation": "delete",
                "update_set": None,
                "where": where_pred,
                "chosen_meanings": {"old": cond},
                "explanation": interp["explanation"]
            })
        out["branches"] = branches
        return out

    # -----------------------------------------------------------------------
    # Existing Hardcoded Demo Path (PRESERVED UNCHANGED)
    # -----------------------------------------------------------------------

    def _call_hardcoded_model(self, instruction: str, scenario: str) -> Dict[str, Any]:
        """Calls the hardcoded demo path with bounded retries."""
        client = self._get_client()
        messages = build_analysis_messages(instruction, scenario)
        warnings = []
        last_error = ""

        for attempt in range(self.max_retries + 1):
            try:
                resp = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    response_format={"type": "json_object"}
                )
                content = resp.choices[0].message.content or ""
                parsed = self._clean_and_parse_json(content)

                # Validate exactly 3 interpretations
                interps = parsed.get("interpretations", [])
                if len(interps) != 3:
                    raise AIEngineError(f"Expected exactly 3 interpretations, got {len(interps)}")

                # Validate each interpretation against allowed action type and conditions
                seen_conditions = set()
                duplicates = []
                for interp in interps:
                    action = interp.get("action", {})
                    act_type = action.get("type")
                    act_cond = action.get("condition")
                    if act_type != ALLOWED_ACTION_TYPE:
                        raise AIEngineError(f"Invalid action type '{act_type}'. Allowed: '{ALLOWED_ACTION_TYPE}'")
                    if act_cond not in ALLOWED_CONDITIONS:
                        raise AIEngineError(f"Invalid condition '{act_cond}'. Allowed: {ALLOWED_CONDITIONS}")
                    if act_cond in seen_conditions and act_cond not in duplicates:
                        duplicates.append(act_cond)
                    seen_conditions.add(act_cond)

                if duplicates:
                    warnings.append("limited semantic divergence")

                parsed["status"] = "ok"
                parsed["source"] = "live_hardcoded"
                parsed["fallback_reason"] = None
                parsed["model_info"] = {"model": self.model, "mode": "live"}
                if warnings:
                    parsed["warnings"] = warnings
                return parsed
            except Exception as e:
                last_error = str(e)
                if attempt == self.max_retries:
                    raise AIEngineError(f"Hardcoded path failed after retries: {last_error}")
        raise AIEngineError(f"Hardcoded path failed: {last_error}")

    # Backward-compatibility alias
    _call_model_with_retries = _call_hardcoded_model

    def _get_fixture(self, instruction: str) -> Dict[str, Any]:
        """Retrieves deterministic fixture with honest 'fixture_fallback' label."""
        fixtures = self._load_fixtures()
        normalized = instruction.lower().strip()
        if not normalized.endswith("."):
            norm_dot = normalized + "."
        else:
            norm_dot = normalized

        match = fixtures.get(normalized) or fixtures.get(norm_dot)
        if match:
            res = deepcopy(match)
            res["source"] = "fixture_fallback"
            res["model_info"] = {"model": self.model, "mode": "fixture"}
            return res

        return {
            "status": "unsupported",
            "source": "fixture_fallback",
            "fallback_reason": f"No deterministic fixture exists for instruction '{instruction}'.",
            "reason": f"No deterministic fixture exists for instruction '{instruction}'.",
            "interpretations": [],
            "candidate_ambiguities": [],
            "branches": [],
            "suggested_rewrite": "",
            "model_info": {"model": self.model, "mode": "fixture"}
        }

    # -----------------------------------------------------------------------
    # Public Router: analyze_and_branch
    # -----------------------------------------------------------------------

    def analyze_and_branch(
        self,
        instruction: str,
        scenario: str = "auto",
        force_fallback: bool = False
    ) -> Dict[str, Any]:
        """
        Public Router for the Generic Pipeline with Labeled Fallbacks:
        1. If CHAOS_FORCE_FALLBACK=true or force_fallback=True or no API key -> fixture_fallback.
        2. Try live generic pipeline -> live_generic.
        3. If generic fails/times out -> fallback to hardcoded path (live_hardcoded or fixture_fallback).
        4. Budget enforcement with LLM_TOTAL_BUDGET_SECONDS.
        """
        start_time = time.time()

        # Step 1: Demo Switch / Fixture Check
        if self.force_fallback or force_fallback or self.fixture_mode or not self.api_key:
            res = self._get_fixture(instruction)
            res["source"] = "fixture_fallback"
            if force_fallback or self.force_fallback:
                res["fallback_reason"] = "CHAOS_FORCE_FALLBACK switch enabled"
            return res

        # Step 2: Try Generic Pipeline
        try:
            if time.time() - start_time > self.total_budget:
                raise AIEngineError("Exceeded total time budget before generic analysis.")

            generic_result = self._execute_generic_pipeline(instruction)
            if generic_result.get("status") == "ok":
                return generic_result
            fallback_err = generic_result.get("reason", "Generic analyzer returned unsupported.")
        except Exception as e:
            fallback_err = str(e)
            logger.warning(f"Generic pipeline failed ({fallback_err}). Initiating fallback routing.")

        # Step 3: Fallback Routing
        if self.is_user_cleanup(instruction) or scenario == "user_cleanup":
            try:
                if time.time() - start_time > self.total_budget:
                    raise AIEngineError("Exceeded total time budget.")
                hardcoded_live = self._call_hardcoded_model(instruction, "user_cleanup")
                hardcoded_plan = self.convert_hardcoded_to_plan(hardcoded_live)
                hardcoded_plan["source"] = "live_hardcoded"
                hardcoded_plan["fallback_reason"] = f"Generic pipeline failed ({fallback_err})"
                return hardcoded_plan
            except Exception as h_err:
                logger.warning(f"Live hardcoded path also failed ({h_err}). Falling back to fixtures.")

        fixture_res = self._get_fixture(instruction)
        if fixture_res.get("status") == "ok":
            fixture_res["source"] = "fixture_fallback"
            fixture_res["fallback_reason"] = f"Live models failed ({fallback_err})"
            return fixture_res

        return {
            "status": "unsupported",
            "source": "fixture_fallback",
            "fallback_reason": f"Generic pipeline failed: {fallback_err}. Instruction is outside known domains.",
            "reason": f"Instruction '{instruction}' is unsupported by the generic engine and has no demo fixture.",
            "interpretations": [],
            "candidate_ambiguities": [],
            "branches": [],
            "suggested_rewrite": "",
            "model_info": {"model": self.model, "mode": "fixture"}
        }

    # -----------------------------------------------------------------------
    # Rewrite Step (LLM, after simulation)
    # -----------------------------------------------------------------------

    def generate_rewrite(
        self,
        instruction: str,
        ambiguous_terms: List[Dict[str, Any]],
        outcomes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generates a clear, disambiguated rewrite after branches have been simulated.
        Outcomes are read-only evidence.
        """
        if self.fixture_mode or not self.api_key or self.force_fallback:
            return {
                "suggested_rewrite": f"Explicitly clarify thresholds and criteria for {', '.join(t.get('term', '') for t in ambiguous_terms)}.",
                "resolved_terms": [t.get("term", "") for t in ambiguous_terms]
            }

        client = self._get_client()
        messages = build_rewrite_messages(instruction, ambiguous_terms, outcomes)
        try:
            resp = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=600,
                response_format={"type": "json_object"}
            )
            content = resp.choices[0].message.content or ""
            return self._clean_and_parse_json(content)
        except Exception as e:
            logger.warning(f"Rewrite generation failed: {e}")
            return {
                "suggested_rewrite": f"Clarify thresholds, inclusion dates, and null handling for {instruction}.",
                "resolved_terms": [t.get("term", "") for t in ambiguous_terms]
            }

    # -----------------------------------------------------------------------
    # Backwards Compatibility: generate_interpretations
    # -----------------------------------------------------------------------

    def generate_interpretations(self, instruction: str, scenario: str = "user_cleanup") -> Dict[str, Any]:
        """Preserved hardcoded path with honest source labeling."""
        if self.force_fallback or self.fixture_mode or not self.api_key:
            res = self._get_fixture(instruction)
            res["source"] = "fixture_fallback"
            return res

        try:
            return self._call_hardcoded_model(instruction, scenario)
        except Exception as err:
            logger.warning(f"Live hardcoded call failed: {err}. Serving fixture.")
            fix = self._get_fixture(instruction)
            fix["fallback_reason"] = str(err)
            fix["source"] = "fixture_fallback"
            return fix


# ---------------------------------------------------------------------------
# Module-Level Exported Functions
# ---------------------------------------------------------------------------

_engine = AIEngine()

def analyze_and_branch(instruction: str, scenario: str = "auto", force_fallback: bool = False) -> Dict[str, Any]:
    """New Primary Hybrid Entry Point."""
    return _engine.analyze_and_branch(instruction, scenario, force_fallback)

def generate_interpretations(instruction: str, scenario: str = "user_cleanup") -> Dict[str, Any]:
    """Preserved Legacy Hardcoded Entry Point."""
    return _engine.generate_interpretations(instruction, scenario)

def generate_rewrite(instruction: str, ambiguous_terms: List[Dict[str, Any]], outcomes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Generates rewrite after simulation."""
    return _engine.generate_rewrite(instruction, ambiguous_terms, outcomes)


if __name__ == "__main__":
    test_inst = sys.argv[1] if len(sys.argv) > 1 else "Delete old user records."
    print("=== Semantic Chaos Monkey (Hybrid Pipeline) ===")
    print(f"Instruction: {test_inst}")
    out = analyze_and_branch(test_inst)
    print("\nResult:")
    print(json.dumps(out, indent=2))
