"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import CrossingCard from "@/components/CrossingCard";
import { getCrossings } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import type { CrossingSummary } from "@/lib/types";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";

export default function HomePage() {
  const t = useTranslations("home");
  const tc = useTranslations("common");

  const [crossings, setCrossings] = useState<CrossingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [favIds, setFavIds] = useState<number[]>([]);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getCrossings();
      setCrossings(data);
      setLastFetch(new Date().toISOString());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Find the most recent CBP data timestamp across all crossings
  const dataLastUpdated = crossings.reduce<string | null>((latest, c) => {
    if (c.lastUpdated && (!latest || c.lastUpdated > latest)) return c.lastUpdated;
    return latest;
  }, null);

  const CBP_STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  const dataAge = dataLastUpdated ? Date.now() - new Date(dataLastUpdated).getTime() : null;
  const isCbpStale = crossings.length > 0 && (dataAge === null || dataAge > CBP_STALE_THRESHOLD);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    setFavIds(getFavorites());
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const refreshFavs = () => setFavIds(getFavorites());

  const filtered = crossings.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.cityUs.toLowerCase().includes(q) ||
      c.cityMx.toLowerCase().includes(q) ||
      c.stateUs.toLowerCase().includes(q)
    );
  });

  const favorites = filtered.filter((c) => favIds.includes(c.id));
  const others = filtered.filter((c) => !favIds.includes(c.id));

  const grouped = others.reduce<Record<string, CrossingSummary[]>>((acc, c) => {
    const key = (c.stateUs || "Other").toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const stateOrder = ["CA", "AZ", "NM", "TX"];
  const sortedStates = Object.keys(grouped).sort((a, b) => {
    const aIdx = stateOrder.indexOf(a);
    const bIdx = stateOrder.indexOf(b);
    const aRank = aIdx === -1 ? 99 : aIdx;
    const bRank = bIdx === -1 ? 99 : bIdx;
    return aRank - bRank;
  });

  return (
    <div className="flex flex-col min-h-dvh pb-[110px] lg:pb-10">
      <header
        className="sticky top-0 z-40 border-b border-subtle"
        style={{ background: "rgba(6,14,26,0.96)", backdropFilter: "blur(16px)", padding: "14px 16px 12px" }}
      >
        <div className="max-w-[1200px] mx-auto lg:px-7">
          <div className="flex items-center gap-3 mb-2.5">
            {/* Mobile: wordmark + live dot */}
            <div className="lg:hidden">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="animate-live-pulse w-1.5 h-1.5 rounded-full bg-status-green inline-block" />
                <span className="text-[10px] font-bold tracking-[0.5px]" style={{ color: "oklch(72% 0.14 148)" }}>LIVE</span>
              </div>
              <h1 className="font-display font-bold text-[20px] text-[#F1F5F9]" style={{ letterSpacing: -0.5 }}>
                {tc("appName")}
              </h1>
            </div>
            {/* Desktop: section heading */}
            <h1 className="hidden lg:block font-display font-bold text-[17px] text-[#F1F5F9] flex-1" style={{ letterSpacing: -0.3 }}>
              {t("allCrossings")}
            </h1>
            <div className="flex-1 lg:hidden" />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-[11px] text-[#475569] rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", padding: "5px 10px", borderRadius: 8 }}
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {tc("refresh")}
            </button>
          </div>

          <div className="relative lg:max-w-[320px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#334155" }} />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-[13px] text-[#94A3B8] placeholder:text-[#334155] focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "8px 30px 8px 32px",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px]"
                style={{ color: "#334155", background: "none", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {isCbpStale && (
        <div className="bg-yellow-400/10 border-b border-yellow-400/20 px-4 lg:px-8 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-400/90">
              {dataAge !== null
                ? tc("cbpStale", {
                    time: dataAge >= 86400000
                      ? tc("daysAgo", { days: Math.floor(dataAge / 86400000), hrs: Math.floor((dataAge % 86400000) / 3600000) })
                      : dataAge >= 3600000
                        ? tc("hoursAgo", { hrs: Math.floor(dataAge / 3600000) })
                        : tc("minsAgo", { mins: Math.floor(dataAge / 60000) })
                  })
                : tc("cbpNoData")}
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 lg:px-7">
        <div className="max-w-[1200px] mx-auto">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-[88px] rounded-card" />
              ))}
            </div>
          )}

          {error && (
            <div className="mt-12 text-center">
              <p className="text-[#475569] text-sm">{t("loadError")}</p>
              <button
                onClick={fetchData}
                className="mt-3 px-4 py-2 text-[#94A3B8] text-sm font-medium transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8 }}
              >
                {tc("retry")}
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {favorites.length > 0 && (
                <section className="mt-4 mb-[18px]">
                  <p className="text-[10px] font-bold text-[#334155] uppercase mb-2 pl-0.5" style={{ letterSpacing: 1.2 }}>
                    ★ {t("favorites")}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {favorites.map((c) => (
                      <CrossingCard key={c.id} crossing={c} onFavToggle={refreshFavs} />
                    ))}
                  </div>
                </section>
              )}

              {sortedStates.map((state) => (
                <section key={state} className="mb-[18px]">
                  <p className="text-[10px] font-bold text-[#334155] uppercase mb-2 pl-0.5" style={{ letterSpacing: 1.2 }}>
                    {t(`states.${state}`) || state}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {grouped[state].map((c) => (
                      <CrossingCard key={c.id} crossing={c} onFavToggle={refreshFavs} />
                    ))}
                  </div>
                </section>
              ))}

              {filtered.length === 0 && search && (
                <div className="mt-16 text-center">
                  <p className="text-[#334155] text-sm">
                    {t("noResults", { query: search })}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
