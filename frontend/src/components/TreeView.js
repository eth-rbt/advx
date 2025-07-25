import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { exampleData } from '../data/exampleData';

const TreeView = ({ onNodeSelect, onGenerateNode, nodePositions, setNodePositions, dynamicNodes, setDynamicNodes }) => {
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [dynamicTree, setDynamicTree] = useState({});
    const [nodeCounter, setNodeCounter] = useState(2); // Start after node 1
    const graphRef = useRef();
    const nodePositionsRef = useRef(new Map());

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


    // Function to save current node positions
    const saveNodePositions = useCallback(() => {
        // Since we can't directly access node positions from the ref,
        // we'll rely on the nodePositions state being updated during drag events
        // The positions are maintained through the nodeCanvasObject callback
    }, []);

    // Generate new node function
    const generateNewNode = useCallback(() => {
        // First save current positions
        saveNodePositions();
        
        const newNodeId = nodeCounter.toString();
        const existingNodeIds = Object.keys({ ...exampleData.nodes, ...dynamicNodes });
        const randomParentId = existingNodeIds[Math.floor(Math.random() * existingNodeIds.length)];
        
        // Create new node
        const newNode = {
            id: newNodeId,
            turns: Math.floor(Math.random() * 3) + 1,
            prompt: `Generated node ${newNodeId}`,
            embedding: null,
            score: Math.floor(Math.random() * 100) + 1,
            convo: `This is a dynamically generated conversation node ${newNodeId}`
        };

        // Update dynamic nodes
        setDynamicNodes(prev => ({
            ...prev,
            [newNodeId]: newNode
        }));

        // Update tree structure - add new node as child of random parent
        setDynamicTree(prev => ({
            ...prev,
            [randomParentId]: [...(prev[randomParentId] || exampleData.board.tree[randomParentId] || []), newNodeId],
            [newNodeId]: []
        }));

        // Position new node near its parent using saved positions from ref
        const parentPosition = nodePositionsRef.current.get(randomParentId);
        if (parentPosition) {
            // Calculate position for new node near parent
            const angle = Math.random() * 2 * Math.PI;
            const distance = 80;
            const newPosition = {
                x: parentPosition.x + Math.cos(angle) * distance,
                y: parentPosition.y + Math.sin(angle) * distance
            };
            
            // Save the new node position for initial placement
            setNodePositions(prev => ({
                ...prev,
                [newNodeId]: newPosition
            }));
        }

        setNodeCounter(prev => prev + 1);
        console.log(`Generated new node ${newNodeId} as child of ${randomParentId}`);
        
        // Reheat simulation for the new node
        setTimeout(() => {
            if (graphRef.current) {
                graphRef.current.d3ReheatSimulation();
            }
        }, 50);
    }, [nodeCounter, dynamicNodes]);

    // Expose generate function
    useEffect(() => {
        if (onGenerateNode) {
            onGenerateNode.current = generateNewNode;
        }
    }, [generateNewNode, onGenerateNode]);

    // Transform data for ForceGraph2D format
    const graphData = useMemo(() => {
        const nodes = [];
        const links = [];
        const allNodes = { ...exampleData.nodes, ...dynamicNodes };
        const allTree = { ...exampleData.board.tree, ...dynamicTree };

        // Create nodes array
        Object.keys(allNodes).forEach(nodeId => {
            const nodeData = allNodes[nodeId];
            const isCollapsed = collapsedNodes.has(nodeId);
            const isPriority = exampleData.board.priorityQueue.includes(nodeId);
            const isDynamic = dynamicNodes[nodeId] !== undefined;
            const savedPosition = nodePositions[nodeId];
            
            const node = {
                id: nodeId,
                name: nodeId,
                val: 12, // All nodes same size
                color: isPriority ? '#ffd700' : (isDynamic ? '#90EE90' : '#ffffff'), // Dynamic nodes are light green
                nodeData: nodeData,
                isCollapsed: isCollapsed,
                isPriority: isPriority,
                isDynamic: isDynamic
            };

            // Apply saved position if it exists
            if (savedPosition) {
                node.x = savedPosition.x;
                node.y = savedPosition.y;
                // Don't fix the position - let physics continue to work
            }
            
            nodes.push(node);
        });

        // Create links array - only show links if parent is not collapsed
        Object.entries(allTree).forEach(([parentId, children]) => {
            if (!collapsedNodes.has(parentId)) {
                children.forEach(childId => {
                    if (allNodes[childId]) { // Make sure child node exists
                        links.push({
                            source: parentId,
                            target: childId
                        });
                    }
                });
            }
        });

        return { nodes, links };
    }, [collapsedNodes, dynamicNodes, dynamicTree, nodePositions]);

    // Double-click detection state
    const [lastClick, setLastClick] = useState({ nodeId: null, time: 0 });

    // Handle node click with double-click detection
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
            // First click or different node - just record it
            console.log('First click recorded for node:', node.id);
            setLastClick({ nodeId: node.id, time: currentTime });
        }
    }, [onNodeSelect, lastClick]);


    const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
        if (!ctx || typeof ctx === 'string') return;
        
        const label = node.name;
        const fontSize = Math.max(12/globalScale, 8);
        const radius = 12; // Fixed radius for all nodes
        
        // Track node position in ref and update periodically
        if (node.x !== undefined && node.y !== undefined) {
            const position = { x: node.x, y: node.y };
            nodePositionsRef.current.set(node.id, position);
            
            // Update parent state if position changed significantly
            if (!nodePositions[node.id] || 
                Math.abs(nodePositions[node.id].x - node.x) > 1 || 
                Math.abs(nodePositions[node.id].y - node.y) > 1) {
                // Defer state update to avoid render cycle issues
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
    }, [nodePositions, setNodePositions]);

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
                    onEngineStop={() => {
                        // Save all positions when simulation stops
                        const allPositions = {};
                        nodePositionsRef.current.forEach((pos, id) => {
                            allPositions[id] = pos;
                        });
                        setNodePositions(allPositions);
                    }}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.006}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => 'rgba(255,255,255,0.6)'}
                    nodeVal={() => 12}
                    nodeColor={node => node.color || '#ffffff'}
                    d3Force={{
                        charge: -200,
                        link: { distance: 80, strength: 1 },
                        center: { strength: 0.05 },
                        collide: { radius: 30 }
                    }}
                    backgroundColor="transparent"
                    width={window.innerWidth}
                    height={window.innerHeight - 60}
                    cooldownTicks={300}
                    warmupTicks={0}
                    d3AlphaDecay={0.05}
                    d3VelocityDecay={0.4}
                    d3AlphaMin={0.001}
                    enableNodeDrag={false}
                    linkWidth={2}
                />
            </div>
        </div>
    );
};

export default TreeView;