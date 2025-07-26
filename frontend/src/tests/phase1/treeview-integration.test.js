/**
 * Phase 1 Test 2: TreeView Backend Integration Test
 * Tests TreeView component integration with backend data
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TreeView from '../../components/TreeView';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

// Mock react-force-graph-2d
jest.mock('react-force-graph-2d', () => {
  return function MockForceGraph2D({ graphData, nodeCanvasObject }) {
    return (
      <div data-testid="force-graph">
        <div data-testid="graph-nodes">{graphData.nodes.length} nodes</div>
        <div data-testid="graph-links">{graphData.links.length} links</div>
        {graphData.nodes.map(node => (
          <div key={node.id} data-testid={`node-${node.id}`}>
            <span data-testid={`node-name-${node.id}`}>{node.name}</span>
            <span data-testid={`node-color-${node.id}`}>{node.color}</span>
          </div>
        ))}
      </div>
    );
  };
});

describe('TreeView Backend Integration Test', () => {
  const mockProps = {
    onNodeSelect: jest.fn(),
    onGenerateNode: { current: jest.fn() },
    nodePositions: {},
    setNodePositions: jest.fn(),
    dynamicNodes: {},
    setDynamicNodes: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful backend data
    backendAPI.getGraph.mockResolvedValue([
      {
        id: 'node-1',
        xy: [0.0, 0.0],
        score: 0.8,
        parent: null,
        depth: 0,
        prompt: 'Root conversation',
        reply: 'Initial response'
      },
      {
        id: 'node-2', 
        xy: [0.3, 0.2],
        score: 0.6,
        parent: 'node-1',
        depth: 1,
        prompt: 'Follow-up question',
        reply: 'Follow-up response'
      },
      {
        id: 'node-3',
        xy: [-0.2, 0.4],
        score: 0.9,
        parent: 'node-1', 
        depth: 1,
        prompt: 'Alternative approach',
        reply: 'Alternative response'
      }
    ]);

    backendAPI.mapBackendNodeToFrontend.mockImplementation((node) => ({
      id: node.id,
      name: node.depth?.toString() || '0',
      val: 12,
      color: `hsl(${(node.score || 0) * 120}, 70%, 50%)`, // Actual implementation: score * 120
      x: node.xy[0] * 100,
      y: node.xy[1] * 100,
      nodeData: node
    }));

    backendAPI.buildLinksFromNodes.mockImplementation((nodes) => {
      const links = [];
      nodes.forEach(node => {
        if (node.nodeData.parent) {
          links.push({
            source: node.nodeData.parent,
            target: node.id
          });
        }
      });
      return links;
    });

    backendAPI.connectWebSocket.mockImplementation(() => {});
    backendAPI.disconnectWebSocket.mockImplementation(() => {});
  });

  test('displays backend data instead of example data', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.getGraph).toHaveBeenCalled();
    });

    // Should show backend indicator
    expect(screen.getByText('Backend Data')).toBeInTheDocument();
    
    // Should display correct number of nodes
    expect(screen.getByTestId('graph-nodes')).toHaveTextContent('3 nodes');
    expect(screen.getByTestId('graph-links')).toHaveTextContent('2 links');
  });

  test('node colors reflect trajectory scores correctly', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-color-node-1')).toHaveTextContent('hsl(96, 70%, 50%)'); // 0.8 * 120 = 96
      expect(screen.getByTestId('node-color-node-2')).toHaveTextContent('hsl(72, 70%, 50%)'); // 0.6 * 120 = 72
      expect(screen.getByTestId('node-color-node-3')).toHaveTextContent('hsl(108, 70%, 50%)'); // 0.9 * 120 = 108
    });
  });

  test('node labels show depth numbers instead of IDs', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-name-node-1')).toHaveTextContent('0'); // depth 0
      expect(screen.getByTestId('node-name-node-2')).toHaveTextContent('1'); // depth 1
      expect(screen.getByTestId('node-name-node-3')).toHaveTextContent('1'); // depth 1
    });
  });

  test('parent-child relationships render correctly', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      // Should have 2 links: node-1 -> node-2, node-1 -> node-3
      expect(screen.getByTestId('graph-links')).toHaveTextContent('2 links');
    });

    expect(backendAPI.buildLinksFromNodes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-1' }),
        expect.objectContaining({ id: 'node-2' }),
        expect.objectContaining({ id: 'node-3' })
      ])
    );
  });

  test('handles empty backend data gracefully', async () => {
    backendAPI.getGraph.mockRejectedValue(new Error('Backend offline'));

    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Backend Error: Backend offline')).toBeInTheDocument();
      expect(screen.getByText('Example Data')).toBeInTheDocument();
    });
  });

  test('shows loading state during data fetch', async () => {
    // Create a promise we can control
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    backendAPI.getGraph.mockReturnValue(loadingPromise);

    render(<TreeView {...mockProps} />);

    // Should show loading indicator
    expect(screen.getByText('Loading backend data...')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise([]);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading backend data...')).not.toBeInTheDocument();
    });
  });

  test('establishes WebSocket connection for real-time updates', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.connectWebSocket).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  test('cleans up WebSocket connection on unmount', async () => {
    const { unmount } = render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(backendAPI.connectWebSocket).toHaveBeenCalled();
    });

    unmount();

    expect(backendAPI.disconnectWebSocket).toHaveBeenCalled();
  });
});