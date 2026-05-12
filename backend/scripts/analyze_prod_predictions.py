"""
Read-only analysis of the prediction algorithm against the Railway prod DB.

Usage:
    BP_DATABASE_URL_PROD_READONLY=postgresql+asyncpg://... \\
        .venv/bin/python scripts/analyze_prod_predictions.py [port_id] [lane_type_id]

Defaults to San Ysidro (port 1) standard_vehicle (lane 1). Every query
runs inside a read-only transaction; this script never writes.
"""
import asyncio
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Make `app.*` importable when run as `python scripts/...`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Stub a working config before importing the prediction service.
os.environ.setdefault(
    "BP_DATABASE_URL",
    os.environ.get("BP_DATABASE_URL_PROD_READONLY", ""),
)
if not os.environ["BP_DATABASE_URL"]:
    print("error: set BP_DATABASE_URL_PROD_READONLY or BP_DATABASE_URL", file=sys.stderr)
    sys.exit(1)

os.environ.setdefault("BP_DATABASE_URL_SYNC", "")
os.environ.setdefault("BP_REDIS_URL", "redis://localhost:6379/0")

from app.services.prediction_model import smooth_predictions, is_border_holiday  # noqa: E402


async def main():
    port_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    lane_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    engine = create_async_engine(
        os.environ["BP_DATABASE_URL"],
        echo=False,
        connect_args={"server_settings": {"default_transaction_read_only": "on"}},
    )
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    async with SessionLocal() as s:
        rows = (await s.execute(
            text("""
                SELECT observed_at, wait_minutes
                FROM wait_time_observations
                WHERE port_id = :pid AND lane_type_id = :lid
                  AND wait_minutes IS NOT NULL AND is_closed = false
                  AND observed_at >= :cutoff
            """),
            {"pid": port_id, "lid": lane_id, "cutoff": cutoff},
        )).all()

    print(f"port={port_id} lane={lane_id}: {len(rows)} observations in last 90d")
    if not rows:
        return

    from zoneinfo import ZoneInfo
    tz = ZoneInfo("America/Tijuana")
    obs = [(dt.astimezone(tz).replace(tzinfo=None), int(w)) for dt, w in rows]
    now_local = datetime.now(tz).replace(tzinfo=None)

    for d in (date.today(), date.today() + timedelta(days=3)):
        preds = smooth_predictions(obs, d, now_local, is_border_holiday(d))
        print(f"\n=== {d} ({d.strftime('%a')}) holiday={is_border_holiday(d)} ===")
        print(f"{'hr':>3} {'med':>6} {'p25':>6} {'p75':>6} {'n':>5} {'n_eff':>7} conf")
        for p in preds:
            print(
                f"{p['hour']:>3} {p['predicted_wait']:>6.1f} "
                f"{p['p25_wait']:>6.1f} {p['p75_wait']:>6.1f} "
                f"{p['sample_count']:>5} {p['n_eff']:>7.2f} {p['confidence']}"
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
