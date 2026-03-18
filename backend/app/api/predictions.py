from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.port import PortOfEntry, LaneType
from app.schemas.prediction import PredictionResponse
from app.services.prediction import get_predictions_for_port

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/{crossing_id}", response_model=PredictionResponse)
async def get_predictions(
    crossing_id: int,
    lane_type: str = Query(default="standard_vehicle"),
    target_date: Optional[str] = Query(default=None, alias="date"),
    tz: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    port = await db.get(PortOfEntry, crossing_id)
    if not port:
        raise HTTPException(status_code=404, detail="Crossing not found")

    lane_result = await db.execute(
        select(LaneType).where(LaneType.code == lane_type)
    )
    lane = lane_result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=400, detail=f"Unknown lane type: {lane_type}")

    parsed_date = None
    if target_date:
        try:
            parsed_date = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Use user's timezone, fall back to the port's timezone
    timezone = tz or port.timezone or "America/Tijuana"

    return await get_predictions_for_port(port.id, lane.id, parsed_date, timezone)
