// Where the patient is, for every page that sorts or maps by distance (2026-11-04).
//
// Three sources, in the order a patient meets them: the default (Begumpet), an area they choose, or
// their live location from the browser, which follows them while the page is open. The point stays
// in this browser tab (sessionStorage); it reaches CareRoute's server only inside a search, and no
// other service. Area names come from CareRoute's own listings (GET /areas/centroids).
import { h, icon, toast } from './h.js';
import { api } from './api.js';

const KEY = 'careroute.origin';
const LIVE_KEY = 'careroute.origin.live';
// Live updates smaller than this are noise from the device, not movement.
const MOVE_METRES = 150;

export const DEFAULT_ORIGIN = { lat: 17.447656, lng: 78.45216, label: 'Begumpet', source: 'default' };

const listeners = new Set();
let watchId = null;
let centroids = null;

const read = (store, key) => {
  try {
    return JSON.parse(store.getItem(key) || 'null');
  } catch {
    // Blocked or corrupt storage: nothing was kept.
    return null;
  }
};
const write = (store, key, value) => {
  try {
    if (value === null) store.removeItem(key); else store.setItem(key, JSON.stringify(value));
  } catch {
    // Without storage the choice lasts until the page closes.
  }
};

export function getOrigin() {
  const saved = read(sessionStorage, KEY);
  return saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng) ? saved : DEFAULT_ORIGIN;
}

/** Metres between two points (haversine). */
export function metresBetween(a, b) {
  const r = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function setOrigin(next) {
  write(sessionStorage, KEY, next);
  for (const fn of listeners) fn(next);
}

/** Calls `fn(origin)` whenever the location changes. Returns a function that stops listening. */
export function onOriginChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Area centre points from CareRoute's listings, fetched once per page. */
export async function areaCentroids() {
  if (!centroids) centroids = api('/areas/centroids').then((r) => r.areas).catch(() => []);
  return centroids;
}

async function nearestAreaName(point) {
  const areas = await areaCentroids();
  let best = null;
  for (const a of areas) {
    const d = metresBetween(point, a);
    if (!best || d < best.d) best = { name: a.name, d };
  }
  // Further than 4 km from any area's centre is not "in" it.
  return best && best.d <= 4000 ? best.name : null;
}

/** Uses an area's centre as the location. */
export async function chooseArea(name) {
  const area = (await areaCentroids()).find((a) => a.name === name);
  if (!area) throw new Error('That area is not in CareRoute’s listings.');
  stopLive();
  setOrigin({ lat: area.lat, lng: area.lng, label: area.name, source: 'area' });
}

export function resetOrigin() {
  stopLive();
  write(sessionStorage, KEY, null);
  for (const fn of listeners) fn(DEFAULT_ORIGIN);
}

export const isLive = () => watchId !== null;

const geoError = (err) => (err?.code === 1
  ? 'Location is blocked for this site. Allow it in the browser settings, or choose an area.'
  : 'Your location could not be found just now. Choose an area instead.');

/**
 * Follows the device's location while the page is open. Resolves with the first position, or
 * rejects with a message a patient can act on. The choice is remembered for this tab, so the next
 * page carries on without asking again.
 */
export function startLive() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This browser cannot share location. Choose an area instead.')); return; }
    stopLive(false);
    let first = true;
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      const point = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) };
      const current = getOrigin();
      if (!first && current.source === 'live' && metresBetween(current, point) < MOVE_METRES) return;
      const area = await nearestAreaName(point);
      setOrigin({ ...point, label: area ? `near ${area}` : 'your location', source: 'live', accuracy: Math.round(pos.coords.accuracy) });
      write(sessionStorage, LIVE_KEY, true);
      if (first) { first = false; resolve(getOrigin()); }
    }, (err) => {
      // After the first fix, a passing "unavailable" or timeout is normal between readings; keep
      // following. Only a refused permission, or no first fix at all, ends live location.
      if (!first && err?.code !== 1) return;
      const wasFirst = first;
      stopLive();
      if (wasFirst) reject(new Error(geoError(err)));
      else toast(geoError(err));
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  });
}

export function stopLive(forget = true) {
  const was = watchId !== null;
  if (was) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (forget) write(sessionStorage, LIVE_KEY, null);
  // Only a real change is announced, so pages do not redraw for nothing.
  if (was) for (const fn of listeners) fn(getOrigin());
}

/** One-time position, kept for older callers (SOS). */
export function locateMe() {
  return startLive().then((o) => o);
}

// A tab that chose live location carries on following it on every page, without a new prompt.
// (Guarded so the module can also be imported outside a browser, as the unit tests do.)
if (typeof window !== 'undefined' && read(sessionStorage, LIVE_KEY) && navigator.permissions?.query) {
  navigator.permissions.query({ name: 'geolocation' }).then((p) => {
    if (p.state === 'granted') startLive().catch(() => write(sessionStorage, LIVE_KEY, null));
  }, () => {});
}

/**
 * The bar every distance-sorted page shows: where distances are measured from, live or not, and
 * the controls to follow the device, choose an area or go back to the default.
 */
export function locationBar() {
  const text = h('span', { class: 'loc-text' });
  const badge = h('span', { class: 'loc-live', hidden: true }, 'Live');
  const live = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' });
  const select = h('select', { class: 'select loc-area', 'aria-label': 'Choose an area' }, h('option', { value: '' }, 'Choose an area'));
  const bar = h('div', { class: 'loc-bar', role: 'group', 'aria-label': 'Your location' },
    h('span', { class: 'loc-icon', 'aria-hidden': 'true' }, icon('locate', 20)),
    h('span', { class: 'loc-main' }, text, badge), live, select);
  const status = h('span', { class: 'visually-hidden', role: 'status' });
  bar.append(status);

  function paint(o = getOrigin()) {
    text.textContent = o.source === 'live'
      ? `Distances from your live location${o.label && o.label !== 'your location' ? `, ${o.label}` : ''}`
      : o.source === 'area' ? `Distances from ${o.label}` : `Distances from ${o.label} (default)`;
    badge.hidden = !isLive();
    live.replaceChildren(icon('locate', 20), isLive() ? 'Stop live location' : 'Use my live location');
    if (o.source === 'area') select.value = o.label;
    else select.value = '';
  }
  live.addEventListener('click', async () => {
    if (isLive()) {
      stopLive();
      status.textContent = 'Live location stopped.';
      return;
    }
    live.disabled = true;
    try {
      const o = await startLive();
      status.textContent = `Following your live location, ${o.label}.`;
    } catch (err) {
      toast(err.message);
    } finally {
      live.disabled = false;
    }
  });
  select.addEventListener('change', async () => {
    if (!select.value) return;
    try {
      await chooseArea(select.value);
      status.textContent = `Distances now from ${select.value}.`;
    } catch (err) {
      toast(err.message);
    }
  });
  areaCentroids().then((areas) => {
    select.append(...areas.map((a) => h('option', { value: a.name }, a.name)));
    paint();
  });
  onOriginChange(paint);
  paint();
  return bar;
}
