// Explore: what CareRoute knows about care in greater Hyderabad, drawn from the published
// listings themselves. Every bar opens the matching search.
import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, extLink } from '../ui.js';
import { hbars, dotMap } from '../charts.js';
import { inr } from '../format.js';

const TYPE_LABEL = { hospital: 'Hospitals', clinic: 'Clinics', eye: 'Eye care', dental: 'Dental', maternity: 'Women and children', nursing_home: 'Nursing homes', ayush: 'AYUSH' };
// Same box the OpenStreetMap collection uses (scripts/collect-osm.js).
const BOX = { south: 17.2, west: 78.2, north: 17.62, east: 78.7 };

const { main } = await shell({ nav: 'explore', title: 'Explore Hyderabad' });

const stat = (value, label, href) => h(href ? 'a' : 'div', { class: `stat${href ? ' card-link' : ''}`, href },
  h('span', { class: 'stat-value' }, value.toLocaleString('en-IN')), h('span', { class: 't-subhead muted' }, label));
const card = (title, sub, body) => h('section', { class: 'card stack-16' }, h('div', { class: 'stack-4' }, h('h2', { class: 't-title-3' }, title), sub ? h('p', { class: 't-footnote muted' }, sub) : null), body);
const q = (params) => `?${new URLSearchParams(params)}`;

try {
  const x = await api('/insights');
  // Sections added later may be missing from an older cached response; treat them as empty.
  for (const k of ['byType', 'byArea', 'bySpeciality', 'bySource', 'byChain', 'byMedicineGroup', 'commonTests', 'points']) x[k] ??= [];
  const t = x.totals;
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ art: 'chart', title: 'Explore Hyderabad', sub: 'Every hospital, clinic, doctor, pharmacy and diagnostic centre CareRoute lists, at a glance. Select any bar to see those places.' }),
    h('div', { class: 'stat-row' },
      stat(t.carePlaces, 'Hospitals and clinics', '/search/hospitals/'),
      stat(t.doctors, 'Doctors with profiles', '/search/hospitals/?tab=doctors'),
      stat(t.pharmacies, 'Pharmacies', '/search/medicines/?tab=pharmacies'),
      stat(t.diagnosticCentres, 'Diagnostic centres', '/search/diagnostics/')),
    h('div', { class: 'explore-top' },
      card('Where care is', 'Each dot is one listed place. Use the buttons to show or hide each kind.',
      dotMap({
        points: x.points, box: BOX, title: `Map of ${x.points.length} listed places in greater Hyderabad`,
        kinds: [{ key: 'c', label: 'Hospitals and clinics' }, { key: 'p', label: 'Pharmacies' }, { key: 'd', label: 'Diagnostic centres' }],
      })),
      h('div', { class: 'stack-16' },
        card('Kinds of care place', `${t.emergency.toLocaleString('en-IN')} list an emergency department.`,
        hbars({ title: 'Care places by kind', items: x.byType.map((r) => ({ label: TYPE_LABEL[r.key] || r.key, value: r.count, href: `/search/hospitals/${q({ type: r.key })}` })) })),
        card('Pharmacy chains', 'Branches listed on OpenStreetMap.',
        hbars({ title: 'Pharmacies by chain', items: x.byChain.map((r) => ({ label: r.key, value: r.count, href: r.key === 'Independent' ? '/search/medicines/?tab=pharmacies' : `/search/medicines/${q({ tab: 'pharmacies', chain: r.key })}` })) })))),
    h('div', { class: 'explore-grid' },
      card('Areas with the most care places', 'Top 12 areas by number of hospitals and clinics.',
        hbars({ title: 'Care places by area', items: x.byArea.map((r) => ({ label: r.key, value: r.count, href: `/search/hospitals/${q({ area: r.key })}` })) })),
      card('Doctors by speciality', `${t.doctorsWithPhoto.toLocaleString('en-IN')} of ${t.doctors.toLocaleString('en-IN')} doctors have a photo from their hospital.`,
        hbars({ title: 'Doctors by speciality', items: x.bySpeciality.map((r) => ({ label: r.key, value: r.count, href: `/search/hospitals/${q({ tab: 'doctors', q: r.key })}` })) })),
      card('Doctors by hospital group', 'Profiles collected from each hospital’s own website.',
        hbars({ title: 'Doctors by hospital group', items: x.bySource.map((r) => ({ label: r.key.replace(/ website$/, ''), value: r.count, href: `/search/hospitals/${q({ tab: 'doctors', q: r.key.replace(/ (Hospitals?|Children's Hospital)? ?website$/, '').replace(/ Hospitals$/, '') })}` })) })),
      x.byMedicineGroup.length ? card('Generic medicines by group', `${x.medicines.toLocaleString('en-IN')} medicines with an official Jan Aushadhi price.`,
        hbars({ title: 'Generic medicines by therapeutic group', items: x.byMedicineGroup.map((r) => ({ label: r.key, value: r.count, href: `/search/medicines/${q({ q: r.key })}` })) })) : null,
      x.commonTests.length ? card('Common test prices', 'Lowest price published by Vijaya Diagnostic for Hyderabad, as checked when the data was last collected. Confirm with the centre.',
        hbars({ title: 'Common diagnostic test prices', unit: '', items: x.commonTests.map((t) => ({ label: t.key, value: t.price, display: inr(t.price), hint: `${t.key}: ${inr(t.price)}`, href: `/search/diagnostics/${q({ tab: 'tests', q: t.key.replace(/ \(.*\)$/, '') })}` })) })) : null,
      x.fees ? card('Consultation fees', `Published by ${x.fees.count.toLocaleString('en-IN')} doctors. Fees change; confirm with the hospital.`,
        h('dl', { class: 'facts facts-2' },
          h('div', {}, h('dt', {}, 'Lowest'), h('dd', { class: 't-title-2 num' }, inr(x.fees.min))),
          h('div', {}, h('dt', {}, 'Typical (median)'), h('dd', { class: 't-title-2 num' }, inr(x.fees.median))),
          h('div', {}, h('dt', {}, 'Highest'), h('dd', { class: 't-title-2 num' }, inr(x.fees.max))))) : null),
    h('p', { class: 't-footnote muted' }, icon('info', 14), ' Places: ', extLink('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'), ', Open Database License. Doctors: each hospital’s own website. Counts update when the data is refreshed.')));
} catch (err) {
  loadError(main, err);
}
