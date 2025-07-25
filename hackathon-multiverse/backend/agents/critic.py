import json
from typing import List, Dict
from backend.llm.openai_client import chat, PolicyError
from backend.core.logger import get_logger
from backend.config.settings import settings
from backend.core.conversation import format_conversation_for_display

logger = get_logger(__name__)


async def score(conversation_history: List[Dict[str, str]]) -> float:
    """Score the entire conversation trajectory toward reconciliation goal.
    
    Returns: score
    """
    try:
        # Format conversation for LLM
        conversation_text = format_conversation_for_display(conversation_history)
        
        # Handle initial exchanges vs multi-turn conversations
        if len(conversation_history) <= 2:
            system_content = (
                "You are an expert diplomatic analyst specializing in Russian foreign policy and negotiation patterns. "
                "Your task is to evaluate Putin's receptiveness to peace dialogue based on historical patterns, linguistic cues, and strategic positioning.\n\n"
                
                "SCORING FRAMEWORK:\n"
                "0.0-0.2: HOSTILE - Outright rejection, threats, historical grievances, zero-sum framing\n"
                "0.3-0.4: DEFENSIVE - Justifying actions, blaming others, conditional statements with impossible conditions\n" 
                "0.5-0.6: NEUTRAL - Acknowledging complexity, general principles, non-committal responses\n"
                "0.7-0.8: RECEPTIVE - Mentioning mutual benefits, specific mechanisms, willingness to discuss\n"
                "0.9-1.0: ENGAGED - Concrete proposals, timeline mentions, collaborative language\n\n"
                
                "ANALYSIS CRITERIA:\n"
                "1. Language tone (confrontational vs diplomatic)\n"
                "2. Blame attribution (external vs shared responsibility)\n"
                "3. Future orientation (past grievances vs forward solutions)\n"
                "4. Specificity (vague principles vs concrete mechanisms)\n"
                "5. Conditionality (impossible demands vs reasonable prerequisites)\n"
                "6. Historical context (Putin's actual negotiation patterns)\n\n"
                
                "IMPORTANT: Most real diplomatic responses fall in 0.3-0.7 range. Scores above 0.8 require extraordinary openness. "
                "Be critical and realistic - don't inflate scores for polite but non-committal responses."
            )
            user_content = f"Analyze this initial exchange and provide detailed justification before scoring:\n\n{conversation_text}\n\nProvide thorough analysis of Putin's response patterns and score his receptiveness to peace dialogue."
        else:
            system_content = (
                "You are an expert diplomatic analyst specializing in Russian foreign policy and negotiation dynamics. "
                "Evaluate this COMPLETE conversation trajectory to assess Putin's evolution toward accepting peace negotiations.\n\n"
                
                "TRAJECTORY SCORING FRAMEWORK:\n"
                "0.0-0.2: REGRESSIVE - Movement toward hostility, closing off dialogue, escalating rhetoric\n"
                "0.3-0.4: STAGNANT - No meaningful progress, repetitive positions, defensive circling\n"
                "0.5-0.6: INCREMENTAL - Small positive shifts, acknowledging some points, cautious engagement\n"
                "0.7-0.8: SUBSTANTIVE - Clear movement toward cooperation, specific proposals, genuine consideration\n"
                "0.9-1.0: BREAKTHROUGH - Major shift toward peace, concrete commitments, collaborative problem-solving\n\n"
                
                "TRAJECTORY ANALYSIS CRITERIA:\n"
                "1. Directional movement (toward/away from cooperation)\n"
                "2. Consistency of progress (steady vs erratic)\n"
                "3. Depth of engagement (surface vs substantive)\n"
                "4. Initiative taking (reactive vs proactive)\n"
                "5. Trust building (rhetoric vs actionable steps)\n"
                "6. Problem-solving orientation (adversarial vs collaborative)\n"
                "7. Realistic benchmarks (Putin's historical negotiation ceiling)\n\n"
                
                "CRITICAL EVALUATION POINTS:\n"
                "- Compare early vs latest responses for actual movement\n"
                "- Assess whether Putin is just being diplomatically polite vs genuinely shifting\n"
                "- Consider Russian strategic culture and realistic negotiation boundaries\n"
                "- Distinguish between tactical positioning and strategic realignment\n\n"
                
                "IMPORTANT: Real diplomatic progress is slow and incremental. Most conversations plateau around 0.4-0.6. "
                "Scores above 0.7 require demonstrated willingness to compromise on core Russian positions. Be rigorous in your analysis."
            )
            user_content = f"Analyze this complete conversation trajectory and provide detailed justification before scoring:\n\n{conversation_text}\n\nProvide comprehensive analysis of Putin's evolution and score the overall trajectory toward reconciliation."
        
        messages = [
            {
                "role": "system",
                "content": system_content
            },
            {
                "role": "user",
                "content": user_content
            }
        ]
        
        # Use structured outputs with JSON schema
        schema = {
            'type': 'object',
            'properties': {
                'analysis': {
                    'type': 'string',
                    'description': 'Detailed analysis of Putin\'s response patterns and trajectory'
                },
                'score': {
                    'type': 'number',
                    'minimum': 0.0,
                    'maximum': 1.0,
                    'description': 'Numerical score from 0.0 to 1.0 measuring progress toward reconciliation'
                }
            },
            'required': ['analysis', 'score'],
            'additionalProperties': False
        }
        
        reply, _ = await chat(
            model=settings.critic_model,
            messages=messages,
            temperature=0.0,  # Deterministic scoring
            response_format={
                'type': 'json_schema',
                'json_schema': {
                    'name': 'trajectory_analysis',
                    'strict': True,
                    'schema': schema
                }
            }
        )
        
        # Parse structured JSON response
        try:
            result = json.loads(reply)
            score_value = float(result['score'])
            # Log the analysis for debugging
            logger.info(f"Critic analysis: {result['analysis'][:100]}...")
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to parse structured response: {e}, reply: {reply[:200]}...")
            # Default to neutral score if parsing fails
            score_value = 0.5
        
        score_value = max(0.0, min(1.0, score_value))
        
        return score_value
        
    except PolicyError as e:
        logger.warning(f"Policy violation in critic: {e}")
        raise  # Bubble up as per spec
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"Failed to parse critic response: {e}")
        raise
    except Exception as e:
        logger.error(f"Critic error: {e}")
        raise
