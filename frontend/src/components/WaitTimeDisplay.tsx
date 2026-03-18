"use client";

import { getWaitStatus, formatWait, STATUS_COLORS, type LaneWaitTime } from "@/lib/types";

interface WaitTimeBadgeProps {
  minutes: number | null;
  isClosed?: boolean;
  size?: "sm" | "md" | "lg";
}

export function WaitTimeBadge({ minutes, isClosed, size = "md" }: WaitTimeBadgeProps) {
  const status = getWaitStatus(minutes, isClosed);
  const color = STATUS_COLORS[status];
  const text = formatWait(minutes, isClosed);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-xl px-3 py-1 font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-display font-semibold tabular-nums ${sizeClasses[size]}`}
      style={{ color }}
    >
      {text}
    </span>
  );
}

interface LaneWaitRowProps {
  lane: LaneWaitTime;
}

export function LaneWaitRow({ lane }: LaneWaitRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-slate-300 font-medium">{lane.laneTypeLabel}</span>
        {lane.lanesOpen !== null && (
          <span className="text-xs text-slate-600">
            {lane.lanesOpen} lane{lane.lanesOpen !== 1 ? "s" : ""} open
          </span>
        )}
      </div>
      <WaitTimeBadge minutes={lane.waitMinutes} isClosed={lane.isClosed} />
    </div>
  );
}

interface WaitTimeHeroProps {
  minutes: number | null;
  isClosed?: boolean;
  label?: string;
}

export function WaitTimeHero({ minutes, isClosed, label }: WaitTimeHeroProps) {
  const status = getWaitStatus(minutes, isClosed);
  const color = STATUS_COLORS[status];

  return (
    <div className="flex flex-col items-center py-6">
      {label && (
        <span className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 font-display font-medium">
          {label}
        </span>
      )}
      <div
        className="text-5xl font-display font-bold tabular-nums"
        style={{ color }}
      >
        {isClosed ? "Closed" : minutes !== null ? minutes : "—"}
      </div>
      {minutes !== null && !isClosed && (
        <span className="text-sm text-slate-500 mt-1">minutes</span>
      )}
    </div>
  );
}
