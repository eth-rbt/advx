#!/usr/bin/env python3
"""
Analysis tool for exploration sessions.
Generates detailed reports on AI exploration patterns.
"""
import requests
import json
from collections import defaultdict, Counter
import statistics

API = "http://localhost:8000"

def analyze_exploration():
    """Analyze the current exploration state and generate insights."""
    print("🔍 EXPLORATION ANALYSIS")
    print("=" * 50)
    
    try:
        # Get all nodes
        graph = requests.get(f"{API}/graph").json()
        if not graph:
            print("❌ No nodes found in graph")
            return
            
        print(f"📊 Total nodes analyzed: {len(graph)}")
        
        # Build tree structure
        nodes_by_id = {node['id']: node for node in graph}
        children_map = defaultdict(list)
        root_nodes = []
        
        for node in graph:
            if node['parent']:
                children_map[node['parent']].append(node['id'])
            else:
                root_nodes.append(node['id'])
        
        print(f"🌱 Root nodes: {len(root_nodes)}")
        
        # Analyze tree depth and branching
        def calculate_depth(node_id, current_depth=0):
            depths = [current_depth]
            for child_id in children_map[node_id]:
                depths.extend(calculate_depth(child_id, current_depth + 1))
            return depths
        
        all_depths = []
        branching_factors = []
        
        for root_id in root_nodes:
            all_depths.extend(calculate_depth(root_id))
        
        # Calculate branching factors
        for node_id in nodes_by_id:
            children_count = len(children_map[node_id])
            if children_count > 0:  # Only count nodes that have children
                branching_factors.append(children_count)
        
        print(f"\n🌳 TREE STRUCTURE:")
        depth_counter = Counter(all_depths)
        max_depth = max(all_depths) if all_depths else 0
        for depth in range(max_depth + 1):
            count = depth_counter[depth]
            bar = "█" * min(30, count)
            print(f"   Depth {depth}: {count:3d} nodes {bar}")
        
        print(f"   Max depth: {max_depth}")
        print(f"   Avg depth: {statistics.mean(all_depths):.1f}")
        
        if branching_factors:
            print(f"\n🌿 BRANCHING ANALYSIS:")
            print(f"   Nodes with children: {len(branching_factors)}")
            print(f"   Avg branching factor: {statistics.mean(branching_factors):.1f}")
            print(f"   Max children per node: {max(branching_factors)}")
            print(f"   Min children per node: {min(branching_factors)}")
        
        # Score analysis
        scores = [node['score'] for node in graph if node['score'] is not None]
        if scores:
            print(f"\n📈 SCORE ANALYSIS:")
            print(f"   Avg score: {statistics.mean(scores):.3f}")
            print(f"   Score range: {min(scores):.3f} - {max(scores):.3f}")
            print(f"   Score std dev: {statistics.stdev(scores) if len(scores) > 1 else 0:.3f}")
            
            # Score by depth
            score_by_depth = defaultdict(list)
            for node in graph:
                if node['score'] is not None:
                    # Calculate node depth
                    depth = 0
                    current = node
                    while current['parent']:
                        depth += 1
                        current = nodes_by_id.get(current['parent'])
                        if not current:  # Safety check
                            break
                    score_by_depth[depth].append(node['score'])
            
            print(f"   Score trends by depth:")
            for depth in sorted(score_by_depth.keys()):
                depth_scores = score_by_depth[depth]
                avg_score = statistics.mean(depth_scores)
                print(f"     Depth {depth}: {avg_score:.3f} avg ({len(depth_scores)} nodes)")
        
        # Spatial analysis
        positions = [(node['xy'][0], node['xy'][1]) for node in graph if node['xy']]
        if positions:
            x_coords = [pos[0] for pos in positions]
            y_coords = [pos[1] for pos in positions]
            
            print(f"\n📍 SPATIAL DISTRIBUTION:")
            print(f"   X range: {min(x_coords):.2f} - {max(x_coords):.2f}")
            print(f"   Y range: {min(y_coords):.2f} - {max(y_coords):.2f}")
            print(f"   X spread: {max(x_coords) - min(x_coords):.2f}")
            print(f"   Y spread: {max(y_coords) - min(y_coords):.2f}")
        
        # Find most successful nodes (highest scoring with children)
        successful_nodes = []
        for node in graph:
            if node['score'] is not None and children_map[node['id']]:
                successful_nodes.append((node['score'], node['id'], len(children_map[node['id']])))
        
        if successful_nodes:
            successful_nodes.sort(reverse=True)
            print(f"\n🏆 TOP PERFORMING NODES (high score + children):")
            for i, (score, node_id, child_count) in enumerate(successful_nodes[:5]):
                print(f"   {i+1}. {node_id[:8]}... score={score:.3f} children={child_count}")
        
        # Find exploration frontiers (leaf nodes with high scores)
        leaf_nodes = []
        for node in graph:
            if not children_map[node['id']] and node['score'] is not None:
                leaf_nodes.append((node['score'], node['id']))
        
        if leaf_nodes:
            leaf_nodes.sort(reverse=True)
            print(f"\n🍃 TOP UNEXPLORED LEAVES (potential for expansion):")
            for i, (score, node_id) in enumerate(leaf_nodes[:5]):
                print(f"   {i+1}. {node_id[:8]}... score={score:.3f}")
        
    except Exception as e:
        print(f"❌ Analysis failed: {e}")

def main():
    print("🧮 Starting Exploration Analysis...")
    analyze_exploration()
    print("\n" + "=" * 50)
    print("✅ Analysis complete!")

if __name__ == "__main__":
    main()