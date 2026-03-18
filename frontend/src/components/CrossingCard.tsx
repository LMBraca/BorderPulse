"use client";

import Link from "next/link";
import {
  type CrossingSummary,
  formatTimeAgo,
  getWaitStatus,
  STATUS_COLORS,
} from "@/lib/types";
import { Heart, ChevronRight } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { useState, useEffect } from "react";

interface CrossingCardProps {
  crossing: CrossingSummary;
  onFavToggle?: () => void;
}

// Short labels for the compact lane row
const SHORT_LABELS: Record<string, string> = {
  standard_vehicle: "Std",
  sentri: "SENTRI",
  ready_lane: "Ready",
  pedestrian: "Ped",
  commercial: "Comm",
};

export default function CrossingCard({ crossing, onFavToggle }: CrossingCardProps) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setFav(isFavorite(crossing.id));
  }, [crossing.id]);

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowFav = toggleFavorite(crossing.id);
    setFav(nowFav);
    onFavToggle?.();
  };

  const activeLanes = crossing.lanes.filter((l) => l.waitMinutes !== null || l.isClosed);
  const hasData = activeLanes.length > 0;

  // Find the worst wait for the headline badge
  const worstLane = activeLanes.reduce(
    (worst, lane) => {
      if (lane.isClosed) return worst;
      if (lane.waitMinutes !== null && (worst === null || lane.waitMinutes > (worst.waitMinutes ?? 0))) {
        return lane;
      }
      return worst;
    },
    null as typeof crossing.lanes[0] | null
  );

  const worstStatus = worstLane ? getWaitStatus(worstLane.waitMinutes, worstLane.isClosed) : "unknown";
  const worstColor = STATUS_COLORS[worstStatus];

  return (
    <Link href={`/crossing/${crossing.id}`} className="block group">
      <div className="rounded-xl bg-card border border-subtle p-3.5 transition-colors group-active:bg-card-hover group-hover:bg-card-hover h-full flex flex-col">
        {/* Top row: name + worst wait + fav */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-[15px] text-white truncate">
              {crossing.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {crossing.cityUs}, {crossing.stateUs} → {crossing.cityMx}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {worstLane && worstLane.waitMinutes !== null && (
              <span
                className="text-sm font-display font-semibold tabular-nums"
                style={{ color: worstColor }}
              >
                {worstLane.waitMinutes} min
              </span>
            )}
            <button
              onClick={handleFav}
              className={`p-1 rounded-lg transition-colors ${
                fav ? "text-red-400" : "text-slate-600 hover:text-slate-400"
              }`}
              aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart size={14} className={fav ? "fill-current" : ""} />
            </button>
          </div>
        </div>

        {/* Lane breakdown — wrapping grid */}
        <div className="mt-auto pt-2.5 mt-2.5 border-t border-subtle">
          {hasData ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
                {activeLanes.map((lane) => {
                  const status = getWaitStatus(lane.waitMinutes, lane.isClosed);
                  const color = STATUS_COLORS[status];
                  const label = SHORT_LABELS[lane.laneType] || lane.laneTypeLabel;
                  return (
                    <div key={lane.laneType} className="flex items-center gap-1 whitespace-nowrap">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[11px] text-slate-500">{label}</span>
                      <span
                        className="text-[11px] font-semibold font-display tabular-nums"
                        style={{ color }}
                      >
                        {lane.isClosed ? "Closed" : `${lane.waitMinutes}m`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-slate-600 whitespace-nowrap">
                  {formatTimeAgo(crossing.lastUpdated)}
                </span>
                <ChevronRight size={12} className="text-slate-700" />
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-600">No data available</span>
          )}
        </div>
      </div>
    </Link>
  );
}
