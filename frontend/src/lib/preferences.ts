const PREFERRED_LANE_KEY = "borderpulse_preferred_lane";

export const LANE_CODES = [
  "standard_vehicle",
  "sentri",
  "ready_lane",
  "pedestrian",
  "pedestrian_ready",
  "commercial",
] as const;

export type LaneCode = (typeof LANE_CODES)[number];

export function getPreferredLane(): LaneCode {
  if (typeof window === "undefined") return "standard_vehicle";
  try {
    const v = localStorage.getItem(PREFERRED_LANE_KEY);
    if (v && LANE_CODES.includes(v as LaneCode)) return v as LaneCode;
  } catch {}
  return "standard_vehicle";
}

export function setPreferredLane(lane: LaneCode): void {
  localStorage.setItem(PREFERRED_LANE_KEY, lane);
}
