/**
 * Phase 2 Test 2: Processing Visual Indicators Test
 * Tests visual feedback for node processing states
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TreeView from '../../components/TreeView';
import backendAPI from '../../services/BackendAPI';

// Mock the backend API
jest.mock('../../services/BackendAPI');

// Mock react-force-graph-2d with processing state detection
jest.mock('react-force-graph-2d', () => {
  return function MockForceGraph2D({ graphData, nodeCanvasObject }) {
    // Simulate canvas rendering by calling the nodeCanvasObject function
    const mockCanvasContext = {
      fillStyle: '',
      shadowColor: '',  
      shadowBlur: 0,
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      strokeStyle: '',
      lineWidth: 0,
      stroke: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: jest.fn()
    };

    return (
      <div data-testid="force-graph">
        <div data-testid="graph-nodes">{graphData.nodes.length} nodes</div>
        {graphData.nodes.map(node => {
          // Simulate calling the custom node renderer
          if (nodeCanvasObject) {
            nodeCanvasObject(node, mockCanvasContext, 1);
          }
          
          return (
            <div key={node.id} data-testid={`node-${node.id}`}>
              <span data-testid={`node-processing-${node.id}`}>
                {node.isProcessing ? 'processing' : 'idle'}
              </span>
              <span data-testid={`node-target-${node.id}`}>
                {node.isNextTarget ? 'next-target' : 'normal'}
              </span>
              <span data-testid={`node-priority-${node.id}`}>
                {node.isPriority ? 'priority' : 'normal'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };
});

describe('Processing Visual Indicators Test', () => {
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
      },
      {
        id: 'node-2',
        xy: [0.1, 0.2],
        score: 0.7,
        parent: 'node-1',
        depth: 1
      }
    ]);

    backendAPI.mapBackendNodeToFrontend.mockImplementation((node) => ({
      id: node.id,
      name: node.depth?.toString() || '0',
      val: 12,
      color: `hsl(${(node.score || 0) * 120}, 70%, 50%)`,
      nodeData: node
    }));

    backendAPI.buildLinksFromNodes.mockImplementation(() => [
      { source: 'node-1', target: 'node-2' }
    ]);

    // Capture WebSocket callback
    backendAPI.connectWebSocket.mockImplementation((callback) => {
      mockWebSocketCallback = callback;
    });
    
    backendAPI.disconnectWebSocket.mockImplementation(() => {});
  });

  test('displays processing animation when node starts processing', async () => {
    render(<TreeView {...mockProps} />);

    // Wait for initial load
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
  });

  test('removes processing animation when processing completes', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
    });

    // Start processing
    mockWebSocketCallback({
      type: 'processing_started',
      data: { nodeId: 'node-1' }
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('processing');
    });

    // Complete processing
    mockWebSocketCallback({
      type: 'processing_completed',
      data: { nodeId: 'node-1' }
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
    });
  });

  test('multiple nodes can be processing simultaneously', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
      expect(screen.getByTestId('node-processing-node-2')).toHaveTextContent('idle');
    });

    // Start processing both nodes
    mockWebSocketCallback({
      type: 'processing_started',
      data: { nodeId: 'node-1' }
    });

    mockWebSocketCallback({
      type: 'processing_started',
      data: { nodeId: 'node-2' }
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('processing');
      expect(screen.getByTestId('node-processing-node-2')).toHaveTextContent('processing');
    });

    // Complete processing for node-1 only
    mockWebSocketCallback({
      type: 'processing_completed',
      data: { nodeId: 'node-1' }
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
      expect(screen.getByTestId('node-processing-node-2')).toHaveTextContent('processing');
    });
  });

  test('next target highlighting works independently of processing', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-target-node-1')).toHaveTextContent('normal');
    });

    // Highlight as next target
    mockWebSocketCallback({
      type: 'frontier_updated',
      data: {
        nextTarget: 'node-1',
        frontierSize: 3
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-target-node-1')).toHaveTextContent('next-target');
    });

    // Start processing the same node
    mockWebSocketCallback({
      type: 'processing_started',
      data: { nodeId: 'node-1' }
    });

    await waitFor(() => {
      // Should be both next-target and processing
      expect(screen.getByTestId('node-target-node-1')).toHaveTextContent('next-target');
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('processing');
    });
  });

  test('priority queue highlighting displays correctly', async () => {
    // Mock backend data with a priority node
    backendAPI.getGraph.mockResolvedValue([
      {
        id: 'node-1',
        xy: [0.0, 0.0],
        score: 0.9, // High score node
        parent: null,
        depth: 0
      }
    ]);

    backendAPI.mapBackendNodeToFrontend.mockImplementation((node) => ({
      id: node.id,
      name: node.depth?.toString() || '0',
      val: 12,
      color: `hsl(${(node.score || 0) * 120}, 70%, 50%)`,
      isPriority: node.score > 0.8, // Mock priority logic
      nodeData: node
    }));

    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-priority-node-1')).toHaveTextContent('priority');
    });
  });

  test('handles processing messages for non-existent nodes gracefully', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-nodes')).toHaveTextContent('2 nodes');
    });

    // Try to process a non-existent node
    mockWebSocketCallback({
      type: 'processing_started',
      data: { nodeId: 'node-999' }
    });

    // Should not crash or affect existing nodes
    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
      expect(screen.getByTestId('node-processing-node-2')).toHaveTextContent('idle');
    });
  });

  test('processing state persists across graph updates', async () => {
    render(<TreeView {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('idle');
    });

    // Start processing
    mockWebSocketCallback({
      type: 'processing_started',
      data: { nodeId: 'node-1' }
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('processing');
    });

    // Simulate new node added to graph
    mockWebSocketCallback({
      type: 'node_created',
      data: {
        node: {
          id: 'node-3',
          xy: [0.3, 0.1],
          score: 0.6,
          parent: 'node-2',
          depth: 2
        }
      }
    });

    // Mock the mapping for the new node
    backendAPI.mapBackendNodeToFrontend.mockReturnValueOnce({
      id: 'node-3',
      name: '2',
      val: 12,
      color: 'hsl(72, 70%, 50%)',
      nodeData: { id: 'node-3', xy: [0.3, 0.1], score: 0.6, parent: 'node-2', depth: 2 }
    });

    await waitFor(() => {
      expect(screen.getByTestId('graph-nodes')).toHaveTextContent('3 nodes');
      // Original processing state should persist
      expect(screen.getByTestId('node-processing-node-1')).toHaveTextContent('processing');
      expect(screen.getByTestId('node-processing-node-3')).toHaveTextContent('idle');
    });
  });

});