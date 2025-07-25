import asyncio
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as redis
from backend.config.settings import settings
from backend.core.logger import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and Redis pub/sub."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.redis_client = None
        self.pubsub = None
        self.listener_task = None

    async def connect(self, websocket: WebSocket):
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)

        # Start Redis listener if this is the first connection
        if len(self.active_connections) == 1:
            await self._start_redis_listener()

        logger.info(
            f"WebSocket connected. Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        self.active_connections.discard(websocket)
        logger.info(
            f"WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

        # Stop Redis listener if no more connections
        if len(self.active_connections) == 0 and self.listener_task:
            self.listener_task.cancel()
            self.listener_task = None

    async def broadcast(self, message: str):
        """Send message to all connected WebSockets."""
        if not self.active_connections:
            return

        # Send to all connections concurrently
        disconnected = set()
        tasks = []

        for websocket in self.active_connections:
            tasks.append(self._send_to_websocket(websocket, message, disconnected))

        await asyncio.gather(*tasks)

        # Remove disconnected clients
        for ws in disconnected:
            self.disconnect(ws)

    async def _send_to_websocket(
        self, websocket: WebSocket, message: str, disconnected: Set[WebSocket]
    ):
        """Send message to a single WebSocket, track disconnections."""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.debug(f"WebSocket send error: {e}")
            disconnected.add(websocket)

    async def _start_redis_listener(self):
        """Start listening to Redis pub/sub channel."""
        self.redis_client = redis.Redis.from_url(
            settings.redis_url, decode_responses=True
        )
        self.pubsub = self.redis_client.pubsub()
        await self.pubsub.subscribe("graph_updates")

        self.listener_task = asyncio.create_task(self._listen_redis())
        logger.info("Started Redis pub/sub listener")

    async def _listen_redis(self):
        """Listen for Redis messages and broadcast to WebSockets."""
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    await self.broadcast(message["data"])
        except asyncio.CancelledError:
            logger.info("Redis listener cancelled")
            await self.pubsub.unsubscribe("graph_updates")
            await self.redis_client.close()
        except Exception as e:
            logger.error(f"Redis listener error: {e}")


# Global connection manager instance
manager: ConnectionManager = None


async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint handler."""
    global manager

    await manager.connect(websocket)

    try:
        # Keep connection open
        while True:
            # Just wait for client disconnect
            # We don't expect client messages in this implementation
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
