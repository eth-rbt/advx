import React, { useState } from 'react';

const HomePanel = ({ isOpen, onClose }) => {
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
                <div style={{ marginBottom: '20px' }}>
                    <h4>Define Your User</h4>
                    <p style={{ fontSize: '14px', marginBottom: '10px' }}>
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
                            border: '1px solid #ddd',
                            fontSize: '14px',
                            resize: 'vertical'
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
                <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    <strong>Quick Tips:</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '13px' }}>
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