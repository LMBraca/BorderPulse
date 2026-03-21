"use client";

import { useTranslations } from "next-intl";

interface FreshnessIndicatorProps {
  lastUpdated: string | null;
}

export default function FreshnessIndicator({ lastUpdated }: FreshnessIndicatorProps) {
  const t = useTranslations("common");
  const isStale = !lastUpdated || Date.now() - new Date(lastUpdated).getTime() > 600000;

  const getAgo = (): string => {
    if (!lastUpdated) return t("noData");
    const diff = Date.now() - new Date(lastUpdated).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("justNow");
    if (mins < 60) return t("minsAgo", { mins });
    const hrs = Math.floor(mins / 60);
    return t("hoursAgo", { hrs });
  };

  const ago = getAgo();

  return (
    <span className={`text-xs ${isStale ? "text-yellow-400/70" : "text-slate-500"}`}>
      {isStale ? `${t("stale")} · ${ago}` : ago}
    </span>
  );
}
