"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import CrossingCard from "@/components/CrossingCard";
import { getCrossings } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import type { CrossingSummary } from "@/lib/types";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function FavoritesPage() {
  const t = useTranslations("favorites");
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
    <div className="flex flex-col min-h-dvh pb-[110px] lg:pb-10">
      <header
        className="sticky top-0 z-40 border-b border-subtle"
        style={{ background: "rgba(6,14,26,0.96)", backdropFilter: "blur(16px)", padding: "14px 16px" }}
      >
        <div className="max-w-[1200px] mx-auto lg:px-7">
          <h1 className="font-display font-bold text-[18px] text-[#F1F5F9]" style={{ letterSpacing: -0.4 }}>
            {t("title")}
          </h1>
          <p className="text-[11px] text-[#475569] mt-0.5">
            {favorites.length} {t("subtitle")}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 lg:px-7">
        <div className="max-w-[1200px] mx-auto pt-3">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-[88px] rounded-card" />
              ))}
            </div>
          )}

          {!loading && favorites.length === 0 && (
            <div className="mt-20 text-center">
              <div className="text-[36px] text-[#334155] mb-3.5">♡</div>
              <p className="text-[#475569] text-sm mb-1.5">{t("empty")}</p>
              <p className="text-[#334155] text-xs">{t("emptyHint")}</p>
              <Link
                href="/"
                className="inline-block mt-5 px-4 py-2 text-[#94A3B8] text-sm font-medium transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8 }}
              >
                {t("browseCrossings")}
              </Link>
            </div>
          )}

          {!loading && favorites.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
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
