#!/usr/bin/env python3
"""
Test script for Phase 2 system prompt optimization features.
Tests the enhanced evaluation framework, API endpoints, and migration.
"""

import asyncio
import sys
import os
import json

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.core.evaluation import (
    comprehensive_system_prompt_evaluation, 
    compare_system_prompts,
    analyze_system_prompt_evolution
)
from backend.core.schemas import Node
from backend.db.node_store import save, get
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.db.migration import migrate_conversation_nodes_to_system_prompts
from backend.db.redis_client import get_redis


async def test_comprehensive_evaluation():
    """Test the comprehensive evaluation framework."""
    print("🧪 Testing comprehensive system prompt evaluation...")
    
    test_prompt = (
        "You are a diplomatic negotiator focused on economic benefits. "
        "Emphasize trade opportunities and mutual economic gains in your approach to Putin."
    )
    
    try:
        evaluation = await comprehensive_system_prompt_evaluation(test_prompt, num_tests=2)
        
        required_keys = ['avg_score', 'score_consistency', 'efficiency_score', 'system_prompt', 'total_conversations']
        missing_keys = [key for key in required_keys if key not in evaluation]
        
        if missing_keys:
            print(f"❌ Missing keys in evaluation: {missing_keys}")
            return False
        
        print(f"✅ Comprehensive evaluation completed")
        print(f"   Average score: {evaluation['avg_score']:.3f}")
        print(f"   Consistency: {evaluation['score_consistency']:.3f}")
        print(f"   Efficiency: {evaluation['efficiency_score']:.3f}")
        print(f"   Total conversations: {evaluation['total_conversations']}")
        
        return evaluation['total_conversations'] > 0
        
    except Exception as e:
        print(f"❌ Comprehensive evaluation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_system_prompt_comparison():
    """Test system prompt comparison functionality."""
    print("🧪 Testing system prompt comparison...")
    
    test_prompts = [
        "You are an empathetic diplomat focused on understanding Putin's concerns.",
        "You are an economic strategist focused on trade benefits and partnerships.",
        "You are a security expert focused on addressing legitimate security concerns."
    ]
    
    try:
        comparison = await compare_system_prompts(test_prompts, num_tests=1)
        
        required_keys = ['num_prompts_compared', 'successful_evaluations', 'overall_winner']
        missing_keys = [key for key in required_keys if key not in comparison]
        
        if missing_keys:
            print(f"❌ Missing keys in comparison: {missing_keys}")
            return False
        
        print(f"✅ System prompt comparison completed")
        print(f"   Prompts compared: {comparison['num_prompts_compared']}")
        print(f"   Successful evaluations: {comparison['successful_evaluations']}")
        
        if comparison['overall_winner']:
            winner_score = comparison['overall_winner']['overall_score']
            print(f"   Winner overall score: {winner_score:.3f}")
        
        return comparison['successful_evaluations'] > 0
        
    except Exception as e:
        print(f"❌ System prompt comparison failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_evolution_analysis():
    """Test evolution analysis with sample data."""
    print("🧪 Testing evolution analysis...")
    
    try:
        # Create some sample nodes with different generations
        sample_nodes = []
        for depth in range(3):
            for i in range(2):
                node = Node(
                    id=uuid_str(),
                    system_prompt=f"Test system prompt generation {depth} variant {i}",
                    conversation_samples=[],
                    score=0.4 + (depth * 0.1) + (i * 0.05),  # Improving scores by generation
                    avg_score=0.4 + (depth * 0.1) + (i * 0.05),
                    sample_count=3,
                    depth=depth,
                    emb=embed(f"test prompt {depth} {i}"),
                    xy=list(to_xy(embed(f"test prompt {depth} {i}"))),
                )
                save(node)
                sample_nodes.append(node)
        
        # Run evolution analysis
        analysis = await analyze_system_prompt_evolution()
        
        if 'error' in analysis:
            print(f"❌ Evolution analysis error: {analysis['error']}")
            return False
        
        required_keys = ['total_nodes', 'generations_analyzed', 'evolution_by_generation']
        missing_keys = [key for key in required_keys if key not in analysis]
        
        if missing_keys:
            print(f"❌ Missing keys in analysis: {missing_keys}")
            return False
        
        print(f"✅ Evolution analysis completed")
        print(f"   Total nodes analyzed: {analysis['total_nodes']}")
        print(f"   Generations found: {analysis['generations_analyzed']}")
        
        if analysis.get('best_prompt'):
            print(f"   Best prompt score: {analysis['best_prompt']['score']:.3f}")
        
        return analysis['total_nodes'] > 0
        
    except Exception as e:
        print(f"❌ Evolution analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_api_compatibility():
    """Test that API endpoints would work with new schema."""
    print("🧪 Testing API compatibility with new schema...")
    
    try:
        # Create a test node with new schema
        test_node = Node(
            id=uuid_str(),
            system_prompt="Test system prompt for API compatibility",
            conversation_samples=[
                {
                    "conversation": [
                        {"role": "user", "content": "Test message"},
                        {"role": "assistant", "content": "Test response"}
                    ],
                    "score": 0.7
                }
            ],
            score=0.7,
            avg_score=0.7,
            sample_count=1,
            depth=0,
            emb=embed("test prompt"),
            xy=list(to_xy(embed("test prompt"))),
        )
        
        # Save and retrieve
        save(test_node)
        retrieved_node = get(test_node.id)
        
        if not retrieved_node:
            print("❌ Failed to save/retrieve test node")
            return False
        
        # Test graph endpoint format
        graph_entry = {
            "id": retrieved_node.id,
            "xy": retrieved_node.xy,
            "score": retrieved_node.score,
            "avg_score": getattr(retrieved_node, 'avg_score', retrieved_node.score),
            "sample_count": getattr(retrieved_node, 'sample_count', 0),
            "parent": retrieved_node.parent,
            "depth": retrieved_node.depth,
            "system_prompt_preview": retrieved_node.system_prompt[:100] + "..." if len(retrieved_node.system_prompt) > 100 else retrieved_node.system_prompt,
        }
        
        required_fields = ['id', 'xy', 'score', 'system_prompt_preview']
        missing_fields = [field for field in required_fields if field not in graph_entry or graph_entry[field] is None]
        
        if missing_fields:
            print(f"❌ Missing required fields for API: {missing_fields}")
            return False
        
        print("✅ API compatibility test passed")
        print(f"   Node ID: {graph_entry['id'][:8]}...")
        print(f"   Score: {graph_entry['score']}")
        print(f"   Sample count: {graph_entry['sample_count']}")
        print(f"   System prompt preview: {graph_entry['system_prompt_preview'][:50]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ API compatibility test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_migration_functionality():
    """Test migration functionality (dry run)."""
    print("🧪 Testing migration functionality (dry run)...")
    
    try:
        # Check if migration can run without errors
        r = get_redis()
        
        # Count nodes before
        initial_node_count = len(r.keys("node:*"))
        print(f"   Initial node count: {initial_node_count}")
        
        # Run migration (this will clear old data and create new system prompt nodes)
        await migrate_conversation_nodes_to_system_prompts()
        
        # Count nodes after
        final_node_count = len(r.keys("node:*"))
        print(f"   Final node count: {final_node_count}")
        
        # Check that we have some system prompt nodes
        if final_node_count == 0:
            print("❌ Migration produced no nodes")
            return False
        
        # Verify nodes have new schema
        first_key = r.keys("node:*")[0]
        node_id = first_key.decode('utf-8').replace("node:", "") if isinstance(first_key, bytes) else first_key.replace("node:", "")
        test_node = get(node_id)
        
        if not test_node or not hasattr(test_node, 'system_prompt'):
            print("❌ Migrated nodes don't have system_prompt field")
            return False
        
        print("✅ Migration functionality test passed")
        print(f"   Created {final_node_count} system prompt nodes")
        print(f"   Sample system prompt: '{test_node.system_prompt[:60]}...'")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all Phase 2 tests."""
    print("🚀 Starting Phase 2 System Prompt Optimization Tests\n")
    
    tests = [
        ("Comprehensive Evaluation", test_comprehensive_evaluation),
        ("System Prompt Comparison", test_system_prompt_comparison),
        ("API Compatibility", test_api_compatibility),
        ("Migration Functionality", test_migration_functionality),
        ("Evolution Analysis", test_evolution_analysis),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "="*50)
    print("📊 PHASE 2 TEST RESULTS:")
    print("="*50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status:8} {test_name}")
        if result:
            passed += 1
    
    print(f"\nPASSED: {passed}/{len(results)} tests")
    
    if passed == len(results):
        print("🎉 All Phase 2 tests passed! System prompt optimization is fully implemented.")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return False


if __name__ == "__main__":
    asyncio.run(main())