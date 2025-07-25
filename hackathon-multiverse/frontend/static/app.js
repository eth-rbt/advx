class MultiverseVisualizer {
    constructor() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.ws = null;
        this.scale = 200;
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
        
        this.init();
    }
    
    async init() {
        await this.loadInitialData();
        this.setupWebSocket();
        this.setupCanvas();
        this.startRenderLoop();
    }
    
    async loadInitialData() {
        try {
            const response = await fetch('http://localhost:8000/graph');
            this.nodes = await response.json();
            this.updateStats();
            console.log(`Loaded ${this.nodes.length} initial nodes`);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.addToActivityLog('❌ Failed to load initial graph data', 'error');
        }
    }
    
    setupWebSocket() {
        this.ws = new WebSocket('ws://localhost:8000/ws');
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            document.getElementById('wsStatus').textContent = 'Connected';
            document.getElementById('wsStatus').classList.remove('disconnected');
            document.getElementById('wsStatus').classList.add('connected');
            this.addToActivityLog('🔗 WebSocket connected', 'connection');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                this.handleNodeUpdate(update);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            document.getElementById('wsStatus').textContent = 'Disconnected';
            document.getElementById('wsStatus').classList.remove('connected');
            document.getElementById('wsStatus').classList.add('disconnected');
            this.addToActivityLog('❌ WebSocket disconnected', 'error');
            
            // Reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };
    }
    
    setupCanvas() {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.scale *= zoomFactor;
            this.scale = Math.max(50, Math.min(500, this.scale));
        });
        
        let isDragging = false;
        let lastX, lastY;
        
        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.offsetX;
            lastY = e.offsetY;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.offsetX - lastX;
                const deltaY = e.offsetY - lastY;
                this.offsetX += deltaX;
                this.offsetY += deltaY;
                lastX = e.offsetX;
                lastY = e.offsetY;
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    handleNodeUpdate(update) {
        // Check if node already exists
        const existingIndex = this.nodes.findIndex(n => n.id === update.id);
        
        if (existingIndex >= 0) {
            // Update existing node
            this.nodes[existingIndex] = { ...this.nodes[existingIndex], ...update };
        } else {
            // Add new node
            this.nodes.push(update);
            this.addToActivityLog(`🆕 New node created (score: ${update.score?.toFixed(3) || 'N/A'})`, 
                                update.score > 0.7 ? 'high-score' : 'new-node');
        }
        
        this.updateStats();
        this.updateBestConversations();
        this.updateWorstConversations();
    }
    
    updateStats() {
        const totalNodes = this.nodes.length;
        const scores = this.nodes.filter(n => n.score !== null).map(n => n.score);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const maxDepth = Math.max(0, ...this.nodes.map(n => this.getNodeDepth(n)));
        
        document.getElementById('totalNodes').textContent = totalNodes;
        document.getElementById('avgScore').textContent = avgScore.toFixed(3);
        document.getElementById('maxDepth').textContent = maxDepth;
        
        // Estimate frontier size (nodes with high scores that likely have children)
        const frontierEstimate = this.nodes.filter(n => n.score > 0.6).length;
        document.getElementById('frontierSize').textContent = frontierEstimate;
    }
    
    getNodeDepth(node) {
        let depth = 0;
        let current = node;
        const visited = new Set();
        
        while (current && current.parent && !visited.has(current.id)) {
            visited.add(current.id);
            current = this.nodes.find(n => n.id === current.parent);
            depth++;
            if (depth > 20) break; // Safety break
        }
        
        return depth;
    }
    
    updateBestConversations() {
        const bestNodes = this.nodes
            .filter(n => n.score !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        
        this.renderConversationList('bestConversations', bestNodes, 'best');
    }
    
    updateWorstConversations() {
        const worstNodes = this.nodes
            .filter(n => n.score !== null)
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);
        
        this.renderConversationList('worstConversations', worstNodes, 'worst');
    }
    
    renderConversationList(containerId, nodes, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (nodes.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'conversation-placeholder';
            placeholder.textContent = `No conversations yet...`;
            container.appendChild(placeholder);
            return;
        }
        
        nodes.forEach(node => {
            const div = document.createElement('div');
            div.className = `conversation-item ${type}`;
            div.style.cursor = 'pointer';
            
            const scoreClass = node.score >= 0.7 ? 'high-score' : 
                              node.score >= 0.4 ? 'medium-score' : 'low-score';
            
            div.innerHTML = `
                <div class="conversation-score ${scoreClass}">Score: ${node.score.toFixed(3)}</div>
                <div class="conversation-text">Depth: ${this.getNodeDepth(node)} | ID: ${node.id.slice(0, 8)}...</div>
                <div class="conversation-hint">Click to view full conversation</div>
            `;
            
            div.addEventListener('click', () => {
                this.showConversationModal(node.id);
            });
            
            container.appendChild(div);
        });
    }
    
    addToActivityLog(message, type = 'info') {
        const log = document.getElementById('activityLog');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        
        log.insertBefore(entry, log.firstChild);
        
        // Keep only last 50 entries
        while (log.children.length > 50) {
            log.removeChild(log.lastChild);
        }
    }
    
    getScoreColor(score) {
        if (score === null || score === undefined) return '#666';
        
        if (score < 0.4) return '#ff4444'; // Red for hostile
        if (score < 0.6) return '#ffaa44'; // Orange for neutral
        return '#44ff44'; // Green for progress
    }
    
    startRenderLoop() {
        const render = () => {
            this.renderGraph();
            requestAnimationFrame(render);
        };
        render();
    }
    
    async showConversationModal(nodeId) {
        try {
            const response = await fetch(`http://localhost:8000/conversation/${nodeId}`);
            const data = await response.json();
            
            if (data.error) {
                alert(`Error: ${data.error}`);
                return;
            }
            
            this.createConversationModal(data);
        } catch (error) {
            console.error('Failed to fetch conversation:', error);
            alert('Failed to load conversation details');
        }
    }
    
    createConversationModal(conversationData) {
        // Remove existing modal if present
        const existingModal = document.getElementById('conversationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'conversationModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Full Conversation</h2>
                    <div class="conversation-meta">
                        Score: ${conversationData.score?.toFixed(3) || 'N/A'} | 
                        Depth: ${conversationData.depth} | 
                        Turns: ${conversationData.conversation.length}
                    </div>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="conversation-thread">
                        ${this.formatConversationHTML(conversationData.conversation)}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => modal.remove());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Show modal
        modal.style.display = 'block';
    }
    
    formatConversationHTML(conversation) {
        return conversation.map((turn, index) => {
            const isUser = turn.role === 'user';
            const speaker = isUser ? 'Human' : 'Putin';
            const className = isUser ? 'user-message' : 'assistant-message';
            
            return `
                <div class="message ${className}">
                    <div class="message-header">
                        <strong>${speaker}:</strong>
                        <span class="turn-number">Turn ${Math.floor(index / 2) + 1}</span>
                    </div>
                    <div class="message-content">${turn.content}</div>
                </div>
            `;
        }).join('');
    }
    
    renderGraph() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
        
        if (this.nodes.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('Loading graph data...', width / 2, height / 2);
            return;
        }
        
        // Draw connections first (so they appear behind nodes)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        this.nodes.forEach(node => {
            if (node.parent && node.xy) {
                const parent = this.nodes.find(n => n.id === node.parent);
                if (parent && parent.xy) {
                    const x1 = this.offsetX + parent.xy[0] * this.scale;
                    const y1 = this.offsetY + parent.xy[1] * this.scale;
                    const x2 = this.offsetX + node.xy[0] * this.scale;
                    const y2 = this.offsetY + node.xy[1] * this.scale;
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            if (!node.xy) return;
            
            const x = this.offsetX + node.xy[0] * this.scale;
            const y = this.offsetY + node.xy[1] * this.scale;
            
            // Skip if outside canvas
            if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
            
            const depth = this.getNodeDepth(node);
            const radius = Math.max(3, Math.min(12, 5 + depth));
            
            // Node circle
            ctx.fillStyle = this.getScoreColor(node.score);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Node border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Score text for high-scoring nodes
            if (node.score && node.score > 0.7) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText(node.score.toFixed(2), x, y - radius - 5);
            }
        });
        
        // Draw grid
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 0.5;
        const gridSize = 50;
        for (let x = (this.offsetX % gridSize); x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = (this.offsetY % gridSize); y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw center crosshair
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.offsetX - 10, this.offsetY);
        ctx.lineTo(this.offsetX + 10, this.offsetY);
        ctx.moveTo(this.offsetX, this.offsetY - 10);
        ctx.lineTo(this.offsetX, this.offsetY + 10);
        ctx.stroke();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiverseVisualizer();
});