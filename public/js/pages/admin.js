import { api } from '../api.js';
import { shell } from '../shell.js';
import { createRealMap } from '../real-map.js';

const { main, user } = await shell({ nav: 'admin', title: 'Emergency operations' });
const page = document.createElement('div'); page.className = 'page emergency-admin-page';
const title = document.createElement('h1'); title.className = 't-large-title'; title.textContent = 'Emergency operations';
const notice = document.createElement('p'); notice.className = 'emergency-demo-notice'; const strong = document.createElement('strong'); strong.textContent = 'Demo: no real ambulance is sent.'; notice.append(strong, ' This console displays synthetic emergency activity.');
const error = document.createElement('p'); error.className = 'emergency-error'; error.setAttribute('role', 'alert');
const metrics = document.createElement('div'); metrics.className = 'emergency-metrics';
const activeCard = card('Active and recent requests');
const noMatchCard = card('No-match requests');
const ambulanceCard = card('Ambulance locations');
const analyticsCard = card('Hourly activity, Asia/Kolkata');
const detailCard = card('Request timeline'); detailCard.section.hidden = true;
page.append(title, notice, error, metrics, activeCard.section, noMatchCard.section, ambulanceCard.section, analyticsCard.section, detailCard.section); main.replaceChildren(page);
const map = createRealMap({ height: 340, label: 'Map of ambulance locations' }); ambulanceCard.content.append(map);
const list = document.createElement('div'); list.className = 'emergency-admin-list'; activeCard.content.append(list);
const failures = document.createElement('div'); failures.className = 'emergency-admin-list'; noMatchCard.content.append(failures);
const tableWrap = document.createElement('div'); tableWrap.className = 'emergency-table-wrap'; analyticsCard.content.append(tableWrap);
const detail = document.createElement('div'); detail.className = 'emergency-admin-list'; detailCard.content.append(detail);
let refreshTimer = null;

if (user.role !== 'admin') { error.textContent = 'This page is for admin accounts.'; }
else { await refresh(); refreshTimer = setInterval(refresh, 5000); }

function card(heading) {
  const section = document.createElement('section'); section.className = 'card emergency-admin-card';
  const h2 = document.createElement('h2'); h2.textContent = heading;
  const content = document.createElement('div'); content.className = 'emergency-admin-content'; section.append(h2, content); return { section, content };
}
function textLine(target, text, cls = '') { const p = document.createElement('p'); p.textContent = text; if (cls) p.className = cls; target.append(p); return p; }
function addMetric(label, value) { const box = document.createElement('section'); box.className = 'emergency-metric card'; const dt = document.createElement('span'); dt.textContent = label; const dd = document.createElement('strong'); dd.textContent = String(value); box.append(dt, dd); return box; }
function requestRow(emergency) {
  const row = document.createElement('article'); row.className = 'emergency-admin-row';
  const label = document.createElement('div'); label.className = 'emergency-admin-row-main';
  const heading = document.createElement('h3'); heading.textContent = `${emergency.status.replaceAll('_', ' ')} · ${emergency.emergencyType}`;
  const meta = document.createElement('p'); meta.textContent = `Created ${new Date(emergency.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  label.append(heading, meta);
  const view = document.createElement('button'); view.type = 'button'; view.className = 'btn btn-secondary emergency-control'; view.textContent = 'View timeline'; view.addEventListener('click', () => showDetail(emergency.id));
  row.append(label, view); return row;
}
async function refresh() {
  try {
    const [requests, failed, vehicles, analytics] = await Promise.all([
      api('/admin/emergencies'), api('/admin/emergencies?status=no_match'), api('/admin/ambulances'), api('/admin/analytics'),
    ]);
    const active = requests.emergencies.filter((e) => !['completed', 'cancelled', 'no_match'].includes(e.status));
    metrics.replaceChildren(addMetric('Active requests', active.length), addMetric('No-match requests', failed.emergencies.length), addMetric('Demo crews', vehicles.ambulances.filter((a) => a.isDemo).length));
    list.replaceChildren(...(active.length ? active.map(requestRow) : [empty('No active requests.')]), ...requests.emergencies.filter((e) => ['completed', 'cancelled'].includes(e.status)).slice(0, 10).map(requestRow));
    failures.replaceChildren(...(failed.emergencies.length ? failed.emergencies.map(requestRow) : [empty('No unmatched requests.') ]));
    map.update({ pins: vehicles.ambulances.filter((a) => a.position).map((a) => ({ ...a.position, label: `${a.type} ${a.status}`, kind: a.status === 'busy' ? 'emergency' : 'place' })) });
    tableWrap.replaceChildren(analyticsTable(analytics)); error.textContent = '';
  } catch (err) { error.textContent = err.message; }
}
function empty(message) { const p = document.createElement('p'); p.className = 'emergency-muted'; p.textContent = message; return p; }
function analyticsTable(data) {
  const table = document.createElement('table'); table.className = 'emergency-admin-table';
  const caption = document.createElement('caption'); caption.textContent = `Hourly emergency activity. Time zone: ${data.timeZone}.`; table.append(caption);
  const thead = document.createElement('thead'); const head = document.createElement('tr');
  for (const label of ['Hour', 'Requests', 'Average to assign (s)', 'Average to arrive (s)']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; head.append(th); } thead.append(head); table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of data.byHour) { const tr = document.createElement('tr'); for (const value of [row.hour, row.requested, formatSeconds(row.averageAssignSeconds), formatSeconds(row.averageArriveSeconds)]) { const td = document.createElement('td'); td.textContent = String(value); tr.append(td); } tbody.append(tr); }
  if (!data.byHour.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 4; td.textContent = 'No hourly activity yet.'; tr.append(td); tbody.append(tr); }
  table.append(tbody); return table;
}
function formatSeconds(value) { return value == null ? 'Not available' : Math.round(value); }
async function showDetail(id) {
  detailCard.section.hidden = false; detail.replaceChildren(empty('Loading timeline…')); detailCard.section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  try {
    const { emergency } = await api(`/admin/emergencies/${id}`); detail.replaceChildren();
    textLine(detail, `Status: ${emergency.status.replaceAll('_', ' ')}`); textLine(detail, `Type: ${emergency.emergencyType}`);
    if (emergency.location) textLine(detail, `Operational location: ${emergency.location.lat.toFixed(5)}, ${emergency.location.lng.toFixed(5)}`);
    for (const event of emergency.timeline) textLine(detail, `${event.kind.replaceAll('_', ' ')} · ${event.actorRole || 'system'} · ${new Date(event.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  } catch (err) { detail.replaceChildren(empty(err.message)); }
}
window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
