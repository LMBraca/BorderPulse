// localStorage for now, might move to server-side if accounts are added
const FAVORITES_KEY = "borderpulse_favorites";

export function getFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorite(crossingId: number): boolean {
  return getFavorites().includes(crossingId);
}

export function toggleFavorite(crossingId: number): boolean {
  const favs = getFavorites();
  const idx = favs.indexOf(crossingId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return false;
  } else {
    favs.push(crossingId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return true;
  }
}
