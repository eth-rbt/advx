# Multi:verse - Build your conversation universe

A React-based web application for visualizing and managing conversation trees with an interactive node-based interface.

## Features

- **Interactive Tree Visualization**: Navigate conversation nodes with Force-Directed Graph physics
- **Priority Queue Highlighting**: Golden glowing nodes for high-priority conversations
- **Physics-Based Node Repulsion**: Nodes push each other away when toggled
- **Collapsible Tree Structure**: Click nodes to expand/collapse children with smooth animations
- **Collapsible Sidebar**: Four-icon navigation panel with transparent overlay  
- **Node Details Panel**: Double-click nodes to view detailed information
- **Modern UI**: Inverted gradient background (blue center, black outside) with custom fonts
- **Responsive Design**: Adapts to different screen sizes

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── TopBar.js          # Header with logo and login
│   │   ├── LeftSidebar.js     # Navigation sidebar with icons
│   │   ├── TreeView.js        # Main tree visualization
│   │   ├── CustomNode.js      # Custom node component
│   │   └── NodeDetailsPanel.js # Node information panel
│   ├── data/
│   │   └── exampleData.js     # Sample conversation data
│   ├── App.js                 # Main application component
│   ├── index.js               # React entry point
│   ├── index.html             # HTML template
│   └── styles.css             # Global styles
├── package.json               # Dependencies and scripts
├── webpack.config.js          # Build configuration
└── README.md                  # This file
```

## Setup Instructions

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   This opens the app at `http://localhost:3000`

3. **Build for Production**
   ```bash
   npm run build
   ```
   Creates optimized build in `dist/` directory

## Data Structure

The app uses a hierarchical data structure:

- **Board**: Contains application state, tree structure, and priority queue
- **Tree**: Dictionary mapping node IDs to their child node arrays
- **Nodes**: Dictionary of node objects with conversation data
- **Node**: Individual conversation with id, turns, prompt, embedding, score, and conversation text

## Usage

- **Navigate**: Use mouse to pan and zoom the force-directed graph
- **Toggle Nodes**: Single-click nodes to expand/collapse their children (physics repulsion activated)
- **Node Details**: Double-click nodes to view detailed information panel
- **Sidebar**: Click any of the 4 icons to toggle the navigation panel
- **Priority Nodes**: Golden glowing nodes with particles indicate priority queue items
- **Physics**: Nodes naturally repel each other and settle into balanced positions

## Technologies Used

- React 18
- React ForceGraph (physics-based tree visualization with D3.js)
- Webpack (bundling)
- Babel (JavaScript transpilation)  
- CSS3 (styling with gradients and animations)
- Canvas API (custom node and link rendering)