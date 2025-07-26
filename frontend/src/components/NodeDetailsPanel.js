import React, { useState, useEffect } from 'react';
import backendAPI from '../services/BackendAPI';
import { getConversationPath } from '../utils/dataTransforms';

const NodeDetailsPanel = ({ isOpen, selectedNode, tree, allNodes, onClose }) => {
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
                // First try to build conversation from centralized tree data
                if (tree && allNodes) {
                    const conversationPath = getConversationPath(tree, selectedNode.id);
                    if (conversationPath.length > 0) {
                        const conversation = [];
                        conversationPath.forEach((node, index) => {
                            if (node.prompt) {
                                conversation.push({ role: 'user', content: node.prompt });
                            }
                            if (node.reply) {
                                conversation.push({ role: 'assistant', content: node.reply });
                            }
                        });
                        
                        setFullConversation({
                            conversation,
                            nodes_in_path: conversationPath.length,
                            depth: conversationPath[conversationPath.length - 1]?.depth || 0
                        });
                        setIsLoading(false);
                        return;
                    }
                }
                
                // Fallback to backend API
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
    }, [selectedNode, tree, allNodes]);

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

        if (fullConversation && fullConversation.conversation && fullConversation.conversation.length > 0) {
            return (
                <div>
                    <div style={{ marginBottom: '15px', fontSize: '14px', color: '#999' }}>
                        <strong>Full Conversation Thread ({fullConversation.nodes_in_path} nodes, depth {fullConversation.depth})</strong>
                    </div>
                    <div style={{
                        border: '1px solid #333',
                        borderRadius: '5px',
                        padding: '15px',
                        backgroundColor: 'rgba(0,0,0,0.3)'
                    }}>
                        {fullConversation.conversation.map((turn, index) => (
                            <div key={index} style={{
                                marginBottom: '20px',
                                paddingBottom: '15px',
                                borderBottom: index < fullConversation.conversation.length - 1 ? '1px solid #444' : 'none'
                            }}>
                                <div style={{
                                    fontWeight: 'bold',
                                    color: turn.role === 'user' ? '#4CAF50' : '#2196F3',
                                    marginBottom: '8px',
                                    fontSize: '15px'
                                }}>
                                    {turn.role === 'user' ? '🧑 Human:' : '🤖 Putin:'}
                                </div>
                                <div style={{
                                    lineHeight: '1.6',
                                    fontSize: '14px',
                                    paddingLeft: '25px',
                                    color: '#eee'
                                }}>
                                    {turn.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Fallback to show current node's prompt and reply
        if (selectedNode.prompt || selectedNode.reply) {
            return (
                <div>
                    <div style={{ marginBottom: '15px', fontSize: '14px', color: '#999' }}>
                        <strong>Node Conversation (Depth {selectedNode.depth || 0})</strong>
                    </div>
                    <div style={{
                        border: '1px solid #333',
                        borderRadius: '5px',
                        padding: '15px',
                        backgroundColor: 'rgba(0,0,0,0.3)'
                    }}>
                        {selectedNode.prompt && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    fontWeight: 'bold',
                                    color: '#4CAF50',
                                    marginBottom: '8px',
                                    fontSize: '15px'
                                }}>
                                    🧑 Human:
                                </div>
                                <div style={{
                                    lineHeight: '1.6',
                                    fontSize: '14px',
                                    paddingLeft: '25px',
                                    color: '#eee'
                                }}>
                                    {selectedNode.prompt}
                                </div>
                            </div>
                        )}
                        
                        {selectedNode.reply && (
                            <div>
                                <div style={{
                                    fontWeight: 'bold',
                                    color: '#2196F3',
                                    marginBottom: '8px',
                                    fontSize: '15px'
                                }}>
                                    🤖 Putin:
                                </div>
                                <div style={{
                                    lineHeight: '1.6',
                                    fontSize: '14px',
                                    paddingLeft: '25px',
                                    color: '#eee'
                                }}>
                                    {selectedNode.reply}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        
        // Last fallback for old format data
        if (selectedNode.convo) {
            return (
                <div>
                    <div style={{ marginBottom: '15px', fontSize: '14px', color: '#999' }}>
                        <strong>Conversation Content</strong>
                    </div>
                    <div style={{ 
                        padding: '15px', 
                        background: 'rgba(0,0,0,0.3)', 
                        borderRadius: '5px',
                        lineHeight: '1.6',
                        color: '#eee'
                    }}>
                        {selectedNode.convo}
                    </div>
                </div>
            );
        }

        return (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
                No conversation data available for this node
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
                {selectedNode.grader_reasoning && (
                    <div style={{ marginTop: '15px' }}>
                        <p><strong>Grader Analysis:</strong></p>
                        <div style={{
                            padding: '12px',
                            backgroundColor: 'rgba(255, 215, 0, 0.1)',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            borderRadius: '5px',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            color: '#f0f0f0',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {selectedNode.grader_reasoning}
                        </div>
                    </div>
                )}
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