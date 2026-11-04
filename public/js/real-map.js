// A small real map for search results and listing pages (2026-11-04): OpenStreetMap tiles, the
// places as numbered pins, and the patient's location. It fits everything in view, can be dragged
// and zoomed, and credits OpenStreetMap as its licence requires. The full map is on Explore.
import { h, icon } from './h.js';

const TILE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;

function project({ lat, lng }, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}
function unproject({ x, y }, zoom) {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / scale) * 360 - 180 };
}
const valid = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

/**
 * pins: [{ lat, lng, label, href, kind }], origin: { lat, lng, label } or null.
 * Returns the element; call `.update({ pins, origin })` on it to redraw without rebuilding.
 */
export function createRealMap({ pins = [], origin = null, height = 300, label = 'Map of these places' } = {}) {
  const state = { pins: [], origin: null, center: { lat: 17.4, lng: 78.48 }, zoom: 12 };
  const tiles = h('div', { class: 'rmap-tiles', 'aria-hidden': 'true' });
  const marks = h('div', { class: 'rmap-marks' });
  const view = h('div', { class: 'rmap-view' }, tiles, marks);
  const zoomIn = h('button', { class: 'icon-btn rmap-btn', type: 'button', 'aria-label': 'Zoom in' }, icon('plus', 20));
  const zoomOut = h('button', { class: 'icon-btn rmap-btn', type: 'button', 'aria-label': 'Zoom out' }, icon('minus', 20));
  const fitBtn = h('button', { class: 'icon-btn rmap-btn', type: 'button', 'aria-label': 'Show all places' }, icon('locate', 20));
  const el = h('div', { class: 'rmap', role: 'group', 'aria-label': label, style: `--rmap-h:${height}px` },
    view,
    h('div', { class: 'rmap-controls' }, zoomIn, zoomOut, fitBtn),
    h('p', { class: 'rmap-credit' }, 'Map ', h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener noreferrer' }, '© OpenStreetMap contributors')));

  const size = () => ({ w: view.clientWidth || 360, h: view.clientHeight || height });

  function fit() {
    const pts = [...state.pins, ...(state.origin ? [state.origin] : [])];
    if (!pts.length) return;
    const { w, h: ht } = size();
    let zoom = MAX_ZOOM - 2;
    for (; zoom > MIN_ZOOM; zoom--) {
      const xy = pts.map((p) => project(p, zoom));
      const xs = xy.map((p) => p.x);
      const ys = xy.map((p) => p.y);
      if (Math.max(...xs) - Math.min(...xs) < w - 80 && Math.max(...ys) - Math.min(...ys) < ht - 80) break;
    }
    const xy = pts.map((p) => project(p, zoom));
    const mid = { x: (Math.min(...xy.map((p) => p.x)) + Math.max(...xy.map((p) => p.x))) / 2, y: (Math.min(...xy.map((p) => p.y)) + Math.max(...xy.map((p) => p.y))) / 2 };
    state.zoom = zoom;
    state.center = unproject(mid, zoom);
  }

  function render() {
    const { w, h: ht } = size();
    const c = project(state.center, state.zoom);
    const left = c.x - w / 2;
    const top = c.y - ht / 2;
    const n = 2 ** state.zoom;
    const frag = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + ht) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const x = ((tx % n) + n) % n;
        // OpenStreetMap refuses tile requests from a browser that sends no Referer (a 403 "Access
        // blocked" tile), so tiles keep the site's policy, which sends only the origin.
        const img = h('img', { class: 'rmap-tile', alt: '', decoding: 'async', referrerpolicy: 'strict-origin-when-cross-origin', src: `https://tile.openstreetmap.org/${state.zoom}/${x}/${ty}.png` });
        img.style.transform = `translate(${tx * TILE - left}px, ${ty * TILE - top}px)`;
        frag.push(img);
      }
    }
    tiles.replaceChildren(...frag);
    const place = (p, node) => {
      const q = project(p, state.zoom);
      node.style.transform = `translate(${q.x - left}px, ${q.y - top}px)`;
      return node;
    };
    // A label near the right edge would run under the map buttons or off the map, so it opens leftwards.
    const nearRight = (p) => project(p, state.zoom).x - left > w - 220;
    const pinNodes = state.pins.map((p, i) => place(p, h(p.href ? 'a' : 'span', {
      class: `rmap-pin rmap-pin-${p.kind || 'place'}${i === 0 ? ' is-first' : ''}${nearRight(p) ? ' is-left' : ''}`,
      ...(p.href ? { href: p.href } : {}),
      'aria-label': `${i + 1}. ${p.label}`,
      title: p.label,
    }, h('span', { class: 'rmap-pin-dot' }, String(i + 1)), i === 0 && p.label ? h('span', { class: 'rmap-pin-label' }, p.label) : null)));
    const you = state.origin ? [place(state.origin, h('span', { class: 'rmap-you', role: 'img', 'aria-label': state.origin.label ? `You, ${state.origin.label}` : 'Your location' }, h('span', { class: 'rmap-you-dot' })))] : [];
    marks.replaceChildren(...you, ...pinNodes);
  }

  let drag = null;
  // Once the patient drags or zooms, a resize keeps their view instead of fitting all places again.
  let touched = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('a')) return;
    drag = { x: e.clientX, y: e.clientY, c: project(state.center, state.zoom) };
    touched = true;
    view.setPointerCapture?.(e.pointerId);
    view.classList.add('is-dragging');
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.center = unproject({ x: drag.c.x - (e.clientX - drag.x), y: drag.c.y - (e.clientY - drag.y) }, state.zoom);
    render();
  });
  const end = () => { drag = null; view.classList.remove('is-dragging'); };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  const zoomBy = (d) => {
    touched = true;
    state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom + d));
    render();
  };
  zoomIn.addEventListener('click', () => zoomBy(1));
  zoomOut.addEventListener('click', () => zoomBy(-1));
  fitBtn.addEventListener('click', () => { touched = false; fit(); render(); });
  new ResizeObserver(() => { if (!touched) fit(); render(); }).observe(view);

  el.update = ({ pins: p = state.pins, origin: o = state.origin } = {}) => {
    state.pins = p.filter(valid).map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng) }));
    state.origin = valid(o) ? { ...o, lat: Number(o.lat), lng: Number(o.lng) } : null;
    fit();
    render();
  };
  el.update({ pins, origin });
  return el;
}
