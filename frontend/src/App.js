import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import TreeView from './components/TreeView';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import SimulationControls from './components/SimulationControls';
import { exampleData } from './data/exampleData';
import './styles.css';

const App = () => {
    const [activePanel, setActivePanel] = useState(null); // Start with no panel open
    const [selectedNode, setSelectedNode] = useState(null);
    const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
    const [nodePositions, setNodePositions] = useState({}); // Store all node positions
    const [dynamicNodes, setDynamicNodes] = useState({}); // Store dynamically generated nodes
    const generateNodeRef = React.useRef(null);

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


    const handleGenerateNode = () => {
        if (generateNodeRef.current) {
            generateNodeRef.current();
        }
    };

    return (
        <div className="app">
            <TopBar />
            
            <div className="main-content">
                <LeftSidebar 
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                    nodes={exampleData.nodes}
                    dynamicNodes={dynamicNodes}
                />

                <TreeView 
                    onNodeSelect={handleNodeSelect}
                    onGenerateNode={generateNodeRef}
                    nodePositions={nodePositions}
                    setNodePositions={setNodePositions}
                    dynamicNodes={dynamicNodes}
                    setDynamicNodes={setDynamicNodes}
                />

                <SimulationControls 
                    onGenerateNode={handleGenerateNode}
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