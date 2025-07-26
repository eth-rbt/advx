import openai
import numpy as np
import pickle
import os
from typing import List, Tuple, Optional
from umap import UMAP
from backend.core.logger import get_logger
from backend.config.settings import settings
from backend.db.node_store import get_all_nodes

logger = get_logger(__name__)

# Global UMAP reducer instance
_reducer: Optional[UMAP] = None
_reducer_file = "umap_reducer.pkl"


def embed(text: str) -> List[float]:
    """Generate semantic embeddings using OpenAI's text-embedding-3-small model."""
    try:
        client = openai.OpenAI(
            api_key=settings.openai_api_key,
            timeout=30.0  # 30 second timeout
        )
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=[text]
        )
        return response.data[0].embedding
    except Exception as e:
        logger.warning(f"OpenAI embedding failed: {e}, using fallback")
        return _create_fallback_embedding(text)


def _create_fallback_embedding(text: str, dimensions: int = 1536) -> List[float]:
    """Create a simple hash-based embedding as fallback."""
    import hashlib
    import struct
    
    # Create a deterministic hash of the text
    hash_obj = hashlib.md5(text.encode('utf-8'))
    hash_bytes = hash_obj.digest()
    
    # Convert to float values
    embedding = []
    for i in range(0, dimensions, 4):
        # Take 4 bytes at a time and convert to float
        byte_chunk = hash_bytes[(i // 4) % len(hash_bytes):(i // 4) % len(hash_bytes) + 4]
        if len(byte_chunk) < 4:
            byte_chunk = byte_chunk + b'\x00' * (4 - len(byte_chunk))
        
        # Convert bytes to float and normalize to [-1, 1]
        int_val = struct.unpack('i', byte_chunk)[0]
        float_val = int_val / (2**31 - 1)  # Normalize to [-1, 1]
        embedding.append(float_val)
    
    return embedding[:dimensions]


def _load_reducer() -> Optional[UMAP]:
    """Load saved UMAP reducer from disk."""
    global _reducer
    if _reducer is not None:
        return _reducer
        
    if os.path.exists(_reducer_file):
        try:
            with open(_reducer_file, 'rb') as f:
                _reducer = pickle.load(f)
            logger.info("Loaded existing UMAP reducer from disk")
            return _reducer
        except Exception as e:
            logger.warning(f"Failed to load UMAP reducer: {e}")
    
    return None


def _save_reducer(reducer: UMAP) -> None:
    """Save UMAP reducer to disk."""
    try:
        with open(_reducer_file, 'wb') as f:
            pickle.dump(reducer, f)
        logger.info("Saved UMAP reducer to disk")
    except Exception as e:
        logger.error(f"Failed to save UMAP reducer: {e}")


def fit_reducer(prompts: List[str]) -> None:
    """Fit UMAP reducer on conversation prompts for semantic clustering."""
    global _reducer
    
    if len(prompts) < 2:
        logger.warning("Need at least 2 prompts to fit UMAP reducer")
        return
    
    logger.info(f"Fitting UMAP reducer on {len(prompts)} prompts...")
    
    try:
        # Generate embeddings for all prompts
        embeddings = []
        for prompt in prompts:
            emb = embed(prompt)
            embeddings.append(emb)
        
        # Fit UMAP with parameters optimized for conversation clustering
        _reducer = UMAP(
            n_neighbors=min(15, len(prompts) - 1),  # Adaptive to data size
            min_dist=0.1,                           # Allow some overlap for related conversations
            n_components=2,                         # 2D output for visualization
            metric='cosine',                        # Good for text embeddings
            random_state=42                         # Reproducible results
        )
        
        # Fit the reducer
        _reducer.fit(np.array(embeddings))
        
        # Save for future use
        _save_reducer(_reducer)
        
        logger.info("UMAP reducer fitted successfully")
        
    except Exception as e:
        logger.error(f"Failed to fit UMAP reducer: {e}")
        _reducer = None


def refit_reducer_if_needed() -> None:
    """Refit UMAP reducer if we have new data and sufficient nodes."""
    try:
        nodes = get_all_nodes() 
        if len(nodes) < 10:  # Don't refit for small datasets
            return
            
        # Check if we need to refit (every 50 nodes or if no reducer exists)
        if _load_reducer() is None or len(nodes) % 50 == 0:
            prompts = [node.prompt for node in nodes if node.prompt]
            if len(prompts) >= 10:
                logger.info(f"Refitting UMAP reducer with {len(prompts)} prompts")
                fit_reducer(prompts)
                
    except Exception as e:
        logger.error(f"Failed to refit UMAP reducer: {e}")


def to_xy(vec: List[float]) -> Tuple[float, float]:
    """Project high-dimensional embedding to 2D using UMAP for semantic clustering."""
    global _reducer
    
    # Try to load existing reducer
    if _reducer is None:
        _reducer = _load_reducer()
    
    # If no reducer available, fall back to simple projection
    if _reducer is None:
        logger.debug("No UMAP reducer available, using fallback projection")
        if len(vec) >= 2:
            # Simple normalization to [-2, 2] range for visualization
            x = (vec[0] - 0.5) * 4
            y = (vec[1] - 0.5) * 4
            return (x, y)
        else:
            return (0.0, 0.0)
    
    try:
        # Use UMAP to project to 2D
        vec_array = np.array([vec])
        xy = _reducer.transform(vec_array)[0]
        
        # Scale to reasonable range for visualization ([-3, 3])
        x_scaled = float(xy[0]) 
        y_scaled = float(xy[1])
        
        return (x_scaled, y_scaled)
        
    except Exception as e:
        logger.warning(f"UMAP projection failed: {e}, falling back to simple projection")
        # Fallback to simple projection
        if len(vec) >= 2:
            x = (vec[0] - 0.5) * 4
            y = (vec[1] - 0.5) * 4
            return (x, y)
        else:
            return (0.0, 0.0)
