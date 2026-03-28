from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class LaneWaitTime(BaseModel):
    laneType: str
    laneTypeId: int
    laneTypeLabel: str
    waitMinutes: Optional[int] = None
    lanesOpen: Optional[int] = None
    maxLanes: Optional[int] = None
    isClosed: bool = False
    updatedAt: Optional[datetime] = None
    updateTime: Optional[str] = None


class CrossingSummary(BaseModel):
    id: int
    name: str
    cityUs: str
    cityMx: str
    stateUs: str
    stateMx: str
    latitude: float
    longitude: float
    isActive: bool
    lanes: list[LaneWaitTime] = []
    trend: Optional[str] = None  # "rising", "falling", "stable"
    lastUpdated: Optional[datetime] = None


class CrossingDetail(CrossingSummary):
    nameEs: str
    stateMx: str
    timezone: str
    recentHistory: list[dict] = []  # Last 24h observations


class CrossingMapMarker(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    worstWait: Optional[int] = None  # Highest wait across lanes
    status: str = "unknown"  # "green", "yellow", "red", "unknown"


class HistoryPoint(BaseModel):
    hour: int
    dayOfWeek: int
    medianWait: Optional[float] = None
    p25Wait: Optional[float] = None
    p75Wait: Optional[float] = None
    sampleCount: int = 0


class HistoryResponse(BaseModel):
    portId: int
    laneTypeId: int
    data: list[HistoryPoint] = []
