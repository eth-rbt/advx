import json
from typing import List, Dict
from backend.llm.openai_client import chat, PolicyError
from backend.core.logger import get_logger
from backend.config.settings import settings
from backend.core.conversation import format_conversation_for_display

logger = get_logger(__name__)


async def score(conversation_history: List[Dict[str, str]]) -> float:
    """Score the entire conversation trajectory toward purchase goal.

    Returns: score
    """
    try:
        # Format conversation for LLM
        conversation_text = format_conversation_for_display(conversation_history)

        # Handle initial exchanges vs multi-turn conversations
        if len(conversation_history) <= 2:
            system_content = (
                "You are an expert sales analyst specializing in customer behavior and sales dynamics. "
                "Your task is to evaluate the customer's likelihood to purchase based on their responses.\n\n"
                "SCORING FRAMEWORK:\n"
                "0.0-0.2: HOSTILE - Outright rejection, completely dismissive, antagonistic\n"
                "0.3-0.4: SKEPTICAL - Standard objections, asking tough questions, showing resistance\n"
                "0.5-0.6: INTERESTED - Asking for more details, considering the opportunity, cautious engagement\n"
                "0.7-0.8: CONVINCED - Expressing genuine interest, discussing logistics, overcoming objections\n"
                "0.9-1.0: READY TO BUY - Asking about purchase process, payment details, immediate action signals\n\n"
                "ANALYSIS CRITERIA:\n"
                "1. Engagement level (dismissive vs asking questions)\n"
                "2. Objection type (fundamental skepticism vs logistical concerns)\n"
                "3. Risk assessment (fear-based vs calculated evaluation)\n"
                "4. Purchase signals (price questions, timing discussions, payment mentions)\n"
                "5. Trust indicators (credibility questions vs skepticism)\n\n"
                "IMPORTANT: Customers are naturally cautious with purchases. Scores above 0.6 require genuine interest signals. "
                "Don't inflate scores for basic politeness or generic responses.\n\n"
                "MULTI-DIMENSIONAL SCORING:\n"
                "Evaluate each dimension separately (0.0-1.0):\n"
                "- Engagement Score: Active participation and question quality\n"
                "- Objection Handling: How well concerns are being addressed\n"
                "- Trust Building: Credibility and rapport established\n"
                "- Purchase Signals: Concrete buying indicators\n"
                "Then provide an overall score based on all dimensions."
            )
            user_content = f"Analyze this initial exchange and score the customer's likelihood to purchase:\n\n{conversation_text}\n\nProvide multi-dimensional analysis and scores for their purchase intent."
        else:
            system_content = (
                "You are an expert sales analyst specializing in customer conversion and purchase behavior. "
                "Evaluate this COMPLETE conversation trajectory to assess the customer's evolution toward making a purchase.\n\n"
                "TRAJECTORY SCORING FRAMEWORK:\n"
                "0.0-0.2: DECLINING - Movement toward rejection, increasing skepticism, walking away\n"
                "0.3-0.4: STAGNANT - No meaningful progress, repetitive objections, stuck in skepticism\n"
                "0.5-0.6: WARMING - Small positive shifts, fewer objections, asking better questions\n"
                "0.7-0.8: CONVERTING - Clear movement toward purchase, logistics discussions, trust building\n"
                "0.9-1.0: CLOSING - Ready to buy, asking about purchase process, commitment signals\n\n"
                "TRAJECTORY ANALYSIS CRITERIA:\n"
                "1. Objection evolution (harder to softer concerns)\n"
                "2. Question quality (skeptical probing to logistics)\n"
                "3. Engagement depth (surface dismissal to detailed discussion)\n"
                "4. Risk perception (high concern to calculated decision)\n"
                "5. Purchase signals (price, timing, process questions)\n"
                "6. Trust indicators (credibility, proof requests)\n\n"
                "CRITICAL EVALUATION POINTS:\n"
                "- Compare early skepticism vs latest responses for actual movement\n"
                "- Distinguish between polite engagement and genuine purchase interest\n"
                "- Look for specific product understanding and knowledge\n"
                "- Assess readiness to take purchasing action\n\n"
                "IMPORTANT: Most customers are naturally cautious. Most sales conversations plateau around 0.3-0.5. "
                "Scores above 0.6 require genuine purchase signals, not just reduced objections.\n\n"
                "MULTI-DIMENSIONAL TRAJECTORY SCORING:\n"
                "Evaluate each dimension's evolution (0.0-1.0):\n"
                "- Engagement Score: From dismissive to actively engaged\n"
                "- Objection Handling: From hard objections to resolved concerns\n"
                "- Trust Building: From skepticism to confidence\n"
                "- Purchase Signals: From rejection to active buying interest\n"
                "Then provide an overall trajectory score based on all dimensions."
            )
            user_content = f"Analyze this complete sales conversation and score the customer's purchase likelihood:\n\n{conversation_text}\n\nProvide multi-dimensional trajectory analysis and scores for their evolution toward making a purchase."

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ]

        # Use structured outputs with JSON schema for multi-dimensional evaluation
        schema = {
            "type": "object",
            "properties": {
                "engagement_score": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "description": "Level of active engagement and interest in the conversation",
                },
                "objection_handling": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "description": "How well objections were addressed and overcome",
                },
                "trust_building": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "description": "Level of trust established with the customer",
                },
                "purchase_signals": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "description": "Strength of buy signals (price questions, timing, payment details)",
                },
                "analysis": {
                    "type": "string",
                    "description": "Detailed analysis of the customer's response patterns and likelihood to purchase",
                },
                "score": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "description": "Overall score from 0.0 to 1.0 measuring purchase likelihood",
                },
            },
            "required": [
                "engagement_score",
                "objection_handling",
                "trust_building",
                "purchase_signals",
                "analysis",
                "score",
            ],
            "additionalProperties": False,
        }

        reply, _ = await chat(
            model=settings.critic_model,
            messages=messages,
            temperature=0.0,  # Deterministic scoring
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "trajectory_analysis",
                    "strict": True,
                    "schema": schema,
                },
            },
        )

        # Parse structured JSON response
        try:
            result = json.loads(reply)
            score_value = float(result["score"])

            # Log the full multi-dimensional analysis for debugging
            logger.info("🎯 CRITIC MULTI-DIMENSIONAL ANALYSIS:")
            logger.info(f"📊 Engagement Score: {result['engagement_score']:.3f}")
            logger.info(f"🛡️ Objection Handling: {result['objection_handling']:.3f}")
            logger.info(f"🤝 Trust Building: {result['trust_building']:.3f}")
            logger.info(f"💰 Purchase Signals: {result['purchase_signals']:.3f}")
            logger.info(f"📈 OVERALL SCORE: {score_value:.3f}")
            logger.info(f"📝 Analysis: {result['analysis']}")

            # Store dimensional scores for potential future use in evolution
            # This could help the system prompt mutator understand what's working
            result["dimensions"] = {
                "engagement": result["engagement_score"],
                "objection_handling": result["objection_handling"],
                "trust": result["trust_building"],
                "purchase_signals": result["purchase_signals"],
            }

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to parse structured response: {e}, reply: {reply}")
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
