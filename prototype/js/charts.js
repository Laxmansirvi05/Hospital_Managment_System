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
