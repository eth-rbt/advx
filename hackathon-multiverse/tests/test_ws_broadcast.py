import asyncio
import json
import threading
import websockets
import pytest
import redis
from backend.config.settings import settings
from backend.core.schemas import GraphUpdate
import uvicorn
from backend.api.main import app
from backend.api import websocket


@pytest.mark.asyncio
async def test_ws_broadcast():
    """Test that WebSocket relays Redis pub/sub messages to clients."""
    # Initialize the connection manager
    websocket.manager = websocket.ConnectionManager()

    # Start API server in background thread
    config = uvicorn.Config(app, host="127.0.0.1", port=8001, log_level="error")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run)
    thread.start()

    # Give server time to start
    await asyncio.sleep(1)

    try:
        # Connect WebSocket client
        async with websockets.connect("ws://localhost:8001/ws") as ws:
            # Give WebSocket time to establish
            await asyncio.sleep(0.5)

            # Publish test message to Redis
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            test_update = GraphUpdate(
                id="test-node-123", xy=[0.5, 0.5], score=0.8, parent="parent-456"
            )
            r.publish("graph_updates", test_update.model_dump_json())

            # Wait for message with timeout
            try:
                message = await asyncio.wait_for(ws.recv(), timeout=1.0)
                received = json.loads(message)

                # Verify message contents
                assert received["id"] == "test-node-123"
                assert received["xy"] == [0.5, 0.5]
                assert received["score"] == 0.8
                assert received["parent"] == "parent-456"
            except asyncio.TimeoutError:
                pytest.fail("WebSocket did not receive message within 1 second")

    finally:
        # Stop server
        server.should_exit = True
        thread.join(timeout=2)
