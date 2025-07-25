# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AdventureX contains two main applications:

1. **Multi:verse Frontend** (`/frontend/`) - React-based web application for visualizing and managing conversation trees with an interactive node-based force-directed graph interface
2. **Hackathon Multiverse Backend** (`/hackathon-multiverse/`) - AI-powered conversation optimization framework using MCTS and multi-agent orchestration

## Commands

### Frontend (Multi:verse React App)
**Working Directory**: All commands must be run from `frontend/` directory

```bash
# Installation
cd frontend && npm install

# Development
npm run dev        # Start dev server on http://localhost:3000 (auto-opens browser)  
npm start          # Alternative development server command
npm run build      # Build for production (outputs to dist/)
```

### Backend (Hackathon Multiverse)
**Working Directory**: Commands run from `hackathon-multiverse/` directory

```bash
# Complete System Startup (5 Terminals Required)
# Terminal 1: Redis Server
redis-server

# Terminal 2: Backend API  
source .venv/bin/activate
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000

# Terminal 3: Web Visualization
python frontend/server.py  # Visit http://localhost:3000

# Terminal 4: Seed & Start Worker
source .venv/bin/activate
redis-cli flushall
curl -X POST localhost:8000/seed -d '{"prompt": "President Putin, how might we build lasting peace between Russia and the West?"}' -H "Content-Type: application/json"
python -m backend.worker.parallel_worker

# Terminal 5: (Optional) Live Monitor
python -m visualization.live_monitor

# Testing
pytest                           # Run all tests
pytest tests/test_frontier.py    # Run specific test file

# Quick Demo
python scripts/e2e_demo.py      # 3-node demo
python scripts/long_run_demo.py # 100-node parallel exploration
```

## Architecture

### Frontend React App (`/frontend/`)

**Core Components**:
- **TreeView** (`src/components/TreeView.js`) - Main visualization using `react-force-graph-2d`
  - Handles node physics, collapsing/expanding, dynamic node generation
  - Custom canvas rendering for nodes and links with ForceGraph2D
  - Maintains collapsed state and dynamic node creation
  - Auto-pauses simulation after inactivity for performance
  - Space key recenters view with zoom-to-fit

- **App** (`src/App.js`) - Root component managing application state
  - Controls panel visibility and node selection
  - Coordinates between sidebar, tree view, and detail panels  
  - Manages dynamic node generation and positions

**Supporting Components**:
- **LeftSidebar** - Four-icon navigation panel with analytics, chat, home, settings
- **TopBar** - Header with logo and login functionality
- **NodeDetailsPanel** - Shows detailed node information on double-click
- **SimulationControls** - Physics simulation control interface
- **CustomNode** - Custom node rendering component

**Data Structure**:
- `nodes`: Dictionary mapping node IDs to node objects containing conversation data
- `tree`: Dictionary mapping parent node IDs to arrays of child node IDs
- `priorityQueue`: Array of node IDs that should be highlighted (golden glow)

**Build System**:
- **Webpack 5** with hot module replacement for development
- **Babel** transpilation for React JSX  
- **CSS Loader** for styling
- Output directory: `dist/`, dev server on port 3000

**Key Features**:
- Single-click nodes to expand/collapse children with physics repulsion
- Double-click nodes to view details panel
- Space key to recenter view with zoom-to-fit
- Dynamic node generation appends to existing tree
- Priority nodes rendered with golden glow effect
- Canvas-based custom node and link rendering

**Dependencies**:
- **React 18** - Core framework
- **react-force-graph-2d** - Physics-based graph visualization
- **reactflow** - Additional flow components
- Webpack dev environment with Babel for JSX

### Backend System (`/hackathon-multiverse/`)

**Goal-directed conversation optimization framework** that demonstrates systematic optimization of LLM interactions toward specific objectives using conversation-aware mutations and trajectory scoring.

**Core Components**:
- **FastAPI backend** with WebSocket support for real-time updates
- **Redis** for node storage, frontier priority queue, and pub/sub messaging
- **Parallel worker** processing 20 nodes simultaneously  
- **Three AI agents** with OpenAI integration
- **Real-time web visualization** with Matrix-style interface
- **Conversation reconstruction system** for full dialogue threading

**Data Flow**:
```
Seed Prompt → Frontier → Parallel Worker → 
[Get Conversation History] → Strategic Mutator → Putin Persona → 
Full Conversation → Trajectory Critic → Priority Score → 
New Nodes → Back to Frontier
```

**Agent Implementations** (all using GPT-4o-mini):
- **`backend/agents/mutator.py`**: Strategic conversation designer
  - Input: Full conversation history (`List[Dict[str, str]]`)
  - Output: 3 strategic follow-ups building on Putin's responses
  
- **`backend/agents/persona.py`**: Putin persona maintaining character consistency
  - Input: Strategic prompt from mutator
  - Output: Putin's response in character
  
- **`backend/agents/critic.py`**: Trajectory evaluator
  - Input: Full conversation history from root to current node  
  - Output: 0.0-1.0 score measuring progress toward reconciliation

**API Endpoints**:
- **`GET /graph`**: All nodes for visualization
- **`POST /seed`**: Start exploration with root prompt
- **`GET /conversation/{node_id}`**: Full conversation path from root to node
- **`POST /focus_zone`**: Boost/seed nodes in polygon area
- **`WebSocket /ws`**: Real-time graph updates
- **`GET /settings`**: Current lambda values
- **`PATCH /settings`**: Update lambda values at runtime

**Key Features**:
- Conversation-aware mutations that see full dialogue history
- Trajectory scoring evaluating entire conversation progress toward goal
- Real semantic embeddings using OpenAI text-embedding-3-small
- Strategic follow-ups building on actual responses rather than random variations
- Parallel processing: 20 nodes processed simultaneously for 20x speed improvement
- Priority-based expansion with higher-scoring conversation paths processed first

## State Management

### Frontend
- Component-level state using React hooks (useState, useRef)
- No global state management library - props passed between components
- Dynamic nodes stored separately from static example data

### Backend  
- **Nodes stored in Redis** with conversation threading:
  - `id`: Unique identifier
  - `prompt`: Human message for this turn
  - `reply`: Putin's response
  - `score`: Trajectory score (0.0-1.0)  
  - `parent`: Parent node ID for conversation chaining
  - `depth`: Conversation depth
  - `emb`: OpenAI embedding vector
  - `xy`: 2D coordinates for visualization

## Environment Configuration

Backend system uses environment variables or `.env` file:
- `REDIS_URL` (default: redis://localhost:6379/0)
- `LAMBDA_TREND` (default: 0.3)
- `LAMBDA_SIM` (default: 0.2)
- `LAMBDA_DEPTH` (default: 0.05)
- `OPENAI_API_KEY` - Required for AI agent functionality

## Testing Patterns

- Tests use `@pytest.mark.asyncio` for async functions
- Integration tests assume API server runs on localhost:8000
- Use `subprocess.run()` to execute dev_seed.py in tests
- WebSocket tests use httpx.AsyncClient
- Tests auto-clear Redis before/after each test via conftest.py

## Performance Notes

### Frontend
- Force-directed graph auto-pauses simulation after 1 second of inactivity
- Custom canvas rendering for optimal performance with large node counts
- Node positions cached and restored to maintain layout consistency

### Backend
- **Speed**: ~1.7 nodes/second with parallel processing (20x improvement)
- **Quality**: Trajectory scores consistently improve from 0.5 → 0.8+
- **Scale**: System tested up to 500+ nodes without degradation
- **Conversations**: Up to 6+ turn dialogues with maintained context