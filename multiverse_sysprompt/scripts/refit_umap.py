#!/usr/bin/env python3
"""
Script to refit UMAP reducer on existing conversation data and update all node coordinates.
"""

import asyncio
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.embeddings import fit_reducer, to_xy
from backend.db.node_store import get_all_nodes, save
from backend.core.logger import get_logger

logger = get_logger(__name__)


async def refit_all_nodes():
    """Refit UMAP on all existing nodes and update their coordinates."""
    
    # Get all nodes
    nodes = get_all_nodes()
    if len(nodes) < 5:
        print(f"❌ Need at least 5 nodes to refit UMAP, only found {len(nodes)}")
        return
    
    print(f"📊 Found {len(nodes)} nodes")
    
    # Extract existing embeddings
    embeddings = [node.emb for node in nodes if node.emb]
    if len(embeddings) < 5:
        print(f"❌ Need at least 5 embeddings to refit UMAP, only found {len(embeddings)}")
        return
    
    print(f"🔧 Refitting UMAP on {len(embeddings)} existing embeddings...")
    
    # Fit UMAP reducer using existing embeddings (much faster)
    fit_reducer(embeddings=embeddings)
    
    print("📍 Updating all node coordinates with new UMAP projection...")
    
    # Update all node coordinates
    updated_count = 0
    for node in nodes:
        if node.emb:
            old_xy = node.xy
            new_xy = list(to_xy(node.emb))
            
            if old_xy != new_xy:
                node.xy = new_xy
                save(node)
                updated_count += 1
                
                if updated_count <= 5:  # Show first few updates
                    print(f"  📌 {node.id[:8]}... moved from ({old_xy[0]:.2f}, {old_xy[1]:.2f}) to ({new_xy[0]:.2f}, {new_xy[1]:.2f})")
    
    print(f"✅ Updated coordinates for {updated_count} nodes")
    print("🎯 UMAP refit complete! Visualization should now show semantic clustering.")


if __name__ == "__main__":
    asyncio.run(refit_all_nodes())