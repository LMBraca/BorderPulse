"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCrossing, getPredictions } from "@/lib/api";
import { getWaitStatus, STATUS_COLORS, formatWait } from "@/lib/types";
import FreshnessIndicator from "@/components/FreshnessIndicator";
import WaitTimeChart from "@/components/WaitTimeChart";
import WeatherWidget from "@/components/WeatherWidget";
import ExchangeRate from "@/components/ExchangeRate";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import type { CrossingDetail, PredictionResponse } from "@/lib/types";
import { ArrowLeft, Heart } from "lucide-react";
import { getUserTimezone } from "@/lib/timezone";

const MX_STATE_ABBR: Record<string, string> = {
  "Baja California": "BC",
  "Baja California Sur": "BCS",
  Sonora: "Son.",
  Chihuahua: "Chih.",
  Coahuila: "Coah.",
  "Nuevo Leon": "NL",
  "Nuevo León": "NL",
  Tamaulipas: "Tamps.",
};

type LaneTab =
  | "standard_vehicle"
  | "sentri"
  | "ready_lane"
  | "pedestrian"
  | "pedestrian_ready"
  | "commercial";

const LANE_TAB_LABELS: Record<LaneTab, string> = {
  standard_vehicle: "Standard",
  sentri: "SENTRI",
  ready_lane: "Ready Lane",
  pedestrian: "Pedestrian",
  pedestrian_ready: "Ped. Ready",
  commercial: "Commercial",
};

export default function CrossingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crossingId = Number(params.id);

  const [crossing, setCrossing] = useState<CrossingDetail | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(
    null
  );
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
          <p className="text-slate-500 text-sm">Crossing not found</p>
          <button
            onClick={() => router.push("/")}
            className="mt-3 text-slate-300 text-sm hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const primaryLane = crossing.lanes.find((l) => l.laneType === selectedLane);
  const availableLanes = crossing.lanes
    .map((l) => l.laneType as LaneTab)
    .filter((l) => LANE_TAB_LABELS[l]);

  const selectedLaneTypeId = primaryLane?.laneTypeId;

  const heroMinutes = primaryLane?.waitMinutes ?? null;
  const heroIsClosed = primaryLane?.isClosed ?? false;
  const heroStatus = getWaitStatus(heroMinutes, heroIsClosed);
  const heroColor = STATUS_COLORS[heroStatus];

  const sortedLanes = [
    ...crossing.lanes.filter((l) => l.laneType === selectedLane),
    ...crossing.lanes.filter((l) => l.laneType !== selectedLane),
  ];

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-navy-950/95 backdrop-blur-lg border-b border-subtle px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-base text-white truncate">
              {crossing.name}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {crossing.cityMx},{" "}
              {MX_STATE_ABBR[crossing.stateMx] ?? crossing.stateMx} &rarr;{" "}
              {crossing.cityUs}, {crossing.stateUs}
            </p>
          </div>
          <button
            onClick={handleFav}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              fav ? "text-red-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Heart size={18} className={fav ? "fill-current" : ""} />
          </button>
        </div>
      </header>

      <main className="px-4">
        <div className="max-w-2xl mx-auto">
          {/* Lane selector as compact pills — scrollable on overflow */}
          <div className="flex gap-1.5 py-3 overflow-x-auto no-scrollbar">
            {availableLanes.map((lane) => {
              const l = crossing.lanes.find((x) => x.laneType === lane);
              const s = getWaitStatus(l?.waitMinutes ?? null, l?.isClosed);
              const c = STATUS_COLORS[s];
              const isActive = selectedLane === lane;
              return (
                <button
                  key={lane}
                  onClick={() => setSelectedLane(lane)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                    isActive
                      ? "bg-white/[0.08] text-white border-white/[0.1]"
                      : "text-slate-500 border-transparent hover:text-slate-400"
                  }`}
                >
                  <span>{LANE_TAB_LABELS[lane]}</span>
                  {l && !l.isClosed && l.waitMinutes !== null && (
                    <span
                      className="font-display font-semibold tabular-nums"
                      style={{ color: c }}
                    >
                      {l.waitMinutes}m
                    </span>
                  )}
                  {l?.isClosed && (
                    <span className="text-slate-600">Closed</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Main card: hero number + chart */}
          <div className="rounded-xl bg-card border border-subtle p-4 mb-3 overflow-hidden">
            {/* Hero: big wait number */}
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-5xl sm:text-6xl font-display font-bold tabular-nums leading-none"
                  style={{ color: heroColor }}
                >
                  {heroIsClosed
                    ? "—"
                    : heroMinutes !== null
                    ? heroMinutes
                    : "—"}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-400 text-sm sm:text-base leading-none">
                    {heroIsClosed
                      ? "Closed"
                      : heroMinutes !== null
                      ? "min"
                      : "N/A"}
                  </span>
                  {primaryLane?.lanesOpen != null && !heroIsClosed && (
                    <span className="text-[11px] text-slate-600">
                      {primaryLane.lanesOpen} lane
                      {primaryLane.lanesOpen !== 1 ? "s" : ""} open
                    </span>
                  )}
                </div>
              </div>
              <FreshnessIndicator
                lastUpdated={primaryLane?.updatedAt ?? null}
              />
            </div>

            {/* Combined actual + forecast chart */}
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

          {/* Info cards: weather + exchange rate */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-card border border-subtle p-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium mb-1.5">
                Weather
              </p>
              <WeatherWidget
                latitude={crossing.latitude}
                longitude={crossing.longitude}
              />
            </div>
            <div className="rounded-xl bg-card border border-subtle p-3 overflow-hidden">
              <ExchangeRate />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
