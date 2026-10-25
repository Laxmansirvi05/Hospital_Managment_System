import { h } from '../h.js';
import { shell } from '../shell.js';
import { searchPage, withOrigin } from '../search.js';
import { listingRow, rating, distance } from '../ui.js';

const { main } = await shell({ nav: 'diagnostics', title: 'Diagnostic centres' });

searchPage({
  main,
  title: 'Diagnostic centres',
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
  ],
});
