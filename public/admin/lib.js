// Small helpers shared by the admin screens. Built on h.js and api.js only, so the admin side does not
// depend on patient-page code. Every piece of data goes in as a text node (docs/02-trd.md section 8.7).
import { h, icon, toast } from '/js/h.js';

export { h, icon, toast };

const WHEN = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
export const when = (iso) => (iso ? WHEN.format(new Date(iso)) : 'Never');
export const dayOf = (iso) => (iso ? DAY.format(new Date(iso)) : 'Not set');

export const KIND_LABEL = { hospital: 'Hospital or clinic', doctor: 'Doctor', pharmacy: 'Pharmacy', diagnostic_centre: 'Diagnostic centre' };
export const KIND_SHORT = { hospital: 'Hospital', doctor: 'Doctor', pharmacy: 'Pharmacy', diagnostic_centre: 'Diagnostic' };
export const ROLE_LABEL = { patient: 'Patient', driver: 'Driver', admin: 'Admin' };

export function pageHead({ title, sub, actions }) {
  return h('header', { class: 'page-head' },
    h('div', { class: 'spread' }, h('h1', { class: 't-large-title', tabindex: '-1' }, title), actions || null),
    sub ? h('p', { class: 't-callout muted', style: 'max-width:720px' }, sub) : null);
}

export const tag = (text, tone = '') => h('span', { class: `tag${tone ? ` tag-${tone}` : ''}` }, text);

export function debounce(fn, ms = 250) {
  let timer = 0;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/** Message for a failed call, in words an admin can act on. */
export const errorText = (err) => err?.message || 'Something went wrong. Try again.';

export function errorNotice(err, retry) {
  return h('div', { class: 'notice notice-danger', role: 'alert' }, icon('alert', 18),
    h('span', {}, errorText(err), ' ', retry ? h('button', { class: 'link-btn', type: 'button', onclick: retry }, 'Try again') : null));
}

export function loading(label = 'Loading') {
  return h('p', { class: 't-subhead muted', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), ' ', label);
}

/** columns: [{ label, cell(row) }]. A table with a caption for screen readers. */
export function dataTable({ caption, columns, rows, emptyText }) {
  if (!rows.length) return h('p', { class: 'admin-empty t-subhead muted' }, emptyText);
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'admin-table' },
      h('caption', { class: 'visually-hidden' }, caption),
      h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: c.align === 'end' ? 'is-end' : '' }, c.label)))),
      h('tbody', {}, rows.map((row) => h('tr', {}, columns.map((c) => h('td', { class: c.align === 'end' ? 'is-end' : '', 'data-label': c.label }, c.cell(row))))))));
}

export function pager({ total, limit, offset, onPage }) {
  if (total <= limit) return h('p', { class: 't-footnote muted' }, `${total} ${total === 1 ? 'result' : 'results'}`);
  const from = offset + 1; const to = Math.min(offset + limit, total);
  return h('nav', { class: 'pager', 'aria-label': 'Pages' },
    h('span', { class: 't-footnote muted' }, `${from} to ${to} of ${total}`),
    h('div', { class: 'row-8' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: offset === 0, onclick: () => onPage(Math.max(0, offset - limit)) }, 'Previous'),
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: to >= total, onclick: () => onPage(offset + limit) }, 'Next')));
}

/** A labelled field. The input keeps its id; the hint and the error are linked to it. */
export function field({ id, label, input, hint, span2 = false }) {
  input.id = id; input.name = input.name || id;
  const hintEl = hint ? h('span', { class: 'hint', id: `${id}-hint` }, hint) : null;
  const err = h('span', { class: 'field-error', id: `${id}-error`, hidden: true });
  input.setAttribute('aria-describedby', [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' '));
  return h('div', { class: `field${span2 ? ' span-2' : ''}` }, h('label', { for: id }, label), input, hintEl, err);
}

/** Puts server field errors beside their inputs. Keys like "clinic.name" map to the id "clinic-name". */
export function showErrors(form, err, messageEl) {
  for (const e of form.querySelectorAll('.field-error')) { e.hidden = true; e.textContent = ''; }
  for (const i of form.querySelectorAll('[aria-invalid]')) i.removeAttribute('aria-invalid');
  const leftover = [];
  for (const [key, msg] of Object.entries(err.fields || {})) {
    const errEl = form.querySelector(`#${CSS.escape(key.replace(/\./g, '-'))}-error`);
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; errEl.parentElement.querySelector('input,select,textarea')?.setAttribute('aria-invalid', 'true'); } else leftover.push(msg);
  }
  if (messageEl) {
    const text = leftover.length ? leftover.join(' ') : Object.keys(err.fields || {}).length ? 'Check the highlighted fields.' : errorText(err);
    messageEl.hidden = false; messageEl.replaceChildren(icon('alert', 18), h('span', {}, text));
  }
  form.querySelector('[aria-invalid="true"]')?.focus();
}

export function busy(button, label = 'Saving') {
  const original = [...button.childNodes]; const width = button.offsetWidth;
  button.disabled = true; button.style.minWidth = `${width}px`;
  button.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, label));
  return () => { button.disabled = false; button.replaceChildren(...original); };
}

/** Native dialog for actions that cost something. Resolves true when confirmed. */
export function confirmDialog({ title, text, confirm, danger = true }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'cd-title' },
      h('form', { method: 'dialog', class: 'sheet-body' },
        h('h2', { class: 't-title-2', id: 'cd-title' }, title),
        text ? h('p', { class: 't-subhead muted' }, text) : null,
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('button', { class: 'btn btn-secondary', value: 'no' }, 'Cancel'),
          h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'yes' }, confirm))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg); dlg.showModal();
  });
}

/** A filter bar: each control calls onChange with the current values. */
export function select({ id, label, options, value = '' }) {
  return h('select', { class: 'select', id, 'aria-label': label, value },
    options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
}

/** Asks for one line of text with Cancel and a confirm button. Resolves with the text, or null when cancelled. */
export function promptDialog({ title, text, label, confirm, maxlength = 300, danger = false }) {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', type: 'text', maxlength, autocomplete: 'off' });
    const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'pd-title' },
      h('form', { method: 'dialog', class: 'sheet-body' },
        h('h2', { class: 't-title-2', id: 'pd-title' }, title),
        text ? h('p', { class: 't-subhead muted' }, text) : null,
        field({ id: 'pd-input', label, input }),
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('button', { class: 'btn btn-secondary', value: 'no' }, 'Cancel'),
          h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'yes' }, confirm))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes' ? input.value.trim() : null); dlg.remove(); });
    document.body.append(dlg); dlg.showModal();
  });
}

/** Shows a value the admin must hand over once, with a Copy button. */
export function linkDialog({ title, text, value }) {
  return new Promise((resolve) => {
    const box = h('input', { class: 'input', type: 'text', readonly: true, value, 'aria-label': 'Reset link', onfocus: (e) => e.target.select() });
    const copy = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Copy link');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(value); copy.textContent = 'Copied'; } catch { box.select(); copy.textContent = 'Press Ctrl+C to copy'; }
    });
    const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'ld-title' },
      h('form', { method: 'dialog', class: 'sheet-body' },
        h('h2', { class: 't-title-2', id: 'ld-title' }, title),
        text ? h('p', { class: 't-subhead muted' }, text) : null,
        box,
        h('div', { class: 'row', style: 'justify-content:flex-end' }, copy, h('button', { class: 'btn btn-primary', value: 'done' }, 'Done'))));
    dlg.addEventListener('close', () => { resolve(); dlg.remove(); });
    document.body.append(dlg); dlg.showModal(); box.select();
  });
}
