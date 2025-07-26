from fastapi import APIRouter, HTTPException
from backend.core.schemas import FocusZone, SettingsUpdate, Node, SeedRequest
from backend.orchestrator.scheduler import boost_or_seed
from backend.config.settings import settings
from backend.core.logger import get_logger
from backend.db.redis_client import get_redis
from backend.db.node_store import get, save
from backend.db.frontier import push
from backend.core.utils import uuid_str
from backend.core.embeddings import embed, to_xy
from backend.core.conversation import get_conversation_path, format_dialogue_history
import asyncio
import subprocess
import os
import signal

logger = get_logger(__name__)
router = APIRouter()

# Global variable to track worker process
worker_process = None


@router.post("/focus_zone")
async def focus_zone(payload: FocusZone):
    """
    Handle focus zone requests - either boost existing nodes or seed new ones.
    """
    try:
        result = await boost_or_seed(payload)
        return result
    except Exception as e:
        logger.error(f"Error processing focus zone: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/settings")
async def update_settings(updates: SettingsUpdate):
    """
    Update lambda values at runtime.
    """
    try:
        # Update only provided values
        if updates.lambda_trend is not None:
            settings.lambda_trend = updates.lambda_trend
        if updates.lambda_sim is not None:
            settings.lambda_sim = updates.lambda_sim
        if updates.lambda_depth is not None:
            settings.lambda_depth = updates.lambda_depth

        # Return full settings
        return {
            "lambda_trend": settings.lambda_trend,
            "lambda_sim": settings.lambda_sim,
            "lambda_depth": settings.lambda_depth,
            "redis_url": settings.redis_url,
            "log_level": settings.log_level,
        }
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings")
async def get_settings():
    """
    Get current settings.
    """
    return {
        "lambda_trend": settings.lambda_trend,
        "lambda_sim": settings.lambda_sim,
        "lambda_depth": settings.lambda_depth,
        "redis_url": settings.redis_url,
        "log_level": settings.log_level,
    }


@router.get("/graph")
async def get_graph():
    """
    Dump all nodes with full conversation data for frontend – UI calls once on load.
    """
    r = get_redis()
    nodes = []
    for key in r.keys("node:*"):
        node = get(key.replace("node:", ""))
        if node:
            nodes.append(
                {
                    "id": node.id,
                    "xy": node.xy,
                    "score": node.score,
                    "parent": node.parent,
                    "depth": node.depth,
                    "prompt": node.prompt,
                    "reply": node.reply,
                    "emb": node.emb,
                }
            )
    return nodes


@router.get("/conversation/{node_id}")
async def get_conversation(node_id: str):
    """
    Get the full conversation path for a specific node.
    Returns the complete dialogue from root to this node.
    """
    try:
        # Get the full conversation path
        conversation_path = get_conversation_path(node_id)
        
        if not conversation_path:
            return {"error": "Node not found"}
        
        # Format as dialogue history
        dialogue_history = format_dialogue_history(conversation_path)
        
        # Get the target node details
        target_node = get(node_id)
        
        return {
            "node_id": node_id,
            "depth": len(conversation_path) - 1,
            "score": target_node.score if target_node else None,
            "conversation": dialogue_history,
            "nodes_in_path": len(conversation_path)
        }
    except Exception as e:
        return {"error": f"Failed to get conversation: {str(e)}"}


@router.post("/seed")
async def seed(request: SeedRequest):
    """
    Push a first prompt onto the frontier. UI can expose a "Start" button.
    """
    try:
        prompt = request.prompt
        
        # Generate embedding and coordinates
        prompt_embedding = embed(prompt)
        coordinates = list(to_xy(prompt_embedding))
        
        node = Node(
            id=uuid_str(),
            prompt=prompt,
            depth=0,
            score=0.5,
            emb=prompt_embedding,
            xy=coordinates,
        )
        
        save(node)
        push(node.id, 1.0)
        
        logger.info(f"Seeded conversation with prompt: {prompt[:50]}...")
        return {"seed_id": node.id, "message": "Conversation seeded successfully"}
        
    except Exception as e:
        logger.error(f"Error seeding conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to seed conversation: {str(e)}")


@router.post("/worker/start")
async def start_worker():
    """Start the parallel worker process."""
    global worker_process
    
    try:
        if worker_process and worker_process.poll() is None:
            return {"status": "already_running", "message": "Worker is already running", "pid": worker_process.pid}
        
        # Start the parallel worker as a subprocess
        worker_process = subprocess.Popen([
            "python", "-m", "backend.worker.parallel_worker"
        ], cwd=os.getcwd())
        
        logger.info(f"Started parallel worker with PID: {worker_process.pid}")
        return {
            "status": "started", 
            "message": "Parallel worker started successfully",
            "pid": worker_process.pid
        }
        
    except Exception as e:
        logger.error(f"Error starting worker: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start worker: {str(e)}")


@router.post("/worker/stop")
async def stop_worker():
    """Stop the parallel worker process."""
    global worker_process
    
    try:
        if not worker_process or worker_process.poll() is not None:
            return {"status": "not_running", "message": "Worker is not running"}
        
        # Try graceful shutdown first
        worker_process.terminate()
        
        # Wait up to 5 seconds for graceful shutdown
        try:
            worker_process.wait(timeout=5)
            logger.info(f"Worker process {worker_process.pid} terminated gracefully")
        except subprocess.TimeoutExpired:
            # Force kill if it doesn't stop gracefully
            worker_process.kill()
            worker_process.wait()
            logger.info(f"Worker process {worker_process.pid} killed forcefully")
        
        pid = worker_process.pid
        worker_process = None
        
        return {
            "status": "stopped",
            "message": "Parallel worker stopped successfully", 
            "pid": pid
        }
        
    except Exception as e:
        logger.error(f"Error stopping worker: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to stop worker: {str(e)}")


@router.get("/worker/status")
async def get_worker_status():
    """Get the current status of the parallel worker."""
    global worker_process
    
    try:
        if not worker_process:
            status = "not_started"
        elif worker_process.poll() is None:
            status = "running"
        else:
            status = "stopped"
            worker_process = None  # Clean up dead process
        
        return {
            "status": status,
            "pid": worker_process.pid if worker_process and worker_process.poll() is None else None,
            "message": f"Worker is {status}"
        }
        
    except Exception as e:
        logger.error(f"Error getting worker status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get worker status: {str(e)}")
