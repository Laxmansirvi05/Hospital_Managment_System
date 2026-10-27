import { h, icon, brandMark } from './h.js';
import * as patient from './screens/patient.js';
import * as discovery from './screens/discovery.js';
import * as assistant from './screens/assistant.js';
import * as reports from './screens/reports.js';
import * as sos from './screens/sos.js';
import * as driver from './screens/driver.js';
import * as admin from './screens/admin.js';

// Hash routes. The real product is multi-page (docs/02-trd.md section 3); a single page
// with hash routes keeps this prototype to one static folder.
const ROUTES = [
  { path: '/home', role: 'patient', nav: 'home', view: patient.home },
  { path: '/search', role: 'patient', nav: 'search', view: discovery.search },
  { path: '/hospital/:id', role: 'patient', nav: 'search', view: discovery.hospital },
  { path: '/doctor/:id', role: 'patient', nav: 'search', view: discovery.doctor },
  { path: '/medicine/:id', role: 'patient', nav: 'search', view: discovery.medicine },
  { path: '/place/:kind/:id', role: 'patient', nav: 'search', view: discovery.place },
  { path: '/assistant', role: 'patient', nav: 'assistant', view: assistant.view },
  { path: '/reports', role: 'patient', nav: 'reports', view: reports.list },
  { path: '/reports/:id', role: 'patient', nav: 'reports', view: reports.detail },
  { path: '/medical-id', role: 'patient', nav: 'medical-id', view: patient.medicalId },
  { path: '/history', role: 'patient', nav: 'history', view: patient.history },
  { path: '/sos', role: 'patient', nav: 'sos', view: sos.request },
  { path: '/emergency', role: 'patient', nav: 'sos', view: sos.active },
  { path: '/track', role: 'family', nav: 'track', view: sos.track },
  { path: '/driver', role: 'driver', nav: 'offers', view: driver.offers },
  { path: '/driver/trip', role: 'driver', nav: 'trip', view: driver.trip },
  { path: '/admin', role: 'admin', nav: 'overview', view: admin.overview },
  { path: '/admin/listings', role: 'admin', nav: 'listings', view: admin.listings },
  { path: '/admin/users', role: 'admin', nav: 'users', view: admin.users },
];

const NAV = {
  patient: [
    { id: 'home', href: '#/home', label: 'Home', icon: 'home' },
    { id: 'search', href: '#/search', label: 'Search', icon: 'search' },
    { id: 'assistant', href: '#/assistant', label: 'Assistant', icon: 'assistant' },
    { id: 'reports', href: '#/reports', label: 'Reports', icon: 'report' },
    { id: 'medical-id', href: '#/medical-id', label: 'Medical ID', icon: 'idcard' },
    { id: 'history', href: '#/history', label: 'Emergency history', icon: 'clock' },
  ],
  driver: [
    { id: 'offers', href: '#/driver', label: 'Offers and status', icon: 'ambulance' },
    { id: 'trip', href: '#/driver/trip', label: 'Current trip', icon: 'route' },
  ],
  admin: [
    { id: 'overview', href: '#/admin', label: 'Overview', icon: 'chart' },
    { id: 'listings', href: '#/admin/listings', label: 'Listings', icon: 'list' },
    { id: 'users', href: '#/admin/users', label: 'Users', icon: 'users' },
  ],
  family: [],
};

const TABS = ['home', 'search', 'assistant', 'reports', 'medical-id'];

const ROLE_HOME = { patient: '#/home', driver: '#/driver', admin: '#/admin', family: '#/track' };
const ROLE_LABEL = { patient: 'Patient', driver: 'Driver', admin: 'Admin', family: 'Family view' };

function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of ROUTES) {
    const rp = route.path.split('/').filter(Boolean);
    if (rp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    rp.forEach((seg, i) => {
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
      else if (seg !== parts[i]) ok = false;
    });
    if (ok) return { route, params };
  }
  return null;
}

function roleSwitcher(current) {
  const roles = ['patient', 'driver', 'admin'];
  return h('div', { class: 'stack-8' },
    h('span', { class: 'nav-label', id: 'role-label' }, 'Viewing as'),
    h('div', { class: 'seg seg-block', role: 'group', 'aria-labelledby': 'role-label' },
      roles.map((r) => h('button', {
        type: 'button', 'aria-pressed': String(current === r),
        onclick: () => { location.hash = ROLE_HOME[r]; },
      }, ROLE_LABEL[r])),
    ),
  );
}

function renderSidebar(role, navId) {
  const sidebar = document.getElementById('sidebar');
  const items = NAV[role] || [];
  sidebar.replaceChildren(...[
    h('a', { class: 'brand', href: ROLE_HOME[role === 'family' ? 'patient' : role] },
      brandMark(),
    ),
    roleSwitcher(role === 'family' ? 'patient' : role),
    items.length ? h('nav', { class: 'nav', 'aria-label': `${ROLE_LABEL[role]} sections` },
      items.map((item) => h('a', { href: item.href, 'aria-current': item.id === navId ? 'page' : false }, icon(item.icon), item.label)),
    ) : null,
    role === 'patient' ? h('div', { class: 'sidebar-foot' },
      h('a', { class: 'sos-key sos-key-compact', href: '#/sos' }, icon('ambulance', 22), 'Request ambulance'),
      h('p', { class: 't-footnote muted', style: 'text-align:center' }, 'Emergency number 112'),
    ) : null,
    role === 'driver' ? h('div', { class: 'sidebar-foot' },
      h('div', { class: 'card stack-8' },
        h('span', { class: 't-footnote muted' }, 'Signed in as'),
        h('span', { class: 't-headline' }, 'Suresh Babu'),
        h('span', { class: 't-subhead muted' }, 'ALS, TS 09 EA 4521'),
      ),
    ) : null,
    role === 'admin' ? h('div', { class: 'sidebar-foot' },
      h('div', { class: 'card stack-8' },
        h('span', { class: 't-footnote muted' }, 'Signed in as'),
        h('span', { class: 't-headline' }, 'Kavya Reddy'),
        h('span', { class: 't-subhead muted' }, 'Platform admin'),
      ),
    ) : null,
  ].filter(Boolean));
}

function renderTopbar(role) {
  const topbar = document.getElementById('topbar');
  const select = h('select', { class: 'select', 'aria-label': 'Viewing as', style: 'width:auto;min-width:140px' },
    ['patient', 'driver', 'admin'].map((r) => h('option', { value: r, selected: (role === 'family' ? 'patient' : role) === r }, ROLE_LABEL[r])),
  );
  select.addEventListener('change', () => { location.hash = ROLE_HOME[select.value]; });
  topbar.replaceChildren(
    h('a', { class: 'brand', href: ROLE_HOME[role === 'family' ? 'patient' : role] }, brandMark()),
    select,
  );
}

function renderTabbar(role, navId) {
  const tabbar = document.getElementById('tabbar');
  const fab = document.getElementById('fab');
  const items = role === 'patient' ? NAV.patient.filter((n) => TABS.includes(n.id)) : (NAV[role] || []);
  tabbar.hidden = items.length === 0;
  tabbar.replaceChildren(...items.map((item) => h('a', { href: item.href, 'aria-current': item.id === navId ? 'page' : false },
    icon(item.icon, 22), item.id === 'medical-id' ? 'Profile' : item.label.split(' ')[0])));
  fab.replaceChildren();
  if (role === 'patient' && navId !== 'sos') {
    fab.append(h('a', { class: 'sos-key sos-key-compact', href: '#/sos', 'aria-label': 'Request ambulance' }, icon('ambulance', 22), 'SOS'));
  }
}

let cleanups = [];

function render() {
  const raw = location.hash.replace(/^#/, '') || '/home';
  const [path, queryString = ''] = raw.split('?');
  const found = match(path);
  if (!found) {
    location.replace('#/home');
    return;
  }
  for (const fn of cleanups) fn();
  cleanups = [];
  const ctx = {
    params: found.params,
    query: new URLSearchParams(queryString),
    onCleanup: (fn) => cleanups.push(fn),
  };
  const { route } = found;
  renderSidebar(route.role, route.nav);
  renderTopbar(route.role);
  renderTabbar(route.role, route.nav);

  const main = document.getElementById('main');
  const view = route.view(ctx);
  main.replaceChildren(view.el);
  document.title = `${view.title} · CareRoute prototype`;
  window.scrollTo(0, 0);
  const heading = main.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

window.addEventListener('hashchange', render);
render();
