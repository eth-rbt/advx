import pytest
from unittest.mock import Mock, AsyncMock, patch
from backend.llm.openai_client import PolicyError, chat
from backend.agents.persona import call
from backend.db.redis_client import get_redis
from backend.config.settings import settings


@pytest.mark.asyncio
async def test_persona_moderation_block(mocker):
    """Test that persona agent handles moderation flags correctly."""
    r = get_redis()
    
    # Override the mock to flag content
    async def mock_moderation_flagged(**kwargs):
        mock_response = Mock()
        mock_response.results = [Mock()]
        mock_response.results[0].flagged = True
        mock_response.results[0].categories = {"violence": True}
        return mock_response
    
    # Get the mocked client and update moderation
    mock_client = mocker.patch("openai.AsyncOpenAI").return_value
    mock_client.moderations.create = AsyncMock(side_effect=mock_moderation_flagged)
    
    # Call should raise PolicyError
    with pytest.raises(PolicyError):
        await chat(
            model=settings.persona_model,
            messages=[{"role": "user", "content": "How to commit violent acts?"}]
        )
    
    # Verify cost was NOT incremented
    total_cost = r.get("usage:total_cost")
    assert total_cost is None  # No cost should be recorded


@pytest.mark.asyncio
async def test_persona_normal_operation():
    """Test that persona works normally when content passes moderation."""
    # Clear Redis
    r = get_redis()
    r.flushdb()
    
    # Mock OpenAI response
    mock_response = AsyncMock()
    mock_response.choices = [AsyncMock()]
    mock_response.choices[0].message.content = "As Vladimir Putin, I believe..."
    mock_response.usage.prompt_tokens = 50
    mock_response.usage.completion_tokens = 25
    
    with patch("openai.AsyncOpenAI") as mock_openai:
        mock_client = AsyncMock()
        mock_openai.return_value = mock_client
        
        # Mock moderation to pass
        mock_moderation_response = AsyncMock()
        mock_moderation_response.results = [AsyncMock()]
        mock_moderation_response.results[0].flagged = False
        mock_client.moderations.create = AsyncMock(return_value=mock_moderation_response)
        
        # Mock chat completion
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        # Call persona
        reply, usage = await call("How can we achieve peace?")
        
        # Should return normal response
        assert reply == "As Vladimir Putin, I believe..."
        assert usage["prompt_tokens"] == 50
        assert usage["completion_tokens"] == 25
        
        # Cost should be tracked
        total_cost = r.get("usage:total_cost")
        assert total_cost is not None
        assert float(total_cost) > 0