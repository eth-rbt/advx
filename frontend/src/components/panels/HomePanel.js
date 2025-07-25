import React from 'react';

const HomePanel = ({ isOpen, onClose }) => {
    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>🏠 Home</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                <div style={{ marginBottom: '20px' }}>
                    <h4>Welcome to Multi:verse</h4>
                    <p>Navigate your conversation universe with ease.</p>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <strong>Controls:</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                        <li>Single-click nodes to toggle children</li>
                        <li>Double-click nodes for details</li>
                        <li>Press Space to recenter view</li>
                        <li>Drag to pan, scroll to zoom</li>
                    </ul>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <strong>Priority Nodes:</strong>
                    <p style={{ fontSize: '14px', marginTop: '5px' }}>
                        Golden glowing nodes indicate high-priority conversations.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HomePanel;