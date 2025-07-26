from pydantic import BaseModel
from typing import Optional, List, Dict


class Node(BaseModel):
    id: str
    system_prompt: str  # Instructions for the mutator agent
    conversation_samples: List[Dict] = []  # Test conversations generated
    score: Optional[float] = None  # Average score across conversation samples
    avg_score: Optional[float] = None  # Explicit average for clarity
    sample_count: int = 0  # Number of test conversations
    depth: int  # Generations of system prompt evolution
    parent: Optional[str] = None
    emb: Optional[List[float]] = None  # Embedding of system prompt text
    xy: Optional[List[float]] = None  # Position in prompt space
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    agent_cost: Optional[float] = None


class FocusZone(BaseModel):
    poly: List[List[float]]  # List of [x, y] coordinates
    mode: str  # "explore" or "extend"


class GraphUpdate(BaseModel):
    """Subset of Node for WebSocket broadcast."""

    id: str
    xy: Optional[List[float]]
    score: Optional[float]
    parent: Optional[str]


class SettingsUpdate(BaseModel):
    """Partial settings update."""

    lambda_trend: Optional[float] = None
    lambda_sim: Optional[float] = None
    lambda_depth: Optional[float] = None
