"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

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

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
          });
        }
      })
      .catch(() => {});
  }, [latitude, longitude]);

  if (!weather) return null;

  const codeKey = String(weather.weatherCode);
  const desc = t.has(codeKey) ? t(codeKey) : t("unknown");

  return (
    <div>
      <p className="font-display font-bold text-lg text-white leading-tight">
        {weather.temperature}°F
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
}
