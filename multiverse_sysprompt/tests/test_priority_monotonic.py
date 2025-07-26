from backend.core.schemas import Node
from backend.orchestrator.scheduler import calculate_priority


def test_priority_monotonic():
    """Test that higher score gives higher priority when other factors are equal."""
    # Create two nodes identical except for score
    node1 = Node(
        id="node1",
        prompt="test prompt",
        score=0.9,
        depth=2,
        emb=[0.1, 0.2, 0.3, 0.4, 0.5],
    )

    node2 = Node(
        id="node2",
        prompt="test prompt",
        score=0.7,
        depth=2,
        emb=[0.1, 0.2, 0.3, 0.4, 0.5],
    )

    # Same parent score and embeddings for both
    parent_score = 0.6
    top_k_embeddings = [[0.1, 0.2, 0.3, 0.4, 0.5]]

    # Calculate priorities
    priority1 = calculate_priority(node1, parent_score, top_k_embeddings)
    priority2 = calculate_priority(node2, parent_score, top_k_embeddings)

    # Node with higher score should have higher priority
    assert priority1 > priority2, f"Expected {priority1} > {priority2}"
