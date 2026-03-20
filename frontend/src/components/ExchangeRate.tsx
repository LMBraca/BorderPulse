"use client";

import { useState, useEffect } from "react";

const CACHE_KEY = "bp_exchange_rate";
const CACHE_TTL = 60 * 60 * 1000;

function getCached(): { rate: number; prevRate: number | null } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return { rate: parsed.rate, prevRate: parsed.prevRate ?? null };
  } catch {
    return null;
  }
}

function setCache(rate: number, prevRate: number | null) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ rate, prevRate, ts: Date.now() })
    );
  } catch {}
}

export default function ExchangeRate() {
  const [rate, setRate] = useState<number | null>(null);
  const [prevRate, setPrevRate] = useState<number | null>(null);

  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setRate(cached.rate);
      setPrevRate(cached.prevRate);
      return;
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    fetch(
      `https://api.frankfurter.app/${fmt(weekAgo)}..${fmt(today)}?from=USD&to=MXN`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.rates) {
          const entries = Object.entries(data.rates) as [string, any][];
          const latest = entries[entries.length - 1]?.[1]?.MXN ?? null;
          const prev = entries.length >= 2 ? entries[entries.length - 2]?.[1]?.MXN : null;
          if (latest) {
            setRate(latest);
            setPrevRate(prev);
            setCache(latest, prev);
          }
        }
      })
      .catch(() => {});
  }, []);

  if (rate === null) return null;

  const change = prevRate ? rate - prevRate : null;
  const isUp = change !== null && change > 0;

  return (
    <div>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium mb-1.5">
        USD / MXN
      </p>
      <p className="font-display font-bold text-lg text-white leading-tight">
        ${rate.toFixed(2)}
      </p>
      {change !== null && (
        <p
          className={`text-xs mt-0.5 ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {isUp ? "+" : ""}
          {change.toFixed(2)} today
        </p>
      )}
    </div>
  );
}
