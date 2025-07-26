import React, { useEffect, useRef, useState, useCallback } from 'react';
import backendAPI from '../../services/BackendAPI';
import './PanelAnimations.css';

const AnalyticsPanel = ({ isOpen, onClose, nodes = {}, dynamicNodes = {} }) => {
    const canvasRef = useRef(null);
    const [backendNodes, setBackendNodes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [useBackendData, setUseBackendData] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const [totalUpdates, setTotalUpdates] = useState(0);
    
    const allNodes = useBackendData ? backendNodes : { ...nodes, ...dynamicNodes };

    // Enhanced WebSocket handler for real-time analytics updates
    const handleWebSocketMessage = useCallback((message) => {
        if (!isOpen) return; // Only process if panel is open
        
        try {
            const update = typeof message === 'string' ? JSON.parse(message) : message;
            
            if (update.type === 'connection_status') {
                setConnectionStatus(update.status);
                return;
            }
            
            // Handle node updates for analytics
            if (update.id) {
                console.log('📊 Analytics: Processing node update:', update.id);
                setBackendNodes(prev => {
                    const existingIndex = prev.findIndex(n => n.id === update.id);
                    let newNodes;
                    
                    if (existingIndex >= 0) {
                        // Update existing node
                        newNodes = [...prev];
                        newNodes[existingIndex] = { ...newNodes[existingIndex], ...update };
                    } else {
                        // Add new node
                        newNodes = [...prev, update];
                    }
                    
                    return newNodes;
                });
                
                setLastUpdateTime(new Date());
                setTotalUpdates(prev => prev + 1);
                setUseBackendData(true);
            }
        } catch (error) {
            console.error('❌ Analytics: Failed to process WebSocket message:', error);
        }
    }, [isOpen]);
    
    // Load initial backend data and setup WebSocket when panel opens
    useEffect(() => {
        if (!isOpen) {
            // Disconnect WebSocket when panel closes to save resources
            backendAPI.disconnectWebSocket();
            return;
        }
        
        const loadBackendNodes = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const graphData = await backendAPI.getGraph();
                setBackendNodes(graphData);
                setUseBackendData(true);
                setLastUpdateTime(new Date());
                console.log('📊 Analytics: Loaded', graphData.length, 'initial nodes');
            } catch (err) {
                console.error('Failed to load backend data for analytics:', err);
                setError(err.message);
                setUseBackendData(false);
            } finally {
                setIsLoading(false);
            }
        };

        loadBackendNodes();
        
        // Setup WebSocket for real-time updates
        try {
            backendAPI.connectWebSocket(handleWebSocketMessage);
            console.log('📊 Analytics: WebSocket connected for real-time updates');
        } catch (err) {
            console.error('Failed to connect WebSocket for analytics:', err);
        }
        
        // Cleanup on unmount or when panel closes
        return () => {
            if (!isOpen) {
                backendAPI.disconnectWebSocket();
            }
        };
    }, [isOpen, handleWebSocketMessage]);

    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        // Set canvas size
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // Vertical center line
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        
        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Draw nodes as points based on semantic embeddings
        const nodesToDraw = useBackendData ? allNodes : Object.values(allNodes);
        
        // Calculate bounds for proper scaling
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const nodePositions = [];
        
        nodesToDraw.forEach(node => {
            let x, y;
            
            if (useBackendData && node.xy) {
                // Use UMAP-reduced 2D coordinates from backend
                x = node.xy[0];
                y = node.xy[1];
            } else if (useBackendData && node.emb && node.emb.length >= 2) {
                // Use first two dimensions of raw embeddings as fallback
                x = node.emb[0] || 0;
                y = node.emb[1] || 0;
                // Normalize to reasonable range
                x = Math.tanh(x * 0.1); // Scale down high-dimensional values
                y = Math.tanh(y * 0.1);
            } else {
                // Generate deterministic coordinates for example data based on content
                const text = node.prompt || node.convo || node.id || '';
                const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                x = ((hash * 7919) % 2000 - 1000) / 1000;
                y = ((hash * 6271) % 2000 - 1000) / 1000;
            }
            
            nodePositions.push({ node, x, y });
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });
        
        // Add padding to bounds
        const padX = (maxX - minX) * 0.1 || 1;
        const padY = (maxY - minY) * 0.1 || 1;
        minX -= padX; maxX += padX;
        minY -= padY; maxY += padY;
        
        // Draw parent-child connections first (behind nodes)
        if (useBackendData) {
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.lineWidth = 1;
            
            nodePositions.forEach(({ node, x, y }) => {
                if (node.parent) {
                    const parentPos = nodePositions.find(p => p.node.id === node.parent);
                    if (parentPos) {
                        const parentCanvasX = ((parentPos.x - minX) / (maxX - minX)) * canvas.width;
                        const parentCanvasY = (1 - (parentPos.y - minY) / (maxY - minY)) * canvas.height;
                        const childCanvasX = ((x - minX) / (maxX - minX)) * canvas.width;
                        const childCanvasY = (1 - (y - minY) / (maxY - minY)) * canvas.height;
                        
                        ctx.beginPath();
                        ctx.moveTo(parentCanvasX, parentCanvasY);
                        ctx.lineTo(childCanvasX, childCanvasY);
                        ctx.stroke();
                    }
                }
            });
        }
        
        // Draw nodes
        nodePositions.forEach(({ node, x, y }) => {
            
            // Convert to canvas coordinates using calculated bounds
            const canvasX = ((x - minX) / (maxX - minX)) * canvas.width;
            const canvasY = (1 - (y - minY) / (maxY - minY)) * canvas.height; // Flip Y axis
            
            // Draw node point with size based on depth
            ctx.beginPath();
            const baseRadius = useBackendData ? 4 : 5;
            const depth = useBackendData ? (node.depth || 0) : 0;
            const radius = baseRadius + (depth * 1.5); // Larger nodes for deeper conversations
            ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
            
            // Color based on score
            const score = useBackendData ? (node.score || 0) : (node.score || 50) / 100;
            if (useBackendData) {
                // Backend scores are 0.0 to 1.0
                const hue = score * 120; // 0=red, 120=green
                ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            } else {
                // Example data scores are 0 to 100
                const hue = (score / 100) * 120;
                ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            }
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = useBackendData ? '#fff' : '#ddd';
            ctx.lineWidth = useBackendData ? 1.5 : 1;
            ctx.stroke();
            
            // Draw label with better positioning
            ctx.fillStyle = 'white';
            ctx.font = useBackendData ? '11px Arial' : '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = useBackendData ? `${node.depth || 0}` : node.id;
            
            // Add background for label readability
            const labelWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(canvasX - labelWidth/2 - 2, canvasY - radius - 15, labelWidth + 4, 12);
            
            // Draw label text
            ctx.fillStyle = 'white';
            ctx.fillText(label, canvasX, canvasY - radius - 9);
        });
        
        // Draw axes labels and scale info
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(useBackendData ? 'UMAP Dimension 1' : 'Pseudo-Embedding X', canvas.width / 2, canvas.height - 5);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(useBackendData ? 'UMAP Dimension 2' : 'Pseudo-Embedding Y', 0, 0);
        ctx.restore();
        
        // Draw scale indicators
        if (useBackendData && nodePositions.length > 0) {
            ctx.fillStyle = '#444';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`, 5, 15);
            ctx.fillText(`Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`, 5, 30);
            ctx.fillText(`${nodePositions.length} nodes`, 5, canvas.height - 20);
        }
        
    }, [isOpen, allNodes]);

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>📊 Embedding Visualization</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                {/* Enhanced Connection Status Indicator */}
                <div style={{ 
                    marginBottom: '15px', 
                    padding: '10px 12px', 
                    backgroundColor: useBackendData ? '#1b4d3e' : '#4a4a4a',
                    borderRadius: '6px',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div 
                            className={connectionStatus === 'connecting' ? 'pulse-animation' : ''}
                            style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : 
                                               connectionStatus === 'connecting' ? '#FF9800' : '#f44336'
                            }} 
                        />
                        <span style={{ fontWeight: 'bold' }}>
                            {useBackendData ? 'Live Backend Data' : 'Example Data'}
                        </span>
                        {isLoading && <span style={{ color: '#FF9800' }}>Loading...</span>}
                    </div>
                    
                    {useBackendData && (
                        <div style={{ fontSize: '10px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Status: {connectionStatus}</span>
                            <span>Updates: {totalUpdates}</span>
                            {lastUpdateTime && (
                                <span>Last: {lastUpdateTime.toLocaleTimeString()}</span>
                            )}
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        border: '1px solid #f44336',
                        borderRadius: '4px',
                        color: '#ff6666',
                        fontSize: '12px'
                    }}>
                        Backend Error: {error}
                    </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                    <h4>Node Embeddings (2D Projection)</h4>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                        {useBackendData 
                            ? 'Real conversation nodes with semantic embeddings and trajectory scores.' 
                            : 'Simulated embedding visualization for demo purposes.'
                        }
                    </p>
                </div>
                
                <canvas 
                    ref={canvasRef}
                    style={{
                        width: '100%',
                        height: '300px',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        marginBottom: '15px'
                    }}
                />

                {/* Analytics Stats */}
                {/* Enhanced Analytics Stats Grid */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '15px'
                }}>
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '6px',
                        textAlign: 'center',
                        border: '1px solid rgba(76, 175, 80, 0.3)'
                    }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>
                            {useBackendData ? allNodes.length : Object.keys(allNodes).length}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Total Nodes</div>
                        {useBackendData && (
                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                                ✓ Live Updates
                            </div>
                        )}
                    </div>
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '6px',
                        textAlign: 'center',
                        border: '1px solid rgba(33, 150, 243, 0.3)'
                    }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196F3' }}>
                            {useBackendData 
                                ? (allNodes.length > 0 ? Math.max(...allNodes.map(n => n.depth || 0), 0) : 0)
                                : (Object.keys(allNodes).length > 0 ? Math.max(...Object.values(allNodes).map(n => n.turns || 0), 0) : 0)
                            }
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                            {useBackendData ? 'Max Depth' : 'Max Turns'}
                        </div>
                        {useBackendData && allNodes.length > 0 && (
                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                                Avg Score: {(allNodes.reduce((sum, n) => sum + (n.score || 0), 0) / allNodes.length).toFixed(2)}
                            </div>
                        )}
                    </div>
                </div>
                
                <div style={{ fontSize: '12px', color: '#888', lineHeight: '1.4' }}>
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Legend:</strong> {useBackendData ? 'Numbers = Conversation depth' : 'Node IDs'}
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Colors:</strong> {useBackendData ? 'Trajectory score' : 'Quality score'} (red=hostile, yellow=neutral, green=progress)
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Size:</strong> {useBackendData ? 'Larger = deeper conversations' : 'Fixed size'}
                    </div>
                    {useBackendData && (
                        <div style={{ fontSize: '11px', color: '#666' }}>
                            <strong>Connections:</strong> Parent-child conversation relationships
                        </div>
                    )}
                </div>
                
            </div>
        </div>
    );
};

export default AnalyticsPanel;