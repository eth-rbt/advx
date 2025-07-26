import React from 'react';
import HomePanel from './panels/HomePanel';
import AnalyticsPanel from './panels/AnalyticsPanel';
import SettingsPanel from './panels/SettingsPanel';
import ChatPanel from './panels/ChatPanel';

const LeftSidebar = ({ 
    activePanel, 
    onPanelChange, 
    allNodes, 
    tree, 
    systemStatus, 
    workerStatus, 
    computedStats, 
    selectedNode, 
    onWorkerControl 
}) => {
    const [isHovering, setIsHovering] = React.useState(false);
    
    const sidebarIcons = [
        { icon: '👤', name: 'home', title: 'User Profile' },
        { icon: '🎯', name: 'settings', title: 'Grader Model' },
        { icon: '📊', name: 'analytics', title: 'Embeddings' },
        { icon: '💬', name: 'chat', title: 'Top Chats' }
    ];

    const handleIconClick = (panelName) => {
        // Toggle panel - close if already open, open if closed or different panel
        if (activePanel === panelName) {
            onPanelChange(null);
        } else {
            onPanelChange(panelName);
        }
    };

    const handlePanelClose = () => {
        onPanelChange(null);
    };

    const shouldShowSidebar = activePanel || isHovering;

    return (
        <>
            {/* Hover trigger area when sidebar is hidden */}
            <div 
                className="sidebar-trigger" 
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            />
            
            <div 
                className={`left-sidebar ${shouldShowSidebar ? 'visible' : 'hidden'}`}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                {sidebarIcons.map((item, index) => (
                    <div 
                        key={index}
                        className={`sidebar-icon ${activePanel === item.name ? 'active' : ''}`}
                        onClick={() => handleIconClick(item.name)}
                        title={item.title}
                    >
                        {item.icon}
                    </div>
                ))}
            </div>

            <HomePanel 
                isOpen={activePanel === 'home'} 
                onClose={handlePanelClose} 
                allNodes={allNodes}
                tree={tree}
                systemStatus={systemStatus}
                computedStats={computedStats}
            />
            <AnalyticsPanel 
                isOpen={activePanel === 'analytics'} 
                onClose={handlePanelClose} 
                allNodes={allNodes}
                tree={tree}
                computedStats={computedStats}
            />
            <SettingsPanel 
                isOpen={activePanel === 'settings'} 
                onClose={handlePanelClose} 
                workerStatus={workerStatus}
                onWorkerControl={onWorkerControl}
            />
            <ChatPanel 
                isOpen={activePanel === 'chat'} 
                onClose={handlePanelClose} 
                allNodes={allNodes}
                tree={tree}
                selectedNode={selectedNode}
                systemStatus={systemStatus}
            />
        </>
    );
};

export default LeftSidebar;