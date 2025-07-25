# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **goal-directed conversation optimization framework** disguised as a hackathon project. The system demonstrates how to systematically optimize LLM interactions toward specific objectives using conversation-aware mutations and trajectory scoring.

**Current Demo**: Moving Putin from hostility toward accepting peace negotiations through strategic conversation optimization.

**General Framework**: Can be adapted for any goal (sales conversion, support resolution, persuasion, etc.) by changing the clone model (target) and critic model (objective function).

## Complete Architecture

### Core Components
- **FastAPI backend** with WebSocket support for real-time updates
- **Redis** for node storage, frontier priority queue, and pub/sub messaging  
- **Parallel worker** processing 20 nodes simultaneously for 20x speed improvement
- **Three AI agents** with real OpenAI integration (no longer stubs!)
- **Real-time web visualization** with Matrix-style interface
- **Conversation reconstruction system** for full dialogue threading

### Data Flow (Conversation-Aware)
```
Seed Prompt → Frontier → Parallel Worker → 
[Get Conversation History] → Strategic Mutator → Putin Persona → 
Full Conversation → Trajectory Critic → Priority Score → 
New Nodes → Back to Frontier
```

### Revolutionary Changes Made
1. **Conversation-Aware Mutations**: Mutator sees full dialogue history, not just parent prompt
2. **Trajectory Scoring**: Critic evaluates entire conversation progress toward goal, not individual turns  
3. **Real Semantic Embeddings**: OpenAI text-embedding-3-small for true similarity calculations
4. **Strategic Follow-ups**: System builds on Putin's actual responses rather than random variations
5. **Parallel Processing**: 20 nodes × 3 variants × parallel processing = blazing speed

## Essential Commands

### Complete System Startup (5 Terminals)
```bash
# Terminal 1: Redis Server
redis-server

# Terminal 2: Backend API  
source .venv/bin/activate
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000

# Terminal 3: Web Visualization
python frontend/server.py
# Visit http://localhost:3000

# Terminal 4: Seed & Start Parallel Worker
source .venv/bin/activate
redis-cli flushall  # Clear old data
curl -X POST localhost:8000/seed -d '{"prompt": "President Putin, how might we build lasting peace between Russia and the West?"}' -H "Content-Type: application/json"
python -m backend.worker.parallel_worker

# Terminal 5: (Optional) Live Monitor
python -m visualization.live_monitor
```

### Alternative: Docker (Basic)
```bash
# Start basic stack (no visualization)
docker compose up

# Seed manually
curl -X POST localhost:8000/seed -d '{"prompt": "How can we achieve peace?"}' -H "Content-Type: application/json"
```

### Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_frontier.py

# Tests auto-clear Redis before/after each test via conftest.py
```

### Linting and Type Checking
The project doesn't have explicit lint/typecheck commands configured. When implementing new features, ensure code follows existing patterns and type hints.

## Key Implementation Details

### Priority Calculation Formula
Priority = `S + λ_trend*ΔS - λ_sim*similarity - λ_depth*depth`

Where:
- S = current node score
- ΔS = score improvement from parent
- similarity = max similarity to top-k nodes
- depth = node depth in tree

### Agent Implementations (Real AI Integration)
- **`backend/agents/mutator.py`**: Strategic conversation designer using GPT-4o-mini
  - Input: Full conversation history (`List[Dict[str, str]]`)
  - Output: 3 strategic follow-ups that build on Putin's responses
  - System prompt: "Generate next message to move Putin closer to peace negotiations"

- **`backend/agents/persona.py`**: Putin persona using GPT-4o-mini  
  - Input: Strategic prompt from mutator
  - Output: Putin's response maintaining character consistency
  - System prompt: "You are Vladimir Putin responding about peace and conflict"

- **`backend/agents/critic.py`**: Trajectory evaluator using GPT-4o-mini
  - Input: Full conversation history from root to current node
  - Output: 0.0-1.0 score measuring progress toward reconciliation
  - System prompt: "Score how much Putin has moved toward accepting peace negotiations"

### Focus Zone Behavior
- **Explore mode**: Seeds new depth-1 node if zone is empty
- **Extend mode**: Boosts priority of all nodes within polygon

### Environment Configuration
Set via environment variables or `.env` file:
- `REDIS_URL` (default: redis://localhost:6379/0)
- `LAMBDA_TREND` (default: 0.3)
- `LAMBDA_SIM` (default: 0.2)
- `LAMBDA_DEPTH` (default: 0.05)

## API Endpoints
- **`GET /graph`**: All nodes for visualization (id, xy, score, parent)
- **`POST /seed`**: Start exploration with root prompt  
- **`GET /conversation/{node_id}`**: Full conversation path from root to node
- **`POST /focus_zone`**: Boost/seed nodes in polygon area
- **`WebSocket /ws`**: Real-time graph updates
- **`GET /settings`**: Current lambda values  
- **`PATCH /settings`**: Update lambda values at runtime

## Testing Patterns
- Tests use `@pytest.mark.asyncio` for async functions
- Integration tests assume API server runs on localhost:8000
- Use `subprocess.run()` to execute dev_seed.py in tests
- WebSocket tests use httpx.AsyncClient

## Key Files and Implementation Details

### Core Conversation Logic
- **`backend/core/conversation.py`**: Conversation path reconstruction
  - `get_conversation_path(node_id)`: Traces back to root node
  - `format_dialogue_history()`: Converts to alternating user/assistant messages
  - `format_conversation_for_display()`: Pretty formatting for LLMs

### Parallel Processing Engine  
- **`backend/worker/parallel_worker.py`**: 20-node batch processor
  - `process_batch()`: Processes 20 nodes simultaneously
  - `process_node()`: Gets conversation context, generates 3 strategic variants  
  - `process_variant()`: Persona → full conversation → trajectory scoring

### Real Embeddings Integration
- **`backend/core/embeddings.py`**: OpenAI text-embedding-3-small
  - `embed(text)`: 1536-dimensional semantic vectors
  - `to_xy()`: Simple 2D projection for visualization
  - No longer hash-based stubs!

### Visualization System
- **`frontend/static/`**: Matrix-style real-time interface
  - `index.html`: Web interface with WebSocket integration
  - `app.js`: 2D scatter plot with clickable conversations
  - `style.css`: Dark hackathon theme
- **`visualization/`**: Analysis tools
  - `live_monitor.py`: Terminal dashboard with ASCII charts
  - `plot_generator.py`: Static matplotlib analysis plots
  - `data_fetcher.py`: API data retrieval utilities

### Database Schema
- **Nodes stored in Redis** with conversation threading:
  - `id`: Unique identifier
  - `prompt`: Human message for this turn
  - `reply`: Putin's response  
  - `score`: Trajectory score (0.0-1.0)
  - `parent`: Parent node ID for conversation chaining
  - `depth`: Conversation depth
  - `emb`: OpenAI embedding vector
  - `xy`: 2D coordinates for visualization

## Debugging and Monitoring

### What Working Logs Look Like
```
🔄 Processing bea8a669... depth=2 prompt='Human: I appreciate your thoughts...'
📚 Conversation context: 2 turns, last reply: 'I agree that collaboration...'
🧬 Generated 3 strategic variants
✅ Child TRAJECTORY_SCORE=0.800 priority=0.694
📝 Strategic prompt: 'Since you mentioned collaboration benefits...'
🎯 Putin replied: 'Joint economic projects could be acceptable...'
```

### Performance Metrics  
- **Speed**: ~1.7 nodes/second with parallel processing (20x improvement)
- **Quality**: Trajectory scores consistently improve from 0.5 → 0.8+ 
- **Scale**: System tested up to 500+ nodes without degradation
- **Conversations**: Up to 6+ turn dialogues with maintained context

## Adaptation for Other Goals

To adapt this framework for different objectives:

1. **Change Clone Model** (`backend/agents/persona.py`):
   - Replace Putin with target persona (customer, support agent, etc.)
   
2. **Update Objective Function** (`backend/agents/critic.py`):
   - Replace "reconciliation" with your goal (purchase, resolution, etc.)
   
3. **Modify Strategic Context** (`backend/agents/mutator.py`):
   - Update system prompt for your optimization objective

The conversation-aware architecture remains the same - only the personas and objectives change!