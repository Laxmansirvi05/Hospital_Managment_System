import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { createMap } from '../map3d.js';
import { pageHead, ratingBlock } from '../ui.js';
import { idParam, notFoundPage, contactCard } from '../details.js';

const { main } = await shell({ nav: 'medicines', title: 'Pharmacy' });

try {
  const p = await api(`/pharmacies/${encodeURIComponent(idParam())}`);
  document.title = `${p.name} · CareRoute`;
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: p.name, crumbs: [['Medicines and pharmacies', '/search/medicines/?tab=pharmacies'], [p.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised hero-detail' },
          h('div', { class: 'row' },
            h('span', { class: `tag ${p.open24 ? 'tag-success' : ''}` }, icon('clock', 14), p.hours),
            h('span', { class: 't-subhead muted' }, p.area)),
          createMap({ pins: [{ ...p.location, kind: 'pharmacy', label: p.name, showLabel: true, active: true }], tilt: 40 })),
        p.rating !== null ? h('section', { class: 'card stack-12' }, h('h2', { class: 't-title-3' }, 'Rating and reviews'), ratingBlock(p),
          h('p', { class: 't-footnote muted' }, `Rating as shown on ${p.source.platform}.`)) : null,
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Before you go'),
          h('p', { class: 't-subhead muted' }, 'Call the store to check that your medicine is in stock. CareRoute does not see store stock or take orders.'),
          h('a', { class: 'btn btn-secondary', href: '/search/medicines/' }, icon('pill', 18), 'Compare medicine prices online'))),
      h('div', { class: 'stack-16' }, contactCard(p)))));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/medicines/?tab=pharmacies', 'Search pharmacies');
  else loadError(main, err);
}
