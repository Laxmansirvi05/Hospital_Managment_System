import { h } from '../h.js';
import { shell } from '../shell.js';
import { searchPage, chip, withOrigin } from '../search.js';
import { listingRow, rating, distance } from '../ui.js';
import { rupees } from '../format.js';

const { main } = await shell({ nav: 'medicines', title: 'Medicines and pharmacies' });

searchPage({
  main,
  title: 'Medicines and pharmacies',
  art: 'medicine',
  sub: 'Find a medicine’s official generic price (Jan Aushadhi MRP) and compare listed prices where more than one source has them, or find a pharmacy near you.',
  tabs: [
    {
      id: 'medicines', label: 'Compare medicine prices', noun: 'medicine', key: 'medicines', usesArea: false,
      fullWidth: true,
      placeholder: 'Medicine name, for example paracetamol',
      endpoint: (p) => `/medicines${p.get('q') ? `?q=${encodeURIComponent(p.get('q'))}` : ''}`,
      row: (m) => {
        const low = m.listings[0];
        const high = m.listings[m.listings.length - 1];
        return listingRow({
          href: `/medicine/?id=${m.id}`, kind: 'medicine', title: m.name,
          meta: [[m.form, m.pack, m.category].filter(Boolean).join(' · '), h('span', { class: 'row-8' },
            m.prescriptionRequired ? h('span', { class: 'tag tag-warning' }, 'Prescription required') : null,
            h('span', { class: 't-footnote' }, m.listings.length === 1 ? `Price from ${m.listings[0].platform}` : `${m.listings.length} platforms`))],
          trail: low ? h('span', { class: 'stack-4', style: 'text-align:right' },
            h('span', { class: 't-headline num', style: 'color:var(--text-1)' }, `From ${rupees(low.priceInr)}`),
            h('span', { class: 't-footnote' }, high.priceInr > low.priceInr ? `Prices differ by ${rupees(high.priceInr - low.priceInr)}` : `on ${low.platform}`)) : null,
        });
      },
    },
    {
      id: 'pharmacies', label: 'Pharmacies', noun: 'pharmacy', plural: 'pharmacies', key: 'pharmacies',
      placeholder: 'Pharmacy or medical store name',
      endpoint: (p, o) => {
        const url = withOrigin('/pharmacies', p, o, ['q', 'area', 'chain']);
        return p.get('open24') === '1' ? `${url}&open24=true` : url;
      },
      filters: (p, update) => [
        chip('Open 24 hours', p.get('open24') === '1', () => update({ open24: p.get('open24') !== '1' })),
        ...['Apollo Pharmacy', 'MedPlus', 'Hetero Pharmacy', 'Jan Aushadhi Kendra'].map((c) => chip(c, p.get('chain') === c, () => update({ chain: p.get('chain') === c ? '' : c }))),
      ],
      row: (x) => listingRow({
        href: `/pharmacy/?id=${x.id}`, kind: 'pharmacy', title: x.name,
        meta: [[x.area, x.hours].filter(Boolean).join(' · '), h('span', { class: 'row-8' }, x.chain ? h('span', { class: 'tag' }, x.chain) : null, rating(x))],
        trail: distance(x),
      }),
      pin: (x) => ({ ...x.location, kind: 'pharmacy', label: x.name, href: `/pharmacy/?id=${x.id}` }),
    },
  ],
});
