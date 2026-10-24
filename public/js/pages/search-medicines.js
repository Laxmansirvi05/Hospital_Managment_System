import { h, icon } from '../h.js';
import { shell } from '../shell.js';
import { searchPage, chip, withOrigin } from '../search.js';
import { listingRow, rating, distance } from '../ui.js';
import { rupees } from '../format.js';

const { main } = await shell({ nav: 'medicines', title: 'Medicines and pharmacies' });

const howPrices = h('aside', { class: 'card stack-12' },
  h('span', { class: 'empty-art' }, icon('pill', 30)),
  h('h2', { class: 't-title-3' }, 'How prices are shown'),
  h('p', { class: 't-subhead muted' }, 'Each price is the listed price on that platform when it was last checked. The price on the platform may differ. You buy on the platform’s own website. CareRoute does not sell medicines.'),
  h('p', { class: 't-subhead muted' }, 'Prescription medicines need a valid prescription on every platform. CareRoute compares prices only and does not suggest which medicine to take.'));

searchPage({
  main,
  title: 'Medicines and pharmacies',
  sub: 'Compare a medicine’s listed price across online platforms, or find a pharmacy near you with its rating, location and contact details.',
  tabs: [
    {
      id: 'medicines', label: 'Compare medicine prices', noun: 'medicine', key: 'medicines', usesArea: false,
      placeholder: 'Medicine name, for example paracetamol',
      endpoint: (p) => `/medicines${p.get('q') ? `?q=${encodeURIComponent(p.get('q'))}` : ''}`,
      aside: howPrices,
      row: (m) => {
        const low = m.listings[0];
        const high = m.listings[m.listings.length - 1];
        return listingRow({
          href: `/medicine/?id=${m.id}`, kind: 'medicine', title: m.name,
          meta: [`${m.form} · ${m.pack}`, h('span', { class: 'row-8' },
            m.prescriptionRequired ? h('span', { class: 'tag tag-warning' }, 'Prescription required') : null,
            h('span', { class: 't-footnote' }, `${m.listings.length} platforms`))],
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
        const url = withOrigin('/pharmacies', p, o, ['q', 'area']);
        return p.get('open24') === '1' ? `${url}&open24=true` : url;
      },
      filters: (p, update) => [chip('Open 24 hours', p.get('open24') === '1', () => update({ open24: p.get('open24') !== '1' }))],
      row: (x) => listingRow({
        href: `/pharmacy/?id=${x.id}`, kind: 'pharmacy', title: x.name,
        meta: [`${x.area} · ${x.hours}`, rating(x)],
        trail: distance(x),
      }),
      pin: (x) => ({ ...x.location, kind: 'pharmacy', label: x.name, href: `/pharmacy/?id=${x.id}` }),
    },
  ],
});
