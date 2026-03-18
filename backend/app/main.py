
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.services.cache import close_redis
from app.services.ingestion import run_ingestion
from app.services.prediction import run_daily_predictions
from app.api.crossings import router as crossings_router
from app.api.predictions import router as predictions_router
from app.api.health import router as health_router

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()
settings = get_settings()

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("starting_borderpulse", env=settings.env)

    # Schedule ingestion every 5 minutes
    scheduler.add_job(
        run_ingestion,
        "interval",
        seconds=settings.ingestion_interval_seconds,
        id="cbp_ingestion",
        max_instances=1,
        misfire_grace_time=60,
    )

    # Schedule daily prediction generation at 00:15
    scheduler.add_job(
        run_daily_predictions,
        "cron",
        hour=0,
        minute=15,
        id="daily_predictions",
        max_instances=1,
    )

    scheduler.start()
    logger.info("scheduler_started")

    # Run initial ingestion on startup
    try:
        await run_ingestion()
    except Exception as e:
        logger.error("initial_ingestion_failed", error=str(e))

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    await close_redis()
    logger.info("borderpulse_stopped")


app = FastAPI(title="BorderPulse", version="0.1.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(crossings_router, prefix=settings.api_prefix)
app.include_router(predictions_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "app": "BorderPulse",
        "version": "0.1.0",
        "docs": "/docs",
    }
