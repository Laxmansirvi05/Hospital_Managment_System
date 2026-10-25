import { h, s, icon } from './h.js';

/**
 * Isometric 3D bar chart in SVG. Each bar is three flat faces, no gradients.
 * Values are labelled directly on the bars, so there is no legend.
 * @param {{ items: { label: string, value: number, display: string, peak?: boolean }[], max?: number, height?: number, title: string }} o
 */
export function bars3d({ items, max, height = 220, title }) {
  const top = max ?? Math.max(...items.map((i) => i.value)) * 1.15;
  const barW = 34;
  const depth = 14;
  // Space bars so the longest label (about 7 units per character at 12 px) never overlaps its neighbour.
  const longest = Math.max(...items.map((i) => i.label.length));
  const gap = Math.max(26, longest * 7 - barW + 12);
  const left = 16;
  const baseY = height - 34;
  const width = left * 2 + items.length * barW + (items.length - 1) * gap + depth;
  const usable = baseY - 40;

  const bars = items.map((item, i) => {
    const x = left + i * (barW + gap);
    const bh = Math.max(4, (item.value / top) * usable);
    const y = baseY - bh;
    const peak = item.peak ? ' is-peak' : '';
    return s('g', {},
      s('path', { class: `face-side${peak}`, d: `M${x + barW} ${y} l${depth} ${-depth * 0.6} v${bh} l${-depth} ${depth * 0.6} z` }),
      s('path', { class: `face-top${peak}`, d: `M${x} ${y} l${depth} ${-depth * 0.6} h${barW} l${-depth} ${depth * 0.6} z` }),
      s('rect', { class: `face-front${peak}`, x, y, width: barW, height: bh }),
      s('text', { class: 'value', x: x + barW / 2 + depth / 2, y: y - depth * 0.6 - 8, 'text-anchor': 'middle' }, item.display),
      s('text', { x: x + barW / 2, y: baseY + 20, 'text-anchor': 'middle' }, item.label),
    );
  });

  return h('figure', { class: 'bars3d' },
    s('svg', { viewBox: `0 0 ${width} ${height}`, width: Math.round(width * 1.25), height: Math.round(height * 1.25), role: 'img', 'aria-label': title },
      s('path', { class: 'floor', d: `M${left - 8} ${baseY} l${depth} ${-depth * 0.6} H${width - 4} l${-depth} ${depth * 0.6} z` }),
      bars,
    ),
  );
}

/**
 * Ranked horizontal bars in HTML, one hue for magnitude, each value labelled at the bar end.
 * Rows are links when `href` is given, so a bar opens the matching search.
 * @param {{ items: { label: string, value: number, display?: string, href?: string, hint?: string }[], title: string, unit?: string }} o
 */
export function hbars({ items, title, unit = '' }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return h('figure', { class: 'hbars', 'aria-label': title },
    h('ol', { class: 'hbars-list' }, items.map((i) => {
      const body = [
        h('span', { class: 'hbars-label' }, i.label),
        h('span', { class: 'hbars-track' }, h('span', { class: 'hbars-bar', style: `width:${Math.max(2, (i.value / top) * 100).toFixed(1)}%` })),
        h('span', { class: 'hbars-value num' }, i.display ?? `${i.value.toLocaleString('en-IN')}${unit}`),
      ];
      const tip = i.hint || `${i.label}: ${i.value.toLocaleString('en-IN')}${unit}`;
      return h('li', {}, i.href ? h('a', { class: 'hbars-row', href: i.href, title: tip }, body) : h('span', { class: 'hbars-row', title: tip }, body));
    })));
}

/**
 * Every listing as a dot on a plain projection of greater Hyderabad (no map tiles), coloured by
 * kind with a legend that also toggles each kind. Positions are the listings' own coordinates.
 * @param {{ points: { kind: string, lat: number, lng: number }[], kinds: { key: string, label: string }[], box: { south: number, west: number, north: number, east: number }, title: string }} o
 */
export function dotMap({ points, kinds, box, title }) {
  // Equirectangular with the longitude scaled by cos(latitude), so distances look right at 17.4 N.
  const kx = Math.cos(((box.north + box.south) / 2) * (Math.PI / 180));
  const W = 1000;
  const H = Math.round((W * (box.north - box.south)) / ((box.east - box.west) * kx));
  const x = (lng) => ((lng - box.west) / (box.east - box.west)) * W;
  const y = (lat) => ((box.north - lat) / (box.north - box.south)) * H;
  const layers = Object.fromEntries(kinds.map((k) => [k.key, s('g', { class: `dots dots-${k.key}` })]));
  for (const p of points) {
    if (!layers[p.kind] || p.lat < box.south || p.lat > box.north || p.lng < box.west || p.lng > box.east) continue;
    const cx = x(p.lng);
    const cy = y(p.lat);
    // Shape as well as colour: circle for care places, square for pharmacies, diamond for diagnostics.
    const mark = p.kind === 'p' ? s('rect', { x: (cx - 4).toFixed(1), y: (cy - 4).toFixed(1), width: 8, height: 8 })
      : p.kind === 'd' ? s('path', { d: `M${cx.toFixed(1)} ${(cy - 5.5).toFixed(1)}l5.5 5.5l-5.5 5.5l-5.5 -5.5z` })
        : s('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 4.5 });
    layers[p.kind].append(mark);
  }
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title },
    s('rect', { class: 'dotmap-bg', x: 0, y: 0, width: W, height: H, rx: 16 }),
    // Draw the most numerous kind first so the rarer kinds stay visible on top.
    kinds.map((k) => layers[k.key]));
  const counts = kinds.map((k) => ({ ...k, n: points.filter((p) => p.kind === k.key).length }));
  const legend = h('div', { class: 'row-8 dotmap-legend' }, counts.map((k) => {
    const check = icon('check', 16);
    const btn = h('button', { class: 'chip chip-on', type: 'button', 'aria-pressed': 'true' },
      check, h('span', { class: `swatch swatch-${k.key}`, 'aria-hidden': 'true' }), `${k.label} (${k.n.toLocaleString('en-IN')})`);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('chip-on', on);
      check.style.display = on ? '' : 'none';
      layers[k.key].style.display = on ? '' : 'none';
    });
    return btn;
  }));
  // The text alternative: what the map shows, in words.
  const caption = h('figcaption', { class: 't-footnote muted' },
    `${counts.map((k) => `${k.n.toLocaleString('en-IN')} ${k.label.toLowerCase()}`).join(', ')}. The chart of areas below lists where most places are.`);
  return h('figure', { class: 'dotmap stack-12' }, legend, svg, caption);
}
