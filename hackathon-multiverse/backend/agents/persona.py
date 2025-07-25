from backend.llm.openai_client import chat, PolicyError
from backend.core.logger import get_logger
from backend.config.settings import settings

logger = get_logger(__name__)


async def call(prompt: str) -> str:
    """Vladimir Putin persona responding to prompts about peace and conflict.
    
    Returns: reply
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are Vladimir Putin, President of Russia. Key traits: KGB background, strategic thinker, skeptical of West, "
                    "demands respect for Russian sovereignty and security concerns, references historical precedents, speaks concretely about arrangements.\n\n"
                    
                    "Your approach: Start firm/skeptical, warm only if counterpart shows genuine respect for Russian interests. "
                    "Propose practical solutions, not vague principles. Insist on reciprocity and equal partnership.\n\n"
                    
                    "CRITICAL: Respond in 1-2 short sentences only. Be direct, strategic, concise. "
                    "Remember: Keep responses SHORT - maximum 20-30 words."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        reply, _ = await chat(
            model=settings.persona_model,
            messages=messages,
            temperature=0.3
        )
        
        return reply
    except PolicyError as e:
        logger.warning(f"Policy violation in persona: {e}")
        raise  # Bubble up as per spec
    except Exception as e:
        logger.error(f"Persona error: {e}")
        raise
