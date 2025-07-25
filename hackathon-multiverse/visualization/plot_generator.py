#!/usr/bin/env python3
"""
Static plot generator for hackathon multiverse analysis.
Creates matplotlib visualizations of the exploration data.
"""

import matplotlib.pyplot as plt
import numpy as np
from typing import List, Dict, Tuple
from visualization.data_fetcher import DataFetcher, NodeData
import seaborn as sns
from collections import defaultdict

class PlotGenerator:
    def __init__(self):
        self.fetcher = DataFetcher()
        
        # Set up plotting style
        plt.style.use('dark_background')
        sns.set_palette("viridis")
        
    def create_semantic_scatter(self, save_path: str = "semantic_space.png"):
        """Create 2D scatter plot of semantic space exploration."""
        nodes = self.fetcher.get_graph_data()
        
        if not nodes:
            print("No nodes to plot")
            return
        
        # Filter nodes with XY coordinates
        positioned_nodes = [n for n in nodes if n.xy and len(n.xy) == 2]
        
        if not positioned_nodes:
            print("No positioned nodes to plot")
            return
        
        fig, ax = plt.subplots(figsize=(12, 10))
        
        # Extract data
        x_coords = [n.xy[0] for n in positioned_nodes]
        y_coords = [n.xy[1] for n in positioned_nodes]
        scores = [n.score if n.score is not None else 0.5 for n in positioned_nodes]
        depths = [n.depth for n in positioned_nodes]
        
        # Create scatter plot
        scatter = ax.scatter(
            x_coords, y_coords,
            c=scores,
            s=[20 + d * 10 for d in depths],  # Size based on depth
            alpha=0.7,
            cmap='RdYlGn',
            vmin=0, vmax=1,
            edgecolors='white',
            linewidth=0.5
        )
        
        # Add colorbar
        cbar = plt.colorbar(scatter, ax=ax)
        cbar.set_label('Trajectory Score', rotation=270, labelpad=20)
        
        # Draw parent-child connections
        for node in positioned_nodes:
            if node.parent:
                parent = next((n for n in positioned_nodes if n.id == node.parent), None)
                if parent:
                    ax.plot(
                        [parent.xy[0], node.xy[0]],
                        [parent.xy[1], node.xy[1]],
                        'gray', alpha=0.3, linewidth=0.5
                    )
        
        ax.set_xlabel('Semantic Dimension 1')
        ax.set_ylabel('Semantic Dimension 2')
        ax.set_title('Semantic Space Exploration\n(Size = Depth, Color = Trajectory Score)', 
                    fontsize=14, pad=20)
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Semantic scatter plot saved to {save_path}")
    
    def create_score_distribution(self, save_path: str = "score_distribution.png"):
        """Create histogram of trajectory scores."""
        nodes = self.fetcher.get_graph_data()
        scores = [n.score for n in nodes if n.score is not None]
        
        if not scores:
            print("No scores to plot")
            return
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Histogram
        ax1.hist(scores, bins=20, alpha=0.7, color='skyblue', edgecolor='white')
        ax1.axvline(np.mean(scores), color='red', linestyle='--', 
                   label=f'Mean: {np.mean(scores):.3f}')
        ax1.set_xlabel('Trajectory Score')
        ax1.set_ylabel('Number of Nodes')
        ax1.set_title('Distribution of Trajectory Scores')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Box plot by score ranges
        score_ranges = {'Hostile\n(0.0-0.4)': [], 'Neutral\n(0.4-0.6)': [], 'Progress\n(0.6-1.0)': []}
        for score in scores:
            if score < 0.4:
                score_ranges['Hostile\n(0.0-0.4)'].append(score)
            elif score < 0.6:
                score_ranges['Neutral\n(0.4-0.6)'].append(score)
            else:
                score_ranges['Progress\n(0.6-1.0)'].append(score)
        
        box_data = [scores for scores in score_ranges.values() if scores]
        box_labels = [label for label, scores in score_ranges.items() if scores]
        
        bp = ax2.boxplot(box_data, labels=box_labels, patch_artist=True)
        colors = ['#ff4444', '#ffaa44', '#44ff44']
        for patch, color in zip(bp['boxes'], colors[:len(bp['boxes'])]):
            patch.set_facecolor(color)
            patch.set_alpha(0.7)
        
        ax2.set_ylabel('Trajectory Score')
        ax2.set_title('Score Distribution by Category')
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Score distribution plot saved to {save_path}")
    
    def create_depth_analysis(self, save_path: str = "depth_analysis.png"):
        """Create analysis of conversation depth vs score."""
        nodes = self.fetcher.get_graph_data()
        
        # Group by depth
        depth_scores = defaultdict(list)
        for node in nodes:
            if node.score is not None:
                depth_scores[node.depth].append(node.score)
        
        if not depth_scores:
            print("No depth data to plot")
            return
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Average score by depth
        depths = sorted(depth_scores.keys())
        avg_scores = [np.mean(depth_scores[d]) for d in depths]
        node_counts = [len(depth_scores[d]) for d in depths]
        
        ax1.plot(depths, avg_scores, 'o-', color='lime', linewidth=2, markersize=8)
        ax1.set_xlabel('Conversation Depth')
        ax1.set_ylabel('Average Trajectory Score')
        ax1.set_title('Score Progression by Conversation Depth')
        ax1.grid(True, alpha=0.3)
        
        # Add trend line
        if len(depths) > 1:
            z = np.polyfit(depths, avg_scores, 1)
            p = np.poly1d(z)
            ax1.plot(depths, p(depths), "--", alpha=0.8, 
                    label=f'Trend: {z[0]:.3f}x + {z[1]:.3f}')
            ax1.legend()
        
        # Node count by depth
        ax2.bar(depths, node_counts, alpha=0.7, color='orange', edgecolor='white')
        ax2.set_xlabel('Conversation Depth')
        ax2.set_ylabel('Number of Nodes')
        ax2.set_title('Node Distribution by Depth')
        ax2.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Depth analysis plot saved to {save_path}")
    
    def create_conversation_tree(self, save_path: str = "conversation_tree.png"):
        """Create a tree visualization of the best conversation paths."""
        nodes = self.fetcher.get_graph_data()
        
        # Find best scoring leaf nodes
        best_nodes = [n for n in nodes if n.score and n.score > 0.7]
        best_nodes.sort(key=lambda n: n.score, reverse=True)
        
        if not best_nodes:
            print("No high-scoring nodes to visualize")
            return
        
        fig, ax = plt.subplots(figsize=(14, 10))
        
        # Build node lookup
        node_lookup = {n.id: n for n in nodes}
        
        # For each best node, trace back to root and plot path
        colors = plt.cm.Set3(np.linspace(0, 1, min(len(best_nodes), 10)))
        
        for i, leaf_node in enumerate(best_nodes[:10]):  # Top 10 paths
            path = []
            current = leaf_node
            visited = set()
            
            # Trace back to root
            while current and current.id not in visited:
                visited.add(current.id)
                path.append(current)
                if current.parent and current.parent in node_lookup:
                    current = node_lookup[current.parent]
                else:
                    break
            
            path.reverse()  # Root to leaf
            
            # Plot path
            if len(path) > 1:
                depths = list(range(len(path)))
                scores = [n.score if n.score else 0.5 for n in path]
                
                ax.plot(depths, scores, 'o-', color=colors[i], 
                       linewidth=2, markersize=6, alpha=0.8,
                       label=f'Path {i+1} (final: {leaf_node.score:.3f})')
        
        ax.set_xlabel('Conversation Depth')
        ax.set_ylabel('Trajectory Score')
        ax.set_title('Best Conversation Paths\n(Trajectory Score Evolution)')
        ax.grid(True, alpha=0.3)
        ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Conversation tree plot saved to {save_path}")
    
    def generate_all_plots(self, output_dir: str = "plots"):
        """Generate all visualization plots."""
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        print("🎨 Generating visualization plots...")
        
        self.create_semantic_scatter(f"{output_dir}/semantic_space.png")
        self.create_score_distribution(f"{output_dir}/score_distribution.png")
        self.create_depth_analysis(f"{output_dir}/depth_analysis.png")
        self.create_conversation_tree(f"{output_dir}/conversation_tree.png")
        
        print(f"✅ All plots generated in {output_dir}/")

if __name__ == "__main__":
    generator = PlotGenerator()
    generator.generate_all_plots()