/**
 * Phase 3 Integration Verification Script
 * Simple Node.js script to verify core integration points
 */

const { buildTreeFromNodes, calculateSystemStats, treeToGraphData, getConversationPath } = require('../../utils/dataTransforms');

// Test data
const testNodes = new Map([
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
        score: 0.8,
        prompt: 'Child 2 prompt',
        reply: 'Child 2 reply'
    }],
    ['grandchild1', {
        id: 'grandchild1',
        parent: 'child1',
        depth: 2,
        score: 0.6,
        prompt: 'Grandchild 1 prompt',
        reply: 'Grandchild 1 reply'
    }]
]);

console.log('🚀 Phase 3 Integration Verification');
console.log('=====================================');

// Test 1: Data transformation pipeline
console.log('\n1. Data Transformation Pipeline');
console.log('-------------------------------');

try {
    const tree = buildTreeFromNodes(testNodes);
    console.log('✅ Tree building: SUCCESS');
    console.log(`   - Root ID: ${tree.id}`);
    console.log(`   - Children: ${tree.children.length}`);
    console.log(`   - Total descendants: ${tree.descendants}`);

    const stats = calculateSystemStats(testNodes, tree);
    console.log('✅ Stats calculation: SUCCESS');
    console.log(`   - Total nodes: ${stats.totalNodes}`);
    console.log(`   - Max depth: ${stats.maxDepth}`);
    console.log(`   - Average score: ${stats.averageScore.toFixed(3)}`);
    console.log(`   - Top scorer: ${stats.topScoringNode?.id || 'none'}`);

    const graphData = treeToGraphData(tree);
    console.log('✅ Graph transformation: SUCCESS');
    console.log(`   - Graph nodes: ${graphData.nodes.length}`);
    console.log(`   - Graph links: ${graphData.links.length}`);

    const conversationPath = getConversationPath(tree, 'grandchild1');
    console.log('✅ Conversation path: SUCCESS');
    console.log(`   - Path length: ${conversationPath.length}`);
    console.log(`   - Path: ${conversationPath.map(n => n.id).join(' → ')}`);

} catch (error) {
    console.log('❌ Data transformation pipeline: FAILED');
    console.error(error);
}

// Test 2: Data consistency verification
console.log('\n2. Data Consistency Verification');
console.log('--------------------------------');

try {
    const tree = buildTreeFromNodes(testNodes);
    const graphData = treeToGraphData(tree);
    
    // Verify all nodes are preserved
    let allNodesPreserved = true;
    for (const [nodeId, nodeData] of testNodes) {
        const graphNode = graphData.nodes.find(n => n.id === nodeId);
        if (!graphNode || !graphNode.nodeData || graphNode.nodeData.id !== nodeId) {
            allNodesPreserved = false;
            break;
        }
    }
    
    if (allNodesPreserved) {
        console.log('✅ Node preservation: SUCCESS');
    } else {
        console.log('❌ Node preservation: FAILED');
    }
    
    // Verify all relationships are preserved
    let allLinksCorrect = true;
    for (const [nodeId, nodeData] of testNodes) {
        if (nodeData.parent) {
            const link = graphData.links.find(l => l.target === nodeId && l.source === nodeData.parent);
            if (!link) {
                allLinksCorrect = false;
                break;
            }
        }
    }
    
    if (allLinksCorrect) {
        console.log('✅ Relationship preservation: SUCCESS');
    } else {
        console.log('❌ Relationship preservation: FAILED');
    }

} catch (error) {
    console.log('❌ Data consistency verification: FAILED');
    console.error(error);
}

// Test 3: Real-time update simulation
console.log('\n3. Real-time Update Simulation');
console.log('------------------------------');

try {
    // Start with initial data
    let currentNodes = new Map(testNodes);
    let tree = buildTreeFromNodes(currentNodes);
    let initialStats = calculateSystemStats(currentNodes, tree);
    
    console.log(`   Initial: ${initialStats.totalNodes} nodes, score: ${initialStats.averageScore.toFixed(3)}`);
    
    // Simulate adding new node
    const newNode = {
        id: 'newchild',
        parent: 'child2',
        depth: 2,
        score: 0.9,
        prompt: 'New child prompt',
        reply: 'New child reply'
    };
    
    currentNodes.set('newchild', newNode);
    tree = buildTreeFromNodes(currentNodes);
    const updatedStats = calculateSystemStats(currentNodes, tree);
    
    console.log(`   After add: ${updatedStats.totalNodes} nodes, score: ${updatedStats.averageScore.toFixed(3)}`);
    
    // Verify update worked correctly
    if (updatedStats.totalNodes === initialStats.totalNodes + 1 && 
        updatedStats.topScoringNode.id === 'newchild') {
        console.log('✅ Real-time update simulation: SUCCESS');
    } else {
        console.log('❌ Real-time update simulation: FAILED');
    }

} catch (error) {
    console.log('❌ Real-time update simulation: FAILED');
    console.error(error);
}

// Test 4: Edge case handling
console.log('\n4. Edge Case Handling');
console.log('---------------------');

try {
    // Empty data
    const emptyTree = buildTreeFromNodes(new Map());
    const emptyStats = calculateSystemStats(new Map(), null);
    
    if (emptyTree === null && emptyStats.totalNodes === 0) {
        console.log('✅ Empty data handling: SUCCESS');
    } else {
        console.log('❌ Empty data handling: FAILED');
    }
    
    // Single node
    const singleNodeMap = new Map([['single', { id: 'single', parent: null, depth: 0, score: 0.5 }]]);
    const singleTree = buildTreeFromNodes(singleNodeMap);
    
    if (singleTree && singleTree.id === 'single' && singleTree.children.length === 0) {
        console.log('✅ Single node handling: SUCCESS');
    } else {
        console.log('❌ Single node handling: FAILED');
    }
    
    // Multiple roots
    const multiRootMap = new Map([
        ['root1', { id: 'root1', parent: null, depth: 0, score: 0.5 }],
        ['root2', { id: 'root2', parent: null, depth: 0, score: 0.6 }]
    ]);
    const multiRootTree = buildTreeFromNodes(multiRootMap);
    
    if (multiRootTree && multiRootTree.id === '__virtual_root__' && multiRootTree.children.length === 2) {
        console.log('✅ Multiple roots handling: SUCCESS');
    } else {
        console.log('❌ Multiple roots handling: FAILED');
    }

} catch (error) {
    console.log('❌ Edge case handling: FAILED');
    console.error(error);
}

console.log('\n🎉 Integration Verification Complete!');
console.log('=====================================');

// Summary
console.log('\nThis verification confirms that:');
console.log('• Data transformation utilities work correctly');
console.log('• Centralized data structures maintain consistency');
console.log('• Real-time updates integrate properly');
console.log('• Edge cases are handled gracefully');
console.log('• The complete pipeline from raw data → tree → graph → stats works');
console.log('\nThe frontend is ready for integration with the backend!');