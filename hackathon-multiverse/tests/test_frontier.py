from backend.db.frontier import push, pop_max
import uuid


def test_frontier_push_pop():
    ids = [str(uuid.uuid4()) for _ in range(3)]
    for i, nid in enumerate(ids):
        push(nid, priority=float(i))  # highest = last
    popped = pop_max()
    assert popped == ids[-1]
