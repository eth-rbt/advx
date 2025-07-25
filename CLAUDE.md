# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi:verse is a React-based web application for visualizing and managing conversation trees with an interactive node-based force-directed graph interface. The app uses React ForceGraph 2D for physics-based visualization.

## Commands

### Installation
- `cd frontend && npm install` - Install all dependencies

### Development
- `npm run dev` - Start development server on http://localhost:3000 (auto-opens browser)
- `npm start` - Alternative development server command
- `npm run build` - Build for production (outputs to `dist/`)

### Working Directory
All npm commands must be run from the `frontend/` directory, not the root.

## Architecture

### Core Components
- **TreeView** (src/components/TreeView.js) - Main visualization component using react-force-graph-2d
  - Handles node physics, collapsing/expanding, dynamic node generation
  - Uses ForceGraph2D with custom canvas rendering for nodes and links
  - Maintains collapsed state and dynamic node creation
  - Auto-pauses simulation after 1 second of inactivity for performance
  - Space key recenters view with zoom-to-fit

- **App** (src/App.js) - Root component managing application state
  - Controls panel visibility and node selection
  - Coordinates between sidebar, tree view, and detail panels
  - Manages dynamic node generation and node positions

### Supporting Components
- **LeftSidebar** - Four-icon navigation panel with analytics, chat, home, and settings
- **TopBar** - Header with logo and login functionality
- **NodeDetailsPanel** - Shows detailed node information on double-click
- **SimulationControls** - Physics simulation control interface
- **CustomNode** - Custom node rendering component

### Data Structure
The application uses a hierarchical conversation tree structure:
- `nodes`: Dictionary mapping node IDs to node objects containing conversation data
- `tree`: Dictionary mapping parent node IDs to arrays of child node IDs  
- `priorityQueue`: Array of node IDs that should be highlighted (golden glow)

### State Management
- Component-level state using React hooks (useState, useRef)
- No global state management library - props passed between components
- Dynamic nodes stored separately from static example data

### Build System
- **Webpack 5** with hot module replacement for development
- **Babel** transpilation for React JSX
- **CSS Loader** for styling
- Output directory: `dist/`
- Dev server runs on port 3000

### Key Features
- Single-click nodes to expand/collapse children with physics repulsion
- Double-click nodes to view details panel
- Space key to recenter view with zoom-to-fit
- Dynamic node generation appends to existing tree
- Priority nodes rendered with golden glow effect
- Auto-pause simulation for performance optimization
- Canvas-based custom node and link rendering

### Dependencies
- **React 18** - Core framework
- **react-force-graph-2d** - Physics-based graph visualization
- **reactflow** - Additional flow components
- Webpack dev environment with Babel for JSX