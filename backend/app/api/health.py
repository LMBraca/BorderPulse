from fastapi import APIRouter
from app.services.cache import get_ingestion_status, get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    ingestion = await get_ingestion_status()

    redis_ok = False
    live_keys = 0
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
        async for _ in r.scan_iter("live:*"):
            live_keys += 1
    except Exception:
        pass

    source = ingestion.get("source", "unknown") if ingestion else "unknown"
    json_age = ingestion.get("json_age_seconds") if ingestion else None

    if json_age is not None:
        hours = json_age / 3600
        if hours >= 24:
            age_human = f"{hours / 24:.1f} days"
        elif hours >= 1:
            age_human = f"{hours:.1f} hours"
        else:
            age_human = f"{json_age / 60:.0f} minutes"
    else:
        age_human = "unknown"

    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": "connected" if redis_ok else "disconnected",
        "redis_live_keys": live_keys,
        "ingestion": ingestion,
        "summary": {
            "data_source": source,
            "json_api_age": age_human,
            "json_api_stale": source == "cbp_rss",
        },
    }
