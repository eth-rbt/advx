#!/usr/bin/env python3
"""
Test to debug OpenAI timeout issues - should be using OpenRouter instead.

This test verifies:
1. Settings are loaded correctly from .env 
2. use_openrouter flag is True
3. OpenRouter credentials are available
4. LLM client uses OpenRouter base URL and API key
5. DeepSeek model calls work through OpenRouter
"""

import asyncio
import os
from backend.config.settings import settings
from backend.llm.openai_client import chat
from backend.agents.persona import call as persona_call
from backend.agents.critic import score as critic_score
from backend.agents.mutator import variants as mutator_variants
from backend.core.logger import get_logger

logger = get_logger(__name__)


async def test_settings_configuration():
    """Test that settings are loaded correctly from .env file."""
    print("=== Testing Settings Configuration ===")
    
    # Check .env file exists and is readable
    env_path = "/Users/ethrbt/AdventureX/hackathon-multiverse/.env"
    if not os.path.exists(env_path):
        print(f"❌ .env file not found at {env_path}")
        return False
    
    print(f"✅ .env file exists at {env_path}")
    
    # Check critical settings
    print(f"use_openrouter: {settings.use_openrouter}")
    print(f"openrouter_base_url: {settings.openrouter_base_url}")
    print(f"openrouter_api_key: {'sk-or-v1-...' if settings.openrouter_api_key.startswith('sk-or-v1-') else 'NOT SET'}")
    print(f"persona_model: {settings.persona_model}")
    print(f"critic_model: {settings.critic_model}")
    print(f"mutator_model: {settings.mutator_model}")
    
    # Verify OpenRouter is enabled
    if not settings.use_openrouter:
        print("❌ use_openrouter is False - should be True")
        return False
    
    if not settings.openrouter_api_key:
        print("❌ openrouter_api_key is empty")
        return False
    
    if not settings.openrouter_api_key.startswith('sk-or-v1-'):
        print("❌ openrouter_api_key doesn't start with 'sk-or-v1-'")
        return False
    
    print("✅ OpenRouter settings look correct")
    return True


async def test_direct_llm_call():
    """Test direct LLM call through OpenRouter."""
    print("\n=== Testing Direct LLM Call ===")
    
    try:
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'Hello from OpenRouter' in exactly those words."}
        ]
        
        print(f"Making call to model: {settings.persona_model}")
        print(f"Using OpenRouter: {settings.use_openrouter}")
        print(f"Base URL: {settings.openrouter_base_url}")
        
        reply, usage = await chat(
            model=settings.persona_model,
            messages=messages,
            temperature=0.1
        )
        
        print(f"✅ LLM call succeeded!")
        print(f"Reply: {reply}")
        print(f"Usage: {usage}")
        return True
        
    except Exception as e:
        print(f"❌ LLM call failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return False


async def test_persona_agent():
    """Test persona agent using OpenRouter."""
    print("\n=== Testing Persona Agent ===")
    
    try:
        prompt = "How do you view the current state of Russia-West relations?"
        
        print(f"Calling persona agent with prompt: {prompt}")
        reply = await persona_call(prompt)
        
        print(f"✅ Persona agent succeeded!")
        print(f"Putin reply: {reply}")
        return True
        
    except Exception as e:
        print(f"❌ Persona agent failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return False


async def test_critic_agent():
    """Test critic agent using OpenRouter."""
    print("\n=== Testing Critic Agent ===")
    
    try:
        # Simple 2-turn conversation
        conversation = [
            {"role": "user", "content": "President Putin, how might we build lasting peace?"},
            {"role": "assistant", "content": "Peace requires mutual respect and security guarantees for all parties."}
        ]
        
        print(f"Calling critic agent with conversation: {len(conversation)} turns")
        score = await critic_score(conversation)
        
        print(f"✅ Critic agent succeeded!")
        print(f"Trajectory score: {score}")
        return True
        
    except Exception as e:
        print(f"❌ Critic agent failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return False


async def test_mutator_agent():
    """Test mutator agent using OpenRouter."""
    print("\n=== Testing Mutator Agent ===")
    
    try:
        # Simple conversation history
        conversation_history = [
            {"role": "user", "content": "How can we build trust between our nations?"},
            {"role": "assistant", "content": "Trust comes from consistent actions, not just words."}
        ]
        
        print(f"Calling mutator agent with history: {len(conversation_history)} turns")
        variants = await mutator_variants(conversation_history, k=2)
        
        print(f"✅ Mutator agent succeeded!")
        print(f"Generated {len(variants)} variants:")
        for i, variant in enumerate(variants, 1):
            print(f"  {i}. {variant[:80]}...")
        return True
        
    except Exception as e:
        print(f"❌ Mutator agent failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return False


async def main():
    """Run all tests to diagnose OpenRouter configuration."""
    print("🚀 OpenRouter Configuration Debug Test\n")
    
    results = []
    
    # Test 1: Settings
    results.append(await test_settings_configuration())
    
    # Test 2: Direct LLM call
    results.append(await test_direct_llm_call())
    
    # Test 3: Persona agent
    results.append(await test_persona_agent())
    
    # Test 4: Critic agent
    results.append(await test_critic_agent())
    
    # Test 5: Mutator agent
    results.append(await test_mutator_agent())
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print(f"\n=== Test Summary ===")
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✅ All tests passed! OpenRouter should be working correctly.")
    else:
        print("❌ Some tests failed. Check the error messages above.")
        print("\nCommon issues:")
        print("- OpenRouter API key not set or invalid")
        print("- use_openrouter flag is False")
        print("- Network connectivity issues")
        print("- Model names incorrect for OpenRouter")
    
    return passed == total


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)