from fastapi import APIRouter
from app.services.cache import get_ingestion_status, get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    ingestion = await get_ingestion_status()

    redis_ok = False
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": "connected" if redis_ok else "disconnected",
        "ingestion": ingestion,
    }
