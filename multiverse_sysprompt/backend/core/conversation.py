from typing import List, Dict
from backend.core.schemas import Node
from backend.db.node_store import get


def get_system_prompt_path(node_id: str) -> List[Node]:
    """Trace back from a node to the root, building system prompt evolution path."""
    path = []
    current_node = get(node_id)
    
    while current_node:
        path.append(current_node)
        if current_node.parent:
            current_node = get(current_node.parent)
        else:
            break
    
    return list(reversed(path))  # Root to leaf order


def format_dialogue_history(conversation_samples: List[Dict]) -> List[Dict[str, str]]:
    """Format conversation samples for display.
    
    In the new system, conversation samples are stored in nodes, not built from a path.
    This function extracts dialogue from a sample conversation.
    """
    if not conversation_samples:
        return []
    
    # Take the first conversation sample
    first_sample = conversation_samples[0] if conversation_samples else {}
    conversation = first_sample.get('conversation', [])
    
    return conversation


def format_conversation_for_display(conversation_history: List[Dict[str, str]]) -> str:
    """Format conversation history for LLM display."""
    formatted = []
    for turn in conversation_history:
        role = "Sales Agent" if turn["role"] == "user" else "Business CEO"
        formatted.append(f"{role}: {turn['content']}")
    
    return "\n\n".join(formatted)