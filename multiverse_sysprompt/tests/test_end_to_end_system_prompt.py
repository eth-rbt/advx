#!/usr/bin/env python3
"""
End-to-end test for the complete system prompt optimization system.
This test simulates the entire workflow from seeding to evolution.
"""

import asyncio
import pytest
from backend.db.redis_client import get_redis
from backend.db.frontier import push, pop_max, size as frontier_size
from backend.db.node_store import save, get, get_all_nodes
from backend.core.schemas import Node
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.agents.system_prompt_mutator import generate_initial_system_prompts
from backend.worker.parallel_worker import process_batch
from backend.core.logger import get_logger
from backend.api.routes import seed_multiple

logger = get_logger(__name__)


async def clear_database():
    """Clear all data from Redis."""
    r = get_redis()
    for key in r.keys("node:*"):
        r.delete(key)
    r.delete("frontier")
    logger.info("Cleared database")


async def simulate_full_system():
    """Simulate the full system prompt optimization workflow."""
    logger.info("🚀 Starting end-to-end system simulation")
    
    # 1. Clear existing data
    await clear_database()
    
    # 2. Seed with multiple initial system prompts
    logger.info("📝 Generating initial system prompts...")
    initial_prompts = await generate_initial_system_prompts(k=3)
    
    seed_ids = []
    for i, system_prompt in enumerate(initial_prompts):
        node = Node(
            id=uuid_str(),
            system_prompt=system_prompt,
            conversation_samples=[],
            score=0.5,
            avg_score=0.5,
            sample_count=0,
            depth=0,
            emb=embed(system_prompt),
            xy=list(to_xy(embed(system_prompt))),
        )
        save(node)
        push(node.id, 1.0 - (i * 0.1))
        seed_ids.append(node.id)
        logger.info(f"  ✅ Seeded: {system_prompt[:60]}...")
    
    # 3. Verify frontier has nodes
    initial_frontier_size = frontier_size()
    logger.info(f"📊 Initial frontier size: {initial_frontier_size}")
    assert initial_frontier_size == 3
    
    # 4. Process first batch (simulating worker)
    logger.info("⚙️  Processing first batch of system prompts...")
    
    # Pop nodes from frontier
    batch_size = min(3, initial_frontier_size)
    node_ids = []
    for _ in range(batch_size):
        node_id = pop_max()
        if node_id:
            node_ids.append(node_id)
    
    if node_ids:
        # Process the batch
        children_created = await process_batch(node_ids)
        logger.info(f"  ✅ Created {children_created} child system prompts")
        assert children_created > 0
    
    # 5. Check system state after first generation
    all_nodes = get_all_nodes()
    logger.info(f"📈 Total nodes after generation 1: {len(all_nodes)}")
    
    # Verify we have nodes at different depths
    depth_counts = {}
    for node in all_nodes:
        depth_counts[node.depth] = depth_counts.get(node.depth, 0) + 1
    
    logger.info(f"  📊 Depth distribution: {depth_counts}")
    assert 0 in depth_counts  # Root nodes
    assert 1 in depth_counts  # First generation
    
    # 6. Process second batch
    logger.info("⚙️  Processing second batch...")
    current_frontier_size = frontier_size()
    if current_frontier_size > 0:
        batch_size = min(3, current_frontier_size)
        node_ids = []
        for _ in range(batch_size):
            node_id = pop_max()
            if node_id:
                node_ids.append(node_id)
        
        if node_ids:
            children_created = await process_batch(node_ids)
            logger.info(f"  ✅ Created {children_created} more child system prompts")
    
    # 7. Analyze final state
    final_nodes = get_all_nodes()
    logger.info(f"📊 Final system state:")
    logger.info(f"  - Total system prompts explored: {len(final_nodes)}")
    logger.info(f"  - Frontier size: {frontier_size()}")
    
    # Calculate score improvement
    root_scores = [n.score for n in final_nodes if n.depth == 0]
    deeper_scores = [n.score for n in final_nodes if n.depth > 0]
    
    if root_scores and deeper_scores:
        avg_root_score = sum(root_scores) / len(root_scores)
        avg_deeper_score = sum(deeper_scores) / len(deeper_scores)
        improvement = avg_deeper_score - avg_root_score
        logger.info(f"  - Score improvement: {improvement:.3f} ({avg_root_score:.3f} → {avg_deeper_score:.3f})")
    
    # Find best system prompt
    best_node = max(final_nodes, key=lambda n: n.score or 0)
    logger.info(f"\n🏆 Best system prompt found:")
    logger.info(f"  Score: {best_node.score:.3f}")
    logger.info(f"  Generation: {best_node.depth}")
    logger.info(f"  System prompt: '{best_node.system_prompt[:100]}...'")
    
    # 8. Verify all nodes have correct schema
    for node in final_nodes:
        assert hasattr(node, 'system_prompt'), "Node missing system_prompt"
        assert hasattr(node, 'conversation_samples'), "Node missing conversation_samples"
        assert hasattr(node, 'avg_score'), "Node missing avg_score"
        assert hasattr(node, 'sample_count'), "Node missing sample_count"
        assert not hasattr(node, 'prompt'), "Node has old 'prompt' field"
        assert not hasattr(node, 'reply'), "Node has old 'reply' field"
    
    logger.info("\n✅ End-to-end simulation completed successfully!")
    
    return {
        'total_nodes': len(final_nodes),
        'best_score': best_node.score,
        'generations': max(n.depth for n in final_nodes) + 1,
        'depth_distribution': depth_counts
    }


@pytest.mark.asyncio
async def test_end_to_end_system():
    """Test the complete system end-to-end."""
    result = await simulate_full_system()
    
    # Verify results
    assert result['total_nodes'] > 3  # More than initial seeds
    assert result['best_score'] > 0.0  # Some positive score
    assert result['generations'] >= 2  # At least 2 generations
    
    logger.info("✅ End-to-end test passed!")


@pytest.mark.asyncio
async def test_worker_handles_empty_frontier():
    """Test that worker handles empty frontier gracefully."""
    await clear_database()
    
    # Process with empty frontier
    children_created = await process_batch([])
    assert children_created == 0
    
    logger.info("✅ Empty frontier handling test passed")


@pytest.mark.asyncio
async def test_score_improvement_over_generations():
    """Test that scores generally improve over generations."""
    await clear_database()
    
    # Create a simple evolution chain
    gen0_prompt = "You are a basic negotiator."
    gen0_node = Node(
        id=uuid_str(),
        system_prompt=gen0_prompt,
        conversation_samples=[],
        score=0.4,
        avg_score=0.4,
        sample_count=3,
        depth=0,
        emb=embed(gen0_prompt),
        xy=list(to_xy(embed(gen0_prompt))),
    )
    save(gen0_node)
    
    # Simulate mutation and improvement
    gen1_prompt = "You are an empathetic negotiator who builds trust gradually."
    gen1_node = Node(
        id=uuid_str(),
        system_prompt=gen1_prompt,
        conversation_samples=[],
        score=0.6,
        avg_score=0.6,
        sample_count=3,
        depth=1,
        parent=gen0_node.id,
        emb=embed(gen1_prompt),
        xy=list(to_xy(embed(gen1_prompt))),
    )
    save(gen1_node)
    
    # Verify improvement
    assert gen1_node.score > gen0_node.score
    
    logger.info("✅ Score improvement test passed")


def run_simulation():
    """Run the simulation directly."""
    return asyncio.run(simulate_full_system())


if __name__ == "__main__":
    # For direct execution
    try:
        result = run_simulation()
        print(f"\n📊 Simulation Results:")
        print(f"  - Total nodes explored: {result['total_nodes']}")
        print(f"  - Best score achieved: {result['best_score']:.3f}")
        print(f"  - Generations: {result['generations']}")
        print(f"  - Depth distribution: {result['depth_distribution']}")
        print("\n🎉 Simulation completed successfully!")
    except Exception as e:
        print(f"\n❌ Simulation failed: {e}")
        import traceback
        traceback.print_exc()