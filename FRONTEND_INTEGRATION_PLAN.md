# Frontend Integration Plan

## 1. High Level Data Restructure

### Current State Analysis
After reviewing all components, the current architecture has:
- **Partial centralization**: App.js has `allNodes` state and WebSocket handling
- **Mixed data sources**: Components use both `allNodes` (backend) and local state
- **Inconsistent data flow**: Some panels have their own WebSocket handlers
- **Multiple data formats**: Backend data, example data, and dynamic nodes coexist

### Target Architecture
- **Complete centralization**: All data management in App.js
- **Four core data structures** maintained at App level
- **Unified data flow** to all child components
- **Worker control integration** for backend process management

## 2. Core Data Structures (Updated)

### `allNodes` - Raw Backend Data Storage  
```javascript
// Map<string, RawNode> - centralized storage for all backend nodes
const allNodes = new Map([
  "node123": {
    id: "node123",
    parent: "node456" | null,
    depth: 2,
    score: 0.75,
    prompt: "How can we build trust between nations?",
    reply: "Trust requires consistent actions over time...",
    xy: [0.5, -0.2],
    emb: [0.1, 0.2, ...], // 1536-dim embedding
    timestamp: "2025-01-15T10:30:00Z"
  }
]);
```

### `workerStatus` - Backend Worker State
```javascript  
// Worker process control and status
const workerStatus = {
  status: "running" | "stopped" | "not_started",
  pid: 12345 | null,
  isGenerating: true,
  lastHeartbeat: "2025-01-15T10:30:00Z"
}
```

### `tree` - Hierarchical Structure
```javascript
// TreeNode hierarchy
const tree = {
  id: "root",
  parent: null,
  children: [
    {
      id: "node123",
      parent: TreeNode, // Reference to parent
      children: [TreeNode, TreeNode], // Array of child references
      depth: 1,
      data: RawNode, // Reference to allNodes entry
      // Computed properties
      isRoot: false,
      isLeaf: false,
      siblingIndex: 0,
      childCount: 2,
      descendants: 15
    }
  ],
  depth: 0,
  isRoot: true
}
```

### `graphNodes` - Visualization Data (Generated from tree)
```javascript
// Array<GraphNode> - computed from tree for ForceGraph2D
const graphNodes = [
  {
    id: "node123",
    name: "3", // Display turns/depth
    x: 150, y: 200, // Screen coordinates
    vx: 0, vy: 0, // Velocity
    color: "#4CAF50", // Score-based color
    val: 12, // Node size
    // UI state
    isProcessing: false,
    isHighlighted: false,
    isCollapsed: false,
    isNextTarget: false
  }
];

const graphLinks = [
  {
    source: "node456",
    target: "node123"
  }
];
```

## 3. Current Component Analysis & Required Changes

### Components That Need Data Restructuring

#### **App.js** - Central Data Hub (✅ Partially Complete)
**Current**: Has `allNodes`, WebSocket handler, but still passes mixed data  
**Required**: Complete centralization of all data structures
```javascript
// Target structure:
const [allNodes, setAllNodes] = useState(new Map());
const [tree, setTree] = useState(null);
const [workerStatus, setWorkerStatus] = useState({});
const [systemStatus, setSystemStatus] = useState({});
const [selectedNode, setSelectedNode] = useState(null);
```

#### **LeftSidebar.js** - Panel Coordinator (🔄 Needs Updates)
**Current**: Passes `nodes`, `dynamicNodes`, `allNodes` - mixed data sources  
**Required**: Pass only centralized data structures
```javascript
// Before: nodes={exampleData.nodes} dynamicNodes={dynamicNodes} allNodes={allNodes}
// After: allNodes={allNodes} tree={tree} systemStatus={systemStatus}
```

#### **TreeView.js** - Visualization Engine (🔄 Major Refactor)
**Current**: Manages own backend data, WebSocket, has tree building logic  
**Required**: Pure visualization component consuming tree structure
```javascript
// Remove: All WebSocket handling, backend API calls, data fetching
// Keep: Tree-to-graph conversion, physics simulation, node rendering
// Props: tree, selectedNode, onNodeSelect
```

#### **HomePanel.js** - Analytics Dashboard (🔄 Needs Refactor)
**Current**: Fetches own data via `backendAPI.getGraph()`  
**Required**: Consume centralized `allNodes` and `tree`
```javascript
// Remove: backendAPI calls, data fetching logic
// Props: allNodes, tree, systemStatus
// Compute: Stats from centralized data instead of fresh API calls
```

#### **AnalyticsPanel.js** - Embeddings Visualization (🔄 Major Refactor)
**Current**: Has own WebSocket handler, maintains `backendNodes` state  
**Required**: Pure visualization of centralized data
```javascript
// Remove: WebSocket handling, backendNodes state, API calls
// Props: allNodes, tree  
// Focus: Embedding scatter plots, real-time analytics from props
```

#### **ChatPanel.js** - Conversation Browser (🔄 Needs Updates)
**Current**: Uses mixed `nodes`, `dynamicNodes`, `allNodes` data sources  
**Required**: Single source of truth from centralized data
```javascript
// Remove: Mixed data source logic, condition checks
// Props: allNodes, tree, selectedNode
// Focus: Conversation ranking, threading, selection
```

#### **SettingsPanel.js** - Configuration (✅ Minimal Changes)
**Current**: Uses backend API for settings management  
**Required**: Add worker control integration
```javascript
// Add: Worker start/stop controls alongside existing settings
// Props: workerStatus, onWorkerControl
```

### Supporting Components Analysis

#### **ConversationControls.js** - Process Control (🔄 Major Enhancement)
**Current**: Has generation controls (start/pause/step/seed/reset)  
**Required**: Integrate with new worker control API
```javascript
// Add: Worker status display, worker start/stop
// Integrate: Existing controls with worker management
// Props: workerStatus, onWorkerControl
```

#### **NodeDetailsPanel.js** - Detail View (✅ Minor Updates)  
**Current**: Fetches conversation details via API  
**Required**: Use tree structure for conversation reconstruction
```javascript
// Enhance: Use tree traversal instead of API calls where possible
// Props: selectedNode, tree, allNodes
```

#### **SimulationControls.js** - Physics Controls (✅ No Changes)
**Current**: Controls graph physics simulation  
**Required**: No changes needed - pure UI component

## 4. Backend API - Worker Control

### New Endpoints Added

#### `POST /worker/start`
```javascript
// Request: (none)
// Response:
{
  "status": "started" | "already_running",
  "message": "Parallel worker started successfully",
  "pid": 12345
}
```

#### `POST /worker/stop`  
```javascript
// Request: (none)
// Response:
{
  "status": "stopped" | "not_running", 
  "message": "Parallel worker stopped successfully",
  "pid": 12345
}
```

#### `GET /worker/status`
```javascript
// Request: (none)
// Response:
{
  "status": "running" | "stopped" | "not_started",
  "pid": 12345 | null,
  "message": "Worker is running"
}
```

### Frontend API Methods
```javascript
import backendAPI from './services/BackendAPI';

// Usage:
const startResult = await backendAPI.startWorker();
const stopResult = await backendAPI.stopWorker();
const status = await backendAPI.getWorkerStatus();
```

## 5. Complete Implementation Roadmap

### Phase 1: Core Data Infrastructure (2-3 days)
1. **App.js centralization**
   - Add `workerStatus`, `systemStatus` state
   - Enhance WebSocket handler for all message types
   - Create unified data flow functions
   - Remove redundant state from child components

2. **Data transformation utilities**
   - `buildTreeFromNodes(allNodes)` - hierarchy builder
   - `treeToGraphData(tree)` - visualization converter  
   - `calculateSystemStats(allNodes, tree)` - analytics
   - Worker control integration functions

### Phase 2: Component Data Migration (3-4 days)
1. **TreeView major refactor** (Day 1-2)
   - Remove: WebSocket handling, backend data management
   - Simplify: Accept `tree` prop, pure visualization
   - Enhance: Tree-based positioning, improved physics

2. **Panel components refactor** (Day 2-3)
   - **AnalyticsPanel**: Remove WebSocket, use centralized data
   - **HomePanel**: Remove API calls, compute from props
   - **ChatPanel**: Unify data sources, use tree structure
   - **SettingsPanel**: Add worker controls integration

3. **Control components enhancement** (Day 3-4)
   - **ConversationControls**: Integrate worker start/stop
   - **NodeDetailsPanel**: Use tree traversal for conversations

### Phase 3: System Integration & Testing (2-3 days)
1. **Worker control implementation**
   - Backend API endpoints integration
   - Frontend worker status management
   - Error handling and recovery

2. **End-to-end testing**
   - Data flow integrity verification
   - Real-time update testing
   - Worker lifecycle testing
   - Performance optimization

### Phase 4: Polish & Documentation (1-2 days)
1. **Code cleanup and optimization**
2. **Documentation updates**
3. **Final integration testing**

## 6. Testing Strategy

### Unit Tests
- `buildTreeFromNodes()` function
- `treeToGraphData()` conversion
- Component prop handling
- API endpoint responses

### Integration Tests  
- WebSocket message processing
- Worker start/stop lifecycle
- Data consistency across components
- Real-time updates end-to-end

### Test Data Examples
```javascript
// Mock allNodes data
const mockNodes = new Map([
  ["root", { id: "root", parent: null, depth: 0, score: 0.5, prompt: "...", reply: "..." }],
  ["child1", { id: "child1", parent: "root", depth: 1, score: 0.7, prompt: "...", reply: "..." }],
  ["child2", { id: "child2", parent: "root", depth: 1, score: 0.6, prompt: "...", reply: "..." }]
]);

// Expected tree structure
const expectedTree = {
  id: "root",
  children: [
    { id: "child1", parent: TreeNode, children: [], depth: 1 },
    { id: "child2", parent: TreeNode, children: [], depth: 1 }
  ],
  depth: 0
};
```

## 7. Benefits of This Architecture

1. **Single Source of Truth**: All data flows through App.js
2. **Clear Separation**: Each component has well-defined responsibilities  
3. **Performance**: Efficient data updates and memoization
4. **Maintainability**: Centralized WebSocket and API logic
5. **Testability**: Pure functions for data transformation
6. **Scalability**: Easy to add new components or data consumers

## 8. Updated Migration Strategy

### Risk Assessment & Mitigation
1. **High-risk components**: TreeView (major refactor), AnalyticsPanel (WebSocket removal)
2. **Medium-risk components**: HomePanel, ChatPanel (data source changes)  
3. **Low-risk components**: SettingsPanel, ConversationControls (enhancements)

### Migration Approach
1. **Feature branch development**: Complete all changes in isolated branch
2. **Component-by-component testing**: Unit tests for each refactored component
3. **Integration checkpoints**: Verify data flow at each phase
4. **Fallback mechanisms**: Keep existing APIs working during transition
5. **Performance monitoring**: Track render performance during migration

## 9. Data Structure Requirements Summary

Based on complete component analysis, you need **FOUR** core data types:

### 1. `allNodes` - Map<string, RawNode>
**Purpose**: Single source of truth for all backend conversation data  
**Consumers**: All panels, TreeView (via tree), NodeDetailsPanel  
**Updates**: WebSocket messages, initial data load

### 2. `tree` - TreeNode hierarchy  
**Purpose**: Parent-child relationships for visualization and navigation  
**Consumers**: TreeView (primary), ChatPanel (conversation threading)  
**Updates**: Rebuilt when allNodes changes

### 3. `workerStatus` - Worker control state
**Purpose**: Backend parallel worker process management  
**Consumers**: ConversationControls, SettingsPanel, system status indicators  
**Updates**: Worker API calls, periodic status checks

### 4. `systemStatus` - Application state  
**Purpose**: Connection status, update timing, error states  
**Consumers**: All components (status indicators), LeftSidebar (connection display)  
**Updates**: WebSocket events, API responses, error conditions

This architecture provides complete data centralization while supporting all existing functionality and enabling the new worker control features.