import React, { useState, useEffect } from 'react';
import backendAPI from '../../services/BackendAPI';

const HomePanel = ({ isOpen, onClose }) => {
    const [userPrompt, setUserPrompt] = useState('');
    const [graphStats, setGraphStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load graph statistics when panel opens
    useEffect(() => {
        if (!isOpen) return;
        
        const loadGraphStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const graphData = await backendAPI.getGraph();
                
                // Calculate statistics
                const stats = {
                    totalNodes: graphData.length,
                    maxDepth: graphData.length > 0 ? Math.max(...graphData.map(n => n.depth || 0)) : 0,
                    averageScore: graphData.length > 0 
                        ? graphData.reduce((sum, n) => sum + (n.score || 0), 0) / graphData.length 
                        : 0,
                    nodesByDepth: graphData.reduce((acc, node) => {
                        const depth = node.depth || 0;
                        acc[depth] = (acc[depth] || 0) + 1;
                        return acc;
                    }, {}),
                    topScoringNode: graphData.length > 0 
                        ? graphData.reduce((top, node) => 
                            (node.score || 0) > (top.score || 0) ? node : top
                          )
                        : null
                };
                
                setGraphStats(stats);
            } catch (err) {
                console.error('Failed to load graph stats:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadGraphStats();
    }, [isOpen]);

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
                    
                    {isLoading && (
                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: '#999',
                            fontSize: '14px'
                        }}>
                            Loading graph statistics...
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: '10px',
                            backgroundColor: 'rgba(244, 67, 54, 0.1)',
                            border: '1px solid #f44336',
                            borderRadius: '4px',
                            color: '#ff6666',
                            fontSize: '12px',
                            marginBottom: '15px'
                        }}>
                            Error loading stats: {error}
                        </div>
                    )}

                    {graphStats && (
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
                                    {graphStats.totalNodes}
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
                                    {graphStats.maxDepth}
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
                                    {graphStats.averageScore.toFixed(3)}
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
                                    {Object.keys(graphStats.nodesByDepth).length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#999' }}>Depth Levels</div>
                            </div>
                        </div>
                    )}

                    {graphStats?.topScoringNode && (
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
                                <strong>ID:</strong> {graphStats.topScoringNode.id} | 
                                <strong> Score:</strong> {graphStats.topScoringNode.score?.toFixed(3) || 'N/A'} | 
                                <strong> Depth:</strong> {graphStats.topScoringNode.depth || 0}
                            </div>
                            {graphStats.topScoringNode.prompt && (
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: '#aaa', 
                                    marginTop: '5px',
                                    fontStyle: 'italic',
                                    maxHeight: '40px',
                                    overflow: 'hidden'
                                }}>
                                    "{graphStats.topScoringNode.prompt.substring(0, 100)}..."
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