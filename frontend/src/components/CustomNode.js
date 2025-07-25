import React from 'react';

const CustomNode = ({ data, selected }) => {
    const handleClick = (e) => {
        e.stopPropagation();
        if (data.onToggle) {
            data.onToggle();
        }
    };

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        if (data.onDoubleClick) {
            data.onDoubleClick();
        }
    };

    return (
        <div 
            className={`custom-node ${data.isPriority ? 'priority' : ''} ${data.isCollapsed ? 'collapsed' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            title={`Click to toggle | Double-click for details | Node ${data.label} - ${data.nodeData?.prompt || 'No prompt'}`}
        >
            {data.label}
            {data.isCollapsed && <span style={{fontSize: '10px', marginLeft: '2px'}}>+</span>}
        </div>
    );
};

export default CustomNode;