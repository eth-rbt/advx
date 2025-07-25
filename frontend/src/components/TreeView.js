import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { exampleData } from '../data/exampleData';

const TreeView = ({ leftTabOpen, onNodeSelect }) => {
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const graphRef = useRef();

    // Handle space key for recentering
    useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.code === 'Space' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                if (graphRef.current) {
                    graphRef.current.zoomToFit(400);
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Transform data for ForceGraph2D format
    const graphData = useMemo(() => {
        const nodes = [];
        const links = [];

        // Create nodes array
        Object.keys(exampleData.nodes).forEach(nodeId => {
            const nodeData = exampleData.nodes[nodeId];
            const isCollapsed = collapsedNodes.has(nodeId);
            const isPriority = exampleData.board.priorityQueue.includes(nodeId);
            
            nodes.push({
                id: nodeId,
                name: nodeId,
                val: isPriority ? 15 : 10, // Size based on priority
                color: isPriority ? '#ffd700' : '#ffffff',
                nodeData: nodeData,
                isCollapsed: isCollapsed,
                isPriority: isPriority
            });
        });

        // Create links array - only show links if parent is not collapsed
        Object.entries(exampleData.board.tree).forEach(([parentId, children]) => {
            if (!collapsedNodes.has(parentId)) {
                children.forEach(childId => {
                    links.push({
                        source: parentId,
                        target: childId
                    });
                });
            }
        });

        return { nodes, links };
    }, [collapsedNodes]);

    const [clickTimeout, setClickTimeout] = useState(null);
    
    const handleNodeClick = useCallback((node) => {
        // Clear existing timeout
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            setClickTimeout(null);
            // This is a double-click
            if (onNodeSelect && node.nodeData) {
                onNodeSelect(node.nodeData);
            }
            return;
        }
        
        // Set timeout for single click
        const timeout = setTimeout(() => {
            // Single click - toggle node
            const nodeId = node.id;
            const children = exampleData.board.tree[nodeId] || [];
            
            if (children.length > 0) {
                setCollapsedNodes(prev => {
                    const newCollapsed = new Set(prev);
                    if (newCollapsed.has(nodeId)) {
                        newCollapsed.delete(nodeId);
                    } else {
                        newCollapsed.add(nodeId);
                    }
                    return newCollapsed;
                });
            }
            setClickTimeout(null);
        }, 200);
        
        setClickTimeout(timeout);
    }, [onNodeSelect, clickTimeout]);

    const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
        if (!ctx || typeof ctx === 'string') return;
        
        const label = node.name;
        const fontSize = Math.max(12/globalScale, 8);
        const radius = node.val || 10;
        
        // Save context state
        ctx.save();
        
        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || '#ffffff';
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = node.isPriority ? '#ffd700' : '#ddd';
        ctx.lineWidth = Math.max(2/globalScale, 1);
        ctx.stroke();
        
        // Add glow effect for priority nodes
        if (node.isPriority) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = Math.max(10/globalScale, 5);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Draw label
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText(label, node.x, node.y);
        
        // Draw + symbol if collapsed
        if (node.isCollapsed) {
            ctx.fillStyle = '#666';
            ctx.font = `${fontSize * 0.8}px Sans-Serif`;
            ctx.fillText('+', node.x + radius + 8/globalScale, node.y);
        }
        
        // Restore context state
        ctx.restore();
    }, []);

    const linkCanvasObject = useCallback((link, ctx) => {
        if (!ctx || typeof ctx === 'string') return;
        
        const start = link.source;
        const end = link.target;

        // Draw link line
        ctx.save();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.restore();
    }, []);

    return (
        <div className={`tree-container ${leftTabOpen ? 'shifted' : ''}`}>
            <div className="reactflow-wrapper">
                <ForceGraph2D
                    ref={graphRef}
                    graphData={graphData}
                    nodeCanvasObject={nodeCanvasObject}
                    linkCanvasObject={linkCanvasObject}
                    onNodeClick={handleNodeClick}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        // Define clickable area for nodes
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.val || 10, 0, 2 * Math.PI, false);
                        ctx.fill();
                    }}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.006}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => 'rgba(255,255,255,0.6)'}
                    nodeVal={node => node.val || 10}
                    nodeColor={node => node.color || '#ffffff'}
                    d3Force={{
                        charge: -300,
                        link: { distance: 80, strength: 2 },
                        center: { strength: 0.1 }
                    }}
                    backgroundColor="transparent"
                    width={window.innerWidth - (leftTabOpen ? 360 : 0)}
                    height={window.innerHeight - 60}
                    cooldownTicks={100}
                    enableNodeDrag={false}
                    linkWidth={2}
                />
            </div>
        </div>
    );
};

export default TreeView;