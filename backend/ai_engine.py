"""
Forwarding shim to backend.ai for backwards compatibility.
All primary AI engine code is located in backend/ai/ai_engine.py.
"""
from backend.ai.ai_engine import (
    AIEngine,
    generate_interpretations,
    UnsupportedScenarioError,
    InvalidModelOutputError,
    ALLOWED_ACTION_TYPE,
    ALLOWED_CONDITIONS,
    SUPPORTED_SCENARIOS
)

__all__ = [
    "AIEngine",
    "generate_interpretations",
    "UnsupportedScenarioError",
    "InvalidModelOutputError",
    "ALLOWED_ACTION_TYPE",
    "ALLOWED_CONDITIONS",
    "SUPPORTED_SCENARIOS"
]
