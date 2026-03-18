"use client";

import { formatTimeAgo } from "@/lib/types";

interface FreshnessIndicatorProps {
  lastUpdated: string | null;
}

export default function FreshnessIndicator({ lastUpdated }: FreshnessIndicatorProps) {
  const ago = formatTimeAgo(lastUpdated);
  const isStale = !lastUpdated || Date.now() - new Date(lastUpdated).getTime() > 600000;

  return (
    <span className={`text-xs ${isStale ? "text-yellow-400/70" : "text-slate-500"}`}>
      {isStale ? `Stale · ${ago}` : ago}
    </span>
  );
}
