import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import TreeView from './components/TreeView';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import './styles.css';

const App = () => {
    const [activePanel, setActivePanel] = useState(null); // Start with no panel open
    const [selectedNode, setSelectedNode] = useState(null);
    const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);

    const handlePanelChange = (panelName) => {
        setActivePanel(panelName);
    };

    const handleNodeSelect = (nodeData) => {
        setSelectedNode(nodeData);
        setNodeDetailsOpen(true);
    };

    const handleNodeDetailsClose = () => {
        setNodeDetailsOpen(false);
        setSelectedNode(null);
    };

    const isAnyPanelOpen = activePanel !== null;

    return (
        <div className="app">
            <TopBar />
            
            <div className="main-content">
                <LeftSidebar 
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                />

                <TreeView 
                    leftTabOpen={isAnyPanelOpen}
                    onNodeSelect={handleNodeSelect}
                />

                <NodeDetailsPanel 
                    isOpen={nodeDetailsOpen}
                    selectedNode={selectedNode}
                    onClose={handleNodeDetailsClose}
                />
            </div>
        </div>
    );
};

export default App;