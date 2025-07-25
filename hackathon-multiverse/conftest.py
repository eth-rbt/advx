import pytest
from backend.db.redis_client import get_redis
from unittest.mock import AsyncMock, Mock
import json


@pytest.fixture(autouse=True)
def clear_redis():
    """Clear Redis before each test."""
    r = get_redis()
    r.flushdb()
    yield
    r.flushdb()


@pytest.fixture(autouse=True)
def mock_openai(mocker):
    """Mock all OpenAI endpoints so tests run offline."""
    # Mock chat completions
    async def mock_chat_create(**kwargs):
        n = kwargs.get("n", 1)
        model = kwargs.get("model", "gpt-4o-mini")
        tools = kwargs.get("tools", None)
        
        # Generate mock responses
        if tools:
            # Function calling response
            mock_response = Mock()
            mock_response.choices = []
            for i in range(n):
                choice = Mock()
                choice.message = Mock()
                choice.message.tool_calls = [Mock()]
                choice.message.tool_calls[0].function = Mock()
                choice.message.tool_calls[0].function.arguments = json.dumps({"score": 0.8, "rationale": "Good dialogue"})
                mock_response.choices.append(choice)
        else:
            # Regular text response
            mock_response = Mock()
            mock_response.choices = []
            for i in range(n):
                choice = Mock()
                choice.message = Mock()
                choice.message.content = f"mock-reply-{i}"
                mock_response.choices.append(choice)
        
        # Add usage data
        mock_response.usage = Mock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 5
        
        return mock_response
    
    # Mock moderation
    async def mock_moderation_create(**kwargs):
        mock_response = Mock()
        mock_response.results = [Mock()]
        mock_response.results[0].flagged = False
        mock_response.results[0].categories = {}
        return mock_response
    
    # Apply patches
    mock_client = Mock()
    mock_client.chat.completions.create = AsyncMock(side_effect=mock_chat_create)
    mock_client.moderations.create = AsyncMock(side_effect=mock_moderation_create)
    
    mocker.patch("openai.AsyncOpenAI", return_value=mock_client)
