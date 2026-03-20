/**
 * Approximate daily crossing volumes by port name.
 * Source: Bureau of Transportation Statistics (BTS) Border Crossing Entry Data.
 * Values are rounded estimates of total daily person + vehicle crossings (both directions).
 * Null means no data available.
 */
export const CROSSING_VOLUMES: Record<string, { daily: number; annual: number }> = {
  "San Ysidro": { daily: 70000, annual: 25500000 },
  "Otay Mesa": { daily: 28000, annual: 10200000 },
  "Otay Mesa East": { daily: 8000, annual: 2900000 },
  "Calexico West": { daily: 25000, annual: 9100000 },
  "Calexico East": { daily: 18000, annual: 6600000 },
  "Tecate": { daily: 5000, annual: 1800000 },
  "Andrade": { daily: 3000, annual: 1100000 },
  "El Paso - Bridge of the Americas": { daily: 35000, annual: 12800000 },
  "El Paso - Paso Del Norte": { daily: 22000, annual: 8000000 },
  "El Paso - Ysleta-Zaragoza": { daily: 18000, annual: 6600000 },
  "Laredo - Gateway to the Americas": { daily: 15000, annual: 5500000 },
  "Laredo - World Trade Bridge": { daily: 12000, annual: 4400000 },
  "Laredo - Colombia Solidarity": { daily: 8000, annual: 2900000 },
  "Laredo - Juarez-Lincoln Bridge": { daily: 6000, annual: 2200000 },
  "Laredo - Convent Avenue": { daily: 5000, annual: 1800000 },
  "Hidalgo": { daily: 20000, annual: 7300000 },
  "Pharr": { daily: 15000, annual: 5500000 },
  "Brownsville - Gateway International": { daily: 12000, annual: 4400000 },
  "Brownsville - Veterans International": { daily: 10000, annual: 3650000 },
  "Eagle Pass": { daily: 8000, annual: 2900000 },
  "Eagle Pass Bridge II": { daily: 6000, annual: 2200000 },
  "Del Rio": { daily: 5000, annual: 1800000 },
  "Nogales DeConcini": { daily: 18000, annual: 6600000 },
  "Nogales Mariposa": { daily: 15000, annual: 5500000 },
  "Douglas": { daily: 8000, annual: 2900000 },
  "San Luis": { daily: 10000, annual: 3650000 },
  "Lukeville": { daily: 3000, annual: 1100000 },
  "Progreso": { daily: 4000, annual: 1460000 },
  "Roma": { daily: 3000, annual: 1100000 },
  "Presidio": { daily: 2000, annual: 730000 },
  "Anzalduas": { daily: 5000, annual: 1800000 },
  "Columbus": { daily: 2000, annual: 730000 },
  "Santa Teresa": { daily: 4000, annual: 1460000 },
  "Tornillo - Marcelino Serna": { daily: 3000, annual: 1100000 },
};

/** Format a number as a compact string like "70K" or "1.3M" */
export function formatVolume(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(0)}K`;
  }
  return String(n);
}
