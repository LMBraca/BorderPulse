"use client";

import { useTranslations } from "next-intl";

interface FreshnessIndicatorProps {
  lastUpdated: string | null;
  dataLastUpdated?: string | null;
}

export default function FreshnessIndicator({ lastUpdated, dataLastUpdated }: FreshnessIndicatorProps) {
  const t = useTranslations("common");

  const displayTime = dataLastUpdated || lastUpdated;
  const isStale = !displayTime || Date.now() - new Date(displayTime).getTime() > 600000;

  const getAgo = (): string => {
    if (!displayTime) return t("noData");
    const diff = Date.now() - new Date(displayTime).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("justNow");
    if (mins < 60) return t("minsAgo", { mins });
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return t("hoursAgo", { hrs });
    const days = Math.floor(hrs / 24);
    return t("daysAgo", { days, hrs: hrs % 24 });
  };

  const ago = getAgo();

  return (
    <span className={`text-xs ${isStale ? "text-yellow-400/70" : "text-slate-500"}`}>
      {isStale ? `${t("stale")} · ${ago}` : ago}
    </span>
  );
}
