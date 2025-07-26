/**
 * Phase 2 Test 1: Control System Integration Test
 * Tests ConversationControls component and backend control endpoints
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversationControls from '../../components/ConversationControls';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

describe('Control System Integration Test', () => {
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful control endpoint responses
    backendAPI.startGeneration.mockResolvedValue({ status: 'started', message: 'Generation started' });
    backendAPI.pauseGeneration.mockResolvedValue({ status: 'paused', message: 'Generation paused' });
    backendAPI.stepGeneration.mockResolvedValue({ status: 'stepped', nodesProcessed: 3 });
    backendAPI.seedConversation.mockResolvedValue({ status: 'seeded', nodeId: 'node-1' });
    backendAPI.clearGraph.mockResolvedValue({ status: 'cleared', message: 'Graph cleared' });
  });

  test('start button initiates conversation generation', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(backendAPI.startGeneration).toHaveBeenCalled();
      expect(mockOnStatusChange).toHaveBeenCalledWith({
        status: 'running',
        message: 'Conversation generation started'
      });
    });

    // Button should change to "Pause" after starting
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  test('pause button stops conversation generation', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    // First start, then pause
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(backendAPI.pauseGeneration).toHaveBeenCalled();
      expect(mockOnStatusChange).toHaveBeenCalledWith({
        status: 'paused',
        message: 'Conversation generation paused'
      });
    });

    // Button should change back to "Start" after pausing
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  test('step button generates single conversation step', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const stepButton = screen.getByText('Step');
    fireEvent.click(stepButton);

    await waitFor(() => {
      expect(backendAPI.stepGeneration).toHaveBeenCalled();
      expect(mockOnStatusChange).toHaveBeenCalledWith({
        status: 'stepped',
        message: 'Generated 3 nodes'
      });
    });
  });

  test('seed button creates new conversation with prompt', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const seedInput = screen.getByPlaceholderText('Enter conversation starter...');
    const seedButton = screen.getByText('Seed');

    // Enter seed prompt
    fireEvent.change(seedInput, { 
      target: { value: 'How can we achieve world peace?' } 
    });

    fireEvent.click(seedButton);

    await waitFor(() => {
      expect(backendAPI.seedConversation).toHaveBeenCalledWith('How can we achieve world peace?');
      expect(mockOnStatusChange).toHaveBeenCalledWith({
        status: 'seeded',
        message: 'Conversation seeded with node: node-1'
      });
    });

    // Input should be cleared after successful seed
    expect(seedInput.value).toBe('');
  });

  test('reset button clears graph and stops generation', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    // First start generation
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    // Then reset
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(backendAPI.pauseGeneration).toHaveBeenCalled();
      expect(backendAPI.clearGraph).toHaveBeenCalled();
      expect(mockOnStatusChange).toHaveBeenCalledWith({
        status: 'reset',
        message: 'Graph cleared and reset'
      });
    });

    // Button should return to "Start" state
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  test('displays running status indicator correctly', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    // Initially idle
    expect(screen.getByText('Idle - Ready to start')).toBeInTheDocument();

    // Start generation
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Running - Generating conversations')).toBeInTheDocument();
    });
  });

  test('handles control endpoint errors gracefully', async () => {
    backendAPI.startGeneration.mockRejectedValue(new Error('Connection failed'));

    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to start: Connection failed')).toBeInTheDocument();
      expect(mockOnStatusChange).toHaveBeenCalledWith({
        status: 'error',
        message: 'Failed to start: Connection failed'
      });
    });
  });

  test('seed button is disabled when prompt is empty', () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const seedInput = screen.getByPlaceholderText('Enter conversation starter...');
    const seedButton = screen.getByText('Seed');

    // Clear the default prompt
    fireEvent.change(seedInput, { target: { value: '' } });

    expect(seedButton).toBeDisabled();
  });

  test('all buttons are disabled during loading states', async () => {
    // Mock a slow API call
    backendAPI.startGeneration.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const startButton = screen.getByText('Start');
    const stepButton = screen.getByText('Step');
    const resetButton = screen.getByText('Reset');

    fireEvent.click(startButton);

    // During loading, buttons should be disabled
    expect(stepButton).toBeDisabled();
    expect(resetButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });
  });

  test('seed input accepts multi-line prompts', () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const seedInput = screen.getByPlaceholderText('Enter conversation starter...');
    
    const multiLinePrompt = `President Putin,
I'd like to discuss possibilities for
lasting peace in our time.`;

    fireEvent.change(seedInput, { target: { value: multiLinePrompt } });

    expect(seedInput.value).toBe(multiLinePrompt);
  });

  test('seed button disabled state matches validation logic', async () => {
    render(<ConversationControls onStatusChange={mockOnStatusChange} />);

    const seedInput = screen.getByPlaceholderText('Enter conversation starter...');
    const seedButton = screen.getByText('Seed');
    
    // Clear the default prompt to empty
    fireEvent.change(seedInput, { target: { value: '' } });
    expect(seedButton).toBeDisabled();

    // Whitespace-only prompt should also disable button
    fireEvent.change(seedInput, { target: { value: '   \n  \t  ' } });
    expect(seedButton).toBeDisabled();
    
    // Valid content should enable button
    fireEvent.change(seedInput, { target: { value: 'Valid prompt' } });
    expect(seedButton).not.toBeDisabled();
    
    // Should not call API when button is disabled
    fireEvent.change(seedInput, { target: { value: '' } });
    expect(seedButton).toBeDisabled();
    
    // Clicking disabled button should not trigger API call
    fireEvent.click(seedButton);
    expect(backendAPI.seedConversation).not.toHaveBeenCalled();
  });
});