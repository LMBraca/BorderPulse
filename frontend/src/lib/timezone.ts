const TZ_KEY = "borderpulse_timezone";

// Timezones relevant to US-Mexico border crossings
export const BORDER_TIMEZONES = [
  { value: "America/Tijuana", label: "Pacific (Tijuana)" },
  { value: "America/Los_Angeles", label: "Pacific (US)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Mexico_City", label: "Central (Mexico)" },
] as const;

export function getUserTimezone(): string {
  if (typeof window === "undefined") return "America/Tijuana";
  try {
    const saved = localStorage.getItem(TZ_KEY);
    if (saved) return saved;
  } catch {}
  // default to browser's timezone, or Tijuana if undetectable
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  return "America/Tijuana";
}

export function setUserTimezone(tz: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TZ_KEY, tz);
}

export function formatHourInTimezone(utcHour: number, tz: string): string {
  // Create a date at the given UTC hour today, then format in the target tz
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: true,
      timeZone: tz,
    }).formatToParts(d);
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "";
    const period = parts.find((p) => p.type === "dayPeriod")?.value?.toLowerCase() ?? "";
    return `${hourPart}${period.charAt(0)}`;
  } catch {
    const h = utcHour % 12 || 12;
    return utcHour < 12 ? `${h}a` : `${h}p`;
  }
}

export function getCurrentHourInTimezone(tz: string): number {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(now);
    const hourStr = parts.find((p) => p.type === "hour")?.value;
    return hourStr ? parseInt(hourStr, 10) : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}
