import structlog
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func, extract, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.port import PortOfEntry, LaneType
from app.models.observation import WaitTimeObservation
from app.schemas.crossing import (
    CrossingSummary,
    CrossingDetail,
    CrossingMapMarker,
    LaneWaitTime,
    HistoryPoint,
    HistoryResponse,
)
from app.services.cache import get_all_live_waits, get_live_wait

logger = structlog.get_logger()
router = APIRouter(prefix="/crossings", tags=["crossings"])


def wait_to_status(wait_minutes: Optional[int]) -> str:
    if wait_minutes is None:
        return "unknown"
    if wait_minutes <= 20:
        return "green"
    if wait_minutes <= 45:
        return "yellow"
    return "red"


def compute_trend(recent: list[Optional[int]]) -> Optional[str]:
    """Compute trend from a list of recent wait times (newest first)."""
    values = [v for v in recent if v is not None]
    if len(values) < 3:
        return None
    # Compare average of first 3 vs last 3
    recent_avg = sum(values[:3]) / 3
    older_avg = sum(values[-3:]) / 3
    diff = recent_avg - older_avg
    if diff > 5:
        return "rising"
    if diff < -5:
        return "falling"
    return "stable"


async def get_latest_from_db(
    db: AsyncSession, lane_map: dict[int, LaneType]
) -> dict[int, dict[int, dict]]:
    """When Redis is empty, grab the latest observation per port+lane directly from PG."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

    # Subquery: latest observed_at per (port, lane)
    latest_sq = (
        select(
            WaitTimeObservation.port_id,
            WaitTimeObservation.lane_type_id,
            func.max(WaitTimeObservation.observed_at).label("max_at"),
        )
        .where(WaitTimeObservation.observed_at >= cutoff)
        .group_by(WaitTimeObservation.port_id, WaitTimeObservation.lane_type_id)
        .subquery()
    )

    rows = await db.execute(
        select(WaitTimeObservation).join(
            latest_sq,
            and_(
                WaitTimeObservation.port_id == latest_sq.c.port_id,
                WaitTimeObservation.lane_type_id == latest_sq.c.lane_type_id,
                WaitTimeObservation.observed_at == latest_sq.c.max_at,
            ),
        )
    )

    result: dict[int, dict[int, dict]] = {}
    for obs in rows.scalars().all():
        if obs.port_id not in result:
            result[obs.port_id] = {}
        result[obs.port_id][obs.lane_type_id] = {
            "waitMinutes": obs.wait_minutes,
            "lanesOpen": obs.lanes_open,
            "isClosed": obs.is_closed,
            "updatedAt": obs.observed_at.isoformat(),
            "cbpUpdatedAt": obs.cbp_updated_at.isoformat() if obs.cbp_updated_at else None,
        }
    return result


@router.get("", response_model=list[CrossingSummary])
async def list_crossings(db: AsyncSession = Depends(get_db)):
    """List all crossings with current wait times."""
    ports_result = await db.execute(
        select(PortOfEntry).where(PortOfEntry.is_active == True).order_by(PortOfEntry.state_us, PortOfEntry.name_en)
    )
    ports = ports_result.scalars().all()

    lanes_result = await db.execute(select(LaneType))
    lanes = {lt.id: lt for lt in lanes_result.scalars().all()}

    std_lane_id = next((lt.id for lt in lanes.values() if lt.code == "standard_vehicle"), None)

    # Try Redis first, fall back to DB
    live_data = await get_all_live_waits()
    if not live_data:
        logger.info("redis_empty_falling_back_to_db")
        live_data = await get_latest_from_db(db, lanes)

    # Batch-query last 3 hours of standard_vehicle observations for trend computation
    trend_cutoff = datetime.now(timezone.utc) - timedelta(hours=3)
    trend_data: dict[int, list[Optional[int]]] = {}
    if std_lane_id:
        trend_result = await db.execute(
            select(
                WaitTimeObservation.port_id,
                WaitTimeObservation.wait_minutes,
            ).where(
                and_(
                    WaitTimeObservation.lane_type_id == std_lane_id,
                    WaitTimeObservation.observed_at >= trend_cutoff,
                    WaitTimeObservation.is_closed == False,
                )
            ).order_by(
                WaitTimeObservation.port_id,
                WaitTimeObservation.observed_at.desc(),
            )
        )
        for row in trend_result.all():
            trend_data.setdefault(row[0], []).append(row[1])

    summaries = []
    for port in ports:
        port_live = live_data.get(port.id, {})
        lane_waits = []
        last_updated = None

        for lane_id, lane in lanes.items():
            live = port_live.get(lane_id, {})
            wait = live.get("waitMinutes")
            updated = live.get("cbpUpdatedAt") or live.get("updatedAt")

            lane_waits.append(LaneWaitTime(
                laneType=lane.code,
                laneTypeId=lane_id,
                laneTypeLabel=lane.name_en,
                waitMinutes=wait,
                lanesOpen=live.get("lanesOpen"),
                isClosed=live.get("isClosed", False),
                updatedAt=updated,
            ))

            if updated and (last_updated is None or updated > str(last_updated or "")):
                last_updated = updated

        trend = compute_trend(trend_data.get(port.id, []))

        summaries.append(CrossingSummary(
            id=port.id,
            name=port.name_en,
            cityUs=port.city_us or "",
            cityMx=port.city_mx or "",
            stateUs=port.state_us or "",
            stateMx=port.state_mx or "",
            latitude=float(port.latitude),
            longitude=float(port.longitude),
            isActive=port.is_active,
            lanes=lane_waits,
            trend=trend,
            lastUpdated=last_updated,
        ))

    return summaries


@router.get("/map", response_model=list[CrossingMapMarker])
async def map_crossings(db: AsyncSession = Depends(get_db)):
    """Get crossing data formatted for map markers."""
    ports_result = await db.execute(
        select(PortOfEntry).where(PortOfEntry.is_active == True)
    )
    ports = ports_result.scalars().all()

    lanes_result = await db.execute(select(LaneType))
    lanes = {lt.id: lt for lt in lanes_result.scalars().all()}

    live_data = await get_all_live_waits()
    if not live_data:
        live_data = await get_latest_from_db(db, lanes)

    markers = []
    for port in ports:
        port_live = live_data.get(port.id, {})
        worst_wait = None
        for lane_data in port_live.values():
            w = lane_data.get("waitMinutes")
            if w is not None and (worst_wait is None or w > worst_wait):
                worst_wait = w

        markers.append(CrossingMapMarker(
            id=port.id,
            name=port.name_en,
            latitude=float(port.latitude),
            longitude=float(port.longitude),
            worstWait=worst_wait,
            status=wait_to_status(worst_wait),
        ))

    return markers


@router.get("/{crossing_id}", response_model=CrossingDetail)
async def get_crossing(crossing_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed crossing info with recent history."""
    port = await db.get(PortOfEntry, crossing_id)
    if not port:
        raise HTTPException(status_code=404, detail="Crossing not found")

    lanes_result = await db.execute(select(LaneType))
    lanes = {lt.id: lt for lt in lanes_result.scalars().all()}

    # Get live data — try Redis, then fall back to DB for this port
    live_data = await get_all_live_waits()
    port_live = live_data.get(port.id, {})
    if not port_live:
        db_data = await get_latest_from_db(db, lanes)
        port_live = db_data.get(port.id, {})

    lane_waits = []
    for lane_id, lane in lanes.items():
        live = port_live.get(lane_id, {})
        if live:
            lane_waits.append(LaneWaitTime(
                laneType=lane.code,
                laneTypeId=lane_id,
                laneTypeLabel=lane.name_en,
                waitMinutes=live.get("waitMinutes"),
                lanesOpen=live.get("lanesOpen"),
                isClosed=live.get("isClosed", False),
                updatedAt=live.get("updatedAt"),
            ))
        else:
            lane_waits.append(LaneWaitTime(
                laneType=lane.code,
                laneTypeId=lane_id,
                laneTypeLabel=lane.name_en,
            ))

    # Get recent 48h history (wide enough to survive CBP data stalls)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    history_result = await db.execute(
        select(
            WaitTimeObservation.observed_at,
            WaitTimeObservation.lane_type_id,
            WaitTimeObservation.wait_minutes,
        ).where(
            and_(
                WaitTimeObservation.port_id == crossing_id,
                WaitTimeObservation.observed_at >= cutoff,
            )
        ).order_by(WaitTimeObservation.observed_at.desc())
        .limit(500)
    )
    recent_rows = history_result.all()
    recent_history = [
        {
            "observedAt": row[0].isoformat(),
            "laneTypeId": row[1],
            "waitMinutes": row[2],
        }
        for row in recent_rows
    ]

    return CrossingDetail(
        id=port.id,
        name=port.name_en,
        nameEs=port.name_es,
        cityUs=port.city_us or "",
        cityMx=port.city_mx or "",
        stateUs=port.state_us or "",
        stateMx=port.state_mx or "",
        latitude=float(port.latitude),
        longitude=float(port.longitude),
        isActive=port.is_active,
        timezone=port.timezone,
        lanes=lane_waits,
        recentHistory=recent_history,
    )


@router.get("/{crossing_id}/history", response_model=HistoryResponse)
async def get_crossing_history(
    crossing_id: int,
    lane_type: str = Query(default="standard_vehicle"),
    db: AsyncSession = Depends(get_db),
):
    """Get historical aggregated patterns for a crossing."""
    # Resolve lane type
    lane_result = await db.execute(
        select(LaneType).where(LaneType.code == lane_type)
    )
    lane = lane_result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=400, detail=f"Unknown lane type: {lane_type}")

    # Query aggregated historical data (last 90 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)

    result = await db.execute(
        select(
            extract("dow", WaitTimeObservation.observed_at).label("dow"),
            extract("hour", WaitTimeObservation.observed_at).label("hour"),
            func.count().label("cnt"),
            func.percentile_cont(0.5).within_group(
                WaitTimeObservation.wait_minutes
            ).label("median"),
            func.percentile_cont(0.25).within_group(
                WaitTimeObservation.wait_minutes
            ).label("p25"),
            func.percentile_cont(0.75).within_group(
                WaitTimeObservation.wait_minutes
            ).label("p75"),
        ).where(
            and_(
                WaitTimeObservation.port_id == crossing_id,
                WaitTimeObservation.lane_type_id == lane.id,
                WaitTimeObservation.wait_minutes.isnot(None),
                WaitTimeObservation.is_closed == False,
                WaitTimeObservation.observed_at >= cutoff,
            )
        ).group_by("dow", "hour")
        .order_by("dow", "hour")
    )

    rows = result.all()
    data = [
        HistoryPoint(
            hour=int(row[1]),
            dayOfWeek=int(row[0]),
            medianWait=float(row[3]) if row[3] else None,
            p25Wait=float(row[4]) if row[4] else None,
            p75Wait=float(row[5]) if row[5] else None,
            sampleCount=int(row[2]),
        )
        for row in rows
    ]

    return HistoryResponse(
        portId=crossing_id,
        laneTypeId=lane.id,
        data=data,
    )
