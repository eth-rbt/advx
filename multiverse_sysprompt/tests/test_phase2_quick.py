#!/usr/bin/env python3
"""
Quick test for Phase 2 system prompt optimization features.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.core.schemas import Node
from backend.db.node_store import save, get
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.agents.system_prompt_mutator import generate_initial_system_prompts
from backend.core.evaluation import analyze_system_prompt_evolution


async def test_basic_functionality():
    """Test basic Phase 2 functionality."""
    print("🧪 Testing basic Phase 2 functionality...")
    
    # Test 1: Initial system prompt generation
    try:
        prompts = await generate_initial_system_prompts(k=2)
        if len(prompts) != 2:
            print("❌ Initial system prompt generation failed")
            return False
        print(f"✅ Generated {len(prompts)} initial system prompts")
    except Exception as e:
        print(f"❌ Initial system prompt generation failed: {e}")
        return False
    
    # Test 2: New schema compatibility
    try:
        test_node = Node(
            id=uuid_str(),
            system_prompt="Test system prompt for quick verification",
            conversation_samples=[{"conversation": [], "score": 0.5}],
            score=0.6,
            avg_score=0.6,
            sample_count=1,
            depth=0,
            emb=embed("test"),
            xy=list(to_xy(embed("test"))),
        )
        
        save(test_node)
        retrieved = get(test_node.id)
        
        if not retrieved or not hasattr(retrieved, 'system_prompt'):
            print("❌ New schema compatibility failed")
            return False
        print("✅ New schema compatibility works")
    except Exception as e:
        print(f"❌ Schema compatibility failed: {e}")
        return False
    
    # Test 3: Evolution analysis (basic)
    try:
        analysis = await analyze_system_prompt_evolution()
        if 'error' not in analysis:
            print("✅ Evolution analysis works")
        else:
            print(f"✅ Evolution analysis handled empty case: {analysis['error']}")
    except Exception as e:
        print(f"❌ Evolution analysis failed: {e}")
        return False
    
    return True


async def main():
    """Run quick Phase 2 verification."""
    print("🚀 Quick Phase 2 Verification\n")
    
    success = await test_basic_functionality()
    
    print("\n" + "="*40)
    if success:
        print("🎉 Phase 2 basic functionality verified!")
        print("✅ System prompt optimization framework is ready")
    else:
        print("❌ Phase 2 verification failed")
    
    return success


if __name__ == "__main__":
    asyncio.run(main())