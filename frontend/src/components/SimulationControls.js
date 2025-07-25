import React, { useState } from 'react';

const SimulationControls = ({ isShifted, onGenerateNode }) => {
    const [isPlaying, setIsPlaying] = useState(true);

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
        // In the future, this could control the physics simulation
    };

    const handleStep = () => {
        if (onGenerateNode) {
            onGenerateNode();
        }
    };

    return (
        <div className={`simulation-controls ${isShifted ? 'shifted' : ''}`}>
            <button 
                className="control-btn"
                onClick={handlePlayPause}
                title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            >
                {isPlaying ? (
                    // Pause icon
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="3" y="2" width="3" height="12" rx="1"/>
                        <rect x="10" y="2" width="3" height="12" rx="1"/>
                    </svg>
                ) : (
                    // Play icon
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2v12l8-6L4 2z"/>
                    </svg>
                )}
            </button>
            
            <button 
                className="control-btn"
                onClick={handleStep}
                title="Step Simulation"
                disabled={isPlaying}
            >
                {/* Step/Next icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 2v12l6-6L3 2z"/>
                    <rect x="11" y="2" width="2" height="12" rx="1"/>
                </svg>
            </button>
        </div>
    );
};

export default SimulationControls;