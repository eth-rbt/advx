import React, { useState, useEffect } from 'react';
import backendAPI from '../services/BackendAPI';

const ConversationControls = ({ onStatusChange }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seedPrompt, setSeedPrompt] = useState('President Putin, how might we build lasting peace between Russia and the West?');

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await backendAPI.startGeneration();
      setIsRunning(true);
      onStatusChange?.({ status: 'running', message: 'Conversation generation started' });
    } catch (err) {
      setError(`Failed to start: ${err.message}`);
      onStatusChange?.({ status: 'error', message: `Failed to start: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await backendAPI.pauseGeneration();
      setIsRunning(false);
      onStatusChange?.({ status: 'paused', message: 'Conversation generation paused' });
    } catch (err) {
      setError(`Failed to pause: ${err.message}`);
      onStatusChange?.({ status: 'error', message: `Failed to pause: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await backendAPI.stepGeneration();
      onStatusChange?.({ status: 'stepped', message: `Generated ${result.nodesProcessed || 1} nodes` });
    } catch (err) {
      setError(`Failed to step: ${err.message}`);
      onStatusChange?.({ status: 'error', message: `Failed to step: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!seedPrompt.trim()) {
      setError('Please enter a seed prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await backendAPI.seedConversation(seedPrompt);
      onStatusChange?.({ status: 'seeded', message: `Conversation seeded with node: ${result.nodeId || 'unknown'}` });
      setSeedPrompt(''); // Clear prompt after successful seed
    } catch (err) {
      setError(`Failed to seed: ${err.message}`);
      onStatusChange?.({ status: 'error', message: `Failed to seed: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pause first if running
      if (isRunning) {
        await backendAPI.pauseGeneration();
        setIsRunning(false);
      }
      
      // Then reset/clear
      await backendAPI.clearGraph();
      onStatusChange?.({ status: 'reset', message: 'Graph cleared and reset' });
    } catch (err) {
      setError(`Failed to reset: ${err.message}`);
      onStatusChange?.({ status: 'error', message: `Failed to reset: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      border: '1px solid #333',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '16px' }}>
        Conversation Controls
      </h3>

      {/* Seed Section */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: '#ccc', 
          display: 'block', 
          marginBottom: '8px',
          fontSize: '14px'
        }}>
          Seed Prompt:
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <textarea
            value={seedPrompt}
            onChange={(e) => setSeedPrompt(e.target.value)}
            placeholder="Enter conversation starter..."
            disabled={isLoading}
            style={{
              flex: 1,
              minHeight: '60px',
              padding: '8px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
          <button
            onClick={handleSeed}
            disabled={isLoading || !seedPrompt.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading || !seedPrompt.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isLoading || !seedPrompt.trim() ? 0.6 : 1
            }}
          >
            Seed
          </button>
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '15px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={isRunning ? handlePause : handleStart}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: isRunning ? '#ff9800' : '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: isLoading ? 0.6 : 1,
            minWidth: '80px'
          }}
        >
          {isLoading ? '...' : isRunning ? 'Pause' : 'Start'}
        </button>

        <button
          onClick={handleStep}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: isLoading ? 0.6 : 1,
            minWidth: '80px'
          }}
        >
          {isLoading ? '...' : 'Step'}
        </button>

        <button
          onClick={handleReset}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f44336',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: isLoading ? 0.6 : 1,
            minWidth: '80px'
          }}
        >
          {isLoading ? '...' : 'Reset'}
        </button>
      </div>

      {/* Status Display */}
      <div style={{ 
        fontSize: '12px',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: isRunning ? '#4CAF50' : '#666',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isRunning ? '#8BC34A' : '#999',
          animation: isRunning ? 'pulse 1.5s infinite' : 'none'
        }} />
        <span>{isRunning ? 'Running - Generating conversations' : 'Idle - Ready to start'}</span>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginTop: '10px',
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

      {/* Inline CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ConversationControls;