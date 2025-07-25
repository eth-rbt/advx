# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi:verse is a React-based web application for visualizing and managing conversation trees with an interactive node-based force-directed graph interface. The app uses React ForceGraph 2D for physics-based visualization.

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production (outputs to `dist/`)

### Installation
- `cd frontend && npm install` - Install all dependencies

## Architecture

### Core Components
- **TreeView** (src/components/TreeView.js) - Main visualization component using react-force-graph-2d
  - Handles node physics, collapsing/expanding, dynamic node generation
  - Uses ForceGraph2D with custom canvas rendering for nodes and links
  - Maintains collapsed state and dynamic node creation

- **App** (src/App.js) - Root component managing application state
  - Controls panel visibility and node selection
  - Coordinates between sidebar, tree view, and detail panels

### Data Structure
The application uses a hierarchical conversation tree structure:
- `nodes`: Dictionary mapping node IDs to node objects containing conversation data
- `tree`: Dictionary mapping parent node IDs to arrays of child node IDs  
- `priorityQueue`: Array of node IDs that should be highlighted (golden glow)

### State Management
- Component-level state using React hooks (useState, useRef)
- No global state management library - props passed between components
- Dynamic nodes stored separately from static example data

### Key Features
- Single-click nodes to expand/collapse children
- Double-click nodes to view details panel
- Space key to recenter view
- Dynamic node generation appends to existing tree
- Priority nodes rendered with golden glow effect