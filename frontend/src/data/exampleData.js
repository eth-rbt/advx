export const exampleData = {
    board: {
        leftTabOpen: false,
        tree: {
            "1": ["2", "3"],
            "2": ["4", "5"],
            "3": ["6"],
            "4": [],
            "5": [],
            "6": []
        },
        priorityQueue: ["2", "5", "6"]
    },
    nodes: {
        "1": {
            id: "1",
            turns: 0,
            prompt: "Root conversation",
            embedding: null,
            score: 100,
            convo: "Starting point for all conversations"
        },
        "2": {
            id: "2",
            turns: 1,
            prompt: "Explore AI ethics",
            embedding: null,
            score: 85,
            convo: "Discussion about AI ethics and implications"
        },
        "3": {
            id: "3",
            turns: 1,
            prompt: "Technical implementation",
            embedding: null,
            score: 90,
            convo: "Technical details and implementation strategies"
        },
        "4": {
            id: "4",
            turns: 2,
            prompt: "Bias in AI systems",
            embedding: null,
            score: 75,
            convo: "Deep dive into AI bias issues and solutions"
        },
        "5": {
            id: "5",
            turns: 2,
            prompt: "Regulation frameworks",
            embedding: null,
            score: 80,
            convo: "Legal and regulatory aspects of AI development"
        },
        "6": {
            id: "6",
            turns: 2,
            prompt: "Performance optimization",
            embedding: null,
            score: 95,
            convo: "Optimizing AI system performance and efficiency"
        }
    }
};

export const nodePositions = {
    "1": { x: 250, y: 200 },
    "2": { x: 150, y: 350 },
    "3": { x: 350, y: 350 },
    "4": { x: 100, y: 500 },
    "5": { x: 200, y: 500 },
    "6": { x: 350, y: 500 }
};