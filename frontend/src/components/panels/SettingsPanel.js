import React, { useState } from 'react';

const SettingsPanel = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState({
        physics: true,
        particles: true,
        autoCenter: false,
        nodeSize: 'medium',
        theme: 'dark'
    });

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <h3>⚙️ Settings</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-content">
                <div style={{ marginBottom: '20px' }}>
                    <h4>Graph Settings</h4>
                </div>
                
                <div className="setting-item" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            checked={settings.physics}
                            onChange={(e) => handleSettingChange('physics', e.target.checked)}
                        />
                        Enable Physics Simulation
                    </label>
                </div>

                <div className="setting-item" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            checked={settings.particles}
                            onChange={(e) => handleSettingChange('particles', e.target.checked)}
                        />
                        Show Link Particles
                    </label>
                </div>

                <div className="setting-item" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            checked={settings.autoCenter}
                            onChange={(e) => handleSettingChange('autoCenter', e.target.checked)}
                        />
                        Auto-center on changes
                    </label>
                </div>

                <div className="setting-item" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Node Size:</label>
                    <select 
                        value={settings.nodeSize}
                        onChange={(e) => handleSettingChange('nodeSize', e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '5px', 
                            background: 'rgba(255,255,255,0.1)', 
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: 'white',
                            borderRadius: '3px'
                        }}
                    >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                    </select>
                </div>

                <div style={{ marginTop: '20px' }}>
                    <h4>Keyboard Shortcuts</h4>
                    <div style={{ fontSize: '14px', marginTop: '10px' }}>
                        <div style={{ marginBottom: '5px' }}>
                            <strong>Space:</strong> Recenter view
                        </div>
                        <div style={{ marginBottom: '5px' }}>
                            <strong>Esc:</strong> Close panels
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;