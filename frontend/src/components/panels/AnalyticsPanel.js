import React, { useEffect, useRef } from 'react';

const AnalyticsPanel = ({ isOpen, onClose, nodes = {}, dynamicNodes = {} }) => {
    const canvasRef = useRef(null);
    const allNodes = { ...nodes, ...dynamicNodes };

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
        
        // Draw nodes as points
        Object.values(allNodes).forEach(node => {
            // Generate pseudo-random embedding coordinates based on node properties
            // In real implementation, these would come from actual embeddings
            const hash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const x = ((hash * 7919) % 200 - 100) / 100; // Pseudo-random X between -1 and 1
            const y = ((hash * 6271) % 200 - 100) / 100; // Pseudo-random Y between -1 and 1
            
            // Convert to canvas coordinates
            const canvasX = (x + 1) * canvas.width / 2;
            const canvasY = (1 - y) * canvas.height / 2; // Flip Y axis
            
            // Draw node point
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
            
            // Color based on score
            const score = node.score || 50;
            const hue = (score / 100) * 120; // 0=red, 120=green
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.fill();
            
            // Draw label
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(node.id, canvasX, canvasY - 8);
        });
        
        // Draw axes labels
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Embedding X', canvas.width / 2, canvas.height - 5);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Embedding Y', 0, 0);
        ctx.restore();
        
    }, [isOpen, allNodes]);

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>📊 Embedding Visualization</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                <div style={{ marginBottom: '10px' }}>
                    <h4>Node Embeddings (2D Projection)</h4>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                        Visualization of conversation nodes in embedding space. Color indicates score (red=low, green=high).
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
                
                <div style={{ fontSize: '12px', color: '#888' }}>
                    <strong>Note:</strong> Using simulated embeddings. In production, these would be actual semantic embeddings from your model.
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPanel;