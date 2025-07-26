import { 
    buildTreeFromNodes, 
    treeToGraphData, 
    calculateSystemStats, 
    getConversationPath 
} from '../../utils/dataTransforms';

describe('Phase 1: Data Infrastructure Tests', () => {
    
    // Mock data
    const mockNodes = new Map([
        ['root', {
            id: 'root',
            parent: null,
            depth: 0,
            score: 0.5,
            prompt: 'Root prompt',
            reply: 'Root reply'
        }],
        ['child1', {
            id: 'child1',
            parent: 'root',
            depth: 1,
            score: 0.7,
            prompt: 'Child 1 prompt',
            reply: 'Child 1 reply'
        }],
        ['child2', {
            id: 'child2',
            parent: 'root',
            depth: 1,
            score: 0.6,
            prompt: 'Child 2 prompt',
            reply: 'Child 2 reply'
        }],
        ['grandchild1', {
            id: 'grandchild1',
            parent: 'child1',
            depth: 2,
            score: 0.8,
            prompt: 'Grandchild 1 prompt',
            reply: 'Grandchild 1 reply'
        }]
    ]);

    describe('buildTreeFromNodes', () => {
        test('should build correct tree structure', () => {
            const tree = buildTreeFromNodes(mockNodes);
            
            expect(tree).toBeTruthy();
            expect(tree.id).toBe('root');
            expect(tree.children).toHaveLength(2);
            expect(tree.isRoot).toBe(true);
            expect(tree.isLeaf).toBe(false);
        });

        test('should calculate correct tree relationships', () => {
            const tree = buildTreeFromNodes(mockNodes);
            
            const child1 = tree.children.find(c => c.id === 'child1');
            expect(child1).toBeTruthy();
            expect(child1.parent).toBe(tree);
            expect(child1.children).toHaveLength(1);
            expect(child1.depth).toBe(1);
            
            const grandchild1 = child1.children[0];
            expect(grandchild1.id).toBe('grandchild1');
            expect(grandchild1.parent).toBe(child1);
            expect(grandchild1.isLeaf).toBe(true);
            expect(grandchild1.depth).toBe(2);
        });

        test('should handle empty input', () => {
            const emptyMap = new Map();
            const tree = buildTreeFromNodes(emptyMap);
            expect(tree).toBeNull();
        });

        test('should handle multiple roots', () => {
            const multiRootNodes = new Map([
                ['root1', { id: 'root1', parent: null, depth: 0, score: 0.5 }],
                ['root2', { id: 'root2', parent: null, depth: 0, score: 0.6 }]
            ]);
            
            const tree = buildTreeFromNodes(multiRootNodes);
            expect(tree.id).toBe('__virtual_root__');
            expect(tree.children).toHaveLength(2);
        });
    });

    describe('treeToGraphData', () => {
        test('should convert tree to graph format', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const graphData = treeToGraphData(tree);
            
            expect(graphData.nodes).toHaveLength(4);
            expect(graphData.links).toHaveLength(3);
            
            // Check node format
            const rootNode = graphData.nodes.find(n => n.id === 'root');
            expect(rootNode).toBeTruthy();
            expect(rootNode.name).toBe('0'); // depth
            expect(rootNode.val).toBe(12);
            expect(rootNode.nodeData).toBeTruthy();
        });

        test('should handle collapsed nodes', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const collapsedNodes = new Set(['child1']);
            const graphData = treeToGraphData(tree, collapsedNodes);
            
            // child1 should be included but grandchild1 should be excluded
            expect(graphData.nodes.some(n => n.id === 'child1')).toBe(true);
            expect(graphData.nodes.some(n => n.id === 'grandchild1')).toBe(false);
            expect(graphData.links.some(l => l.source === 'child1')).toBe(false);
        });

        test('should handle empty tree', () => {
            const graphData = treeToGraphData(null);
            expect(graphData.nodes).toHaveLength(0);
            expect(graphData.links).toHaveLength(0);
        });
    });

    describe('calculateSystemStats', () => {
        test('should calculate correct statistics', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const stats = calculateSystemStats(mockNodes, tree);
            
            expect(stats.totalNodes).toBe(4);
            expect(stats.averageScore).toBeCloseTo(0.65); // (0.5+0.7+0.6+0.8)/4
            expect(stats.maxDepth).toBe(2);
            expect(stats.nodesByDepth).toEqual({ 0: 1, 1: 2, 2: 1 });
            expect(stats.topScoringNode.id).toBe('grandchild1');
        });

        test('should handle empty data', () => {
            const stats = calculateSystemStats(new Map(), null);
            
            expect(stats.totalNodes).toBe(0);
            expect(stats.averageScore).toBe(0);
            expect(stats.maxDepth).toBe(0);
            expect(stats.topScoringNode).toBeNull();
        });

        test('should include tree statistics', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const stats = calculateSystemStats(mockNodes, tree);
            
            expect(stats.treeStats).toBeTruthy();
            expect(stats.treeStats.totalDescendants).toBe(3); // All nodes except root
            expect(stats.treeStats.maxBranching).toBe(2); // Root has 2 children
        });
    });

    describe('getConversationPath', () => {
        test('should find conversation path', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const path = getConversationPath(tree, 'grandchild1');
            
            expect(path).toHaveLength(3); // root -> child1 -> grandchild1
            expect(path[0].id).toBe('root');
            expect(path[1].id).toBe('child1');
            expect(path[2].id).toBe('grandchild1');
        });

        test('should handle non-existent node', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const path = getConversationPath(tree, 'nonexistent');
            
            expect(path).toHaveLength(0);
        });

        test('should handle root node', () => {
            const tree = buildTreeFromNodes(mockNodes);
            const path = getConversationPath(tree, 'root');
            
            expect(path).toHaveLength(1);
            expect(path[0].id).toBe('root');
        });
    });

    describe('Integration Tests', () => {
        test('should maintain data consistency through transformations', () => {
            // Start with nodes -> build tree -> convert to graph -> check consistency
            const tree = buildTreeFromNodes(mockNodes);
            const graphData = treeToGraphData(tree);
            
            // All original nodes should be represented
            mockNodes.forEach((node, id) => {
                const graphNode = graphData.nodes.find(n => n.id === id);
                expect(graphNode).toBeTruthy();
                expect(graphNode.nodeData.id).toBe(id);
            });
            
            // All parent-child relationships should be preserved
            mockNodes.forEach((node, id) => {
                if (node.parent) {
                    const link = graphData.links.find(l => l.target === id);
                    expect(link).toBeTruthy();
                    expect(link.source).toBe(node.parent);
                }
            });
        });

        test('should handle real-time updates correctly', () => {
            let nodes = new Map(mockNodes);
            let tree = buildTreeFromNodes(nodes);
            let initialStats = calculateSystemStats(nodes, tree);
            
            // Add new node
            const newNode = {
                id: 'newchild',
                parent: 'child2',
                depth: 2,
                score: 0.9,
                prompt: 'New child prompt',
                reply: 'New child reply'
            };
            
            nodes.set('newchild', newNode);
            tree = buildTreeFromNodes(nodes);
            const updatedStats = calculateSystemStats(nodes, tree);
            
            expect(updatedStats.totalNodes).toBe(initialStats.totalNodes + 1);
            expect(updatedStats.topScoringNode.id).toBe('newchild');
            expect(updatedStats.nodesByDepth[2]).toBe(2); // Two nodes at depth 2 now
        });
    });
});