import { h, icon } from '../h.js';
import { rupees, dateLong } from '../format.js';
import { shell } from '../shell.js';
import { searchPage, withOrigin } from '../search.js';
import { listingRow, rating, distance, safeHref } from '../ui.js';

const { main } = await shell({ nav: 'diagnostics', title: 'Diagnostic centres' });

// Chains publish test names in capitals. Longer words read better in title case; short ones and
// any with a digit are usually abbreviations (TSH, MCV, HbA1c, T3) and keep their capitals.
const SMALL = new Set(['AND', 'OF', 'FOR', 'WITH', 'IN', 'BY', 'TO', 'THE', 'ON']);
const testName = (name) => (name !== name.toUpperCase() ? name : name.replace(/[A-Z0-9]+/g, (w, i) => {
  if (SMALL.has(w) && i > 0) return w.toLowerCase();
  if (w.length < 4 || /\d/.test(w) || !/[AEIOU]/.test(w)) return w;
  return w[0] + w.slice(1).toLowerCase();
}));

searchPage({
  main,
  title: 'Diagnostic centres',
  art: 'diagnostic',
  sub: 'Find diagnostic centres, pathology labs and scan centres near you. Search by name or test, then call or visit the centre to book.',
  tabs: [
    {
      id: 'centres', label: 'Diagnostic centres', noun: 'centre', key: 'diagnosticCentres',
      placeholder: 'Centre name or test, for example MRI',
      endpoint: (p, o) => withOrigin('/diagnostic-centres', p, o, ['q', 'area', 'test']),
      row: (c) => listingRow({
        href: `/diagnostic/?id=${c.id}`, kind: 'diagnostic', title: c.name,
        meta: [[c.area, c.hours].filter(Boolean).join(' · '), c.testsListed.slice(0, 4).join(', '), h('span', { class: 'row-8' }, rating(c), c.website ? h('span', { class: 'tag' }, 'Website listed') : null)],
        trail: distance(c),
      }),
      pin: (c) => ({ ...c.location, kind: 'diagnostic', label: c.name, href: `/diagnostic/?id=${c.id}` }),
    },
    {
      id: 'tests', label: 'Test prices', noun: 'test', key: 'tests', usesArea: false,
      placeholder: 'Test name, for example thyroid or MRI',
      // Full width like Compare medicine prices (owner, 2026-11-04); the note on where prices come
      // from now sits under the list instead of in a side column.
      fullWidth: true,
      note: 'Each price is what the diagnostic chain publishes on its own website for Hyderabad, including taxes, on the date shown. Prices can change and offers may apply. Confirm with the centre before you go.',
      endpoint: (p) => `/test-prices${p.get('q') ? `?q=${encodeURIComponent(p.get('q'))}` : ''}`,
      row: (t) => h('a', { class: 'list-row lift', href: safeHref(t.url) || undefined, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'obj' }, icon('flask', 22)),
        h('span', { class: 'list-row-main' },
          h('span', { class: 'list-row-title' }, testName(t.name)),
          h('span', { class: 'list-row-meta' }, [t.provider, t.centresOffering ? `at ${t.centresOffering} centres` : ''].filter(Boolean).join(' · ')),
          h('span', { class: 'list-row-meta' }, `Checked ${dateLong(t.checkedAt)}`)),
        h('span', { class: 'list-row-trail' }, h('span', { class: 't-headline num' }, rupees(t.priceInr)), icon('external', 16))),
    },
  ],
});
