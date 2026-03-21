"use client";

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";

const CONGESTION_COLORS: Record<string, string> = {
  low: "#34D399",
  moderate: "#FBBF24",
  heavy: "#FB923C",
  severe: "#F87171",
  unknown: "#475569",
};

const BOUNDS_PAD = 0.04;

interface TrafficMapProps {
  latitude: number;
  longitude: number;
}

function getBounds(
  lat: number,
  lng: number
): [[number, number], [number, number]] {
  return [
    [lng - BOUNDS_PAD, lat - BOUNDS_PAD],
    [lng + BOUNDS_PAD, lat + BOUNDS_PAD],
  ];
}

export default function TrafficMap({
  latitude,
  longitude,
}: TrafficMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }

    let cancelled = false;
    const bounds = getBounds(latitude, longitude);

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (!document.getElementById("mapbox-gl-css")) {
        const link = document.createElement("link");
        link.id = "mapbox-gl-css";
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = token;

      const style =
        process.env.NEXT_PUBLIC_MAPBOX_STYLE ||
        "mapbox://styles/mapbox/standard";

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style,
        config: {
          basemap: {
            lightPreset: "dawn",
          },
        },
        center: [longitude, latitude],
        zoom: 16,
        pitch: 45,
        bearing: 0,
        minZoom: 12,
        maxZoom: 22,
        maxBounds: bounds,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      new mapboxgl.Marker({ color: "#60A5FA" })
        .setLngLat([longitude, latitude])
        .addTo(map);

      map.on("load", () => {
        if (cancelled) return;

        if (!map.getSource("mapbox-traffic")) {
          map.addSource("mapbox-traffic", {
            type: "vector",
            url: "mapbox://mapbox.mapbox-traffic-v1",
          });
        }

        const layers = map.getStyle().layers ?? [];
        const firstLabelLayerId = layers.find(
          (l) => l.type === "symbol" && l.layout?.["text-field"]
        )?.id;

        if (!map.getLayer("traffic-flow")) {
          map.addLayer(
            {
              id: "traffic-flow",
              type: "line",
              source: "mapbox-traffic",
              "source-layer": "traffic",
              filter: [
                "in",
                ["get", "class"],
                [
                  "literal",
                  [
                    "motorway",
                    "motorway_link",
                    "trunk",
                    "trunk_link",
                    "primary",
                    "primary_link",
                    "secondary",
                    "tertiary",
                    "street",
                  ],
                ],
              ],
              paint: {
                "line-width": [
                  "match",
                  ["get", "class"],
                  "motorway", 5,
                  "motorway_link", 4,
                  "trunk", 4.5,
                  "trunk_link", 3.5,
                  "primary", 4,
                  "primary_link", 3,
                  "secondary", 3.5,
                  "tertiary", 3,
                  "street", 2.5,
                  2.5,
                ],
                "line-color": [
                  "match",
                  ["get", "congestion"],
                  "low", CONGESTION_COLORS.low,
                  "moderate", CONGESTION_COLORS.moderate,
                  "heavy", CONGESTION_COLORS.heavy,
                  "severe", CONGESTION_COLORS.severe,
                  CONGESTION_COLORS.unknown,
                ],
                "line-opacity": 0.95,
                "line-emissive-strength": 1,
                "line-offset": 1.5,
              },
            },
            firstLabelLayerId
          );
        }
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
    />
  );
}