const PREFERRED_LANE_KEY = "borderpulse_preferred_lane";
const TEMPERATURE_UNIT_KEY = "borderpulse_temperature_unit";

export type TemperatureUnit = "fahrenheit" | "celsius";

export function getTemperatureUnit(): TemperatureUnit {
  if (typeof window === "undefined") return "fahrenheit";
  try {
    const v = localStorage.getItem(TEMPERATURE_UNIT_KEY);
    if (v === "celsius" || v === "fahrenheit") return v;
  } catch {}
  return "fahrenheit";
}

export function setTemperatureUnit(unit: TemperatureUnit): void {
  localStorage.setItem(TEMPERATURE_UNIT_KEY, unit);
}

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
