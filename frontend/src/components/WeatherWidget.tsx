"use client";

import { useState, useEffect } from "react";

interface WeatherData {
  temperature: number;
  weatherCode: number;
}

const WMO_CODES: Record<number, [string, string]> = {
  0: ["Clear", "clear"],
  1: ["Mostly clear", "clear"],
  2: ["Partly cloudy", "cloudy"],
  3: ["Overcast", "cloudy"],
  45: ["Fog", "fog"],
  48: ["Rime fog", "fog"],
  51: ["Light drizzle", "rain"],
  53: ["Drizzle", "rain"],
  55: ["Heavy drizzle", "rain"],
  56: ["Freezing drizzle", "rain"],
  57: ["Heavy freezing drizzle", "rain"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"],
  67: ["Heavy freezing rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "rain"],
  81: ["Showers", "rain"],
  82: ["Heavy showers", "rain"],
  85: ["Light snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm w/ hail", "storm"],
  99: ["Severe thunderstorm", "storm"],
};

function getWeatherInfo(code: number): [string, string] {
  return WMO_CODES[code] ?? ["Unknown", "clear"];
}

interface WeatherWidgetProps {
  latitude: number;
  longitude: number;
}

export default function WeatherWidget({
  latitude,
  longitude,
}: WeatherWidgetProps) {
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

  const [desc] = getWeatherInfo(weather.weatherCode);

  return (
    <div>
      <p className="font-display font-bold text-lg text-white leading-tight">
        {weather.temperature}°F
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
}
