from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://borderpulse:borderpulse@localhost:5432/borderpulse"
    database_url_sync: str = "postgresql://borderpulse:borderpulse@localhost:5432/borderpulse"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CBP API
    cbp_api_url: str = "https://bwt.cbp.gov/api/waittimes"
    ingestion_interval_seconds: int = 300

    # App
    env: str = "development"
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    model_config = {"env_prefix": "BP_", "env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
