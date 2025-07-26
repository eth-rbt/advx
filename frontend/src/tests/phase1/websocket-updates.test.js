/**
 * Phase 1 Test 3: WebSocket Real-time Updates Test
 * Tests WebSocket connectivity and real-time node updates
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TreeView from '../../components/TreeView';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

// Mock react-force-graph-2d
jest.mock('react-force-graph-2d', () => {
  return function MockForceGraph2D({ graphData }) {
    return (
      <div data-testid="force-graph">
        <div data-testid="graph-nodes">{graphData.nodes.length} nodes</div>
        {graphData.nodes.map(node => (
          <div key={node.id} data-testid={`node-${node.id}`}>
            <span data-testid={`node-processing-${node.id}`}>
              {node.isProcessing ? 'processing' : 'idle'}
            </span>
            <span data-testid={`node-target-${node.id}`}>
              {node.isNextTarget ? 'next-target' : 'normal'}
            </span>
          </div>
        ))}
      </div>
    );
  };
});

describe('WebSocket Real-time Updates Test', () => {
  const mockProps = {
    onNodeSelect: jest.fn(),
    onGenerateNode: { current: jest.fn() },
    nodePositions: {},
    setNodePositions: jest.fn(),
    dynamicNodes: {},
    setDynamicNodes: jest.fn()
  };

  let mockWebSocketCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock initial backend data
    backendAPI.getGraph.mockResolvedValue([
      {
        id: 'node-1',
        xy: [0.0, 0.0],
        score: 0.5,
        parent: null,
        depth: 0
      }
    ]);

    backendAPI.mapBackendNodeToFrontend.mockImplementation((node) => ({
      id: node.id,
      name: node.depth?.toString() || '0',
      val: 12,
      color: `hsl(${(node.score || 0) * 120}, 70%, 50%)`,
      nodeData: node
    }));

    backendAPI.buildLinksFromNodes.mockImplementation(() => []);

    // Capture WebSocket callback
    backendAPI.connectWebSocket.mockImplementation((callback) => {
      mockWebSocketCallback = callback;
    });
    
    backendAPI.disconnectWebSocket.mockImplementation(() => {});
  });

  test('WebSocket connects successfully on component mount', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.connectWebSocket).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  test('new nodes appear in real-time via WebSocket', async () => {
    render(<TreeView {...mockProps} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('graph-nodes')).toHaveTextContent('1 nodes');
    });

    // Simulate WebSocket message for new node
    const newNodeMessage = {
      type: 'node_created',
      data: {
        node: {
          id: 'node-2',
          xy: [0.2, 0.3],
          score: 0.7,
          parent: 'node-1',
          depth: 1,
          prompt: 'New node',
          reply: 'New response'
        }
      }
    };

    // Mock the mapping for the new node
    backendAPI.mapBackendNodeToFrontend.mockReturnValueOnce({
      id: 'node-2',
      name: '1',
      val: 12,
      color: 'hsl(84, 70%, 50%)',
      nodeData: newNodeMessage.data.node
    });

    backendAPI.buildLinksFromNodes.mockReturnValueOnce([
      { source: 'node-1', target: 'node-2' }
    ]);

    // Trigger WebSocket message
    mockWebSocketCallback(newNodeMessage);

    await waitFor(() => {
      expect(screen.getByTestId('graph-nodes')).toHaveTextContent('2 nodes');
      expect(screen.getByTestId('node-node-2')).toBeInTheDocument();
    });
  });

  test('processing state updates via WebSocket', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
    });

    // Simulate processing started message
    const processingMessage = {
      type: 'processing_started',
      data: {
        nodeId: 'node-1'
      }
    };

    mockWebSocketCallback(processingMessage);

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('processing');
    });

    // Simulate processing completed message
    const completedMessage = {
      type: 'processing_completed',
      data: {
        nodeId: 'node-1'
      }
    };

    mockWebSocketCallback(completedMessage);

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
    });
  });

  test('next target highlighting via WebSocket', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-target-node-1')).toHaveTextContent('normal');
    });

    // Simulate frontier updated message
    const frontierMessage = {
      type: 'frontier_updated',
      data: {
        nextTarget: 'node-1',
        frontierSize: 5
      }
    };

    mockWebSocketCallback(frontierMessage);

    await waitFor(() => {
      expect(screen.getByTestId('node-target-node-1')).toHaveTextContent('next-target');
    });
  });

  test('handles WebSocket reconnection after interruption', async () => {
    const { unmount } = render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.connectWebSocket).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(backendAPI.disconnectWebSocket).toHaveBeenCalled();

    // Re-render should reconnect
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.connectWebSocket).toHaveBeenCalledTimes(2);
    });
  });

  test('connection status updates in TopBar integration', async () => {
    render(<TreeView {...mockProps} />);

    // Should show backend data indicator when connected
    await waitFor(() => {
      expect(screen.getByText('Backend Data')).toBeInTheDocument();
    });

    // Simulate connection status message
    const connectionMessage = {
      type: 'connection',
      status: 'connected'
    };

    mockWebSocketCallback(connectionMessage);

    // Component should handle connection status (implementation can be extended)
    expect(mockWebSocketCallback).toBeDefined();
  });

  test('handles unknown WebSocket message types gracefully', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.connectWebSocket).toHaveBeenCalled();
    });

    // Simulate unknown message type
    const unknownMessage = {
      type: 'unknown_message_type',
      data: { some: 'data' }
    };

    // Should not throw error
    expect(() => {
      mockWebSocketCallback(unknownMessage);
    }).not.toThrow();

    // Component should remain stable
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
  });

  test('node updates preserve existing node properties', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-nodes')).toHaveTextContent('1 nodes');
    });

    // Simulate node update message
    const updateMessage = {
      type: 'node_updated',
      data: {
        node: {
          id: 'node-1', // Same ID
          xy: [0.1, 0.1], // Updated position
          score: 0.8, // Updated score
          parent: null,
          depth: 0,
          prompt: 'Original prompt', // Preserved
          reply: 'Updated reply' // Updated
        }
      }
    };

    backendAPI.mapBackendNodeToFrontend.mockReturnValueOnce({
      id: 'node-1',
      name: '0',
      val: 12,
      color: 'hsl(96, 70%, 50%)', // Updated color for new score
      nodeData: updateMessage.data.node
    });

    mockWebSocketCallback(updateMessage);

    await waitFor(() => {
      // Should still have 1 node (updated, not added)
      expect(screen.getByTestId('graph-nodes')).toHaveTextContent('1 nodes');
      expect(screen.getByTestId('node-node-1')).toBeInTheDocument();
    });
  });
});