/**
 * Phase 1 Test 1: Backend API Connection Test
 * Tests backend API connectivity and response schema validation
 */

import { render, screen, waitFor } from '@testing-library/react';
import backendAPI from '../../services/BackendAPI';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Backend API Connection Test', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /graph returns node data with correct schema', async () => {
    // Mock successful response
    const mockGraphData = [
      {
        id: 'test-node-1',
        xy: [0.5, -0.3],
        score: 0.75,
        parent: null
      },
      {
        id: 'test-node-2', 
        xy: [0.1, 0.8],
        score: 0.62,
        parent: 'test-node-1'
      }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockGraphData
    });

    const result = await backendAPI.getGraph();
    
    // Verify API was called correctly
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/graph');
    
    // Verify response structure
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    
    // Verify node schema
    const node = result[0];
    expect(node).toHaveProperty('id');
    expect(node).toHaveProperty('xy');
    expect(node).toHaveProperty('score');
    expect(typeof node.score).toBe('number');
    expect(Array.isArray(node.xy)).toBe(true);
    expect(node.xy).toHaveLength(2);
  });

  test('handles offline backend gracefully', async () => {
    // Mock network error
    fetch.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(backendAPI.getGraph()).rejects.toThrow('fetch failed');
    
    // Verify error handling doesn't crash
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/graph');
  });

  test('handles HTTP error responses', async () => {
    // Mock 404 response
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(backendAPI.getGraph()).rejects.toThrow('HTTP error! status: 404');
  });

  test('GET /conversation returns conversation data with correct schema', async () => {
    const mockConversationData = {
      node_id: 'test-node-1',
      depth: 2,
      score: 0.75,
      conversation: [
        { role: 'user', content: 'Test question' },
        { role: 'assistant', content: 'Test response' }
      ],
      nodes_in_path: 3
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockConversationData
    });

    const result = await backendAPI.getConversation('test-node-1');
    
    // Verify API was called correctly
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/conversation/test-node-1');
    
    // Verify response structure
    expect(result).toHaveProperty('node_id');
    expect(result).toHaveProperty('conversation');
    expect(Array.isArray(result.conversation)).toBe(true);
    expect(result.conversation[0]).toHaveProperty('role');
    expect(result.conversation[0]).toHaveProperty('content');
  });

  test('mapBackendNodeToFrontend converts node format correctly', () => {
    const backendNode = {
      id: 'test-node-1',
      prompt: 'Test prompt',
      reply: 'Test reply',
      score: 0.85,
      depth: 2,
      parent: 'parent-node',
      xy: [0.5, -0.3]
    };

    const frontendNode = backendAPI.mapBackendNodeToFrontend(backendNode);
    
    // Verify conversion
    expect(frontendNode.id).toBe('test-node-1');
    expect(frontendNode.name).toBe('2'); // Should show depth
    expect(frontendNode.color).toMatch(/hsl\(\d+, 70%, 50%\)/); // Score-based color
    expect(frontendNode.nodeData.score).toBe(0.85);
    expect(frontendNode.nodeData.depth).toBe(2);
  });

  test('buildLinksFromNodes creates correct link structure', () => {
    const nodes = [
      {
        id: 'node-1',
        nodeData: { parent: null }
      },
      {
        id: 'node-2', 
        nodeData: { parent: 'node-1' }
      },
      {
        id: 'node-3',
        nodeData: { parent: 'node-1' }
      }
    ];

    const links = backendAPI.buildLinksFromNodes(nodes);
    
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ source: 'node-1', target: 'node-2' });
    expect(links[1]).toEqual({ source: 'node-1', target: 'node-3' });
  });
});