# Hackathon Multiverse

AI-powered prompt exploration system using MCTS and multi-agent orchestration.

## Complete System Startup Guide

### Prerequisites

- Python 3.11+ with virtual environment
- Redis server installed
- OpenAI API key set in `.env` file

### Step-by-Step Launch Sequence

**Terminal 1: Start Redis Server**

```bash
redis-server
# Should show "Ready to accept connections"
```

**Terminal 2: Start Backend API**

```bash
cd /Users/matthieuhuss/AdventureX-Final/hackathon-multiverse
source .venv/bin/activate
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

**Terminal 3: Start Web Visualization**

```bash
cd /Users/matthieuhuss/AdventureX-Final/hackathon-multiverse
python frontend/server.py
# Visit http://localhost:3000 to see the visualization
```

**Terminal 4: Seed the System & Start Worker**

```bash
cd /Users/matthieuhuss/AdventureX-Final/hackathon-multiverse
source .venv/bin/activate

# Clear any old data and seed a conversation
redis-cli flushall
curl -X POST localhost:8000/seed -d '{"prompt": "President Putin, how might we build lasting peace between Russia and the West?"}' -H "Content-Type: application/json"

# Start the parallel worker
python -m backend.worker.parallel_worker
```

**Terminal 5: (Optional) Live Terminal Monitor**

```bash
cd /Users/matthieuhuss/AdventureX-Final/hackathon-multiverse
python -m visualization.live_monitor
```

### What You'll See

1. **Web Interface (localhost:3000)**: Matrix-style real-time visualization showing:
   - Semantic space exploration with colored nodes (red=hostile, green=progress)
   - Live statistics (total nodes, avg trajectory score, max depth)
   - Real-time activity log of new nodes being created
   - Clickable "Best Conversations" showing highest-scoring dialogue paths
2. **Worker Terminal**: Strategic conversation processing with logs like:

   ```
   🔄 Processing node depth=2 prompt='Human: I appreciate your thoughts...'
   📚 Conversation context: 2 turns, last reply: 'I agree that collaboration...'
   🧬 Generated 3 strategic variants
   ✅ Child created TRAJECTORY_SCORE=0.800 priority=0.694
   ```

3. **Terminal Monitor**: ASCII dashboard with growth charts and real-time stats

### Quick Docker Alternative

**Start basic stack (without visualization)**

```bash
docker compose up --build
```

**Seed a root node**

```bash
curl -X POST localhost:8000/seed -d '{"prompt": "How can we achieve lasting peace?"}' -H "Content-Type: application/json"
```

## For UI Developers

The backend provides a simple REST + WebSocket API:

1. **GET /graph** - Get all nodes for initial canvas rendering
2. **POST /seed** - Start exploration with a root prompt
3. **POST /focus_zone** - Boost/seed nodes in a polygon area
4. **WebSocket /ws** - Real-time updates as new nodes are created

**Example UI Integration:**

1. `GET /graph` once → draw initial points
2. Open WebSocket and incrementally add nodes
3. `POST /focus_zone` or `/seed` when user interacts

## Demo & Testing

**Quick demo (3 nodes):**

```bash
python scripts/e2e_demo.py
```

**100-node PARALLEL exploration with blazing speed:**

```bash
# Make sure system is running (see Complete System Startup Guide above)
# Then run analysis script:
python scripts/long_run_demo.py
```

**Analyze exploration patterns:**

```bash
python scripts/exploration_analyzer.py
```

**Run integration test:**

```bash
pytest tests/test_roundtrip.py -v
```

The long-run demo is perfect for observing AI exploration patterns over time with detailed agent logs and statistics.

## What You'll Observe

- **Strategic Conversation Optimization**: AI system learns to move Putin from hostility toward peace negotiations
- **Live exploration**: Watch nodes appear in real-time as AI explores different conversational angles
- **Semantic space positioning**: Nodes positioned in 2D space based on OpenAI embeddings
- **Conversation-aware mutations**: Strategic follow-ups that build on Putin's actual responses
- **Trajectory scoring**: Full conversations scored toward reconciliation goal (0.0=hostile, 1.0=ready for peace)
- **Tree structure**: Parent-child relationships showing conversation depth and branching
- **Priority-based expansion**: Higher-scoring conversation paths get processed first
- **Parallel processing**: 20 nodes processed simultaneously for 20x speed improvement
- **Real-time metrics**: Velocity tracking shows nodes/second generation rate
- **Interactive conversations**: Click any high-scoring conversation to see the full Human↔Putin dialogue

## Key Features

### Goal-Directed Optimization Framework

This system demonstrates a general framework for optimizing LLM interactions toward specific objectives:

- **Clone Model**: Target LLM to influence (Putin persona)
- **Judge Model**: Objective function scoring progress toward goal (reconciliation critic)
- **Mutator**: Strategic prompt generation based on conversation history
- **Exploration**: MCTS-inspired priority system balances exploitation vs exploration

### Real-Time Visualization

- **Matrix-style interface** showing semantic exploration in 2D space
- **Color-coded nodes** by trajectory score (red=hostile, orange=neutral, green=progress)
- **Live activity feed** with emoji-enhanced logging
- **Best conversations panel** with clickable dialogue viewers
- **WebSocket integration** for real-time updates as conversations evolve

License: MIT
