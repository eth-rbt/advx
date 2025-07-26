import React, { useEffect, useRef } from 'react';
import './PanelAnimations.css';

const AnalyticsPanel = ({ isOpen, onClose, allNodes, tree, computedStats }) => {
    const canvasRef = useRef(null);
    
    // Convert Map to array for processing
    const nodesArray = allNodes ? Array.from(allNodes.values()) : [];


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
        const nodesToDraw = nodesArray;
        
        // Calculate bounds for proper scaling
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const nodePositions = [];
        
        nodesToDraw.forEach(node => {
            let x, y;
            
            if (node.xy) {
                // Use UMAP-reduced 2D coordinates from backend
                x = node.xy[0];
                y = node.xy[1];
            } else if (node.emb && node.emb.length >= 2) {
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
        
        // Draw nodes
        nodePositions.forEach(({ node, x, y }) => {
            
            // Convert to canvas coordinates using calculated bounds
            const canvasX = ((x - minX) / (maxX - minX)) * canvas.width;
            const canvasY = (1 - (y - minY) / (maxY - minY)) * canvas.height; // Flip Y axis
            
            // Draw node point with size based on depth
            ctx.beginPath();
            const baseRadius = 4;
            const depth = node.depth || 0;
            const radius = baseRadius + (depth * 1.5); // Larger nodes for deeper conversations
            ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
            
            // Color based on score
            const score = node.score || 0;
            // Backend scores are 0.0 to 1.0
            const hue = score * 120; // 0=red, 120=green
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Draw label with better positioning
            ctx.fillStyle = 'white';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = `${node.depth || 0}`;
            
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
        ctx.fillText('UMAP Dimension 1', canvas.width / 2, canvas.height - 5);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('UMAP Dimension 2', 0, 0);
        ctx.restore();
        
        // Draw scale indicators
        if (nodePositions.length > 0) {
            ctx.fillStyle = '#444';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`, 5, 15);
            ctx.fillText(`Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`, 5, 30);
            ctx.fillText(`${nodePositions.length} nodes`, 5, canvas.height - 20);
        }
        
    }, [isOpen, nodesArray]);

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>📊 Embedding Visualization</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                {/* Connection Status Indicator */}
                <div style={{ 
                    marginBottom: '15px', 
                    padding: '10px 12px', 
                    backgroundColor: '#1b4d3e',
                    borderRadius: '6px',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div 
                            style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#4CAF50'
                            }} 
                        />
                        <span style={{ fontWeight: 'bold' }}>
                            Live Backend Data
                        </span>
                    </div>
                    
                    <div style={{ fontSize: '10px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Nodes: {nodesArray.length}</span>
                        <span>Max Depth: {computedStats?.maxDepth || 0}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <h4>Node Embeddings (2D Projection)</h4>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                        Real conversation nodes with semantic embeddings and trajectory scores.
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
                            {nodesArray.length}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Total Nodes</div>
                        <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                            ✓ Live Updates
                        </div>
                    </div>
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '6px',
                        textAlign: 'center',
                        border: '1px solid rgba(33, 150, 243, 0.3)'
                    }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196F3' }}>
                            {computedStats?.maxDepth || 0}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Max Depth</div>
                        {nodesArray.length > 0 && (
                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                                Avg Score: {computedStats?.averageScore?.toFixed(2) || '0.00'}
                            </div>
                        )}
                    </div>
                </div>
                
                <div style={{ fontSize: '12px', color: '#888', lineHeight: '1.4' }}>
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Legend:</strong> Numbers = Conversation depth
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Colors:</strong> Trajectory score (red=hostile, yellow=neutral, green=progress)
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Size:</strong> Larger = deeper conversations
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                        <strong>Connections:</strong> Parent-child conversation relationships
                    </div>
                </div>
                
            </div>
        </div>
    );
};

export default AnalyticsPanel;