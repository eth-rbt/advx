import asyncio, time, requests, websockets, json, pytest

API = "http://localhost:8000"

@pytest.mark.asyncio
async def test_end_to_end():
    """Integration test: seed a node and verify child creation via WebSocket."""
    # Seed a root node
    response = requests.post(f"{API}/seed", json="Peace?")
    assert response.status_code == 200
    root = response.json()["seed_id"]
    
    # Connect to WebSocket and wait for first child node
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as ws:
        # Wait for a graph update message (child node creation)
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=30))
        
        # Verify it's a child of our root
        assert msg["parent"] == root
        assert "id" in msg
        assert "xy" in msg
        assert "score" in msg