import asyncio
from typing import List, Dict
from backend.db.frontier import pop_batch, push, size as frontier_size
from backend.db.node_store import get, save
from backend.db.redis_client import get_redis
from backend.agents.system_prompt_mutator import mutate_system_prompt
from backend.core.conversation_generator import evaluate_system_prompt
from backend.core.schemas import Node, GraphUpdate
from backend.core.utils import uuid_str
from backend.core.logger import get_logger
from backend.core.embeddings import embed, to_xy, refit_reducer_if_needed
from backend.orchestrator.scheduler import calculate_priority, get_top_k_nodes

logger = get_logger(__name__)

BATCH_SIZE = 20  # Process 20 system prompt nodes simultaneously


async def process_system_prompt_variant(system_prompt_variant: str, parent: Node, top_k_embeddings: List[List[float]]) -> Node:
    """Process a single system prompt variant: generate test conversations → evaluate → save."""
    child_id = uuid_str()
    
    try:
        # Evaluate the system prompt by generating multiple test conversations
        logger.debug(f"  🧪 Evaluating system prompt variant: '{system_prompt_variant[:50]}...'")
        
        evaluation_results = await evaluate_system_prompt(system_prompt_variant)
        
        avg_score = evaluation_results['avg_score']
        conversation_samples = evaluation_results['conversation_samples']
        sample_count = evaluation_results['sample_count']
        
        # Generate embedding and 2D projection of the system prompt text
        emb = embed(system_prompt_variant)
        xy = list(to_xy(emb))
        
        # Create child node with system prompt data
        child = Node(
            id=child_id,
            system_prompt=system_prompt_variant,
            conversation_samples=conversation_samples,
            score=avg_score,
            avg_score=avg_score,
            sample_count=sample_count,
            depth=parent.depth + 1,
            parent=parent.id,
            emb=emb,
            xy=xy,
        )
        
        # Calculate priority using scheduler (same formula, different meaning)
        priority = calculate_priority(
            child, parent_score=parent.score, top_k_embeddings=top_k_embeddings
        )
        
        # Save child and push to frontier with calculated priority
        save(child)
        push(child.id, priority)
        
        # Publish GraphUpdate to Redis for WebSocket broadcast
        graph_update = GraphUpdate(
            id=child.id, xy=child.xy, score=child.score, parent=child.parent
        )
        r = get_redis()
        r.publish("graph_updates", graph_update.model_dump_json())
        
        # Enhanced logging to show system prompt evaluation results
        prompt_preview = system_prompt_variant[:70] + "..." if len(system_prompt_variant) > 70 else system_prompt_variant
        success_rate = evaluation_results.get('success_rate', 0.0)
        avg_length = evaluation_results.get('avg_conversation_length', 0.0)
        
        logger.info(f"  ✅ {child_id[:8]}... AVG_SCORE={avg_score:.3f} priority={priority:.3f}")
        logger.info(f"     📝 System prompt: '{prompt_preview}'")
        logger.info(f"     📊 Results: {sample_count} conversations, {success_rate:.1%} success, {avg_length:.1f} avg turns")
        return child
        
    except Exception as e:
        logger.error(f"  ❌ Error processing system prompt variant {child_id[:8]}...: {e}")
        raise


async def process_system_prompt_node(parent_id: str, top_k_embeddings: List[List[float]]) -> List[Node]:
    """Process a single system prompt node: generate variants and evaluate them in parallel."""
    
    # Get parent node
    parent = get(parent_id)
    if not parent:
        logger.error(f"❌ Parent system prompt node {parent_id[:8]}... not found")
        return []
    
    parent_prompt_preview = parent.system_prompt[:50] + "..." if len(parent.system_prompt) > 50 else parent.system_prompt
    logger.info(f"🔄 Processing {parent_id[:8]}... depth={parent.depth} system_prompt='{parent_prompt_preview}'")
    
    try:
        # Log parent performance data
        if hasattr(parent, 'avg_score') and parent.avg_score:
            logger.info(f"  📊 Parent performance: avg_score={parent.avg_score:.3f}, samples={parent.sample_count}")
        else:
            logger.info(f"  📊 Root system prompt node - no parent performance data")
        
        # Generate 3 system prompt variants based on parent performance
        performance_data = {
            'avg_score': getattr(parent, 'avg_score', 0.0),
            'sample_count': getattr(parent, 'sample_count', 0),
            'conversation_samples': getattr(parent, 'conversation_samples', [])
        }
        
        system_prompt_variants = await mutate_system_prompt(parent.system_prompt, performance_data, k=3)
        logger.info(f"  🧬 Generated {len(system_prompt_variants)} system prompt variants")
        
        # Process all 3 system prompt variants in parallel
        # Note: Each variant will generate and evaluate multiple test conversations
        variant_tasks = [
            process_system_prompt_variant(system_prompt_variant, parent, top_k_embeddings)
            for system_prompt_variant in system_prompt_variants
        ]
        
        children = await asyncio.gather(*variant_tasks, return_exceptions=True)
        
        # Filter out exceptions and log successes
        successful_children = [child for child in children if isinstance(child, Node)]
        failed_count = len(children) - len(successful_children)
        
        if failed_count > 0:
            logger.warning(f"  ⚠️  {failed_count} system prompt variants failed for {parent_id[:8]}...")
        
        logger.info(f"  ✅ Completed {parent_id[:8]}... → {len(successful_children)} system prompt children created")
        return successful_children
        
    except Exception as e:
        logger.error(f"❌ Failed to process system prompt node {parent_id[:8]}...: {e}")
        return []


async def process_batch(node_ids: List[str]) -> int:
    """Process a batch of system prompt nodes in parallel."""
    if not node_ids:
        return 0
    
    logger.info(f"🚀 Processing batch of {len(node_ids)} system prompt nodes")
    
    # Get top K nodes for similarity calculation (shared across batch)
    top_k_nodes = get_top_k_nodes(k=10)
    top_k_embeddings = [n.emb for n in top_k_nodes if n.emb]
    
    # Process all system prompt nodes in parallel
    node_tasks = [
        process_system_prompt_node(node_id, top_k_embeddings)
        for node_id in node_ids
    ]
    
    results = await asyncio.gather(*node_tasks, return_exceptions=True)
    
    # Count total children created
    total_children = 0
    for result in results:
        if isinstance(result, list):
            total_children += len(result)
    
    logger.info(f"🎉 Batch complete: {len(node_ids)} system prompt nodes → {total_children} children, frontier={frontier_size()}")
    
    # Refit UMAP reducer if we have enough new data
    refit_reducer_if_needed()
    
    return total_children


async def log_worker_heartbeat():
    """Log worker status every 15 seconds with velocity tracking."""
    r = get_redis()
    last_node_count = 0
    
    while True:
        await asyncio.sleep(15)  # Faster for parallel processing
        
        f_size = frontier_size()
        node_keys = r.keys("node:*")
        node_count = len(node_keys)
        
        # Calculate velocity
        nodes_created = node_count - last_node_count
        velocity = nodes_created / 15  # nodes per second
        last_node_count = node_count
        
        logger.info(f"💓 SYSTEM PROMPT HEARTBEAT: frontier={f_size} system_prompt_nodes={node_count} velocity={velocity:.1f}n/s")


async def main():
    """Main system prompt optimization worker loop."""
    logger.info("🚀 System Prompt Optimization Worker starting...")
    logger.info("🎯 Mode: Optimizing mutator system prompts instead of conversation turns")
    
    # Start heartbeat task
    heartbeat_task = asyncio.create_task(log_worker_heartbeat())
    
    try:
        while True:
            try:
                # Pop a batch of high-priority system prompt nodes
                node_ids = pop_batch(BATCH_SIZE)
                
                if not node_ids:
                    # No system prompt nodes available, wait a bit
                    logger.info("😴 No system prompt nodes in frontier, sleeping...")
                    await asyncio.sleep(1)
                    continue
                
                # Process the entire batch of system prompt nodes in parallel
                children_created = await process_batch(node_ids)
                
                if children_created > 0:
                    # Small delay before next batch to prevent overwhelming
                    await asyncio.sleep(0.1)
                
            except KeyboardInterrupt:
                logger.info("Worker shutting down...")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(1)
                
    finally:
        # Cancel heartbeat task
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    asyncio.run(main())