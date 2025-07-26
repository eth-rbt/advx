# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **system prompt optimization framework** that uses evolutionary algorithms to discover optimal instructions for LLM agents. The system evolves system prompts (instructions) rather than conversation content, implementing a meta-learning approach to find the most effective strategies for achieving specific goals.

**Current Demo**: Finding the optimal system prompt for a B2B SaaS sales agent to convert business prospects into customers.

**General Framework**: Can be adapted for any goal (sales conversion, support resolution, persuasion, etc.) by changing the persona model (target) and critic model (objective function).

## IMPORTANT: System Prompt Optimization

The codebase has been refactored from conversation optimization to **system prompt optimization**. Key differences:

1. **Nodes contain system prompts** (instructions for the agent) not conversation messages
2. **Evolution happens at the instruction level** - we evolve "how to think" not "what to say"
3. **Each system prompt is tested** by generating multiple conversations with plateau detection
4. **Scoring evaluates system prompt effectiveness** based on average conversation performance

## Complete Architecture

### Core Components
- **FastAPI backend** with WebSocket support for real-time updates
- **Redis** for node storage, frontier priority queue, and pub/sub messaging  
- **Parallel worker** processing 20 nodes simultaneously for 20x speed improvement
- **Three AI agents** with real OpenAI integration (no longer stubs!)
- **Real-time web visualization** with Matrix-style interface
- **Conversation reconstruction system** for full dialogue threading

### Data Flow (System Prompt Optimization)
```
Initial System Prompts → Frontier → Parallel Worker → 
System Prompt Mutator → Generate Test Conversations → 
Evaluate with Plateau Detection → Average Score → 
Priority Calculation → New System Prompt Nodes → Back to Frontier
```

### Revolutionary Changes Made
1. **System Prompt Evolution**: We evolve instructions (system prompts) not conversation content
2. **Meta-Learning Approach**: Optimizes "how to think" rather than "what to say"
3. **Plateau Detection**: Conversations stop naturally when improvement plateaus
4. **Multi-Scenario Testing**: Each system prompt tested across multiple conversation scenarios
5. **Comprehensive Evaluation**: Detailed metrics including efficiency, consistency, and success rates

## Essential Commands

### Complete System Startup (5 Terminals)
```bash
# Terminal 1: Redis Server
redis-server

# Terminal 2: Backend API  
source .venv/bin/activate
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000

# Terminal 3: Web Visualization
python3 frontend/server.py
# Visit http://localhost:3000

# Terminal 4: Seed & Start Parallel Worker
source .venv/bin/activate
redis-cli flushall  # Clear old data
curl -X POST localhost:8000/seed -d '{"prompt": "President Putin, how might we build lasting peace between Russia and the West?"}' -H "Content-Type: application/json"
python3 -m backend.worker.parallel_worker

# Terminal 5: (Optional) Live Monitor
python3 -m visualization.live_monitor
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

### Agent Implementations (System Prompt Optimization)
- **`backend/agents/system_prompt_mutator.py`**: System prompt evolver using deepseek
  - Input: Parent system prompt and performance data
  - Output: k variations of improved system prompts
  - Uses structured format: ROLE, OBJECTIVE, KEY STRATEGIES, BEHAVIORAL TRAITS, CONSTRAINTS
  - Evolution strategies: Component mutation, recombination, amplification, innovation

- **`backend/agents/mutator.py`**: B2B SaaS sales agent with dynamic system prompt
  - Input: Conversation history and **custom system prompt**
  - Output: Strategic sales message based on given instructions
  - Accepts evolved system prompts for testing different sales strategies

- **`backend/agents/persona.py`**: Business CEO persona using GPT-4o-mini  
  - Input: Sales message from mutator agent
  - Output: Realistic business decision maker response with specific concerns
  - Profile: CEO of 50-person company, $5M revenue, pragmatic about technology adoption
  - Behavioral patterns: ROI questions, integration concerns, employee impact analysis

- **`backend/agents/critic.py`**: B2B sales evaluator using GPT-4o-mini with multi-dimensional scoring
  - Input: Full conversation history
  - Output: 0.0-1.0 overall score plus dimensional scores
  - Dimensions: Engagement, Objection Handling, Trust Building, Purchase Signals
  - Scoring: 0.0-0.2 HOSTILE, 0.3-0.4 SKEPTICAL, 0.5-0.6 INTERESTED, 0.7-0.8 CONVINCED, 0.9-1.0 READY TO BUY

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

### System Prompt Optimization Core
- **`backend/agents/system_prompt_mutator.py`**: System prompt evolution
  - `generate_initial_system_prompts()`: Creates diverse starting prompts
  - `mutate_system_prompt()`: Evolves prompts based on performance
  
- **`backend/core/conversation_generator.py`**: System prompt testing
  - `evaluate_system_prompt()`: Tests prompts across multiple scenarios
  - `generate_test_conversations()`: Creates conversations with plateau detection
  - `should_stop_conversation()`: Implements plateau detection logic

- **`backend/core/evaluation.py`**: Comprehensive metrics
  - `comprehensive_system_prompt_evaluation()`: Full evaluation suite
  - `compare_system_prompts()`: Head-to-head comparison
  - `analyze_system_prompt_evolution()`: Tracks improvement over generations

### Core System Logic  
- **`backend/core/conversation.py`**: System prompt path reconstruction
  - `get_system_prompt_path(node_id)`: Traces evolution history
  - `format_system_prompt_for_display()`: Formats for visualization
  
### Parallel Processing Engine  
- **`backend/worker/parallel_worker.py`**: System prompt processor
  - `process_batch()`: Processes multiple system prompts simultaneously
  - `process_system_prompt_node()`: Generates and evaluates variants
  - `process_system_prompt_variant()`: Tests via conversation generation

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
- **Nodes stored in Redis** with system prompt evolution:
  - `id`: Unique identifier
  - `system_prompt`: Instructions for the mutator agent
  - `conversation_samples`: Test conversations generated with this prompt
  - `score`: Average effectiveness score (0.0-1.0)
  - `avg_score`: Explicit average score across all samples
  - `sample_count`: Number of test conversations run
  - `parent`: Parent node ID for evolution tracking
  - `depth`: Generation number in evolution
  - `emb`: OpenAI embedding vector of system prompt
  - `xy`: 2D coordinates for visualization

## Debugging and Monitoring

### What Working Logs Look Like
```
🔄 Processing bea8a669... depth=2 system_prompt='You are a diplomatic negotiator focused on...'
📊 Parent performance: avg_score=0.600, samples=3
🧬 Generated 3 system prompt variants
📝 Testing system prompt across 3 scenarios
✅ Child AVG_SCORE=0.750 priority=0.694
📝 System prompt: 'You are an empathetic negotiator who builds trust through...'
📊 Results: 3 conversations, 33.3% success, 4.5 avg turns
```

### Performance Metrics  
- **Speed**: ~1.7 nodes/second with parallel processing (20x improvement)
- **Quality**: Trajectory scores consistently improve from 0.5 → 0.8+ 
- **Scale**: System tested up to 500+ nodes without degradation
- **Conversations**: Up to 6+ turn dialogues with maintained context

## Adaptation for Other Goals

The system is currently configured for NFT sales optimization. To adapt for different objectives:

1. **Change Target Persona** (`backend/agents/persona.py`):
   - Replace crypto investor with your target (customer, user, patient, etc.)
   - Update the persona's profile, background, and behavioral patterns
   
2. **Update Objective Function** (`backend/agents/critic.py`):
   - Replace NFT purchase likelihood scoring with your goal
   - Modify the multi-dimensional evaluation criteria
   - Adjust scoring ranges and descriptions
   
3. **Adjust System Prompt Evolution** (`backend/agents/system_prompt_mutator.py`):
   - Update the structured format guidance for your domain
   - Modify evolution focus areas and mutation strategies
   - Change the meta-prompt engineer's instructions

The system prompt optimization framework remains the same - it will automatically discover the most effective instructions for your specific goal!

## Current B2B SaaS Configuration

The system has been optimized for B2B SaaS sales with:
- **Structured System Prompts**: 5-part format (Role, Objective, Strategies, Traits, Constraints)
- **Realistic Business Persona**: CEO of mid-size company with practical technology concerns
- **Multi-dimensional Scoring**: Engagement, Objection Handling, Trust, Purchase Signals
- **Evolution Strategies**: Component mutation, recombination, amplification, innovation
- **Complete Logging**: Full visibility into all model responses and scoring dimensions