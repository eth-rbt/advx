#!/usr/bin/env python3
"""
Comprehensive integration tests for the System Prompt Optimization system.
Tests all components working together end-to-end.
"""

import asyncio
import pytest
import json
from typing import List, Dict
from backend.core.schemas import Node
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.db.node_store import save, get, get_all_nodes
from backend.db.frontier import push, pop_max, size as frontier_size
from backend.db.redis_client import get_redis
from backend.agents.system_prompt_mutator import mutate_system_prompt, generate_initial_system_prompts
from backend.core.conversation_generator import evaluate_system_prompt, generate_test_conversations
from backend.worker.parallel_worker import process_system_prompt_node, process_system_prompt_variant
from backend.core.evaluation import comprehensive_system_prompt_evaluation, compare_system_prompts, analyze_system_prompt_evolution
from backend.api.routes import router
from backend.core.logger import get_logger

logger = get_logger(__name__)


@pytest.mark.asyncio
async def test_complete_system_flow():
    """Test the complete system flow from seed to evaluation."""
    # 1. Create initial system prompt
    initial_prompts = await generate_initial_system_prompts(k=1)
    assert len(initial_prompts) == 1
    initial_prompt = initial_prompts[0]
    
    # 2. Create root node
    root_node = Node(
        id=uuid_str(),
        system_prompt=initial_prompt,
        conversation_samples=[],
        score=0.5,
        avg_score=0.5,
        sample_count=0,
        depth=0,
        emb=embed(initial_prompt),
        xy=list(to_xy(embed(initial_prompt))),
    )
    
    # 3. Save and push to frontier
    save(root_node)
    push(root_node.id, 1.0)
    
    # 4. Verify node can be retrieved
    retrieved = get(root_node.id)
    assert retrieved is not None
    assert retrieved.system_prompt == initial_prompt
    assert hasattr(retrieved, 'conversation_samples')
    
    # 5. Test system prompt mutation
    performance_data = {'avg_score': 0.5, 'sample_count': 0}
    variants = await mutate_system_prompt(initial_prompt, performance_data, k=2)
    assert len(variants) == 2
    assert all(variant != initial_prompt for variant in variants)
    
    # 6. Test conversation generation
    test_conversations = await generate_test_conversations(variants[0])
    assert len(test_conversations) > 0
    assert all(isinstance(conv, tuple) for conv in test_conversations)
    assert all(len(conv) == 2 for conv in test_conversations)  # (conversation, score)
    
    # 7. Test evaluation
    evaluation = await evaluate_system_prompt(variants[0])
    assert 'avg_score' in evaluation
    assert 'conversation_samples' in evaluation
    assert evaluation['sample_count'] > 0
    
    logger.info("✅ Complete system flow test passed")


@pytest.mark.asyncio
async def test_worker_integration():
    """Test the worker processing system prompts correctly."""
    # Create a parent node
    parent_prompt = "You are a diplomatic negotiator focused on empathy."
    parent_node = Node(
        id=uuid_str(),
        system_prompt=parent_prompt,
        conversation_samples=[],
        score=0.6,
        avg_score=0.6,
        sample_count=3,
        depth=0,
        emb=embed(parent_prompt),
        xy=list(to_xy(embed(parent_prompt))),
    )
    save(parent_node)
    push(parent_node.id, 0.8)
    
    # Get top k embeddings for similarity calculation
    from backend.orchestrator.scheduler import get_top_k_nodes
    top_k_nodes = get_top_k_nodes(k=5)
    top_k_embeddings = [n.emb for n in top_k_nodes if n.emb]
    
    # Process the node
    children = await process_system_prompt_node(parent_node.id, top_k_embeddings)
    
    # Verify children were created
    assert len(children) > 0
    
    # Check child properties
    for child in children:
        assert isinstance(child, Node)
        assert child.depth == parent_node.depth + 1
        assert child.parent == parent_node.id
        assert child.system_prompt != parent_node.system_prompt
        assert hasattr(child, 'conversation_samples')
        assert hasattr(child, 'avg_score')
    
    logger.info(f"✅ Worker integration test passed - created {len(children)} children")


@pytest.mark.asyncio 
async def test_conversation_generation_with_plateau_detection():
    """Test that conversation generation stops at plateau as designed."""
    system_prompt = "You are a test negotiator."
    
    # Mock a conversation that plateaus
    from backend.core.conversation_generator import should_stop_conversation
    
    # Test case 1: Not enough turns
    scores1 = [0.4, 0.5]
    should_stop, final_score = await should_stop_conversation(scores1, min_turns=3)
    assert not should_stop
    
    # Test case 2: Plateau detected
    scores2 = [0.4, 0.5, 0.52, 0.53, 0.54]  # Very small improvements
    should_stop, final_score = await should_stop_conversation(scores2, min_turns=3)
    assert should_stop
    assert final_score == max(scores2[-3:])
    
    # Test case 3: High score achieved
    scores3 = [0.4, 0.6, 0.8, 0.9]
    should_stop, final_score = await should_stop_conversation(scores3, min_turns=3)
    assert should_stop
    assert final_score == 0.9
    
    logger.info("✅ Plateau detection test passed")


@pytest.mark.asyncio
async def test_schema_compatibility():
    """Test that all components work with the new schema."""
    # Test node creation and retrieval
    test_node = Node(
        id=uuid_str(),
        system_prompt="Test system prompt for schema verification",
        conversation_samples=[
            {
                "conversation": [
                    {"role": "user", "content": "Test opening"},
                    {"role": "assistant", "content": "Test response"}
                ],
                "score": 0.7
            }
        ],
        score=0.7,
        avg_score=0.7,
        sample_count=1,
        depth=0,
        emb=embed("test"),
        xy=list(to_xy(embed("test"))),
    )
    
    # Save and retrieve
    save(test_node)
    retrieved = get(test_node.id)
    
    assert retrieved is not None
    assert retrieved.system_prompt == test_node.system_prompt
    assert len(retrieved.conversation_samples) == 1
    assert retrieved.avg_score == 0.7
    assert retrieved.sample_count == 1
    
    # Test that old fields don't exist
    assert not hasattr(retrieved, 'prompt')
    assert not hasattr(retrieved, 'reply')
    
    logger.info("✅ Schema compatibility test passed")


@pytest.mark.asyncio
async def test_evolution_analysis():
    """Test the evolution analysis functionality."""
    # Create nodes at different depths
    for depth in range(3):
        for i in range(2):
            node = Node(
                id=uuid_str(),
                system_prompt=f"Generation {depth} variant {i} system prompt",
                conversation_samples=[],
                score=0.4 + (depth * 0.15) + (i * 0.05),
                avg_score=0.4 + (depth * 0.15) + (i * 0.05),
                sample_count=3,
                depth=depth,
                emb=embed(f"test {depth} {i}"),
                xy=list(to_xy(embed(f"test {depth} {i}"))),
            )
            save(node)
    
    # Run evolution analysis
    analysis = await analyze_system_prompt_evolution()
    
    assert 'total_nodes' in analysis
    assert 'generations_analyzed' in analysis
    assert 'evolution_by_generation' in analysis
    assert analysis['total_nodes'] >= 6
    assert analysis['generations_analyzed'] >= 3
    
    # Check that scores improve by generation
    evolution = analysis['evolution_by_generation']
    if len(evolution) >= 2:
        gen0_score = evolution[0]['avg_score']
        gen1_score = evolution[1]['avg_score']
        assert gen1_score > gen0_score  # Later generations should score higher
    
    logger.info("✅ Evolution analysis test passed")


@pytest.mark.asyncio
async def test_api_endpoints():
    """Test that API endpoints work with the new system."""
    # Test graph endpoint format
    r = get_redis()
    
    # Create a test node
    test_node = Node(
        id=uuid_str(),
        system_prompt="API test system prompt",
        conversation_samples=[{"conversation": [], "score": 0.5}],
        score=0.6,
        avg_score=0.6,
        sample_count=1,
        depth=0,
        emb=embed("api test"),
        xy=list(to_xy(embed("api test"))),
    )
    save(test_node)
    
    # Simulate graph endpoint logic
    nodes = []
    for key in r.keys("node:*"):
        node_id = key.decode('utf-8').replace("node:", "") if isinstance(key, bytes) else key.replace("node:", "")
        node = get(node_id)
        if node:
            system_prompt_preview = node.system_prompt[:100] + "..." if len(node.system_prompt) > 100 else node.system_prompt
            
            nodes.append({
                "id": node.id,
                "xy": node.xy,
                "score": node.score,
                "avg_score": getattr(node, 'avg_score', node.score),
                "sample_count": getattr(node, 'sample_count', 0),
                "parent": node.parent,
                "depth": node.depth,
                "system_prompt_preview": system_prompt_preview,
            })
    
    # Verify graph data structure
    assert len(nodes) > 0
    node_data = nodes[0]
    required_fields = ['id', 'xy', 'score', 'system_prompt_preview']
    for field in required_fields:
        assert field in node_data
    
    logger.info("✅ API endpoints test passed")


@pytest.mark.asyncio
async def test_frontier_priority_calculation():
    """Test that frontier priority calculation works correctly."""
    from backend.orchestrator.scheduler import calculate_priority
    
    # Create parent and child nodes
    parent = Node(
        id=uuid_str(),
        system_prompt="Parent system prompt",
        conversation_samples=[],
        score=0.5,
        avg_score=0.5,
        sample_count=3,
        depth=0,
        emb=embed("parent"),
        xy=list(to_xy(embed("parent"))),
    )
    
    child = Node(
        id=uuid_str(),
        system_prompt="Child system prompt with improvements",
        conversation_samples=[],
        score=0.7,
        avg_score=0.7,
        sample_count=3,
        depth=1,
        parent=parent.id,
        emb=embed("child"),
        xy=list(to_xy(embed("child"))),
    )
    
    save(parent)
    save(child)
    
    # Calculate priority
    top_k_embeddings = [parent.emb]
    priority = calculate_priority(child, parent.score, top_k_embeddings)
    
    # Priority should be positive (improvement over parent)
    assert priority > 0
    
    logger.info(f"✅ Frontier priority calculation test passed - priority: {priority:.3f}")


@pytest.mark.asyncio
async def test_comprehensive_evaluation():
    """Test comprehensive evaluation with multiple test rounds."""
    test_prompt = "You are a diplomatic negotiator focused on building trust."
    
    # Run comprehensive evaluation (with fewer tests for speed)
    evaluation = await comprehensive_system_prompt_evaluation(test_prompt, num_tests=1)
    
    # Check all required metrics
    required_metrics = [
        'avg_score', 'score_consistency', 'efficiency_score',
        'high_success_rate', 'moderate_success_rate', 'failure_rate',
        'score_distribution', 'improvement_potential',
        'total_conversations', 'system_prompt'
    ]
    
    for metric in required_metrics:
        assert metric in evaluation, f"Missing metric: {metric}"
    
    # Verify score distribution sums to 1.0
    dist = evaluation['score_distribution']
    total = dist['excellent'] + dist['good'] + dist['moderate'] + dist['poor']
    assert abs(total - 1.0) < 0.01  # Allow small floating point error
    
    logger.info("✅ Comprehensive evaluation test passed")


@pytest.mark.asyncio
async def test_comparison_functionality():
    """Test system prompt comparison."""
    prompts = [
        "You are an empathetic negotiator.",
        "You are a firm but fair diplomat.",
    ]
    
    comparison = await compare_system_prompts(prompts, num_tests=1)
    
    assert 'num_prompts_compared' in comparison
    assert comparison['num_prompts_compared'] == 2
    assert 'rankings' in comparison
    assert 'overall_winner' in comparison
    
    # Check that rankings exist
    for ranking_type in ['by_avg_score', 'by_consistency', 'by_efficiency']:
        assert ranking_type in comparison['rankings']
    
    logger.info("✅ System prompt comparison test passed")


@pytest.mark.asyncio
async def test_migration_creates_valid_nodes():
    """Test that migration creates valid system prompt nodes."""
    from backend.db.migration import seed_initial_system_prompts
    
    # Clear existing nodes
    r = get_redis()
    for key in r.keys("node:*"):
        r.delete(key)
    
    # Run migration seeding
    await seed_initial_system_prompts()
    
    # Check that nodes were created
    nodes = get_all_nodes()
    assert len(nodes) > 0
    
    # Verify all nodes have correct schema
    for node in nodes:
        assert hasattr(node, 'system_prompt')
        assert hasattr(node, 'conversation_samples')
        assert hasattr(node, 'avg_score')
        assert not hasattr(node, 'prompt')  # Old field should not exist
        assert not hasattr(node, 'reply')   # Old field should not exist
    
    logger.info(f"✅ Migration test passed - created {len(nodes)} valid nodes")


def run_all_tests():
    """Run all integration tests."""
    import subprocess
    import sys
    
    # Run pytest with this file
    result = subprocess.run(
        [sys.executable, "-m", "pytest", __file__, "-v", "-s"],
        capture_output=True,
        text=True
    )
    
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    return result.returncode == 0


if __name__ == "__main__":
    # For direct execution
    success = run_all_tests()
    if success:
        print("\n🎉 All integration tests passed!")
    else:
        print("\n❌ Some tests failed")
    exit(0 if success else 1)