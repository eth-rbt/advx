#!/usr/bin/env python3
"""
Live terminal monitor for hackathon multiverse.
Shows real-time statistics and activity in the terminal.
"""

import asyncio
import websockets
import json
import time
import os
import sys
from datetime import datetime
from collections import deque, defaultdict
from visualization.data_fetcher import DataFetcher

class LiveMonitor:
    def __init__(self):
        self.fetcher = DataFetcher()
        self.activity_log = deque(maxlen=20)
        self.node_count_history = deque(maxlen=60)  # Last 60 data points
        self.score_history = deque(maxlen=60)
        self.last_stats = {}
        
    def clear_screen(self):
        """Clear terminal screen."""
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def format_time(self):
        """Get formatted current time."""
        return datetime.now().strftime("%H:%M:%S")
    
    async def websocket_listener(self):
        """Listen to WebSocket updates."""
        uri = "ws://localhost:8000/ws"
        
        while True:
            try:
                async with websockets.connect(uri) as websocket:
                    self.activity_log.append(f"[{self.format_time()}] 🔗 WebSocket connected")
                    
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            score = data.get('score', 0)
                            node_id = data.get('id', 'unknown')[:8]
                            
                            score_emoji = "🔴" if score < 0.4 else "🟡" if score < 0.6 else "🟢"
                            self.activity_log.append(
                                f"[{self.format_time()}] {score_emoji} New node {node_id}... (score: {score:.3f})"
                            )
                            
                        except json.JSONDecodeError:
                            pass
                            
            except Exception as e:
                self.activity_log.append(f"[{self.format_time()}] ❌ WebSocket error: {str(e)[:50]}")
                await asyncio.sleep(5)  # Wait before reconnecting
    
    def update_stats(self):
        """Update statistics from API."""
        stats = self.fetcher.get_stats()
        
        if stats['total_nodes'] > 0:
            self.node_count_history.append(stats['total_nodes'])
            self.score_history.append(stats['avg_score'])
        
        self.last_stats = stats
    
    def render_dashboard(self):
        """Render the terminal dashboard."""
        self.clear_screen()
        
        # Header
        print("=" * 80)
        print("🧠 HACKATHON MULTIVERSE - LIVE MONITOR")
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        # Stats section
        stats = self.last_stats
        if stats:
            print(f"📊 STATISTICS:")
            print(f"   Total Nodes: {stats['total_nodes']}")
            print(f"   Average Score: {stats['avg_score']:.3f}")
            print(f"   Max Depth: {stats['max_depth']}")
            
            # Score distribution
            dist = stats.get('score_distribution', {})
            hostile = dist.get('hostile', 0)
            neutral = dist.get('neutral', 0)
            progress = dist.get('progress', 0)
            
            print(f"   Score Distribution:")
            print(f"     🔴 Hostile (0.0-0.4): {hostile}")
            print(f"     🟡 Neutral (0.4-0.6): {neutral}")
            print(f"     🟢 Progress (0.6-1.0): {progress}")
        
        print("\n" + "-" * 80)
        
        # Growth trend
        if len(self.node_count_history) > 1:
            current = self.node_count_history[-1]
            previous = self.node_count_history[-2] if len(self.node_count_history) > 1 else current
            growth = current - previous
            
            growth_emoji = "📈" if growth > 0 else "📉" if growth < 0 else "➡️"
            print(f"📊 GROWTH TREND: {growth_emoji}")
            print(f"   Nodes: {current} ({growth:+d} from last update)")
            
            if len(self.score_history) > 1:
                score_change = self.score_history[-1] - self.score_history[-2]
                score_emoji = "📈" if score_change > 0 else "📉" if score_change < 0 else "➡️"
                print(f"   Avg Score: {self.score_history[-1]:.3f} ({score_change:+.3f}) {score_emoji}")
        
        print("\n" + "-" * 80)
        
        # ASCII chart for node growth
        if len(self.node_count_history) > 5:
            print("📈 NODE GROWTH (last 20 updates):")
            self.render_ascii_chart(list(self.node_count_history)[-20:])
        
        print("\n" + "-" * 80)
        
        # Activity log
        print("📝 RECENT ACTIVITY:")
        for entry in list(self.activity_log)[-15:]:
            print(f"   {entry}")
        
        print("\n" + "=" * 80)
        print("Press Ctrl+C to stop monitoring")
    
    def render_ascii_chart(self, data):
        """Render a simple ASCII bar chart."""
        if not data or len(data) < 2:
            return
        
        # Normalize data to fit in ~30 characters width
        min_val = min(data)
        max_val = max(data)
        
        if max_val == min_val:
            return
        
        chart_width = 30
        
        for i, value in enumerate(data):
            # Normalize to 0-chart_width range
            normalized = int((value - min_val) / (max_val - min_val) * chart_width)
            bar = "█" * normalized + "░" * (chart_width - normalized)
            print(f"   {bar} {value}")
    
    async def run(self):
        """Main monitoring loop."""
        # Start WebSocket listener in background
        websocket_task = asyncio.create_task(self.websocket_listener())
        
        try:
            while True:
                self.update_stats()
                self.render_dashboard()
                await asyncio.sleep(2)  # Update every 2 seconds
                
        except KeyboardInterrupt:
            print("\n👋 Stopping monitor...")
            websocket_task.cancel()
            try:
                await websocket_task
            except asyncio.CancelledError:
                pass

async def main():
    monitor = LiveMonitor()
    await monitor.run()

if __name__ == "__main__":
    asyncio.run(main())