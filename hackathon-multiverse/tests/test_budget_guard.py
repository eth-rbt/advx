import pytest
import asyncio
from backend.db.redis_client import get_redis
from backend.db.frontier import push, size as frontier_size
from backend.db.node_store import save
from backend.core.schemas import Node
from backend.worker.worker import process_one_node
from backend.config.settings import settings


@pytest.mark.asyncio
async def test_budget_guard_sleeps_when_exceeded():
    """Test that worker sleeps 60s when budget is exceeded."""
    r = get_redis()
    
    # Set total cost to exceed daily budget
    r.set("usage:total_cost", settings.daily_budget_usd + 0.01)
    
    # Create and save a root node
    root = Node(
        id="root",
        prompt="Test prompt",
        reply="Test reply",
        score=0.5,
        depth=0,
        emb=[0.1, 0.2, 0.3, 0.4, 0.5],
        xy=[0.1, 0.2]
    )
    save(root)
    
    # Push to frontier
    push("root", 1.0)
    
    # Verify frontier has a node
    assert frontier_size() == 1
    
    # Run process_one_node with a timeout - it should sleep 60s due to budget
    try:
        await asyncio.wait_for(process_one_node(), timeout=2.0)
        # If we get here, it didn't sleep as expected
        assert False, "Expected timeout due to 60s sleep"
    except asyncio.TimeoutError:
        # Expected - it's sleeping for 60s
        pass
    
    # Frontier should be empty (node was popped)
    assert frontier_size() == 0
    
    # No new nodes should have been created
    all_nodes = r.keys("node:*")
    assert len(all_nodes) == 1  # Only root


@pytest.mark.asyncio
async def test_budget_guard_allows_processing_under_budget():
    """Test that worker processes normally when under budget."""
    r = get_redis()
    
    # Set total cost under budget
    r.set("usage:total_cost", settings.daily_budget_usd - 1.0)
    
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
    
    # Process should succeed (agents are mocked by conftest)
    processed = await process_one_node()
    assert processed is True
    
    # Frontier should be empty (node was popped)
    assert frontier_size() == 0
    
    # New nodes should have been created
    all_nodes = r.keys("node:*")
    assert len(all_nodes) >= 2  # At least root + 1 variant


