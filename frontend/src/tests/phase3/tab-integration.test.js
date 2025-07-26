/**
 * Phase 3 Test 1: Tab Integration Test
 * Tests LeftSidebar tab navigation and panel integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeftSidebar from '../../components/LeftSidebar';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

// Mock canvas getContext to prevent canvas errors
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillStyle: '',
  fillRect: jest.fn(),
  strokeStyle: '',
  lineWidth: 0,
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  font: '',
  textAlign: '',
  fillText: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn()
}));

// Mock getBoundingClientRect for canvas
HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 300,
  height: 300,
  top: 0,
  left: 0,
  right: 300,
  bottom: 300
}));

describe('Tab Integration Test', () => {
  const mockProps = {
    activePanel: null,
    onPanelChange: jest.fn(),
    nodes: {
      'ex-1': { id: 'ex-1', score: 85, convo: 'Example conversation', prompt: 'Example prompt' }
    },
    dynamicNodes: {}
  };

  const mockBackendData = [
    {
      id: 'node-1',
      xy: [0.1, 0.2],
      score: 0.8,
      parent: null,
      depth: 0,
      prompt: 'Test prompt',
      reply: 'Test reply'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    backendAPI.getGraph.mockResolvedValue(mockBackendData);
    backendAPI.getSettings.mockResolvedValue({
      lambda_trend: 0.3,
      lambda_sim: 0.2,
      lambda_depth: 0.05
    });
    backendAPI.getConversation.mockResolvedValue({
      conversation: [
        { role: 'user', content: 'Test message' },
        { role: 'assistant', content: 'Test response' }
      ],
      nodes_in_path: 1,
      depth: 0
    });
  });

  test('renders all sidebar icons correctly', () => {
    render(<LeftSidebar {...mockProps} />);

    // Should show all four sidebar icons
    expect(screen.getByTitle('User Profile')).toBeInTheDocument();
    expect(screen.getByTitle('Grader Model')).toBeInTheDocument();
    expect(screen.getByTitle('Embeddings')).toBeInTheDocument();
    expect(screen.getByTitle('Top Chats')).toBeInTheDocument();
  });

  test('clicking icons triggers panel change callback', () => {
    render(<LeftSidebar {...mockProps} />);

    const homeIcon = screen.getByTitle('User Profile');
    fireEvent.click(homeIcon);

    expect(mockProps.onPanelChange).toHaveBeenCalledWith('home');
  });

  test('active panel shows correct styling', () => {
    const activeProps = { ...mockProps, activePanel: 'analytics' };
    render(<LeftSidebar {...activeProps} />);

    const analyticsIcon = screen.getByTitle('Embeddings');
    expect(analyticsIcon).toHaveClass('active');
  });

  test('clicking active panel icon closes the panel', () => {
    const activeProps = { ...mockProps, activePanel: 'settings' };
    render(<LeftSidebar {...activeProps} />);

    const settingsIcon = screen.getByTitle('Grader Model');
    fireEvent.click(settingsIcon);

    expect(mockProps.onPanelChange).toHaveBeenCalledWith(null);
  });

  test('home panel opens and loads backend statistics', async () => {
    const homeProps = { ...mockProps, activePanel: 'home' };
    render(<LeftSidebar {...homeProps} />);

    // Should show home panel
    expect(screen.getByText('👤 User Profile')).toBeInTheDocument();

    // Wait for backend data to load
    await waitFor(() => {
      expect(backendAPI.getGraph).toHaveBeenCalled();
    });
  });

  test('analytics panel opens and shows backend data indicator', async () => {
    const analyticsProps = { ...mockProps, activePanel: 'analytics' };
    render(<LeftSidebar {...analyticsProps} />);

    // Should show analytics panel
    expect(screen.getByText('📊 Embedding Visualization')).toBeInTheDocument();

    // Wait for backend data loading
    await waitFor(() => {
      expect(backendAPI.getGraph).toHaveBeenCalled();
    });
  });

  test('settings panel opens and loads backend settings', async () => {
    const settingsProps = { ...mockProps, activePanel: 'settings' };
    render(<LeftSidebar {...settingsProps} />);

    // Should show settings panel
    expect(screen.getByText('🎯 Grader Model')).toBeInTheDocument();

    // Wait for backend settings to load
    await waitFor(() => {
      expect(backendAPI.getSettings).toHaveBeenCalled();
    });
  });

  test('chat panel opens and loads backend conversations', async () => {
    const chatProps = { ...mockProps, activePanel: 'chat' };
    render(<LeftSidebar {...chatProps} />);

    // Should show chat panel
    expect(screen.getByText('💬 Top Scoring Chats')).toBeInTheDocument();

    // Wait for backend data to load
    await waitFor(() => {
      expect(backendAPI.getGraph).toHaveBeenCalled();
    });
  });

  test('panel close buttons trigger onClose callback', async () => {
    const chatProps = { ...mockProps, activePanel: 'chat' };
    render(<LeftSidebar {...chatProps} />);

    // Wait for panel to load
    await waitFor(() => {
      expect(screen.getByText('💬 Top Scoring Chats')).toBeInTheDocument();
    });

    // Find the close button specifically in the chat panel
    const chatPanel = screen.getByText('💬 Top Scoring Chats').closest('.sidebar-panel');
    const closeButton = chatPanel.querySelector('.close-btn');
    fireEvent.click(closeButton);

    expect(mockProps.onPanelChange).toHaveBeenCalledWith(null);
  });

  test('sidebar shows and hides based on hover state', () => {
    render(<LeftSidebar {...mockProps} />);

    const sidebar = screen.getByText('👤').closest('.left-sidebar');
    expect(sidebar).toHaveClass('hidden');

    // Simulate hover
    fireEvent.mouseEnter(sidebar);
    expect(sidebar).toHaveClass('visible');

    // Simulate mouse leave
    fireEvent.mouseLeave(sidebar);
    expect(sidebar).toHaveClass('hidden');
  });

  test('sidebar remains visible when panel is active', () => {
    const activeProps = { ...mockProps, activePanel: 'home' };
    render(<LeftSidebar {...activeProps} />);

    const sidebar = screen.getByText('👤').closest('.left-sidebar');
    expect(sidebar).toHaveClass('visible');
  });

  test('backend error handling displays fallback data', async () => {
    backendAPI.getGraph.mockRejectedValue(new Error('Backend offline'));

    const chatProps = { ...mockProps, activePanel: 'chat' };
    render(<LeftSidebar {...chatProps} />);

    // Should fall back to example data
    await waitFor(() => {
      expect(screen.getByText(/Backend Error/)).toBeInTheDocument();
    });
  });

  test('multiple panels can be opened and closed sequentially', () => {
    render(<LeftSidebar {...mockProps} />);

    // Open home panel
    const homeIcon = screen.getByTitle('User Profile');
    fireEvent.click(homeIcon);
    expect(mockProps.onPanelChange).toHaveBeenCalledWith('home');

    // Reset mock and open analytics panel
    mockProps.onPanelChange.mockClear();
    const analyticsIcon = screen.getByTitle('Embeddings');
    fireEvent.click(analyticsIcon);
    expect(mockProps.onPanelChange).toHaveBeenCalledWith('analytics');

    // Reset mock and open settings panel
    mockProps.onPanelChange.mockClear();
    const settingsIcon = screen.getByTitle('Grader Model');
    fireEvent.click(settingsIcon);
    expect(mockProps.onPanelChange).toHaveBeenCalledWith('settings');

    // Reset mock and open chat panel
    mockProps.onPanelChange.mockClear();
    const chatIcon = screen.getByTitle('Top Chats');
    fireEvent.click(chatIcon);
    expect(mockProps.onPanelChange).toHaveBeenCalledWith('chat');
  });
});