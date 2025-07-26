from pydantic import BaseModel
from typing import Optional, List


class Node(BaseModel):
    id: str
    prompt: str
    reply: Optional[str] = None
    score: Optional[float] = None
    depth: int
    parent: Optional[str] = None
    emb: Optional[List[float]] = None
    xy: Optional[List[float]] = None  # Store as list for JSON serialization
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


class SeedRequest(BaseModel):
    """Request payload for seeding a conversation."""
    
    prompt: str
