"use client";

import { useEffect, useState } from "react";
import type { CrossingMapMarker } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { getMapMarkers } from "@/lib/api";

let MapContainer: any;
let TileLayer: any;
let CircleMarker: any;
let Popup: any;

interface BorderMapProps {
  onMarkerClick?: (id: number) => void;
}

function MarkerPopup({ marker }: { marker: CrossingMapMarker }) {
  const color = STATUS_COLORS[marker.status];
  return (
    <div className="text-center min-w-[120px]">
      <div className="font-display font-semibold text-sm">{marker.name}</div>
      {marker.worstWait !== null ? (
        <div className="mt-1">
          <span className="text-lg font-bold font-display tabular-nums" style={{ color }}>
            {marker.worstWait}
          </span>
          <span className="text-xs text-slate-400 ml-1">min</span>
        </div>
      ) : (
        <div className="text-xs text-slate-500 mt-1">No data</div>
      )}
    </div>
  );
}

export default function BorderMap({ onMarkerClick }: BorderMapProps) {
  const [markers, setMarkers] = useState<CrossingMapMarker[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("react-leaflet").then((rl) => {
      MapContainer = rl.MapContainer;
      TileLayer = rl.TileLayer;
      CircleMarker = rl.CircleMarker;
      Popup = rl.Popup;
      setLeafletReady(true);
    });
  }, []);

  useEffect(() => {
    getMapMarkers()
      .then(setMarkers)
      .catch(() => setError("Could not load map data"));

    const interval = setInterval(() => {
      getMapMarkers().then(setMarkers).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        {error}
      </div>
    );
  }

  if (!leafletReady) {
    return <div className="w-full h-full skeleton" />;
  }

  const center: [number, number] = [31.0, -108.0];

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {markers.map((marker) => {
        const color = STATUS_COLORS[marker.status];
        const radius = marker.worstWait !== null
          ? Math.max(6, Math.min(14, marker.worstWait / 5))
          : 5;

        return (
          <CircleMarker
            key={marker.id}
            center={[marker.latitude, marker.longitude]}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.5,
              weight: 1.5,
              opacity: 0.8,
            }}
            eventHandlers={{
              click: () => onMarkerClick?.(marker.id),
            }}
          >
            <Popup>
              <MarkerPopup marker={marker} />
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
