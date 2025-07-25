import React, { useState } from 'react';
import { exampleData } from '../../data/exampleData';

const ChatPanel = ({ isOpen, onClose }) => {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [newMessage, setNewMessage] = useState('');

    const conversations = Object.values(exampleData.nodes).filter(node => node.convo);

    const handleSendMessage = () => {
        if (newMessage.trim()) {
            // In a real app, this would send the message
            console.log('Sending message:', newMessage);
            setNewMessage('');
        }
    };

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>💬 Active Chats</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                {!selectedConversation ? (
                    <>
                        <div style={{ marginBottom: '15px' }}>
                            <h4>Recent Conversations</h4>
                        </div>
                        
                        <div className="conversation-list">
                            {conversations.map(node => (
                                <div 
                                    key={node.id}
                                    className="conversation-item"
                                    style={{ 
                                        padding: '10px', 
                                        margin: '8px 0', 
                                        background: 'rgba(255,255,255,0.1)', 
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        border: exampleData.board.priorityQueue.includes(node.id) ? '1px solid #ffd700' : '1px solid transparent'
                                    }}
                                    onClick={() => setSelectedConversation(node)}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                        Node {node.id} {exampleData.board.priorityQueue.includes(node.id) && '⭐'}
                                    </div>
                                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                        {node.prompt}
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                                        Turns: {node.turns} | Score: {node.score}
                                    </div>
                                </div>
                            ))}
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
                                marginBottom: '15px'
                            }}
                        >
                            ← Back to conversations
                        </button>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <h4>Node {selectedConversation.id}</h4>
                            <p style={{ fontSize: '12px', opacity: 0.8 }}>
                                {selectedConversation.prompt}
                            </p>
                        </div>

                        <div className="chat-messages" style={{ 
                            height: '200px', 
                            overflowY: 'auto',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '10px',
                            borderRadius: '5px',
                            marginBottom: '10px'
                        }}>
                            <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                                <strong>System:</strong> {selectedConversation.convo}
                            </div>
                        </div>

                        <div className="message-input" style={{ display: 'flex', gap: '5px' }}>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '3px',
                                    color: 'white'
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button
                                onClick={handleSendMessage}
                                style={{
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.2)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '3px',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                Send
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;