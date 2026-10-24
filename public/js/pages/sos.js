// Ambulance requests (WP-5) are not built yet. This page must never pretend they are:
// it sends people to 112 and shows what they can do now.
import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell } from '../shell.js';
import { pageHead, listingRow, distance, getOrigin } from '../ui.js';

const { main } = await shell({ nav: 'sos', title: 'Emergency' });

const nearList = h('div', { class: 'list' }, h('div', { class: 'skeleton skeleton-row' }));

main.replaceChildren(h('div', { class: 'page', style: 'max-width:880px' },
  pageHead({ title: 'Emergency', sub: 'If someone may be seriously ill or injured, call for help now.' }),
  h('a', { class: 'sos-key', href: 'tel:112' }, h('span', { class: 'sos-key-title' }, 'Call 112'), h('span', { class: 'sos-key-sub' }, 'National emergency number. Works from any phone.')),
  h('p', { class: 'notice notice-warning' }, icon('info', 18), h('span', {}, h('strong', {}, 'Ambulance requests through CareRoute are not live yet. '), 'They are being built. Until then, call 112 or a hospital directly.')),
  h('section', { class: 'card stack-16' },
    h('div', { class: 'stack-4' },
      h('h2', { class: 't-title-2' }, 'Hospitals with an emergency department near you'),
      h('p', { class: 't-subhead muted' }, 'Call ahead if you can. Tap a hospital for its phone number.')),
    nearList),
  h('a', { class: 'card card-link stack-8', href: '/medical-id/' },
    h('span', { class: 't-headline row-8' }, icon('idcard', 18), 'Keep your medical ID ready'),
    h('span', { class: 't-subhead muted' }, 'Blood group, allergies and medicines help the people treating you.'))));

const o = getOrigin();
api(`/hospitals?emergencyOnly=true&lat=${o.lat}&lng=${o.lng}&limit=5`)
  .then(({ hospitals }) => nearList.replaceChildren(...hospitals.map((x) => listingRow({ href: `/hospital/?id=${x.id}`, kind: 'hospital', title: x.name, meta: [`${x.area} · ${x.phone}`], trail: distance(x) }))))
  .catch((err) => nearList.replaceChildren(h('p', { class: 't-subhead muted' }, `${err.message} Call 112.`)));
