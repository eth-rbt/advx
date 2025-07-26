import numpy as np
from typing import List, Optional, Dict
from backend.config.settings import settings
from backend.core.schemas import Node, FocusZone
from backend.db.node_store import get, save
from backend.db.redis_client import get_redis
from backend.db.frontier import push
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.core.logger import get_logger
from backend.agents.mutator import variants as a_variants

logger = get_logger(__name__)


def calculate_similarity(vec: List[float], other_vecs: List[List[float]]) -> float:
    """Calculate average cosine similarity to other vectors."""
    if not vec or not other_vecs:
        return 0.0

    vec_array = np.array(vec)
    vec_norm = np.linalg.norm(vec_array)

    if vec_norm == 0:
        return 0.0

    similarities = []
    for other in other_vecs:
        other_array = np.array(other)
        other_norm = np.linalg.norm(other_array)

        if other_norm == 0:
            continue

        cosine_sim = np.dot(vec_array, other_array) / (vec_norm * other_norm)
        similarities.append(cosine_sim)

    return np.mean(similarities) if similarities else 0.0


def get_top_k_nodes(k: int = 10) -> List[Node]:
    """Get top K nodes by score from Redis."""
    r = get_redis()
    node_keys = r.keys("node:*")

    nodes = []
    for key in node_keys[: k * 2]:  # Get more than K to filter
        node_id = key.replace("node:", "")
        node = get(node_id)
        if node and node.score is not None:
            nodes.append(node)

    # Sort by score and return top K
    nodes.sort(key=lambda n: n.score or 0.0, reverse=True)
    return nodes[:k]


def calculate_priority(
    node: Node,
    parent_score: Optional[float] = None,
    top_k_embeddings: Optional[List[List[float]]] = None,
) -> float:
    """
    Calculate priority for a node.
    Priority = S + λ_trend*ΔS - λ_sim - λ_depth*depth
    """
    # Base score
    score = node.score or 0.0

    # Calculate delta score (improvement over parent)
    delta_score = 0.0
    if parent_score is not None and node.score is not None:
        delta_score = node.score - parent_score

    # Calculate similarity penalty
    similarity = 0.0
    if node.emb and top_k_embeddings:
        similarity = calculate_similarity(node.emb, top_k_embeddings)

    # Calculate priority
    priority = (
        score
        + settings.lambda_trend * delta_score
        - settings.lambda_sim * similarity
        - settings.lambda_depth * node.depth
    )

    logger.debug(
        f"Priority calc for {node.id}: "
        f"score={score:.3f}, delta={delta_score:.3f}, "
        f"sim={similarity:.3f}, depth={node.depth} -> {priority:.3f}"
    )

    return float(priority)  # Convert numpy float to Python float


def point_in_polygon(point: List[float], polygon: List[List[float]]) -> bool:
    """Check if a point is inside a polygon using ray casting algorithm."""
    x, y = point
    n = len(polygon)
    inside = False

    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside


async def boost_or_seed(payload: FocusZone) -> Dict[str, any]:
    """
    Either boost existing nodes in the polygon or seed new ones if empty.
    """
    r = get_redis()
    polygon = payload.poly
    mode = payload.mode

    # Find all nodes with xy coordinates
    nodes_in_polygon = []
    all_node_keys = r.keys("node:*")

    for node_key in all_node_keys:
        node_id = node_key.replace("node:", "")
        node = get(node_id)

        if node and node.xy:
            if point_in_polygon(node.xy, polygon):
                nodes_in_polygon.append(node)

    if nodes_in_polygon:
        # Boost existing nodes by multiplying their frontier priority
        boost_factor = 2.0 if mode == "explore" else 1.5

        for node in nodes_in_polygon:
            # Get current priority and boost it
            current_priority = r.zscore("frontier", node.id)
            if current_priority is not None:
                new_priority = float(current_priority) * boost_factor
                push(node.id, new_priority)

        logger.info(f"Boosted {len(nodes_in_polygon)} nodes in focus zone")
        return {"status": "boosted", "nodes_affected": len(nodes_in_polygon)}
    else:
        # No nodes in polygon - seed a new one
        # Calculate centroid of polygon
        centroid_x = sum(p[0] for p in polygon) / len(polygon)
        centroid_y = sum(p[1] for p in polygon) / len(polygon)

        # Create a seed prompt based on centroid position
        # This is a simple heuristic - in real app would be more sophisticated
        seed_prompt = (
            f"Explore area at coordinates ({centroid_x:.2f}, {centroid_y:.2f})"
        )

        # Generate variant using mutator
        prompt_variants, _ = await a_variants(seed_prompt, k=1)
        seed_text = prompt_variants[0]

        # Create new node
        emb = embed(seed_text)
        xy = list(to_xy(emb))

        # Adjust xy to be near centroid
        # Simple approach: blend embedding projection with centroid
        xy[0] = (xy[0] + centroid_x) / 2
        xy[1] = (xy[1] + centroid_y) / 2

        node = Node(
            id=uuid_str(),
            prompt=seed_text,
            depth=1,
            score=0.5,  # Default score
            emb=emb,
            xy=xy,
        )

        # Save and push to frontier
        save(node)
        push(node.id, 1.0)  # High priority for new exploration

        logger.info(f"Seeded new node {node.id} in focus zone")
        return {"status": "seeded", "nodes_affected": 1}
