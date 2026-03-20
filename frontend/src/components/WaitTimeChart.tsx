"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { HourlyPrediction, BestTimeSuggestion } from "@/lib/types";
import { getCurrentHourInTimezone } from "@/lib/timezone";

interface WaitTimeChartProps {
  recentHistory: { observedAt: string; laneTypeId: number; waitMinutes: number | null }[];
  predictions: HourlyPrediction[];
  bestTime: BestTimeSuggestion | null;
  laneTypeId?: number;
  timezone: string;
}

interface ChartPoint {
  time: number;
  label: string;
  actual: number | null;
  predicted: number | null;
  p25: number | null;
  p75: number | null;
  confidence?: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  if (m === 0) {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  }
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as ChartPoint | undefined;
  if (!data) return null;

  const wait = data.actual ?? data.predicted;
  if (wait === null) return null;

  const isPrediction = data.actual === null;

  return (
    <div className="rounded-lg px-3 py-2 text-sm bg-navy-800 border border-subtle shadow-lg">
      <div className="font-display font-semibold text-white">
        {data.label}: {isPrediction ? "~" : ""}{Math.round(wait)} min
      </div>
      {isPrediction && data.p25 !== null && data.p75 !== null && (
        <div className="text-xs text-slate-400">
          Range: {data.p25}–{data.p75} min
        </div>
      )}
      <div className="text-xs text-slate-600 mt-0.5">
        {isPrediction ? "Forecast" : "Actual"}
        {isPrediction && data.confidence && ` · ${
          data.confidence === "high" ? "Reliable" : data.confidence === "medium" ? "Moderate" : "Limited data"
        }`}
      </div>
    </div>
  );
};

export default function WaitTimeChart({
  recentHistory,
  predictions,
  bestTime,
  laneTypeId,
  timezone,
}: WaitTimeChartProps) {
  const now = Date.now();
  const sixHoursAgo = now - 6 * 60 * 60 * 1000;
  const currentHour = getCurrentHourInTimezone(timezone);

  // --- Build actual data points from recent history ---
  const actualPoints: ChartPoint[] = recentHistory
    .filter((d) => {
      if (d.waitMinutes === null) return false;
      if (new Date(d.observedAt).getTime() < sixHoursAgo) return false;
      if (laneTypeId !== undefined && d.laneTypeId !== laneTypeId) return false;
      return true;
    })
    .reverse()
    .map((d) => {
      const ts = new Date(d.observedAt).getTime();
      return {
        time: ts,
        label: formatTime(ts),
        actual: d.waitMinutes!,
        predicted: null,
        p25: null,
        p75: null,
      };
    });

  // --- Build prediction points for future hours ---
  const today = new Date();
  const futureHours = predictions.filter((h) => h.hour >= currentHour);
  const predictionPoints: ChartPoint[] = futureHours.map((h) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h.hour, 0, 0);
    return {
      time: d.getTime(),
      label: formatHour(h.hour),
      actual: null,
      predicted: h.predictedWait,
      p25: h.p25Wait,
      p75: h.p75Wait,
      confidence: h.confidence,
    };
  });

  // --- Bridge point: connect actual to predicted ---
  // Add a "now" point using the last actual value as both actual and predicted start
  const bridgePoints: ChartPoint[] = [];
  if (actualPoints.length > 0 && predictionPoints.length > 0) {
    const lastActual = actualPoints[actualPoints.length - 1];
    bridgePoints.push({
      time: now,
      label: "Now",
      actual: lastActual.actual,
      predicted: lastActual.actual, // seamless connection
      p25: null,
      p75: null,
    });
  }

  const allPoints = [...actualPoints, ...bridgePoints, ...predictionPoints];

  if (allPoints.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        Not enough data yet
      </div>
    );
  }

  // Y-axis domain
  const allWaits = allPoints.map((p) => p.actual ?? p.predicted ?? 0);
  const minWait = Math.min(...allWaits);
  const maxWait = Math.max(...allWaits);
  const yPad = Math.max(2, (maxWait - minWait) * 0.15);

  // Find "Now" index for reference line
  const nowLabel = bridgePoints.length > 0 ? "Now" : undefined;

  // X-axis tick interval — aim for ~6 labels
  const tickInterval = Math.max(1, Math.floor(allPoints.length / 6));

  return (
    <div>
      {bestTime && (
        <div className="rounded-lg px-3 py-2.5 mb-3 bg-white/[0.03] border border-subtle overflow-hidden">
          <p className="text-sm text-slate-300 break-words">{bestTime.message}</p>
          {bestTime.confidence === "low" && (
            <p className="text-xs text-slate-600 mt-1">
              Based on limited data — treat as a rough estimate
            </p>
          )}
        </div>
      )}

      <div className="h-44 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={allPoints} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="predictGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#94A3B8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              tick={{ fill: "#475569", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              domain={[Math.max(0, Math.floor(minWait - yPad)), Math.ceil(maxWait + yPad)]}
              tick={{ fill: "#475569", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              unit="m"
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Actual observations — solid blue */}
            <Area
              dataKey="actual"
              stroke="#60A5FA"
              strokeWidth={2}
              fill="url(#actualGrad)"
              type="monotone"
              dot={false}
              activeDot={{ r: 3, fill: "#60A5FA", strokeWidth: 0 }}
              connectNulls={false}
            />

            {/* Predictions — dashed gray */}
            <Area
              dataKey="predicted"
              stroke="#94A3B8"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#predictGrad)"
              type="monotone"
              dot={false}
              activeDot={{ r: 3, fill: "#E2E8F0", strokeWidth: 0 }}
              connectNulls={false}
            />

            {/* "Now" divider */}
            {nowLabel && (
              <ReferenceLine
                x={nowLabel}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="3 3"
                label={{
                  value: "Now",
                  position: "top",
                  fill: "#64748B",
                  fontSize: 10,
                }}
              />
            )}

            {/* Best time marker */}
            {bestTime?.bestHour != null && bestTime.bestHour > currentHour && (
              <ReferenceLine
                x={formatHour(bestTime.bestHour)}
                stroke="#34D399"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-blue-400 rounded-full shrink-0" />
          <span className="text-[10px] text-slate-600">Actual</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-slate-400 rounded-full shrink-0" style={{ borderTop: "1px dashed #94A3B8" }} />
          <span className="text-[10px] text-slate-600">Forecast (90d avg)</span>
        </div>
      </div>
    </div>
  );
}
