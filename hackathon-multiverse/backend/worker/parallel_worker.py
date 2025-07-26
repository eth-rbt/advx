import asyncio
from typing import List
from backend.db.frontier import pop_batch, push, size as frontier_size
from backend.db.node_store import get, save
from backend.db.redis_client import get_redis
from backend.agents.mutator import variants
from backend.agents.persona import call
from backend.agents.critic import score
from backend.core.schemas import Node, GraphUpdate
from backend.core.utils import uuid_str
from backend.core.logger import get_logger
from backend.core.embeddings import embed, to_xy, refit_reducer_if_needed
from backend.core.conversation import get_conversation_path, format_dialogue_history
from backend.orchestrator.scheduler import calculate_priority, get_top_k_nodes

logger = get_logger(__name__)

BATCH_SIZE = 20  # Process 20 nodes simultaneously


async def process_variant(variant_prompt: str, parent: Node, parent_conversation: List[dict], top_k_embeddings: List[List[float]]) -> Node:
    """Process a single variant: persona → critic → scheduler → save."""
    child_id = uuid_str()
    
    try:
        # Get persona response to the variant
        reply = await call(variant_prompt)
        
        # Build full conversation including this new exchange
        full_conversation = parent_conversation + [
            {"role": "user", "content": variant_prompt},
            {"role": "assistant", "content": reply}
        ]
        
        # Score the entire conversation trajectory
        variant_score, grader_reasoning = await score(full_conversation)
        
        # Generate embedding and 2D projection
        emb = embed(variant_prompt)
        xy = list(to_xy(emb))
        
        # Create child node
        child = Node(
            id=child_id,
            prompt=variant_prompt,
            reply=reply,
            score=variant_score,
            grader_reasoning=grader_reasoning,
            depth=parent.depth + 1,
            parent=parent.id,
            emb=emb,
            xy=xy,
        )
        
        # Calculate priority using scheduler
        priority = calculate_priority(
            child, parent_score=parent.score, top_k_embeddings=top_k_embeddings
        )
        
        # Save child and push to frontier with calculated priority
        save(child)
        push(child.id, priority)
        
        # Publish GraphUpdate to Redis for WebSocket broadcast
        graph_update = GraphUpdate(
            id=child.id, 
            xy=child.xy, 
            score=child.score,
            grader_reasoning=child.grader_reasoning,
            parent=child.parent,
            prompt=child.prompt,
            reply=child.reply,
            depth=child.depth,
            emb=child.emb
        )
        r = get_redis()
        r.publish("graph_updates", graph_update.model_dump_json())
        
        # Enhanced logging to show conversation-aware changes
        conv_turns = len(full_conversation) // 2
        prompt_preview = variant_prompt[:50] + "..." if len(variant_prompt) > 50 else variant_prompt
        reply_preview = reply[:40] + "..." if len(reply) > 40 else reply
        
        logger.info(f"  ✅ {child_id[:8]}... TRAJECTORY_SCORE={variant_score:.3f} priority={priority:.3f}")
        logger.info(f"     📝 Strategic prompt: '{prompt_preview}'")
        logger.info(f"     🎯 Putin replied: '{reply_preview}' (after {conv_turns} turns)")
        return child
        
    except Exception as e:
        logger.error(f"  ❌ Error processing variant {child_id[:8]}...: {e}")
        raise


async def process_node(parent_id: str, top_k_embeddings: List[List[float]]) -> List[Node]:
    """Process a single node: generate variants and process them in parallel."""
    
    # Get parent node
    parent = get(parent_id)
    if not parent:
        logger.error(f"❌ Parent node {parent_id[:8]}... not found")
        return []
    
    logger.info(f"🔄 Processing {parent_id[:8]}... depth={parent.depth} prompt='{parent.prompt[:40]}{'...' if len(parent.prompt) > 40 else ''}'")
    
    try:
        # Get full conversation path up to this parent
        conversation_path = get_conversation_path(parent_id)
        parent_conversation = format_dialogue_history(conversation_path)
        
        # Log conversation context
        conv_turns = len(parent_conversation) // 2
        if parent_conversation:
            last_reply = parent_conversation[-1]["content"][:60] + "..." if len(parent_conversation[-1]["content"]) > 60 else parent_conversation[-1]["content"]
            logger.info(f"  📚 Conversation context: {conv_turns} turns, last reply: '{last_reply}'")
        else:
            logger.info(f"  📚 Root node - no conversation context")
        
        # Generate 3 strategic variants based on full conversation
        variant_list = await variants(parent_conversation, k=3)
        logger.info(f"  🧬 Generated {len(variant_list)} strategic variants")
        
        # Process all 3 variants in parallel
        variant_tasks = [
            process_variant(variant_prompt, parent, parent_conversation, top_k_embeddings)
            for variant_prompt in variant_list
        ]
        
        children = await asyncio.gather(*variant_tasks, return_exceptions=True)
        
        # Filter out exceptions and log successes
        successful_children = [child for child in children if isinstance(child, Node)]
        failed_count = len(children) - len(successful_children)
        
        if failed_count > 0:
            logger.warning(f"  ⚠️  {failed_count} variants failed for {parent_id[:8]}...")
        
        logger.info(f"  ✅ Completed {parent_id[:8]}... → {len(successful_children)} children created")
        return successful_children
        
    except Exception as e:
        logger.error(f"❌ Failed to process node {parent_id[:8]}...: {e}")
        return []


async def process_batch(node_ids: List[str]) -> int:
    """Process a batch of nodes in parallel."""
    if not node_ids:
        return 0
    
    logger.info(f"🚀 Processing batch of {len(node_ids)} nodes")
    
    # Get top K nodes for similarity calculation (shared across batch)
    top_k_nodes = get_top_k_nodes(k=10)
    top_k_embeddings = [n.emb for n in top_k_nodes if n.emb]
    
    # Process all nodes in parallel
    node_tasks = [
        process_node(node_id, top_k_embeddings)
        for node_id in node_ids
    ]
    
    results = await asyncio.gather(*node_tasks, return_exceptions=True)
    
    # Count total children created
    total_children = 0
    for result in results:
        if isinstance(result, list):
            total_children += len(result)
    
    logger.info(f"🎉 Batch complete: {len(node_ids)} nodes → {total_children} children, frontier={frontier_size()}")
    
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
        
        logger.info(f"💓 HEARTBEAT: frontier={f_size} nodes={node_count} velocity={velocity:.1f}n/s")


async def main():
    """Main parallel worker loop."""
    logger.info("🚀 Parallel worker starting...")
    
    # Start heartbeat task
    heartbeat_task = asyncio.create_task(log_worker_heartbeat())
    
    try:
        while True:
            try:
                # Pop a batch of high-priority nodes
                node_ids = pop_batch(BATCH_SIZE)
                
                if not node_ids:
                    # No nodes available, wait a bit
                    logger.info("😴 No nodes in frontier, sleeping...")
                    await asyncio.sleep(1)
                    continue
                
                # Process the entire batch in parallel
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