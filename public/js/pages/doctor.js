import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, extLink, telHref, source, leaveNote } from '../ui.js';
import { idParam, notFoundPage } from '../details.js';
import { reviewsSection } from '../reviews.js';
import { km } from '../format.js';

const { main, user } = await shell({ nav: 'hospitals', title: 'Doctor' });

try {
  const d = await api(`/doctors/${encodeURIComponent(idParam())}`);
  document.title = `${d.name} · CareRoute`;
  // A DOM node can sit in one place only, so each use gets its own link.
  const placeLink = () => (d.place.kind === 'hospital' ? h('a', { href: `/hospital/?id=${d.place.id}` }, d.place.name) : d.place.name);
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: d.name, crumbs: [['Hospitals and doctors', '/search/hospitals/?tab=doctors'], [d.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised stack-16' },
          h('div', { class: 'row' },
            h('span', { class: 'obj', style: 'width:72px;height:72px;border-radius:var(--radius-xl)' }, icon('doctor', 34)),
            h('div', { class: 'stack-4' },
              h('p', { class: 't-title-2' }, d.specialization),
              d.title ? h('p', { class: 't-callout' }, d.title) : null,
              h('p', { class: 't-callout muted' }, placeLink(), `, ${d.place.area}`))),
          h('dl', { class: 'facts facts-2' },
            h('div', {}, h('dt', {}, 'Qualifications'), h('dd', {}, d.qualifications.join(', '))),
            d.experienceYears !== null ? h('div', {}, h('dt', {}, 'Experience'), h('dd', { class: 'num' }, `${d.experienceYears} years`)) : null,
            h('div', {}, h('dt', {}, 'Practises at'), h('dd', {}, placeLink())),
            h('div', {}, h('dt', {}, 'Address'), h('dd', {}, d.place.address)))),
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Consultation timings'),
          h('p', { class: 't-title-3' }, d.publishedTimings || 'Not published'),
          h('p', { class: 'notice notice-neutral' }, icon('info', 18), h('span', {}, 'Published timings. Call the hospital or clinic to confirm and to book. CareRoute does not show live availability or book appointments.')),
          h('a', { class: 'btn btn-secondary', href: `/appointments/?doctor=${encodeURIComponent(d.name)}&place=${encodeURIComponent(d.place.name)}&speciality=${encodeURIComponent(d.specialization)}#new` }, icon('calendar', 18), 'Log an appointment you booked')),
        reviewsSection({ kind: 'doctor', id: d.id, listing: d, canWrite: user.role === 'patient' })),
      h('div', { class: 'stack-16' },
        h('section', { class: 'card card-raised stack-16' },
          h('h2', { class: 't-title-3' }, 'Contact'),
          d.place.phone ? h('a', { class: 'btn btn-primary btn-block', href: telHref(d.place.phone) }, icon('phone', 18), d.place.kind === 'hospital' ? 'Call for an appointment' : 'Call the clinic') : h('p', { class: 't-subhead muted' }, 'No phone number is listed.'),
          d.place.phone ? h('p', { class: 't-subhead muted num' }, d.place.phone) : null,
          d.distanceKm !== undefined ? h('p', { class: 't-subhead muted' }, `${km(d.distanceKm)} away`) : null,
          d.profileUrl ? extLink(d.profileUrl, 'Official profile') : null,
          leaveNote(),
          source(d)))),
  ));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/hospitals/?tab=doctors', 'Search doctors');
  else loadError(main, err);
}
