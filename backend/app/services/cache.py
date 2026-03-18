"""Redis caching layer for live data and predictions."""
import json
import structlog
from typing import Optional
from datetime import datetime
import redis.asyncio as redis
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

_redis: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()
        _redis = None


# --- Live Wait Times ---

LIVE_KEY_PREFIX = "live:"
LIVE_TTL = 600  # 10 minutes — CBP updates every ~15min, ingestion every 5min


async def cache_live_wait(port_id: int, lane_type_id: int, data: dict):
    try:
        r = await get_redis()
        key = f"{LIVE_KEY_PREFIX}{port_id}:{lane_type_id}"
        data["_cached_at"] = datetime.utcnow().isoformat()
        await r.set(key, json.dumps(data), ex=LIVE_TTL)
    except Exception as e:
        logger.warning("redis_cache_write_failed", error=str(e))


async def get_live_wait(port_id: int, lane_type_id: int) -> Optional[dict]:
    try:
        r = await get_redis()
        key = f"{LIVE_KEY_PREFIX}{port_id}:{lane_type_id}"
        raw = await r.get(key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.warning("redis_cache_read_failed", error=str(e))
    return None


async def get_all_live_waits() -> dict:
    """Get all cached live wait times. Returns {port_id: {lane_type_id: data}}."""
    result = {}
    try:
        r = await get_redis()
        keys = []
        async for key in r.scan_iter(f"{LIVE_KEY_PREFIX}*"):
            keys.append(key)

        if not keys:
            return result

        values = await r.mget(keys)
        for key, val in zip(keys, values):
            if val is None:
                continue
            parts = key.replace(LIVE_KEY_PREFIX, "").split(":")
            port_id, lane_type_id = int(parts[0]), int(parts[1])
            if port_id not in result:
                result[port_id] = {}
            result[port_id][lane_type_id] = json.loads(val)
    except Exception as e:
        logger.warning("redis_cache_scan_failed", error=str(e))

    return result


# --- Predictions ---

PRED_KEY_PREFIX = "pred:"
PRED_TTL = 900  # 15 minutes


async def cache_predictions(port_id: int, lane_type_id: int, date: str, data: dict):
    try:
        r = await get_redis()
        key = f"{PRED_KEY_PREFIX}{port_id}:{lane_type_id}:{date}"
        await r.set(key, json.dumps(data), ex=PRED_TTL)
    except Exception as e:
        logger.warning("redis_pred_write_failed", error=str(e))


async def get_cached_predictions(port_id: int, lane_type_id: int, date: str) -> Optional[dict]:
    try:
        r = await get_redis()
        key = f"{PRED_KEY_PREFIX}{port_id}:{lane_type_id}:{date}"
        raw = await r.get(key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.warning("redis_pred_read_failed", error=str(e))
    return None


# --- Ingestion Status ---

INGESTION_STATUS_KEY = "ingestion:last_success"


async def set_ingestion_status(success: bool, record_count: int):
    try:
        r = await get_redis()
        status = {
            "success": success,
            "record_count": record_count,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await r.set(INGESTION_STATUS_KEY, json.dumps(status), ex=1800)
    except Exception as e:
        logger.warning("redis_status_write_failed", error=str(e))


async def get_ingestion_status() -> Optional[dict]:
    try:
        r = await get_redis()
        raw = await r.get(INGESTION_STATUS_KEY)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.warning("redis_status_read_failed", error=str(e))
    return None
