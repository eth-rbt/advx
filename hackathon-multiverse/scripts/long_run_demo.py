#!/usr/bin/env python3
"""
100-node exploration demo with comprehensive monitoring.
Watches the AI explore a prompt space and logs detailed analytics.
"""
import asyncio
import time
import requests
import websockets
import json
from collections import defaultdict, deque
from datetime import datetime

API = "http://localhost:8000"

class ExplorationMonitor:
    def __init__(self):
        self.nodes = {}
        self.start_time = time.time()
        self.updates_received = 0
        self.depth_stats = defaultdict(int)
        self.score_history = deque(maxlen=50)  # Track recent scores
        self.parent_child_map = defaultdict(list)
        
    def process_update(self, update):
        """Process a WebSocket update and track statistics."""
        self.updates_received += 1
        node_id = update['id']
        self.nodes[node_id] = update
        
        # Track depth distribution
        if update.get('parent'):
            parent_node = self.nodes.get(update['parent'])
            if parent_node:
                # Calculate depth (parent depth + 1)
                parent_depth = getattr(parent_node, 'depth', 0)
                depth = parent_depth + 1
            else:
                depth = 1  # Child of unknown parent
        else:
            depth = 0  # Root node
            
        self.depth_stats[depth] += 1
        
        # Track parent-child relationships
        if update.get('parent'):
            self.parent_child_map[update['parent']].append(node_id)
        
        # Track score trends
        if update.get('score') is not None:
            self.score_history.append(update['score'])
    
    def print_stats(self, node_count_target):
        """Print current exploration statistics."""
        elapsed = time.time() - self.start_time
        nodes_per_sec = self.updates_received / elapsed if elapsed > 0 else 0
        
        print(f"\n📊 EXPLORATION STATS ({self.updates_received}/{node_count_target} nodes)")
        print(f"⏱️  Runtime: {elapsed:.1f}s | Rate: {nodes_per_sec:.1f} nodes/sec")
        
        # Depth distribution
        print("🌳 Depth Distribution:")
        for depth in sorted(self.depth_stats.keys()):
            count = self.depth_stats[depth]
            bar = "█" * min(20, count)
            print(f"   Depth {depth}: {count:3d} nodes {bar}")
        
        # Score trends
        if self.score_history:
            recent_avg = sum(self.score_history) / len(self.score_history)
            recent_max = max(self.score_history)
            recent_min = min(self.score_history)
            print(f"📈 Recent Scores: avg={recent_avg:.3f} max={recent_max:.3f} min={recent_min:.3f}")
        
        # Tree branching
        total_children = sum(len(children) for children in self.parent_child_map.values())
        avg_branching = total_children / len(self.parent_child_map) if self.parent_child_map else 0
        print(f"🌿 Branching: {len(self.parent_child_map)} parents, avg {avg_branching:.1f} children/parent")
        
        print("-" * 60)

def main():
    print("🚀 Starting 100-Node Exploration Demo...")
    print("This will run until 100 nodes are created or 10 minutes elapsed")
    print("=" * 60)
    
    # Seed the exploration
    prompt = "How can we create a more peaceful and sustainable world through technology and cooperation?"
    print(f"🌱 Seeding with: '{prompt}'")
    
    try:
        response = requests.post(f"{API}/seed", json={"prompt": prompt})
        response.raise_for_status()
        root_id = response.json()["seed_id"]
        print(f"✅ Root seeded: {root_id[:8]}...")
    except Exception as e:
        print(f"❌ Failed to seed: {e}")
        return
    
    # Monitor exploration
    monitor = ExplorationMonitor()
    target_nodes = 100
    max_time = 600  # 10 minutes
    
    async def watch_exploration():
        uri = "ws://localhost:8000/ws"
        last_stats_time = time.time()
        
        try:
            async with websockets.connect(uri) as ws:
                print(f"📡 Connected to WebSocket, monitoring exploration...")
                print(f"🎯 Target: {target_nodes} nodes | Max time: {max_time//60} minutes")
                print("=" * 60)
                
                while monitor.updates_received < target_nodes:
                    try:
                        # Wait for update with timeout
                        raw_message = await asyncio.wait_for(ws.recv(), timeout=30)
                        update = json.loads(raw_message)
                        
                        monitor.process_update(update)
                        
                        # Print periodic stats (every 10 nodes or 30 seconds)
                        now = time.time()
                        if (monitor.updates_received % 10 == 0 or 
                            now - last_stats_time > 30):
                            monitor.print_stats(target_nodes)
                            last_stats_time = now
                        
                        # Safety timeout
                        if now - monitor.start_time > max_time:
                            print(f"⏰ Reached maximum time limit ({max_time//60} minutes)")
                            break
                            
                    except asyncio.TimeoutError:
                        print("⏰ No updates for 30 seconds, exploration may be stalled")
                        monitor.print_stats(target_nodes)
                        
                        # Check if we should continue waiting
                        if time.time() - monitor.start_time > max_time:
                            print("⏰ Maximum time reached, stopping")
                            break
                        else:
                            print("⏳ Continuing to wait for updates...")
                            
        except Exception as e:
            print(f"❌ WebSocket error: {e}")
    
    # Run the monitoring
    asyncio.run(watch_exploration())
    
    # Final statistics
    print("\n" + "=" * 60)
    print("🏁 EXPLORATION COMPLETE!")
    monitor.print_stats(target_nodes)
    
    # Get final graph snapshot
    try:
        print("📸 Taking final graph snapshot...")
        graph = requests.get(f"{API}/graph").json()
        print(f"📊 Final graph contains {len(graph)} total nodes")
        
        # Show some example nodes
        print("\n🔍 Sample nodes from exploration:")
        for i, node in enumerate(graph[:5]):
            parent_text = f"→{node['parent'][:8] if node['parent'] else 'ROOT'}"
            print(f"   {i+1}. {node['id'][:8]}... {parent_text} score={node['score']:.3f} xy=({node['xy'][0]:.2f},{node['xy'][1]:.2f})")
        
        if len(graph) > 5:
            print(f"   ... and {len(graph) - 5} more nodes")
            
    except Exception as e:
        print(f"❌ Failed to get final graph: {e}")
    
    print("\n✨ Demo complete! Check the worker logs for detailed agent interactions.")
    print("💡 Tip: Run with worker logs visible to see the AI reasoning process")

if __name__ == "__main__":
    main()