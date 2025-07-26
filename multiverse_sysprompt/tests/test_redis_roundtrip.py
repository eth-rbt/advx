from backend.db.node_store import save, get
from backend.core.schemas import Node
import uuid


def test_redis_roundtrip():
    node = Node(id=str(uuid.uuid4()), prompt="hello", depth=0)
    save(node)
    loaded = get(node.id)
    assert loaded == node
