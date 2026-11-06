// Synthetic ambulance demo operations (D-60 and following). Moved here from the old single page;
// it still polls every five seconds while open and stops when you leave.
import { api } from '/js/api.js';
import { createRealMap } from '/js/real-map.js';
import { h, pageHead, tag, when, dataTable, field, errorNotice } from '/admin/lib.js';

const words = (s) => String(s).replaceAll('_', ' ');
const TONE = { completed: 'success', cancelled: '', no_match: 'danger' };
const secs = (v) => (v == null ? 'Not available' : `${Math.round(v)} s`);

export async function render(page) {
  const demo = h('div', { class: 'notice notice-warning' }, h('span', {}, h('strong', {}, 'Demo: no real ambulance is sent. '), 'This console shows synthetic emergency activity only.'));
  const problem = h('div', { 'aria-live': 'polite' });
  const kpis = h('div', { class: 'admin-grid' });
  const active = h('div', { class: 'stack-8' });
  const unmatched = h('div', { class: 'stack-8' });
  const hourly = h('div', {});
  const nearbyResult = h('div', { 'aria-live': 'polite' });
  const nearType = h('select', { class: 'select' }, [['', 'Any type'], ['BLS', 'BLS'], ['ALS', 'ALS'], ['ICU', 'ICU']].map(([v, t]) => h('option', { value: v }, t)));
  const nearArea = h('select', { class: 'select' }, h('option', { value: '' }, 'Choose an area'));
  const nearRadius = h('select', { class: 'select' }, [5, 10, 20, 50].map((km) => h('option', { value: km, selected: km === 10 }, `${km} km`)));
  const detail = h('section', { class: 'card stack-8', 'aria-labelledby': 'em-detail-h', hidden: true });
  const map = createRealMap({ height: 320, label: 'Map of ambulance locations' });
  const section = (id, title, ...body) => h('section', { class: 'stack-12', 'aria-labelledby': id }, h('h2', { class: 't-title-2', id }, title), ...body);

  page.append(pageHead({ title: 'Emergency operations', sub: 'Live view of the synthetic ambulance demo. Updates every five seconds.' }), demo, problem, kpis,
    section('em-active', 'Active and recent requests', active), section('em-none', 'No-match requests', unmatched),
    section('em-near', 'Available ambulances near a place', h('div', { class: 'admin-toolbar' }, field({ id: 'near-area', label: 'Near', input: nearArea }), field({ id: 'near-type', label: 'Type', input: nearType }), field({ id: 'near-radius', label: 'Within', input: nearRadius })), nearbyResult),
    section('em-map', 'Ambulance locations', map), section('em-hour', 'Hourly activity, Asia/Kolkata', hourly), detail);

  const kpi = (label, value) => h('div', { class: 'card kpi' }, h('span', { class: 't-footnote muted' }, label), h('span', { class: 'kpi-value' }, String(value)));
  const row = (e) => h('article', { class: 'admin-review' },
    h('div', { class: 'spread' }, h('div', {}, h('span', { class: 'name t-headline', style: 'text-transform:capitalize' }, words(e.emergencyType)), ' ', tag(words(e.status), TONE[e.status] ?? 'primary')),
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => showDetail(e.id) }, 'View timeline')),
    h('p', { class: 't-footnote muted' }, `Created ${when(e.createdAt)}`));

  async function refresh() {
    try {
      const [requests, failed, vehicles, analytics] = await Promise.all([api('/admin/emergencies'), api('/admin/emergencies?status=no_match'), api('/admin/ambulances'), api('/admin/analytics')]);
      const live = requests.emergencies.filter((e) => !['completed', 'cancelled', 'no_match'].includes(e.status));
      kpis.replaceChildren(kpi('Total requests', analytics.totalRequests), kpi('Active requests', live.length), kpi('No-match requests', failed.emergencies.length), kpi('Average time to assign', secs(analytics.averageAssignSeconds)), kpi('Average time to arrive', secs(analytics.averageArriveSeconds)), kpi('Demo crews', vehicles.ambulances.filter((a) => a.isDemo).length));
      const recent = requests.emergencies.filter((e) => ['completed', 'cancelled'].includes(e.status)).slice(0, 10);
      active.replaceChildren(...(live.length || recent.length ? [...live, ...recent].map(row) : [h('p', { class: 'admin-empty t-subhead muted' }, 'No requests yet.')]));
      unmatched.replaceChildren(...(failed.emergencies.length ? failed.emergencies.map(row) : [h('p', { class: 't-subhead muted' }, 'No unmatched requests.')]));
      map.update({ pins: vehicles.ambulances.filter((a) => a.position).map((a) => ({ ...a.position, label: `${a.type} ${a.status}`, kind: a.status === 'busy' ? 'emergency' : 'place' })) });
      hourly.replaceChildren(dataTable({
        caption: `Hourly emergency activity. Time zone: ${analytics.timeZone}.`, emptyText: 'No hourly activity yet.', rows: analytics.byHour,
        columns: [{ label: 'Hour', cell: (r) => String(r.hour) }, { label: 'Requests', cell: (r) => String(r.requested) }, { label: 'Average to assign', cell: (r) => secs(r.averageAssignSeconds) }, { label: 'Average to arrive', cell: (r) => secs(r.averageArriveSeconds) }],
      }));
      problem.replaceChildren();
    } catch (err) { problem.replaceChildren(errorNotice(err, refresh)); }
  }

  // F-17: the server does the distance; the choice stays on screen across the five second refresh.
  let centres = [];
  async function findNearby() {
    const area = centres.find((c) => c.name === nearArea.value);
    if (!area) { nearbyResult.replaceChildren(h('p', { class: 't-subhead muted' }, 'Choose an area to see the crews that could reach it.')); return; }
    const p = new URLSearchParams({ lat: area.lat, lng: area.lng, radiusKm: nearRadius.value });
    if (nearType.value) p.set('type', nearType.value);
    try {
      const { ambulances } = await api(`/admin/ambulances?${p}`);
      nearbyResult.replaceChildren(dataTable({
        caption: `Available ambulances within ${nearRadius.value} km of ${area.name}, nearest first`, emptyText: 'No available ambulance in this range.', rows: ambulances,
        columns: [{ label: 'Type', cell: (a) => tag(a.type) }, { label: 'Distance', cell: (a) => `${a.distanceKm} km` }, { label: 'Crew', cell: (a) => (a.isDemo ? 'Demo crew' : 'Driver') }],
      }));
    } catch (err) { nearbyResult.replaceChildren(errorNotice(err, findNearby)); }
  }
  for (const control of [nearArea, nearType, nearRadius]) control.addEventListener('change', findNearby);
  api('/areas/centroids').then((r) => { centres = r.areas; nearArea.append(...centres.map((c) => h('option', { value: c.name }, c.name))); }).catch((err) => nearbyResult.replaceChildren(errorNotice(err)));
  findNearby();

  async function showDetail(id) {
    detail.hidden = false;
    detail.replaceChildren(h('h2', { class: 't-title-2', id: 'em-detail-h', tabindex: '-1' }, 'Request timeline'), h('p', { class: 't-subhead muted' }, 'Loading'));
    detail.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    try {
      const { emergency: e } = await api(`/admin/emergencies/${id}`);
      detail.replaceChildren(h('h2', { class: 't-title-2', id: 'em-detail-h', tabindex: '-1' }, 'Request timeline'),
        h('p', {}, `Status: ${words(e.status)}. Type: ${words(e.emergencyType)}.`),
        h('p', { class: 't-subhead muted' }, e.location ? `Operational location: ${e.location.lat.toFixed(5)}, ${e.location.lng.toFixed(5)}` : 'No location recorded.'),
        h('ol', { class: 'stack-8', style: 'padding-left:var(--space-20)' }, e.timeline.map((ev) => h('li', {}, `${words(ev.kind)} by ${ev.actorRole || 'system'}, ${when(ev.createdAt)}`))));
      detail.querySelector('h2').focus({ preventScroll: true });
    } catch (err) { detail.replaceChildren(h('h2', { class: 't-title-2', id: 'em-detail-h' }, 'Request timeline'), errorNotice(err)); }
  }

  await refresh();
  const timer = setInterval(refresh, 5000);
  return () => clearInterval(timer);
}
