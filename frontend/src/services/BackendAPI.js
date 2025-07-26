/**
 * BackendAPI Service Class
 * Handles all communication with the Hackathon Multiverse backend
 */

class BackendAPI {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.websocket = null;
    this.wsCallbacks = [];
  }

  // Graph data endpoints
  async getGraph() {
    try {
      const response = await fetch(`${this.baseURL}/graph`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching graph data:', error);
      throw error;
    }
  }

  async getConversation(nodeId) {
    try {
      const response = await fetch(`${this.baseURL}/conversation/${nodeId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  async seedConversation(prompt) {
    try {
      const response = await fetch(`${this.baseURL}/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error seeding conversation:', error);
      throw error;
    }
  }

  // Control endpoints (Phase 2)
  async startGeneration() {
    try {
      const response = await fetch(`${this.baseURL}/control/run`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error starting generation:', error);
      throw error;
    }
  }

  async pauseGeneration() {
    try {
      const response = await fetch(`${this.baseURL}/control/pause`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error pausing generation:', error);
      throw error;
    }
  }

  async stepGeneration() {
    try {
      const response = await fetch(`${this.baseURL}/control/step`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error stepping generation:', error);
      throw error;
    }
  }

  // Settings endpoints (Phase 3)
  async getSettings() {
    try {
      const response = await fetch(`${this.baseURL}/settings`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  }

  async updateSettings(settings) {
    try {
      const response = await fetch(`${this.baseURL}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // Clear/reset endpoints (Phase 2)
  async clearGraph() {
    try {
      const response = await fetch(`${this.baseURL}/clear`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error clearing graph:', error);
      throw error;
    }
  }

  // Enhanced WebSocket management (based on backend implementation)
  connectWebSocket(onMessage) {
    try {
      const wsURL = this.baseURL.replace('http', 'ws') + '/ws';
      console.log('🔗 Connecting to WebSocket:', wsURL);
      this.websocket = new WebSocket(wsURL);
      
      this.websocket.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        this.notifyCallbacks({ type: 'connection_status', status: 'connected' });
        onMessage({ type: 'connection_status', status: 'connected' });
      };

      this.websocket.onmessage = (event) => {
        try {
          // Handle both string and object messages
          const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          onMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error, event.data);
          // Try to pass raw data if JSON parsing fails
          onMessage({ type: 'raw_message', data: event.data });
        }
      };

      this.websocket.onclose = (event) => {
        const reason = event.reason || 'Unknown reason';
        console.log(`❌ WebSocket disconnected (${event.code}): ${reason}`);
        this.notifyCallbacks({ type: 'connection_status', status: 'disconnected', reason });
        onMessage({ type: 'connection_status', status: 'disconnected', reason });
        
        // Auto-reconnect with exponential backoff
        const reconnectDelay = Math.min(5000 * Math.pow(1.5, this.reconnectAttempts || 0), 30000);
        console.log(`🔄 Attempting to reconnect in ${reconnectDelay/1000}s...`);
        
        setTimeout(() => {
          if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
            this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
            this.connectWebSocket(onMessage);
          }
        }, reconnectDelay);
      };

      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.notifyCallbacks({ type: 'connection_status', status: 'error', error });
        onMessage({ type: 'connection_status', status: 'error', error });
      };

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      
      return this.websocket;
    } catch (error) {
      console.error('❌ Error connecting to WebSocket:', error);
      throw error;
    }
  }

  disconnectWebSocket() {
    if (this.websocket) {
      console.log('🔌 Manually disconnecting WebSocket');
      this.websocket.close(1000, 'Manual disconnect');
      this.websocket = null;
      this.reconnectAttempts = 0;
    }
  }
  
  // Get WebSocket connection status
  getWebSocketStatus() {
    if (!this.websocket) return 'disconnected';
    
    switch (this.websocket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  // Utility methods
  notifyCallbacks(message) {
    this.wsCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in WebSocket callback:', error);
      }
    });
  }

  addWebSocketCallback(callback) {
    this.wsCallbacks.push(callback);
  }

  removeWebSocketCallback(callback) {
    const index = this.wsCallbacks.indexOf(callback);
    if (index > -1) {
      this.wsCallbacks.splice(index, 1);
    }
  }

  // Helper method to map backend node to frontend format
  mapBackendNodeToFrontend(backendNode, existingNodes = []) {
    const getColorByScore = (score) => {
      if (score === null || score === undefined) return '#888888'; // Gray for unknown
      
      // Clamp score between 0 and 1
      const clampedScore = Math.max(0, Math.min(1, score));
      
      // Convert to HSL: 0=red (0°), 0.5=yellow (60°), 1=green (120°)
      const hue = clampedScore * 120;
      return `hsl(${hue}, 70%, 50%)`;
    };

    const SCALE_FACTOR = 100; // Adjust based on visualization needs
    
    // Position logic: position near parent if new node, otherwise let physics decide
    let nodeX, nodeY;
    
    if (backendNode.parent && existingNodes.length > 0) {
      // Position near parent if this is a new node
      const parentNode = existingNodes.find(node => node.id === backendNode.parent);
      if (parentNode && parentNode.x !== undefined && parentNode.y !== undefined) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 30 + Math.random() * 10; // 30-40px from parent (closer start)
        nodeX = parentNode.x + Math.cos(angle) * distance;
        nodeY = parentNode.y + Math.sin(angle) * distance;
      }
    }
    // Otherwise nodeX and nodeY remain undefined - let physics simulation decide

    return {
      id: backendNode.id,
      name: backendNode.depth?.toString() || '0', // Display depth number instead of ID
      val: 12,
      color: getColorByScore(backendNode.score), // Score-based coloring (0=red, 1=green)
      x: nodeX,
      y: nodeY,
      nodeData: {
        id: backendNode.id,
        prompt: backendNode.prompt,
        reply: backendNode.reply,
        score: backendNode.score,
        parent: backendNode.parent,
        depth: backendNode.depth,
        emb: backendNode.emb,
        xy: backendNode.xy
      }
    };
  }

  // Build links array from nodes
  buildLinksFromNodes(nodes) {
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
  }
}

// Export singleton instance
const backendAPI = new BackendAPI();
export default backendAPI;