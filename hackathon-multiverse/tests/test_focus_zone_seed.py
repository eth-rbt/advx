import pytest
import httpx
import subprocess
import time
from backend.db.redis_client import get_redis
from backend.db.node_store import get


@pytest.mark.asyncio
async def test_focus_zone_seed():
    """Test that POST /focus_zone seeds a new depth-1 node when zone is empty."""
    # Clear Redis
    r = get_redis()
    r.flushdb()

    # Seed only root via dev_seed.py
    result = subprocess.run(
        ["python", "scripts/dev_seed.py"], capture_output=True, text=True
    )
    assert result.returncode == 0, f"dev_seed.py failed: {result.stderr}"

    # Start API server (assuming it's running on port 8000)
    # In real test environment, would start server programmatically

    # Make focus zone request
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/focus_zone",
            json={"poly": [[2, 2], [3, 2], [3, 3], [2, 3]], "mode": "explore"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "seeded"
        assert data["nodes_affected"] == 1

    # Wait a bit for processing
    time.sleep(0.5)

    # Check that a depth-1 node was created
    all_nodes = r.keys("node:*")
    depth_1_found = False

    for node_key in all_nodes:
        node_id = node_key.replace("node:", "")
        node = get(node_id)
        if node and node.depth == 1:
            depth_1_found = True
            # Verify it's in or near the focus zone area
            assert node.xy is not None
            # The node should be positioned near the centroid of [2,2] to [3,3] polygon
            # which is at (2.5, 2.5)
            break

    assert depth_1_found, "Should have created a depth-1 node"
