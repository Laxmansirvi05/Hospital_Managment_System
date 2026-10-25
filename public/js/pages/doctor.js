import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, extLink, telHref, source, leaveNote, doctorPhoto, listingRow, safeHref } from '../ui.js';
import { idParam, notFoundPage } from '../details.js';
import { reviewsSection } from '../reviews.js';
import { km, inr } from '../format.js';

const { main, user } = await shell({ nav: 'hospitals', title: 'Doctor' });

const fact = (label, value) => (value ? h('div', {}, h('dt', {}, label), h('dd', {}, value)) : null);
const tags = (list, cls = 'tag') => h('div', { class: 'row-8' }, list.map((t) => h('span', { class: cls }, t)));

try {
  const d = await api(`/doctors/${encodeURIComponent(idParam())}`);
  document.title = `${d.name} · CareRoute`;
  // A DOM node can sit in one place only, so each use gets its own link.
  const placeLink = () => (d.place.kind === 'hospital' ? h('a', { href: `/hospital/?id=${d.place.id}` }, d.place.name) : d.place.name);
  const sourceName = d.source.platform.replace(/ website$/, '');
  // Other doctors in the same speciality at the same hospital, for patients comparing options.
  const peers = d.place.kind === 'hospital'
    ? (await api(`/hospitals/${d.place.id}/doctors?specialization=${encodeURIComponent(d.specialization)}`).catch(() => ({ doctors: [] }))).doctors.filter((x) => x.id !== d.id).slice(0, 6)
    : [];

  const book = h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'book-h' },
    h('h2', { class: 't-title-3', id: 'book-h' }, 'How to book'),
    d.consultationFeeInr !== null ? h('div', { class: 'fee' }, h('span', { class: 't-footnote muted' }, 'Consultation fee'), h('span', { class: 't-title-1 num' }, inr(d.consultationFeeInr))) : null,
    safeHref(d.bookingUrl) ? h('a', { class: 'btn btn-primary btn-block', href: safeHref(d.bookingUrl), target: '_blank', rel: 'noopener noreferrer' }, icon('calendar', 18), `Book on the ${sourceName} website`, icon('external', 16)) : null,
    d.place.phone ? h('a', { class: `btn ${safeHref(d.bookingUrl) ? 'btn-secondary' : 'btn-primary'} btn-block`, href: telHref(d.place.phone) }, icon('phone', 18), `Call ${d.place.phone}`)
      : h('p', { class: 't-subhead muted' }, 'No phone number is listed.'),
    d.distanceKm !== undefined ? h('p', { class: 't-subhead muted' }, `${km(d.distanceKm)} away`) : null,
    h('p', { class: 't-footnote muted' }, 'The booking link opens the hospital’s own website in a new tab. CareRoute does not take bookings or payments.'),
    h('a', { class: 'btn btn-text btn-sm', href: `/appointments/?doctor=${encodeURIComponent(d.name)}&place=${encodeURIComponent(d.place.name)}&speciality=${encodeURIComponent(d.specialization)}#new` }, icon('calendar', 16), 'Log an appointment you booked'));

  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: d.name, crumbs: [['Hospitals and doctors', '/search/hospitals/?tab=doctors'], [d.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised doctor-hero' },
          h('div', { class: 'doctor-hero-photo' },
            doctorPhoto(d, 'avatar-xl'),
            d.photoUrl ? h('span', { class: 't-caption muted' }, `Photo: ${sourceName}`) : null),
          h('div', { class: 'stack-8' },
            h('p', { class: 't-title-2' }, d.specialization),
            d.title ? h('p', { class: 't-callout' }, d.title) : null,
            h('p', { class: 't-callout muted' }, placeLink(), `, ${d.place.area}`),
            h('div', { class: 'row-8' },
              d.experienceYears !== null ? h('span', { class: 'tag' }, `${d.experienceYears} years of experience`) : null,
              d.consultationFeeInr !== null ? h('span', { class: 'tag' }, `Fee ${inr(d.consultationFeeInr)}`) : null,
              d.languages.length ? h('span', { class: 'tag' }, `Speaks ${d.languages.join(', ')}`) : null))),
        h('section', { class: 'card stack-16' },
          h('h2', { class: 't-title-3' }, 'Qualifications and experience'),
          h('dl', { class: 'facts facts-2' },
            fact('Qualifications', d.qualifications.join(', ')),
            fact('Experience', d.experienceYears !== null ? `${d.experienceYears} years` : null),
            fact('Practises at', placeLink()),
            fact('Address', d.place.address),
            fact('Languages', d.languages.join(', '))),
          d.qualifications.length ? null : h('p', { class: 't-subhead muted' }, 'The hospital does not list qualifications for this doctor.')),
        d.expertise.length ? h('section', { class: 'card stack-12' }, h('h2', { class: 't-title-3' }, 'Areas of care'), tags(d.expertise)) : null,
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Consultation timings'),
          h('p', { class: 't-title-3' }, d.publishedTimings || 'Not published'),
          h('p', { class: 'notice notice-neutral' }, icon('info', 18), h('span', {}, 'Timings as the hospital publishes them. Call or check its website to confirm before you go. CareRoute does not show live availability.'))),
        peers.length ? h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, `Other ${d.specialization} doctors at ${d.place.name}`),
          h('div', { class: 'list' }, peers.map((p) => listingRow({
            href: `/doctor/?id=${p.id}`, kind: 'doctor', title: p.name, media: doctorPhoto(p, 'avatar-m'),
            meta: [[p.title, p.experienceYears !== null ? `${p.experienceYears} years` : ''].filter(Boolean).join(' · ')],
          })))) : null,
        reviewsSection({ kind: 'doctor', id: d.id, listing: d, canWrite: user.role === 'patient' })),
      h('div', { class: 'stack-16 sticky-side' },
        book,
        h('section', { class: 'card stack-12' },
          d.profileUrl ? extLink(d.profileUrl, `Full profile on the ${sourceName} website`) : null,
          leaveNote(),
          source(d)))),
  ));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/hospitals/?tab=doctors', 'Search doctors');
  else loadError(main, err);
}
