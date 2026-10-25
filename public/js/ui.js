import { h, icon } from './h.js';
import { dateLong, km } from './format.js';

export function pageHead({ title, sub, crumbs, actions, large = true }) {
  return h('header', { class: 'page-head' },
    crumbs ? h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      crumbs.map(([label, href], i) => [i ? icon('chevron', 14) : null, href ? h('a', { href }, label) : h('span', { 'aria-current': 'page' }, label)])) : null,
    h('div', { class: 'spread' }, h('h1', { class: large ? 't-large-title' : 't-title-1' }, title), actions || null),
    sub ? h('p', { class: 't-callout muted', style: 'max-width:680px' }, sub) : null);
}

/** Rating as the source platform shows it. Who writes reviews is still open (Q-24). */
export function rating(item) {
  if (item.rating === null || item.rating === undefined) return null;
  return h('span', { class: 'rating', title: item.source ? `Rating on ${item.source.platform}` : '' },
    icon('star', 16), item.rating.toFixed(1),
    h('span', { class: 'muted', style: 'font-weight:400' }, `(${(item.ratingCount ?? 0).toLocaleString('en-IN')})`));
}

export function ratingBlock(item) {
  if (item.rating === null || item.rating === undefined) return null;
  const full = Math.round(item.rating);
  return h('div', { class: 'row', style: 'align-items:center' },
    h('span', { class: 't-large-title num' }, item.rating.toFixed(1)),
    h('div', { class: 'stack-4' },
      h('span', { class: 'row-8', style: 'gap:2px;color:var(--warning)', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map((n) => h('span', { style: n <= full ? '' : 'color:var(--border)' }, icon('star', 18)))),
      h('span', { class: 't-footnote muted' }, `${(item.ratingCount ?? 0).toLocaleString('en-IN')} ratings on ${item.source.platform}`)));
}

export function source(item) {
  return h('div', { class: 'stack-4' },
    h('p', { class: 't-footnote muted row-8' }, icon('info', 14), `Source: ${item.source.platform}. Checked on ${dateLong(item.source.checkedAt)}.`),
    osmCredit([item]));
}

/** The ODbL credit OpenStreetMap requires wherever its data is shown (D-50). Null when none of the items came from it. */
export function osmCredit(items) {
  if (!items.some((x) => x.source?.platform === 'OpenStreetMap')) return null;
  return h('p', { class: 't-footnote muted' }, 'Listing data ', extLink('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'), ', available under the Open Database License.');
}

export function distance(item) {
  return item.distanceKm !== undefined ? h('span', { class: 'num t-subhead' }, km(item.distanceKm)) : null;
}

/** Initials of a doctor's name, without the "Dr" prefix. */
export function initials(name) {
  return (name || '').replace(/^Dr\.?\s*/i, '').replace(/\([^)]*\)/g, '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'Dr';
}

/**
 * The doctor's photo from the hospital's own website (D-55), or initials when there is none or
 * it fails to load. The image is decorative because the name is always next to it.
 */
export function doctorPhoto(d, size = '') {
  const wrap = h('span', { class: `avatar ${size}`.trim(), 'aria-hidden': 'true' });
  const fallback = () => wrap.replaceChildren(initials(d.name));
  if (d.photoUrl) wrap.append(h('img', { src: d.photoUrl, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', onerror: fallback }));
  else fallback();
  return wrap;
}

export function listingRow({ href, kind, title, meta, trail, media }) {
  const iconName = { hospital: 'hospital', doctor: 'doctor', pharmacy: 'pharmacy', diagnostic: 'flask', medicine: 'pill' }[kind];
  return h('a', { class: 'list-row lift', href },
    media || h('span', { class: 'obj' }, icon(iconName, 22)),
    h('span', { class: 'list-row-main' }, h('span', { class: 'list-row-title' }, title), meta.filter(Boolean).map((m) => h('span', { class: 'list-row-meta' }, m))),
    h('span', { class: 'list-row-trail' }, trail || null, icon('chevron', 18)));
}

export function leaveNote() {
  return h('p', { class: 't-footnote muted' }, 'Links open the provider’s own website. CareRoute does not book appointments, sell medicines or take payments.');
}

export function extLink(href, label) {
  // Defence in depth: the database already requires http or https, but a javascript: link must never render.
  if (!/^https?:\/\//i.test(String(href))) return h('span', {}, label);
  return h('a', { class: 'link-ext', href, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external', 16));
}

export function telHref(phone) {
  return `tel:${phone.replace(/\s/g, '')}`;
}

export function skeletonList(rows = 4) {
  return h('div', { class: 'stack-12', 'aria-busy': 'true', 'aria-label': 'Loading' },
    h('div', { class: 'skeleton skeleton-title' }),
    Array.from({ length: rows }, () => h('div', { class: 'skeleton skeleton-row' })));
}

export function empty({ iconName = 'search', title, text, action }) {
  return h('div', { class: 'empty' },
    h('span', { class: 'empty-art' }, icon(iconName, 32)),
    h('p', { class: 't-title-3' }, title),
    text ? h('p', { class: 't-subhead muted', style: 'max-width:420px' }, text) : null,
    action || null);
}

export function disclaimer(text) {
  return h('p', { class: 'notice notice-neutral' }, icon('info', 18), h('span', {}, text));
}

/** A labelled field. The input keeps its own id; the hint and error are linked to it. */
export function field({ id, label, input, hint, span2 = false }) {
  input.id = id;
  input.name = input.name || id;
  const hintEl = hint ? h('span', { class: 'hint', id: `${id}-hint` }, hint) : null;
  const err = h('span', { class: 'field-error', id: `${id}-error`, hidden: true });
  input.setAttribute('aria-describedby', [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' '));
  return h('div', { class: `field${span2 ? ' span-2' : ''}`, 'data-field': id }, h('label', { for: id }, label), input, hintEl, err);
}

/** Shows server field errors next to their inputs. Unknown keys go to the form-level message. */
export function showErrors(form, err, formMessage) {
  for (const e of form.querySelectorAll('.field-error')) { e.hidden = true; e.textContent = ''; }
  for (const i of form.querySelectorAll('[aria-invalid]')) i.removeAttribute('aria-invalid');
  const leftover = [];
  for (const [key, msg] of Object.entries(err.fields || {})) {
    const id = key.split('.').pop();
    const errEl = form.querySelector(`#${CSS.escape(key.replace(/\./g, '-'))}-error`) || form.querySelector(`#${CSS.escape(id)}-error`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
      errEl.parentElement.querySelector('input,select,textarea')?.setAttribute('aria-invalid', 'true');
    } else {
      leftover.push(msg);
    }
  }
  if (formMessage) {
    const text = leftover.length ? leftover.join(' ') : Object.keys(err.fields || {}).length ? '' : err.message;
    formMessage.hidden = !text;
    formMessage.replaceChildren(icon('alert', 18), h('span', {}, text || ''));
  }
  form.querySelector('[aria-invalid="true"]')?.focus();
}

/** Puts a button into a busy state and returns a restore function. */
export function busy(button, label = 'Saving') {
  const original = [...button.childNodes];
  const width = button.offsetWidth;
  button.disabled = true;
  button.style.minWidth = `${width}px`;
  button.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, label));
  return () => { button.disabled = false; button.replaceChildren(...original); };
}

/** Native dialog for confirmations that cost something. Resolves true when confirmed. */
export function confirmDialog({ title, text, confirm = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'cd-title' },
      h('form', { method: 'dialog', class: 'sheet-body' },
        h('h2', { class: 't-title-2', id: 'cd-title' }, title),
        text ? h('p', { class: 't-subhead muted' }, text) : null,
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('button', { class: 'btn btn-secondary', value: 'no' }, 'Cancel'),
          h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'yes' }, confirm))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function areaSelect(areas, value, id = 'area') {
  return h('select', { class: 'select', id, 'aria-label': 'Area' },
    h('option', { value: '' }, 'All of Hyderabad'),
    areas.map((a) => h('option', { value: a, selected: a === value }, a)));
}

/** Where distances are measured from: the browser location if allowed, else Begumpet. */
export const DEFAULT_ORIGIN = { lat: 17.447656, lng: 78.45216, label: 'Begumpet' };

export function getOrigin() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('careroute.origin') || 'null');
    if (saved && typeof saved.lat === 'number') return saved;
  } catch {
    // Session storage can be blocked; fall back to the default origin.
  }
  return DEFAULT_ORIGIN;
}

export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This browser cannot share location. Distances are from Begumpet.')); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const o = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5), label: 'your location' };
      try {
        sessionStorage.setItem('careroute.origin', JSON.stringify(o));
      } catch {
        // Without storage the location is used for this page only.
      }
      resolve(o);
    }, () => reject(new Error('Location is off. Distances are from Begumpet. You can still search by area.')), { timeout: 8000, maximumAge: 300000 });
  });
}
