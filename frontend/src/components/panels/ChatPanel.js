import React, { useState } from 'react';

const ChatPanel = ({ isOpen, onClose, nodes = {}, dynamicNodes = {} }) => {
    const [selectedConversation, setSelectedConversation] = useState(null);
    
    // Combine all nodes and sort by score
    const allNodes = { ...nodes, ...dynamicNodes };
    const sortedConversations = Object.values(allNodes)
        .filter(node => node.convo)
        .sort((a, b) => (b.score || 0) - (a.score || 0));


    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>💬 Top Scoring Chats</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                {!selectedConversation ? (
                    <>
                        <div style={{ marginBottom: '15px' }}>
                            <h4>Conversations by Score</h4>
                            <p style={{ fontSize: '12px', color: '#666' }}>
                                Ordered from highest to lowest score
                            </p>
                        </div>
                        
                        <div className="conversation-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {sortedConversations.length === 0 ? (
                                <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '20px' }}>
                                    No conversations yet. Generate some nodes to see them here!
                                </p>
                            ) : (
                                sortedConversations.map((node, index) => (
                                <div 
                                    key={node.id}
                                    className="conversation-item"
                                    style={{ 
                                        padding: '10px', 
                                        margin: '8px 0', 
                                        background: 'rgba(255,255,255,0.1)', 
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        border: index === 0 ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.2)'
                                    }}
                                    onClick={() => setSelectedConversation(node)}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Node {node.id} {index === 0 && '👑'}</span>
                                        <span style={{ 
                                            background: `hsl(${(node.score / 100) * 120}, 70%, 50%)`,
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: 'white'
                                        }}>
                                            {node.score || 0}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                        {node.prompt}
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                                        {node.convo && node.convo.substring(0, 100)}...
                                    </div>
                                </div>
                            ))
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <button 
                            onClick={() => setSelectedConversation(null)}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'white', 
                                cursor: 'pointer',
                                marginBottom: '15px',
                                fontSize: '14px'
                            }}
                        >
                            ← Back to list
                        </button>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4>Node {selectedConversation.id}</h4>
                                <span style={{ 
                                    background: `hsl(${(selectedConversation.score / 100) * 120}, 70%, 50%)`,
                                    padding: '4px 12px',
                                    borderRadius: '15px',
                                    fontSize: '14px',
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}>
                                    Score: {selectedConversation.score || 0}
                                </span>
                            </div>
                            <p style={{ fontSize: '14px', color: '#999', marginBottom: '15px' }}>
                                <strong>Prompt:</strong> {selectedConversation.prompt}
                            </p>
                        </div>

                        <div style={{ 
                            background: 'rgba(0,0,0,0.3)',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '15px'
                        }}>
                            <h5 style={{ marginBottom: '10px' }}>Conversation Content</h5>
                            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                {selectedConversation.convo}
                            </div>
                        </div>

                        <div style={{ 
                            background: 'rgba(255,255,255,0.05)',
                            padding: '10px',
                            borderRadius: '5px',
                            fontSize: '12px'
                        }}>
                            <div style={{ marginBottom: '5px' }}>
                                <strong>Turns:</strong> {selectedConversation.turns || 0}
                            </div>
                            <div>
                                <strong>Node ID:</strong> {selectedConversation.id}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;