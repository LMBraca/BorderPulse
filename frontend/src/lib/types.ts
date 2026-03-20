export interface LaneWaitTime {
  laneType: string;
  laneTypeLabel: string;
  waitMinutes: number | null;
  delayMinutes: number | null;
  lanesOpen: number | null;
  isClosed: boolean;
  updatedAt: string | null;
}

export interface CrossingSummary {
  id: number;
  name: string;
  cityUs: string;
  cityMx: string;
  stateUs: string;
  stateMx: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  lanes: LaneWaitTime[];
  trend: "rising" | "falling" | "stable" | null;
  lastUpdated: string | null;
}

export interface CrossingDetail extends CrossingSummary {
  nameEs: string;
  stateMx: string;
  timezone: string;
  recentHistory: {
    observedAt: string;
    laneTypeId: number;
    waitMinutes: number | null;
  }[];
}

export interface CrossingMapMarker {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  worstWait: number | null;
  status: "green" | "yellow" | "red" | "unknown";
}

export interface HourlyPrediction {
  hour: number;
  predictedWait: number;
  p25Wait: number | null;
  p75Wait: number | null;
  confidence: "low" | "medium" | "high";
  sampleCount: number;
}

export interface BestTimeSuggestion {
  bestHour: number | null;
  bestWait: number | null;
  currentWait: number | null;
  message: string;
  confidence: string;
}

export interface PredictionResponse {
  portId: number;
  laneTypeId: number;
  date: string;
  hourly: HourlyPrediction[];
  bestTime: BestTimeSuggestion | null;
}

export interface HistoryPoint {
  hour: number;
  dayOfWeek: number;
  medianWait: number | null;
  p25Wait: number | null;
  p75Wait: number | null;
  sampleCount: number;
}

export type WaitStatus = "green" | "yellow" | "red" | "unknown" | "closed";

export function getWaitStatus(minutes: number | null, isClosed?: boolean): WaitStatus {
  if (isClosed) return "closed";
  if (minutes === null) return "unknown";
  if (minutes <= 20) return "green";
  if (minutes <= 45) return "yellow";
  return "red";
}

export function formatWait(minutes: number | null, isClosed?: boolean): string {
  if (isClosed) return "Closed";
  if (minutes === null) return "N/A";
  if (minutes === 0) return "No wait";
  return `${minutes} min`;
}

export function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "No data";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export const LANE_LABELS: Record<string, string> = {
  standard_vehicle: "Standard",
  sentri: "SENTRI",
  ready_lane: "Ready Lane",
  pedestrian: "Pedestrian",
  pedestrian_ready: "Ped. Ready Lane",
  commercial: "Commercial",
};

export const STATUS_COLORS: Record<WaitStatus, string> = {
  green: "#34D399",
  yellow: "#FBBF24",
  red: "#F87171",
  unknown: "#475569",
  closed: "#475569",
};
