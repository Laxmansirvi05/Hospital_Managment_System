import { h, s } from './h.js';

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
 * @param {{ items: { label: string, value: number, href?: string, hint?: string }[], title: string, unit?: string }} o
 */
export function hbars({ items, title, unit = '' }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return h('figure', { class: 'hbars', 'aria-label': title },
    h('ol', { class: 'hbars-list' }, items.map((i) => {
      const body = [
        h('span', { class: 'hbars-label' }, i.label),
        h('span', { class: 'hbars-track' }, h('span', { class: 'hbars-bar', style: `width:${Math.max(2, (i.value / top) * 100).toFixed(1)}%` })),
        h('span', { class: 'hbars-value num' }, `${i.value.toLocaleString('en-IN')}${unit}`),
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
    layers[p.kind].append(s('circle', { cx: x(p.lng).toFixed(1), cy: y(p.lat).toFixed(1), r: 4.5 }));
  }
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title },
    s('rect', { class: 'dotmap-bg', x: 0, y: 0, width: W, height: H, rx: 16 }),
    // Draw the most numerous kind first so the rarer kinds stay visible on top.
    kinds.map((k) => layers[k.key]));
  const legend = h('div', { class: 'row-8 dotmap-legend' }, kinds.map((k) => {
    const n = points.filter((p) => p.kind === k.key).length;
    const btn = h('button', { class: 'chip chip-on', type: 'button', 'aria-pressed': 'true' },
      h('span', { class: `swatch swatch-${k.key}`, 'aria-hidden': 'true' }), `${k.label} (${n.toLocaleString('en-IN')})`);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('chip-on', on);
      layers[k.key].style.display = on ? '' : 'none';
    });
    return btn;
  }));
  return h('figure', { class: 'dotmap stack-12' }, legend, svg);
}
