import React, { useState, useEffect, useCallback, useRef } from 'react';
import backendAPI from '../../services/BackendAPI';
import './PanelAnimations.css';

const ChatPanel = ({ isOpen, onClose, nodes = {}, dynamicNodes = {}, allNodes = [], connectionStatus = 'disconnected', lastUpdateTime = null }) => {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversationDetails, setConversationDetails] = useState({});
    const [newNodeAnimation, setNewNodeAnimation] = useState(null);
    const conversationListRef = useRef(null);
    
    // Determine if we should use backend data
    const useBackendData = allNodes.length > 0;

    // Clear selection when panel closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedConversation(null);
        }
    }, [isOpen]);

    // Watch for new nodes and trigger animations
    useEffect(() => {
        if (isOpen && allNodes.length > 0) {
            const latestNode = allNodes[allNodes.length - 1];
            if (latestNode && lastUpdateTime) {
                const timeDiff = new Date() - lastUpdateTime;
                // Only animate if node was added recently (within 5 seconds)
                if (timeDiff < 5000) {
                    setNewNodeAnimation(latestNode.id);
                    setTimeout(() => setNewNodeAnimation(null), 3000);
                }
            }
        }
    }, [allNodes.length, isOpen, lastUpdateTime]);

    // Clear cached conversation details when nodes update
    useEffect(() => {
        // Clear any cached details that might be stale
        setConversationDetails({});
    }, [allNodes]);

    // Combine all nodes and sort by score
    const allNodesData = useBackendData ? { nodes: allNodes } : { ...nodes, ...dynamicNodes };
    const sortedConversations = useBackendData 
        ? allNodes
            .filter(node => node.prompt || node.reply)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
        : Object.values(allNodesData)
            .filter(node => node.convo)
            .sort((a, b) => (b.score || 0) - (a.score || 0));

    // Auto-scroll to show new high-scoring conversations at the top
    useEffect(() => {
        if (conversationListRef.current && sortedConversations.length > 0 && !selectedConversation) {
            // Scroll to top to show newly added high-scoring conversations
            conversationListRef.current.scrollTop = 0;
        }
    }, [sortedConversations.length, selectedConversation]);

    // Load full conversation when node is selected
    const handleConversationSelect = async (node) => {
        setSelectedConversation(node);
        
        if (useBackendData && !conversationDetails[node.id]) {
            try {
                const fullConversation = await backendAPI.getConversation(node.id);
                setConversationDetails(prev => ({
                    ...prev,
                    [node.id]: fullConversation
                }));
            } catch (err) {
                console.error('Failed to load conversation details:', err);
            }
        }
    };

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
                    backgroundColor: useBackendData ? '#1b4d3e' : '#4a4a4a',
                    borderRadius: '6px',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div 
                            className={connectionStatus === 'connecting' ? 'pulse-animation' : ''}
                            style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : 
                                               connectionStatus === 'connecting' ? '#FF9800' : '#f44336'
                            }} 
                        />
                        <span style={{ fontWeight: 'bold' }}>
                            {useBackendData ? 'Live Conversation Rankings' : 'Example Conversations'}
                        </span>
                    </div>
                    
                    {useBackendData && (
                        <div style={{ fontSize: '10px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                            <span>WebSocket: {connectionStatus}</span>
                            {lastUpdateTime && (
                                <span>Last update: {lastUpdateTime.toLocaleTimeString()}</span>
                            )}
                        </div>
                    )}
                </div>


                {!selectedConversation ? (
                    <>
                        <div style={{ marginBottom: '15px' }}>
                            <h4>🏆 Ranked Conversations</h4>
                            <p style={{ fontSize: '12px', color: '#666' }}>
                                {useBackendData 
                                    ? 'AI conversation nodes ranked by trajectory score (higher = closer to peace)' 
                                    : 'Example conversations ordered from highest to lowest score'
                                }
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
                                {useBackendData && sortedConversations.length > 0 && (
                                    <>
                                        <span>Max Depth: {Math.max(...sortedConversations.map(n => n.depth || 0))}</span>
                                        <span>Avg Score: {(sortedConversations.reduce((sum, n) => sum + (n.score || 0), 0) / sortedConversations.length).toFixed(3)}</span>
                                    </>
                                )}
                            </div>
                            
                            {sortedConversations.length === 0 ? (
                                <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '20px' }}>
                                    No conversations yet. {useBackendData ? 'Start the worker to generate nodes!' : 'Generate some nodes to see them here!'}
                                </p>
                            ) : (
                                sortedConversations.map((node, index) => {
                                    const scoreDisplay = useBackendData 
                                        ? (node.score?.toFixed(3) || '0.000')
                                        : (node.score || 0);
                                    const scoreHue = useBackendData 
                                        ? (node.score || 0) * 120 
                                        : (node.score / 100) * 120;
                                    
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
                                            onClick={() => handleConversationSelect(node)}
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
                                                    {useBackendData 
                                                        ? `Depth ${node.depth || 0}${rankIcon}` 
                                                        : `Node ${node.id}${rankIcon}`}
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
                                            
                                            {useBackendData && node.reply && (
                                                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px', color: '#2196F3' }}>
                                                    <strong>🤖 Putin:</strong> {node.reply.substring(0, 80)}{node.reply.length > 80 ? '...' : ''}
                                                </div>
                                            )}
                                            
                                            {!useBackendData && node.convo && (
                                                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                                    {node.convo.substring(0, 100)}{node.convo.length > 100 ? '...' : ''}
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
                                                <span>{useBackendData ? `Node ID: ${node.id.substring(0, 8)}...` : `ID: ${node.id}`}</span>
                                                {useBackendData && node.parent && (
                                                    <span>Parent: {node.parent.substring(0, 8)}...</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
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
                                <h4>
                                    {useBackendData 
                                        ? `Depth ${selectedConversation.depth || 0} (${selectedConversation.id})`
                                        : `Node ${selectedConversation.id}`}
                                </h4>
                                <span style={{ 
                                    background: `hsl(${useBackendData 
                                        ? (selectedConversation.score || 0) * 120 
                                        : (selectedConversation.score / 100) * 120}, 70%, 50%)`,
                                    padding: '4px 12px',
                                    borderRadius: '15px',
                                    fontSize: '14px',
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}>
                                    Score: {useBackendData 
                                        ? (selectedConversation.score?.toFixed(3) || '0.000')
                                        : (selectedConversation.score || 0)}
                                </span>
                            </div>
                            {selectedConversation.prompt && (
                                <p style={{ fontSize: '14px', color: '#999', marginBottom: '15px' }}>
                                    <strong>Prompt:</strong> {selectedConversation.prompt}
                                </p>
                            )}
                        </div>

                        {/* Full Conversation Display for Backend Data */}
                        {useBackendData && conversationDetails[selectedConversation.id] ? (
                            <div style={{ 
                                background: 'rgba(0,0,0,0.3)',
                                padding: '15px',
                                borderRadius: '8px',
                                marginBottom: '15px'
                            }}>
                                <h5 style={{ marginBottom: '15px' }}>
                                    Full Conversation Thread ({conversationDetails[selectedConversation.id].nodes_in_path} nodes, depth {conversationDetails[selectedConversation.id].depth})
                                </h5>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {conversationDetails[selectedConversation.id].conversation.map((turn, index) => (
                                        <div key={index} style={{
                                            marginBottom: '15px',
                                            paddingBottom: '10px',
                                            borderBottom: index < conversationDetails[selectedConversation.id].conversation.length - 1 ? '1px solid #444' : 'none'
                                        }}>
                                            <div style={{
                                                fontWeight: 'bold',
                                                color: turn.role === 'user' ? '#4CAF50' : '#2196F3',
                                                marginBottom: '5px',
                                                fontSize: '13px'
                                            }}>
                                                {turn.role === 'user' ? '🧑 Human:' : '🤖 Putin:'}
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                lineHeight: '1.5',
                                                paddingLeft: '15px'
                                            }}>
                                                {turn.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ 
                                background: 'rgba(0,0,0,0.3)',
                                padding: '15px',
                                borderRadius: '8px',
                                marginBottom: '15px'
                            }}>
                                <h5 style={{ marginBottom: '10px' }}>Conversation Content</h5>
                                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                    {useBackendData 
                                        ? (selectedConversation.reply || 'Loading full conversation...')
                                        : (selectedConversation.convo || 'No conversation content')}
                                </div>
                            </div>
                        )}

                        <div style={{ 
                            background: 'rgba(255,255,255,0.05)',
                            padding: '10px',
                            borderRadius: '5px',
                            fontSize: '12px'
                        }}>
                            {useBackendData ? (
                                <>
                                    <div style={{ marginBottom: '5px' }}>
                                        <strong>Depth:</strong> {selectedConversation.depth || 0}
                                    </div>
                                    <div style={{ marginBottom: '5px' }}>
                                        <strong>Parent:</strong> {selectedConversation.parent || 'Root'}
                                    </div>
                                    <div>
                                        <strong>Node ID:</strong> {selectedConversation.id}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ marginBottom: '5px' }}>
                                        <strong>Turns:</strong> {selectedConversation.turns || 0}
                                    </div>
                                    <div>
                                        <strong>Node ID:</strong> {selectedConversation.id}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;