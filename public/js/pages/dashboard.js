import { h, s, icon, toast, announce } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { empty, telHref } from '../ui.js';
import { getOrigin, onOriginChange, locationBar } from '../location.js';
import { createRealMap } from '../real-map.js';
import { art3d, iconTile } from '../art3d.js';
import { km } from '../format.js';
import { greeting, weekday, dateLong, relativeDay, monthShort, dayOfMonth, nowTimeIst, initials, bytes } from '../format.js';

const GENDER = { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Prefers not to say' };
const R = 40;
const C = 2 * Math.PI * R;

/**
 * The three nearest hospitals that list an emergency department, from the patient's chosen
 * location (or the default). Filled in after the page draws, so the dashboard never waits on it.
 */
function nearestEmergency() {
  const box = h('div', { class: 'stack-8' }, h('div', { class: 'skeleton skeleton-row' }));
  const fill = () => {
  const o = getOrigin();
  api(`/hospitals/nearby?lat=${o.lat}&lng=${o.lng}&emergencyOnly=true&radiusKm=25&limit=3`).then((r) => {
    box.replaceChildren(
      h('h3', { class: 't-headline' }, 'Nearest emergency departments'),
      ...(r.hospitals.length ? r.hospitals.map((x) => h('div', { class: 'spread emergency-row' },
        h('a', { href: `/hospital/?id=${x.id}`, class: 'stack-4' }, h('span', { class: 't-callout' }, x.name), h('span', { class: 't-footnote muted' }, `${x.area} · ${km(x.distanceKm)}`)),
        x.phone ? h('a', { class: 'btn btn-secondary', href: telHref(x.phone), 'aria-label': `Call ${x.name}` }, icon('phone', 16), 'Call')
          : h('a', { class: 'btn btn-secondary', href: `https://www.google.com/maps/search/?api=1&query=${x.location.lat},${x.location.lng}`, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Directions to ${x.name} in Google Maps, opens in a new tab` }, icon('route', 16), 'Directions', icon('external', 16))))
        : [h('p', { class: 't-subhead muted' }, 'No hospital near you lists an emergency department. Call 112.')]),
      h('p', { class: 't-footnote muted' }, `Measured from ${o.label || 'your area'}. Only hospitals whose listing says they have an emergency department are shown.`));
  }).catch(() => box.replaceChildren(h('p', { class: 't-subhead muted' }, 'Nearby emergency departments could not load. Call 112.')));
  };
  fill();
  onOriginChange(fill);
  return box;
}

/**
 * Near you (2026-11-04): the nearest pharmacy, diagnostic centre and care places from the patient's
 * live or chosen location, on a real map. Follows the location as it changes.
 */
function nearYou() {
  const list = h('div', { class: 'near-grid' }, h('div', { class: 'skeleton skeleton-block' }));
  const mapBox = h('div', { class: 'near-map' });
  const KINDS = [
    { key: 'hospitals', path: '/hospitals', label: 'Hospital or clinic', kind: 'hospital', art: 'hospital', href: (x) => `/hospital/?id=${x.id}`, more: '/search/hospitals/' },
    { key: 'pharmacies', path: '/pharmacies', label: 'Pharmacy', kind: 'pharmacy', art: 'pharmacy', href: (x) => `/pharmacy/?id=${x.id}`, more: '/search/medicines/?tab=pharmacies' },
    { key: 'diagnosticCentres', path: '/diagnostic-centres', label: 'Diagnostic centre', kind: 'diagnostic', art: 'diagnostic', href: (x) => `/diagnostic/?id=${x.id}`, more: '/search/diagnostics/' },
  ];
  let seq = 0;
  async function fill() {
    const mine = ++seq;
    const o = getOrigin();
    const got = await Promise.all(KINDS.map((k) => api(`${k.path}?lat=${o.lat}&lng=${o.lng}&limit=3`).then((r) => r[k.key]).catch(() => [])));
    if (mine !== seq) return;
    list.replaceChildren(...KINDS.map((k, i) => {
      const [first, ...rest] = got[i];
      return h('section', { class: 'card near-card' },
        h('div', { class: 'card-icon3d' }, iconTile(k.art, 44), h('p', { class: 't-footnote muted' }, `Nearest ${k.label.toLowerCase()}`)),
        first ? h('a', { class: 'near-main', href: k.href(first) }, h('span', { class: 't-headline' }, first.name), h('span', { class: 't-subhead muted' }, `${first.area} · ${km(first.distanceKm)}`)) : h('p', { class: 't-subhead muted' }, 'None listed near here.'),
        rest.length ? h('ul', { class: 'near-more' }, rest.map((x) => h('li', {}, h('a', { href: k.href(x) }, x.name), h('span', { class: 'muted num' }, ` ${km(x.distanceKm)}`)))) : null,
        h('a', { class: 'btn btn-text btn-sm', href: k.more }, 'See more', icon('chevron', 16)));
    }));
    const pins = KINDS.flatMap((k, i) => got[i].slice(0, 1).map((x) => ({ ...x.location, label: x.name, href: k.href(x), kind: k.kind })));
    mapBox.replaceChildren(createRealMap({ pins, origin: o, height: 260, label: 'Map of the nearest places' }));
  }
  fill();
  onOriginChange(fill);
  return h('section', { class: 'stack-12 near-you', 'aria-labelledby': 'near-you-title' },
    h('div', { class: 'card-icon3d' }, iconTile('pin', 40), h('h2', { class: 't-title-2', id: 'near-you-title' }, 'Near you')),
    locationBar(),
    h('div', { class: 'near-layout' }, list, mapBox));
}

/** Shortcuts into finding care, each with its 3D object and the live count of what CareRoute lists. */
function findCare() {
  const tiles = [
    { key: 'carePlaces', label: 'Hospitals and clinics', href: '/search/hospitals/', art: 'hospital' },
    { key: 'doctors', label: 'Doctors', href: '/search/hospitals/?tab=doctors', art: 'doctor' },
    { key: 'medicines', label: 'Medicine prices', href: '/search/medicines/', art: 'medicine' },
    { key: 'diagnosticCentres', label: 'Tests and labs', href: '/search/diagnostics/', art: 'diagnostic' },
    { key: null, label: 'Explore Hyderabad', href: '/explore/', art: 'chart' },
  ];
  const counts = new Map();
  const grid = h('div', { class: 'care-tiles' }, tiles.map((t) => {
    const n = h('span', { class: 't-footnote muted num' }, t.key ? 'Loading' : 'Maps and charts');
    if (t.key) counts.set(t.key, n);
    const art = art3d(t.art);
    art?.setAttribute('class', 'tile-art art3d');
    return h('a', { class: 'care-tile card-link', href: t.href }, art, h('span', { class: 't-headline' }, t.label), n);
  }));
  api('/insights').then((x) => {
    const totals = { ...x.totals, medicines: x.medicines };
    for (const [k, el] of counts) el.textContent = typeof totals[k] === 'number' ? `${totals[k].toLocaleString('en-IN')} listed` : '';
  }).catch(() => { for (const el of counts.values()) el.textContent = 'Count unavailable'; });
  return h('section', { class: 'stack-12', 'aria-labelledby': 'find-h' }, h('div', { class: 'card-icon3d' }, iconTile('doctor', 40), h('h2', { class: 't-title-2', id: 'find-h' }, 'Find care')), grid);
}

const { main, user } = await shell({ nav: 'dashboard', title: 'Dashboard' });
document.body.classList.add('dashboard-view');

try {
  const data = await api('/patients/me/dashboard');
  let photoUrl = null;
  if (data.patient.hasPhoto) photoUrl = (await api('/patients/me/photo').catch(() => null))?.url ?? null;
  render(data, photoUrl);
} catch (err) {
  loadError(main, err);
}

function doseRing(taken, total) {
  const bar = s('circle', { class: 'bar', cx: 48, cy: 48, r: R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': total ? C * (1 - taken / total) : C });
  const label = h('span', { class: 't-title-2 num' }, `${taken}/${total}`);
  const el = h('div', { class: 'dose-ring', role: 'img', 'aria-label': `${taken} of ${total} doses taken today` },
    s('svg', { width: 96, height: 96, viewBox: '0 0 96 96', 'aria-hidden': 'true' }, s('circle', { class: 'track', cx: 48, cy: 48, r: R, fill: 'none', 'stroke-width': 8 }), bar),
    h('span', { class: 'stack-4', style: 'justify-items:center' }, label, h('span', { class: 't-caption muted' }, 'taken')));
  return {
    el,
    set(t, n) {
      bar.setAttribute('stroke-dashoffset', String(n ? C * (1 - t / n) : C));
      label.textContent = `${t}/${n}`;
      el.setAttribute('aria-label', `${t} of ${n} doses taken today`);
    },
  };
}

function render(d, photoUrl) {
  const p = d.patient;
  const first = (p.name || user.name).split(' ')[0];
  const now = nowTimeIst();

  // Today's doses
  const doses = d.today.doses;
  const ring = doseRing(d.today.taken, d.today.total);
  const nextIdx = doses.findIndex((x) => x.status === 'due' && x.time >= now);
  const doseList = h('div', { class: 'doses' });
  const drawDoses = () => {
    const taken = doses.filter((x) => x.status === 'taken').length;
    ring.set(taken, doses.length);
    doseList.replaceChildren(...doses.map((x, i) => {
      const late = x.status === 'due' && x.time < now;
      const row = h('div', { class: `dose is-${x.status}${i === nextIdx ? ' is-next' : ''}` },
        h('span', { class: 'dose-time' }, x.time),
        h('span', { class: 'stack-4', style: 'min-width:0' },
          h('span', { class: 't-headline' }, x.medicineName),
          h('span', { class: 't-footnote muted' }, [x.dose, x.instructions].filter(Boolean).join(' · '))),
        x.status === 'due'
          ? h('span', { class: 'dose-actions' },
            late ? h('span', { class: 'tag tag-warning' }, 'Due') : null,
            h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => mark(x, 'skipped') }, 'Skip'),
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => mark(x, 'taken') }, icon('check', 16), 'Taken'))
          : h('span', { class: `status ${x.status === 'taken' ? 'status-ok' : 'status-idle'}` }, x.status === 'taken' ? 'Taken' : 'Skipped'));
      return row;
    }));
  };
  async function mark(dose, status) {
    const before = dose.status;
    dose.status = status;
    drawDoses();
    try {
      await api(`/patients/me/reminders/${dose.reminderId}/doses`, { body: { date: d.date, time: dose.time, status } });
      announce(`${dose.medicineName} marked ${status}`);
    } catch (err) {
      dose.status = before;
      drawDoses();
      toast(err.message);
    }
  }
  drawDoses();

  const medsCard = h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'meds-h' },
    h('div', { class: 'spread' },
      h('div', { class: 'stack-4' }, h('h2', { class: 't-title-2', id: 'meds-h' }, 'Today’s medicines'), h('p', { class: 't-subhead muted' }, `${weekday(d.date)}, ${dateLong(d.date)}`)),
      h('a', { class: 'btn btn-secondary btn-sm', href: '/reminders/' }, 'Manage')),
    doses.length
      ? h('div', { class: 'dose-wrap' }, ring.el, h('div', { class: 'dose-list' }, doseList))
      : empty({ iconName: 'clock', title: 'No medicines due today', text: 'Add a reminder with the times you take each medicine. You will see it here and get a reminder in this browser.', action: h('a', { class: 'btn btn-primary', href: '/reminders/#new' }, icon('plus', 18), 'Add a reminder') }));

  const apptCard = h('section', { class: 'card stack-16', 'aria-labelledby': 'appt-h' },
    h('div', { class: 'spread' },
      h('h2', { class: 't-title-2', id: 'appt-h' }, 'Upcoming appointments'),
      h('a', { class: 'btn btn-secondary btn-sm', href: '/appointments/' }, d.appointments.length ? 'See all' : 'Add')),
    d.appointments.length
      ? h('div', { class: 'list' }, d.appointments.map((a) => h('a', { class: 'list-row lift', href: '/appointments/' },
        h('span', { class: 'date-tile', 'aria-hidden': 'true' }, h('span', { class: 'date-tile-month' }, monthShort(a.date)), h('span', { class: 'date-tile-day' }, dayOfMonth(a.date))),
        h('span', { class: 'list-row-main' },
          h('span', { class: 'list-row-title' }, a.doctorName),
          h('span', { class: 'list-row-meta' }, [a.speciality, a.place].filter(Boolean).join(' · '))),
        h('span', { class: 'list-row-trail' }, h('span', { class: 'stack-4', style: 'text-align:right' }, h('span', { class: 't-headline', style: 'color:var(--text-1)' }, relativeDay(a.date, d.date)), h('span', { class: 't-footnote num' }, a.time))))))
      : empty({ iconName: 'calendar', title: 'No upcoming appointments', text: 'Booked a visit with a doctor? Log it here to keep the date, time and place in one place.' }));

  const detailsCard = h('section', { class: 'card stack-16', 'aria-labelledby': 'me-h' },
    h('div', { class: 'spread' }, h('h2', { class: 't-title-3', id: 'me-h' }, 'Your details'), h('a', { href: '/medical-id/', class: 't-subhead strong' }, 'Edit')),
    h('dl', { class: 'facts facts-2' },
      h('div', {}, h('dt', {}, 'Age'), h('dd', { class: 'num' }, p.age !== null ? `${p.age} years` : 'Not added')),
      h('div', {}, h('dt', {}, 'Gender'), h('dd', {}, GENDER[p.gender] || 'Not added')),
      h('div', {}, h('dt', {}, 'Blood group'), h('dd', { class: 't-title-3' }, p.bloodGroup || 'Not added')),
      h('div', {}, h('dt', {}, 'Emergency contacts'), h('dd', { class: 'num' }, String(p.contactCount))),
      h('div', { class: 'span-2' }, h('dt', {}, 'Allergies'), h('dd', {}, p.allergies.length ? h('span', { class: 'row-8' }, p.allergies.map((a) => h('span', { class: 'tag tag-danger' }, a))) : 'None added')),
      h('div', { class: 'span-2' }, h('dt', {}, 'Conditions'), h('dd', {}, p.conditions.length ? p.conditions.join(', ') : 'None added'))),
    h('p', { class: `status ${p.shareWithCrew ? 'status-ok' : 'status-idle'}` }, p.shareWithCrew ? 'Shared with your ambulance crew in an emergency' : 'Not shared with the ambulance crew'));

  const docsCard = h('section', { class: 'card stack-12', 'aria-labelledby': 'docs-h' },
    h('div', { class: 'spread' }, h('h2', { class: 't-title-3', id: 'docs-h' }, 'Recent documents'), h('a', { href: '/documents/', class: 't-subhead strong' }, d.documents.length ? 'All' : 'Upload')),
    d.documents.length
      ? h('div', { class: 'list' }, d.documents.map((f) => h('a', { class: 'list-row lift', href: '/documents/' },
        h('span', { class: 'obj' }, icon('report', 22)),
        h('span', { class: 'list-row-main' }, h('span', { class: 'list-row-title' }, f.title), h('span', { class: 'list-row-meta' }, `${dateLong(f.uploadedAt)} · ${bytes(f.sizeBytes)}`)))))
      : h('p', { class: 't-subhead muted' }, 'Lab reports, prescriptions and scans you upload appear here.'));

  const sosCard = h('section', { class: 'card stack-12', 'aria-labelledby': 'sos-h' },
    h('div', { class: 'card-icon3d' }, iconTile('ambulance', 52), h('h2', { class: 't-title-3', id: 'sos-h' }, 'In an emergency')),
    h('a', { class: 'sos-key', href: 'tel:112' }, h('span', { class: 'sos-key-title' }, 'Call 112'), h('span', { class: 'sos-key-sub' }, 'National emergency number')),
    h('p', { class: 't-footnote muted' }, 'Ambulance requests through CareRoute are being built and are not live yet.'),
    nearestEmergency());

  const completeness = p.completeness < 100 ? h('a', { class: 'card card-link stack-12', href: '/medical-id/' },
    h('div', { class: 'spread' },
      h('div', { class: 'card-icon3d' }, iconTile('idcard', 48), h('div', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'Complete your medical ID'), h('span', { class: 't-subhead muted' }, 'It helps an ambulance crew treat you quickly.'))),
      h('span', { class: 't-title-3 num' }, `${p.completeness}%`)),
    h('div', { class: 'meter', role: 'progressbar', 'aria-valuenow': p.completeness, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Medical ID complete' }, h('span', { style: `width:${p.completeness}%` }))) : null;

  main.replaceChildren(h('div', { class: 'page dashboard-page' },
    h('header', { class: 'spread' },
      h('div', { class: 'greeting' },
        h('span', { class: 'avatar avatar-l', 'aria-hidden': 'true' }, photoUrl ? h('img', { src: photoUrl, alt: '' }) : initials(p.name || user.name)),
        h('div', { class: 'stack-4' },
          h('h1', { class: 't-large-title' }, `${greeting()}, ${first}`),
          h('p', { class: 't-callout muted' }, `${weekday(d.date)}, ${dateLong(d.date)}`))),
      h('div', { class: 'row-8 dash-actions' },
        h('a', { class: 'btn btn-secondary', href: '/appointments/#new' }, icon('calendar', 18), 'Log appointment'),
        h('a', { class: 'btn btn-primary', href: '/reminders/#new' }, icon('plus', 18), 'Add reminder'))),
    completeness,
    findCare(),
    nearYou(),
    h('div', { class: 'stat-row' },
      h('a', { class: 'stat card-link', href: '/reminders/' }, iconTile('pill', 48), h('span', { class: 'stat-value' }, `${d.today.taken}/${d.today.total}`), h('span', { class: 't-subhead muted' }, 'Doses taken today')),
      h('a', { class: 'stat card-link', href: '/reminders/' }, iconTile('medicine', 48), h('span', { class: 'stat-value' }, String(d.counts.reminders)), h('span', { class: 't-subhead muted' }, 'Active reminders')),
      h('a', { class: 'stat card-link', href: '/appointments/' }, iconTile('calendar', 48), h('span', { class: 'stat-value' }, String(d.counts.appointments)), h('span', { class: 't-subhead muted' }, 'Upcoming appointments')),
      h('a', { class: 'stat card-link', href: '/documents/' }, iconTile('document', 48), h('span', { class: 'stat-value' }, String(d.counts.documents)), h('span', { class: 't-subhead muted' }, 'Documents'))),
    h('div', { class: 'dash-grid' },
      h('div', { class: 'stack-24' }, medsCard, apptCard, docsCard),
      h('div', { class: 'stack-24' }, detailsCard, sosCard))));
}
