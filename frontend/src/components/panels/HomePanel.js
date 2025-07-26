import React, { useState } from 'react';

const HomePanel = ({ isOpen, onClose, allNodes, tree, systemStatus, computedStats }) => {
    const [userPrompt, setUserPrompt] = useState('');

    const handleSave = () => {
        console.log('User prompt saved:', userPrompt);
        // TODO: Save to global state or context
    };

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>👤 User Profile</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                {/* Graph Statistics Dashboard */}
                <div style={{ marginBottom: '25px' }}>
                    <h4>Conversation Graph Overview</h4>
                    
                    {systemStatus?.errors?.length > 0 && (
                        <div style={{
                            padding: '10px',
                            backgroundColor: 'rgba(244, 67, 54, 0.1)',
                            border: '1px solid #f44336',
                            borderRadius: '4px',
                            color: '#ff6666',
                            fontSize: '12px',
                            marginBottom: '15px'
                        }}>
                            Recent errors: {systemStatus.errors[systemStatus.errors.length - 1]?.error}
                        </div>
                    )}

                    {computedStats && (
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '12px',
                            marginBottom: '15px'
                        }}>
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#2a2a2a',
                                borderRadius: '6px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                                    {computedStats.totalNodes}
                                </div>
                                <div style={{ fontSize: '12px', color: '#999' }}>Total Nodes</div>
                            </div>
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#2a2a2a',
                                borderRadius: '6px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                                    {computedStats.maxDepth}
                                </div>
                                <div style={{ fontSize: '12px', color: '#999' }}>Max Depth</div>
                            </div>
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#2a2a2a',
                                borderRadius: '6px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                                    {computedStats.averageScore.toFixed(3)}
                                </div>
                                <div style={{ fontSize: '12px', color: '#999' }}>Avg Score</div>
                            </div>
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#2a2a2a',
                                borderRadius: '6px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9c27b0' }}>
                                    {Object.keys(computedStats.nodesByDepth).length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#999' }}>Depth Levels</div>
                            </div>
                        </div>
                    )}

                    {computedStats?.topScoringNode && (
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#1b4d3e',
                            borderRadius: '6px',
                            marginBottom: '15px'
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4CAF50', marginBottom: '5px' }}>
                                Best Performing Node
                            </div>
                            <div style={{ fontSize: '12px', color: '#ccc' }}>
                                <strong>ID:</strong> {computedStats.topScoringNode.id} | 
                                <strong> Score:</strong> {computedStats.topScoringNode.score?.toFixed(3) || 'N/A'} | 
                                <strong> Depth:</strong> {computedStats.topScoringNode.depth || 0}
                            </div>
                            {computedStats.topScoringNode.prompt && (
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: '#aaa', 
                                    marginTop: '5px',
                                    fontStyle: 'italic',
                                    maxHeight: '40px',
                                    overflow: 'hidden'
                                }}>
                                    "{computedStats.topScoringNode.prompt.substring(0, 100)}..."
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* User Profile Definition */}
                <div style={{ marginBottom: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
                    <h4>Define Your User</h4>
                    <p style={{ fontSize: '14px', marginBottom: '10px', color: '#ccc' }}>
                        Enter a prompt that describes what kind of user you want to simulate:
                    </p>
                    <textarea
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="Example: A curious student exploring AI concepts, asking thoughtful questions and seeking deep understanding..."
                        style={{
                            width: '100%',
                            minHeight: '120px',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #444',
                            backgroundColor: '#2a2a2a',
                            color: '#fff',
                            fontSize: '14px',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        onClick={handleSave}
                        style={{
                            marginTop: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Save User Profile
                    </button>
                </div>
                
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                    <strong style={{ color: '#ccc' }}>Quick Tips:</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '13px', color: '#aaa' }}>
                        <li>Be specific about interests and personality</li>
                        <li>Include learning style preferences</li>
                        <li>Mention any particular goals or objectives</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default HomePanel;