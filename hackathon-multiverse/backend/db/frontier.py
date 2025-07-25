from backend.db.redis_client import get_redis

r = get_redis()
FRONTIER_KEY = "frontier"


def push(node_id: str, priority: float) -> None:
    r.zadd(FRONTIER_KEY, {node_id: priority})


def pop_max() -> str | None:
    res = r.zpopmax(FRONTIER_KEY, 1)
    return res[0][0] if res else None


def size() -> int:
    """Return current number of items in the frontier sorted-set."""
    return int(r.zcard(FRONTIER_KEY))


def pop_batch(count: int) -> list[str]:
    """Pop up to count highest priority nodes from the frontier."""
    result = r.zpopmax(FRONTIER_KEY, count)
    return [node_id for node_id, priority in result]
