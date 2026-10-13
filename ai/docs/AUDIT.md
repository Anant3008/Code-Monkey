# Comprehensive AI Engine Audit: Semantic Chaos Monkey

**Audited Files:**
- `ai/ai_engine.py`
- `ai/plan_schema.py`
- `ai/prompts.py`
- `ai/tests/test_ai_engine.py`
- `ai/fixtures/ai_fixtures.json`
- `ai/schemas.py`
- `ai/.env.example`

---

## 1. Is `world.today` a fixed constant or does it come from the system clock?

**Answer:** `world.today` is a **fixed constant** (`"2026-10-13"`). It never comes from the system clock (`datetime.now()` or `date.today()`).

**File & Line References:**
- [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L210): `World.today` field definition sets a fixed default: `today: str = Field(default="2026-10-13", description="Fixed reference date for reproducibility (YYYY-MM-DD)")`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L64): Module constant defined as `FIXED_TODAY = "2026-10-13"`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L250): `inject_world_edge_cases()` initializes reference date from the constant: `today = date.fromisoformat(FIXED_TODAY)`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L480): `_execute_generic_pipeline()` creates `World(entity=..., today=FIXED_TODAY, records=injected_records)`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L529): `convert_hardcoded_to_plan()` sets `"today": FIXED_TODAY`.
- [ai/prompts.py](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L258): `WORLD_GEN_PROMPT` instructs LLM: `Reference date today is fixed at: 2026-10-13.`
- [ai/prompts.py](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L270): `build_world_gen_messages()` passes `"today": "2026-10-13"`.
- [ai/fixtures/ai_fixtures.json](file:///e:/Monkey/Code-Monkey/ai/fixtures/ai_fixtures.json#L19): Static fixtures use `"today": "2026-10-13"`.

---

## 2. Is each LLM call's timeout capped by the REMAINING total budget, or only by `LLM_TIMEOUT_SECONDS`? Can retries push total time past `LLM_TOTAL_BUDGET_SECONDS`?

**Answer:** 
- Each LLM call's timeout is **only capped by `LLM_TIMEOUT_SECONDS`** (configured on the OpenAI client), **not** by the remaining total budget.
- **Yes, retries and multi-step calls can push the total elapsed time past `LLM_TOTAL_BUDGET_SECONDS`.**

**File & Line References:**
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L165-L169): Default per-call timeout is `60.0s` (`LLM_TIMEOUT_SECONDS`), whereas `self.total_budget` is `45.0s` (`LLM_TOTAL_BUDGET_SECONDS`). Note that individual timeout actually exceeds the total budget default!
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L188-L192): `_get_client()` sets `timeout=self.timeout` statically on the OpenAI client instance.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L435-L441): Generic analyze call executes `client.chat.completions.create(...)` without passing a per-call timeout derived from `remaining = total_budget - elapsed`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L463-L469): Second step (world generation) also executes without a remaining-budget timeout override.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L585-L631): In `_call_hardcoded_model()`, the retry loop runs up to `self.max_retries + 1` times. It never checks `total_budget` inside the loop. If each attempt takes up to 60s, three attempts can block for 180 seconds.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L693-L694) & [Line 707-708](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L707-L708): In `analyze_and_branch()`, `time.time() - start_time > self.total_budget` is only checked *prior* to starting a phase, not within active calls or loops.

---

## 3. Does the validator reject `update_set` keys that are not in the entity schema? Does it check value types?

**Answer:** **No.** The validator does **not** check `update_set` keys against the entity schema, and does **not** check value types for `update_set`.

**File & Line References:**
- [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L240): `OperationTemplate` defines `update_set: Optional[Dict[str, Any]] = None` without field key or value validation.
- [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L249): `BranchPlan` defines `update_set: Optional[Dict[str, Any]] = None` without validators.
- [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L157-L182): `validate_predicate_schema(p: Predicate, field_types: Dict[str, str], allow_term_ref: bool = False)` only inspects predicate AST nodes (`ComparePredicate`, `OlderThanDaysPredicate`, etc.). It does not accept or inspect `update_set`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L400-L417): In `build_branches()`, `operation_template.update_set` is passed straight into `BranchPlan` at line 413 without comparing keys against `field_types` or verifying that assigned values match the declared schema types.

---

## 4. Does validation reject: unknown operation, unknown predicate op, unknown field, operator/type mismatch, depth > 4, nodes > 12, leftover `term_ref` in final branches, duplicate branch IDs?

**Detailed Breakdown:**

| Item | Status | Mechanism & File / Line References |
| :--- | :---: | :--- |
| **Unknown operation** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L17): `AllowedOperation = Literal["delete", "archive", "update", "flag", "restore"]` used in `OperationTemplate` (line 238) and `BranchPlan` (line 248). Non-matching operations fail Pydantic validation. Tested in [test_ai_engine.py:L407-L419](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L407-L419). |
| **Unknown predicate op** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L101-L128): `parse_predicate()` explicitly raises `ValueError(f"Unknown or forbidden predicate operator: '{op}'")` at line 128. Tested in [test_ai_engine.py:L421-L426](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L421-L426). |
| **Unknown field** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L165-L167): `validate_predicate_schema()` checks `if p.field not in field_types: raise ValueError(...)`. Tested in [test_ai_engine.py:L428-L435](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L428-L435). |
| **Operator/type mismatch** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L169-L176): Checks that `older_than_days`/`newer_than_days` are strictly on `"date"` fields, and relational comparisons (`lt`, `lte`, `gt`, `gte`) are on `"int"`, `"float"`, or `"date"`. Tested in [test_ai_engine.py:L437-L444](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L437-L444). |
| **Depth > 4** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L148-L152): `validate_predicate_limits()` checks `if depth > max_depth: raise ValueError(...)` with `max_depth=4`. Tested in [test_ai_engine.py:L446-L453](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L446-L453). |
| **Nodes > 12** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L153-L155): `validate_predicate_limits()` checks `if nodes > max_nodes: raise ValueError(...)` with `max_nodes=12`. Tested in [test_ai_engine.py:L446-L453](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L446-L453). |
| **Leftover `term_ref` in final branches** | **REJECTED** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L159-L162): `validate_predicate_schema()` raises `ValueError(f"Unresolved term_ref('{p.term}') found in executable branch plan")` when `allow_term_ref=False`. Called at [ai_engine.py:L402](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L402). Tested in [test_ai_engine.py:L455-L462](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L455-L462). |
| **Duplicate branch IDs** | **NOT REJECTED BY VALIDATOR** | [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L244-L253): `BranchPlan` validates only individual branch instances (`id: str = Field(..., min_length=1, max_length=4)`). There is no list-level Pydantic schema or validator function asserting unique branch IDs across a collection. Note that `ai_engine.py` generates unique IDs procedurally using index lookups into `["A", "B", ...]` ([Line 404](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L404)), but the validation layer itself does not enforce or reject duplicates if provided externally. |

---

## 5. How is the model ID configured? Is `"qwen2.5:7b"` hardcoded anywhere as a default?

**Answer:**
- The model ID is configured via the `model` constructor parameter of `AIEngine` or the `LLM_MODEL` environment variable.
- **Yes, `"qwen2.5:7b"` is hardcoded as a fallback default string** on line 163 of `ai/ai_engine.py`.

**File & Line References:**
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L152): `__init__(..., model: Optional[str] = None, ...)`
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L163): `self.model = model or os.getenv("LLM_MODEL", "qwen2.5:7b")` (hardcoded fallback default).
- [ai/.env.example](file:///e:/Monkey/Code-Monkey/ai/.env.example#L7) & [Line 17](file:///e:/Monkey/Code-Monkey/ai/.env.example#L17): Declares `LLM_MODEL=qwen2.5:7b`.

---

## 6. What does `"restore"` do in `plan_schema`, `prompts` and `fixtures`?

**Answer:**
There is a **design mismatch** regarding `"restore"` across the codebase:
1. In `plan_schema.py`, `"restore"` is recognized as an allowed operation literal in AST models, but has no parameters or semantics specified.
2. In `prompts.py`, `"restore"` is listed in the allowlist for generic instructions, but backup/restore operations are declared out-of-scope in legacy system instructions.
3. In `fixtures/ai_fixtures.json`, restore instructions are explicitly marked as unsupported.

**File & Line References:**
- [ai/plan_schema.py](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L17): Included in `AllowedOperation = Literal["delete", "archive", "update", "flag", "restore"]`. Accepts `"restore"` without error in `BranchPlan.operation`.
- [ai/prompts.py](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L111): `GENERIC_ANALYZE_PROMPT` Rule 2 allows `"restore"`: `ALLOWED OPERATIONS: "delete", "archive", "update", "flag", "restore"`. However, no few-shot prompt demonstrates a restore operation or what parameters it should accept.
- [ai/prompts.py](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L31-L32): Legacy `SYSTEM_PROMPT` Rule 8 states: `OUT-OF-SCOPE INSTRUCTIONS: If the instruction is outside user-record cleanup (e.g., database backups, server restarts, file deletion), return status "unsupported"`.
- [ai/fixtures/ai_fixtures.json](file:///e:/Monkey/Code-Monkey/ai/fixtures/ai_fixtures.json#L253-L265): Under `"restore the latest backup if necessary."`, returns `"status": "unsupported"`, stating: `"Backup and restore operations are outside the MVP simulator's supported action scope. Only user-cleanup actions ('delete_users') are supported."`
- [ai/tests/test_ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L230-L239): `test_fixture_restore_latest_backup_unsupported` asserts that `"restore the latest backup if necessary."` returns `"unsupported"`.

---

## 7. What shape does `generate_rewrite` accept for `outcomes`?

**Answer:**
`generate_rewrite` accepts an **unvalidated, arbitrary object** (`Optional[Dict[str, Any]] = None` or `Any`). There is no required structure or Pydantic validation schema enforced on `outcomes`.

**File & Line References:**
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L743): Function signature specifies `outcomes: Optional[Dict[str, Any]] = None`.
- [ai/prompts.py](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L289): `build_rewrite_messages(instruction: str, ambiguous_terms: List[Dict[str, Any]], outcomes: Any = None)`.
- [ai/prompts.py](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L294): Directly embeds `outcomes` into the prompt payload: `"simulation_outcomes": outcomes or "Different branches resulted in conflicting sets of affected records."`. If `outcomes` is None or empty/falsy, it falls back to the static string. If present, whatever JSON-serializable dictionary or list is passed gets serialized directly into the LLM prompt.

---

## 8. Does model output ever reach `eval`, `exec`, `subprocess`, `os.system`, SQL strings or code built from strings? Confirm explicitly yes or no.

**Answer:** **NO.** Model output never reaches `eval`, `exec`, `subprocess`, `os.system`, SQL query strings, or dynamically generated code.

**File & Line References:**
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L210-L228): Model raw output is parsed strictly via `_clean_and_parse_json()` using standard `json.loads()`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L455): Parsed output is validated strictly using Pydantic `GenericAnalysisOutput.model_validate(parsed)`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L400-L402): Predicates are parsed and validated via `parse_predicate()`, `validate_predicate_limits()`, and `validate_predicate_schema()`.
- Output is emitted solely as declarative Python dictionaries containing allowlisted string constants, integers, floats, booleans, and nested dictionaries.

---

## 9. Are secrets kept out of logs and error messages?

**Answer:** 
**Partially.** While `self.api_key` is not intentionally logged by the application, **raw exception strings (`str(e)`) from the OpenAI SDK are logged directly and exposed in the public `fallback_reason` response field without redaction**.

**File & Line References:**
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L164): `self.api_key = api_key or os.getenv("LLM_API_KEY", "")`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L628-L631): `last_error = str(e)` -> `raise AIEngineError(f"Hardcoded path failed after retries: {last_error}")`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L701-L702): `logger.warning(f"Generic pipeline failed ({fallback_err}). Initiating fallback routing.")` logs the raw exception.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L712): `hardcoded_plan["fallback_reason"] = f"Generic pipeline failed ({fallback_err})"`. Raw exception details are attached to the API response.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L720): `fixture_res["fallback_reason"] = f"Live models failed ({fallback_err})"`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L726): `fallback_reason: f"Generic pipeline failed: {fallback_err}. Instruction is outside known domains."`.
- [ai/ai_engine.py](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L790): `fix["fallback_reason"] = str(err)`.
- **Vulnerability**: If an `openai.AuthenticationError` or HTTP gateway error includes request headers, URL parameters, or authentication error responses that echo partial authorization tokens, this raw text is written into the application logger and returned in the user-visible `fallback_reason` payload without secret masking.

---

## Prioritized List of Problems Found

1. **[HIGH] Timeout Mismatch and Unbounded Elapsed Time**:
   - `LLM_TIMEOUT_SECONDS` (default 60s) exceeds `LLM_TOTAL_BUDGET_SECONDS` (default 45s).
   - Individual LLM calls and retry loops do not clamp their timeout to the remaining budget (`remaining = total_budget - elapsed`). A single hanging call or retry sequence can blow past the budget limit before the engine can trigger a fallback.

2. **[HIGH] Missing Validation for `update_set` Keys and Value Types**:
   - `OperationTemplate.update_set` and `BranchPlan.update_set` are completely unvalidated.
   - The AI model could produce update operations targeting non-existent fields or invalid data types without triggering a schema validation error.

3. **[MEDIUM] Secret Leakage Risk in `fallback_reason` and Logging**:
   - Raw exception strings `str(e)` are logged directly with `logger.warning()` and embedded directly into returned dictionaries under `"fallback_reason"`.
   - Any API key or authentication header echoed by upstream proxies or the client library during connection/auth failures could be exposed.

4. **[MEDIUM] Operational Inconsistency with `"restore"`**:
   - `"restore"` is in `AllowedOperation` in `plan_schema.py` and `GENERIC_ANALYZE_PROMPT`, but neither prompt few-shots nor schema models specify what arguments `"restore"` takes. Meanwhile, fixtures and legacy prompts reject backup restore instructions as unsupported.

5. **[LOW] Lack of Schema Enforcement on `outcomes` in `generate_rewrite`**:
   - `generate_rewrite` accepts `Optional[Dict[str, Any]]` or `Any` with zero shape validation, making the simulator-to-rewrite contract implicit rather than strongly typed.

6. **[LOW] Missing Collection-Level Duplicate Branch ID Validator**:
   - While `BranchPlan` validates individual branch IDs and `build_branches` assigns them from `["A", "B", ...]`, there is no Pydantic validator guaranteeing uniqueness across a list of branches if loaded from external sources or fixtures.

7. **[LOW / INFORMATIONAL] Hardcoded Default Model ID**:
   - `"qwen2.5:7b"` is hardcoded on line 163 of `ai/ai_engine.py` as a fallback default when `LLM_MODEL` is absent.
