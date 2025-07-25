import React from 'react';
import { exampleData } from '../../data/exampleData';

const AnalyticsPanel = ({ isOpen, onClose }) => {
    const totalNodes = Object.keys(exampleData.nodes).length;
    const priorityNodes = exampleData.board.priorityQueue.length;
    const avgScore = Object.values(exampleData.nodes).reduce((sum, node) => sum + (node.score || 0), 0) / totalNodes;

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>📊 Analytics</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                <div style={{ marginBottom: '20px' }}>
                    <h4>Conversation Metrics</h4>
                </div>
                
                <div className="metric-card" style={{ marginBottom: '15px' }}>
                    <div className="metric-value">{totalNodes}</div>
                    <div className="metric-label">Total Nodes</div>
                </div>
                
                <div className="metric-card" style={{ marginBottom: '15px' }}>
                    <div className="metric-value">{priorityNodes}</div>
                    <div className="metric-label">Priority Queue</div>
                </div>
                
                <div className="metric-card" style={{ marginBottom: '15px' }}>
                    <div className="metric-value">{avgScore.toFixed(1)}</div>
                    <div className="metric-label">Average Score</div>
                </div>

                <div style={{ marginTop: '20px' }}>
                    <h4>Top Conversations</h4>
                    {Object.values(exampleData.nodes)
                        .sort((a, b) => (b.score || 0) - (a.score || 0))
                        .slice(0, 3)
                        .map(node => (
                            <div key={node.id} style={{ 
                                padding: '8px', 
                                margin: '5px 0', 
                                background: 'rgba(255,255,255,0.1)', 
                                borderRadius: '4px' 
                            }}>
                                <strong>Node {node.id}</strong> ({node.score})
                                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                    {node.prompt}
                                </div>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPanel;