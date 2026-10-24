// Small DOM builder. Every piece of text goes in as a text node, never as HTML,
// so the prototype already follows the rule in docs/02-trd.md section 8.7.

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...any} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  setProps(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...any} children
 * @returns {SVGElement}
 */
export function s(tag, props = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  setProps(el, props);
  append(el, children);
  return el;
}

function setProps(el, props) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'style') el.setAttribute('style', value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value' && 'value' in el) el.value = value;
    else if (key === 'checked' && 'checked' in el) el.checked = Boolean(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Custom icon set on a 24 grid, one stroke weight, round joins (D-20).
const ICONS = {
  search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M16.5 16.5 21 21' }]],
  home: [['path', { d: 'M3 10.5 12 3l9 7.5' }], ['path', { d: 'M5 9v11h14V9' }], ['path', { d: 'M10 20v-6h4v6' }]],
  assistant: [['path', { d: 'M4 5h16v11H10l-6 4z' }], ['path', { d: 'M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01' }]],
  report: [['path', { d: 'M7 3h7l5 5v13H7z' }], ['path', { d: 'M14 3v5h5' }], ['path', { d: 'M10 13h6M10 17h4' }]],
  idcard: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['circle', { cx: 9, cy: 11, r: 2 }], ['path', { d: 'M6 16c.8-1.4 1.8-2 3-2s2.2.6 3 2' }], ['path', { d: 'M14.5 10h4M14.5 14h4' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  ambulance: [['path', { d: 'M2 17V6h11v11' }], ['path', { d: 'M13 9h4.5l3.5 3.5V17h-8' }], ['circle', { cx: 6.5, cy: 17.5, r: 2 }], ['circle', { cx: 17, cy: 17.5, r: 2 }], ['path', { d: 'M7.5 8.5v5M5 11h5' }]],
  hospital: [['path', { d: 'M4 21V5h16v16' }], ['path', { d: 'M2 21h20' }], ['path', { d: 'M12 8v6M9 11h6' }], ['path', { d: 'M10 21v-3h4v3' }]],
  doctor: [['path', { d: 'M6 3v6a4 4 0 0 0 8 0V3' }], ['path', { d: 'M10 13v2.5a5 5 0 0 0 10 0V14' }], ['circle', { cx: 20, cy: 12, r: 2 }]],
  pill: [['path', { d: 'M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z' }], ['path', { d: 'M7 7l7 7' }]],
  pharmacy: [['path', { d: 'M4 10v10h16V10' }], ['path', { d: 'M3 4h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }], ['path', { d: 'M12 12.5v5M9.5 15h5' }]],
  flask: [['path', { d: 'M9 3h6' }], ['path', { d: 'M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3' }], ['path', { d: 'M7.5 14h9' }]],
  pin: [['path', { d: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z' }], ['circle', { cx: 12, cy: 10, r: 2.5 }]],
  phone: [['path', { d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' }]],
  mail: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['path', { d: 'M3 7l9 6 9-6' }]],
  external: [['path', { d: 'M14 4h6v6' }], ['path', { d: 'M20 4l-9 9' }], ['path', { d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }]],
  globe: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3 12h18' }], ['path', { d: 'M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z' }]],
  chevron: [['path', { d: 'M9 6l6 6-6 6' }]],
  back: [['path', { d: 'M15 6l-6 6 6 6' }]],
  close: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  check: [['path', { d: 'M5 12.5 10 17l9-10' }]],
  alert: [['path', { d: 'M12 3.5 2.5 20h19z' }], ['path', { d: 'M12 10v4' }], ['path', { d: 'M12 17h.01' }]],
  info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v5' }], ['path', { d: 'M12 8h.01' }]],
  route: [['circle', { cx: 6, cy: 18, r: 2 }], ['circle', { cx: 18, cy: 6, r: 2 }], ['path', { d: 'M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6' }]],
  users: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0' }], ['path', { d: 'M16 4.5a3.5 3.5 0 0 1 0 7' }], ['path', { d: 'M18 14a6 6 0 0 1 3.5 6' }]],
  user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21a8 8 0 0 1 16 0' }]],
  list: [['path', { d: 'M8 6h13M8 12h13M8 18h13' }], ['path', { d: 'M3.5 6h.01M3.5 12h.01M3.5 18h.01' }]],
  chart: [['path', { d: 'M3 20h18' }], ['path', { d: 'M6 20v-7M11 20V5M16 20v-10M20.5 20v-4' }]],
  shield: [['path', { d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' }], ['path', { d: 'M9 12l2 2 4-4' }]],
  upload: [['path', { d: 'M12 16V4' }], ['path', { d: 'M7 9l5-5 5 5' }], ['path', { d: 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3' }]],
  star: [['path', { d: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z', fill: 'currentColor' }]],
  send: [['path', { d: 'M4 12 20 4l-6 16-2.5-6.5z' }]],
  locate: [['circle', { cx: 12, cy: 12, r: 3 }], ['circle', { cx: 12, cy: 12, r: 7.5 }], ['path', { d: 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22' }]],
  edit: [['path', { d: 'M4 20h4L19 9l-4-4L4 16z' }], ['path', { d: 'M13.5 6.5l4 4' }]],
  share: [['circle', { cx: 6, cy: 12, r: 2.5 }], ['circle', { cx: 18, cy: 6, r: 2.5 }], ['circle', { cx: 18, cy: 18, r: 2.5 }], ['path', { d: 'M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6' }]],
  heart: [['path', { d: 'M12 20s-7.5-4.6-9-9.5C2 7 4.3 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 2.9 0 5.2 2.5 4.2 6C19.5 15.4 12 20 12 20z' }]],
  steering: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 2 }], ['path', { d: 'M3.5 10.5 10 12M20.5 10.5 14 12M12 14v7' }]],
  filter: [['path', { d: 'M3 5h18M6 12h12M10 19h4' }]],
  eye: [['path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
};

/**
 * @param {keyof typeof ICONS} name
 * @param {number} [size]
 * @returns {SVGElement}
 */
export function icon(name, size = 20) {
  const parts = ICONS[name] || ICONS.info;
  return s('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
  }, parts.map(([tag, attrs]) => s(tag, attrs)));
}

/** Brand mark: a small isometric cube with a route line on its top face. */
export function brandMark() {
  return s('svg', { class: 'brand-mark', viewBox: '0 0 36 36', 'aria-hidden': 'true' },
    s('path', { d: 'M18 3 32 10.5 18 18 4 10.5z', fill: 'var(--primary-face-top)' }),
    s('path', { d: 'M4 10.5 18 18v15L4 25.5z', fill: 'var(--primary)' }),
    s('path', { d: 'M32 10.5 18 18v15l14-7.5z', fill: 'var(--primary-face-side)' }),
    s('path', { d: 'M11 10.5h7.5l3.5 2', fill: 'none', stroke: 'var(--on-primary)', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
    s('path', { d: 'M8.5 21.5v3M7 23h3', fill: 'none', stroke: 'var(--on-primary)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
  );
}

let toastTimer = 0;
/** @param {string} message */
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 2600);
}

/** @param {string} message */
export function announce(message) {
  const live = document.getElementById('live');
  if (live) live.textContent = message;
}

/** Formats rupees with two decimals, Indian grouping. */
export function rupees(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);
}
