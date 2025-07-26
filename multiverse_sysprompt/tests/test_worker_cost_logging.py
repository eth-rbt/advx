import pytest
import asyncio
from unittest.mock import patch, MagicMock
from backend.db.redis_client import get_redis
from backend.db.frontier import push
from backend.db.node_store import save, get
from backend.core.schemas import Node
from backend.worker.worker import process_one_node


@pytest.mark.asyncio
async def test_worker_cost_logging_and_node_fields():
    """Test that worker logs costs and stores token/cost info in nodes."""
    # Clear Redis
    r = get_redis()
    r.flushdb()
    
    # Create and save a root node
    root = Node(
        id="root",
        prompt="How can we achieve peace?",
        reply="Peace requires understanding.",
        score=0.5,
        depth=0,
        emb=[0.1, 0.2, 0.3, 0.4, 0.5],
        xy=[0.1, 0.2]
    )
    save(root)
    
    # Push to frontier
    push("root", 1.0)
    
    # Process the node - agents will be mocked by conftest.py
    processed = await process_one_node()
    assert processed is True
    
    # Check that new nodes were created with token info
    all_nodes = r.keys("node:*")
    assert len(all_nodes) >= 2  # At least root + 1 variant
    
    # Check each child node has token/cost fields
    child_nodes = []
    for node_key in all_nodes:
        node_id = node_key.decode().replace("node:", "")
        node = get(node_id)
        if node and node.depth == 1:
            child_nodes.append(node)
            
            # Verify token and cost fields exist and are > 0
            assert node.prompt_tokens > 0
            assert node.completion_tokens > 0
            assert node.agent_cost > 0
    
    assert len(child_nodes) >= 1  # Should have at least 1 child node
    
    # Check Redis cost counter
    total_cost = r.get("usage:total_cost")
    assert total_cost is not None
    assert float(total_cost) > 0


@pytest.mark.asyncio
async def test_worker_logs_per_agent_costs(caplog):
    """Test that worker logs cost info for each agent call."""
    caplog.set_level("INFO")
    r = get_redis()
    
    # Create and save a root node
    root = Node(
        id="test_root",
        prompt="Test prompt",
        reply="Test reply",
        score=0.5,
        depth=0,
        emb=[0.1, 0.2],
        xy=[0.1, 0.2]
    )
    save(root)
    push("test_root", 1.0)
    
    # Process with logging
    await process_one_node()
    
    # Check logs contain expected format
    log_messages = [record.message for record in caplog.records]
    
    # Should have log entries with correct format
    # Format: "node=<id> depth=<d> parent=<pid> tokens_in=<X> tokens_out=<Y> cost=$<Z> ..."
    node_logs = [msg for msg in log_messages if "node=" in msg and "depth=" in msg]
    assert len(node_logs) >= 1
    
    # Check that log contains required fields
    for log in node_logs:
        assert "tokens_in=" in log
        assert "tokens_out=" in log
        assert "cost=$" in log
        assert "personaCost=$" in log
        assert "criticCost=$" in log