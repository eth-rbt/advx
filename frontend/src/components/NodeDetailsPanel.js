import React from 'react';

const NodeDetailsPanel = ({ isOpen, selectedNode, onClose }) => {
    if (!selectedNode) return null;

    return (
        <div className={`node-details-panel ${isOpen ? 'open' : ''}`}>
            <button className="close-btn" onClick={onClose}>
                ×
            </button>
            <h3>Node Details</h3>
            <div style={{ marginTop: '15px' }}>
                <p><strong>ID:</strong> {selectedNode.id}</p>
                <p><strong>Turns:</strong> {selectedNode.turns}</p>
                <p><strong>Prompt:</strong> {selectedNode.prompt}</p>
                <p><strong>Score:</strong> {selectedNode.score}</p>
                <p><strong>Conversation:</strong></p>
                <p style={{ 
                    fontStyle: 'italic', 
                    marginTop: '5px', 
                    padding: '10px', 
                    background: 'rgba(255, 255, 255, 0.1)', 
                    borderRadius: '5px',
                    lineHeight: '1.5'
                }}>
                    {selectedNode.convo}
                </p>
            </div>
        </div>
    );
};

export default NodeDetailsPanel;