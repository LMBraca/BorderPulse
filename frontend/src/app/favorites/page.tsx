"use client";

import { useState, useEffect, useCallback } from "react";
import CrossingCard from "@/components/CrossingCard";
import { getCrossings } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import type { CrossingSummary } from "@/lib/types";
import { Heart } from "lucide-react";
import Link from "next/link";

export default function FavoritesPage() {
  const [crossings, setCrossings] = useState<CrossingSummary[]>([]);
  const [favIds, setFavIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const ids = getFavorites();
    setFavIds(ids);
    try {
      const data = await getCrossings();
      setCrossings(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const favorites = crossings.filter((c) => favIds.includes(c.id));

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      <header className="px-4 lg:px-8 pt-6 pb-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-display font-bold text-lg text-white">
            Saved Crossings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your frequently used border crossings
          </p>
        </div>
      </header>

      <main className="px-4 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && favorites.length === 0 && (
            <div className="mt-20 text-center">
              <div className="w-14 h-14 rounded-xl bg-card border border-subtle mx-auto flex items-center justify-center mb-4">
                <Heart size={24} className="text-slate-700" />
              </div>
              <p className="text-slate-400 text-sm font-medium">No favorites yet</p>
              <p className="text-slate-600 text-xs mt-1 max-w-[200px] mx-auto">
                Tap the heart icon on any crossing to save it here
              </p>
              <Link
                href="/"
                className="inline-block mt-5 px-4 py-2 rounded-lg bg-white/[0.05] text-slate-300 text-sm font-medium hover:bg-white/[0.08] transition-colors"
              >
                Browse Crossings
              </Link>
            </div>
          )}

          {!loading && favorites.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
              {favorites.map((c) => (
                <CrossingCard
                  key={c.id}
                  crossing={c}
                  onFavToggle={() => setFavIds(getFavorites())}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
