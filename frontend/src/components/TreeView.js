import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { exampleData } from '../data/exampleData';
import backendAPI from '../services/BackendAPI';

const TreeView = ({ onNodeSelect, onGenerateNode, nodePositions, setNodePositions, dynamicNodes, setDynamicNodes }) => {
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [dynamicTree, setDynamicTree] = useState({});
    const [nodeCounter, setNodeCounter] = useState(2); // Start after node 1
    const graphRef = useRef();
    const nodePositionsRef = useRef(new Map());
    const [shouldSavePositions, setShouldSavePositions] = useState(false);
    
    // Backend integration state
    const [backendGraphData, setBackendGraphData] = useState({ nodes: [], links: [] });
    const [processingAnimations, setProcessingAnimations] = useState(new Set());
    const [nextTargetHighlight, setNextTargetHighlight] = useState(null);
    const [useBackendData, setUseBackendData] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [activityLog, setActivityLog] = useState([]);
    const [dataVersion, setDataVersion] = useState(0); // Force re-render trigger
    
    // Activity logging function
    const addToActivityLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const entry = { id: Date.now(), timestamp, message, type };
        setActivityLog(prev => [entry, ...prev.slice(0, 19)]); // Keep last 20 entries
        console.log(`Activity: ${message}`);
    };

    // Load backend data on component mount
    useEffect(() => {
        const loadBackendData = async () => {
            setLoading(true);
            setError(null);
            try {
                const graphData = await backendAPI.getGraph();
                if (graphData && graphData.length > 0) {
                    // Map backend nodes to frontend format (no existing nodes for initial load)
                    const frontendNodes = graphData.map(node => backendAPI.mapBackendNodeToFrontend(node, []));
                    const links = backendAPI.buildLinksFromNodes(frontendNodes);
                    
                    setBackendGraphData({ nodes: frontendNodes, links, version: Date.now() });
                    setUseBackendData(true);
                    setDataVersion(prev => prev + 1); // Force initial render
                    console.log('Backend data loaded:', frontendNodes.length, 'nodes');
                    addToActivityLog(`📊 Loaded ${frontendNodes.length} conversation nodes`, 'info');
                } else {
                    console.log('No backend data available, using example data');
                    setUseBackendData(false);
                    addToActivityLog('⚠️ Using example data - start backend for live updates', 'warning');
                }
            } catch (error) {
                console.error('Failed to load backend data:', error);
                setError(error.message);
                setUseBackendData(false);
                addToActivityLog(`❌ Failed to connect to backend: ${error.message}`, 'error');
            } finally {
                setLoading(false);
            }
        };

        loadBackendData();
    }, []);

    // Enhanced WebSocket integration for real-time updates (based on backend implementation)
    useEffect(() => {
        const handleWebSocketMessage = (message) => {
            console.log('📨 WebSocket message received:', message);
            
            try {
                // Parse message if it's a string (like the backend sends)
                const update = typeof message === 'string' ? JSON.parse(message) : message;
                
                // Handle node updates - similar to backend's handleNodeUpdate
                if (update.id) {
                    setBackendGraphData(prev => {
                        const existingIndex = prev.nodes.findIndex(n => n.id === update.id);
                        let newNodes;
                        if (existingIndex >= 0) {
                            // Update existing node
                            console.log('🔄 Updating existing node:', update.id);
                            newNodes = [...prev.nodes];
                            const existingNode = newNodes[existingIndex];
                            newNodes[existingIndex] = backendAPI.mapBackendNodeToFrontend({ ...existingNode.nodeData, ...update });
                        } else {
                            // Add new node - pass existing nodes for parent positioning
                            console.log('🆕 Adding new node:', update.id, 'Score:', update.score?.toFixed(3) || 'N/A');
                            const frontendNode = backendAPI.mapBackendNodeToFrontend(update, prev.nodes);
                            newNodes = [...prev.nodes, frontendNode];
                            
                            // Trigger position saving for the next few seconds after new node added
                            setShouldSavePositions(true);
                            setTimeout(() => setShouldSavePositions(false), 3000); // Save for 3 seconds
                            
                            // Add to activity log
                            const scoreText = update.score ? update.score.toFixed(3) : 'N/A';
                            const logType = update.score > 0.7 ? 'high-score' : update.score > 0.4 ? 'medium-score' : 'new-node';
                            addToActivityLog(`🆕 New conversation node (score: ${scoreText})`, logType);
                        }
                        
                        // Rebuild links
                        const newLinks = backendAPI.buildLinksFromNodes(newNodes);
                        
                        // Create completely new object to ensure React detects the change
                        const newGraphData = { 
                            nodes: newNodes, 
                            links: newLinks,
                            version: Date.now() // Unique identifier
                        };
                        
                        // Force data version update to trigger re-render
                        setTimeout(() => {
                            setDataVersion(prev => prev + 1);
                        }, 0);
                        
                        return newGraphData;
                    });
                    
                    // Add visual effects for high-scoring new nodes
                    if (update.score && update.score > 0.7) {
                        setNextTargetHighlight(update.id);
                        setTimeout(() => setNextTargetHighlight(null), 3000);
                    }
                    
                    // Gentle simulation update for new nodes
                    setTimeout(() => {
                        if (graphRef.current) {
                            console.log('🌱 Gentle graph update for new node');
                            // Just a gentle reheat, don't change forces
                            graphRef.current.d3ReheatSimulation();
                        }
                    }, 100);
                } else {
                    // Handle other message types
                    const messageType = update.type || update.event || 'unknown';
                    
                    switch (messageType) {
                        case 'processing_started':
                            const startNodeId = update.nodeId || update.node_id;
                            if (startNodeId) {
                                console.log('⚡ Processing started for node:', startNodeId);
                                setProcessingAnimations(prev => new Set([...prev, startNodeId]));
                            }
                            break;
                            
                        case 'processing_completed':
                            const completeNodeId = update.nodeId || update.node_id;
                            if (completeNodeId) {
                                console.log('✅ Processing completed for node:', completeNodeId);
                                setProcessingAnimations(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(completeNodeId);
                                    return newSet;
                                });
                            }
                            break;
                            
                        case 'connection_status':
                            console.log('🔗 Connection status:', update.status);
                            setConnectionStatus(update.status);
                            addToActivityLog(`${update.status === 'connected' ? '🔗' : '❌'} WebSocket ${update.status}`, update.status);
                            break;
                            
                        default:
                            // If no specific handler, try to refresh all data
                            console.log('🔄 Unhandled message, refreshing all graph data');
                            const refreshData = async () => {
                                try {
                                    const graphData = await backendAPI.getGraph();
                                    if (graphData && graphData.length > 0) {
                                        const frontendNodes = graphData.map(node => backendAPI.mapBackendNodeToFrontend(node));
                                        const links = backendAPI.buildLinksFromNodes(frontendNodes);
                                        setBackendGraphData({ nodes: frontendNodes, links });
                                        console.log('📊 Graph data refreshed:', frontendNodes.length, 'nodes');
                                    }
                                } catch (error) {
                                    console.error('❌ Failed to refresh graph data:', error);
                                }
                            };
                            refreshData();
                    }
                }
            } catch (error) {
                console.error('❌ Failed to parse WebSocket message:', error, message);
            }
        };

        // Connect to WebSocket if we're using backend data
        if (useBackendData) {
            backendAPI.connectWebSocket(handleWebSocketMessage);
            
            // Set up periodic sync to ensure we don't miss updates
            const syncInterval = setInterval(async () => {
                try {
                    const graphData = await backendAPI.getGraph();
                    if (graphData && graphData.length > 0) {
                        const currentNodeCount = backendGraphData.nodes.length;
                        if (graphData.length > currentNodeCount) {
                            console.log('🔄 Periodic sync: detected new nodes, refreshing...');
                            const frontendNodes = graphData.map(node => backendAPI.mapBackendNodeToFrontend(node));
                            const links = backendAPI.buildLinksFromNodes(frontendNodes);
                            setBackendGraphData({ nodes: frontendNodes, links, version: Date.now() });
                            setDataVersion(prev => prev + 1);
                            addToActivityLog(`🔄 Synced ${graphData.length - currentNodeCount} missed nodes`, 'info');
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Periodic sync failed:', error.message);
                }
            }, 5000); // Check every 5 seconds
            
            return () => {
                backendAPI.disconnectWebSocket();
                clearInterval(syncInterval);
            };
        }

        return () => {};
    }, [useBackendData]);

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

    // Build proper tree structure from backend data
    const treeStructure = useMemo(() => {
        if (!useBackendData || !backendGraphData.nodes.length) return null;
        
        const nodeMap = new Map();
        const rootNodes = [];
        
        // First pass: create node map
        backendGraphData.nodes.forEach(node => {
            nodeMap.set(node.id, {
                ...node,
                children: [],
                parent: null,
                depth: 0,
                isProcessing: processingAnimations.has(node.id),
                isNextTarget: nextTargetHighlight === node.id,
                isCollapsed: collapsedNodes.has(node.id)
            });
        });
        
        // Second pass: build tree relationships
        backendGraphData.nodes.forEach(node => {
            const treeNode = nodeMap.get(node.id);
            if (node.nodeData && node.nodeData.parent) {
                const parent = nodeMap.get(node.nodeData.parent);
                if (parent) {
                    parent.children.push(treeNode);
                    treeNode.parent = parent;
                    treeNode.depth = parent.depth + 1;
                } else {
                    rootNodes.push(treeNode);
                }
            } else {
                rootNodes.push(treeNode);
            }
        });
        
        return { nodeMap, rootNodes };
    }, [backendGraphData, processingAnimations, nextTargetHighlight, collapsedNodes, useBackendData]);

    // Transform tree structure for ForceGraph2D format with proper positioning
    const graphData = useMemo(() => {
        if (useBackendData && treeStructure) {
            const nodes = [];
            const links = [];
            
            // Position nodes in tree layout
            const positionTreeNodes = (treeNodes, startX = 0, startY = 0, levelWidth = 400) => {
                if (!treeNodes.length) return;
                
                const spacing = levelWidth / Math.max(treeNodes.length, 1);
                
                treeNodes.forEach((treeNode, index) => {
                    if (collapsedNodes.has(treeNode.id)) return; // Skip collapsed nodes
                    
                    // Calculate position based on tree structure
                    const x = startX + (index - (treeNodes.length - 1) / 2) * spacing;
                    const y = startY + treeNode.depth * 100; // 100px per level
                    
                    // Use saved position if available, otherwise use calculated position
                    const savedPosition = nodePositions[treeNode.id];
                    const nodeForGraph = {
                        id: treeNode.id,
                        name: treeNode.name || treeNode.depth?.toString() || '0',
                        val: 12,
                        color: treeNode.isNextTarget ? '#ffff00' : 
                               (treeNode.isProcessing ? '#ff6b6b' : treeNode.color),
                        nodeData: treeNode.nodeData || treeNode,
                        isCollapsed: treeNode.isCollapsed,
                        isProcessing: treeNode.isProcessing,
                        isNextTarget: treeNode.isNextTarget,
                        treeDepth: treeNode.depth,
                        x: savedPosition ? savedPosition.x : x,
                        y: savedPosition ? savedPosition.y : y,
                        vx: 0,
                        vy: 0
                    };
                    
                    nodes.push(nodeForGraph);
                    
                    // Create link to parent
                    if (treeNode.parent && !collapsedNodes.has(treeNode.parent.id)) {
                        links.push({
                            source: treeNode.parent.id,
                            target: treeNode.id
                        });
                    }
                    
                    // Recursively position children
                    if (treeNode.children.length > 0 && !treeNode.isCollapsed) {
                        positionTreeNodes(treeNode.children, x, y, spacing * 0.8);
                    }
                });
            };
            
            positionTreeNodes(treeStructure.rootNodes);
            
            return { nodes, links };
        } else {
            // Fallback to example data (existing logic)
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

                // Apply saved position if it exists, but let physics continue naturally
                if (savedPosition) {
                    node.x = savedPosition.x;
                    node.y = savedPosition.y;
                    node.vx = 0; // Zero initial velocity
                    node.vy = 0;
                    // Don't fix position - let physics simulation continue naturally
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
        }
    }, [useBackendData, treeStructure, collapsedNodes, nodePositions, dataVersion, dynamicNodes, dynamicTree]);
    
    // Debug effect to monitor graphData changes (must be after graphData definition)
    useEffect(() => {
        console.log('📋 GraphData updated:', {
            nodeCount: graphData.nodes.length,
            linkCount: graphData.links.length,
            useBackendData,
            dataVersion
        });
        
        // Gentle graph refresh after graphData updates
        if (graphRef.current && graphData.nodes.length > 0) {
            setTimeout(() => {
                console.log('🔄 Gentle graph refresh after data change');
                if (graphRef.current.d3ReheatSimulation) {
                    // Only reheat if simulation has actually stopped
                    if (graphRef.current.d3AlphaMin && graphRef.current.d3Alpha() < 0.01) {
                        graphRef.current.d3ReheatSimulation();
                    }
                }
            }, 200);
        }
    }, [graphData, dataVersion, useBackendData]);

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
        
        // Track node position in ref - always update ref for parent positioning
        if (node.x !== undefined && node.y !== undefined) {
            const position = { x: node.x, y: node.y };
            nodePositionsRef.current.set(node.id, position);
            
            // Only update parent state when we should save positions (after new nodes added)
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
        
        if (node.isNextTarget) {
            borderColor = '#ffff00';
            borderWidth = 3;
        } else if (node.isProcessing) {
            borderColor = '#ff6b6b';
            borderWidth = 3;
        } else if (node.isPriority) {
            borderColor = '#ffd700';
            borderWidth = 2;
        }
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = Math.max(borderWidth/globalScale, 1);
        ctx.stroke();
        
        // Add glow effect for special nodes
        if (node.isPriority || node.isNextTarget || node.isProcessing) {
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
            {/* Loading and Error States */}
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    zIndex: 1000
                }}>
                    Loading backend data...
                </div>
            )}
            
            {error && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    background: 'rgba(255,0,0,0.8)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    zIndex: 1000
                }}>
                    Backend Error: {error}
                </div>
            )}
            
            {/* Enhanced Data Source and Connection Status Indicator */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
            }}>
                <div style={{
                    background: useBackendData ? 'rgba(0,128,0,0.8)' : 'rgba(128,128,0,0.8)',
                    color: 'white',
                    padding: '5px 10px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : 
                                       connectionStatus === 'connecting' ? '#FF9800' : '#f44336'
                    }} />
                    {useBackendData ? 'Live Backend Data' : 'Example Data'}
                </div>
                
                {/* Activity Log Mini Panel */}
                {activityLog.length > 0 && (
                    <div style={{
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '8px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        maxWidth: '200px',
                        maxHeight: '100px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Recent Activity:</div>
                        {activityLog.slice(0, 3).map(entry => (
                            <div key={entry.id} style={{
                                marginBottom: '2px',
                                opacity: 0.9,
                                color: entry.type === 'high-score' ? '#4CAF50' : 
                                       entry.type === 'medium-score' ? '#FF9800' : 
                                       entry.type === 'connected' ? '#4CAF50' : '#fff'
                            }}>
                                {entry.timestamp}: {entry.message}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="reactflow-wrapper">
                <ForceGraph2D
                    ref={graphRef}
                    key={`graph-${dataVersion}-${useBackendData ? 'backend' : 'example'}`}
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