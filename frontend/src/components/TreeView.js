import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { treeToGraphData } from '../utils/dataTransforms';

const TreeView = ({ 
    tree, 
    selectedNode, 
    onNodeSelect, 
    onGenerateNode, 
    nodePositions, 
    setNodePositions 
}) => {
    // NOTE: Removed collapsedNodes - all nodes are always visible
    const graphRef = useRef();
    const nodePositionsRef = useRef(new Map());
    const [shouldSavePositions, setShouldSavePositions] = useState(false);
    
    // Visual state for animations and highlights
    const [processingAnimations, setProcessingAnimations] = useState(new Set());
    const [nextTargetHighlight, setNextTargetHighlight] = useState(null);

    // Convert tree to graph data for visualization
    const graphData = useMemo(() => {
        if (!tree) {
            return { nodes: [], links: [] };
        }

        const { nodes, links } = treeToGraphData(tree); // No collapsed nodes - all visible
        
        // Enhance nodes with visual state and positioning
        const enhancedNodes = nodes.map(node => {
            const isProcessing = processingAnimations.has(node.id);
            const isNextTarget = nextTargetHighlight === node.id;
            const isSelected = selectedNode?.id === node.id;
            
            const enhancedNode = {
                ...node,
                isProcessing,
                isNextTarget,
                isSelected,
                // Update color based on state
                color: isSelected ? '#ffff00' : 
                       isNextTarget ? '#ffff00' : 
                       isProcessing ? '#ff6b6b' : 
                       node.color
            };

            // Apply saved position if available
            const savedPosition = nodePositions[node.id];
            if (savedPosition) {
                enhancedNode.x = savedPosition.x;
                enhancedNode.y = savedPosition.y;
                enhancedNode.vx = 0; // Zero initial velocity
                enhancedNode.vy = 0;
            }
            
            return enhancedNode;
        });

        return { nodes: enhancedNodes, links };
    }, [tree, processingAnimations, nextTargetHighlight, selectedNode, nodePositions]);

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

    // Save positions when new nodes are added or simulation stops
    useEffect(() => {
        if (selectedNode) {
            setShouldSavePositions(true);
            setTimeout(() => setShouldSavePositions(false), 2000);
        }
    }, [selectedNode]);

    // Double-click detection state
    const [lastClick, setLastClick] = useState({ nodeId: null, time: 0 });

    // Handle node click - only double-click opens details (no collapse/expand)
    const handleNodeClick = useCallback((node) => {
        console.log('Node clicked:', node.id, 'hasNodeData:', !!node.nodeData);
        const currentTime = Date.now();
        const timeDiff = currentTime - lastClick.time;
        
        // Check if this is a double-click (within 500ms and same node)
        if (timeDiff < 500 && lastClick.nodeId === node.id) {
            // Double-click detected - open details
            console.log('Double-click detected on node:', node.id);
            if (onNodeSelect && node.nodeData) {
                console.log('Calling onNodeSelect with:', node.nodeData);
                onNodeSelect(node.nodeData);
            } else {
                console.log('onNodeSelect or nodeData missing:', { onNodeSelect: !!onNodeSelect, nodeData: !!node.nodeData });
            }
            
            // Reset to prevent triple-click
            setLastClick({ nodeId: null, time: 0 });
        } else {
            // First click - just record for double-click detection (no collapse/expand)
            console.log('First click recorded for node:', node.id);
            setLastClick({ nodeId: node.id, time: currentTime });
            // NOTE: Removed all collapse/expand functionality - nodes are always visible
        }
    }, [onNodeSelect, lastClick]);

    // Custom node rendering
    const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
        if (!ctx || typeof ctx === 'string') return;
        
        const label = node.name;
        const fontSize = Math.max(12/globalScale, 8);
        const radius = 12; // Fixed radius for all nodes
        
        // Track node position in ref - always update ref for parent positioning
        if (node.x !== undefined && node.y !== undefined) {
            const position = { x: node.x, y: node.y };
            nodePositionsRef.current.set(node.id, position);
            
            // Only update parent state when we should save positions
            if (shouldSavePositions && (!nodePositions[node.id] || 
                Math.abs(nodePositions[node.id].x - node.x) > 5 || 
                Math.abs(nodePositions[node.id].y - node.y) > 5)) {
                // Use larger threshold (5px) to reduce frequent updates
                setTimeout(() => {
                    setNodePositions(prev => ({
                        ...prev,
                        [node.id]: position
                    }));
                }, 0);
            }
        }
        
        // Save context state
        ctx.save();
        
        // Add special effects for processing and next target states
        if (node.isNextTarget) {
            // Pulsing yellow ring for next target
            const pulseRadius = radius + 5 + Math.sin(Date.now() / 200) * 3;
            ctx.beginPath();
            ctx.arc(node.x, node.y, pulseRadius, 0, 2 * Math.PI, false);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = Math.max(3/globalScale, 2);
            ctx.stroke();
        }
        
        if (node.isProcessing) {
            // Spinning glow effect for processing nodes
            const time = Date.now() / 1000;
            ctx.shadowColor = '#ff6b6b';
            ctx.shadowBlur = Math.max(15/globalScale, 8);
            ctx.save();
            ctx.translate(node.x, node.y);
            ctx.rotate(time * 2);
            ctx.translate(-node.x, -node.y);
        }
        
        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || '#ffffff';
        ctx.fill();
        
        // Draw border with appropriate styling
        let borderColor = '#ddd';
        let borderWidth = 2;
        
        if (node.isSelected) {
            borderColor = '#ffff00';
            borderWidth = 3;
        } else if (node.isNextTarget) {
            borderColor = '#ffff00';
            borderWidth = 3;
        } else if (node.isProcessing) {
            borderColor = '#ff6b6b';
            borderWidth = 3;
        }
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = Math.max(borderWidth/globalScale, 1);
        ctx.stroke();
        
        // Add glow effect for special nodes
        if (node.isSelected || node.isNextTarget || node.isProcessing) {
            ctx.shadowColor = borderColor;
            ctx.shadowBlur = Math.max(10/globalScale, 5);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        if (node.isProcessing) {
            ctx.restore(); // Restore rotation
        }
        
        // Draw label
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText(label, node.x, node.y);
        
        // NOTE: Removed "+ symbol" rendering - no collapsed nodes
        
        // Restore context state
        ctx.restore();
    }, [nodePositions, setNodePositions, shouldSavePositions]);

    // Custom link rendering
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
        <div className="tree-container">
            <div className="reactflow-wrapper">
                <ForceGraph2D
                    ref={graphRef}
                    key={`graph-${tree?.id || 'empty'}`}
                    graphData={graphData}
                    nodeCanvasObject={nodeCanvasObject}
                    linkCanvasObject={linkCanvasObject}
                    onNodeClick={handleNodeClick}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        // Define clickable area for nodes
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 15, 0, 2 * Math.PI, false);
                        ctx.fill();
                    }}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.006}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => 'rgba(255,255,255,0.6)'}
                    nodeVal={() => 12}
                    nodeColor={node => node.color || '#ffffff'}
                    d3Force={{
                        charge: -100,
                        link: { distance: 100, strength: 2.0 },
                        center: { strength: 0.01 },
                        collide: { radius: 30 }
                    }}
                    backgroundColor="transparent"
                    width={window.innerWidth}
                    height={window.innerHeight - 60}
                    cooldownTicks={200}
                    warmupTicks={10}
                    d3AlphaDecay={0.05}
                    d3VelocityDecay={0.6}
                    d3AlphaMin={0.003}
                    enableNodeDrag={false}
                    onEngineStop={() => {
                        console.log('🎯 Physics simulation stopped, nodes should be in balanced positions');
                        // Save positions when simulation settles
                        setShouldSavePositions(true);
                        setTimeout(() => setShouldSavePositions(false), 1000); // Save for 1 second
                    }}
                    linkWidth={2}
                />
            </div>
        </div>
    );
};

export default TreeView;