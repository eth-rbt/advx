import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { exampleData } from '../data/exampleData';

const TreeView = ({ leftTabOpen, onNodeSelect, onGenerateNode }) => {
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [dynamicNodes, setDynamicNodes] = useState({});
    const [dynamicTree, setDynamicTree] = useState({});
    const [nodeCounter, setNodeCounter] = useState(7); // Start after existing nodes (1-6)
    const [nodePositions, setNodePositions] = useState(new Map());
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

    // Function to save current node positions
    const saveNodePositions = useCallback(() => {
        if (graphRef.current) {
            const graphData = graphRef.current.graphData();
            const positions = new Map();
            
            graphData.nodes.forEach(node => {
                if (node.x !== undefined && node.y !== undefined) {
                    positions.set(node.id, { x: node.x, y: node.y });
                }
            });
            
            setNodePositions(positions);
        }
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

        // Position new node near its parent
        setTimeout(() => {
            if (graphRef.current) {
                const graphData = graphRef.current.graphData();
                const parentNode = graphData.nodes.find(n => n.id === randomParentId);
                const newNodeInGraph = graphData.nodes.find(n => n.id === newNodeId);
                
                if (parentNode && newNodeInGraph && parentNode.x !== undefined && parentNode.y !== undefined) {
                    // Position new node near parent with slight offset
                    const angle = Math.random() * 2 * Math.PI;
                    const distance = 80;
                    newNodeInGraph.x = parentNode.x + Math.cos(angle) * distance;
                    newNodeInGraph.y = parentNode.y + Math.sin(angle) * distance;
                }
            }
        }, 100);

        setNodeCounter(prev => prev + 1);
        console.log(`Generated new node ${newNodeId} as child of ${randomParentId}`);
    }, [nodeCounter, dynamicNodes, saveNodePositions]);

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
            const savedPosition = nodePositions.get(nodeId);
            
            const node = {
                id: nodeId,
                name: nodeId,
                val: isPriority ? 15 : (isDynamic ? 12 : 10), // Dynamic nodes slightly larger
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
                node.fx = savedPosition.x; // Fix position temporarily
                node.fy = savedPosition.y;
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

    // Unfix positions after graph stabilizes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (graphRef.current) {
                const graphData = graphRef.current.graphData();
                graphData.nodes.forEach(node => {
                    // Remove fixed position constraints
                    node.fx = undefined;
                    node.fy = undefined;
                });
            }
        }, 500); // Allow 500ms for new node to settle

        return () => clearTimeout(timer);
    }, [dynamicNodes]); // Trigger when new nodes are added

    const [clickTimeout, setClickTimeout] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const handleNodeDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleNodeDragEnd = useCallback(() => {
        // Small delay to distinguish drag from click
        setTimeout(() => setIsDragging(false), 100);
    }, []);
    
    const handleNodeClick = useCallback((node) => {
        // Don't handle clicks if we were dragging
        if (isDragging) return;
        
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
            const allTree = { ...exampleData.board.tree, ...dynamicTree };
            const children = allTree[nodeId] || [];
            
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
    }, [onNodeSelect, clickTimeout, isDragging]);

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
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDragEnd={handleNodeDragEnd}
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
                    enableNodeDrag={true}
                    linkWidth={2}
                />
            </div>
        </div>
    );
};

export default TreeView;