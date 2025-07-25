import asyncio
from typing import Dict, List, Tuple, Optional, Union
import openai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from backend.config.settings import settings
from backend.db.redis_client import get_redis
from backend.core.logger import get_logger

logger = get_logger(__name__)


class PolicyError(Exception):
    """Raised when content violates moderation policy."""
    pass


# Cost per 1K tokens for different models (as of 2024)
COST_PER_1K_TOKENS = {
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    "gpt-3.5-turbo-16k": {"input": 0.001, "output": 0.002},
    # Qwen models via OpenRouter (approximate pricing)
    "qwen/qwen-2.5-72b-instruct": {"input": 0.0009, "output": 0.0009},
    "qwen/qwen-2.5-32b-instruct": {"input": 0.0006, "output": 0.0006},
    "qwen/qwen-2.5-14b-instruct": {"input": 0.0003, "output": 0.0003},
    "qwen/qwen-2.5-7b-instruct": {"input": 0.0002, "output": 0.0002},
}


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate cost in USD for the given token usage."""
    costs = COST_PER_1K_TOKENS.get(model, COST_PER_1K_TOKENS["gpt-3.5-turbo"])
    input_cost = (prompt_tokens / 1000) * costs["input"]
    output_cost = (completion_tokens / 1000) * costs["output"]
    return input_cost + output_cost


async def check_moderation(text: str) -> bool:
    """Check if text violates content policy."""
    # Skip moderation when using OpenRouter (not all providers support it)
    if settings.use_openrouter:
        return False
        
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    
    try:
        response = await client.moderations.create(input=text)
        result = response.results[0]
        
        if result.flagged:
            logger.warning(f"Content flagged by moderation: {result.categories}")
            return True
        return False
    except Exception as e:
        logger.error(f"Moderation check failed: {e}")
        # Fail open - allow content if moderation fails
        return False


def truncate_prompt(messages: List[Dict[str, str]], max_tokens: int = 512) -> List[Dict[str, str]]:
    """Truncate messages to stay within token limit."""
    # Simple truncation - in production would use tiktoken for accurate counting
    truncated = []
    total_chars = 0
    max_chars = max_tokens * 4  # Rough approximation: 1 token ≈ 4 chars
    
    for msg in messages:
        msg_chars = len(msg.get("content", ""))
        if total_chars + msg_chars > max_chars:
            # Truncate this message
            remaining = max_chars - total_chars
            if remaining > 100:  # Only include if meaningful content remains
                truncated_msg = msg.copy()
                truncated_msg["content"] = msg["content"][:remaining] + "..."
                truncated.append(truncated_msg)
                logger.info(f"Truncated message from {msg_chars} to {remaining} chars")
            break
        else:
            truncated.append(msg)
            total_chars += msg_chars
    
    return truncated


async def update_usage_counter(cost: float, prompt_tokens: int, completion_tokens: int, model: str, n: int):
    """Update Redis usage counters."""
    r = get_redis()
    
    # Increment counters
    r.incrbyfloat("usage:prompt_tokens", prompt_tokens)
    r.incrbyfloat("usage:completion_tokens", completion_tokens)
    r.incrbyfloat("usage:total_cost", cost)
    
    # Get new total for logging
    new_total = float(r.get("usage:total_cost") or 0.0)
    
    # Log in exact format specified
    logger.info(
        f"openai call model={model} n={n} pTok={prompt_tokens} "
        f"cTok={completion_tokens} cost=${cost:.3f} total=${new_total:.3f}"
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type((openai.RateLimitError, openai.APIConnectionError))
)
async def chat(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    n: int = 1,
    max_tokens: Optional[int] = None,
    tools: Optional[List[Dict]] = None,
    response_format: Optional[Dict] = None,
) -> Tuple[Union[str, List[str]], Dict[str, any]]:
    """
    • Moderation first; raise PolicyError if flagged (import it in this file).
    • Truncate messages so total tokens ≤ 512 (tokenizer len approximation is OK).
    • Retry (tenacity) on 429/500, max 3 attempts, exponential back-off.
    • Return:
        - reply (str) …… if n == 1
        - replies (list[str]) …… if n > 1
        - usage dict …… {
              "prompt_tokens": int,
              "completion_tokens": int,
              "cost": float   # dollars
          }
    """
    # Check moderation for user messages
    for msg in messages:
        if msg.get("role") == "user":
            if await check_moderation(msg.get("content", "")):
                raise PolicyError(f"Content violates moderation policy")
    
    # Truncate if needed
    messages = truncate_prompt(messages)
    
    # Initialize client (OpenRouter or OpenAI)
    if settings.use_openrouter:
        client = openai.AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url
        )
    else:
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    
    try:
        # Build API call parameters
        api_params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "n": n,
        }
        if max_tokens is not None:
            api_params["max_tokens"] = max_tokens
        if tools is not None:
            api_params["tools"] = tools
            # Force function calling if tools provided
            api_params["tool_choice"] = "auto"
        if response_format is not None:
            api_params["response_format"] = response_format
        
        # Make API call
        response = await client.chat.completions.create(**api_params)
        
        # Extract reply based on whether it's a tool call or regular response
        if tools and response.choices[0].message.tool_calls:
            # Function calling response
            if n == 1:
                reply = response.choices[0].message.tool_calls[0].function.arguments
            else:
                reply = [choice.message.tool_calls[0].function.arguments for choice in response.choices]
        else:
            # Regular text response
            if n == 1:
                reply = response.choices[0].message.content
            else:
                reply = [choice.message.content for choice in response.choices]
        
        # Calculate cost
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        
        # Update Redis counters
        await update_usage_counter(cost, prompt_tokens, completion_tokens, model, n)
        
        usage_dict = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost": cost
        }
        
        return reply, usage_dict
        
    except openai.RateLimitError as e:
        logger.error(f"Rate limit hit: {e}")
        raise
    except openai.APIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat: {e}")
        raise