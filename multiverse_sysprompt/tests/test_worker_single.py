import asyncio
import threading
import time
import subprocess
from backend.db.redis_client import get_redis
from backend.db.node_store import get
from backend.worker.worker import main as worker_main


def test_worker_single():
    """Test that worker creates child nodes from seed."""
    # Clear Redis first
    r = get_redis()
    r.flushdb()

    # Run dev_seed.py to create root node
    result = subprocess.run(
        ["python", "scripts/dev_seed.py"], capture_output=True, text=True
    )
    assert result.returncode == 0, f"dev_seed.py failed: {result.stderr}"

    # Count initial nodes
    initial_nodes = len(r.keys("node:*"))
    assert initial_nodes == 1, "Should have exactly 1 root node"

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

    # Let worker run for 2 seconds
    time.sleep(2)

    # Stop worker
    stop_event.set()
    thread.join(timeout=1)

    # Check results
    final_nodes = r.keys("node:*")
    assert len(final_nodes) >= 2, f"Expected >= 2 nodes, got {len(final_nodes)}"

    # Check that at least one node has depth 1
    depth_1_found = False
    for node_key in final_nodes:
        node_id = node_key.replace("node:", "")
        node = get(node_id)
        if node and node.depth == 1:
            depth_1_found = True
            break

    assert depth_1_found, "Should have at least one node with depth 1"
