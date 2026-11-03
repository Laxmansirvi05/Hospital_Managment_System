// 3D objects for page heads (D-61) and the 3D icons on cards (2026-11-04), drawn as isometric blocks
// with one flat colour per face, so they read as solid objects without gradients (D-16). Each scene
// has one moving part (a beacon, a pulse, a rising bar); styles in app.css decide when it moves.
// Decorative: hidden from screen readers.
import { h, s } from './h.js';

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
/** The part of a scene that moves; `motion` names its animation in app.css. */
const moving = (motion, ...parts) => s('g', { class: `a3 a3-${motion}` }, parts.flat());
const cross = (y, x, z, size, cls = 'art-red-left') => {
  const t = size / 3;
  return [onFront(y, cls, [[x + t, z], [x + 2 * t, z], [x + 2 * t, z + size], [x + t, z + size]]), onFront(y, cls, [[x, z + t], [x + size, z + t], [x + size, z + 2 * t], [x, z + 2 * t]])];
};

const SCENES = {
  hospital: () => [
    ground(120, 70),
    ...block(0, 0, 0, 120, 70, 60),
    moving('bob', block(30, 10, 60, 60, 50, 24, 'blue')),
    // Windows on the front face.
    ...[10, 34, 82, 106].flatMap((x) => [onFront(70, 'art-window', [[x, 12], [x + 14, 12], [x + 14, 26], [x, 26]]), onFront(70, 'art-window', [[x, 34], [x + 14, 34], [x + 14, 48], [x, 48]])]),
    // The red cross over the door.
    moving('pulse', cross(70, 48, 30, 24)),
  ],
  doctor: () => [
    ground(90, 90),
    ...block(0, 0, 0, 90, 90, 16),
    ...block(20, 20, 16, 50, 50, 56, 'blue'),
    moving('pulse', cross(70, 30, 30, 30, 'art-top')),
  ],
  medicine: () => [
    ground(110, 70),
    ...block(0, 0, 0, 70, 50, 70),
    ...block(0, 0, 70, 70, 50, 10, 'blue'),
    ...cross(50, 21, 24, 28),
    ...block(80, 30, 0, 26, 26, 26, 'blue'),
    moving('bob', block(80, 30, 26, 26, 26, 22)),
  ],
  pharmacy: () => [
    ground(110, 70),
    ...block(0, 0, 0, 110, 70, 50),
    ...block(-4, -4, 50, 118, 78, 6, 'blue'),
    onFront(70, 'art-window', [[12, 0], [44, 0], [44, 36], [12, 36]]),
    onFront(70, 'art-window', [[60, 14], [98, 14], [98, 36], [60, 36]]),
    // The pharmacy sign: a cross standing on the roof.
    moving('bob', block(48, 30, 56, 14, 10, 40, 'red'), block(34, 30, 69, 42, 10, 14, 'red')),
  ],
  diagnostic: () => [
    ground(110, 80),
    ...block(0, 0, 0, 110, 80, 14),
    moving('grow', block(14, 16, 14, 18, 18, 66, 'blue')),
    moving('grow a3-late', block(46, 16, 14, 18, 18, 46, 'red')),
    moving('grow a3-later', block(78, 16, 14, 18, 18, 30)),
  ],
  chart: () => [
    ground(120, 60),
    ...block(0, 0, 0, 120, 60, 8),
    moving('grow', block(10, 15, 8, 24, 30, 30)),
    moving('grow a3-late', block(48, 15, 8, 24, 30, 58, 'blue')),
    moving('grow a3-later', block(86, 15, 8, 24, 30, 82, 'blue')),
  ],
  document: () => [
    ground(90, 110),
    ...block(10, 10, 0, 80, 100, 6),
    ...block(5, 5, 6, 80, 100, 6),
    moving('bob',
      block(0, 0, 12, 80, 100, 6),
      block(20, 20, 18, 40, 6, 3, 'blue'),
      block(20, 36, 18, 50, 6, 3),
      block(20, 52, 18, 50, 6, 3),
      block(20, 68, 18, 34, 6, 3)),
  ],
  settings: () => [
    ground(100, 100),
    ...block(0, 0, 0, 100, 100, 18),
    ...block(25, 25, 18, 50, 50, 16, 'blue'),
    moving('press', block(40, 40, 34, 20, 20, 12)),
  ],
  shield: () => [
    ground(100, 60),
    ...block(0, 0, 0, 100, 60, 10),
    ...block(25, 20, 10, 50, 20, 70, 'blue'),
    moving('pulse', onFront(40, 'art-top', [[38, 36], [46, 28], [62, 52], [56, 56]])),
  ],
  ambulance: () => [
    ground(116, 50),
    moving('drive',
      block(0, 0, 6, 76, 50, 62),
      block(76, 0, 6, 38, 50, 44),
      onFront(50, 'art-window', [[84, 28], [106, 28], [106, 42], [84, 42]]),
      onFront(50, 'art-red-left', [[0, 20], [114, 20], [114, 27], [0, 27]]),
      cross(50, 24, 32, 26),
      block(12, 44, 0, 20, 8, 16, 'dark'),
      block(82, 44, 0, 20, 8, 16, 'dark')),
    // The beacon on the roof flashes.
    moving('blink', block(28, 18, 68, 20, 14, 10, 'red')),
  ],
  calendar: () => [
    ground(100, 50),
    // A desk calendar standing up, its page facing the viewer.
    ...block(0, 24, 0, 100, 22, 84),
    ...block(0, 24, 84, 100, 22, 18, 'blue'),
    ...block(18, 30, 100, 8, 8, 12, 'dark'),
    ...block(74, 30, 100, 8, 8, 12, 'dark'),
    ...[[12, 52], [36, 52], [60, 52], [12, 28], [36, 28], [84, 28], [12, 6], [36, 6], [60, 6], [84, 6]].map(([x, z]) => onFront(46, 'art-right', [[x, z], [x + 14, z], [x + 14, z + 14], [x, z + 14]])),
    // Today.
    moving('pop', onFront(46, 'art-red-left', [[58, 26], [76, 26], [76, 44], [58, 44]])),
  ],
  pill: () => [
    ground(110, 60),
    ...block(0, 30, 0, 110, 30, 8),
    ...[8, 30].flatMap((x) => block(x, 36, 8, 16, 16, 8)),
    // A capsule, half red and half blue, hops off the tray.
    moving('hop', block(48, 20, 14, 30, 26, 26, 'red'), block(78, 20, 14, 30, 26, 26, 'blue')),
  ],
  idcard: () => [
    ground(110, 40),
    // An ID card standing up.
    ...block(0, 26, 0, 110, 10, 76),
    onFront(36, 'art-blue-left', [[0, 60], [110, 60], [110, 76], [0, 76]]),
    onFront(36, 'art-blue-left', [[10, 12], [38, 12], [38, 48], [10, 48]]),
    ...[[48, 38, 52], [48, 26, 40], [48, 14, 30]].map(([x, z, w]) => onFront(36, 'art-right', [[x, z], [x + w, z], [x + w, z + 5], [x, z + 5]])),
    // A reader's line passes over it.
    moving('scan', onFront(36, 'art-red-left', [[-4, 54], [114, 54], [114, 57], [-4, 57]])),
  ],
  assistant: () => [
    ground(100, 74),
    ...block(0, 0, 0, 100, 60, 34, 'blue'),
    ...block(10, 60, 0, 18, 14, 14, 'blue'),
    moving('dot', onFront(60, 'art-top', [[22, 13], [32, 13], [32, 21], [22, 21]])),
    moving('dot a3-late', onFront(60, 'art-top', [[45, 13], [55, 13], [55, 21], [45, 21]])),
    moving('dot a3-later', onFront(60, 'art-top', [[68, 13], [78, 13], [78, 21], [68, 21]])),
  ],
  pin: () => [
    ground(80, 80),
    ...block(30, 30, 0, 20, 20, 2, 'dark'),
    moving('bob', block(36, 36, 2, 8, 8, 40, 'dark'), block(24, 24, 42, 32, 32, 30, 'red'), block(34, 34, 72, 12, 12, 3)),
  ],
};

// At icon size a flat stack of paper is a sliver, so icons show the document standing up.
const ICON_SCENES = {
  document: () => [
    ground(84, 40),
    ...block(10, 16, 0, 74, 8, 96),
    moving('bob',
      block(0, 26, 0, 74, 8, 96),
      onFront(34, 'art-blue-left', [[12, 74], [44, 74], [44, 82], [12, 82]]),
      [58, 46, 34, 22].map((z, i) => onFront(34, 'art-right', [[12, z], [i === 3 ? 44 : 62, z], [i === 3 ? 44 : 62, z + 5], [12, z + 5]]))),
  ],
};

function render(name, attrs, scenes = SCENES, pad = 10) {
  const scene = scenes[name] || SCENES[name];
  if (!scene) return null;
  const parts = scene();
  // Fit the viewBox to the drawing with a margin (moving parts are inside groups).
  const shapes = parts.flatMap((p) => (p.tagName === 'g' ? [...p.querySelectorAll('polygon')] : [p]));
  const nums = shapes.flatMap((p) => (p.getAttribute('points') || '').split(' ').map((xy) => xy.split(',').map(Number))).filter((a) => a.length === 2 && !Number.isNaN(a[0]));
  const xs = nums.map((n) => n[0]);
  const ys = nums.map((n) => n[1]);
  // `pad` leaves room for parts that rise while they move; the svg also shows overflow.
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const hgt = Math.max(...ys) - minY + pad;
  return s('svg', { ...attrs, viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${hgt.toFixed(0)}`, 'aria-hidden': 'true', focusable: 'false' }, parts);
}

/** The 3D object for a page head, or null when the name is unknown. */
export function art3d(name) {
  return render(name, { class: 'hero-art art3d' });
}

/** The same objects at icon size, for cards and empty states. Null when the name is unknown. */
export function icon3d(name, size = 48) {
  return render(name, { class: 'i3d art3d', width: size, height: size }, ICON_SCENES, 2);
}

/** An icon on a soft tile, for card heads and stat cards. */
export function iconTile(name, size = 48) {
  const art = icon3d(name, Math.round(size * 0.86));
  return art ? h('span', { class: 'i3d-tile', style: `--tile:${size}px` }, art) : null;
}
