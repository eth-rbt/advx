import asyncio
import threading
import time
import subprocess
from backend.db.redis_client import get_redis
from backend.db.node_store import get
from backend.worker.worker import main as worker_main


def test_growth_depth():
    """Test that worker creates deep trees with embeddings after 30s."""
    # Clear Redis first
    r = get_redis()
    r.flushdb()

    # Run dev_seed.py to create root node and fit reducer
    result = subprocess.run(
        ["python", "scripts/dev_seed.py"], capture_output=True, text=True
    )
    assert result.returncode == 0, f"dev_seed.py failed: {result.stderr}"

    # Run worker in background thread
    stop_event = threading.Event()

    async def run_worker():
        """Run worker until stop event is set."""
        worker_task = asyncio.create_task(worker_main())
        while not stop_event.is_set():
            await asyncio.sleep(0.1)
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass

    def worker_thread():
        asyncio.run(run_worker())

    thread = threading.Thread(target=worker_thread)
    thread.start()

    # Let worker run for 30 seconds
    time.sleep(30)

    # Stop worker
    stop_event.set()
    thread.join(timeout=2)

    # Check results
    all_nodes = r.keys("node:*")
    assert len(all_nodes) >= 5, f"Expected >= 5 nodes after 30s, got {len(all_nodes)}"

    # Check frontier size
    from backend.db.frontier import pop_max, push

    frontier_count = 0
    while True:
        node_id = pop_max()
        if not node_id:
            break
        frontier_count += 1
        # Put it back for proper cleanup
        push(node_id, 0.5)

    assert frontier_count >= 5, f"Frontier should have >= 5 nodes, got {frontier_count}"

    # Check for deep nodes and embeddings
    max_depth = 0
    nodes_with_emb = 0
    nodes_with_xy = 0

    for node_key in all_nodes:
        node_id = node_key.replace("node:", "")
        node = get(node_id)
        if node:
            max_depth = max(max_depth, node.depth)
            if node.emb is not None:
                nodes_with_emb += 1
            if node.xy is not None:
                nodes_with_xy += 1

    assert max_depth >= 3, f"Expected max depth >= 3, got {max_depth}"
    assert nodes_with_emb == len(all_nodes), "All nodes should have embeddings"
    assert nodes_with_xy == len(all_nodes), "All nodes should have xy coordinates"
