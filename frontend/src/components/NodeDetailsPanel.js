import React, { useState, useEffect } from 'react';
import backendAPI from '../services/BackendAPI';

const NodeDetailsPanel = ({ isOpen, selectedNode, onClose }) => {
    const [fullConversation, setFullConversation] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load full conversation when selectedNode changes
    useEffect(() => {
        if (!selectedNode || !selectedNode.id) {
            setFullConversation(null);
            return;
        }

        const loadConversation = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Try to load backend conversation first
                const conversationData = await backendAPI.getConversation(selectedNode.id);
                if (conversationData && !conversationData.error) {
                    setFullConversation(conversationData);
                } else {
                    // Fallback to existing node data
                    setFullConversation(null);
                }
            } catch (err) {
                console.error('Failed to load conversation:', err);
                setError(err.message);
                setFullConversation(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadConversation();
    }, [selectedNode]);

    if (!selectedNode) return null;

    const renderConversation = () => {
        if (isLoading) {
            return (
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#999'
                }}>
                    Loading conversation...
                </div>
            );
        }

        if (error) {
            return (
                <div style={{
                    padding: '10px',
                    background: 'rgba(255, 0, 0, 0.1)',
                    borderRadius: '5px',
                    color: '#ff6666',
                    fontSize: '14px'
                }}>
                    Error loading conversation: {error}
                </div>
            );
        }

        if (fullConversation && fullConversation.conversation) {
            return (
                <div>
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#999' }}>
                        <strong>Conversation Path ({fullConversation.nodes_in_path} nodes, depth {fullConversation.depth})</strong>
                    </div>
                    <div style={{
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid #333',
                        borderRadius: '5px',
                        padding: '10px'
                    }}>
                        {fullConversation.conversation.map((turn, index) => (
                            <div key={index} style={{
                                marginBottom: '15px',
                                paddingBottom: '10px',
                                borderBottom: index < fullConversation.conversation.length - 1 ? '1px solid #333' : 'none'
                            }}>
                                <div style={{
                                    fontWeight: 'bold',
                                    color: turn.role === 'user' ? '#4CAF50' : '#2196F3',
                                    marginBottom: '5px',
                                    fontSize: '14px'
                                }}>
                                    {turn.role === 'user' ? '🧑 Human:' : '🤖 Putin:'}
                                </div>
                                <div style={{
                                    lineHeight: '1.5',
                                    fontSize: '14px',
                                    paddingLeft: '20px'
                                }}>
                                    {turn.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Fallback to basic node data
        if (selectedNode.convo) {
            return (
                <div>
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
            );
        }

        return (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
                No conversation data available
            </div>
        );
    };

    return (
        <div className={`node-details-panel ${isOpen ? 'open' : ''}`}>
            <button className="close-btn" onClick={onClose}>
                ×
            </button>
            <h3>Node Details</h3>
            <div style={{ marginTop: '15px' }}>
                <p><strong>ID:</strong> {selectedNode.id}</p>
                {selectedNode.depth !== undefined && (
                    <p><strong>Depth:</strong> {selectedNode.depth}</p>
                )}
                {selectedNode.turns !== undefined && (
                    <p><strong>Turns:</strong> {selectedNode.turns}</p>
                )}
                {selectedNode.prompt && (
                    <p><strong>Prompt:</strong> {selectedNode.prompt}</p>
                )}
                {selectedNode.reply && (
                    <p><strong>Reply:</strong> {selectedNode.reply}</p>
                )}
                <p><strong>Score:</strong> {
                    selectedNode.score !== undefined 
                        ? (typeof selectedNode.score === 'number' 
                            ? selectedNode.score.toFixed(3) 
                            : selectedNode.score)
                        : 'N/A'
                }</p>
                {selectedNode.parent && (
                    <p><strong>Parent:</strong> {selectedNode.parent}</p>
                )}
                
                <div style={{ marginTop: '20px' }}>
                    {renderConversation()}
                </div>
            </div>
        </div>
    );
};

export default NodeDetailsPanel;