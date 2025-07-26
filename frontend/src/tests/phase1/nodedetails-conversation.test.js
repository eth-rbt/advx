/**
 * Phase 1 Test 4: NodeDetailsPanel Conversation Test
 * Tests conversation endpoint integration in NodeDetailsPanel
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NodeDetailsPanel from '../../components/NodeDetailsPanel';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

describe('NodeDetailsPanel Conversation Test', () => {
  const mockNode = {
    id: 'node-3',
    name: '2',
    nodeData: {
      id: 'node-3',
      depth: 2,
      score: 0.7,
      prompt: 'What are your thoughts on diplomacy?',
      reply: 'Diplomacy requires mutual respect and understanding.',
      parent: 'node-2'
    }
  };

  const mockConversation = {
    conversation: [
      {
        role: 'user',
        content: 'President Putin, how might we build lasting peace?'
      },
      {
        role: 'assistant', 
        content: 'Peace requires honest dialogue and respect for sovereignty.'
      },
      {
        role: 'user',
        content: 'Can you elaborate on economic cooperation?'
      },
      {
        role: 'assistant',
        content: 'Economic ties create mutual interests that support stability.'
      },
      {
        role: 'user',
        content: 'What are your thoughts on diplomacy?'
      },
      {
        role: 'assistant',
        content: 'Diplomacy requires mutual respect and understanding.'
      }
    ],
    nodes_in_path: 3,
    depth: 2
  };

  beforeEach(() => {
    jest.clearAllMocks();
    backendAPI.getConversation.mockResolvedValue(mockConversation);
  });

  test('loads conversation when node is selected', async () => {
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(backendAPI.getConversation).toHaveBeenCalledWith('node-3');
    });

    // Should show conversation messages
    expect(screen.getByText('President Putin, how might we build lasting peace?')).toBeInTheDocument();
    expect(screen.getByText('Peace requires honest dialogue and respect for sovereignty.')).toBeInTheDocument();
    expect(screen.getByText('Can you elaborate on economic cooperation?')).toBeInTheDocument();
    expect(screen.getByText('Economic ties create mutual interests that support stability.')).toBeInTheDocument();
    expect(screen.getByText('What are your thoughts on diplomacy?')).toBeInTheDocument();
    expect(screen.getByText('Diplomacy requires mutual respect and understanding.')).toBeInTheDocument();
  });

  test('displays loading state while fetching conversation', async () => {
    // Create controllable promise
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    backendAPI.getConversation.mockReturnValue(loadingPromise);

    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    // Should show loading indicator
    expect(screen.getByText('Loading conversation...')).toBeInTheDocument();

    // Resolve promise
    resolvePromise(mockConversation);

    await waitFor(() => {
      expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument();
    });
  });

  test('handles conversation loading errors gracefully', async () => {
    backendAPI.getConversation.mockRejectedValue(new Error('Network error'));

    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Error loading conversation: Network error')).toBeInTheDocument();
    });

    // Should still show basic node info
    expect(screen.getByText('node-3')).toBeInTheDocument();
  });

  test('formats conversation messages with proper roles', async () => {
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(backendAPI.getConversation).toHaveBeenCalled();
    });

    // Check for user message styling
    const userMessages = screen.getAllByText(/President Putin|Can you elaborate|What are your thoughts/);
    expect(userMessages).toHaveLength(3);

    // Check for assistant message styling  
    const assistantMessages = screen.getAllByText(/Peace requires|Economic ties|Diplomacy requires/);
    expect(assistantMessages).toHaveLength(3);
  });

  test('shows conversation depth and score in header', async () => {
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('node-3')).toBeInTheDocument();
      expect(screen.getByText('Conversation Path (3 nodes, depth 2)')).toBeInTheDocument();
    });
  });

  test('handles empty conversation gracefully', async () => {
    backendAPI.getConversation.mockResolvedValue({ conversation: [], nodes_in_path: 0, depth: 0 });

    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Path (0 nodes, depth 0)')).toBeInTheDocument();
    });

    // Should still show node info
    expect(screen.getByText('node-3')).toBeInTheDocument();
  });

  test('conversation shows with proper structure', async () => {   
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(backendAPI.getConversation).toHaveBeenCalled();
      expect(screen.getByText('Conversation Path (3 nodes, depth 2)')).toBeInTheDocument();
    });
  });

  test('close button triggers onClose callback', async () => {
    const mockOnClose = jest.fn();
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={mockOnClose} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('handles node change by loading new conversation', async () => {
    const { rerender } = render(<NodeDetailsPanel selectedNode={mockNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(backendAPI.getConversation).toHaveBeenCalledWith('node-3');
    });

    // Change to different node
    const newNode = {
      ...mockNode,
      id: 'node-5',
      nodeData: { ...mockNode.nodeData, id: 'node-5' }
    };

    const newConversation = {
      conversation: [
        { role: 'user', content: 'Different conversation' },
        { role: 'assistant', content: 'Different response' }
      ],
      nodes_in_path: 2,
      depth: 1
    };

    backendAPI.getConversation.mockResolvedValue(newConversation);

    rerender(<NodeDetailsPanel selectedNode={newNode} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(backendAPI.getConversation).toHaveBeenCalledWith('node-5');
      expect(screen.getByText('Different conversation')).toBeInTheDocument();
      expect(screen.getByText('Different response')).toBeInTheDocument();
    });
  });
});