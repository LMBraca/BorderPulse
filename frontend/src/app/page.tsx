"use client";

import { useState, useEffect, useCallback } from "react";
import CrossingCard from "@/components/CrossingCard";
import FreshnessIndicator from "@/components/FreshnessIndicator";
import { getCrossings } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import type { CrossingSummary } from "@/lib/types";
import { Search, X, RefreshCw } from "lucide-react";

export default function HomePage() {
  const [crossings, setCrossings] = useState<CrossingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [favIds, setFavIds] = useState<number[]>([]);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getCrossings();
      setCrossings(data);
      setLastFetch(new Date().toISOString());
      setError(null);
    } catch {
      setError("Could not load crossing data");
    } finally {
      setLoading(false);
    }
  }, []);

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
    const key = c.stateUs || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const stateOrder = ["CA", "AZ", "TX"];
  const sortedStates = Object.keys(grouped).sort(
    (a, b) => (stateOrder.indexOf(a) ?? 99) - (stateOrder.indexOf(b) ?? 99)
  );
  // TODO: get these from the API instead of hardcoding
  const stateNames: Record<string, string> = { CA: "California", AZ: "Arizona", TX: "Texas" };

  return (
    <div className="flex flex-col min-h-dvh pb-24 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy-950/95 backdrop-blur-lg border-b border-subtle px-4 lg:px-8 pt-4 pb-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-display font-bold text-lg text-white tracking-tight lg:hidden">
                BorderPulse
              </h1>
              <h1 className="font-display font-bold text-lg text-white tracking-tight hidden lg:block">
                All Crossings
              </h1>
              <FreshnessIndicator lastUpdated={lastFetch} />
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="relative lg:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Search crossings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg text-sm bg-white/[0.04] border border-subtle text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="mt-12 text-center">
              <p className="text-slate-500 text-sm">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 px-4 py-2 rounded-lg bg-white/[0.05] text-slate-300 text-sm font-medium hover:bg-white/[0.08] transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {favorites.length > 0 && (
                <section className="mt-4">
                  <h2 className="font-display font-semibold text-[11px] text-slate-500 uppercase tracking-widest mb-2 pl-1">
                    Favorites
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
                    {favorites.map((c) => (
                      <CrossingCard key={c.id} crossing={c} onFavToggle={refreshFavs} />
                    ))}
                  </div>
                </section>
              )}

              {sortedStates.map((state) => (
                <section key={state} className="mt-5">
                  <h2 className="font-display font-semibold text-[11px] text-slate-500 uppercase tracking-widest mb-2 pl-1">
                    {stateNames[state] || state}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
                    {grouped[state].map((c) => (
                      <CrossingCard key={c.id} crossing={c} onFavToggle={refreshFavs} />
                    ))}
                  </div>
                </section>
              ))}

              {filtered.length === 0 && search && (
                <div className="mt-16 text-center">
                  <p className="text-slate-600 text-sm">
                    No crossings match &ldquo;{search}&rdquo;
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
