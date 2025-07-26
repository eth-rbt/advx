#!/usr/bin/env python3
"""
Quick verification test for system prompt optimization.
Ensures all components are working without long-running tests.
"""

import asyncio
import pytest
from backend.core.schemas import Node
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.db.node_store import save, get, get_all_nodes
from backend.db.redis_client import get_redis
from backend.agents.system_prompt_mutator import generate_initial_system_prompts, mutate_system_prompt
from backend.core.conversation_generator import should_stop_conversation
from backend.core.logger import get_logger

logger = get_logger(__name__)


@pytest.mark.asyncio
async def test_schema_integration():
    """Test that all components work with new schema."""
    # 1. Generate initial system prompts
    prompts = await generate_initial_system_prompts(k=2)
    assert len(prompts) == 2
    logger.info("✅ System prompt generation works")
    
    # 2. Create and save node with new schema
    node = Node(
        id=uuid_str(),
        system_prompt=prompts[0],
        conversation_samples=[],
        score=0.5,
        avg_score=0.5,
        sample_count=0,
        depth=0,
        emb=embed(prompts[0]),
        xy=list(to_xy(embed(prompts[0]))),
    )
    save(node)
    
    # 3. Retrieve and verify
    retrieved = get(node.id)
    assert retrieved is not None
    assert retrieved.system_prompt == prompts[0]
    assert hasattr(retrieved, 'conversation_samples')
    assert not hasattr(retrieved, 'prompt')  # Old field shouldn't exist
    assert not hasattr(retrieved, 'reply')   # Old field shouldn't exist
    logger.info("✅ Node storage with new schema works")
    
    # 4. Test mutation
    variants = await mutate_system_prompt(prompts[0], {'avg_score': 0.5}, k=1)
    assert len(variants) == 1
    assert variants[0] != prompts[0]
    logger.info("✅ System prompt mutation works")
    
    # 5. Test plateau detection
    scores = [0.4, 0.5, 0.52, 0.53]
    should_stop, final = await should_stop_conversation(scores, min_turns=3)
    assert should_stop == True
    logger.info("✅ Plateau detection works")
    
    return True


async def verify_all_files_updated():
    """Verify that key files use the new schema."""
    issues = []
    
    # Check if old fields are still referenced
    import os
    import re
    
    files_to_check = [
        'backend/core/embeddings.py',
        'backend/core/conversation.py',
        'scripts/dev_seed.py',
    ]
    
    old_patterns = [r'node\.prompt\b', r'node\.reply\b', r'\.prompt\s*=', r'\.reply\s*=']
    
    for file_path in files_to_check:
        full_path = os.path.join('/Users/matthieuhuss/AdventureX-Final/hackathon-multiverse', file_path)
        if os.path.exists(full_path):
            with open(full_path, 'r') as f:
                content = f.read()
                for pattern in old_patterns:
                    if re.search(pattern, content):
                        # Check if it's in a compatibility section
                        if 'compatibility' not in content[max(0, content.find(pattern)-100):content.find(pattern)+100]:
                            issues.append(f"{file_path} still contains pattern: {pattern}")
    
    if issues:
        logger.warning(f"Found {len(issues)} potential issues:")
        for issue in issues:
            logger.warning(f"  - {issue}")
    else:
        logger.info("✅ All checked files appear to use new schema")
    
    return len(issues) == 0


async def main():
    """Run quick verification."""
    logger.info("🚀 Running quick verification tests")
    
    # Clear Redis first
    r = get_redis()
    for key in r.keys("node:*"):
        r.delete(key)
    
    # Run tests
    schema_ok = await test_schema_integration()
    files_ok = await verify_all_files_updated()
    
    if schema_ok and files_ok:
        logger.info("\n✅ VERIFICATION COMPLETE - System prompt optimization is properly integrated!")
        return True
    else:
        logger.error("\n❌ VERIFICATION FAILED - Some components need attention")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)