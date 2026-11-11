// Admin portal shell: checks the session, draws the navigation, and swaps views by hash (D-83).
// Only admin accounts get past the guard; the server enforces the same rule on every call.
import { h, icon, brandMark } from '/js/h.js';
import { api, signInUrl } from '/js/api.js';
import { errorNotice, loading } from '/admin/lib.js';

const VIEWS = [
  { id: 'overview', label: 'Overview', short: 'Home', icon: 'chart', load: () => import('/admin/views/overview.js') },
  { id: 'drivers', label: 'Driver requests', short: 'Drivers', icon: 'user', badge: 'drivers', load: () => import('/admin/views/drivers.js') },
  { id: 'emergencies', label: 'Emergencies', short: 'Live', icon: 'ambulance', load: () => import('/admin/views/emergencies.js') },
  { id: 'users', label: 'People', icon: 'users', badge: 'resets', load: () => import('/admin/views/users.js') },
  { id: 'listings', label: 'Listings', icon: 'hospital', load: () => import('/admin/views/listings.js') },
  { id: 'quality', label: 'Data quality', short: 'Quality', icon: 'report', load: () => import('/admin/views/quality.js') },
  { id: 'reviews', label: 'Reviews', icon: 'star', load: () => import('/admin/views/reviews.js') },
  { id: 'audit', label: 'Audit log', short: 'Audit', icon: 'list', load: () => import('/admin/views/audit.js') },
];

const main = document.getElementById('main');
const live = document.getElementById('live');
let me;
// Waiting work shown as a number beside Drivers and People, so an admin sees it from any screen.
let counts = { drivers: 0, resets: 0 };
let cleanup = null;
let token = 0;

async function signOut() {
  try { await api('/auth/logout', { method: 'POST' }); } finally { location.href = '/signin/'; }
}

const badge = (v) => (counts[v.badge] ? h('span', { class: 'admin-badge', 'aria-label': `${counts[v.badge]} waiting` }, String(counts[v.badge])) : null);

async function loadCounts() {
  try {
    const o = await api('/admin/overview');
    counts = { drivers: o.drivers?.pending ?? 0, resets: o.passwordResets?.open ?? 0 };
  } catch (err) {
    console.debug('admin counts unavailable', err?.status);
  }
}

function draw(active) {
  const links = VIEWS.map((v) => h('a', { href: `#/${v.id}`, 'aria-current': v.id === active ? 'page' : false }, icon(v.icon), v.label, badge(v)));
  document.getElementById('sidebar').replaceChildren(
    h('a', { class: 'brand', href: '#/overview' }, brandMark()),
    h('nav', { class: 'nav', 'aria-label': 'Admin' }, h('div', { class: 'nav-group' }, h('span', { class: 'nav-label' }, 'Admin'), links)),
    h('div', { class: 'sidebar-foot' },
      h('div', { class: 'user-card' },
        h('div', { class: 'stack-4', style: 'min-width:0;flex:1' },
          h('span', { class: 't-headline', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, me.name),
          h('a', { class: 't-footnote', href: '/account/' }, 'Your account and password'),
          h('button', { class: 'link-btn t-footnote', type: 'button', onclick: signOut, style: 'justify-self:start' }, 'Sign out')))));
  document.getElementById('topbar').replaceChildren(
    h('a', { class: 'brand', href: '#/overview' }, brandMark()),
    h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: signOut }, icon('logout', 18), 'Sign out'));
  document.getElementById('tabbar').replaceChildren(...VIEWS.map((v) => h('a', { href: `#/${v.id}`, 'aria-current': v.id === active ? 'page' : false }, badge(v), icon(v.icon, 22), ...(v.short ? [h('span', { 'aria-hidden': 'true' }, v.short), h('span', { class: 'visually-hidden' }, v.label)] : [v.label]))));
}

/** "#/listings/doctor/ab12" gives view "listings" and params ["doctor", "ab12"]. */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const view = VIEWS.find((v) => v.id === parts[0]) || VIEWS[0];
  return { view, params: parts.slice(1) };
}

async function show() {
  const mine = ++token;
  const { view, params } = route();
  if (typeof cleanup === 'function') { cleanup(); cleanup = null; }
  draw(view.id);
  document.title = `${view.label} · Admin · CareRoute`;
  main.replaceChildren(loading());
  try {
    const mod = await view.load();
    if (mine !== token) return;
    const page = h('div', { class: 'page admin-page' });
    main.replaceChildren(page);
    cleanup = (await mod.render(page, { params, me, navigate: (hash) => { location.hash = hash; }, announce: (t) => { live.textContent = t; } })) || null;
    if (mine !== token) { if (typeof cleanup === 'function') cleanup(); cleanup = null; return; }
    page.querySelector('h1')?.focus({ preventScroll: true });
  } catch (err) {
    if (mine !== token) return;
    if (err.status === 401) { location.replace(signInUrl()); return; }
    main.replaceChildren(h('div', { class: 'page admin-page' }, errorNotice(err, show)));
  }
}

async function start() {
  try {
    const [user, config] = await Promise.all([api('/auth/me'), api('/config').catch(() => ({}))]);
    me = user;
    if (config.dataMode === 'sample') {
      const banner = document.getElementById('mode-banner');
      banner.hidden = false;
      banner.replaceChildren(h('span', {}, h('strong', {}, 'Sample data mode. '), 'Changes here are cleared when the server restarts.'));
    }
  } catch (err) {
    if (err.status === 401) { location.replace(signInUrl()); return; }
    main.replaceChildren(h('div', { class: 'page admin-page' }, errorNotice(err, () => location.reload())));
    return;
  }
  if (me.role !== 'admin') {
    document.title = 'Admin only · CareRoute';
    main.replaceChildren(h('div', { class: 'page admin-page' },
      h('h1', { class: 't-large-title', tabindex: '-1' }, 'This area is for admin accounts'),
      h('p', { class: 't-callout muted' }, 'Your account does not have admin access.'),
      h('a', { class: 'btn btn-primary', href: '/dashboard/', style: 'justify-self:start' }, 'Go to your dashboard')));
    return;
  }
  if (me.passwordChangeRequired) {
    const banner = document.getElementById('mode-banner');
    banner.hidden = false;
    banner.replaceChildren(h('span', {}, h('strong', {}, 'Change your password. '), 'This account still has the password it was created with. ', h('a', { href: '/account/' }, 'Choose your own now')));
  }
  await loadCounts();
  window.addEventListener('hashchange', show);
  // A decision or a reset link elsewhere on the page changes the waiting numbers.
  document.addEventListener('admin:counts-changed', async () => { await loadCounts(); draw(route().view.id); });
  await show();
}
start();
