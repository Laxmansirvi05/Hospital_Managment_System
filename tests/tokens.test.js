// Token contrast test: docs/14-testing-strategy.md section 3 item 12.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('public/css/tokens.css', 'utf8');
const tokens = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*light-dark\((#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/g)) {
  tokens[m[1]] = { light: m[2], dark: m[3] };
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]
const PAIRS = [
  ['text-1', 'bg', 4.5], ['text-1', 'surface', 4.5], ['text-1', 'elevated', 4.5],
  ['text-2', 'bg', 4.5], ['text-2', 'surface', 4.5], ['text-2', 'elevated', 4.5],
  ['primary', 'bg', 4.5], ['primary', 'surface', 4.5],
  ['on-primary', 'primary', 4.5], ['on-primary', 'primary-hover', 4.5],
  ['danger', 'bg', 4.5], ['danger', 'surface', 4.5], ['on-danger', 'danger', 4.5],
  ['danger', 'danger-tint', 4.5],
  ['success', 'bg', 4.5], ['success', 'surface', 4.5],
  ['warning', 'bg', 4.5], ['warning', 'surface', 4.5],
  ['border-strong', 'surface', 3],
];

describe('design token contrast', () => {
  it('parsed the tokens', () => {
    expect(Object.keys(tokens).length).toBeGreaterThan(10);
  });

  for (const theme of ['light', 'dark']) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${theme}: --${fg} on --${bg} is at least ${min}`, () => {
        expect(tokens[fg], `missing --${fg}`).toBeDefined();
        expect(tokens[bg], `missing --${bg}`).toBeDefined();
        expect(contrast(tokens[fg][theme], tokens[bg][theme])).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
