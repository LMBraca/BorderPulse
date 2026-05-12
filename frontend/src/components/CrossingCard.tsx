"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  type CrossingSummary,
  getWaitStatus,
  STATUS_COLORS,
  MX_STATE_ABBR,
} from "@/lib/types";
import { Heart, TrendingUp, TrendingDown } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { getPreferredLane } from "@/lib/preferences";
import { useState, useEffect } from "react";

interface CrossingCardProps {
  crossing: CrossingSummary;
  onFavToggle?: () => void;
}

const TREND_CONFIG = {
  rising: { icon: TrendingUp, color: "oklch(65% 0.17 25)" },
  falling: { icon: TrendingDown, color: "oklch(72% 0.14 148)" },
  stable: { icon: null, color: "" },
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

  const trend = crossing.trend && crossing.trend !== "stable" ? TREND_CONFIG[crossing.trend] : null;

  const formatAgo = (dateStr: string | null) => {
    if (!dateStr) return tc("noData");
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tc("justNow");
    if (mins < 60) return tc("minsAgo", { mins });
    const hrs = Math.floor(diff / 3600000);
    return tc("hoursAgo", { hrs });
  };

  return (
    <Link href={`/crossing/${crossing.id}`} className="block group">
      <div
        className="rounded-card border border-subtle flex flex-col transition-colors"
        style={{
          background: "#0C1B30",
          padding: "12px 14px",
          gap: 8,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#0F2245")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#0C1B30")}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="font-display font-semibold text-[15px] text-[#F1F5F9] truncate"
                style={{ letterSpacing: -0.3 }}
              >
                {crossing.name}
              </span>
              {trend && trend.icon && (
                <trend.icon size={11} style={{ color: trend.color, flexShrink: 0 }} strokeWidth={2.5} />
              )}
            </div>
            <p className="text-[11px] text-[#475569]">
              {crossing.cityMx}, {MX_STATE_ABBR[crossing.stateMx] ?? crossing.stateMx} &rarr;{" "}
              {crossing.cityUs}, {crossing.stateUs}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Big wait number */}
            {headlineLane && (
              <span
                className="font-display tabular-nums"
                style={{ color: headlineColor, fontWeight: 700, fontSize: 22 }}
              >
                {headlineLane.isClosed
                  ? <span style={{ fontSize: 14 }}>{tc("closed")}</span>
                  : headlineLane.waitMinutes !== null
                  ? (
                    <>
                      {headlineLane.waitMinutes}
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", marginLeft: 1 }}>m</span>
                    </>
                  )
                  : "—"}
              </span>
            )}
            <button
              onClick={handleFav}
              className="p-0.5 transition-colors"
              style={{ color: fav ? "oklch(65% 0.17 25)" : "#334155", fontSize: 15, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
            >
              {fav ? "♥" : "♡"}
            </button>
          </div>
        </div>

        {/* Lane row */}
        <div
          className="flex items-center flex-wrap gap-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 8 }}
        >
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
              <div key={lane.laneType} className="flex items-center gap-1">
                <span
                  className="rounded-full shrink-0"
                  style={{ width: 6, height: 6, background: color, display: "block" }}
                />
                <span className="text-[11px] text-[#475569]">{label}</span>
                <span
                  className="text-[11px] font-semibold font-display tabular-nums"
                  style={{ color }}
                >
                  {lane.isClosed ? tc("closed") : `${lane.waitMinutes}m`}
                </span>
              </div>
            );
          })}
          <span className="text-[10px] text-[#334155] ml-auto">
            {formatAgo(crossing.lastUpdated)}
          </span>
        </div>
      </div>
    </Link>
  );
}
