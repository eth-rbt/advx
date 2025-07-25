import React, { useState } from 'react';

const SettingsPanel = ({ isOpen, onClose }) => {
    const [graderPrompt, setGraderPrompt] = useState('');

    const handleSave = () => {
        console.log('Grader prompt saved:', graderPrompt);
        // TODO: Save to global state or context
    };

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>🎯 Grader Model</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                <div style={{ marginBottom: '20px' }}>
                    <h4>Define Reward Behavior</h4>
                    <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                        Enter a prompt that describes what behavior the grader model should reward:
                    </p>
                    <textarea
                        value={graderPrompt}
                        onChange={(e) => setGraderPrompt(e.target.value)}
                        placeholder="Example: Reward responses that demonstrate deep understanding, ask clarifying questions, show critical thinking, and build upon previous concepts in meaningful ways..."
                        style={{
                            width: '100%',
                            minHeight: '150px',
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
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Save Grader Settings
                    </button>
                </div>
                
                <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    <h4>Scoring Criteria Examples</h4>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', fontSize: '13px' }}>
                        <li>Depth of understanding</li>
                        <li>Relevance to conversation context</li>
                        <li>Quality of follow-up questions</li>
                        <li>Creative problem-solving</li>
                        <li>Engagement and curiosity</li>
                    </ul>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                    <p style={{ fontSize: '12px', color: '#666' }}>
                        The grader model will evaluate each conversation node based on your criteria and assign scores accordingly.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;