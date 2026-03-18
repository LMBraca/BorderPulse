import type {
  CrossingSummary,
  CrossingDetail,
  CrossingMapMarker,
  PredictionResponse,
  HistoryPoint,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: 0 },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getCrossings(): Promise<CrossingSummary[]> {
  return fetchApi<CrossingSummary[]>("/crossings");
}

export async function getCrossing(id: number): Promise<CrossingDetail> {
  return fetchApi<CrossingDetail>(`/crossings/${id}`);
}

export async function getMapMarkers(): Promise<CrossingMapMarker[]> {
  return fetchApi<CrossingMapMarker[]>("/crossings/map");
}

export async function getPredictions(
  crossingId: number,
  laneType: string = "standard_vehicle",
  tz?: string
): Promise<PredictionResponse> {
  const params = new URLSearchParams({ lane_type: laneType });
  if (tz) params.set("tz", tz);
  return fetchApi<PredictionResponse>(
    `/predictions/${crossingId}?${params.toString()}`
  );
}

export async function getHistory(
  crossingId: number,
  laneType: string = "standard_vehicle"
): Promise<{ portId: number; laneTypeId: number; data: HistoryPoint[] }> {
  return fetchApi(`/crossings/${crossingId}/history?lane_type=${laneType}`);
}

export async function getHealth(): Promise<{
  status: string;
  redis: string;
  ingestion: { success: boolean; record_count: number; timestamp: string } | null;
}> {
  return fetchApi("/health");
}
