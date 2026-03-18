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

interface PredictionChartProps {
  hourly: HourlyPrediction[];
  bestTime: BestTimeSuggestion | null;
  timezone: string;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const conf =
    data.confidence === "high"
      ? "Reliable"
      : data.confidence === "medium"
      ? "Moderate"
      : "Limited data";

  return (
    <div className="rounded-lg px-3 py-2 text-sm bg-navy-800 border border-subtle shadow-lg">
      <div className="font-display font-semibold text-white">
        {formatHour(data.hour)}: ~{data.predictedWait} min
      </div>
      {data.p25Wait !== null && (
        <div className="text-xs text-slate-400">
          Range: {data.p25Wait}–{data.p75Wait} min
        </div>
      )}
      <div className="text-xs text-slate-600 mt-0.5">{conf}</div>
    </div>
  );
};

export default function PredictionChart({
  hourly,
  bestTime,
  timezone,
}: PredictionChartProps) {
  if (hourly.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        Not enough data for predictions yet
      </div>
    );
  }

  const currentHour = getCurrentHourInTimezone(timezone);

  const chartData = hourly.map((h) => ({
    ...h,
    hour: h.hour,
    label: formatHour(h.hour),
  }));

  return (
    <div>
      {bestTime && (
        <div className="rounded-lg px-3 py-2.5 mb-4 bg-white/[0.03] border border-subtle">
          <p className="text-sm text-slate-300">{bestTime.message}</p>
          {bestTime.confidence === "low" && (
            <p className="text-xs text-slate-600 mt-1">
              Based on limited data — treat as a rough estimate
            </p>
          )}
        </div>
      )}

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="waitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#94A3B8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              tick={{ fill: "#475569", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              unit="m"
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              dataKey="predictedWait"
              stroke="#94A3B8"
              strokeWidth={1.5}
              fill="url(#waitGrad)"
              type="monotone"
              dot={false}
              activeDot={{ r: 3, fill: "#E2E8F0", strokeWidth: 0 }}
            />

            <ReferenceLine
              x={formatHour(currentHour)}
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="3 3"
              label={{
                value: "Now",
                position: "top",
                fill: "#64748B",
                fontSize: 10,
              }}
            />

            {bestTime?.bestHour !== null && bestTime?.bestHour !== undefined && (
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

      <p className="text-[10px] text-slate-700 mt-2 text-center">
        Based on historical patterns · Not a guarantee
      </p>
    </div>
  );
}
