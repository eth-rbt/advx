import React, { useState, useEffect, useRef, useMemo } from 'react';
import backendAPI from '../../services/BackendAPI';
import './PanelAnimations.css';

const ChatPanel = ({ isOpen, onClose, allNodes, systemStatus }) => {
    const [newNodeAnimation, setNewNodeAnimation] = useState(null);
    const conversationListRef = useRef(null);
    
    // Convert Map to array for processing (memoized to prevent infinite re-renders)
    const nodesArray = useMemo(() => {
        return allNodes ? Array.from(allNodes.values()) : [];
    }, [allNodes]);


    // Watch for new nodes and trigger animations
    useEffect(() => {
        if (isOpen && nodesArray.length > 0 && systemStatus?.lastUpdateTime) {
            const latestNode = nodesArray[nodesArray.length - 1];
            if (latestNode) {
                const timeDiff = new Date() - systemStatus.lastUpdateTime;
                // Only animate if node was added recently (within 5 seconds)
                if (timeDiff < 5000) {
                    setNewNodeAnimation(latestNode.id);
                    setTimeout(() => setNewNodeAnimation(null), 3000);
                }
            }
        }
    }, [allNodes?.size, isOpen, systemStatus?.lastUpdateTime]); // Use allNodes.size instead of nodesArray.length


    // Sort conversations by score
    const sortedConversations = nodesArray
        .filter(node => node.prompt || node.reply)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    // Auto-scroll to show new high-scoring conversations at the top
    useEffect(() => {
        if (conversationListRef.current && sortedConversations.length > 0) {
            // Scroll to top to show newly added high-scoring conversations
            conversationListRef.current.scrollTop = 0;
        }
    }, [sortedConversations.length]);


    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>💬 Top Scoring Chats</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                {/* Enhanced Connection Status and Live Updates Indicator */}
                <div style={{ 
                    marginBottom: '15px', 
                    padding: '10px 12px', 
                    backgroundColor: '#1b4d3e',
                    borderRadius: '6px',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div 
                            className={systemStatus?.connectionStatus === 'connecting' ? 'pulse-animation' : ''}
                            style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: systemStatus?.connectionStatus === 'connected' ? '#4CAF50' : 
                                               systemStatus?.connectionStatus === 'connecting' ? '#FF9800' : '#f44336'
                            }} 
                        />
                        <span style={{ fontWeight: 'bold' }}>
                            Live Conversation Rankings
                        </span>
                    </div>
                    
                    <div style={{ fontSize: '10px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                        <span>WebSocket: {systemStatus?.connectionStatus || 'disconnected'}</span>
                        {systemStatus?.lastUpdateTime && (
                            <span>Last update: {systemStatus.lastUpdateTime.toLocaleTimeString()}</span>
                        )}
                    </div>
                </div>


                <div style={{ marginBottom: '15px' }}>
                    <h4>🏆 Ranked Conversations</h4>
                    <p style={{ fontSize: '12px', color: '#666' }}>
                        AI conversation nodes ranked by trajectory score (higher = closer to peace)
                    </p>
                </div>
                
                <div ref={conversationListRef} className="conversation-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {/* Summary stats */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '15px',
                                padding: '10px',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                borderRadius: '5px',
                                fontSize: '12px'
                            }}>
                                <span>Total: {sortedConversations.length}</span>
                                {sortedConversations.length > 0 && (
                                    <>
                                        <span>Max Depth: {Math.max(...sortedConversations.map(n => n.depth || 0))}</span>
                                        <span>Avg Score: {(sortedConversations.reduce((sum, n) => sum + (n.score || 0), 0) / sortedConversations.length).toFixed(3)}</span>
                                    </>
                                )}
                            </div>
                            
                            {sortedConversations.length === 0 ? (
                                <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '20px' }}>
                                    No conversations yet. Start the worker to generate nodes!
                                </p>
                            ) : (
                                sortedConversations.map((node, index) => {
                                    const scoreDisplay = node.score?.toFixed(3) || '0.000';
                                    const scoreHue = (node.score || 0) * 120;
                                    
                                    // Rank indicators
                                    let rankIcon = '';
                                    if (index === 0) rankIcon = ' 🥇';
                                    else if (index === 1) rankIcon = ' 🥈';
                                    else if (index === 2) rankIcon = ' 🥉';
                                    else if (index < 10) rankIcon = ` #${index + 1}`;
                                    
                                    const isNewNode = newNodeAnimation === node.id;
                                    
                                    return (
                                        <div 
                                            key={node.id}
                                            className={`conversation-item ${isNewNode ? 'new-node-glow' : ''}`}
                                            style={{ 
                                                padding: '12px', 
                                                margin: '6px 0', 
                                                background: isNewNode 
                                                    ? 'rgba(76, 175, 80, 0.2)' 
                                                    : index < 3 
                                                        ? 'rgba(255,215,0,0.1)' 
                                                        : 'rgba(255,255,255,0.05)', 
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                border: isNewNode
                                                    ? '2px solid #4CAF50'
                                                    : index === 0 
                                                        ? '2px solid #ffd700' 
                                                        : index < 3 
                                                            ? '1px solid rgba(255,215,0,0.3)'
                                                            : '1px solid rgba(255,255,255,0.1)',
                                                transition: 'all 0.3s ease',
                                                boxShadow: isNewNode ? '0 0 20px rgba(76, 175, 80, 0.5)' : 'none'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isNewNode) {
                                                    e.target.style.background = 'rgba(255,255,255,0.15)';
                                                    e.target.style.transform = 'translateY(-1px)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isNewNode) {
                                                    e.target.style.background = index < 3 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)';
                                                    e.target.style.transform = 'translateY(0)';
                                                }
                                            }}
                                        >
                                            <div style={{ 
                                                fontWeight: 'bold', 
                                                marginBottom: '6px', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center' 
                                            }}>
                                                <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {`Depth ${node.depth || 0}${rankIcon}`}
                                                    {isNewNode && (
                                                        <span 
                                                            className="pulse-animation"
                                                            style={{ 
                                                                fontSize: '10px', 
                                                                color: '#4CAF50', 
                                                                background: 'rgba(76, 175, 80, 0.2)',
                                                                padding: '2px 6px',
                                                                borderRadius: '10px'
                                                            }}>
                                                            NEW!
                                                        </span>
                                                    )}
                                                </span>
                                                <span style={{ 
                                                    background: `hsl(${scoreHue}, 70%, 50%)`,
                                                    padding: '3px 10px',
                                                    borderRadius: '15px',
                                                    fontSize: '11px',
                                                    color: 'white',
                                                    fontWeight: 'bold',
                                                    minWidth: '45px',
                                                    textAlign: 'center',
                                                    boxShadow: isNewNode ? '0 0 10px rgba(76, 175, 80, 0.8)' : 'none'
                                                }}>
                                                    {scoreDisplay}
                                                </span>
                                            </div>
                                            
                                            {/* Show conversation preview */}
                                            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px', color: '#4CAF50' }}>
                                                <strong>💬 Human:</strong> {(node.prompt || 'No prompt').substring(0, 80)}{node.prompt?.length > 80 ? '...' : ''}
                                            </div>
                                            
                                            {node.reply && (
                                                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px', color: '#2196F3' }}>
                                                    <strong>🤖 Putin:</strong> {node.reply.substring(0, 80)}{node.reply.length > 80 ? '...' : ''}
                                                </div>
                                            )}
                                            
                                            {/* Metadata */}
                                            <div style={{ 
                                                fontSize: '10px', 
                                                opacity: 0.6, 
                                                marginTop: '6px',
                                                display: 'flex',
                                                justifyContent: 'space-between'
                                            }}>
                                                <span>{`Node ID: ${node.id.substring(0, 8)}...`}</span>
                                                {node.parent && (
                                                    <span>Parent: {node.parent.substring(0, 8)}...</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;