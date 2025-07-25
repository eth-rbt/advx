import React from 'react';
import HomePanel from './panels/HomePanel';
import AnalyticsPanel from './panels/AnalyticsPanel';
import SettingsPanel from './panels/SettingsPanel';
import ChatPanel from './panels/ChatPanel';

const LeftSidebar = ({ activePanel, onPanelChange }) => {
    const [isHovering, setIsHovering] = React.useState(false);
    
    const sidebarIcons = [
        { icon: '🏠', name: 'home', title: 'Home' },
        { icon: '📊', name: 'analytics', title: 'Analytics' },
        { icon: '⚙️', name: 'settings', title: 'Settings' },
        { icon: '💬', name: 'chat', title: 'Chat' }
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

            <HomePanel isOpen={activePanel === 'home'} onClose={handlePanelClose} />
            <AnalyticsPanel isOpen={activePanel === 'analytics'} onClose={handlePanelClose} />
            <SettingsPanel isOpen={activePanel === 'settings'} onClose={handlePanelClose} />
            <ChatPanel isOpen={activePanel === 'chat'} onClose={handlePanelClose} />
        </>
    );
};

export default LeftSidebar;