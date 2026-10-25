// 3D objects for page heads (D-61), drawn as isometric blocks with one flat colour per face, so
// they read as solid objects without gradients (D-16). Decorative: hidden from screen readers.
import { s } from './h.js';

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const iso = (x, y, z) => [(x - y) * COS, (x + y) * SIN - z];
const pts = (list) => list.map(([x, y, z]) => iso(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');

/** A block from (x, y, z) with width w (x), depth d (y) and height hgt (z). */
function block(x, y, z, w, d, hgt, tone = '') {
  const t = tone ? `art-${tone}-` : 'art-';
  return [
    s('polygon', { class: `${t}left`, points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + hgt], [x, y + d, z + hgt]]) }),
    s('polygon', { class: `${t}right`, points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + hgt], [x + w, y, z + hgt]]) }),
    s('polygon', { class: `${t}top`, points: pts([[x, y, z + hgt], [x + w, y, z + hgt], [x + w, y + d, z + hgt], [x, y + d, z + hgt]]) }),
  ];
}

/** A flat shape on the left (front) face of a block, given in that face's own x and z. */
const onFront = (y, cls, list) => s('polygon', { class: cls, points: pts(list.map(([x, z]) => [x, y, z])) });
const ground = (w, d) => s('polygon', { class: 'art-ground', points: pts([[-8, -8, 0], [w + 8, -8, 0], [w + 8, d + 8, 0], [-8, d + 8, 0]]) });

const SCENES = {
  hospital: () => [
    ground(120, 70),
    ...block(0, 0, 0, 120, 70, 60),
    ...block(30, 10, 60, 60, 50, 24, 'blue'),
    // Windows on the front face.
    ...[10, 34, 82, 106].flatMap((x) => [onFront(70, 'art-window', [[x, 12], [x + 14, 12], [x + 14, 26], [x, 26]]), onFront(70, 'art-window', [[x, 34], [x + 14, 34], [x + 14, 48], [x, 48]])]),
    // The red cross over the door.
    onFront(70, 'art-red-left', [[54, 30], [66, 30], [66, 54], [54, 54]]),
    onFront(70, 'art-red-left', [[48, 36], [72, 36], [72, 48], [48, 48]]),
  ],
  doctor: () => [
    ground(90, 90),
    ...block(0, 0, 0, 90, 90, 16),
    ...block(20, 20, 16, 50, 50, 56, 'blue'),
    onFront(70, 'art-top', [[38, 30], [52, 30], [52, 60], [38, 60]]),
    onFront(70, 'art-top', [[30, 38], [60, 38], [60, 52], [30, 52]]),
  ],
  medicine: () => [
    ground(110, 70),
    ...block(0, 0, 0, 70, 50, 70),
    ...block(0, 0, 70, 70, 50, 10, 'blue'),
    onFront(50, 'art-red-left', [[29, 24], [41, 24], [41, 52], [29, 52]]),
    onFront(50, 'art-red-left', [[21, 32], [49, 32], [49, 44], [21, 44]]),
    ...block(80, 30, 0, 26, 26, 26, 'blue'),
    ...block(80, 30, 26, 26, 26, 22),
  ],
  diagnostic: () => [
    ground(110, 80),
    ...block(0, 0, 0, 110, 80, 14),
    ...block(14, 16, 14, 18, 18, 66, 'blue'),
    ...block(46, 16, 14, 18, 18, 46, 'red'),
    ...block(78, 16, 14, 18, 18, 30),
  ],
  chart: () => [
    ground(120, 60),
    ...block(0, 0, 0, 120, 60, 8),
    ...block(10, 15, 8, 24, 30, 30),
    ...block(48, 15, 8, 24, 30, 58, 'blue'),
    ...block(86, 15, 8, 24, 30, 82, 'blue'),
  ],
  document: () => [
    ground(90, 110),
    ...block(10, 10, 0, 80, 100, 6),
    ...block(5, 5, 6, 80, 100, 6),
    ...block(0, 0, 12, 80, 100, 6),
    ...block(20, 20, 18, 40, 6, 3, 'blue'),
    ...block(20, 36, 18, 50, 6, 3),
    ...block(20, 52, 18, 50, 6, 3),
    ...block(20, 68, 18, 34, 6, 3),
  ],
  settings: () => [
    ground(100, 100),
    ...block(0, 0, 0, 100, 100, 18),
    ...block(25, 25, 18, 50, 50, 16, 'blue'),
    ...block(40, 40, 34, 20, 20, 12),
  ],
  shield: () => [
    ground(100, 60),
    ...block(0, 0, 0, 100, 60, 10),
    ...block(25, 20, 10, 50, 20, 70, 'blue'),
    onFront(40, 'art-top', [[38, 36], [46, 28], [62, 52], [56, 56]]),
  ],
};

/** The 3D object for a page, or null when the name is unknown. */
export function art3d(name) {
  const scene = SCENES[name];
  if (!scene) return null;
  const parts = scene();
  // Fit the viewBox to the drawing with a margin.
  const nums = parts.flatMap((p) => (p.getAttribute('points') || '').split(' ').map((xy) => xy.split(',').map(Number))).filter((a) => a.length === 2 && !Number.isNaN(a[0]));
  const xs = nums.map((n) => n[0]);
  const ys = nums.map((n) => n[1]);
  const pad = 6;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const hgt = Math.max(...ys) - minY + pad;
  return s('svg', { class: 'hero-art', viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${hgt.toFixed(0)}`, 'aria-hidden': 'true', focusable: 'false' }, parts);
}
