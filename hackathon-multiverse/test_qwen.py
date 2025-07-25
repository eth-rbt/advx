#!/usr/bin/env python3
"""
Quick test script to verify Qwen integration via OpenRouter.
"""

import asyncio
import os
from backend.llm.openai_client import chat
from backend.config.settings import settings

async def test_qwen():
    """Test Qwen model via OpenRouter."""
    
    print(f"🔧 Settings loaded from .env:")
    print(f"   OpenRouter API Key: {settings.openrouter_api_key[:20]}..." if settings.openrouter_api_key else "   OpenRouter API Key: NOT SET")
    print(f"   Use OpenRouter: {settings.use_openrouter}")
    print(f"   Model: {settings.persona_model}")
    
    if not settings.openrouter_api_key:
        print("❌ OPENROUTER_API_KEY not found in .env file")
        return
    
    print(f"🧪 Testing Qwen model: {settings.persona_model}")
    print(f"🔗 Using OpenRouter: {settings.use_openrouter}")
    
    try:
        # Test enhanced persona
        from backend.agents.persona import call
        from backend.agents.critic import score
        
        print("🧪 Testing Enhanced Putin Persona...")
        test_prompt = "President Putin, how might we build lasting peace between Russia and the West?"
        
        putin_reply = await call(test_prompt)
        print(f"🎯 Putin (Enhanced): {putin_reply}")
        
        # Test enhanced critic scoring
        print("\n🧪 Testing Enhanced Critic Scoring...")
        conversation = [
            {"role": "user", "content": test_prompt},
            {"role": "assistant", "content": putin_reply}
        ]
        
        trajectory_score = await score(conversation)
        print(f"📊 Trajectory Score: {trajectory_score}")
        
        print("\n✅ Enhanced prompts working with Qwen models!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_qwen())