import json
from typing import List
from backend.core.schemas import Node
from backend.db.redis_client import get_redis

r = get_redis()
NODE_PREFIX = "node:"


def save(node: Node) -> None:
    # Convert to dict and remove None values
    data = {k: v for k, v in node.model_dump().items() if v is not None}
    # Convert lists and complex objects to JSON strings for Redis
    for key, value in data.items():
        if isinstance(value, (list, dict)):
            data[key] = json.dumps(value)
    r.hset(NODE_PREFIX + node.id, mapping=data)


def get(node_id: str) -> Node | None:
    data = r.hgetall(NODE_PREFIX + node_id)
    if not data:
        return None

    # Parse JSON fields back to lists
    if "emb" in data and data["emb"]:
        data["emb"] = json.loads(data["emb"])
    if "xy" in data and data["xy"]:
        data["xy"] = json.loads(data["xy"])
    if "conversation_samples" in data and data["conversation_samples"]:
        data["conversation_samples"] = json.loads(data["conversation_samples"])

    # Convert string numbers back to proper types
    if "depth" in data:
        data["depth"] = int(data["depth"])
    if "score" in data:
        data["score"] = float(data["score"])
    if "avg_score" in data and data["avg_score"]:
        data["avg_score"] = float(data["avg_score"])
    if "sample_count" in data:
        data["sample_count"] = int(data["sample_count"])
    
    # Convert numeric usage fields
    for key in ("prompt_tokens", "completion_tokens", "agent_cost"):
        if key in data and data[key] is not None:
            data[key] = float(data[key])

    # Handle backward compatibility - convert old schema fields if they exist
    if "prompt" in data and "system_prompt" not in data:
        data["system_prompt"] = data.pop("prompt")
    if "reply" in data:
        # Convert old reply to conversation_samples format
        if "conversation_samples" not in data or not data["conversation_samples"]:
            data["conversation_samples"] = []
        data.pop("reply", None)

    return Node(**data)


def get_all_nodes() -> List[Node]:
    """Get all nodes from Redis."""
    node_keys = r.keys(NODE_PREFIX + "*")
    nodes = []
    
    for key in node_keys:
        # Handle both bytes and string keys
        if isinstance(key, bytes):
            key_str = key.decode('utf-8')
        else:
            key_str = str(key)
            
        node_id = key_str.replace(NODE_PREFIX, "")
        node = get(node_id)
        if node:
            nodes.append(node)
    
    return nodes
