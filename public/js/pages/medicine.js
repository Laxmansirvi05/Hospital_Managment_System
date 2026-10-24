import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { bars3d } from '../charts.js';
import { pageHead, extLink, leaveNote, disclaimer } from '../ui.js';
import { idParam, notFoundPage } from '../details.js';
import { rupees, dateLong } from '../format.js';

const { main } = await shell({ nav: 'medicines', title: 'Medicine prices' });

const initialsOf = (platform) => platform.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

try {
  const m = await api(`/medicines/${encodeURIComponent(idParam())}`);
  document.title = `${m.name} prices · CareRoute`;
  const low = m.listings[0];
  const high = m.listings[m.listings.length - 1];
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: m.name, crumbs: [['Medicines and pharmacies', '/search/medicines/'], [m.name]], large: false, sub: `${m.form} · ${m.pack}` }),
    m.prescriptionRequired ? h('p', { class: 'notice notice-warning' }, icon('alert', 18), h('span', {}, 'Prescription required. Every platform asks for a valid prescription before it sells this medicine.')) : null,
    h('div', { class: 'grid-main-side' },
      h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'p-h' },
        h('div', { class: 'stack-4' },
          h('h2', { class: 't-title-2', id: 'p-h' }, 'Listed prices'),
          low ? h('div', { class: 'price-hero' }, h('span', { class: 'price' }, rupees(low.priceInr)), h('span', { class: 't-callout muted' }, `lowest, on ${low.platform}`)) : null,
          high && high !== low ? h('p', { class: 't-subhead muted num' }, `Highest ${rupees(high.priceInr)} on ${high.platform}. Prices differ by ${rupees(high.priceInr - low.priceInr)}.`) : null),
        h('div', {}, m.listings.map((l, i) => h('div', { class: 'price-row' },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start' },
            h('span', { class: 'platform-mark', 'aria-hidden': 'true' }, initialsOf(l.platform)),
            h('div', { class: 'stack-8', style: 'min-width:0' },
              h('div', { class: 'row-8' }, h('span', { class: 't-headline' }, l.platform), i === 0 ? h('span', { class: 'tag tag-success' }, 'Lowest listed') : null),
              h('div', { class: 'pbar', 'aria-hidden': 'true' }, h('span', { style: `width:${(l.priceInr / high.priceInr) * 100}%` })),
              h('p', { class: 't-footnote muted' }, `Listed price, checked ${dateLong(l.checkedAt)}. The price on the site may differ.`))),
          h('div', { class: 'stack-8', style: 'justify-items:end' },
            h('span', { class: 'price' }, rupees(l.priceInr)),
            extLink(l.productUrl, `Open on ${l.platform}`))))),
        leaveNote()),
      h('div', { class: 'stack-16' },
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Price by platform'),
          bars3d({ title: `Listed prices for ${m.name}`, items: m.listings.map((l) => ({ label: l.platform, value: l.priceInr, display: rupees(l.priceInr) })), height: 240 })),
        h('a', { class: 'card card-link stack-8', href: `/reminders/?medicine=${encodeURIComponent(m.name)}#new` },
          h('span', { class: 't-headline row-8' }, icon('clock', 18), 'Set a reminder for this medicine'),
          h('span', { class: 't-subhead muted' }, 'If your doctor prescribed it, add the times you take it.')),
        disclaimer('CareRoute compares listed prices only. It does not recommend a medicine. Ask a doctor or pharmacist what is right for you.')))));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/medicines/', 'Search medicines');
  else loadError(main, err);
}
