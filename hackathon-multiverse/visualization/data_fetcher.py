"""
Data fetcher for hackathon multiverse visualization.
Fetches graph data from the backend API.
"""

import requests
import json
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class NodeData:
    id: str
    xy: Optional[List[float]]
    score: Optional[float]
    parent: Optional[str]
    depth: int = 0

class DataFetcher:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        
    def get_graph_data(self) -> List[NodeData]:
        """Fetch all nodes from the /graph endpoint."""
        try:
            response = requests.get(f"{self.base_url}/graph")
            response.raise_for_status()
            
            nodes = []
            raw_nodes = response.json()
            
            for node_data in raw_nodes:
                # Calculate depth by traversing parents
                depth = self._calculate_depth(node_data['id'], raw_nodes)
                
                node = NodeData(
                    id=node_data['id'],
                    xy=node_data.get('xy'),
                    score=node_data.get('score'),
                    parent=node_data.get('parent'),
                    depth=depth
                )
                nodes.append(node)
            
            return nodes
            
        except requests.RequestException as e:
            print(f"❌ Failed to fetch graph data: {e}")
            return []
    
    def _calculate_depth(self, node_id: str, all_nodes: List[Dict]) -> int:
        """Calculate depth by traversing parent chain."""
        depth = 0
        current_id = node_id
        visited = set()
        
        # Create lookup dict for efficiency
        node_lookup = {n['id']: n for n in all_nodes}
        
        while current_id and current_id in node_lookup and current_id not in visited:
            visited.add(current_id)
            node = node_lookup[current_id]
            parent_id = node.get('parent')
            
            if parent_id:
                depth += 1
                current_id = parent_id
            else:
                break
                
            # Safety break
            if depth > 50:
                break
        
        return depth
    
    def get_stats(self) -> Dict:
        """Get summary statistics about the graph."""
        nodes = self.get_graph_data()
        
        if not nodes:
            return {
                'total_nodes': 0,
                'avg_score': 0.0,
                'max_depth': 0,
                'score_distribution': {},
                'depth_distribution': {}
            }
        
        scores = [n.score for n in nodes if n.score is not None]
        depths = [n.depth for n in nodes]
        
        # Score distribution
        score_ranges = {'hostile': 0, 'neutral': 0, 'progress': 0}
        for score in scores:
            if score < 0.4:
                score_ranges['hostile'] += 1
            elif score < 0.6:
                score_ranges['neutral'] += 1
            else:
                score_ranges['progress'] += 1
        
        # Depth distribution
        depth_counts = {}
        for depth in depths:
            depth_counts[depth] = depth_counts.get(depth, 0) + 1
        
        return {
            'total_nodes': len(nodes),
            'avg_score': sum(scores) / len(scores) if scores else 0.0,
            'max_depth': max(depths) if depths else 0,
            'score_distribution': score_ranges,
            'depth_distribution': depth_counts,
            'timestamp': datetime.now().isoformat()
        }
    
    def get_best_conversations(self, limit: int = 10) -> List[NodeData]:
        """Get nodes with highest trajectory scores."""
        nodes = self.get_graph_data()
        
        # Filter and sort by score
        scored_nodes = [n for n in nodes if n.score is not None]
        scored_nodes.sort(key=lambda n: n.score, reverse=True)
        
        return scored_nodes[:limit]

if __name__ == "__main__":
    # Test the data fetcher
    fetcher = DataFetcher()
    
    print("🔍 Fetching graph data...")
    nodes = fetcher.get_graph_data()
    print(f"📊 Found {len(nodes)} nodes")
    
    print("\n📈 Statistics:")
    stats = fetcher.get_stats()
    for key, value in stats.items():
        if key != 'timestamp':
            print(f"  {key}: {value}")
    
    print(f"\n🏆 Top 5 conversations:")
    best = fetcher.get_best_conversations(5)
    for i, node in enumerate(best, 1):
        print(f"  {i}. Score: {node.score:.3f}, Depth: {node.depth}, ID: {node.id[:8]}...")