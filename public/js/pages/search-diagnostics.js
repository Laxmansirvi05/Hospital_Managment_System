import { h } from '../h.js';
import { shell } from '../shell.js';
import { searchPage, chip, withOrigin } from '../search.js';
import { listingRow, rating, distance } from '../ui.js';

const TESTS = ['Complete blood count', 'Thyroid profile', 'Lipid profile', 'HbA1c', 'X-ray', 'Ultrasound', 'MRI', 'CT scan', 'ECG'];

const { main } = await shell({ nav: 'diagnostics', title: 'Diagnostic centres' });

searchPage({
  main,
  title: 'Diagnostic centres',
  sub: 'Find diagnostic centres, pathology labs and scan centres, with their ratings, websites and the tests they list publicly. Book directly with the centre.',
  tabs: [
    {
      id: 'centres', label: 'Diagnostic centres', noun: 'centre', key: 'diagnosticCentres',
      placeholder: 'Centre name or test, for example MRI',
      endpoint: (p, o) => withOrigin('/diagnostic-centres', p, o, ['q', 'area', 'test']),
      filters: (p, update) => TESTS.map((t) => chip(t, p.get('test') === t, () => update({ test: p.get('test') === t ? '' : t }))),
      row: (c) => listingRow({
        href: `/diagnostic/?id=${c.id}`, kind: 'diagnostic', title: c.name,
        meta: [`${c.area} · ${c.hours}`, c.testsListed.slice(0, 4).join(', '), h('span', { class: 'row-8' }, rating(c), c.website ? h('span', { class: 'tag' }, 'Website listed') : null)],
        trail: distance(c),
      }),
      pin: (c) => ({ ...c.location, kind: 'diagnostic', label: c.name, href: `/diagnostic/?id=${c.id}` }),
    },
  ],
});
