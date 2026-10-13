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

## 1. Is `world.today` a fixed constant or does it come from the system clock (`datetime.now`/`today`)?

**Answer:** `world.today` is a **fixed constant** defaulting to `"2026-01-01"`, overridable via the environment variable `CHAOS_WORLD_TODAY`. It does **not** come from the system clock (`datetime.now()` or `date.today()`).

**File & Line References:**
- [ai/plan_schema.py:L18](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L18): Constant defined as `WORLD_TODAY = os.getenv("CHAOS_WORLD_TODAY", "2026-01-01")`.
- [ai/plan_schema.py:L315](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L315): `World.today` field default factory: `Field(default_factory=lambda: os.getenv("CHAOS_WORLD_TODAY", "2026-01-01"))`.
- [ai/ai_engine.py:L64-L66](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L64-L66): `def get_world_today() -> str: return os.getenv("CHAOS_WORLD_TODAY", "2026-01-01")`.
- [ai/ai_engine.py:L263](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L263): In `inject_world_edge_cases()`, initializes reference date from `ref_today = get_world_today()`.
- [ai/ai_engine.py:L495](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L495): In `_execute_generic_pipeline()`, creates `World(entity=..., today=get_world_today(), records=injected_records)`.
- [ai/ai_engine.py:L524](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L524): In `convert_hardcoded_to_plan()`, sets `ref_today = get_world_today()`.
- [ai/prompts.py:L262-L264](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L262-L264): `get_world_today()` uses `CHAOS_WORLD_TODAY` (defaulting to `"2026-01-01"`).
- [ai/fixtures/ai_fixtures.json:L19, L138](file:///e:/Monkey/Code-Monkey/ai/fixtures/ai_fixtures.json#L19-L138): Static fixtures use `"today": "2026-01-01"`.
- Tested in [ai/tests/test_ai_engine.py:L539-L569](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L539-L569) (`test_different_mocked_system_dates_produce_identical_worlds`).

---

## 2. Is each LLM call's timeout capped by the REMAINING total budget, or only by `LLM_TIMEOUT_SECONDS`? Can retries push total time past `LLM_TOTAL_BUDGET_SECONDS`?

**Answer:** 
- Each LLM call's timeout is capped by **`min(LLM_TIMEOUT_SECONDS, remaining)`**, where `remaining = deadline - now`.
- Before every LLM call, `remaining = deadline - time.time()` is evaluated. If `remaining <= 0`, the live path is immediately aborted and routed to fallback with `fallback_reason = "time budget exceeded"`.
- Retries inside `_call_hardcoded_model` recompute `remaining` and abort if `remaining <= 0`.
- Therefore, retries **cannot** push total time past `LLM_TOTAL_BUDGET_SECONDS`.

**File & Line References:**
- [ai/ai_engine.py:L177-L181](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L177-L181): `self.timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "30.0"))`, `self.total_budget = float(os.getenv("LLM_TOTAL_BUDGET_SECONDS", "60.0"))`.
- [ai/ai_engine.py:L446-L457](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L446-L457): In `_execute_generic_pipeline()` before Step 1 analyze call:
  `remaining = (deadline - time.time()) if deadline else self.total_budget`
  `if remaining <= 0: raise AIEngineError("time budget exceeded")`
  `call_timeout = min(self.timeout, remaining)`
- [ai/ai_engine.py:L473-L484](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L473-L484): Before Step 2 world generation call:
  `remaining = (deadline - time.time()) if deadline else self.total_budget`
  `if remaining <= 0: raise AIEngineError("time budget exceeded")`
  `call_timeout = min(self.timeout, remaining)`
- [ai/ai_engine.py:L608-L612](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L608-L612): In `_call_hardcoded_model()`, rechecks remaining on every retry attempt:
  `remaining = (deadline - time.time()) if deadline else self.total_budget`
  `if remaining <= 0: raise AIEngineError("time budget exceeded")`
  `call_timeout = min(self.timeout, remaining)`
- [ai/ai_engine.py:L806-L832](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L806-L832): In `analyze_and_branch()`, `deadline = start_time + self.total_budget`. Checked before live pipeline, and if `get_remaining() <= 0`, routes to `fixture_fallback` with `fallback_reason = "time budget exceeded"`.
- Tested in [ai/tests/test_ai_engine.py:L571-L600](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L571-L600) (`test_slow_client_never_exceeds_budget`).

---

## 3. Does the validator reject `update_set` keys that are not in the entity schema? Does it check value types?

**Answer:** **YES.** `validate_operation_and_update_set` verifies that:
1. `update_set` is required for `archive` and `update`, and forbidden (must be null) for `delete` and `flag`.
2. Keys cannot be `'id'` and cannot start with `'_'`.
3. Every key must exist in the entity schema's declared fields.
4. Each value must match the declared schema type (`string`, `int`, `float`, `bool`, `date`).

**File & Line References:**
- [ai/plan_schema.py:L250-L280](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L250-L280): `validate_operation_and_update_set(operation, update_set, field_types)` checks:
  `if k not in field_types: raise ValueError(...)`
  `check_value_matches_type(v, field_types[k], field_name=k)`
- [ai/plan_schema.py:L31-L54](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L31-L54): `check_value_matches_type()` enforces exact primitive types.
- [ai/ai_engine.py:L373](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L373): Called in `build_branches()` before branch plan generation.
- Tested in [ai/tests/test_ai_engine.py:L742-L762](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L742-L762) (`test_update_set_schema_key_and_type_validation`).

---

## 4. Does validation reject: unknown operation, unknown predicate op, unknown field, operator/type mismatch, depth > 4, nodes > 12, leftover `term_ref` in final branches, duplicate branch IDs?

**Detailed Breakdown:**

| Item | Status | Mechanism & File / Line References |
| :--- | :---: | :--- |
| **Unknown operation** | **REJECTED** | [ai/plan_schema.py:L23](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L23): `AllowedOperation = Literal["delete", "archive", "update", "flag"]` used in `OperationTemplate` (line 343) and `BranchPlan` (line 358). Tested in [test_ai_engine.py:L409-L421](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L409-L421) and [L688-L700](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L688-L700). |
| **Unknown predicate op** | **REJECTED** | [ai/plan_schema.py:L146](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L146): `parse_predicate()` raises `ValueError(f"Unknown or forbidden predicate operator: '{op}'")`. Tested in [test_ai_engine.py:L423-L428](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L423-L428). |
| **Unknown field** | **REJECTED** | [ai/plan_schema.py:L210-L212](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L210-L212): `validate_predicate_schema()` raises `ValueError` if `p.field not in field_types`. Tested in [test_ai_engine.py:L430-L437](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L430-L437). |
| **Operator/type mismatch** | **REJECTED** | [ai/plan_schema.py:L215-L225](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L215-L225): Relational operators (`lt`, `lte`, `gt`, `gte`) are forbidden on `string` and `bool` fields; `older_than_days`/`newer_than_days` are forbidden on non-date fields. Tested in [test_ai_engine.py:L439-L446](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L439-L446) and [L779-L808](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L779-L808). |
| **Depth > 4** | **REJECTED** | [ai/plan_schema.py:L186-L187](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L186-L187): `validate_predicate_limits()` checks `depth > max_depth` (default 4). Tested in [test_ai_engine.py:L448-L455](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L448-L455). |
| **Nodes > 12** | **REJECTED** | [ai/plan_schema.py:L188-L189](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L188-L189): `validate_predicate_limits()` checks `nodes > max_nodes` (default 12). Tested in [test_ai_engine.py:L448-L455](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L448-L455). |
| **Leftover `term_ref` in final branches** | **REJECTED** | [ai/plan_schema.py:L204-L206](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L204-L206): `validate_predicate_schema(..., allow_term_ref=False)` raises `ValueError` on `TermRefPredicate`. Tested in [test_ai_engine.py:L457-L464](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L457-L464). |
| **Duplicate branch IDs** | **NOT REJECTED BY Pydantic validator model directly** | [ai/plan_schema.py:L355](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L355): `BranchPlan` validates single instances. `build_branches()` in `ai_engine.py` assigns unique sequential IDs `["A", "B", ...]` by index ([ai_engine.py:L442](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L442)). No root collection validator asserts uniqueness if branches are constructed outside `build_branches`. |

---

## 5. How is the model ID configured? Is `"qwen2.5:7b"` hardcoded anywhere as a default?

**Answer:**
- Configured strictly via `AIEngine(model=...)` constructor parameter or the `LLM_MODEL` environment variable.
- **NO.** `"qwen2.5:7b"` is **no longer hardcoded anywhere as a default**.
- If `LLM_MODEL` is unset in live mode, `AIEngine` raises `AIEngineError: LLM_MODEL is unset in live mode. Run 'python -m ai.list_models' to discover available models and set LLM_MODEL in .env`.
- Fixture mode continues to function with no model configured.

**File & Line References:**
- [ai/ai_engine.py:L175](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L175): `self.model = model or os.getenv("LLM_MODEL", "")` (empty string fallback, not hardcoded model).
- [ai/ai_engine.py:L196-L198](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L196-L198): In `__init__`, raises `AIEngineError` if `not self.fixture_mode and not self.force_fallback and not self.model`.
- [ai/.env.example:L7](file:///e:/Monkey/Code-Monkey/ai/.env.example#L7): Uses placeholder `LLM_MODEL=REPLACE_WITH_ID_FROM_list_models`.
- Tested in [ai/tests/test_ai_engine.py:L602-L612](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L602-L612) (`test_missing_model_raises_config_error_in_live_mode`).

---

## 6. What does `"restore"` do in `plan_schema`, `prompts` and `fixtures`?

**Answer:**
`"restore"` has been **completely removed from the allowed operations** and is treated as **unsupported**:
1. In `plan_schema.py`: `"restore"` is removed from `AllowedOperation` ([plan_schema.py:L23](file:///e:/Monkey/Code-Monkey/ai/plan_schema.py#L23)). Any attempt to construct a plan with `operation="restore"` fails validation.
2. In `prompts.py`: `GENERIC_ANALYZE_PROMPT` explicitly specifies: `ALLOWED OPERATIONS: "delete", "archive", "update", "flag". (Reject anything else; "restore" is strictly unsupported)` ([prompts.py:L111](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L111)).
3. In `fixtures/ai_fixtures.json`: `"restore the latest backup if necessary."` returns `"status": "unsupported"` with `fallback_reason: "Restore operations are unsupported as there is no defined source data to restore from."` ([ai_fixtures.json:L253-L265](file:///e:/Monkey/Code-Monkey/ai/fixtures/ai_fixtures.json#L253-L265)).
4. In `ai_engine.py`: Router catches instructions containing "restore" and returns status `"unsupported"` ([ai_engine.py:L794-L808](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L794-L808)).
5. Tested in [ai/tests/test_ai_engine.py:L688-L700](file:///e:/Monkey/Code-Monkey/ai/tests/test_ai_engine.py#L688-L700) (`test_plan_validation_rejects_restore_operation`).

---

## 7. What shape does `generate_rewrite` accept for `outcomes`?

**Answer:**
`generate_rewrite` accepts an **unvalidated, arbitrary object** (`Optional[Dict[str, Any]] = None` or `Any`). There is no required structure or Pydantic validation schema enforced on `outcomes`.

**File & Line References:**
- [ai/ai_engine.py:L903](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L903): `def generate_rewrite(instruction: str, ambiguous_terms: List[Dict[str, Any]], outcomes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:`.
- [ai/prompts.py:L295-L300](file:///e:/Monkey/Code-Monkey/ai/prompts.py#L295-L300): Directly embeds `outcomes` into prompt payload: `"simulation_outcomes": outcomes or "Different branches resulted in conflicting sets of affected records."`. If `None` or falsy, it falls back to the static string.

---

## 8. Does model output ever reach `eval`, `exec`, `subprocess`, `os.system`, SQL strings or code built from strings? Confirm explicitly yes or no.

**Answer:** **NO.** Model output never reaches `eval`, `exec`, `subprocess`, `os.system`, SQL query strings, or dynamically generated code.

**File & Line References:**
- [ai/ai_engine.py:L221-L238](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L221-L238): Model raw output is parsed strictly via `_clean_and_parse_json()` using standard `json.loads()`.
- [ai/ai_engine.py:L468](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L468): Parsed output is validated strictly using Pydantic `GenericAnalysisOutput.model_validate(parsed)`.
- [ai/ai_engine.py:L439-L441](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L439-L441): Predicates are parsed and validated via `parse_predicate()`, `validate_predicate_limits()`, and `validate_predicate_schema()`.
- Output is emitted solely as declarative Python dictionaries containing allowlisted string constants, integers, floats, booleans, and nested dictionaries.

---

## 9. Are secrets kept out of logs and error messages?

**Answer:** **YES.**
- `sanitize_secret_text()` proactively scrubs `self.api_key`, bearer tokens (`Bearer [REDACTED]`), and OpenAI-style API keys (`sk-[REDACTED]`) before strings are passed to `logger.warning()` or returned in user-visible `fallback_reason` fields.
- The `--check` CLI tool prints `API Key: [CONFIGURED]` or `[NOT CONFIGURED]`, never printing the key.

**File & Line References:**
- [ai/ai_engine.py:L69-L78](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L69-L78): `sanitize_secret_text()` definition.
- [ai/ai_engine.py:L624, L824, L837, L866, L926, L938](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L624-L938): Applied across all exception handlers and logging points.
- [ai/ai_engine.py:L1000](file:///e:/Monkey/Code-Monkey/ai/ai_engine.py#L1000): In `--check`, masks key status.

---

## Prioritized List of Problems Found

1. **[LOW / CONTRACT] Unenforced Schema Contract on `generate_rewrite` Outcomes**:
   - `outcomes` accepts arbitrary `Optional[Dict[str, Any]]` without a Pydantic model enforcing simulator output structure (e.g. `affected_ids`, branch IDs, counts). Defining a strict `SimulationOutcomes` Pydantic model would solidify the contract with Person 3.

2. **[LOW / DEFENSIVE] Collection-Level Branch ID Uniqueness Validator**:
   - While `build_branches` guarantees unique IDs sequentially, there is no root collection validator asserting unique IDs if branches are loaded from arbitrary external sources or custom fixtures.
