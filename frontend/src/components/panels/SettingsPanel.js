import React, { useState, useEffect } from 'react';
import backendAPI from '../../services/BackendAPI';

const SettingsPanel = ({ isOpen, onClose }) => {
    const [graderPrompt, setGraderPrompt] = useState('');
    const [settings, setSettings] = useState({
        lambda_trend: 0.3,
        lambda_sim: 0.2,
        lambda_depth: 0.05
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveMessage, setSaveMessage] = useState('');

    // Load settings when panel opens
    useEffect(() => {
        if (!isOpen) return;
        
        const loadSettings = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const backendSettings = await backendAPI.getSettings();
                
                // Ensure all values are numbers
                const sanitizedSettings = {};
                Object.entries(backendSettings).forEach(([key, value]) => {
                    const numericValue = parseFloat(value);
                    sanitizedSettings[key] = isNaN(numericValue) ? 0 : numericValue;
                });
                
                setSettings(sanitizedSettings);
            } catch (err) {
                console.error('Failed to load settings:', err);
                setError(`Failed to load settings: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [isOpen]);

    const handleSettingsChange = (key, value) => {
        const numericValue = parseFloat(value);
        const safeValue = isNaN(numericValue) ? 0 : numericValue;
        
        setSettings(prev => ({
            ...prev,
            [key]: safeValue
        }));
    };

    const handleSaveSettings = async () => {
        setIsLoading(true);
        setError(null);
        setSaveMessage('');
        
        try {
            await backendAPI.updateSettings(settings);
            setSaveMessage('Settings saved successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            setError(`Failed to save settings: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

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
                {/* Loading/Error States */}
                {isLoading && (
                    <div style={{
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '4px',
                        color: '#999',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        Loading settings...
                    </div>
                )}

                {error && (
                    <div style={{
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        border: '1px solid #f44336',
                        borderRadius: '4px',
                        color: '#ff6666',
                        fontSize: '12px'
                    }}>
                        {error}
                    </div>
                )}

                {saveMessage && (
                    <div style={{
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        border: '1px solid #4CAF50',
                        borderRadius: '4px',
                        color: '#4CAF50',
                        fontSize: '12px'
                    }}>
                        {saveMessage}
                    </div>
                )}

                {/* Backend Priority Lambda Settings */}
                <div style={{ marginBottom: '25px' }}>
                    <h4>Priority Calculation Parameters</h4>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                        Adjust how the system prioritizes nodes for processing. Formula: Score + λ_trend×ΔScore - λ_sim×Similarity - λ_depth×Depth
                    </p>
                    
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {Object.entries(settings).map(([key, value]) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ 
                                    fontSize: '13px', 
                                    color: '#ccc', 
                                    marginBottom: '5px',
                                    fontWeight: 'bold'
                                }}>
                                    {key.replace('lambda_', 'λ_').toUpperCase()}: {typeof value === 'number' ? value.toFixed(3) : '0.000'}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={typeof value === 'number' ? value : 0}
                                    onChange={(e) => handleSettingsChange(key, e.target.value)}
                                    disabled={isLoading}
                                    style={{
                                        width: '100%',
                                        marginBottom: '5px'
                                    }}
                                />
                                <div style={{ fontSize: '11px', color: '#888' }}>
                                    {key === 'lambda_trend' && 'Higher = Favor improving trends'}
                                    {key === 'lambda_sim' && 'Higher = Penalize similar conversations'}  
                                    {key === 'lambda_depth' && 'Higher = Penalize deeper conversations'}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={isLoading}
                        style={{
                            marginTop: '15px',
                            padding: '10px 20px',
                            backgroundColor: isLoading ? '#666' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            width: '100%'
                        }}
                    >
                        {isLoading ? 'Saving...' : 'Save Priority Settings'}
                    </button>
                </div>

                {/* Grader Model Settings */}
                <div style={{ marginBottom: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
                    <h4>Define Reward Behavior</h4>
                    <p style={{ fontSize: '14px', marginBottom: '10px', color: '#ccc' }}>
                        Enter a prompt that describes what behavior the grader model should reward:
                    </p>
                    <textarea
                        value={graderPrompt}
                        onChange={(e) => setGraderPrompt(e.target.value)}
                        placeholder="Example: Reward responses that demonstrate deep understanding, ask clarifying questions, show critical thinking, and build upon previous concepts in meaningful ways..."
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