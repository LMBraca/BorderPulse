"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCrossing, getPredictions } from "@/lib/api";
import { LaneWaitRow, WaitTimeHero } from "@/components/WaitTimeDisplay";
import FreshnessIndicator from "@/components/FreshnessIndicator";
import PredictionChart from "@/components/PredictionChart";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import type { CrossingDetail, PredictionResponse } from "@/lib/types";
import { ArrowLeft, Heart, Clock, Sparkles } from "lucide-react";
import { getUserTimezone } from "@/lib/timezone";

type LaneTab = "standard_vehicle" | "sentri" | "ready_lane" | "pedestrian" | "commercial";

const LANE_TAB_LABELS: Record<LaneTab, string> = {
  standard_vehicle: "Standard",
  sentri: "SENTRI",
  ready_lane: "Ready Lane",
  pedestrian: "Pedestrian",
  commercial: "Commercial",
};

export default function CrossingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crossingId = Number(params.id);

  const [crossing, setCrossing] = useState<CrossingDetail | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [selectedLane, setSelectedLane] = useState<LaneTab>("standard_vehicle");
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"live" | "predict">("live");
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
      getCrossing(crossingId).then(setCrossing).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [crossingId]);

  const handleFav = () => {
    const nowFav = toggleFavorite(crossingId);
    setFav(nowFav);
  };

  if (loading) {
    return (
      <div className="min-h-dvh p-4 lg:p-8 space-y-3 pb-24 lg:pb-0">
        <div className="max-w-4xl mx-auto">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
            <div className="skeleton h-48 rounded-xl" />
            <div className="skeleton h-48 rounded-xl" />
          </div>
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

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-navy-950/95 backdrop-blur-lg border-b border-subtle px-4 lg:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-base text-white truncate">
              {crossing.name}
            </h1>
            <p className="text-xs text-slate-500">
              {crossing.cityUs}, {crossing.stateUs} → {crossing.cityMx}
            </p>
          </div>
          <button
            onClick={handleFav}
            className={`p-2 rounded-lg transition-colors ${
              fav ? "text-red-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Heart size={18} className={fav ? "fill-current" : ""} />
          </button>
        </div>
      </header>

      <main className="px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Lane type tabs */}
          <div className="flex gap-1.5 overflow-x-auto py-3 no-scrollbar">
            {availableLanes.map((lane) => (
              <button
                key={lane}
                onClick={() => setSelectedLane(lane)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedLane === lane
                    ? "bg-white/[0.08] text-white border-white/[0.1]"
                    : "bg-transparent text-slate-500 border-transparent hover:text-slate-400"
                }`}
              >
                {LANE_TAB_LABELS[lane]}
              </button>
            ))}
          </div>

          {/* Hero wait time */}
          <div className="rounded-xl bg-card border border-subtle p-4 mb-3">
            <WaitTimeHero
              minutes={primaryLane?.waitMinutes ?? null}
              isClosed={primaryLane?.isClosed}
              label={LANE_TAB_LABELS[selectedLane]}
            />
            <div className="flex justify-center">
              <FreshnessIndicator lastUpdated={primaryLane?.updatedAt ?? null} />
            </div>
          </div>

          {/* Mobile: toggle between sections */}
          <div className="lg:hidden flex gap-1 mb-3 p-1 rounded-lg bg-white/[0.02] border border-subtle">
            <button
              onClick={() => setActiveSection("live")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                activeSection === "live"
                  ? "bg-white/[0.06] text-white"
                  : "text-slate-500"
              }`}
            >
              <Clock size={14} />
              All Lanes
            </button>
            <button
              onClick={() => setActiveSection("predict")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                activeSection === "predict"
                  ? "bg-white/[0.06] text-white"
                  : "text-slate-500"
              }`}
            >
              <Sparkles size={14} />
              Predictions
            </button>
          </div>

          {/* Desktop: side-by-side | Mobile: toggled */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {/* Live lanes — always visible on desktop, toggled on mobile */}
            <div className={`${activeSection !== "live" ? "hidden lg:block" : ""}`}>
              <div className="rounded-xl bg-card border border-subtle p-4 h-full">
                <h3 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Clock size={13} />
                  Current Wait Times
                </h3>
                <div className="divide-y divide-subtle">
                  {crossing.lanes.map((lane) => (
                    <LaneWaitRow key={lane.laneType} lane={lane} />
                  ))}
                </div>
              </div>
            </div>

            {/* Predictions — always visible on desktop, toggled on mobile */}
            <div className={`${activeSection !== "predict" ? "hidden lg:block" : ""}`}>
              <div className="rounded-xl bg-card border border-subtle p-4 h-full">
                <h3 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  Today&apos;s Forecast — {LANE_TAB_LABELS[selectedLane]}
                </h3>
                <PredictionChart
                  hourly={predictions?.hourly ?? []}
                  bestTime={predictions?.bestTime ?? null}
                  timezone={tz}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
