"""
Enhanced evaluation framework for system prompt optimization.
Provides advanced metrics, analysis, and comparison capabilities.
"""

import asyncio
from typing import List, Dict, Tuple, Optional
from statistics import mean, stdev
from backend.core.conversation_generator import evaluate_system_prompt, generate_test_conversations
from backend.core.logger import get_logger
from backend.db.node_store import get_all_nodes
from backend.core.schemas import Node

logger = get_logger(__name__)


async def comprehensive_system_prompt_evaluation(system_prompt: str, num_tests: int = 5) -> Dict:
    """
    Perform comprehensive evaluation of a system prompt with extended testing.
    
    Args:
        system_prompt: The system prompt to evaluate
        num_tests: Number of test rounds to run (default 5 for robustness)
    
    Returns:
        Dict with comprehensive evaluation metrics
    """
    logger.info(f"Starting comprehensive evaluation with {num_tests} test rounds")
    
    all_results = []
    
    # Run multiple evaluation rounds for statistical significance
    for round_num in range(num_tests):
        logger.debug(f"Evaluation round {round_num + 1}/{num_tests}")
        
        try:
            # Generate test conversations for this round
            conversation_results = await generate_test_conversations(system_prompt)
            
            if conversation_results:
                round_scores = [score for _, score in conversation_results]
                round_lengths = [len(conv) // 2 for conv, _ in conversation_results]  # Turn counts
                
                all_results.append({
                    'scores': round_scores,
                    'lengths': round_lengths,
                    'conversations': conversation_results
                })
                
        except Exception as e:
            logger.error(f"Evaluation round {round_num + 1} failed: {e}")
            continue
    
    if not all_results:
        logger.warning("No successful evaluation rounds")
        return _create_empty_evaluation_result()
    
    # Aggregate results across all rounds
    all_scores = []
    all_lengths = []
    all_conversations = []
    
    for result in all_results:
        all_scores.extend(result['scores'])
        all_lengths.extend(result['lengths'])
        all_conversations.extend(result['conversations'])
    
    # Calculate comprehensive metrics
    metrics = _calculate_comprehensive_metrics(all_scores, all_lengths, all_conversations)
    
    # Add system prompt for reference
    metrics['system_prompt'] = system_prompt
    metrics['num_test_rounds'] = len(all_results)
    metrics['total_conversations'] = len(all_conversations)
    
    logger.info(f"Comprehensive evaluation complete: avg_score={metrics['avg_score']:.3f}, "
                f"consistency={metrics['score_consistency']:.3f}, "
                f"efficiency={metrics['efficiency_score']:.3f}")
    
    return metrics


def _calculate_comprehensive_metrics(scores: List[float], lengths: List[int], conversations: List[Tuple]) -> Dict:
    """Calculate comprehensive evaluation metrics."""
    
    if not scores:
        return _create_empty_evaluation_result()
    
    # Basic statistics
    avg_score = mean(scores)
    score_std = stdev(scores) if len(scores) > 1 else 0.0
    min_score = min(scores)
    max_score = max(scores)
    
    avg_length = mean(lengths)
    length_std = stdev(lengths) if len(lengths) > 1 else 0.0
    
    # Success metrics (threshold-based)
    high_success_count = sum(1 for score in scores if score > 0.8)  # Excellent performance
    moderate_success_count = sum(1 for score in scores if score > 0.6)  # Good performance
    failure_count = sum(1 for score in scores if score < 0.3)  # Poor performance
    
    high_success_rate = high_success_count / len(scores)
    moderate_success_rate = moderate_success_count / len(scores)
    failure_rate = failure_count / len(scores)
    
    # Consistency metrics
    score_consistency = 1.0 - (score_std / max(avg_score, 0.1))  # Higher is more consistent
    score_consistency = max(0.0, min(1.0, score_consistency))  # Clamp to [0,1]
    
    # Efficiency metrics
    successful_lengths = [lengths[i] for i, score in enumerate(scores) if score > 0.6]
    avg_successful_length = mean(successful_lengths) if successful_lengths else avg_length
    
    # Efficiency bonus: reward shorter successful conversations
    efficiency_score = 0.0
    if moderate_success_rate > 0:
        # Scale efficiency from 0-1, where shorter successful conversations get higher scores
        normalized_length = min(1.0, avg_successful_length / 10.0)  # 10 turns = baseline
        efficiency_score = moderate_success_rate * (1.0 - normalized_length * 0.5)
    
    # Quality distribution
    score_distribution = {
        'excellent': high_success_rate,  # >0.8
        'good': (moderate_success_count - high_success_count) / len(scores),  # 0.6-0.8
        'moderate': sum(1 for score in scores if 0.3 <= score <= 0.6) / len(scores),  # 0.3-0.6
        'poor': failure_rate  # <0.3
    }
    
    # Improvement potential (based on variance and current performance)
    if avg_score < 0.7 and score_std > 0.1:
        improvement_potential = min(1.0, (0.7 - avg_score) + score_std)
    else:
        improvement_potential = max(0.0, 1.0 - avg_score)
    
    return {
        # Core metrics
        'avg_score': avg_score,
        'score_std': score_std,
        'min_score': min_score,
        'max_score': max_score,
        'avg_conversation_length': avg_length,
        'length_std': length_std,
        
        # Success metrics
        'high_success_rate': high_success_rate,
        'moderate_success_rate': moderate_success_rate,
        'failure_rate': failure_rate,
        
        # Quality metrics
        'score_consistency': score_consistency,
        'efficiency_score': efficiency_score,
        'score_distribution': score_distribution,
        'improvement_potential': improvement_potential,
        
        # Sample data
        'sample_count': len(scores),
        'conversation_samples': [{'conversation': conv, 'score': score} for conv, score in conversations[:5]]  # Keep top 5 for storage
    }


def _create_empty_evaluation_result() -> Dict:
    """Create empty evaluation result for failed evaluations."""
    return {
        'avg_score': 0.0,
        'score_std': 0.0,
        'min_score': 0.0,
        'max_score': 0.0,
        'avg_conversation_length': 0.0,
        'length_std': 0.0,
        'high_success_rate': 0.0,
        'moderate_success_rate': 0.0,
        'failure_rate': 1.0,
        'score_consistency': 0.0,
        'efficiency_score': 0.0,
        'score_distribution': {'excellent': 0.0, 'good': 0.0, 'moderate': 0.0, 'poor': 1.0},
        'improvement_potential': 1.0,
        'sample_count': 0,
        'conversation_samples': []
    }


async def compare_system_prompts(prompts: List[str], num_tests: int = 3) -> Dict:
    """
    Compare multiple system prompts head-to-head.
    
    Args:
        prompts: List of system prompts to compare
        num_tests: Number of test rounds per prompt
    
    Returns:
        Dict with comparison results and rankings
    """
    logger.info(f"Comparing {len(prompts)} system prompts with {num_tests} tests each")
    
    # Evaluate all prompts
    evaluation_tasks = [
        comprehensive_system_prompt_evaluation(prompt, num_tests)
        for prompt in prompts
    ]
    
    evaluations = await asyncio.gather(*evaluation_tasks, return_exceptions=True)
    
    # Filter out failed evaluations
    successful_evaluations = []
    for i, evaluation in enumerate(evaluations):
        if isinstance(evaluation, Exception):
            logger.error(f"Prompt {i+1} evaluation failed: {evaluation}")
        else:
            evaluation['prompt_index'] = i
            successful_evaluations.append(evaluation)
    
    if not successful_evaluations:
        logger.error("All prompt evaluations failed")
        return {'error': 'All evaluations failed'}
    
    # Rank prompts by different criteria
    rankings = {
        'by_avg_score': sorted(successful_evaluations, key=lambda x: x['avg_score'], reverse=True),
        'by_consistency': sorted(successful_evaluations, key=lambda x: x['score_consistency'], reverse=True),
        'by_efficiency': sorted(successful_evaluations, key=lambda x: x['efficiency_score'], reverse=True),
        'by_success_rate': sorted(successful_evaluations, key=lambda x: x['moderate_success_rate'], reverse=True)
    }
    
    # Calculate overall winner (weighted score)
    for eval_result in successful_evaluations:
        overall_score = (
            eval_result['avg_score'] * 0.4 +
            eval_result['score_consistency'] * 0.2 +
            eval_result['efficiency_score'] * 0.2 +
            eval_result['moderate_success_rate'] * 0.2
        )
        eval_result['overall_score'] = overall_score
    
    overall_ranking = sorted(successful_evaluations, key=lambda x: x['overall_score'], reverse=True)
    
    return {
        'num_prompts_compared': len(prompts),
        'successful_evaluations': len(successful_evaluations),
        'rankings': rankings,
        'overall_winner': overall_ranking[0] if overall_ranking else None,
        'detailed_results': successful_evaluations
    }


async def analyze_system_prompt_evolution() -> Dict:
    """
    Analyze the evolution of system prompts in the current database.
    
    Returns:
        Dict with evolution analysis and insights
    """
    logger.info("Analyzing system prompt evolution from database")
    
    try:
        # Get all nodes from database
        all_nodes = get_all_nodes()
        
        if not all_nodes:
            logger.warning("No nodes found in database")
            return {'error': 'No nodes in database'}
        
        # Group nodes by depth (generation)
        depth_groups = {}
        for node in all_nodes:
            depth = node.depth
            if depth not in depth_groups:
                depth_groups[depth] = []
            depth_groups[depth].append(node)
        
        # Analyze trends by generation
        evolution_analysis = {}
        for depth in sorted(depth_groups.keys()):
            nodes = depth_groups[depth]
            scores = [node.score for node in nodes if node.score is not None]
            
            if scores:
                evolution_analysis[depth] = {
                    'generation': depth,
                    'num_prompts': len(nodes),
                    'avg_score': mean(scores),
                    'score_std': stdev(scores) if len(scores) > 1 else 0.0,
                    'min_score': min(scores),
                    'max_score': max(scores),
                    'top_prompt': max(nodes, key=lambda x: x.score or 0).system_prompt[:100] + "..." if nodes else None
                }
        
        # Calculate improvement trends
        generations = sorted(evolution_analysis.keys())
        if len(generations) >= 2:
            score_trend = []
            for i in range(1, len(generations)):
                prev_gen = evolution_analysis[generations[i-1]]
                curr_gen = evolution_analysis[generations[i]]
                improvement = curr_gen['avg_score'] - prev_gen['avg_score']
                score_trend.append(improvement)
            
            avg_improvement_per_gen = mean(score_trend) if score_trend else 0.0
        else:
            avg_improvement_per_gen = 0.0
        
        # Find best overall prompt
        best_node = max(all_nodes, key=lambda x: x.score or 0) if all_nodes else None
        
        return {
            'total_nodes': len(all_nodes),
            'generations_analyzed': len(evolution_analysis),
            'evolution_by_generation': evolution_analysis,
            'avg_improvement_per_generation': avg_improvement_per_gen,
            'best_prompt': {
                'score': best_node.score if best_node else 0.0,
                'generation': best_node.depth if best_node else 0,
                'system_prompt': best_node.system_prompt[:200] + "..." if best_node else None
            } if best_node else None
        }
        
    except Exception as e:
        logger.error(f"Evolution analysis failed: {e}")
        return {'error': f'Analysis failed: {str(e)}'}


async def generate_optimization_insights(evaluation_results: List[Dict]) -> Dict:
    """
    Generate insights and recommendations based on evaluation results.
    
    Args:
        evaluation_results: List of evaluation result dictionaries
    
    Returns:
        Dict with optimization insights and recommendations
    """
    if not evaluation_results:
        return {'error': 'No evaluation results provided'}
    
    # Aggregate patterns
    all_scores = []
    high_performers = []  # >0.7 avg score
    consistent_performers = []  # >0.8 consistency
    efficient_performers = []  # >0.6 efficiency
    
    for result in evaluation_results:
        all_scores.append(result.get('avg_score', 0.0))
        
        if result.get('avg_score', 0.0) > 0.7:
            high_performers.append(result)
        if result.get('score_consistency', 0.0) > 0.8:
            consistent_performers.append(result)
        if result.get('efficiency_score', 0.0) > 0.6:
            efficient_performers.append(result)
    
    # Generate insights
    insights = {
        'performance_summary': {
            'total_evaluated': len(evaluation_results),
            'avg_performance': mean(all_scores) if all_scores else 0.0,
            'high_performers': len(high_performers),
            'consistent_performers': len(consistent_performers),
            'efficient_performers': len(efficient_performers)
        },
        'recommendations': []
    }
    
    # Generate specific recommendations
    if len(high_performers) < len(evaluation_results) * 0.3:
        insights['recommendations'].append({
            'type': 'performance',
            'message': 'Less than 30% of prompts achieve high performance (>0.7). Consider focusing on more empathetic or strategic approaches.'
        })
    
    if len(consistent_performers) < len(evaluation_results) * 0.2:
        insights['recommendations'].append({
            'type': 'consistency',
            'message': 'Low consistency across evaluations. Consider more specific, structured system prompts.'
        })
    
    if len(efficient_performers) < len(evaluation_results) * 0.4:
        insights['recommendations'].append({
            'type': 'efficiency',
            'message': 'Many prompts lead to long conversations without success. Consider more direct or goal-oriented approaches.'
        })
    
    # Identify best practices from top performers
    if high_performers:
        # This would require more sophisticated NLP analysis in a real system
        insights['best_practices'] = {
            'top_performer_score': max(hp['avg_score'] for hp in high_performers),
            'common_patterns': 'Analysis would require NLP processing of system prompt text'
        }
    
    return insights