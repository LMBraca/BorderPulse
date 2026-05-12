"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { getCrossing, getPredictions } from "@/lib/api";
import { getWaitStatus, STATUS_COLORS, MX_STATE_ABBR } from "@/lib/types";
import FreshnessIndicator from "@/components/FreshnessIndicator";
import WaitTimeChart from "@/components/WaitTimeChart";
import WeatherWidget from "@/components/WeatherWidget";
import ExchangeRate from "@/components/ExchangeRate";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import dynamic from "next/dynamic";
import type { CrossingDetail, PredictionResponse } from "@/lib/types";
import { ArrowLeft, Heart } from "lucide-react";
import { getUserTimezone } from "@/lib/timezone";

const TrafficMap = dynamic(() => import("@/components/TrafficMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] sm:aspect-square sm:h-auto bg-navy-900/50 animate-pulse rounded-xl" />
  ),
});

type LaneTab =
  | "standard_vehicle"
  | "sentri"
  | "ready_lane"
  | "pedestrian"
  | "pedestrian_ready"
  | "commercial";

export default function CrossingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crossingId = Number(params.id);
  const t = useTranslations("crossing");
  const tc = useTranslations("common");
  const tl = useTranslations("lanes");

  const [crossing, setCrossing] = useState<CrossingDetail | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [selectedLane, setSelectedLane] = useState<LaneTab>("standard_vehicle");
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tz, setTz] = useState("America/Tijuana");

  useEffect(() => {
    setTz(getUserTimezone());
  }, []);

  useEffect(() => {
    if (!crossingId) return;
    setFav(isFavorite(crossingId));

    getCrossing(crossingId)
      .then(setCrossing)
      .catch(() => {})
      .finally(() => setLoading(false));

    getPredictions(crossingId, selectedLane, tz)
      .then(setPredictions)
      .catch(() => {});
  }, [crossingId, selectedLane, tz]);

  useEffect(() => {
    if (!crossingId) return;
    const interval = setInterval(() => {
      getCrossing(crossingId)
        .then(setCrossing)
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [crossingId]);

  const handleFav = () => {
    const nowFav = toggleFavorite(crossingId);
    setFav(nowFav);
  };

  if (loading) {
    return (
      <div className="min-h-dvh p-4 space-y-3 pb-24 lg:pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-64 rounded-xl mt-4" />
          <div className="skeleton h-20 rounded-xl mt-3" />
        </div>
      </div>
    );
  }

  if (!crossing) {
    return (
      <div className="min-h-dvh flex items-center justify-center pb-24 lg:pb-0">
        <div className="text-center">
          <p className="text-slate-500 text-sm">{t("notFound")}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-3 text-slate-300 text-sm hover:underline"
          >
            {t("goBack")}
          </button>
        </div>
      </div>
    );
  }

  const primaryLane = crossing.lanes.find((l) => l.laneType === selectedLane);
  const availableLanes = crossing.lanes
    .map((l) => l.laneType as LaneTab)
    .filter((l) => {
      try { tl(l); return true; } catch { return false; }
    });

  const selectedLaneTypeId = primaryLane?.laneTypeId;

  const heroMinutes = primaryLane?.waitMinutes ?? null;
  const heroIsClosed = primaryLane?.isClosed ?? false;
  const heroStatus = getWaitStatus(heroMinutes, heroIsClosed);
  const heroColor = STATUS_COLORS[heroStatus];

  return (
    <div className="min-h-dvh pb-[110px] lg:pb-10">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-40 border-b border-subtle"
        style={{ background: "rgba(6,14,26,0.96)", backdropFilter: "blur(16px)", padding: "12px 16px" }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            className="shrink-0 transition-colors"
            style={{ color: "#475569", fontSize: 20, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 8, display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-base text-[#F1F5F9] truncate" style={{ letterSpacing: -0.3 }}>
              {crossing.name}
            </h1>
            <p className="text-[11px] text-[#475569] truncate">
              {crossing.cityMx},{" "}
              {MX_STATE_ABBR[crossing.stateMx] ?? crossing.stateMx} &rarr;{" "}
              {crossing.cityUs}, {crossing.stateUs}
            </p>
          </div>
          <button
            onClick={handleFav}
            className="shrink-0 transition-colors"
            style={{ color: fav ? "oklch(65% 0.17 25)" : "#334155", fontSize: 18, background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1 }}
          >
            {fav ? "♥" : "♡"}
          </button>
        </div>
      </header>

      <main className="px-4">
        <div className="max-w-2xl mx-auto">
          {/* Lane tabs — scrollable row */}
          <div
            className="flex gap-1.5 py-2.5 overflow-x-auto no-scrollbar"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
          >
            {availableLanes.map((lane) => {
              const l = crossing.lanes.find((x) => x.laneType === lane);
              const s = getWaitStatus(l?.waitMinutes ?? null, l?.isClosed);
              const c = STATUS_COLORS[s];
              const isActive = selectedLane === lane;
              return (
                <button
                  key={lane}
                  onClick={() => setSelectedLane(lane)}
                  className="flex items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-medium transition-all"
                  style={{
                    padding: "7px 14px",
                    borderRadius: 10,
                    border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "transparent"}`,
                    background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
                    color: isActive ? "#F1F5F9" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  <span>{tl(lane)}</span>
                  {l && !l.isClosed && l.waitMinutes !== null && (
                    <span className="font-display font-bold tabular-nums" style={{ color: c }}>
                      {l.waitMinutes}m
                    </span>
                  )}
                  {l?.isClosed && (
                    <span style={{ color: "#475569" }}>{tc("closed")}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hero wait-time card */}
          <div
            className="overflow-hidden mt-3 mb-3"
            style={{
              background: "#0C1B30",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18,
              padding: "22px 22px 18px",
            }}
          >
            <div className="flex items-end justify-between mb-5">
              {/* Big number */}
              <div className="flex items-baseline gap-3">
                <span
                  className="font-display tabular-nums leading-none"
                  style={{ color: heroColor, fontWeight: 800, fontSize: "clamp(76px, 10vw, 88px)" }}
                >
                  {heroIsClosed ? "—" : heroMinutes !== null ? heroMinutes : "—"}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[18px] text-[#475569]">
                    {heroIsClosed ? tc("closed") : heroMinutes !== null ? tc("min") : tc("na")}
                  </span>
                  {primaryLane?.lanesOpen != null && !heroIsClosed && (
                    <span className="text-[11px] text-[#334155]">
                      {t("lanesOpen", { count: primaryLane.lanesOpen })}
                    </span>
                  )}
                </div>
              </div>
              {/* Best time / freshness */}
              <div className="text-right pb-1 shrink-0">
                <FreshnessIndicator lastUpdated={primaryLane?.updatedAt ?? null} />
              </div>
            </div>

            <div className="overflow-hidden">
              <WaitTimeChart
                recentHistory={crossing.recentHistory}
                predictions={predictions?.hourly ?? []}
                bestTime={predictions?.bestTime ?? null}
                laneTypeId={selectedLaneTypeId}
                timezone={tz}
              />
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div
              className="overflow-hidden"
              style={{ background: "#0C1B30", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}
            >
              <p className="text-[10px] text-[#334155] uppercase font-bold mb-2" style={{ letterSpacing: 0.8 }}>
                {t("weather")}
              </p>
              <WeatherWidget latitude={crossing.latitude} longitude={crossing.longitude} />
            </div>
            <div
              className="overflow-hidden"
              style={{ background: "#0C1B30", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}
            >
              <p className="text-[10px] text-[#334155] uppercase font-bold mb-2" style={{ letterSpacing: 0.8 }}>
                {t("exchangeRate") ?? "Exchange"}
              </p>
              <ExchangeRate />
            </div>
          </div>

          {/* Traffic map */}
          <div
            className="overflow-hidden mb-3"
            style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", height: 200 }}
          >
            <TrafficMap latitude={crossing.latitude} longitude={crossing.longitude} />
          </div>
        </div>
      </main>
    </div>
  );
}
