from typing import List, Dict
from backend.core.schemas import Node
from backend.db.node_store import get


def get_conversation_path(node_id: str) -> List[Node]:
    """Trace back from a node to the root, building full conversation path."""
    path = []
    current_node = get(node_id)
    
    while current_node:
        path.append(current_node)
        if current_node.parent:
            current_node = get(current_node.parent)
        else:
            break
    
    return list(reversed(path))  # Root to leaf order


def format_dialogue_history(conversation_path: List[Node]) -> List[Dict[str, str]]:
    """Convert conversation path to alternating user/assistant messages."""
    dialogue = []
    
    for node in conversation_path:
        dialogue.append({"role": "user", "content": node.prompt})
        if node.reply:
            dialogue.append({"role": "assistant", "content": node.reply})
    
    return dialogue


def format_conversation_for_display(conversation_history: List[Dict[str, str]]) -> str:
    """Format conversation history for LLM display."""
    formatted = []
    for turn in conversation_history:
        role = "Human" if turn["role"] == "user" else "Putin"
        formatted.append(f"{role}: {turn['content']}")
    
    return "\n\n".join(formatted)