/**
 * Phase 3 Test 1: Panel Integration Test
 * Tests sidebar panel components with backend integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsPanel from '../../components/panels/AnalyticsPanel';
import SettingsPanel from '../../components/panels/SettingsPanel';
import HomePanel from '../../components/panels/HomePanel';
import ChatPanel from '../../components/panels/ChatPanel';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

describe('Panel Integration Test', () => {
  const mockBackendNodes = [
    {
      id: 'node-1',
      xy: [0.1, 0.2],
      score: 0.8,
      parent: null,
      depth: 0,
      prompt: 'How can we achieve peace?',
      reply: 'Through dialogue and understanding.',
      emb: [0.1, 0.2, 0.3, 0.4] // Mock embedding
    },
    {
      id: 'node-2',
      xy: [-0.1, 0.3],
      score: 0.6,
      parent: 'node-1',
      depth: 1,
      prompt: 'What about economic cooperation?',
      reply: 'Economic ties strengthen relationships.'
    }
  ];

  const mockSettings = {
    lambda_trend: 0.3,
    lambda_sim: 0.2,
    lambda_depth: 0.05
  };

  const mockConversation = {
    conversation: [
      { role: 'user', content: 'How can we achieve peace?' },
      { role: 'assistant', content: 'Through dialogue and understanding.' },
      { role: 'user', content: 'What about economic cooperation?' },
      { role: 'assistant', content: 'Economic ties strengthen relationships.' }
    ],
    nodes_in_path: 2,
    depth: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock backend API responses
    backendAPI.getGraph.mockResolvedValue(mockBackendNodes);
    backendAPI.getSettings.mockResolvedValue(mockSettings);
    backendAPI.updateSettings.mockResolvedValue({ success: true });
    backendAPI.getConversation.mockResolvedValue(mockConversation);
  });

  describe('AnalyticsPanel', () => {
    test('loads backend data and displays embedding visualization', async () => {
      render(<AnalyticsPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(backendAPI.getGraph).toHaveBeenCalled();
        expect(screen.getByText('Backend Data')).toBeInTheDocument();
      });

      // Should show analytics stats
      expect(screen.getByText('2')).toBeInTheDocument(); // Total nodes
      expect(screen.getByText('1')).toBeInTheDocument(); // Max depth
    });

    test('handles backend data loading errors gracefully', async () => {
      backendAPI.getGraph.mockRejectedValue(new Error('Network error'));

      render(<AnalyticsPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Backend Error: Network error/)).toBeInTheDocument();
        expect(screen.getByText('Example Data')).toBeInTheDocument();
      });
    });
  });

  describe('SettingsPanel', () => {
    test('loads and displays backend lambda settings', async () => {
      render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(backendAPI.getSettings).toHaveBeenCalled();
        expect(screen.getByText(/LAMBDA_TREND: 0.300/)).toBeInTheDocument();
        expect(screen.getByText(/LAMBDA_SIM: 0.200/)).toBeInTheDocument();
        expect(screen.getByText(/LAMBDA_DEPTH: 0.050/)).toBeInTheDocument();
      });
    });

    test('updates settings via backend API', async () => {
      render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(backendAPI.getSettings).toHaveBeenCalled();
      });

      // Find and change a lambda slider
      const trendSlider = screen.getByDisplayValue('0.3');
      fireEvent.change(trendSlider, { target: { value: '0.5' } });

      // Save settings
      const saveButton = screen.getByText('Save Priority Settings');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(backendAPI.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            lambda_trend: 0.5,
            lambda_sim: 0.2,
            lambda_depth: 0.05
          })
        );
        expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
      });
    });

    test('handles settings update errors gracefully', async () => {
      backendAPI.updateSettings.mockRejectedValue(new Error('Save failed'));

      render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(backendAPI.getSettings).toHaveBeenCalled();
      });

      const saveButton = screen.getByText('Save Priority Settings');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to save settings: Save failed/)).toBeInTheDocument();
      });
    });
  });

  describe('HomePanel', () => {
    test('loads and displays graph statistics', async () => {
      render(<HomePanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(backendAPI.getGraph).toHaveBeenCalled();
        expect(screen.getByText('2')).toBeInTheDocument(); // Total nodes
        expect(screen.getByText('1')).toBeInTheDocument(); // Max depth
        expect(screen.getByText('0.700')).toBeInTheDocument(); // Average score
      });

      // Should show best performing node
      expect(screen.getByText('Best Performing Node')).toBeInTheDocument();
      expect(screen.getByText(/node-1/)).toBeInTheDocument();
      expect(screen.getByText(/0.800/)).toBeInTheDocument();
    });

    test('handles empty graph data gracefully', async () => {
      backendAPI.getGraph.mockResolvedValue([]);

      render(<HomePanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument(); // Total nodes should be 0
      });
    });
  });

  describe('ChatPanel', () => {
    test('loads backend conversations sorted by score', async () => {
      render(<ChatPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(backendAPI.getGraph).toHaveBeenCalled();
        expect(screen.getByText('Backend Conversations')).toBeInTheDocument();
      });

      // Should display conversations sorted by score (node-1 first with 0.8, node-2 second with 0.6)
      const conversationItems = screen.getAllByText(/D\d+/);
      expect(conversationItems).toHaveLength(2);
      
      // Should show crown for highest scoring conversation
      expect(screen.getByText(/👑/)).toBeInTheDocument();
    });

    test('loads full conversation details when node is selected', async () => {
      render(<ChatPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Backend Conversations')).toBeInTheDocument();
      });

      // Click on a conversation item
      const firstConversation = screen.getByText(/D0 \(node-1\)/);
      fireEvent.click(firstConversation);

      await waitFor(() => {
        expect(backendAPI.getConversation).toHaveBeenCalledWith('node-1');
        expect(screen.getByText(/Full Conversation Thread/)).toBeInTheDocument();
        expect(screen.getByText('🧑 Human:')).toBeInTheDocument();
        expect(screen.getByText('🤖 Putin:')).toBeInTheDocument();
      });

      // Should show conversation content
      expect(screen.getByText('How can we achieve peace?')).toBeInTheDocument();
      expect(screen.getByText('Through dialogue and understanding.')).toBeInTheDocument();
    });

    test('handles conversation loading errors gracefully', async () => {
      backendAPI.getConversation.mockRejectedValue(new Error('Conversation not found'));

      render(<ChatPanel isOpen={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Backend Conversations')).toBeInTheDocument();
      });

      const firstConversation = screen.getByText(/D0 \(node-1\)/);
      fireEvent.click(firstConversation);

      // Should still show the basic node information even if full conversation fails
      await waitFor(() => {
        expect(screen.getByText(/Depth 0 \(node-1\)/)).toBeInTheDocument();
      });
    });

    test('displays fallback to example data when backend fails', async () => {
      backendAPI.getGraph.mockRejectedValue(new Error('Backend offline'));

      const exampleNodes = {
        'ex-1': { id: 'ex-1', score: 85, convo: 'Example conversation', prompt: 'Example prompt' }
      };

      render(<ChatPanel isOpen={true} onClose={jest.fn()} nodes={exampleNodes} />);

      await waitFor(() => {
        expect(screen.getByText('Backend Error: Backend offline')).toBeInTheDocument();
        expect(screen.getByText('Example Conversations')).toBeInTheDocument();
        expect(screen.getByText(/Node ex-1/)).toBeInTheDocument();
      });
    });
  });

  describe('Panel Close Functionality', () => {
    test('all panels trigger onClose callback when close button is clicked', () => {
      const mockOnClose = jest.fn();
      
      const panels = [
        { Component: AnalyticsPanel, name: 'Analytics' },
        { Component: SettingsPanel, name: 'Settings' },
        { Component: HomePanel, name: 'Home' },
        { Component: ChatPanel, name: 'Chat' }
      ];

      panels.forEach(({ Component, name }) => {
        mockOnClose.mockClear();
        render(<Component isOpen={true} onClose={mockOnClose} />);
        
        const closeButton = screen.getByText('×');
        fireEvent.click(closeButton);
        
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Panel Visibility', () => {
    test('panels show correct visibility states based on isOpen prop', () => {
      const panels = [
        { Component: AnalyticsPanel, testId: 'Embedding Visualization' },
        { Component: SettingsPanel, testId: 'Grader Model' },
        { Component: HomePanel, testId: 'User Profile' },
        { Component: ChatPanel, testId: 'Top Scoring Chats' }
      ];

      panels.forEach(({ Component, testId }) => {
        // Test closed state
        const { rerender } = render(<Component isOpen={false} onClose={jest.fn()} />);
        const panel = screen.getByText(testId).closest('.sidebar-panel');
        expect(panel).not.toHaveClass('open');

        // Test open state
        rerender(<Component isOpen={true} onClose={jest.fn()} />);
        expect(panel).toHaveClass('open');
      });
    });
  });
});