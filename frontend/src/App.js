import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import TreeView from './components/TreeView';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import SimulationControls from './components/SimulationControls';
import ConversationControls from './components/ConversationControls';
import { exampleData } from './data/exampleData';
import backendAPI from './services/BackendAPI';
import { buildTreeFromNodes, calculateSystemStats } from './utils/dataTransforms';
import './styles.css';

const App = () => {
    const [activePanel, setActivePanel] = useState(null); // Start with no panel open
    const [selectedNode, setSelectedNode] = useState(null);
    const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
    const [nodePositions, setNodePositions] = useState({}); // Store all node positions
    const [dynamicNodes, setDynamicNodes] = useState({}); // Store dynamically generated nodes
    const [controlStatus, setControlStatus] = useState({ status: 'idle', message: 'Ready to start' }); // Control status
    const generateNodeRef = React.useRef(null);
    
    // Centralized data structures - single source of truth
    const [allNodes, setAllNodes] = useState(new Map()); // Map<string, RawNode>
    const [tree, setTree] = useState(null); // TreeNode hierarchy
    const [workerStatus, setWorkerStatus] = useState({ 
        status: 'not_started', 
        pid: null, 
        isGenerating: false,
        lastHeartbeat: null 
    });
    const [systemStatus, setSystemStatus] = useState({
        connectionStatus: 'disconnected',
        lastUpdateTime: null,
        totalUpdates: 0,
        errors: []
    });

    // Rebuild tree when allNodes changes
    const computedTree = useMemo(() => {
        return buildTreeFromNodes(allNodes);
    }, [allNodes]);
    
    const computedStats = useMemo(() => {
        return calculateSystemStats(allNodes, computedTree);
    }, [allNodes, computedTree]);
    
    // Update tree when computed tree changes
    useEffect(() => {
        setTree(computedTree);
    }, [computedTree]);

    // Enhanced WebSocket handler for all backend updates
    const handleWebSocketMessage = useCallback((message) => {
        try {
            const update = typeof message === 'string' ? JSON.parse(message) : message;
            
            // Handle connection status updates
            if (update.type === 'connection_status') {
                setSystemStatus(prev => ({
                    ...prev,
                    connectionStatus: update.status
                }));
                return;
            }
            
            // Handle worker status updates
            if (update.type === 'worker_status') {
                setWorkerStatus(prev => ({
                    ...prev,
                    ...update.data,
                    lastHeartbeat: new Date()
                }));
                return;
            }
            
            // Handle node updates
            if (update.id) {
                console.log('🌐 App: Processing node update:', update.id, 'Score:', update.score?.toFixed(3));
                
                setAllNodes(prev => {
                    const newNodes = new Map(prev);
                    const existingNode = newNodes.get(update.id);
                    
                    if (existingNode) {
                        // Update existing node
                        newNodes.set(update.id, { ...existingNode, ...update });
                    } else {
                        // Add new node
                        newNodes.set(update.id, update);
                        
                        // Show notification for high-scoring new conversations
                        if (update.score && update.score > 0.7) {
                            console.log('🎆 New high-scoring conversation!', update.score.toFixed(3));
                        }
                    }
                    
                    return newNodes;
                });
                
                setSystemStatus(prev => ({
                    ...prev,
                    lastUpdateTime: new Date(),
                    totalUpdates: prev.totalUpdates + 1
                }));
            }
        } catch (error) {
            console.error('❌ App: Failed to process WebSocket message:', error);
            setSystemStatus(prev => ({
                ...prev,
                errors: [...prev.errors, { timestamp: new Date(), error: error.message }].slice(-10)
            }));
        }
    }, []);

    // Setup WebSocket connection and load initial data
    useEffect(() => {
        // Load initial backend data
        const loadInitialData = async () => {
            try {
                const graphData = await backendAPI.getGraph();
                
                // Convert array to Map
                const nodesMap = new Map();
                graphData.forEach(node => {
                    nodesMap.set(node.id, node);
                });
                
                setAllNodes(nodesMap);
                setSystemStatus(prev => ({
                    ...prev,
                    lastUpdateTime: new Date(),
                    totalUpdates: graphData.length
                }));
                
                console.log('🌐 App: Loaded', graphData.length, 'initial nodes');
            } catch (err) {
                console.error('Failed to load initial backend data:', err);
                setSystemStatus(prev => ({
                    ...prev,
                    errors: [...prev.errors, { timestamp: new Date(), error: err.message }].slice(-10)
                }));
            }
        };

        // Load worker status
        const loadWorkerStatus = async () => {
            try {
                const status = await backendAPI.getWorkerStatus();
                setWorkerStatus(prev => ({
                    ...prev,
                    ...status,
                    lastHeartbeat: new Date()
                }));
            } catch (err) {
                console.error('Failed to load worker status:', err);
            }
        };

        loadInitialData();
        loadWorkerStatus();
        
        // Setup WebSocket for real-time updates
        try {
            backendAPI.connectWebSocket(handleWebSocketMessage);
            console.log('🌐 App: WebSocket connected for real-time updates');
        } catch (err) {
            console.error('Failed to connect WebSocket:', err);
            setSystemStatus(prev => ({
                ...prev,
                errors: [...prev.errors, { timestamp: new Date(), error: err.message }].slice(-10)
            }));
        }
        
        // Cleanup WebSocket on unmount
        return () => {
            backendAPI.disconnectWebSocket();
        };
    }, [handleWebSocketMessage]);

    const handlePanelChange = (panelName) => {
        setActivePanel(panelName);
    };

    const handleNodeSelect = (nodeData) => {
        setSelectedNode(nodeData);
        setNodeDetailsOpen(true);
    };

    const handleNodeDetailsClose = () => {
        setNodeDetailsOpen(false);
        setSelectedNode(null);
    };


    const handleGenerateNode = () => {
        if (generateNodeRef.current) {
            generateNodeRef.current();
        }
    };

    const handleControlStatusChange = (status) => {
        setControlStatus(status);
    };

    // Worker control functions
    const handleWorkerControl = useCallback(async (action) => {
        try {
            let result;
            switch (action) {
                case 'start':
                    result = await backendAPI.startWorker();
                    break;
                case 'stop':
                    result = await backendAPI.stopWorker();
                    break;
                case 'status':
                    result = await backendAPI.getWorkerStatus();
                    break;
                default:
                    throw new Error(`Unknown worker action: ${action}`);
            }
            
            setWorkerStatus(prev => ({
                ...prev,
                status: result.status,
                pid: result.pid,
                lastHeartbeat: new Date()
            }));
            
            return result;
        } catch (error) {
            console.error(`Worker ${action} failed:`, error);
            setSystemStatus(prev => ({
                ...prev,
                errors: [...prev.errors, { timestamp: new Date(), error: error.message }].slice(-10)
            }));
            throw error;
        }
    }, []);

    return (
        <div className="app">
            <TopBar />
            
            <div className="main-content">
                <LeftSidebar 
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                    allNodes={allNodes}
                    tree={tree}
                    systemStatus={systemStatus}
                    workerStatus={workerStatus}
                    computedStats={computedStats}
                    selectedNode={selectedNode}
                    onWorkerControl={handleWorkerControl}
                />

                <TreeView 
                    tree={tree}
                    selectedNode={selectedNode}
                    onNodeSelect={handleNodeSelect}
                    onGenerateNode={generateNodeRef}
                    nodePositions={nodePositions}
                    setNodePositions={setNodePositions}
                />

                <ConversationControls 
                    onStatusChange={handleControlStatusChange}
                    workerStatus={workerStatus}
                    onWorkerControl={handleWorkerControl}
                />

                <SimulationControls 
                    onGenerateNode={handleGenerateNode}
                />

                <NodeDetailsPanel 
                    isOpen={nodeDetailsOpen}
                    selectedNode={selectedNode}
                    tree={tree}
                    allNodes={allNodes}
                    onClose={handleNodeDetailsClose}
                />
            </div>
        </div>
    );
};

export default App;