import asyncio
from typing import List, Dict
from backend.llm.openai_client import chat, PolicyError
from backend.core.logger import get_logger
from backend.config.settings import settings
from backend.core.conversation import format_conversation_for_display

logger = get_logger(__name__)


async def variants(
    conversation_history: List[Dict[str, str]], k: int, system_prompt: str = None
) -> List[str]:
    """Generate k strategic variations based on full conversation context.

    Args:
        conversation_history: Previous conversation turns
        k: Number of variants to generate
        system_prompt: Dynamic system prompt for the mutator (if None, uses default)

    Returns: list_of_variants
    """
    try:
        # Use dynamic system prompt - no fallback allowed
        if system_prompt is None:
            raise ValueError(
                "System prompt is required - no default fallback available"
            )

        # Handle empty conversation (root node case)
        if not conversation_history:
            messages = [
                {
                    "role": "system",
                    "content": system_prompt
                    + "\n\nFor initial messages, generate thoughtful opening messages to start the conversation.",
                },
                {
                    "role": "user",
                    "content": "Generate an opening message to begin the conversation. Output only the exact message text, no explanations:",
                },
            ]
        else:
            # Format conversation for LLM
            conversation_text = format_conversation_for_display(conversation_history)

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Current conversation:\n\n{conversation_text}\n\nGenerate the next strategic message. Output only the exact message text, no explanations or options:",
                },
            ]

        # Make multiple separate calls since Qwen doesn't support n parameter properly
        variant_tasks = []
        for i in range(k):
            variant_tasks.append(
                chat(
                    model=settings.mutator_model,
                    messages=messages,
                    temperature=0.9,  # Higher temperature for more creativity
                )
            )

        # Execute all calls concurrently
        results = await asyncio.gather(*variant_tasks)
        variant_list = [reply for reply, _ in results]

        # Log the full responses for debugging
        logger.info(f"💼 SALES AGENT RESPONSES ({len(variant_list)} variants):")
        for i, variant in enumerate(variant_list, 1):
            logger.info(f"📞 Variant {i}: {variant}")

        return variant_list

    except PolicyError as e:
        logger.warning(f"Policy violation in mutator: {e}")
        raise  # Bubble up as per spec
    except Exception as e:
        logger.error(f"Mutator error: {e}")
        raise
