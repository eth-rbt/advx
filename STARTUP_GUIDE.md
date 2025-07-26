# AdventureX Startup Guide

This guide provides step-by-step instructions to get the complete AdventureX system running, including both the React frontend and the AI-powered conversation optimization backend.

## 📋 Prerequisites

### Required Software
- **Node.js** (v16 or higher) - for the React frontend
- **Python** (v3.8 or higher) - for the backend
- **Redis** - for data storage and messaging
- **Git** - for version control

### Environment Setup
```bash
# Install Node.js (if not installed)
# Visit https://nodejs.org/ or use your package manager

# Install Redis (macOS with Homebrew)
brew install redis

# Install Redis (Ubuntu/Debian)
sudo apt-get install redis-server

# Install Redis (Windows)
# Download from https://redis.io/download
```

## 🚀 Complete System Startup (5 Terminal Windows)

### Terminal 1: Start Redis Server
```bash
# Start Redis server
redis-server

# You should see output like:
# Server initialized
# Ready to accept connections
```

### Terminal 2: Backend API Server
```bash
# Navigate to backend directory
cd hackathon-multiverse

# Create and activate Python virtual environment
#python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables (create .env file)
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
echo "REDIS_URL=redis://localhost:6379/0" >> .env

# Start the FastAPI backend server
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000

# Backend will be available at: http://localhost:8000
```

### Terminal 3: Frontend Development Server
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Start the React development server
npm run dev

# Frontend will be available at: http://localhost:3000
# Browser should open automatically
```

### Terminal 4: Initialize & Start AI Worker
```bash
# Navigate to backend directory (if not already there)
cd hackathon-multiverse

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Clear any existing data
redis-cli flushall

# Seed the conversation with initial prompt
curl -X POST localhost:8000/seed \
  -d '{"prompt": "President Putin, how might we build lasting peace between Russia and the West?"}' \
  -H "Content-Type: application/json"

# Start the parallel worker for AI conversation generation
python -m backend.worker.parallel_worker

# You should see: "🔄 Processing nodes..." and conversation generation
```

### Terminal 5: Live Monitor (Optional)
```bash
# Navigate to backend directory
cd hackathon-multiverse

# Activate virtual environment
source .venv/bin/activate

# Start the live monitoring dashboard
python -m visualization.live_monitor

# This provides real-time statistics and progress monitoring
```

## 🎯 Using the System

### Frontend Interface (http://localhost:3000)
1. **Main Graph View**: Interactive force-directed conversation tree
   - **Click nodes** to expand/collapse
   - **Double-click nodes** to view conversation details
   - **Space key** to recenter and zoom-to-fit

2. **Conversation Controls** (top panel):
   - **Seed**: Start new conversation with custom prompt
   - **Start**: Begin continuous AI conversation generation
   - **Pause**: Stop generation (can resume later)
   - **Step**: Generate single conversation turn
   - **Reset**: Clear all data and start fresh

3. **Left Sidebar Panels**:
   - **👤 Home**: Graph statistics and overview
   - **🎯 Settings**: Adjust AI priority parameters
   - **📊 Analytics**: Embedding visualization
   - **💬 Chat**: View top-scoring conversations

### Backend API (http://localhost:8000)
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Graph Data**: http://localhost:8000/graph

## 🔧 Configuration Options

### Environment Variables (.env file in hackathon-multiverse/)
```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional - Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Optional - AI Priority Parameters
LAMBDA_TREND=0.3      # Favor improving conversation trends
LAMBDA_SIM=0.2        # Penalize similar conversations  
LAMBDA_DEPTH=0.05     # Penalize deeper conversations
```

### Frontend Configuration
The frontend automatically connects to `http://localhost:8000` for the backend API. To change this, edit `src/services/BackendAPI.js`:

```javascript
// Change the base URL if backend runs elsewhere
const baseURL = 'http://your-backend-host:8000';
```

## 🛠️ Development Commands

### Frontend Commands (in frontend/)
```bash
npm run dev          # Start development server (with hot reload)
npm run build        # Build for production
npm test             # Run test suite
npm test:watch       # Run tests in watch mode
```

### Backend Commands (in hackathon-multiverse/)
```bash
# Testing
pytest                           # Run all tests
pytest tests/test_frontier.py    # Run specific test file

# Quick Demos
python scripts/e2e_demo.py      # 3-node demonstration
python scripts/long_run_demo.py # 100-node parallel exploration

# Data Management
redis-cli flushall              # Clear all conversation data
```

## 🚨 Troubleshooting

### Common Issues

**1. Redis Connection Error**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis
redis-server
```

**2. OpenAI API Errors**
- Ensure `OPENAI_API_KEY` is set in `.env` file
- Check API key validity at https://platform.openai.com/api-keys
- Verify sufficient API credits

**3. Frontend Can't Connect to Backend**
- Ensure backend is running on port 8000
- Check browser console for CORS errors
- Verify backend URL in `BackendAPI.js`

**4. Python Import Errors**
```bash
# Ensure virtual environment is activated
source .venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

**5. Node.js Dependency Issues**
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📊 System Status Verification

### Check All Services Are Running
1. **Redis**: `redis-cli ping` → Returns "PONG"
2. **Backend**: Visit http://localhost:8000/docs → Shows API documentation
3. **Frontend**: Visit http://localhost:3000 → Shows conversation graph
4. **AI Worker**: Terminal shows "🔄 Processing nodes..."
5. **Monitor**: Terminal shows live statistics (optional)

### Expected Behavior
- Frontend loads with interactive conversation graph
- Backend API documentation accessible
- Conversation nodes appear and grow automatically
- Controls respond to start/pause/step commands
- Sidebar panels load with real backend data

## 🎉 Success!

If all terminals are running without errors and you can see the conversation graph growing with new nodes, the system is working correctly! 

You now have a fully functional AI-powered conversation optimization platform running locally.

## 📞 Need Help?

- **Backend Issues**: Check `hackathon-multiverse/` logs and ensure Python dependencies are installed
- **Frontend Issues**: Check browser console and ensure Node.js dependencies are installed  
- **Integration Issues**: Verify both frontend and backend are running and can communicate
- **AI Issues**: Confirm OpenAI API key is valid and has sufficient credits

---

*Last updated: Based on the completed frontend-backend integration*