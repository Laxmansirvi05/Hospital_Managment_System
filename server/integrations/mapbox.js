import { distanceKm } from '../db/geo.js';

const FALLBACK_SPEED_KMPH = 30;
const DETOUR_FACTOR = 1.4;

export function straightLineEtas(origin, candidates) {
  return candidates.slice(0, 24).map((candidate) => ({ ...candidate,
    etaSeconds: Math.ceil(distanceKm(origin, candidate) * DETOUR_FACTOR / FALLBACK_SPEED_KMPH * 3600), etaIsEstimate: true }));
}

/** Server-side Matrix API adapter. Provider errors deliberately do not include URL or token. */
export function createMapboxAdapter({ token, fetchImpl = fetch, timeoutMs = 4_000 } = {}) {
  return async function getEtas(origin, candidates) {
    const rows = candidates.slice(0, 24);
    if (!token || rows.length === 0) return straightLineEtas(origin, rows);
    const coordinates = [...rows.map((x) => `${x.lng},${x.lat}`), `${origin.lng},${origin.lat}`].join(';');
    const sources = rows.map((_, i) => i).join(';');
    const destination = rows.length;
    const url = new URL(`https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}`);
    url.searchParams.set('sources', sources); url.searchParams.set('destinations', String(destination)); url.searchParams.set('annotations', 'duration'); url.searchParams.set('access_token', token);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) return straightLineEtas(origin, rows);
      const body = await response.json();
      if (!Array.isArray(body.durations) || body.durations.length !== rows.length || body.durations.some((line) => !Array.isArray(line) || !Number.isFinite(line[0]))) return straightLineEtas(origin, rows);
      return rows.map((row, i) => ({ ...row, etaSeconds: Math.max(0, Math.ceil(body.durations[i][0])), etaIsEstimate: false }));
    } catch {
      return straightLineEtas(origin, rows);
    } finally { clearTimeout(timeout); }
  };
}

export const mapboxFallback = Object.freeze({ speedKmph: FALLBACK_SPEED_KMPH, detourFactor: DETOUR_FACTOR });
