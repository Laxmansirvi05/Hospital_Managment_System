import { h, icon, toast, rupees } from '../h.js';
import { ADMIN, HOSPITALS, DOCTORS, PHARMACIES, DIAGNOSTICS, MEDICINES, STATUS_LABEL, hospitalNameFor } from '../data.js';
import { createMap } from '../map3d.js';
import { bars3d } from '../charts.js';
import { pageHead } from './ui.js';

function statusClass(st) {
  if (st === 'failed') return 'status-bad';
  if (st === 'picked_up') return 'status-ok';
  return 'status-live';
}

export function overview() {
  const peak = Math.max(...ADMIN.responseByHour.map((x) => x.minutes));
  const chart = bars3d({
    title: 'Average minutes from request to arrival, by hour of day',
    items: ADMIN.responseByHour.map((x) => ({ label: `${x.hour}:00`, value: x.minutes, display: x.minutes.toFixed(1), peak: x.minutes === peak })),
    height: 260,
  });
  const table = h('div', { class: 'table-wrap', hidden: true },
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Hour'), h('th', { scope: 'col', class: 'num' }, 'Average minutes to arrival'))),
      h('tbody', {}, ADMIN.responseByHour.map((x) => h('tr', {}, h('td', { class: 'num' }, `${x.hour}:00`), h('td', { class: 'num' }, x.minutes.toFixed(1))))),
    ),
  );
  const toggle = h('button', { class: 'btn btn-text btn-sm', type: 'button', 'aria-expanded': 'false' }, 'Show table');
  toggle.addEventListener('click', () => {
    const show = table.hidden;
    table.hidden = !show;
    chart.hidden = show;
    toggle.textContent = show ? 'Show chart' : 'Show table';
    toggle.setAttribute('aria-expanded', String(show));
  });

  const cases = [...ADMIN.activeCases].sort((a, b) => (a.status === 'failed' ? -1 : b.status === 'failed' ? 1 : 0));
  const fleet = createMap({
    you: false,
    pins: [
      { x: 548, y: 246, kind: 'ambulance', label: 'TS 09 EA 4521, on a trip', showLabel: true },
      { x: 300, y: 300, kind: 'ambulance', label: 'TS 09 UB 2210, available' },
      { x: 700, y: 452, kind: 'ambulance', label: 'TS 08 UA 7781, on a trip' },
      { x: 190, y: 380, kind: 'ambulance', label: 'TS 07 EC 1934, available' },
      { x: 640, y: 150, kind: 'ambulance', label: 'TS 09 FA 6012, available' },
    ],
    caption: 'Illustrative map, not to scale',
  });

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Overview', sub: 'Sample figures for 24 Oct 2026. Hours are in Indian Standard Time.' }),
    h('section', { class: 'card card-raised' },
      h('div', { class: 'kpis' }, ADMIN.kpis.map((k) => h('div', { class: 'kpi' },
        h('span', { class: 'kpi-value' }, k.value),
        h('span', { class: 't-subhead muted' }, k.label)))),
    ),
    h('section', { class: 'card stack-16', 'aria-labelledby': 'ac-h' },
      h('div', { class: 'spread' },
        h('h2', { class: 't-title-2', id: 'ac-h' }, 'Active emergencies'),
        h('span', { class: 't-subhead muted' }, 'Requests with no ambulance are pinned to the top'),
      ),
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, ['Request', 'Area', 'What happened', 'Status', 'Since request', 'Ambulance'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, cases.map((c) => h('tr', {},
            h('td', { class: 'num strong' }, c.id),
            h('td', {}, c.area),
            h('td', {}, c.type),
            h('td', {}, h('span', { class: `status ${statusClass(c.status)}` }, STATUS_LABEL[c.status])),
            h('td', { class: 'num' }, c.since),
            h('td', {}, c.ambulance),
          ))),
        ),
      ),
      h('p', { class: 't-footnote muted' }, 'Operational details only. Medical ID, reports and notes are never shown to admins.'),
    ),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card stack-16', 'aria-labelledby': 'rt-h' },
        h('div', { class: 'spread' },
          h('div', { class: 'stack-4' },
            h('h2', { class: 't-title-3', id: 'rt-h' }, 'Time from request to arrival'),
            h('p', { class: 't-footnote muted' }, 'Average minutes, last 30 days, by hour of day'),
          ),
          toggle,
        ),
        chart,
        table,
      ),
      h('section', { class: 'card stack-16', 'aria-labelledby': 'fl-h' },
        h('div', { class: 'stack-4' },
          h('h2', { class: 't-title-3', id: 'fl-h' }, 'Ambulances online'),
          h('p', { class: 't-footnote muted' }, '5 online: 2 on a trip, 3 available'),
        ),
        fleet.el,
      ),
    ),
  );
  return { el, title: 'Overview' };
}

const KINDS = [
  ['hospitals', 'Hospitals'], ['doctors', 'Doctors'], ['pharmacies', 'Pharmacies'], ['diagnostics', 'Diagnostic centres'], ['medicines', 'Medicine prices'],
];

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function daysSince(checked) {
  const [d, m, y] = checked.split(/[\s,]+/);
  const then = Date.UTC(Number(y), MONTHS[m], Number(d));
  return Math.round((Date.UTC(2026, 9, 24) - then) / 86400000);
}

function rowsFor(kind) {
  if (kind === 'hospitals') return HOSPITALS.map((x) => [x.name, x.area, x.source, x.checked]);
  if (kind === 'doctors') return DOCTORS.map((d) => [`${d.name}, ${d.specialization}`, hospitalNameFor(d), d.source, d.checked]);
  if (kind === 'pharmacies') return PHARMACIES.map((p) => [p.name, p.area, p.source, p.checked]);
  if (kind === 'diagnostics') return DIAGNOSTICS.map((c) => [c.name, c.area, c.source, c.checked]);
  return MEDICINES.flatMap((m) => m.listings.map((l) => [`${m.name}, ${rupees(l.price)}`, m.pack, l.platform, l.checked.split(',')[0]]));
}

export function listings({ query }) {
  const kind = query.get('kind') || 'hospitals';
  const rows = rowsFor(kind);
  const stale = rows.filter((r) => daysSince(r[3]) > 30).length;
  const el = h('div', { class: 'page' },
    pageHead({
      title: 'Listings',
      sub: 'Healthcare information shown in search. Each listing keeps its source platform and the date it was last checked.',
      actions: h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toast('Prototype only. Nothing was added.') }, icon('plus', 18), 'Add listing'),
    }),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Listing type' },
      KINDS.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(v === kind), onclick: () => { location.hash = `#/admin/listings?kind=${v}`; } }, label))),
    stale ? h('p', { class: 'notice notice-warning' }, icon('alert', 18), h('span', {}, `${stale} ${stale === 1 ? 'listing was' : 'listings were'} last checked more than 30 days ago.`)) : null,
    h('div', { class: 'table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {}, ['Name', kind === 'doctors' ? 'Practises at' : kind === 'medicines' ? 'Pack' : 'Area', 'Source', 'Last checked', 'State', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, rows.map(([name, where, src, checked]) => {
          const old = daysSince(checked) > 30;
          return h('tr', {},
            h('td', { class: 'strong' }, name),
            h('td', {}, where),
            h('td', {}, src),
            h('td', { class: 'num' }, checked),
            h('td', {}, old ? h('span', { class: 'status status-warn' }, 'Needs a check') : h('span', { class: 'status status-ok' }, 'Shown in search')),
            h('td', {}, h('div', { class: 'row-8', style: 'flex-wrap:nowrap' },
              h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: () => toast('Prototype only. Editing is not connected.') }, 'Edit'),
              h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: () => toast('Prototype only. Nothing was hidden.') }, 'Hide'),
            )),
          );
        })),
      ),
    ),
  );
  return { el, title: 'Listings' };
}

export function users() {
  const people = ADMIN.users.map((u) => ({ ...u }));
  const body = h('tbody');
  const draw = () => body.replaceChildren(...people.map((u) => h('tr', {},
    h('td', { class: 'strong' }, u.name),
    h('td', {}, u.email),
    h('td', {}, u.role),
    h('td', { class: 'num' }, u.joined),
    h('td', {}, h('span', { class: `status ${u.state === 'Active' ? 'status-ok' : 'status-idle'}` }, u.state)),
    h('td', {}, u.role === 'Admin' ? h('span', { class: 't-footnote muted' }, 'Managed by the owner')
      : h('button', {
        class: `btn btn-sm ${u.state === 'Active' ? 'btn-destructive' : 'btn-secondary'}`, type: 'button',
        onclick: () => { u.state = u.state === 'Active' ? 'Disabled' : 'Active'; draw(); toast(`${u.name} is now ${u.state.toLowerCase()} in this prototype`); },
      }, u.state === 'Active' ? 'Disable' : 'Enable')),
  )));
  draw();

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Users', sub: 'Account details only. Medical ID, reports and emergency notes are never shown here.' }),
    h('div', { class: 'table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {}, ['Name', 'Email', 'Role', 'Joined', 'State', ''].map((t) => h('th', { scope: 'col' }, t)))),
        body,
      ),
    ),
    h('p', { class: 't-footnote muted' }, 'Driver and admin accounts are created by the platform owner. Only patients can sign up on their own.'),
  );
  return { el, title: 'Users' };
}
