from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    log_level: str = "INFO"

    # Worker budget
    daily_budget_usd: float = 5.0      # crank up for demo day

    # Models (use "fake-*" in offline mode)
    persona_model: str = "qwen/qwen-2.5-72b-instruct"  
    critic_model: str = "qwen/qwen-2.5-72b-instruct"
    mutator_model: str = "qwen/qwen-2.5-72b-instruct"

    # Scheduler lambda values
    lambda_trend: float = 0.3
    lambda_sim: float = 0.2
    lambda_depth: float = 0.05
    
    # OpenAI/OpenRouter settings
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    use_openrouter: bool = True
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # UI needs these two numbers
    ui_embed_dims: int = 2             # what to send downstream
    ui_ws_channel: str = "graph_updates"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra fields from .env
    )


settings = Settings()
