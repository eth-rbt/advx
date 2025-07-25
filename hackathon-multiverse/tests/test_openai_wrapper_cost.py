import pytest
import re
from backend.llm.openai_client import chat, calculate_cost
from backend.db.redis_client import get_redis
from backend.config.settings import settings


@pytest.mark.asyncio
async def test_openai_wrapper_cost_tracking(caplog):
    """Test that OpenAI wrapper correctly tracks costs."""
    caplog.set_level("INFO")
    r = get_redis()
    
    # Clear cost counters
    r.delete("usage:total_cost", "usage:prompt_tokens", "usage:completion_tokens")
    
    # Call the chat function
    messages = [{"role": "user", "content": "Hello world"}]
    reply, usage = await chat(settings.persona_model, messages, n=1)
    
    # Verify response (from mock)
    assert reply.startswith("mock-reply")
    assert usage["prompt_tokens"] == 10
    assert usage["completion_tokens"] == 5
    
    # Calculate expected cost for gpt-4o-mini
    # Input: $0.00015/1K, Output: $0.0006/1K
    expected_cost = (10 / 1000) * 0.00015 + (5 / 1000) * 0.0006
    assert usage["cost"] == expected_cost
    
    # Verify Redis was updated
    total_cost = r.get("usage:total_cost")
    assert total_cost is not None
    assert float(total_cost) == expected_cost
    
    # Check token counters
    prompt_tokens = r.get("usage:prompt_tokens")
    completion_tokens = r.get("usage:completion_tokens")
    assert prompt_tokens is not None
    assert completion_tokens is not None
    assert float(prompt_tokens) == 10
    assert float(completion_tokens) == 5
    
    # Check log format
    assert any(re.search(r"openai call model=.* cost=\$\d+\.\d{3}", rec.message) 
               for rec in caplog.records)


@pytest.mark.asyncio
async def test_cost_calculation():
    """Test cost calculation for different models."""
    # Test GPT-4
    cost = calculate_cost("gpt-4", 100, 50)
    expected = (100 / 1000) * 0.03 + (50 / 1000) * 0.06
    assert cost == expected
    
    # Test GPT-3.5-turbo
    cost = calculate_cost("gpt-3.5-turbo", 100, 50)
    expected = (100 / 1000) * 0.0005 + (50 / 1000) * 0.0015
    assert cost == expected
    
    # Test unknown model (should use gpt-3.5-turbo prices)
    cost = calculate_cost("unknown-model", 100, 50)
    expected = (100 / 1000) * 0.0005 + (50 / 1000) * 0.0015
    assert cost == expected