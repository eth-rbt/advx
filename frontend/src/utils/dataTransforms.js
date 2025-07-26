/**
 * Data transformation utilities for centralized data management
 */

/**
 * Build tree hierarchy from flat nodes data
 * @param {Map<string, RawNode>} allNodes - Map of all nodes
 * @returns {TreeNode|null} Root tree node or null if no nodes
 */
export const buildTreeFromNodes = (allNodes) => {
  if (!allNodes || allNodes.size === 0) return null;
  
  const nodeMap = new Map();
  const rootNodes = [];
  
  // First pass: create tree nodes with references
  for (const [id, node] of allNodes) {
    nodeMap.set(id, {
      id: node.id,
      parent: null,
      children: [],
      depth: node.depth || 0,
      data: node,
      isRoot: !node.parent,
      isLeaf: false, // Will be calculated
      siblingIndex: 0,
      childCount: 0,
      descendants: 0
    });
  }
  
  // Second pass: build relationships
  for (const [id, node] of allNodes) {
    const treeNode = nodeMap.get(id);
    if (node.parent && nodeMap.has(node.parent)) {
      const parent = nodeMap.get(node.parent);
      parent.children.push(treeNode);
      treeNode.parent = parent;
      treeNode.depth = parent.depth + 1;
      treeNode.siblingIndex = parent.children.length - 1;
    } else {
      rootNodes.push(treeNode);
    }
  }
  
  // Third pass: calculate computed properties
  const calculateDescendants = (node) => {
    node.childCount = node.children.length;
    node.isLeaf = node.children.length === 0;
    node.descendants = node.children.reduce((count, child) => {
      return count + 1 + calculateDescendants(child);
    }, 0);
    return node.descendants;
  };
  
  rootNodes.forEach(calculateDescendants);
  
  // Return single root if exists, otherwise virtual root
  if (rootNodes.length === 1) {
    return rootNodes[0];
  } else if (rootNodes.length > 1) {
    // Create virtual root for multiple roots
    return {
      id: '__virtual_root__',
      parent: null,
      children: rootNodes,
      depth: 0,
      data: null,
      isRoot: true,
      isLeaf: false,
      siblingIndex: 0,
      childCount: rootNodes.length,
      descendants: rootNodes.reduce((sum, root) => sum + root.descendants + 1, 0)
    };
  }
  
  return null;
};

/**
 * Convert tree structure to graph data for ForceGraph2D
 * @param {TreeNode} tree - Root tree node
 * @param {Set<string>} collapsedNodes - Set of collapsed node IDs
 * @returns {{nodes: Array, links: Array}} Graph data
 */
export const treeToGraphData = (tree, collapsedNodes = new Set()) => {
  if (!tree) return { nodes: [], links: [] };
  
  const nodes = [];
  const links = [];
  
  const processNode = (treeNode, parentCollapsed = false) => {
    if (!treeNode || parentCollapsed) return;
    
    const isCollapsed = collapsedNodes.has(treeNode.id);
    const data = treeNode.data;
    
    // Skip virtual root in visualization
    if (treeNode.id !== '__virtual_root__') {
      const graphNode = {
        id: treeNode.id,
        name: data?.depth?.toString() || treeNode.depth.toString() || '0',
        val: 12,
        color: getNodeColor(data?.score || 0),
        nodeData: data,
        treeNode: treeNode,
        isCollapsed: isCollapsed,
        treeDepth: treeNode.depth
      };
      
      // Use existing positions if available
      if (data?.xy && data.xy.length >= 2) {
        graphNode.x = data.xy[0] * 100;
        graphNode.y = data.xy[1] * 100;
      }
      
      nodes.push(graphNode);
      
      // Create link to parent
      if (treeNode.parent && treeNode.parent.id !== '__virtual_root__') {
        links.push({
          source: treeNode.parent.id,
          target: treeNode.id
        });
      }
    }
    
    // Process children if not collapsed
    if (!isCollapsed) {
      treeNode.children.forEach(child => {
        processNode(child, parentCollapsed || isCollapsed);
      });
    }
  };
  
  processNode(tree);
  
  return { nodes, links };
};

/**
 * Get node color based on score
 * @param {number} score - Node score (0-1)
 * @returns {string} HSL color string
 */
const getNodeColor = (score) => {
  if (score === null || score === undefined) return '#888888';
  
  const clampedScore = Math.max(0, Math.min(1, score));
  const hue = clampedScore * 120; // 0=red, 120=green
  return `hsl(${hue}, 70%, 50%)`;
};

/**
 * Calculate system statistics from centralized data
 * @param {Map<string, RawNode>} allNodes - All nodes
 * @param {TreeNode} tree - Tree structure
 * @returns {Object} System statistics
 */
export const calculateSystemStats = (allNodes, tree) => {
  if (!allNodes || allNodes.size === 0) {
    return {
      totalNodes: 0,
      averageScore: 0,
      maxDepth: 0,
      nodesByDepth: {},
      topScoringNode: null,
      treeStats: null
    };
  }
  
  const nodes = Array.from(allNodes.values());
  const scores = nodes.map(n => n.score || 0).filter(s => s > 0);
  
  const stats = {
    totalNodes: allNodes.size,
    averageScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
    maxDepth: nodes.reduce((max, n) => Math.max(max, n.depth || 0), 0),
    nodesByDepth: nodes.reduce((acc, node) => {
      const depth = node.depth || 0;
      acc[depth] = (acc[depth] || 0) + 1;
      return acc;
    }, {}),
    topScoringNode: nodes.reduce((top, node) => 
      (node.score || 0) > (top?.score || 0) ? node : top, null
    )
  };
  
  if (tree) {
    stats.treeStats = {
      totalDescendants: tree.descendants,
      maxBranching: getMaxBranching(tree),
      averageBranching: getAverageBranching(tree)
    };
  }
  
  return stats;
};

/**
 * Get maximum branching factor in tree
 * @param {TreeNode} tree - Root tree node
 * @returns {number} Maximum number of children for any node
 */
const getMaxBranching = (tree) => {
  if (!tree) return 0;
  
  let maxBranching = tree.children.length;
  for (const child of tree.children) {
    maxBranching = Math.max(maxBranching, getMaxBranching(child));
  }
  return maxBranching;
};

/**
 * Get average branching factor in tree
 * @param {TreeNode} tree - Root tree node
 * @returns {number} Average number of children per non-leaf node
 */
const getAverageBranching = (tree) => {
  if (!tree) return 0;
  
  let totalNodes = 0;
  let totalChildren = 0;
  
  const traverse = (node) => {
    totalNodes++;
    totalChildren += node.children.length;
    node.children.forEach(traverse);
  };
  
  traverse(tree);
  
  return totalNodes > 0 ? totalChildren / totalNodes : 0;
};

/**
 * Get conversation path from root to specific node
 * @param {TreeNode} tree - Root tree node
 * @param {string} nodeId - Target node ID
 * @returns {Array<RawNode>} Conversation path
 */
export const getConversationPath = (tree, nodeId) => {
  if (!tree || !nodeId) return [];
  
  const findPath = (node, targetId, path = []) => {
    if (!node) return null;
    
    const newPath = [...path, node];
    
    if (node.id === targetId) {
      return newPath;
    }
    
    for (const child of node.children) {
      const result = findPath(child, targetId, newPath);
      if (result) return result;
    }
    
    return null;
  };
  
  const path = findPath(tree, nodeId);
  return path ? path.map(node => node.data).filter(Boolean) : [];
};