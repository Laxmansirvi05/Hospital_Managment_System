import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { createMap } from '../map3d.js';
import { pageHead, listingRow, rating } from '../ui.js';
import { idParam, notFoundPage, contactCard } from '../details.js';
import { reviewsSection } from '../reviews.js';

const { main, user } = await shell({ nav: 'hospitals', title: 'Hospital' });

try {
  const id = idParam();
  const [x, docs] = await Promise.all([api(`/hospitals/${encodeURIComponent(id)}`), api(`/hospitals/${encodeURIComponent(id)}/doctors`)]);
  document.title = `${x.name} · CareRoute`;
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: x.name, crumbs: [['Hospitals and doctors', '/search/hospitals/'], [x.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised hero-detail' },
          h('div', { class: 'row' },
            x.emergencyAvailable ? h('span', { class: 'tag tag-success' }, icon('check', 14), 'Emergency department') : h('span', { class: 'tag' }, 'No emergency department'),
            h('span', { class: 't-subhead muted' }, x.area)),
          h('p', { class: 't-callout', style: 'max-width:680px' }, x.description),
          createMap({ pins: [{ ...x.location, kind: 'hospital', label: x.name, showLabel: true, active: true }], tilt: 40 })),
        h('section', { class: 'card stack-16' },
          h('h2', { class: 't-title-3' }, 'Specialities'),
          h('div', { class: 'row-8' }, x.specialities.map((s) => h('a', { class: 'tag tag-primary', href: `/search/hospitals/?tab=doctors&speciality=${encodeURIComponent(s)}` }, s))),
          h('h2', { class: 't-title-3' }, 'Departments'),
          h('div', { class: 'row-8' }, x.departments.map((d) => h('span', { class: 'tag' }, d)))),
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, `Doctors listed here (${docs.doctors.length})`),
          docs.doctors.length
            ? h('div', { class: 'list' }, docs.doctors.map((d) => listingRow({ href: `/doctor/?id=${d.id}`, kind: 'doctor', title: d.name, meta: [`${d.specialization} · ${d.experienceYears} years`], trail: rating(d) })))
            : h('p', { class: 't-subhead muted' }, 'No doctor profiles listed for this hospital yet.')),
        reviewsSection({ kind: 'hospital', id: x.id, listing: x, canWrite: user.role === 'patient' })),
      h('div', { class: 'stack-16' }, contactCard(x)))));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/hospitals/', 'Search hospitals');
  else loadError(main, err);
}
