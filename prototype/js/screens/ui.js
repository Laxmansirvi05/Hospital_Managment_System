import { h, icon } from '../h.js';
import { HOSPITALS, distanceKm } from '../data.js';

/**
 * @param {{ title: string, sub?: string, crumbs?: [string, string][], actions?: any, large?: boolean }} o
 */
export function pageHead({ title, sub, crumbs, actions, large = true }) {
  return h('header', { class: 'page-head' },
    crumbs ? h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      crumbs.map(([label, href], i) => [
        i ? icon('chevron', 14) : null,
        href ? h('a', { href }, label) : h('span', { 'aria-current': 'page' }, label),
      ]),
    ) : null,
    h('div', { class: 'spread' },
      h('h1', { class: large ? 't-large-title' : 't-title-1' }, title),
      actions || null,
    ),
    sub ? h('p', { class: 't-callout muted', style: 'max-width:680px' }, sub) : null,
  );
}

export function rating(value, count) {
  return h('span', { class: 'rating' }, icon('star', 16), value.toFixed(1),
    h('span', { class: 'muted', style: 'font-weight:400' }, `(${count.toLocaleString('en-IN')} reviews)`));
}

export function km(item) {
  return `${distanceKm(item).toFixed(1)} km`;
}

export function source(item) {
  return h('p', { class: 't-footnote muted row-8' }, icon('info', 14), `Source: ${item.source}. Checked on ${item.checked}.`);
}

export function hospitalName(id) {
  return HOSPITALS.find((x) => x.id === id)?.name ?? '';
}

export function sectionTitle(text, extra) {
  return h('div', { class: 'spread' }, h('h2', { class: 't-title-2' }, text), extra || null);
}

/** A listing row used by search and home. */
export function listingRow({ href, kind, title, meta, trail }) {
  const iconName = { hospital: 'hospital', doctor: 'doctor', pharmacy: 'pharmacy', diagnostic: 'flask', medicine: 'pill' }[kind];
  return h('a', { class: 'list-row', href },
    h('span', { class: 'obj' }, icon(iconName, 22)),
    h('span', { class: 'list-row-main' },
      h('span', { class: 'list-row-title' }, title),
      meta.map((m) => h('span', { class: 'list-row-meta' }, m)),
    ),
    h('span', { class: 'list-row-trail' }, trail || null, icon('chevron', 18)),
  );
}

export function leaveNote() {
  return h('p', { class: 't-footnote muted' }, 'Links open the provider’s own website. CareRoute does not book appointments, sell medicines or take payments.');
}

export function extLink(href, label) {
  // Prototype links point at reserved .example addresses and do not navigate anywhere real.
  return h('a', { class: 'link-ext', href, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external', 16));
}

export function disclaimer(text = 'This is general information, not a diagnosis or a prescription. Talk to a qualified doctor about your health. In an emergency, call 112.') {
  return h('p', { class: 'notice notice-neutral' }, icon('info', 18), h('span', {}, text));
}
