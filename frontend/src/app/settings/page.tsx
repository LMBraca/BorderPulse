"use client";

import { useState, useEffect } from "react";
import { Info, Globe } from "lucide-react";
import { BORDER_TIMEZONES, getUserTimezone, setUserTimezone } from "@/lib/timezone";

export default function SettingsPage() {
  const [tz, setTz] = useState("America/Tijuana");

  useEffect(() => {
    setTz(getUserTimezone());
  }, []);

  const handleTzChange = (value: string) => {
    setTz(value);
    setUserTimezone(value);
  };

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      <header className="px-4 lg:px-8 pt-6 pb-4">
        <div className="max-w-lg mx-auto lg:mx-0">
          <h1 className="font-display font-bold text-lg text-white">Settings</h1>
        </div>
      </header>

      <main className="px-4 lg:px-8">
        <div className="max-w-lg mx-auto lg:mx-0 space-y-3">
          {/* Timezone */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <Globe size={18} className="text-slate-400" />
              <div>
                <h3 className="font-display font-semibold text-sm text-white">Timezone</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Used for prediction times and &ldquo;best time to cross&rdquo;
                </p>
              </div>
            </div>
            <select
              value={tz}
              onChange={(e) => handleTzChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-subtle text-white focus:outline-none focus:border-slate-600 transition-colors"
            >
              {BORDER_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value} className="bg-navy-800">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* About */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <Info size={18} className="text-slate-400" />
              <h3 className="font-display font-semibold text-sm text-white">About</h3>
            </div>
            <div className="text-sm text-slate-500 leading-relaxed space-y-2">
              <p>
                Real-time US-Mexico border wait times and predictions.
                Data from the CBP Border Wait Times API, updated roughly
                every 15 minutes.
              </p>
              <p>
                Predictions based on historical day-of-week and hour-of-day
                patterns. They improve as data accumulates.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
