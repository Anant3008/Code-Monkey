"""
Forwarding shim to backend.ai for backwards compatibility.
All primary prompts code is located in backend/ai/prompts.py.
"""
from backend.ai.prompts import (
    SYSTEM_PROMPT,
    FEW_SHOT_USER,
    FEW_SHOT_ASSISTANT,
    build_prompt_messages
)

__all__ = [
    "SYSTEM_PROMPT",
    "FEW_SHOT_USER",
    "FEW_SHOT_ASSISTANT",
    "build_prompt_messages"
]
