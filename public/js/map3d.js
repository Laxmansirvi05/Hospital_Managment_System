// Illustrative 3D map of Hyderabad. The production map is MapLibre with MapTiler tiles (D-08);
// until the MapTiler key is set this draws a simplified city on a tilted slab and says so.
// Positions come from real latitude and longitude, projected into the same box the seed uses.
import { h, s, icon } from './h.js';

const W = 1000;
const H = 640;
const BOX = { west: 78.30, east: 78.62, north: 17.55, south: 17.30 };

const AREAS = [
  ['Kukatpally', 300, 130], ['Kondapur', 165, 235], ['Madhapur', 225, 318], ['Gachibowli', 120, 410], ['Jubilee Hills', 318, 372],
  ['Banjara Hills', 398, 392], ['Ameerpet', 410, 280], ['Begumpet', 492, 228], ['Secunderabad', 632, 180], ['Somajiguda', 470, 352],
  ['Himayatnagar', 592, 392], ['Tolichowki', 288, 468], ['Charminar', 615, 528], ['Dilsukhnagar', 772, 470], ['Uppal', 850, 290],
];

const KIND_ICON = { hospital: 'hospital', doctor: 'doctor', pharmacy: 'pharmacy', diagnostic: 'flask', you: 'user', medicine: 'pill' };

/** Projects a latitude and longitude onto the grid, clamped to the slab. */
export function project({ lat, lng }) {
  const x = ((lng - BOX.west) / (BOX.east - BOX.west)) * W;
  const y = ((BOX.north - lat) / (BOX.north - BOX.south)) * H;
  return { x: Math.min(W - 10, Math.max(10, x)), y: Math.min(H - 10, Math.max(10, y)) };
}

function road(d, width = 10) {
  return [
    s('path', { d, fill: 'none', stroke: 'var(--map-road-edge)', 'stroke-width': width + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d, fill: 'none', stroke: 'var(--map-road)', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  ];
}

let cachedBase = null;
function baseSvg() {
  if (cachedBase) return cachedBase.cloneNode(true);
  const blocks = [];
  for (let y = 40; y < H - 20; y += 46) {
    for (let x = 30 + ((y / 46) % 2) * 22; x < W - 30; x += 64) {
      blocks.push(s('rect', { x, y, width: 34 + ((x * 7 + y * 3) % 18), height: 22 + ((x * 3 + y * 5) % 12), rx: 4, fill: 'var(--map-block)' }));
    }
  }
  cachedBase = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Illustrative map of Hyderabad' },
    s('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: 'var(--map-land)' }),
    s('g', {}, blocks),
    s('ellipse', { cx: 352, cy: 352, rx: 34, ry: 24, fill: 'var(--map-park)' }),
    s('ellipse', { cx: 140, cy: 286, rx: 40, ry: 26, fill: 'var(--map-park)' }),
    s('ellipse', { cx: 700, cy: 120, rx: 52, ry: 30, fill: 'var(--map-park)' }),
    s('path', { d: 'M0 500 C150 470 300 520 450 490 S700 470 800 500 S950 520 1000 505', fill: 'none', stroke: 'var(--map-water)', 'stroke-width': 16, 'stroke-linecap': 'round' }),
    s('path', { d: 'M520 268 C552 252 588 266 594 296 C600 328 578 346 550 348 C522 350 506 332 504 308 C502 290 506 276 520 268Z', fill: 'var(--map-water)' }),
    s('ellipse', { cx: 262, cy: 352, rx: 22, ry: 14, fill: 'var(--map-water)' }),
    road('M120 410 C150 220 300 84 520 72 C760 70 905 200 905 360 C905 500 780 600 600 612', 8),
    road('M120 410 L225 318 L318 372 L398 392 L470 352 L592 392 L772 470'),
    road('M300 130 L410 280 L478 262 L632 180 L850 290'),
    road('M165 235 L225 318 L288 468 L615 528 L772 470'),
    road('M410 280 L398 392', 7),
    road('M478 262 L470 352', 7),
    road('M632 180 L592 392 L615 528', 7),
    s('text', { x: 548, y: 312, 'text-anchor': 'middle', fill: 'var(--primary-face-side)', 'font-size': 13, 'font-weight': 600, 'font-family': 'var(--font-sans)' }, 'Hussain Sagar'),
    s('g', {}, AREAS.map(([name, x, y]) => s('text', { x, y: y + 30, 'text-anchor': 'middle', fill: 'var(--map-label)', 'font-size': 15, 'font-weight': 600, 'font-family': 'var(--font-sans)' }, name))),
  );
  return cachedBase.cloneNode(true);
}

function marker(pin) {
  const p = project(pin);
  const size = pin.kind === 'you' ? 16 : 18;
  const head = pin.href
    ? h('a', { class: 'marker-head', href: pin.href, 'aria-label': pin.label }, icon(KIND_ICON[pin.kind] || 'pin', size))
    : h('div', { class: 'marker-head', role: 'img', 'aria-label': pin.label }, icon(KIND_ICON[pin.kind] || 'pin', size));
  return h('div', { class: `marker marker-${pin.kind}${pin.active ? ' marker-active' : ''}`, style: `left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%` },
    h('div', { class: 'marker-shadow' }),
    h('div', { class: 'marker-body' },
      pin.showLabel ? h('span', { class: 'marker-label' }, pin.label) : null,
      head,
      h('div', { class: 'marker-stem' })));
}

/**
 * @param {{ pins?: any[], origin?: { lat: number, lng: number } | null, tilt?: number, legend?: [string, string][] | null }} o
 */
export function createMap({ pins = [], origin = null, tilt = 46, legend = null } = {}) {
  const plane = h('div', { class: 'map3d-plane', style: `--tilt:${tilt}deg` }, baseSvg());
  if (origin) plane.append(marker({ ...origin, kind: 'you', label: 'Your location' }));
  for (const pin of pins) plane.append(marker(pin));
  return h('div', { class: 'map3d' },
    h('div', { class: 'map3d-stage' }, plane),
    h('span', { class: 'map3d-caption' }, 'Illustrative map, not to scale'),
    legend ? h('div', { class: 'map3d-legend' }, legend.map(([k, text]) => h('span', { class: 'row-8' }, icon(KIND_ICON[k], 14), text))) : null);
}
