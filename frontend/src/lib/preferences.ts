const PREFERRED_LANE_KEY = "borderpulse_preferred_lane";

export const LANE_OPTIONS = [
  { value: "standard_vehicle", label: "Standard Vehicle" },
  { value: "sentri", label: "SENTRI" },
  { value: "ready_lane", label: "Ready Lane" },
  { value: "pedestrian", label: "Pedestrian" },
  { value: "pedestrian_ready", label: "Ped. Ready Lane" },
  { value: "commercial", label: "Commercial" },
] as const;

export type LaneCode = (typeof LANE_OPTIONS)[number]["value"];

export function getPreferredLane(): LaneCode {
  if (typeof window === "undefined") return "standard_vehicle";
  try {
    const v = localStorage.getItem(PREFERRED_LANE_KEY);
    if (v && LANE_OPTIONS.some((o) => o.value === v)) return v as LaneCode;
  } catch {}
  return "standard_vehicle";
}

export function setPreferredLane(lane: LaneCode): void {
  localStorage.setItem(PREFERRED_LANE_KEY, lane);
}
