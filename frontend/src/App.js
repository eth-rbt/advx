import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import TreeView from './components/TreeView';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import SimulationControls from './components/SimulationControls';
import ConversationControls from './components/ConversationControls';
import { exampleData } from './data/exampleData';
import backendAPI from './services/BackendAPI';
import './styles.css';

const App = () => {
    const [activePanel, setActivePanel] = useState(null); // Start with no panel open
    const [selectedNode, setSelectedNode] = useState(null);
    const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
    const [nodePositions, setNodePositions] = useState({}); // Store all node positions
    const [dynamicNodes, setDynamicNodes] = useState({}); // Store dynamically generated nodes
    const [controlStatus, setControlStatus] = useState({ status: 'idle', message: 'Ready to start' }); // Control status
    const generateNodeRef = React.useRef(null);
    
    // Centralized backend nodes state - shared across all components
    const [allNodes, setAllNodes] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [lastUpdateTime, setLastUpdateTime] = useState(null);

    // Centralized WebSocket handler for all backend node updates
    const handleWebSocketMessage = useCallback((message) => {
        try {
            const update = typeof message === 'string' ? JSON.parse(message) : message;
            
            if (update.type === 'connection_status') {
                setConnectionStatus(update.status);
                return;
            }
            
            // Handle node updates
            if (update.id) {
                console.log('🌐 App: Processing node update:', update.id, 'Score:', update.score?.toFixed(3));
                
                setAllNodes(prev => {
                    const existingIndex = prev.findIndex(n => n.id === update.id);
                    let newNodes;
                    
                    if (existingIndex >= 0) {
                        // Update existing node
                        newNodes = [...prev];
                        newNodes[existingIndex] = { ...newNodes[existingIndex], ...update };
                    } else {
                        // Add new node
                        newNodes = [...prev, update];
                        
                        // Show notification for high-scoring new conversations
                        if (update.score && update.score > 0.7) {
                            console.log('🎆 New high-scoring conversation!', update.score.toFixed(3));
                        }
                    }
                    
                    return newNodes;
                });
                
                setLastUpdateTime(new Date());
            }
        } catch (error) {
            console.error('❌ App: Failed to process WebSocket message:', error);
        }
    }, []);

    // Setup WebSocket connection on app mount
    useEffect(() => {
        // Load initial backend data
        const loadInitialData = async () => {
            try {
                const graphData = await backendAPI.getGraph();
                setAllNodes(graphData);
                setLastUpdateTime(new Date());
                console.log('🌐 App: Loaded', graphData.length, 'initial nodes');
            } catch (err) {
                console.error('Failed to load initial backend data:', err);
            }
        };

        loadInitialData();
        
        // Setup WebSocket for real-time updates
        try {
            backendAPI.connectWebSocket(handleWebSocketMessage);
            console.log('🌐 App: WebSocket connected for real-time updates');
        } catch (err) {
            console.error('Failed to connect WebSocket:', err);
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

    return (
        <div className="app">
            <TopBar />
            
            <div className="main-content">
                <LeftSidebar 
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                    nodes={exampleData.nodes}
                    dynamicNodes={dynamicNodes}
                    allNodes={allNodes}
                    connectionStatus={connectionStatus}
                    lastUpdateTime={lastUpdateTime}
                />

                <TreeView 
                    onNodeSelect={handleNodeSelect}
                    onGenerateNode={generateNodeRef}
                    nodePositions={nodePositions}
                    setNodePositions={setNodePositions}
                    dynamicNodes={dynamicNodes}
                    setDynamicNodes={setDynamicNodes}
                />

                <ConversationControls 
                    onStatusChange={handleControlStatusChange}
                />

                <SimulationControls 
                    onGenerateNode={handleGenerateNode}
                />

                <NodeDetailsPanel 
                    isOpen={nodeDetailsOpen}
                    selectedNode={selectedNode}
                    onClose={handleNodeDetailsClose}
                />
            </div>
        </div>
    );
};

export default App;