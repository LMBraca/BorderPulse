"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getTemperatureUnit, type TemperatureUnit } from "@/lib/preferences";

interface WeatherData {
  temperature: number;
  weatherCode: number;
}

interface WeatherWidgetProps {
  latitude: number;
  longitude: number;
}

export default function WeatherWidget({ latitude, longitude }: WeatherWidgetProps) {
  const t = useTranslations("weather");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit>("fahrenheit");

  useEffect(() => {
    setUnit(getTemperatureUnit());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=${unit}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, unit]);

  if (!weather) return null;

  const codeKey = String(weather.weatherCode);
  const desc = t.has(codeKey) ? t(codeKey) : t("unknown");
  const unitLabel = unit === "celsius" ? "°C" : "°F";

  return (
    <div>
      <p className="font-display font-bold text-lg text-white leading-tight">
        {weather.temperature}{unitLabel}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
}
