"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  type CrossingSummary,
  getWaitStatus,
  STATUS_COLORS,
  MX_STATE_ABBR,
} from "@/lib/types";
import { Heart, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { CROSSING_VOLUMES, formatVolume } from "@/lib/volumes";
import { getPreferredLane } from "@/lib/preferences";
import { useState, useEffect } from "react";

interface CrossingCardProps {
  crossing: CrossingSummary;
  onFavToggle?: () => void;
}

const TREND_CONFIG = {
  rising: { icon: TrendingUp, color: "#F87171", tKey: "rising" },
  falling: { icon: TrendingDown, color: "#34D399", tKey: "falling" },
  stable: { icon: Minus, color: "#94A3B8", tKey: "stable" },
} as const;

export default function CrossingCard({ crossing, onFavToggle }: CrossingCardProps) {
  const tc = useTranslations("common");
  const tl = useTranslations("lanes.short");

  const [fav, setFav] = useState(false);
  const [preferredLane, setPreferredLane] = useState("standard_vehicle");

  useEffect(() => {
    setFav(isFavorite(crossing.id));
    setPreferredLane(getPreferredLane());
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

  const preferred = activeLanes.find(
    (l) => l.laneType === preferredLane && !l.isClosed && l.waitMinutes !== null
  );
  const headlineLane =
    preferred ??
    activeLanes.reduce(
      (worst, lane) => {
        if (lane.isClosed) return worst;
        if (lane.waitMinutes !== null && (worst === null || lane.waitMinutes > (worst.waitMinutes ?? 0))) {
          return lane;
        }
        return worst;
      },
      null as (typeof crossing.lanes)[0] | null
    );

  const headlineStatus = headlineLane
    ? getWaitStatus(headlineLane.waitMinutes, headlineLane.isClosed)
    : "unknown";
  const headlineColor = STATUS_COLORS[headlineStatus];
  const volume = CROSSING_VOLUMES[crossing.name];
  const trend = crossing.trend ? TREND_CONFIG[crossing.trend] : null;

  const formatAgo = (dateStr: string | null) => {
    if (!dateStr) return tc("noData");
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tc("justNow");
    if (mins < 60) return tc("minsAgo", { mins });
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return tc("hoursAgo", { hrs });
    const days = Math.floor(hrs / 24);
    return tc("daysAgo", { days, hrs: hrs % 24 });
  };

  return (
    <Link href={`/crossing/${crossing.id}`} className="block group">
      <div className="rounded-xl bg-card border border-subtle p-3.5 transition-colors group-active:bg-card-hover group-hover:bg-card-hover h-full flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-[15px] text-white truncate">
              {crossing.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {crossing.cityMx}, {MX_STATE_ABBR[crossing.stateMx] ?? crossing.stateMx} &rarr;{" "}
              {crossing.cityUs}, {crossing.stateUs}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {trend && <trend.icon size={14} style={{ color: trend.color }} />}
            {headlineLane && headlineLane.waitMinutes !== null && (
              <span
                className="text-sm font-display font-semibold tabular-nums"
                style={{ color: headlineColor }}
              >
                {headlineLane.waitMinutes} {tc("min")}
              </span>
            )}
            <button
              onClick={handleFav}
              className={`p-1 rounded-lg transition-colors ${
                fav ? "text-red-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              <Heart size={14} className={fav ? "fill-current" : ""} />
            </button>
          </div>
        </div>

        {volume && (
          <div className="mt-1.5">
            <span className="text-[10px] text-slate-600">
              {formatVolume(volume.daily)}{tc("perDay")}
            </span>
          </div>
        )}

        <div className="mt-auto pt-2.5 mt-2.5 border-t border-subtle">
          {hasData ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
                {activeLanes.map((lane) => {
                  const status = getWaitStatus(lane.waitMinutes, lane.isClosed);
                  const color = STATUS_COLORS[status];
                  let label: string;
                  try {
                    label = tl(lane.laneType);
                  } catch {
                    label = lane.laneTypeLabel;
                  }
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
                        {lane.isClosed ? tc("closed") : `${lane.waitMinutes}m`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-slate-600 whitespace-nowrap">
                  {formatAgo(crossing.lastUpdated)}
                </span>
                <ChevronRight size={12} className="text-slate-700" />
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-600">{tc("noData")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
