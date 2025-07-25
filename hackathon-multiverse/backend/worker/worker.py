import asyncio
from backend.db.frontier import pop_max, push, size as frontier_size
from backend.db.node_store import get, save
from backend.db.redis_client import get_redis
from backend.agents.mutator import variants
from backend.agents.persona import call
from backend.agents.critic import score
from backend.core.schemas import Node, GraphUpdate
from backend.core.utils import uuid_str
from backend.core.logger import get_logger
from backend.core.embeddings import embed, to_xy
from backend.orchestrator.scheduler import calculate_priority, get_top_k_nodes
from backend.config.settings import settings
from backend.llm.openai_client import PolicyError

logger = get_logger(__name__)




async def log_worker_heartbeat():
    """Log worker status every 30 seconds with detailed stats."""
    r = get_redis()
    
    while True:
        await asyncio.sleep(30)  # More frequent for demo
        
        # Get current stats
        total_cost = r.get("usage:total_cost")
        current_cost = float(total_cost) if total_cost else 0.0
        f_size = frontier_size()
        node_keys = r.keys("node:*")
        node_count = len(node_keys)
        
        # Calculate depth distribution
        depth_counts = {}
        for node_key in node_keys[:20]:  # Sample first 20 for performance
            node = get(node_key.replace("node:", ""))
            if node:
                depth_counts[node.depth] = depth_counts.get(node.depth, 0) + 1
        
        depth_summary = " ".join([f"d{d}:{c}" for d, c in sorted(depth_counts.items())])
        
        logger.info(
            f"💓 HEARTBEAT: frontier={f_size} nodes={node_count} "
            f"cost=${current_cost:.2f}/${settings.daily_budget_usd:.2f} "
            f"depths=[{depth_summary}]"
        )


async def process_one_node():
    """Process a single node from the frontier."""
    # Before each expansion, check budget
    r = get_redis()
    current_cost = float(r.get("usage:total_cost") or 0.0)
    if current_cost >= settings.daily_budget_usd:
        logger.warning("Budget exhausted – sleeping 60 s")
        await asyncio.sleep(60)
        return True  # Return True to indicate we processed something (slept)

    # Pop highest priority node
    parent_id = pop_max()
    if not parent_id:
        return False  # No nodes to process

    # Get parent node
    parent = get(parent_id)
    if not parent:
        logger.error(f"Parent node {parent_id} not found")
        return True

    logger.info(f"🔄 PROCESSING node={parent_id[:8]}... depth={parent.depth} prompt='{parent.prompt[:50]}{'...' if len(parent.prompt) > 50 else ''}'")

    # Get top K nodes for similarity calculation
    top_k_nodes = get_top_k_nodes(k=10)
    top_k_embeddings = [n.emb for n in top_k_nodes if n.emb]
    
    logger.info(f"📊 CONTEXT: frontier_size={frontier_size()} total_nodes={len(r.keys('node:*'))} top_k_nodes={len(top_k_nodes)}")

    # Generate variants
    logger.info(f"🧬 MUTATOR: Generating 3 variants from '{parent.prompt[:30]}{'...' if len(parent.prompt) > 30 else ''}'")
    variant_list, mutator_usage = await variants(parent.prompt, k=3)
    logger.info(f"🧬 MUTATOR: Generated {len(variant_list)} variants, cost=${mutator_usage['cost']:.3f}")
    
    # Process each variant
    for i, variant_prompt in enumerate(variant_list, 1):
        child_id = uuid_str()  # Generate ID early for logging
        
        logger.info(f"  🎭 VARIANT {i}/3: child={child_id[:8]}... prompt='{variant_prompt[:40]}{'...' if len(variant_prompt) > 40 else ''}'")
        
        try:
            # Call persona
            logger.info(f"    🎯 PERSONA: Processing variant {i}...")
            reply, persona_usage = await call(variant_prompt)
            logger.info(f"    🎯 PERSONA: Reply='{reply[:30]}{'...' if len(reply) > 30 else ''}' tokens={persona_usage['prompt_tokens']}+{persona_usage['completion_tokens']} cost=${persona_usage['cost']:.3f}")

            # Get score from critic
            logger.info(f"    ⚖️  CRITIC: Scoring variant {i}...")
            s, critic_usage = await score(variant_prompt, reply)
            logger.info(f"    ⚖️  CRITIC: Score={s:.3f} tokens={critic_usage['prompt_tokens']}+{critic_usage['completion_tokens']} cost=${critic_usage['cost']:.3f}")
            
        except Exception as e:
            # Log error and skip this variant
            logger.error(f"    ❌ ERROR processing variant {i}: {e}")
            continue

        # Generate embedding and 2D projection
        emb = embed(variant_prompt)
        xy = list(to_xy(emb))  # Convert tuple to list for JSON serialization
        
        # Calculate total costs
        total_tokens_in = persona_usage['prompt_tokens'] + critic_usage['prompt_tokens']
        total_tokens_out = persona_usage['completion_tokens'] + critic_usage['completion_tokens']
        mut_cost_each = mutator_usage['cost'] / len(variant_list)
        total_cost = persona_usage['cost'] + critic_usage['cost'] + mut_cost_each
        
        # Log per-turn as specified
        logger.info(
            f"node={child_id} depth={parent.depth + 1} parent={parent.id} "
            f"tokens_in={total_tokens_in} tokens_out={total_tokens_out} "
            f"cost=${total_cost:.2f} personaCost=${persona_usage['cost']:.2f} "
            f"mutCost=${mut_cost_each:.2f} "
            f"criticCost=${critic_usage['cost']:.2f}"
        )

        # Create child node
        child = Node(
            id=child_id,  # Use the pre-generated ID
            prompt=variant_prompt,
            reply=reply,
            score=s,
            depth=parent.depth + 1,
            parent=parent.id,
            emb=emb,
            xy=xy,
            prompt_tokens=total_tokens_in,
            completion_tokens=total_tokens_out,
            agent_cost=total_cost,
        )

        # Calculate priority using scheduler
        logger.info(f"    🧮 SCHEDULER: Calculating priority...")
        priority = calculate_priority(
            child, parent_score=parent.score, top_k_embeddings=top_k_embeddings
        )
        
        # Calculate priority components for detailed logging
        delta_score = s - (parent.score or 0.0) if parent.score else 0.0
        from backend.orchestrator.scheduler import calculate_similarity
        similarity = calculate_similarity(child.emb, top_k_embeddings) if top_k_embeddings else 0.0
        
        logger.info(f"    🧮 SCHEDULER: score={s:.3f} δ_score={delta_score:+.3f} similarity={similarity:.3f} depth={child.depth} → priority={priority:.3f}")

        # Save child and push to frontier with calculated priority
        save(child)
        push(child.id, priority)
        
        logger.info(f"    💾 SAVED: child={child_id[:8]}... xy=({xy[0]:.2f}, {xy[1]:.2f}) priority={priority:.3f}")

        # Publish GraphUpdate to Redis for WebSocket broadcast
        graph_update = GraphUpdate(
            id=child.id, xy=child.xy, score=child.score, parent=child.parent
        )
        r = get_redis()
        r.publish("graph_updates", graph_update.model_dump_json())
        logger.info(f"    📡 BROADCAST: WebSocket update sent for {child_id[:8]}...")

    # Summary after processing all variants
    final_frontier_size = frontier_size()
    total_cost = float(r.get("usage:total_cost") or 0.0)
    logger.info(f"✅ COMPLETED: {parent_id[:8]}... → generated {len(variant_list)} children, frontier={final_frontier_size}, total_cost=${total_cost:.2f}")

    return True


async def main():
    """Main worker loop."""
    logger.info("Worker starting...")
    
    # Start heartbeat task
    heartbeat_task = asyncio.create_task(log_worker_heartbeat())

    try:
        while True:
            try:
                # Try to process a node
                processed = await process_one_node()

                if not processed:
                    # No nodes available, wait a bit
                    await asyncio.sleep(0.1)
                else:
                    # Small delay to prevent tight loop
                    await asyncio.sleep(0.01)

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
