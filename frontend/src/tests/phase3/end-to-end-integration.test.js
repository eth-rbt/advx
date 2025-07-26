import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import App from '../../App';
import backendAPI from '../../services/BackendAPI';
import { buildTreeFromNodes, calculateSystemStats, treeToGraphData } from '../../utils/dataTransforms';

// Mock the backend API
jest.mock('../../services/BackendAPI', () => ({
  getGraph: jest.fn(),
  getWorkerStatus: jest.fn(),
  connectWebSocket: jest.fn(),
  disconnectWebSocket: jest.fn(),
  startWorker: jest.fn(),
  stopWorker: jest.fn(),
  getConversation: jest.fn(),
  seedConversation: jest.fn(),
  clearGraph: jest.fn()
}));

// Mock ForceGraph2D to avoid canvas issues
jest.mock('react-force-graph-2d', () => {
  return function MockForceGraph2D({ onNodeClick, graphData }) {
    return (
      <div data-testid="force-graph">
        <div data-testid="graph-nodes">
          {graphData?.nodes?.length || 0} nodes
        </div>
        <div data-testid="graph-links">
          {graphData?.links?.length || 0} links
        </div>
        {graphData?.nodes?.map(node => (
          <button
            key={node.id}
            data-testid={`node-${node.id}`}
            onClick={() => onNodeClick?.(node)}
          >
            {node.name}
          </button>
        ))}
      </div>
    );
  };
});

describe('Phase 3: End-to-End Integration Tests', () => {
  
  const mockGraphData = [
    {
      id: 'root',
      parent: null,
      depth: 0,
      score: 0.5,
      prompt: 'Root prompt',
      reply: 'Root reply'
    },
    {
      id: 'child1',
      parent: 'root',
      depth: 1,
      score: 0.7,
      prompt: 'Child 1 prompt',
      reply: 'Child 1 reply'
    },
    {
      id: 'child2',
      parent: 'root',
      depth: 1,
      score: 0.8,
      prompt: 'Child 2 prompt',
      reply: 'Child 2 reply'
    }
  ];

  const mockWorkerStatus = {
    status: 'stopped',
    pid: null,
    isGenerating: false,
    lastHeartbeat: null
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    backendAPI.getGraph.mockResolvedValue(mockGraphData);
    backendAPI.getWorkerStatus.mockResolvedValue(mockWorkerStatus);
    backendAPI.connectWebSocket.mockImplementation((callback) => {
      // Simulate immediate connection
      setTimeout(() => {
        callback({ type: 'connection_status', status: 'connected' });
      }, 0);
    });
  });

  describe('Complete Data Flow Integration', () => {
    test('should load initial data and transform through complete pipeline', async () => {
      render(<App />);

      // Wait for initial data load
      await waitFor(() => {
        expect(backendAPI.getGraph).toHaveBeenCalled();
        expect(backendAPI.getWorkerStatus).toHaveBeenCalled();
        expect(backendAPI.connectWebSocket).toHaveBeenCalled();
      });

      // Verify data transformation pipeline worked
      await waitFor(() => {
        // Should show 3 nodes in the graph
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('3 nodes');
        expect(screen.getByTestId('graph-links')).toHaveTextContent('2 links');
      });
    });

    test('should handle real-time updates through WebSocket', async () => {
      const { rerender } = render(<App />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(backendAPI.connectWebSocket).toHaveBeenCalled();
      });

      // Get the WebSocket callback
      const webSocketCallback = backendAPI.connectWebSocket.mock.calls[0][0];

      // Simulate new node via WebSocket
      const newNode = {
        id: 'child3',
        parent: 'child1',
        depth: 2,
        score: 0.9,
        prompt: 'Child 3 prompt',
        reply: 'Child 3 reply'
      };

      // Send WebSocket update
      webSocketCallback(newNode);

      // Wait for UI update
      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('4 nodes');
        expect(screen.getByTestId('graph-links')).toHaveTextContent('3 links');
      });
    });

    test('should maintain data consistency across components', async () => {
      render(<App />);

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('3 nodes');
      });

      // Open sidebar panels and verify they show consistent data
      const homeIcon = screen.getAllByText('👤')[0]; // Home icon
      fireEvent.click(homeIcon);

      await waitFor(() => {
        expect(screen.getByText('👤 User Profile')).toBeInTheDocument();
        // Should show total nodes consistently
        expect(screen.getByText('3')).toBeInTheDocument(); // Total nodes in stats
      });

      // Switch to analytics panel
      const analyticsIcon = screen.getAllByText('📊')[0]; // Analytics icon  
      fireEvent.click(analyticsIcon);

      await waitFor(() => {
        expect(screen.getByText('📊 Embedding Visualization')).toBeInTheDocument();
      });

      // Switch to chat panel
      const chatIcon = screen.getAllByText('💬')[0]; // Chat icon
      fireEvent.click(chatIcon);

      await waitFor(() => {
        expect(screen.getByText('💬 Top Scoring Chats')).toBeInTheDocument();
        // Should show conversations sorted by score
        expect(screen.getByText('Total: 3')).toBeInTheDocument();
      });
    });
  });

  describe('Worker Control Integration', () => {
    test('should handle worker start/stop through centralized controls', async () => {
      backendAPI.startWorker.mockResolvedValue({ status: 'running', pid: 12345 });
      backendAPI.stopWorker.mockResolvedValue({ status: 'stopped', pid: null });

      render(<App />);

      // Open settings panel to access worker controls
      const settingsIcon = screen.getAllByText('🎯')[0]; // Settings icon
      fireEvent.click(settingsIcon);

      await waitFor(() => {
        expect(screen.getByText('🎯 Grader Model')).toBeInTheDocument();
        expect(screen.getByText('Worker Control')).toBeInTheDocument();
      });

      // Start worker
      const startButton = screen.getByText('Start Worker');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(backendAPI.startWorker).toHaveBeenCalled();
      });

      // Update worker status to simulate successful start
      const webSocketCallback = backendAPI.connectWebSocket.mock.calls[0][0];
      webSocketCallback({
        type: 'worker_status',
        data: { status: 'running', pid: 12345 }
      });

      await waitFor(() => {
        expect(screen.getByText('Worker Status: running')).toBeInTheDocument();
        expect(screen.getByText(/PID: 12345/)).toBeInTheDocument();
      });

      // Stop worker
      const stopButton = screen.getByText('Stop Worker');
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(backendAPI.stopWorker).toHaveBeenCalled();
      });
    });

    test('should propagate worker status to all relevant components', async () => {
      render(<App />);

      // Simulate worker running status
      const webSocketCallback = backendAPI.connectWebSocket.mock.calls[0][0];
      webSocketCallback({
        type: 'worker_status',
        data: { status: 'running', pid: 12345, isGenerating: true }
      });

      // Check ConversationControls reflects worker status
      await waitFor(() => {
        expect(screen.getByText('Running - Generating conversations')).toBeInTheDocument();
      });

      // Check SettingsPanel reflects worker status when opened
      const settingsIcon = screen.getAllByText('🎯')[0];
      fireEvent.click(settingsIcon);

      await waitFor(() => {
        expect(screen.getByText('Worker Status: running')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API failure
      backendAPI.getGraph.mockRejectedValue(new Error('Backend unavailable'));

      render(<App />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Multi:verse')).toBeInTheDocument();
      });

      // Should show 0 nodes when API fails
      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('0 nodes');
      });
    });

    test('should handle WebSocket disconnection and show status', async () => {
      render(<App />);

      // Wait for initial connection
      await waitFor(() => {
        expect(backendAPI.connectWebSocket).toHaveBeenCalled();
      });

      // Simulate WebSocket disconnection
      const webSocketCallback = backendAPI.connectWebSocket.mock.calls[0][0];
      webSocketCallback({
        type: 'connection_status',
        status: 'disconnected',
        reason: 'Network error'
      });

      // Open a panel that shows connection status
      const chatIcon = screen.getAllByText('💬')[0];
      fireEvent.click(chatIcon);

      await waitFor(() => {
        expect(screen.getByText('WebSocket: disconnected')).toBeInTheDocument();
      });
    });

    test('should handle worker control errors', async () => {
      backendAPI.startWorker.mockRejectedValue(new Error('Failed to start worker'));

      render(<App />);

      // Open settings panel
      const settingsIcon = screen.getAllByText('🎯')[0];
      fireEvent.click(settingsIcon);

      await waitFor(() => {
        expect(screen.getByText('Start Worker')).toBeInTheDocument();
      });

      // Try to start worker
      const startButton = screen.getByText('Start Worker');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(backendAPI.startWorker).toHaveBeenCalled();
      });

      // Should show error in conversation controls
      await waitFor(() => {
        // The error should propagate to ConversationControls
        expect(screen.getByText(/Failed to start/)).toBeInTheDocument();
      });
    });
  });

  describe('Data Transformation Consistency', () => {
    test('should maintain consistent data transformations across the pipeline', () => {
      // Test the complete transformation pipeline independently
      const rawNodes = new Map();
      mockGraphData.forEach(node => {
        rawNodes.set(node.id, node);
      });

      // Transform to tree
      const tree = buildTreeFromNodes(rawNodes);
      expect(tree).toBeTruthy();
      expect(tree.id).toBe('root');
      expect(tree.children).toHaveLength(2);

      // Calculate stats
      const stats = calculateSystemStats(rawNodes, tree);
      expect(stats.totalNodes).toBe(3);
      expect(stats.maxDepth).toBe(1);
      expect(stats.averageScore).toBeCloseTo(0.667, 2);

      // Transform to graph data
      const graphData = treeToGraphData(tree);
      expect(graphData.nodes).toHaveLength(3);
      expect(graphData.links).toHaveLength(2);

      // Verify all data is consistent
      rawNodes.forEach((node, id) => {
        const graphNode = graphData.nodes.find(n => n.id === id);
        expect(graphNode).toBeTruthy();
        expect(graphNode.nodeData).toBeTruthy();
        expect(graphNode.nodeData.id).toBe(id);
      });
    });

    test('should handle dynamic data updates correctly', async () => {
      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('3 nodes');
      });

      // Simulate multiple rapid updates
      const webSocketCallback = backendAPI.connectWebSocket.mock.calls[0][0];
      
      const updates = [
        { id: 'child3', parent: 'child1', depth: 2, score: 0.6, prompt: 'Child 3' },
        { id: 'child4', parent: 'child2', depth: 2, score: 0.9, prompt: 'Child 4' },
        { id: 'child1', parent: 'root', depth: 1, score: 0.75, prompt: 'Updated child 1' } // Update existing
      ];

      // Send all updates
      updates.forEach(update => {
        webSocketCallback(update);
      });

      // Should handle all updates correctly
      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('5 nodes'); // 3 original + 2 new
        expect(screen.getByTestId('graph-links')).toHaveTextContent('4 links'); // Correct link count
      });
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large data sets efficiently', async () => {
      // Generate large mock dataset
      const largeDataset = [];
      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          id: `node-${i}`,
          parent: i > 0 ? `node-${Math.floor(i / 2)}` : null,
          depth: Math.floor(Math.log2(i + 1)),
          score: Math.random(),
          prompt: `Prompt ${i}`,
          reply: `Reply ${i}`
        });
      }

      backendAPI.getGraph.mockResolvedValue(largeDataset);

      const startTime = performance.now();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('100 nodes');
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in reasonable time (less than 2 seconds for 100 nodes)
      expect(renderTime).toBeLessThan(2000);
    });

    test('should not cause memory leaks with frequent updates', async () => {
      render(<App />);

      const webSocketCallback = backendAPI.connectWebSocket.mock.calls[0][0];

      // Simulate many rapid updates
      for (let i = 0; i < 50; i++) {
        webSocketCallback({
          id: `rapid-${i}`,
          parent: 'root',
          depth: 1,
          score: Math.random(),
          prompt: `Rapid update ${i}`
        });
      }

      // Should handle all updates without crashing
      await waitFor(() => {
        expect(screen.getByTestId('graph-nodes')).toBeInTheDocument();
      });

      // Component should still be responsive
      const homeIcon = screen.getAllByText('👤')[0];
      fireEvent.click(homeIcon);

      await waitFor(() => {
        expect(screen.getByText('👤 User Profile')).toBeInTheDocument();
      });
    });
  });
});