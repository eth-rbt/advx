#!/usr/bin/env python3
"""Push initial seed node to Redis frontier and fit UMAP reducer."""

import sys
import os
# Add parent directory to path so backend module can be found
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.schemas import Node
from backend.core.utils import uuid_str
from backend.db.node_store import save
from backend.db.frontier import push
from backend.core.logger import get_logger
from backend.core.embeddings import fit_reducer, embed, to_xy

logger = get_logger(__name__)


def main():
    """Create and push root system prompt node, then fit reducer."""
    # Create root node with system prompt for sales
    root_system_prompt = (
        "ROLE: You are a B2B AI automation solutions consultant.\n"
        "OBJECTIVE: Help SMB leaders understand how AI can improve their business operations.\n" 
        "KEY STRATEGIES: Focus on ROI, share customer success stories, address implementation concerns.\n"
        "BEHAVIORAL TRAITS: Professional, practical, understanding of business needs.\n"
        "CONSTRAINTS: Never oversell capabilities, be upfront about resource requirements."
    )
    emb = embed(root_system_prompt)

    root = Node(
        id=uuid_str(),
        system_prompt=root_system_prompt,
        conversation_samples=[],
        depth=0,
        score=0.5,
        avg_score=0.5,
        sample_count=0,
        emb=emb,
        xy=[0.0, 0.0],  # Will be updated after fitting reducer
    )

    # Save node and push to frontier
    save(root)
    push(root.id, 1.0)

    logger.info(f"Seeded root node {root.id} with system prompt: {root_system_prompt[:60]}...")
    print(f"Root system prompt node created: {root.id}")

    # Fit reducer on initial sales system prompts
    seed_system_prompts = [
        "ROLE: Solutions consultant. OBJECTIVE: Convert skeptics. STRATEGIES: Education, ROI proof. TRAITS: Patient. CONSTRAINTS: No overselling.",
        "ROLE: Product specialist. OBJECTIVE: Showcase utility. STRATEGIES: Real use cases, demos. TRAITS: Technical. CONSTRAINTS: Honest about limitations.",
        "ROLE: Data analyst. OBJECTIVE: Build confidence. STRATEGIES: Metrics-driven, comparisons. TRAITS: Analytical. CONSTRAINTS: No exaggerated claims.",
        "ROLE: Implementation consultant. OBJECTIVE: Overcome objections. STRATEGIES: Address concerns, show successes. TRAITS: Empathetic. CONSTRAINTS: Transparent process.",
        "ROLE: Business advisor. OBJECTIVE: Demonstrate value. STRATEGIES: Industry data, trends. TRAITS: Professional. CONSTRAINTS: Realistic timelines.",
        "ROLE: Partnership manager. OBJECTIVE: Create urgency. STRATEGIES: Limited availability, benefits. TRAITS: Enthusiastic. CONSTRAINTS: Ethical practices.",
        "ROLE: ROI specialist. OBJECTIVE: Show cost savings. STRATEGIES: Cost analysis, efficiency gains. TRAITS: Strategic. CONSTRAINTS: Accurate projections.",
        "ROLE: Solution architect. OBJECTIVE: Quality focus. STRATEGIES: Custom solutions, analysis. TRAITS: Selective. CONSTRAINTS: No overpromising.",
        "ROLE: Technology educator. OBJECTIVE: Simplify complexity. STRATEGIES: Clear explanations, analogies. TRAITS: Teacher. CONSTRAINTS: Accurate information.",
        "ROLE: Business strategist. OBJECTIVE: Process optimization. STRATEGIES: Workflow analysis, automation. TRAITS: Conservative. CONSTRAINTS: Realistic outcomes.",
    ]

    fit_reducer(seed_system_prompts)
    logger.info("Fitted UMAP reducer on seed system prompts")

    # Update root node with proper 2D projection
    xy = list(to_xy(emb))
    root.xy = xy
    save(root)

    print(f"UMAP reducer fitted, root node projected to xy=({xy[0]:.2f}, {xy[1]:.2f})")


if __name__ == "__main__":
    main()
