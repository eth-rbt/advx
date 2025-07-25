from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from backend.api import routes, websocket
from backend.core.logger import get_logger

logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Hackathon Multiverse API",
    description="Real-time prompt exploration API",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for hackathon
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes.router)


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "ok", "service": "hackathon-multiverse"}


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint_handler(ws: websocket.WebSocket):
    await websocket.websocket_endpoint(ws)


@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    logger.info("API server starting up")
    # Initialize connection manager
    websocket.manager = websocket.ConnectionManager()


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("API server shutting down")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
