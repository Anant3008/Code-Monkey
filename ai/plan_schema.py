"""
Safe Plan Schema for Semantic Chaos Monkey.
Defines a declarative, sandboxed language for describing entities, worlds,
predicates, and simulation branch plans.

NO CODE, SQL, OR SHELL EXPRESSIONS ALLOWED.
All operations, types, and predicate operators are strictly allowlisted.
"""

import os
from typing import Dict, Any, List, Optional, Literal, Union
from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Global Reference Date
# ---------------------------------------------------------------------------
WORLD_TODAY = os.getenv("CHAOS_WORLD_TODAY", "2026-01-01")

# ---------------------------------------------------------------------------
# Allowlist Definitions
# ---------------------------------------------------------------------------

AllowedOperation = Literal["delete", "archive", "update", "flag", "restore"]
AllowedFieldType = Literal["string", "int", "float", "bool", "date"]
AllowedCompareOp = Literal["eq", "ne", "lt", "lte", "gt", "gte"]

# ---------------------------------------------------------------------------
# Predicate AST (Allowlisted, bounded depth and node count)
# ---------------------------------------------------------------------------

class ComparePredicate(BaseModel):
    op: Literal["compare"] = "compare"
    field: str
    cmp: AllowedCompareOp
    value: Union[str, int, float, bool]


class OlderThanDaysPredicate(BaseModel):
    op: Literal["older_than_days"] = "older_than_days"
    field: str
    days: int = Field(..., ge=0)


class NewerThanDaysPredicate(BaseModel):
    op: Literal["newer_than_days"] = "newer_than_days"
    field: str
    days: int = Field(..., ge=0)


class IsNullPredicate(BaseModel):
    op: Literal["is_null"] = "is_null"
    field: str


class NotNullPredicate(BaseModel):
    op: Literal["not_null"] = "not_null"
    field: str


class InPredicate(BaseModel):
    op: Literal["in"] = "in"
    field: str
    values: List[Union[str, int, float, bool]] = Field(..., min_length=1)


class TermRefPredicate(BaseModel):
    """Placeholder for ambiguous term references in operation templates."""
    op: Literal["term_ref"] = "term_ref"
    term: str


# Forward declaration for recursive logical predicates
class AndPredicate(BaseModel):
    op: Literal["and"] = "and"
    args: List["Predicate"] = Field(..., min_length=1)


class OrPredicate(BaseModel):
    op: Literal["or"] = "or"
    args: List["Predicate"] = Field(..., min_length=1)


class NotPredicate(BaseModel):
    op: Literal["not"] = "not"
    arg: "Predicate"


Predicate = Union[
    ComparePredicate,
    OlderThanDaysPredicate,
    NewerThanDaysPredicate,
    IsNullPredicate,
    NotNullPredicate,
    InPredicate,
    TermRefPredicate,
    AndPredicate,
    OrPredicate,
    NotPredicate
]

# Update forward refs
AndPredicate.model_rebuild()
OrPredicate.model_rebuild()
NotPredicate.model_rebuild()


def parse_predicate(data: Dict[str, Any]) -> Predicate:
    """Parses a dictionary into a validated Predicate model."""
    op = data.get("op")
    if op == "compare":
        return ComparePredicate.model_validate(data)
    elif op == "older_than_days":
        return OlderThanDaysPredicate.model_validate(data)
    elif op == "newer_than_days":
        return NewerThanDaysPredicate.model_validate(data)
    elif op == "is_null":
        return IsNullPredicate.model_validate(data)
    elif op == "not_null":
        return NotNullPredicate.model_validate(data)
    elif op == "in":
        return InPredicate.model_validate(data)
    elif op == "term_ref":
        return TermRefPredicate.model_validate(data)
    elif op == "and":
        args = [parse_predicate(a) if isinstance(a, dict) else a for a in data.get("args", [])]
        return AndPredicate(args=args)
    elif op == "or":
        args = [parse_predicate(a) if isinstance(a, dict) else a for a in data.get("args", [])]
        return OrPredicate(args=args)
    elif op == "not":
        arg = parse_predicate(data["arg"]) if isinstance(data.get("arg"), dict) else data.get("arg")
        return NotPredicate(arg=arg)
    else:
        raise ValueError(f"Unknown or forbidden predicate operator: '{op}'")


def count_predicate_nodes_and_depth(p: Predicate, current_depth: int = 1) -> tuple[int, int]:
    """Recursively computes (total_nodes, max_depth) of a predicate tree."""
    if isinstance(p, (AndPredicate, OrPredicate)):
        total_nodes = 1
        max_d = current_depth
        for child in p.args:
            c_nodes, c_depth = count_predicate_nodes_and_depth(child, current_depth + 1)
            total_nodes += c_nodes
            max_d = max(max_d, c_depth)
        return total_nodes, max_d
    elif isinstance(p, NotPredicate):
        c_nodes, c_depth = count_predicate_nodes_and_depth(p.arg, current_depth + 1)
        return 1 + c_nodes, max(current_depth, c_depth)
    else:
        return 1, current_depth


def validate_predicate_limits(p: Predicate, max_depth: int = 4, max_nodes: int = 12) -> None:
    """Enforces AST complexity bounds to prevent denial-of-service / exponential branching."""
    nodes, depth = count_predicate_nodes_and_depth(p)
    if depth > max_depth:
        raise ValueError(f"Predicate exceeds maximum depth {max_depth} (got depth {depth})")
    if nodes > max_nodes:
        raise ValueError(f"Predicate exceeds maximum node limit {max_nodes} (got {nodes} nodes)")


def validate_predicate_schema(p: Predicate, field_types: Dict[str, str], allow_term_ref: bool = False) -> None:
    """Validates that fields exist, operators match field types, and term_ref is not present in final plans."""
    if isinstance(p, TermRefPredicate):
        if not allow_term_ref:
            raise ValueError(f"Unresolved term_ref('{p.term}') found in executable branch plan")
        return

    if isinstance(p, (ComparePredicate, OlderThanDaysPredicate, NewerThanDaysPredicate, IsNullPredicate, NotNullPredicate, InPredicate)):
        if p.field not in field_types:
            raise ValueError(f"Field '{p.field}' not defined in entity schema. Allowed fields: {list(field_types.keys())}")
        ftype = field_types[p.field]

        if isinstance(p, (OlderThanDaysPredicate, NewerThanDaysPredicate)):
            if ftype != "date":
                raise ValueError(f"Operator '{p.op}' can only be used on date fields (field '{p.field}' is of type '{ftype}')")

        if isinstance(p, ComparePredicate):
            if p.cmp in ("lt", "lte", "gt", "gte") and ftype not in ("int", "float", "date"):
                raise ValueError(f"Relational operator '{p.cmp}' cannot be used on {ftype} field '{p.field}'")

    elif isinstance(p, (AndPredicate, OrPredicate)):
        for child in p.args:
            validate_predicate_schema(child, field_types, allow_term_ref=allow_term_ref)
    elif isinstance(p, NotPredicate):
        validate_predicate_schema(p.arg, field_types, allow_term_ref=allow_term_ref)


# ---------------------------------------------------------------------------
# Schema Models
# ---------------------------------------------------------------------------

class FieldDefinition(BaseModel):
    name: str = Field(..., min_length=1)
    type: AllowedFieldType
    description: Optional[str] = ""


class EntitySchema(BaseModel):
    name: str = Field(..., min_length=1)
    fields: List[FieldDefinition] = Field(..., min_length=1)

    def get_field_types(self) -> Dict[str, str]:
        return {f.name: f.type for f in self.fields}


class WorldRecord(BaseModel):
    id: str
    data: Dict[str, Any]
    _injected: bool = False


class World(BaseModel):
    entity: str
    today: str = Field(default_factory=lambda: os.getenv("CHAOS_WORLD_TODAY", "2026-01-01"), description="Fixed reference date for reproducibility (YYYY-MM-DD)")
    records: List[Dict[str, Any]] = Field(..., min_length=1, max_length=14)

    @field_validator("records")
    @classmethod
    def validate_record_ids(cls, v: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ids = [r.get("id") for r in v]
        if any(not i for i in ids):
            raise ValueError("Every record in world must have a non-empty 'id' field")
        if len(set(ids)) != len(ids):
            raise ValueError(f"Record IDs must be unique in world: duplicates found")
        return v


class MeaningDefinition(BaseModel):
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    assumption: str = Field(..., min_length=5)
    predicate: Dict[str, Any]  # Serializable Predicate representation


class AmbiguousTerm(BaseModel):
    term: str = Field(..., min_length=1)
    description: str = Field(..., min_length=5)
    meanings: List[MeaningDefinition] = Field(..., min_length=2, max_length=4)


class OperationTemplate(BaseModel):
    operation: AllowedOperation
    target_entity: str
    update_set: Optional[Dict[str, Any]] = None
    where_template: Dict[str, Any]  # Predicate tree containing term_ref nodes


class BranchPlan(BaseModel):
    id: str = Field(..., min_length=1, max_length=4)
    title: str = Field(..., min_length=1)
    assumption: str = Field(..., min_length=5)
    operation: AllowedOperation
    update_set: Optional[Dict[str, Any]] = None
    where: Dict[str, Any]  # Fully resolved Predicate tree
    chosen_meanings: Dict[str, str] = Field(default_factory=dict)
    explanation: str = Field(..., min_length=5)


class GenericAnalysisOutput(BaseModel):
    domain: str
    entity_schema: EntitySchema
    ambiguous_terms: List[AmbiguousTerm]
    operation_template: OperationTemplate
    suggested_rewrite: Optional[str] = ""
