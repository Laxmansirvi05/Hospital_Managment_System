// Illustrative 3D map. The real product uses MapLibre with MapTiler tiles (D-08);
// this prototype draws a simplified Hyderabad on a tilted slab so the layout can be judged
// without keys. It is not to scale and says so on screen.
import { h, s, icon } from './h.js';
import { AREAS, YOU } from './data.js';

const W = 1000;
const H = 640;

const KIND_ICON = {
  hospital: 'hospital', doctor: 'doctor', pharmacy: 'pharmacy', diagnostic: 'flask',
  you: 'user', ambulance: 'ambulance', medicine: 'pill',
};

function baseSvg() {
  const blocks = [];
  // A quiet grid of city blocks so the slab reads as a city, not an empty sheet.
  for (let y = 40; y < H - 20; y += 46) {
    for (let x = 30 + ((y / 46) % 2) * 22; x < W - 30; x += 64) {
      const w = 34 + ((x * 7 + y * 3) % 18);
      const hgt = 22 + ((x * 3 + y * 5) % 12);
      blocks.push(s('rect', { x, y, width: w, height: hgt, rx: 4, fill: 'var(--map-block)' }));
    }
  }

  const road = (d, width = 10) => [
    s('path', { d, fill: 'none', stroke: 'var(--map-road-edge)', 'stroke-width': width + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d, fill: 'none', stroke: 'var(--map-road)', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  ];

  return s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Illustrative map of Hyderabad' },
    s('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: 'var(--map-land)' }),
    s('g', {}, blocks),
    // Parks: KBR Park and the Botanical Garden, approximate positions only.
    s('ellipse', { cx: 352, cy: 352, rx: 34, ry: 24, fill: 'var(--map-park)' }),
    s('ellipse', { cx: 140, cy: 286, rx: 40, ry: 26, fill: 'var(--map-park)' }),
    s('ellipse', { cx: 700, cy: 120, rx: 52, ry: 30, fill: 'var(--map-park)' }),
    // Musi river and the lakes.
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
    s('g', {}, AREAS.map((a) => s('text', {
      x: a.x, y: a.y + 30, 'text-anchor': 'middle', fill: 'var(--map-label)', 'font-size': 15, 'font-weight': 600, 'font-family': 'var(--font-sans)',
    }, a.name))),
  );
}

function pct(pt) {
  return `left:${(pt.x / W) * 100}%;top:${(pt.y / H) * 100}%`;
}

function marker(pin) {
  const head = pin.onSelect
    ? h('button', { class: 'marker-head', type: 'button', 'aria-label': pin.label, onclick: pin.onSelect }, icon(KIND_ICON[pin.kind] || 'pin', pin.kind === 'ambulance' ? 24 : 18))
    : h('div', { class: 'marker-head', role: 'img', 'aria-label': pin.label }, icon(KIND_ICON[pin.kind] || 'pin', pin.kind === 'ambulance' ? 24 : 16));
  const classes = ['marker', `marker-${pin.kind}`];
  if (pin.active) classes.push('marker-active');
  return h('div', { class: classes.join(' '), style: pct(pin) },
    h('div', { class: 'marker-shadow' }),
    h('div', { class: 'marker-body' },
      pin.showLabel ? h('span', { class: 'marker-label' }, pin.label) : null,
      head,
      h('div', { class: 'marker-stem' }),
    ),
  );
}

/**
 * @param {{ pins?: any[], you?: boolean, route?: number[][] | null, ambulance?: {x:number,y:number} | null,
 *   tilt?: number, caption?: string, legend?: string[][] | null, label?: string }} options
 */
export function createMap(options = {}) {
  const { pins = [], you = true, youLabel = false, route = null, ambulance = null, tilt = 46, caption = 'Illustrative map, not to scale', legend = null } = options;
  const svg = baseSvg();
  const routeLayer = s('g', {});
  svg.append(routeLayer);

  const plane = h('div', { class: 'map3d-plane', style: `--tilt:${tilt}deg` }, svg);
  const stage = h('div', { class: 'map3d-stage' }, plane);
  const el = h('div', { class: 'map3d' }, stage,
    caption ? h('span', { class: 'map3d-caption' }, caption) : null,
    legend ? h('div', { class: 'map3d-legend' }, legend.map(([k, text]) => h('span', { class: 'row-8' }, icon(KIND_ICON[k], 14), text))) : null,
  );

  if (you) plane.append(marker({ ...YOU, kind: 'you', label: 'Your location', showLabel: youLabel }));
  for (const pin of pins) plane.append(marker(pin));

  let ambulanceEl = null;
  function setAmbulance(pt) {
    if (!pt) return;
    if (!ambulanceEl) {
      ambulanceEl = marker({ ...pt, kind: 'ambulance', label: 'Ambulance', showLabel: false });
      plane.append(ambulanceEl);
    }
    ambulanceEl.style.left = `${(pt.x / W) * 100}%`;
    ambulanceEl.style.top = `${(pt.y / H) * 100}%`;
  }

  function setRoute(points) {
    routeLayer.replaceChildren();
    if (!points || points.length < 2) return;
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    routeLayer.append(
      s('path', { d, fill: 'none', stroke: 'var(--surface)', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      s('path', { d, fill: 'none', stroke: 'var(--primary)', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    );
  }

  setRoute(route);
  setAmbulance(ambulance);
  return { el, setAmbulance, setRoute };
}

/** Point along a polyline at progress t from 0 to 1. */
export function along(points, t) {
  if (t <= 0) return { x: points[0][0], y: points[0][1] };
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(l);
    total += l;
  }
  let target = Math.min(t, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      const f = lengths[i] ? target / lengths[i] : 0;
      return { x: points[i][0] + (points[i + 1][0] - points[i][0]) * f, y: points[i][1] + (points[i + 1][1] - points[i][1]) * f };
    }
    target -= lengths[i];
  }
  const last = points[points.length - 1];
  return { x: last[0], y: last[1] };
}

/** Remaining part of a polyline from progress t. */
export function remaining(points, t) {
  const start = along(points, t);
  const out = [[start.x, start.y]];
  let total = 0;
  const seg = [];
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    seg.push(l);
    total += l;
  }
  let walked = 0;
  for (let i = 0; i < seg.length; i++) {
    walked += seg[i];
    if (walked / total > t) out.push(points[i + 1]);
  }
  return out;
}
