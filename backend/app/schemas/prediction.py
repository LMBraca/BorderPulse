from pydantic import BaseModel
from typing import Optional


class HourlyPrediction(BaseModel):
    hour: int
    predictedWait: float
    p25Wait: Optional[float] = None
    p75Wait: Optional[float] = None
    confidence: str  # "low", "medium", "high"
    sampleCount: int = 0


class BestTimeSuggestion(BaseModel):
    bestHour: Optional[int] = None
    bestWait: Optional[float] = None
    currentWait: Optional[int] = None
    message: str
    confidence: str


class PredictionResponse(BaseModel):
    portId: int
    laneTypeId: int
    date: str
    hourly: list[HourlyPrediction] = []
    bestTime: Optional[BestTimeSuggestion] = None
