// Shared parts of the listing detail pages: contact card and the not-found state.
import { h, icon } from './h.js';
import { pageHead, extLink, leaveNote, telHref, empty, source } from './ui.js';
import { api } from './api.js';
import { km } from './format.js';
import { createRealMap } from './real-map.js';
import { getOrigin, onOriginChange, metresBetween } from './location.js';

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

/**
 * The place on a real map with the patient's location, and how far it is from them (2026-11-04).
 * Both follow the patient's live or chosen location.
 */
export function placeMap(place, kind) {
  const line = h('p', { class: 't-subhead muted row-8' });
  const map = createRealMap({ pins: [{ ...place.location, label: place.name, kind }], origin: null, height: 260, label: `Map of ${place.name}` });
  const paint = (o = getOrigin()) => {
    const metres = metresBetween(o, place.location);
    const far = metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
    line.replaceChildren(icon('locate', 16), `${far} in a straight line from ${o.source === 'live' ? 'your live location' : o.label}.`);
    map.update({ origin: o });
  };
  paint();
  onOriginChange(paint);
  return h('div', { class: 'stack-8' }, map, line);
}

/**
 * Other places of the same kind nearest to this one, from CareRoute's listings, with distance
 * from here. `path` and `key` name the search endpoint and its list.
 */
export function nearbyPlaces({ place, path, key, title, href }) {
  const list = h('div', { class: 'list' }, h('div', { class: 'skeleton skeleton-row' }));
  api(`${path}?lat=${place.location.lat}&lng=${place.location.lng}&limit=6`).then((r) => {
    const others = r[key].filter((x) => x.id !== place.id).slice(0, 5);
    list.replaceChildren(...(others.length ? others.map((x) => h('a', { class: 'price-row', href: href(x) },
      h('span', { class: 'stack-4' }, h('span', { class: 't-callout' }, x.name), h('span', { class: 't-footnote muted' }, x.area)),
      h('span', { class: 'row-8' }, h('span', { class: 't-subhead num' }, km(x.distanceKm)), icon('chevron', 16))))
      : [h('p', { class: 't-subhead muted' }, 'No other listed place is near here.')]));
  }).catch(() => list.replaceChildren(h('p', { class: 't-subhead muted' }, 'Nearby places could not load.')));
  return h('section', { class: 'card stack-12' }, h('h2', { class: 't-title-3' }, title), h('p', { class: 't-footnote muted' }, 'Distances from this place.'), list);
}
