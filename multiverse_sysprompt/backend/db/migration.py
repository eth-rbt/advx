"""
Database migration script to convert conversation-based nodes to system prompt-based nodes.
This migration transforms the old conversation turn optimization into system prompt optimization.
"""

import asyncio
import json
from typing import List, Dict, Optional
from backend.db.redis_client import get_redis
from backend.db.node_store import get, save
from backend.core.schemas import Node
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.agents.system_prompt_mutator import generate_initial_system_prompts
from backend.core.logger import get_logger

logger = get_logger(__name__)


async def migrate_conversation_nodes_to_system_prompts():
    """
    Main migration function to convert conversation nodes to system prompt nodes.
    """
    logger.info("Starting migration from conversation nodes to system prompt nodes")
    
    r = get_redis()
    
    # Get all existing nodes
    node_keys = r.keys("node:*")
    logger.info(f"Found {len(node_keys)} existing nodes to analyze")
    
    if len(node_keys) == 0:
        logger.info("No existing nodes found. Seeding with initial system prompts.")
        await seed_initial_system_prompts()
        return
    
    # Analyze existing nodes to understand the conversation patterns
    conversation_nodes = []
    for key in node_keys:
        node_id = key.decode('utf-8').replace("node:", "") if isinstance(key, bytes) else key.replace("node:", "")
        node_data = r.hgetall(f"node:{node_id}")
        if node_data:
            conversation_nodes.append((node_id, node_data))
    
    logger.info(f"Analyzing {len(conversation_nodes)} conversation nodes")
    
    # Extract conversation strategies from existing nodes
    strategy_patterns = analyze_conversation_strategies(conversation_nodes)
    
    # Generate system prompts based on discovered strategies
    system_prompts = await generate_system_prompts_from_strategies(strategy_patterns)
    
    # Clear old data and create new system prompt nodes
    await clear_old_data_and_migrate(system_prompts)
    
    logger.info("Migration completed successfully")


def analyze_conversation_strategies(conversation_nodes: List[tuple]) -> List[Dict]:
    """
    Analyze existing conversation nodes to identify successful strategies.
    """
    logger.info("Analyzing conversation strategies from existing nodes")
    
    strategies = []
    
    for node_id, node_data in conversation_nodes:
        try:
            # Extract key fields
            prompt = node_data.get('prompt', '').decode('utf-8') if isinstance(node_data.get('prompt'), bytes) else node_data.get('prompt', '')
            reply = node_data.get('reply', '').decode('utf-8') if isinstance(node_data.get('reply'), bytes) else node_data.get('reply', '')
            score = float(node_data.get('score', 0)) if node_data.get('score') else 0.0
            depth = int(node_data.get('depth', 0)) if node_data.get('depth') else 0
            
            if prompt and score > 0.6:  # Focus on successful conversations
                # Identify strategy patterns
                strategy_type = classify_conversation_strategy(prompt, reply, score)
                
                strategies.append({
                    'original_prompt': prompt,
                    'reply': reply,
                    'score': score,
                    'depth': depth,
                    'strategy_type': strategy_type,
                    'node_id': node_id
                })
                
        except Exception as e:
            logger.warning(f"Failed to analyze node {node_id}: {e}")
            continue
    
    logger.info(f"Identified {len(strategies)} successful conversation strategies")
    return strategies


def classify_conversation_strategy(prompt: str, reply: str, score: float) -> str:
    """
    Classify the type of conversational strategy based on prompt content.
    """
    prompt_lower = prompt.lower()
    
    # Simple keyword-based classification
    if any(word in prompt_lower for word in ['economic', 'trade', 'business', 'cost']):
        return 'economic_focus'
    elif any(word in prompt_lower for word in ['security', 'safety', 'protect', 'defense']):
        return 'security_focus'
    elif any(word in prompt_lower for word in ['understand', 'concern', 'worry', 'feel']):
        return 'empathetic_approach'
    elif any(word in prompt_lower for word in ['history', 'past', 'tradition', 'culture']):
        return 'historical_context'
    elif any(word in prompt_lower for word in ['benefit', 'mutual', 'together', 'partnership']):
        return 'collaborative_approach'
    else:
        return 'general_diplomatic'


async def generate_system_prompts_from_strategies(strategies: List[Dict]) -> List[str]:
    """
    Generate system prompts based on successful conversation strategies.
    """
    logger.info("Generating system prompts from successful strategies")
    
    # Group strategies by type
    strategy_groups = {}
    for strategy in strategies:
        strategy_type = strategy['strategy_type']
        if strategy_type not in strategy_groups:
            strategy_groups[strategy_type] = []
        strategy_groups[strategy_type].append(strategy)
    
    system_prompts = []
    
    # Generate system prompts for each strategy type
    strategy_templates = {
        'economic_focus': (
            "You are an economic strategist focused on practical solutions. Your goal is to "
            "convince Putin that peace negotiations serve Russia's economic interests. "
            "Emphasize trade opportunities, reduced military costs, and economic partnerships. "
            "Use concrete examples and focus on tangible benefits for Russia."
        ),
        'security_focus': (
            "You are a security-focused diplomat. Your goal is to address Putin's security "
            "concerns while moving toward peace negotiations. Acknowledge legitimate Russian "
            "security needs, propose specific security arrangements, and build confidence "
            "through step-by-step agreements."
        ),
        'empathetic_approach': (
            "You are a skilled diplomatic negotiator. Your goal is to guide Putin toward "
            "accepting peace negotiations through empathetic understanding and finding common ground. "
            "Acknowledge his concerns, build trust gradually, and focus on mutual benefits. "
            "Be respectful, patient, and strategic in your approach."
        ),
        'historical_context': (
            "You are a diplomatic historian focused on learning from the past. Your goal is to "
            "engage Putin by referencing historical precedents of successful peace negotiations. "
            "Draw parallels to previous conflicts resolved through diplomacy, emphasize Russia's "
            "historical role as a peace-making power, and connect current situations to past successes."
        ),
        'collaborative_approach': (
            "You are a collaborative problem-solver focused on partnership. Your goal is to "
            "present peace negotiations as a joint endeavor where both sides win. Emphasize "
            "shared challenges, mutual benefits, and collaborative solutions. Frame discussions "
            "as 'us working together' rather than adversarial negotiations."
        ),
        'general_diplomatic': (
            "You are a professional diplomat with deep experience in conflict resolution. "
            "Your goal is to guide conversations toward productive peace negotiations through "
            "careful, measured dialogue. Balance firmness with respect, acknowledge valid concerns, "
            "and gradually build toward collaborative solutions."
        )
    }
    
    # Add system prompts for each successful strategy type
    for strategy_type, strategies_of_type in strategy_groups.items():
        if len(strategies_of_type) > 0:  # Only include strategies that had examples
            avg_score = sum(s['score'] for s in strategies_of_type) / len(strategies_of_type)
            template = strategy_templates.get(strategy_type, strategy_templates['general_diplomatic'])
            
            logger.info(f"Adding {strategy_type} system prompt (avg score: {avg_score:.3f} from {len(strategies_of_type)} examples)")
            system_prompts.append(template)
    
    # Ensure we have at least 3 system prompts
    if len(system_prompts) < 3:
        logger.info("Adding default system prompts to reach minimum of 3")
        initial_prompts = await generate_initial_system_prompts(k=3)
        for prompt in initial_prompts:
            if prompt not in system_prompts:
                system_prompts.append(prompt)
    
    logger.info(f"Generated {len(system_prompts)} system prompts from strategies")
    return system_prompts[:5]  # Limit to top 5 to avoid overwhelming the system


async def clear_old_data_and_migrate(system_prompts: List[str]):
    """
    Clear old conversation nodes and create new system prompt nodes.
    """
    logger.info("Clearing old data and creating new system prompt nodes")
    
    r = get_redis()
    
    # Clear all existing nodes
    node_keys = r.keys("node:*")
    if node_keys:
        r.delete(*node_keys)
        logger.info(f"Cleared {len(node_keys)} old conversation nodes")
    
    # Clear frontier
    r.delete("frontier")
    logger.info("Cleared frontier queue")
    
    # Create new system prompt nodes
    from backend.db.frontier import push
    
    for i, system_prompt in enumerate(system_prompts):
        node = Node(
            id=uuid_str(),
            system_prompt=system_prompt,
            conversation_samples=[],
            score=0.5,  # Initial neutral score
            avg_score=0.5,
            sample_count=0,
            depth=0,  # All are root nodes initially
            emb=embed(system_prompt),
            xy=list(to_xy(embed(system_prompt))),
        )
        
        save(node)
        push(node.id, 1.0 - (i * 0.1))  # Slightly different priorities
        
        logger.info(f"Created system prompt node {node.id[:8]}... with prompt: '{system_prompt[:60]}...'")
    
    logger.info(f"Successfully migrated to {len(system_prompts)} system prompt nodes")


async def seed_initial_system_prompts():
    """
    Seed the system with initial system prompts when no existing data is found.
    """
    logger.info("No existing data found. Seeding with initial system prompts.")
    
    initial_prompts = await generate_initial_system_prompts(k=3)
    await clear_old_data_and_migrate(initial_prompts)


async def verify_migration():
    """
    Verify that the migration was successful.
    """
    logger.info("Verifying migration results")
    
    r = get_redis()
    node_keys = r.keys("node:*")
    
    logger.info(f"Found {len(node_keys)} nodes after migration")
    
    # Check a few nodes to ensure they have the new schema
    for i, key in enumerate(node_keys[:3]):
        node_id = key.decode('utf-8').replace("node:", "") if isinstance(key, bytes) else key.replace("node:", "")
        node = get(node_id)
        
        if node:
            has_system_prompt = hasattr(node, 'system_prompt') and node.system_prompt
            has_conversation_samples = hasattr(node, 'conversation_samples')
            
            logger.info(f"Node {i+1}: system_prompt={has_system_prompt}, conversation_samples={has_conversation_samples}")
            
            if has_system_prompt:
                logger.info(f"  System prompt preview: '{node.system_prompt[:50]}...'")
        else:
            logger.warning(f"Failed to load node {node_id}")
    
    logger.info("Migration verification completed")


async def main():
    """
    Main migration entry point.
    """
    try:
        await migrate_conversation_nodes_to_system_prompts()
        await verify_migration()
        logger.info("🎉 Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())