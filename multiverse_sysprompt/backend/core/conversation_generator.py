import asyncio
from typing import List, Dict, Tuple
from backend.agents.mutator import variants
from backend.agents.persona import call as persona_call
from backend.agents.critic import score as critic_score
from backend.core.logger import get_logger

logger = get_logger(__name__)


async def should_stop_conversation(scores: List[float], min_turns: int = 3) -> Tuple[bool, float]:
    """
    Determine if conversation should stop based on score plateau detection.
    
    Returns:
        (should_stop, final_score)
    """
    if len(scores) < min_turns:
        return False, 0.0
    
    if len(scores) < 3:
        return False, scores[-1] if scores else 0.0
    
    # Look at last 3 scores to detect plateau/decline
    recent_scores = scores[-3:]
    
    # Calculate improvements over last 3 turns
    improvements = [recent_scores[i] - recent_scores[i-1] for i in range(1, len(recent_scores))]
    avg_improvement = sum(improvements) / len(improvements)
    
    # Stop if improvement is minimal (< 5% per turn)
    if avg_improvement < 0.05:
        return True, max(recent_scores)  # Return best recent score
    
    # Stop if very high score achieved (early success)  
    if scores[-1] > 0.85:
        return True, scores[-1]
    
    return False, scores[-1] if scores else 0.0


async def generate_single_conversation(system_prompt: str, scenario: Dict) -> Tuple[List[Dict], float]:
    """
    Generate a single test conversation using the given system prompt.
    
    Args:
        system_prompt: Instructions for the mutator agent
        scenario: Dict with 'opening', 'mood', 'max_turns'
    
    Returns:
        (conversation, final_score)
    """
    conversation = []
    scores = []
    
    # First, generate an opening sales pitch using the system prompt
    opening_pitch = await variants_with_system_prompt(
        system_prompt=system_prompt,
        conversation_history=[],
        k=1
    )
    if not opening_pitch:
        logger.error("Failed to generate opening pitch")
        return [], 0.0
    
    current_user_msg = opening_pitch[0]
    
    min_turns = 3
    max_turns = scenario.get("max_turns", 12)
    
    logger.debug(f"Starting conversation with system prompt: '{system_prompt[:50]}...'")
    
    for turn in range(max_turns):
        try:
            # Get business CEO's response
            investor_response = await persona_call(current_user_msg)
            
            # Add turn to conversation
            conversation.extend([
                {"role": "user", "content": current_user_msg},
                {"role": "assistant", "content": investor_response}
            ])
            
            # Score current conversation state
            current_score = await critic_score(conversation)
            scores.append(current_score)
            
            logger.debug(f"Turn {turn + 1}: Score={current_score:.3f}")
            
            # Check if we should stop (after minimum turns)
            if turn >= min_turns - 1:  # -1 because turn is 0-indexed
                should_stop, final_score = await should_stop_conversation(scores, min_turns)
                if should_stop:
                    logger.debug(f"Conversation stopped at turn {turn + 1}, final score: {final_score:.3f}")
                    return conversation, final_score
            
            # Generate next user message using the system prompt being tested
            # Create a modified variants function call that uses our system prompt
            conversation_for_mutator = conversation.copy()
            
            # Call mutator with our custom system prompt (we'll modify mutator.py to accept this)
            next_messages = await variants_with_system_prompt(
                system_prompt=system_prompt,
                conversation_history=[
                    {"role": "user" if i % 2 == 0 else "assistant", "content": msg["content"]}
                    for i, msg in enumerate(conversation)
                ],
                k=1
            )
            
            if not next_messages:
                logger.warning("No next message generated, stopping conversation")
                break
                
            current_user_msg = next_messages[0]
            
        except Exception as e:
            logger.error(f"Error in conversation turn {turn + 1}: {e}")
            break
    
    # Reached max turns
    final_score = scores[-1] if scores else 0.0
    logger.debug(f"Conversation reached max turns ({max_turns}), final score: {final_score:.3f}")
    return conversation, final_score


async def variants_with_system_prompt(system_prompt: str, conversation_history: List[Dict], k: int) -> List[str]:
    """
    Generate message variants using a custom system prompt.
    This is a temporary function until we modify mutator.py
    """
    from backend.llm.openai_client import chat
    from backend.config.settings import settings
    from backend.core.conversation import format_conversation_for_display
    
    try:
        if not conversation_history:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate an opening message to pitch our B2B automation solution to a business decision maker. Output only the exact message text:"}
            ]
        else:
            conversation_text = format_conversation_for_display(conversation_history)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Current conversation:\n\n{conversation_text}\n\nGenerate the next message. Output only the exact message text:"}
            ]
        
        variant_tasks = [
            chat(model=settings.mutator_model, messages=messages, temperature=0.9)
            for _ in range(k)
        ]
        
        results = await asyncio.gather(*variant_tasks)
        return [reply for reply, _ in results]
        
    except Exception as e:
        logger.error(f"Error generating variants with system prompt: {e}")
        return []


async def generate_test_conversations(system_prompt: str) -> List[Tuple[List[Dict], float]]:
    """
    Generate multiple test conversations to evaluate a system prompt.
    
    Args:
        system_prompt: Instructions for the mutator agent
    
    Returns:
        List of (conversation, score) tuples
    """
    # Predefined test scenarios for consistent evaluation
    test_scenarios = [
        {
            "scenario_type": "cold_outreach",
            "mood": "skeptical_but_listening", 
            "max_turns": 8
        },
        {
            "scenario_type": "portfolio_diversification",
            "mood": "economically_pragmatic",
            "max_turns": 6  
        },
        {
            "scenario_type": "post_rugpull_trauma",
            "mood": "security_focused",
            "max_turns": 10
        }
    ]
    
    logger.info(f"Testing system prompt across {len(test_scenarios)} scenarios")
    
    # Generate conversations for each scenario
    conversation_tasks = [
        generate_single_conversation(system_prompt, scenario)
        for scenario in test_scenarios
    ]
    
    results = await asyncio.gather(*conversation_tasks, return_exceptions=True)
    
    # Filter out exceptions and log results
    successful_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Scenario {i + 1} failed: {result}")
        else:
            conversation, score = result
            successful_results.append((conversation, score))
            logger.debug(f"Scenario {i + 1}: {len(conversation)//2} turns, score={score:.3f}")
    
    return successful_results


async def evaluate_system_prompt(system_prompt: str) -> Dict:
    """
    Comprehensively evaluate a system prompt by generating test conversations.
    
    Args:
        system_prompt: Instructions for the mutator agent
    
    Returns:
        Dict with avg_score, conversation_samples, sample_count, etc.
    """
    try:
        # Generate test conversations
        conversation_results = await generate_test_conversations(system_prompt)
        
        if not conversation_results:
            logger.warning("No successful conversations generated")
            return {
                'avg_score': 0.0,
                'conversation_samples': [],
                'sample_count': 0,
                'success_rate': 0.0,
                'avg_conversation_length': 0.0
            }
        
        # Calculate metrics
        scores = [score for _, score in conversation_results]
        conversations = [conv for conv, _ in conversation_results]
        
        avg_score = sum(scores) / len(scores)
        sample_count = len(conversation_results)
        conversation_lengths = [len(conv) // 2 for conv in conversations]  # Turn count
        avg_length = sum(conversation_lengths) / len(conversation_lengths)
        success_count = sum(1 for score in scores if score > 0.7)  # Threshold for "success"
        success_rate = success_count / len(scores)
        
        # Efficiency bonus: reward shorter successful conversations  
        efficiency_bonus = 0.0
        if success_rate > 0:
            # Bonus for achieving success in fewer turns
            successful_lengths = [conversation_lengths[i] for i, score in enumerate(scores) if score > 0.7]
            if successful_lengths:
                avg_successful_length = sum(successful_lengths) / len(successful_lengths)
                efficiency_bonus = 0.1 * success_rate * max(0, (10 - avg_successful_length) / 10)
        
        final_score = min(1.0, avg_score + efficiency_bonus)
        
        logger.info(f"System prompt evaluation: avg_score={avg_score:.3f}, efficiency_bonus={efficiency_bonus:.3f}, final={final_score:.3f}")
        
        return {
            'avg_score': final_score,
            'conversation_samples': [{'conversation': conv, 'score': score} for conv, score in conversation_results],
            'sample_count': sample_count,
            'success_rate': success_rate,
            'avg_conversation_length': avg_length,
            'base_score': avg_score,
            'efficiency_bonus': efficiency_bonus
        }
        
    except Exception as e:
        logger.error(f"Error evaluating system prompt: {e}")
        return {
            'avg_score': 0.0,
            'conversation_samples': [],
            'sample_count': 0,
            'success_rate': 0.0,
            'avg_conversation_length': 0.0
        }