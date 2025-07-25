from backend.core.embeddings import embed, to_xy


def test_embedding_shape():
    """Test that embed returns 5D vector and to_xy returns 2D tuple."""
    # Test embedding dimension
    text = "test prompt for embedding"
    emb = embed(text)

    assert isinstance(emb, list), "embed should return a list"
    assert len(emb) == 5, f"Expected embedding of length 5, got {len(emb)}"
    assert all(
        isinstance(x, float) for x in emb
    ), "All embedding values should be floats"

    # Test 2D projection
    xy = to_xy(emb)

    assert isinstance(xy, tuple), "to_xy should return a tuple"
    assert len(xy) == 2, f"Expected 2D projection, got {len(xy)} dimensions"
    assert all(isinstance(x, float) for x in xy), "All xy values should be floats"
