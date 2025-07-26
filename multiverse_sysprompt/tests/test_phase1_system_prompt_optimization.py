#!/usr/bin/env python3
"""
Test script for Phase 1 system prompt optimization functionality.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.core.schemas import Node
from backend.agents.system_prompt_mutator import mutate_system_prompt, generate_initial_system_prompts
from backend.core.conversation_generator import evaluate_system_prompt
from backend.agents.mutator import variants
from backend.db.node_store import save, get
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy


async def test_system_prompt_mutator():
    """Test the system prompt mutator."""
    print("🧪 Testing system prompt mutator...")
    
    parent_prompt = "You are a diplomatic negotiator focused on finding common ground."
    performance_data = {'avg_score': 0.6, 'sample_count': 3}
    
    try:
        variants = await mutate_system_prompt(parent_prompt, performance_data, k=2)
        print(f"✅ Generated {len(variants)} system prompt variants")
        for i, variant in enumerate(variants):
            print(f"   Variant {i+1}: {variant[:80]}...")
        return True
    except Exception as e:
        print(f"❌ System prompt mutator failed: {e}")
        return False


async def test_initial_system_prompts():
    """Test initial system prompt generation.""" 
    print("🧪 Testing initial system prompt generation...")
    
    try:
        initial_prompts = await generate_initial_system_prompts(k=2)
        print(f"✅ Generated {len(initial_prompts)} initial system prompts")
        for i, prompt in enumerate(initial_prompts):
            print(f"   Initial {i+1}: {prompt[:80]}...")
        return True
    except Exception as e:
        print(f"❌ Initial system prompt generation failed: {e}")
        return False


async def test_conversation_generator():
    """Test the conversation generation and evaluation."""
    print("🧪 Testing conversation generator...")
    
    system_prompt = (
        "You are a diplomatic negotiator. Focus on finding common ground "
        "and building trust with Putin through respectful dialogue."
    )
    
    try:
        # This will generate test conversations and evaluate the system prompt
        evaluation = await evaluate_system_prompt(system_prompt)
        
        print(f"✅ System prompt evaluated successfully")
        print(f"   Average score: {evaluation['avg_score']:.3f}")
        print(f"   Sample count: {evaluation['sample_count']}")
        print(f"   Success rate: {evaluation.get('success_rate', 0):.1%}")
        print(f"   Avg conversation length: {evaluation.get('avg_conversation_length', 0):.1f} turns")
        
        return evaluation['sample_count'] > 0
    except Exception as e:
        print(f"❌ Conversation generator failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_modified_mutator():
    """Test the modified mutator with dynamic system prompt."""
    print("🧪 Testing modified mutator with dynamic system prompt...")
    
    system_prompt = "You are an economic strategist. Focus on trade benefits and economic partnerships."
    conversation_history = []
    
    try:
        message_variants = await variants(conversation_history, k=2, system_prompt=system_prompt)
        print(f"✅ Generated {len(message_variants)} message variants using custom system prompt")
        for i, variant in enumerate(message_variants):
            print(f"   Message {i+1}: {variant[:60]}...")
        return len(message_variants) > 0
    except Exception as e:
        print(f"❌ Modified mutator failed: {e}")
        return False


async def test_node_schema():
    """Test the new Node schema."""
    print("🧪 Testing new Node schema...")
    
    try:
        # Create a test node with new schema
        node = Node(
            id=uuid_str(),
            system_prompt="Test system prompt for diplomatic negotiations",
            conversation_samples=[{"conversation": [{"role": "user", "content": "test"}], "score": 0.5}],
            score=0.7,
            avg_score=0.7,
            sample_count=1,
            depth=1,
            emb=embed("test prompt"),
            xy=list(to_xy(embed("test prompt")))
        )
        
        # Test save and retrieve
        save(node)
        retrieved_node = get(node.id)
        
        if retrieved_node and retrieved_node.system_prompt == node.system_prompt:
            print("✅ Node schema save/retrieve works correctly")
            print(f"   System prompt: {retrieved_node.system_prompt[:50]}...")
            print(f"   Sample count: {retrieved_node.sample_count}")
            print(f"   Avg score: {retrieved_node.avg_score}")
            return True
        else:
            print("❌ Node schema save/retrieve failed")
            return False
    except Exception as e:
        print(f"❌ Node schema test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all Phase 1 tests."""
    print("🚀 Starting Phase 1 System Prompt Optimization Tests\n")
    
    tests = [
        ("System Prompt Mutator", test_system_prompt_mutator),
        ("Initial System Prompts", test_initial_system_prompts),
        ("Modified Message Mutator", test_modified_mutator),
        ("Node Schema", test_node_schema),
        ("Conversation Generator", test_conversation_generator),  # This one might take longer
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
    print("📊 PHASE 1 TEST RESULTS:")
    print("="*50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status:8} {test_name}")
        if result:
            passed += 1
    
    print(f"\nPASSED: {passed}/{len(results)} tests")
    
    if passed == len(results):
        print("🎉 All Phase 1 tests passed! Ready for Phase 2.")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return False


if __name__ == "__main__":
    asyncio.run(main())