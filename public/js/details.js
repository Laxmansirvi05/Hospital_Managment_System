// Shared parts of the listing detail pages: contact card and the not-found state.
import { h, icon } from './h.js';
import { pageHead, extLink, leaveNote, telHref, empty, source } from './ui.js';

export function idParam() {
  return new URLSearchParams(location.search).get('id') || '';
}

export function notFoundPage(main, backHref, backLabel) {
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: 'Not found' }),
    h('section', { class: 'card' }, empty({ title: 'This listing is not available', text: 'It may have been removed or the link is wrong.', action: h('a', { class: 'btn btn-primary', href: backHref }, backLabel) }))));
}

/** @param {any} x listing with phone, address, email, website, source */
export function contactCard(x, extra = []) {
  return h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'contact-h' },
    h('h2', { class: 't-title-3', id: 'contact-h' }, 'Contact and location'),
    // The primary Call sits under the title (quickActions); here it is secondary, one primary per screen.
    x.phone ? h('a', { class: 'btn btn-secondary btn-block', href: telHref(x.phone) }, icon('phone', 18), `Call ${x.phone}`)
      : h('p', { class: 't-subhead muted' }, 'No phone number is listed for this place. Use the directions below, or check its official website if it has one.'),
    h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, 'Address'), h('dd', {}, x.address)),
      x.email ? h('div', {}, h('dt', {}, 'Email'), h('dd', {}, h('a', { href: `mailto:${x.email}` }, x.email))) : null,
      x.website ? h('div', {}, h('dt', {}, 'Official website'), h('dd', {}, extLink(x.website, x.website.replace(/^https?:\/\//, '')))) : null,
      extra),
    x.location ? h('a', {
      class: 'btn btn-secondary btn-block',
      href: `https://www.google.com/maps/search/?api=1&query=${x.location.lat},${x.location.lng}`,
      target: '_blank', rel: 'noopener noreferrer',
    }, icon('route', 18), 'Get directions') : null,
    leaveNote(),
    x.source ? source(x) : null);
}

/** Call, directions and website as pills under the title, so they are reachable without scrolling. */
export function quickActions(x) {
  const web = x.website && /^https?:\/\//i.test(x.website) ? x.website : null;
  if (!x.phone && !x.location && !web) return null;
  return h('div', { class: 'quick-actions' },
    x.phone ? h('a', { class: 'btn btn-primary', href: telHref(x.phone) }, icon('phone', 18), 'Call') : null,
    x.location ? h('a', { class: 'btn btn-secondary', href: `https://www.google.com/maps/search/?api=1&query=${x.location.lat},${x.location.lng}`, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Directions to ${x.name} in Google Maps, opens in a new tab` }, icon('route', 18), 'Directions', icon('external', 16)) : null,
    web ? h('a', { class: 'btn btn-secondary', href: web, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Website of ${x.name}, opens in a new tab` }, icon('globe', 18), 'Website', icon('external', 16)) : null);
}
