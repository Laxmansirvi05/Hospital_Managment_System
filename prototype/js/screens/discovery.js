import { h, icon, rupees } from '../h.js';
import { HOSPITALS, DOCTORS, MEDICINES, PHARMACIES, DIAGNOSTICS, SPECIALITIES, distanceKm } from '../data.js';
import { createMap } from '../map3d.js';
import { bars3d } from '../charts.js';
import { searchForm, SEARCH_TYPES } from './patient.js';
import { pageHead, rating, km, source, listingRow, leaveNote, extLink, hospitalName } from './ui.js';

const has = (text, q) => text.toLowerCase().includes(q.toLowerCase());

function doctorPlace(d) {
  if (d.hospitalId) return HOSPITALS.find((x) => x.id === d.hospitalId);
  return { name: d.clinic, area: d.area, x: d.x, y: d.y };
}

function results(type, q, area, filters) {
  const byDist = (a, b) => distanceKm(a.place || a) - distanceKm(b.place || b);
  if (type === 'hospitals') {
    return HOSPITALS.filter((x) =>
      (!q || has([x.name, x.area, ...x.specialities, ...x.departments].join(' '), q)) &&
      (!area || x.area === area) &&
      (!filters.emergency || x.emergency) &&
      (!filters.speciality || x.specialities.includes(filters.speciality)),
    ).sort(byDist);
  }
  if (type === 'doctors') {
    return DOCTORS.map((d) => ({ ...d, place: doctorPlace(d) })).filter((d) =>
      (!q || has([d.name, d.specialization].join(' '), q)) &&
      (!area || d.place.area === area) &&
      (!filters.speciality || d.specialization === filters.speciality),
    ).sort(byDist);
  }
  if (type === 'medicines') {
    return MEDICINES.filter((m) => !q || has(m.name, q));
  }
  if (type === 'pharmacies') {
    return PHARMACIES.filter((p) =>
      (!q || has([p.name, p.area].join(' '), q)) && (!area || p.area === area) && (!filters.open24 || p.hours === 'Open 24 hours'),
    ).sort(byDist);
  }
  return DIAGNOSTICS.filter((c) =>
    (!q || has([c.name, c.area, ...c.tests].join(' '), q)) && (!area || c.area === area),
  ).sort(byDist);
}

function row(type, item) {
  if (type === 'hospitals') {
    return listingRow({
      href: `#/hospital/${item.id}`, kind: 'hospital', title: item.name,
      meta: [
        `${item.area} · ${item.specialities.slice(0, 3).join(', ')}`,
        h('span', { class: 'row-8' }, rating(item.rating, item.reviews), item.emergency ? h('span', { class: 'tag tag-success' }, 'Emergency department') : null),
      ],
      trail: h('span', { class: 'num t-subhead' }, km(item)),
    });
  }
  if (type === 'doctors') {
    return listingRow({
      href: `#/doctor/${item.id}`, kind: 'doctor', title: item.name,
      meta: [`${item.specialization} · ${item.experience} years`, `${item.place.name}, ${item.place.area}`],
      trail: h('span', { class: 'num t-subhead' }, km(item.place)),
    });
  }
  if (type === 'medicines') {
    const low = item.listings[0];
    return listingRow({
      href: `#/medicine/${item.id}`, kind: 'medicine', title: item.name,
      meta: [`${item.form} · ${item.pack}`, item.rx ? h('span', { class: 'tag tag-warning' }, 'Prescription required') : null],
      trail: h('span', { class: 'stack-4', style: 'text-align:right' },
        h('span', { class: 't-headline num', style: 'color:var(--text-1)' }, `From ${rupees(low.price)}`),
        h('span', { class: 't-footnote' }, `on ${low.platform}`)),
    });
  }
  const kind = type === 'pharmacies' ? 'pharmacy' : 'diagnostic';
  return listingRow({
    href: `#/place/${kind}/${item.id}`, kind, title: item.name,
    meta: [
      `${item.area} · ${item.hours}`,
      type === 'diagnostics' ? item.tests.slice(0, 3).join(', ') : rating(item.rating, item.reviews),
    ],
    trail: h('span', { class: 'num t-subhead' }, km(item)),
  });
}

function setQuery(query, key, value) {
  const params = new URLSearchParams(query);
  if (value) params.set(key, value);
  else params.delete(key);
  location.hash = `#/search?${params}`;
}

export function search({ query }) {
  const type = query.get('type') || 'hospitals';
  const q = query.get('q') || '';
  const area = query.get('area') || '';
  const filters = { emergency: query.get('emergency') === '1', speciality: query.get('speciality') || '', open24: query.get('open24') === '1' };
  const list = results(type, q, area, filters);
  const label = SEARCH_TYPES.find(([v]) => v === type)[1].toLowerCase();

  const filterBar = h('div', { class: 'row' });
  if (type === 'hospitals' || type === 'doctors') {
    const spec = h('select', { class: 'select', 'aria-label': 'Speciality', style: 'width:auto' },
      h('option', { value: '' }, 'Any speciality'),
      SPECIALITIES.map((sp) => h('option', { value: sp, selected: sp === filters.speciality }, sp)));
    spec.addEventListener('change', () => setQuery(query, 'speciality', spec.value));
    filterBar.append(spec);
  }
  if (type === 'hospitals') {
    filterBar.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filters.emergency), style: filters.emergency ? 'border-color:var(--primary);color:var(--primary);background:var(--primary-tint)' : '', onclick: () => setQuery(query, 'emergency', filters.emergency ? '' : '1') },
      filters.emergency ? icon('check', 16) : null, 'Emergency department'));
  }
  if (type === 'pharmacies') {
    filterBar.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filters.open24), style: filters.open24 ? 'border-color:var(--primary);color:var(--primary);background:var(--primary-tint)' : '', onclick: () => setQuery(query, 'open24', filters.open24 ? '' : '1') },
      filters.open24 ? icon('check', 16) : null, 'Open 24 hours'));
  }

  const located = type !== 'medicines';
  const pins = located ? list.slice(0, 8).map((item, i) => {
    const p = item.place || item;
    const kind = { hospitals: 'hospital', doctors: 'doctor', pharmacies: 'pharmacy', diagnostics: 'diagnostic' }[type];
    const href = type === 'doctors' ? `#/doctor/${item.id}` : type === 'hospitals' ? `#/hospital/${item.id}` : `#/place/${kind}/${item.id}`;
    return { x: p.x, y: p.y, kind, label: item.name, showLabel: i === 0, active: i === 0, onSelect: () => { location.hash = href; } };
  }) : [];

  const side = located
    ? h('div', { class: 'stack-16', style: 'position:sticky;top:var(--space-24)' },
      createMap({ pins }).el,
      h('p', { class: 't-footnote muted' }, 'Results are sorted by distance from your location. Select a marker to open it.'))
    : h('aside', { class: 'card stack-12' },
      h('h2', { class: 't-title-3' }, 'How prices are shown'),
      h('p', { class: 't-subhead muted' }, 'Each price is the listed price on that platform when we last checked it. The price on the platform’s website may differ. CareRoute does not sell medicines.'),
      h('p', { class: 't-subhead muted' }, 'Prescription medicines need a valid prescription on every platform.'));

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Search', sub: 'Information comes from public listings on online platforms. Contact the provider to confirm before you go.' }),
    h('section', { class: 'card card-raised' }, searchForm({ type, q, area })),
    h('div', { class: 'grid-main-side' },
      h('section', { class: 'card stack-16', 'aria-labelledby': 'res-h' },
        h('div', { class: 'spread' },
          h('h2', { class: 't-title-2', id: 'res-h' }, `${list.length} ${list.length === 1 ? label.replace(/s$/, '').replace(/centre$/, 'centre') : label}`),
          filterBar,
        ),
        q || area ? h('p', { class: 't-subhead muted' }, [q ? `Matching “${q}”` : null, area ? `in ${area}` : null].filter(Boolean).join(' ')) : null,
        list.length
          ? h('div', { class: 'list' }, list.map((item) => row(type, item)))
          : h('div', { class: 'empty' },
            h('p', { class: 't-headline' }, `No ${label} found`),
            h('p', { class: 't-subhead muted' }, 'Try a shorter search, another area, or fewer filters.'),
            h('a', { class: 'btn btn-secondary', href: `#/search?type=${type}` }, 'Clear search')),
      ),
      side,
    ),
  );
  return { el, title: 'Search' };
}

function contactCard(item, extra = []) {
  return h('section', { class: 'card stack-16', 'aria-labelledby': 'contact-h' },
    h('h2', { class: 't-title-3', id: 'contact-h' }, 'Contact'),
    h('a', { class: 'btn btn-primary btn-block', href: `tel:${item.phone.replace(/\s/g, '')}` }, icon('phone', 18), `Call ${item.phone}`),
    h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, 'Address'), h('dd', {}, item.address)),
      item.email ? h('div', {}, h('dt', {}, 'Email'), h('dd', {}, h('a', { href: `mailto:${item.email}` }, item.email))) : null,
      item.website ? h('div', {}, h('dt', {}, 'Official website'), h('dd', {}, extLink(item.website, item.website.replace('https://', '')))) : null,
      extra,
    ),
    h('a', { class: 'btn btn-secondary btn-block', href: `https://maps.example/?q=${encodeURIComponent(item.address)}`, target: '_blank', rel: 'noopener noreferrer' }, icon('route', 18), 'Get directions'),
    leaveNote(),
  );
}

export function hospital({ params }) {
  const x = HOSPITALS.find((item) => item.id === params.id) || HOSPITALS[0];
  const docs = DOCTORS.filter((d) => d.hospitalId === x.id);
  const el = h('div', { class: 'page' },
    pageHead({ title: x.name, crumbs: [['Search', '#/search?type=hospitals'], [x.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised stack-16' },
          h('div', { class: 'row' },
            rating(x.rating, x.reviews),
            x.emergency ? h('span', { class: 'tag tag-success' }, icon('check', 14), 'Emergency department, 24 hours') : h('span', { class: 'tag' }, 'No emergency department'),
            h('span', { class: 't-subhead muted num' }, `${x.area} · ${km(x)} away`),
          ),
          h('p', { class: 't-callout', style: 'max-width:680px' }, x.description),
          createMap({ pins: [{ ...x, kind: 'hospital', label: x.name, showLabel: true, active: true }], tilt: 34 }).el,
        ),
        h('section', { class: 'card stack-16' },
          h('h2', { class: 't-title-3' }, 'Specialities'),
          h('div', { class: 'row-8' }, x.specialities.map((sp) => h('span', { class: 'tag tag-primary' }, sp))),
          h('h2', { class: 't-title-3' }, 'Departments'),
          h('div', { class: 'row-8' }, x.departments.map((d) => h('span', { class: 'tag' }, d))),
        ),
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, `Doctors at this hospital (${docs.length})`),
          docs.length ? h('div', { class: 'list' }, docs.map((d) => listingRow({
            href: `#/doctor/${d.id}`, kind: 'doctor', title: d.name, meta: [`${d.specialization} · ${d.experience} years`],
            trail: rating(d.rating, d.reviews),
          }))) : h('p', { class: 't-subhead muted' }, 'No doctor profiles listed for this hospital yet.'),
        ),
      ),
      h('div', { class: 'stack-16' }, contactCard(x), source(x)),
    ),
  );
  return { el, title: x.name };
}

export function doctor({ params }) {
  const d = DOCTORS.find((item) => item.id === params.id) || DOCTORS[0];
  const place = doctorPlace(d);
  const contact = d.hospitalId ? place : { ...place, phone: '+91 40 4300 4101', address: 'Kapoor ENT Clinic, 7-1-62 Ameerpet, Hyderabad 500016', website: 'https://kapoorent.example' };
  const el = h('div', { class: 'page' },
    pageHead({ title: d.name, crumbs: [['Search', '#/search?type=doctors'], [d.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised stack-16' },
          h('div', { class: 'row' },
            h('span', { class: 'obj', style: 'width:64px;height:64px;border-radius:var(--radius-l)' }, icon('doctor', 30)),
            h('div', { class: 'stack-4' },
              h('p', { class: 't-title-3' }, d.specialization),
              h('p', { class: 't-subhead muted' }, d.hospitalId ? h('a', { href: `#/hospital/${d.hospitalId}` }, hospitalName(d.hospitalId)) : d.clinic),
              rating(d.rating, d.reviews),
            ),
          ),
          h('dl', { class: 'facts facts-2' },
            h('div', {}, h('dt', {}, 'Qualifications'), h('dd', {}, d.qualifications.join(', '))),
            h('div', {}, h('dt', {}, 'Experience'), h('dd', { class: 'num' }, `${d.experience} years`)),
            h('div', {}, h('dt', {}, 'Practises at'), h('dd', {}, `${place.name}, ${place.area}`)),
            h('div', {}, h('dt', {}, 'Distance'), h('dd', { class: 'num' }, `${km(place)} from you`)),
          ),
        ),
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Consultation timings'),
          h('p', { class: 't-callout strong' }, d.timings),
          h('p', { class: 'notice notice-neutral' }, icon('info', 18), h('span', {}, 'Published timings. Contact the hospital or clinic to confirm. CareRoute does not show live availability or book appointments.')),
        ),
      ),
      h('div', { class: 'stack-16' },
        h('section', { class: 'card stack-16' },
          h('h2', { class: 't-title-3' }, 'Contact'),
          h('a', { class: 'btn btn-primary btn-block', href: `tel:${contact.phone.replace(/\s/g, '')}` }, icon('phone', 18), d.hospitalId ? 'Call the hospital' : 'Call the clinic'),
          h('p', { class: 't-subhead muted num' }, contact.phone),
          extLink(`https://profiles.example/${d.id}`, 'Official profile'),
          leaveNote(),
        ),
        source(d),
      ),
    ),
  );
  return { el, title: d.name };
}

export function medicine({ params }) {
  const m = MEDICINES.find((item) => item.id === params.id) || MEDICINES[0];
  const low = m.listings[0];
  const high = m.listings[m.listings.length - 1];
  const el = h('div', { class: 'page' },
    pageHead({ title: m.name, crumbs: [['Search', '#/search?type=medicines'], [m.name]], large: false, sub: `${m.form} · ${m.pack}` }),
    m.rx ? h('p', { class: 'notice notice-warning' }, icon('alert', 18), h('span', {}, 'Prescription required. Every platform will ask for a valid prescription before it sells this medicine.')) : null,
    h('div', { class: 'grid-main-side' },
      h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'cmp-h' },
        h('div', { class: 'stack-4' },
          h('h2', { class: 't-title-2', id: 'cmp-h' }, 'Listed prices'),
          h('p', { class: 't-subhead muted num' }, `Lowest ${rupees(low.price)} on ${low.platform}. Highest ${rupees(high.price)} on ${high.platform}. Difference ${rupees(high.price - low.price)}.`),
        ),
        h('div', {}, m.listings.map((l, i) => h('div', { class: 'price-row' },
          h('div', { class: 'stack-8' },
            h('div', { class: 'row-8' }, h('span', { class: 't-headline' }, l.platform), i === 0 ? h('span', { class: 'tag tag-success' }, 'Lowest listed') : null),
            h('div', { class: 'pbar', 'aria-hidden': 'true' }, h('span', { style: `width:${(l.price / high.price) * 100}%` })),
            h('p', { class: 't-footnote muted' }, `Listed price on ${l.platform}, checked ${l.checked}. The price on the site may differ.`),
          ),
          h('div', { class: 'stack-8', style: 'justify-items:end' },
            h('span', { class: 'price' }, rupees(l.price)),
            extLink(`https://${l.platform.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example/`, `Open on ${l.platform}`),
          ),
        ))),
        leaveNote(),
      ),
      h('section', { class: 'card stack-12' },
        h('h2', { class: 't-title-3' }, 'Price by platform'),
        bars3d({
          title: `Listed prices for ${m.name} by platform`,
          items: m.listings.map((l) => ({ label: l.platform, value: l.price, display: rupees(l.price) })),
          height: 240,
        }),
        h('p', { class: 't-footnote muted' }, 'CareRoute shows prices to compare. It does not recommend a medicine. Ask a doctor or pharmacist what is right for you.'),
      ),
    ),
  );
  return { el, title: m.name };
}

export function place({ params }) {
  const isPharmacy = params.kind === 'pharmacy';
  const all = isPharmacy ? PHARMACIES : DIAGNOSTICS;
  const p = all.find((item) => item.id === params.id) || all[0];
  const el = h('div', { class: 'page' },
    pageHead({ title: p.name, crumbs: [['Search', `#/search?type=${isPharmacy ? 'pharmacies' : 'diagnostics'}`], [p.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised stack-16' },
          h('div', { class: 'row' },
            rating(p.rating, p.reviews),
            h('span', { class: `tag ${p.hours === 'Open 24 hours' ? 'tag-success' : ''}` }, p.hours),
            h('span', { class: 't-subhead muted num' }, `${p.area} · ${km(p)} away`),
          ),
          createMap({ pins: [{ ...p, kind: isPharmacy ? 'pharmacy' : 'diagnostic', label: p.name, showLabel: true, active: true }], tilt: 34 }).el,
        ),
        !isPharmacy ? h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Tests listed publicly'),
          h('div', { class: 'row-8' }, p.tests.map((t) => h('span', { class: 'tag tag-primary' }, t))),
          h('p', { class: 't-footnote muted' }, 'Bookings and reports are handled by the centre, not by CareRoute.'),
        ) : h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Before you go'),
          h('p', { class: 't-subhead muted' }, 'Call the store to check that your medicine is in stock. CareRoute does not see store stock or take orders.'),
        ),
      ),
      h('div', { class: 'stack-16' }, contactCard({ ...p, website: `https://${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example` }), source(p)),
    ),
  );
  return { el, title: p.name };
}
