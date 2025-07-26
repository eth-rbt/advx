# Product type to generate sales prompts for
PRODUCT_TYPE = "B2B SAAS for small to medium businesses"  # Change this to generate prompts for different products

import asyncio
from typing import List, Dict
from backend.llm.openai_client import chat, PolicyError
from backend.core.logger import get_logger
from backend.config.settings import settings

logger = get_logger(__name__)


async def mutate_system_prompt(
    parent_prompt: str, performance_data: Dict, k: int
) -> List[str]:
    """Generate k variations of system prompt based on performance feedback.

    Args:
        parent_prompt: The system prompt to mutate
        performance_data: Dict with avg_score, sample_count, etc.
        k: Number of variants to generate

    Returns: list of system prompt variants
    """
    try:
        # Handle initial system prompt (root node case)
        if not parent_prompt:
            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a meta-prompt engineer creating instructions for a {PRODUCT_TYPE} sales agent. "
                        f"Generate diverse system prompts that will guide a sales agent in conversations "
                        f"with potential customers about purchasing {PRODUCT_TYPE}.\n\n"
                        "STRUCTURE GUIDANCE (use this loose format for better evolution):\n"
                        f"1. ROLE: Define who the agent is (e.g., {PRODUCT_TYPE} advisor, product expert, consultant)\n"
                        "2. OBJECTIVE: Clear goal (e.g., secure commitment, build interest, overcome skepticism)\n"
                        "3. KEY STRATEGIES: 2-3 main approaches (e.g., value focus, FOMO, exclusive access)\n"
                        "4. BEHAVIORAL TRAITS: How to act (e.g., consultative, urgent, analytical)\n"
                        "5. CONSTRAINTS: What to avoid (e.g., never lie about returns, don't be pushy)\n\n"
                        "This structure helps evolution - different components can mutate independently.\n"
                        "Be creative within this framework. Explore different combinations.\n\n"
                        "CRITICAL: Output ONLY the exact system prompt text that should be given to "
                        "the sales agent. Do not include explanations or meta-commentary."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Generate an initial system prompt for a sales agent to sell {PRODUCT_TYPE} to potential customers. Output only the system prompt text:",
                },
            ]
        else:
            # Format performance feedback
            performance_text = f"Average Score: {performance_data.get('avg_score', 0.0):.3f}, Conversations Tested: {performance_data.get('sample_count', 0)}"

            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a meta-prompt engineer optimizing instructions for a {PRODUCT_TYPE} sales agent. "
                        "Given a system prompt and its performance data, generate improved variants.\n\n"
                        "EVOLUTION STRATEGIES:\n"
                        "1. Component Mutation: Change individual parts (role, strategies, traits)\n"
                        "2. Recombination: Mix successful elements from parent\n"
                        "3. Amplification: Strengthen what's working (based on score)\n"
                        "4. Innovation: Introduce novel approaches\n\n"
                        "MAINTAIN STRUCTURE for better evolution:\n"
                        "1. ROLE: Who the agent is\n"
                        "2. OBJECTIVE: Clear goal\n"
                        "3. KEY STRATEGIES: Main approaches\n"
                        "4. BEHAVIORAL TRAITS: How to act\n"
                        "5. CONSTRAINTS: What to avoid\n\n"
                        "MUTATION FOCUS AREAS:\n"
                        "- Value props: Benefits, utility, unique features, quality\n"
                        "- Objection handling: Price concerns, need validation, alternatives\n"
                        "- Psychology: Urgency, social proof, exclusivity, risk mitigation\n"
                        "- Communication: Analytical, consultative, urgent, educational\n\n"
                        "Generate variants that evolve based on what's working/failing.\n\n"
                        "CRITICAL: Output ONLY the exact system prompt text. No explanations."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Parent sales prompt: '{parent_prompt}'\n"
                        f"Performance: {performance_text}\n\n"
                        "Generate an improved variant of this sales system prompt. "
                        "Output only the system prompt text, no explanations:"
                    ),
                },
            ]

        # Generate multiple variants concurrently
        variant_tasks = []
        for i in range(k):
            variant_tasks.append(
                chat(
                    model=settings.mutator_model,
                    messages=messages,
                    temperature=0.9,  # High temperature for creativity in system prompt space
                )
            )

        # Execute all calls concurrently
        results = await asyncio.gather(*variant_tasks)
        variant_list = [reply for reply, _ in results]

        # Log the full responses for debugging
        if parent_prompt:
            logger.info(
                f"🧬 SYSTEM PROMPT EVOLUTION ({len(variant_list)} variants from parent score {performance_data.get('avg_score', 0.0):.3f}):"
            )
        else:
            logger.info(f"🌱 INITIAL SYSTEM PROMPTS ({len(variant_list)} variants):")

        for i, variant in enumerate(variant_list, 1):
            logger.info(f"📋 Variant {i}: {variant}")

        return variant_list

    except PolicyError as e:
        logger.warning(f"Policy violation in system prompt mutator: {e}")
        raise  # Bubble up as per spec
    except Exception as e:
        logger.error(f"System prompt mutator error: {e}")
        raise


async def generate_initial_system_prompts(k: int = 3) -> List[str]:
    """Generate initial system prompts for seeding the exploration with no constraints."""

    # Generate all prompts from scratch - no base templates
    # Let the system discover what works through pure evolution
    return await mutate_system_prompt("", {}, k)
