// Page shell: checks the session, draws the sidebar, top bar and tab bar, and returns the
// signed-in user. Pages are plain HTML files; this module is the shared frame (docs/02-trd.md section 3).
import { h, icon, brandMark } from './h.js';
import { api, signInUrl } from './api.js';
import { initials } from './format.js';
import { startReminderWatch } from './notify.js';

const NAV = [
  { group: 'Overview', items: [{ id: 'dashboard', href: '/', label: 'Dashboard', icon: 'home' }] },
  {
    group: 'Find care',
    items: [
      { id: 'explore', href: '/explore/', label: 'Explore Hyderabad', icon: 'chart' },
      { id: 'hospitals', href: '/search/hospitals/', label: 'Hospitals and doctors', icon: 'hospital' },
      { id: 'medicines', href: '/search/medicines/', label: 'Medicines and pharmacies', icon: 'pill' },
      { id: 'diagnostics', href: '/search/diagnostics/', label: 'Diagnostic centres', icon: 'flask' },
    ],
  },
  {
    group: 'My health',
    items: [
      { id: 'reminders', href: '/reminders/', label: 'Medicine reminders', icon: 'clock' },
      { id: 'appointments', href: '/appointments/', label: 'Appointments', icon: 'calendar' },
      { id: 'documents', href: '/documents/', label: 'Documents', icon: 'report' },
      { id: 'medical-id', href: '/medical-id/', label: 'Medical ID', icon: 'idcard' },
    ],
  },
  {
    group: 'You',
    items: [
      { id: 'settings', href: '/settings/', label: 'Settings', icon: 'gear' },
      { id: 'account', href: '/account/', label: 'Account and privacy', icon: 'shield' },
    ],
  },
];

// The larger text setting is per device (Settings page). Applied as soon as this module runs.
export const TEXT_LARGE_KEY = 'careroute.textLarge';
try {
  if (localStorage.getItem(TEXT_LARGE_KEY) === '1') document.documentElement.classList.add('text-large');
} catch (err) {
  // Storage can be blocked; the page then uses the normal text size.
  console.debug('text size setting unavailable', err.name);
}

const TABS = [
  { id: 'dashboard', href: '/', label: 'Home', icon: 'home' },
  { id: 'hospitals', href: '/search/hospitals/', label: 'Hospitals', icon: 'hospital' },
  { id: 'medicines', href: '/search/medicines/', label: 'Medicines', icon: 'pill' },
  { id: 'reminders', href: '/reminders/', label: 'Reminders', icon: 'clock' },
  { id: 'medical-id', href: '/medical-id/', label: 'Profile', icon: 'idcard' },
];

async function signOut() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    location.href = '/signin/';
  }
}

function avatar(user, photoUrl) {
  return h('span', { class: 'avatar', 'aria-hidden': 'true' }, photoUrl ? h('img', { src: photoUrl, alt: '' }) : initials(user.name));
}

/**
 * @param {{ nav: string, title: string }} o
 * @returns {Promise<{ main: HTMLElement, user: any, config: any }>}
 */
export async function shell({ nav, title }) {
  document.title = `${title} · CareRoute`;
  let user;
  let config = {};
  try {
    [user, config] = await Promise.all([api('/auth/me'), api('/config').catch(() => ({}))]);
  } catch (err) {
    if (err.status === 401) {
      location.replace(signInUrl());
      return new Promise(() => {});
    }
    throw err;
  }

  if (config.dataMode === 'sample') {
    const banner = document.getElementById('mode-banner');
    if (banner) {
      banner.hidden = false;
      banner.replaceChildren(h('span', {}, h('strong', {}, 'Sample data mode. '), 'The server is not connected to the database yet, so anything you enter is cleared when it restarts.'));
    }
  }

  const userCard = h('div', { class: 'user-card' },
    avatar(user),
    h('div', { class: 'stack-4', style: 'min-width:0;flex:1' },
      h('span', { class: 't-headline', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, user.name),
      h('button', { class: 'link-btn t-footnote', type: 'button', onclick: signOut, style: 'justify-self:start' }, 'Sign out')),
  );

  const isPatient = user.role === 'patient';
  document.getElementById('sidebar').replaceChildren(
    h('a', { class: 'brand', href: '/' }, brandMark(), h('span', {}, h('span', { class: 'brand-name' }, 'CareRoute'), h('span', { class: 'brand-sub' }, 'Hyderabad'))),
    h('nav', { class: 'nav', 'aria-label': 'Main' },
      NAV.map((g) => h('div', { class: 'nav-group' },
        h('span', { class: 'nav-label' }, g.group),
        g.items.filter((i) => isPatient || ['explore', 'hospitals', 'medicines', 'diagnostics', 'settings', 'account'].includes(i.id))
          .map((i) => h('a', { href: i.href, 'aria-current': i.id === nav ? 'page' : false }, icon(i.icon), i.label))))),
    h('div', { class: 'sidebar-foot' },
      isPatient ? h('a', { class: 'sos-key sos-key-compact', href: '/sos/', style: 'width:100%' }, icon('ambulance', 22), 'Emergency') : null,
      userCard,
      h('nav', { class: 'legal-links', 'aria-label': 'Legal' }, h('a', { href: '/privacy/' }, 'Privacy'), h('a', { href: '/terms/' }, 'Terms'))),
  );

  document.getElementById('topbar').replaceChildren(
    h('a', { class: 'brand', href: '/' }, brandMark(), h('span', { class: 'brand-name' }, 'CareRoute')),
    h('div', { class: 'row-8' },
      isPatient ? h('a', { class: 'btn btn-danger btn-sm', href: '/sos/' }, icon('ambulance', 18), 'SOS') : null,
      h('a', { class: 'icon-btn', href: '/settings/', 'aria-label': 'Settings' }, icon('gear', 20)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sign out', onclick: signOut }, icon('logout', 20))),
  );

  const tabbar = document.getElementById('tabbar');
  tabbar.replaceChildren(...(isPatient ? TABS : TABS.filter((t) => ['hospitals', 'medicines'].includes(t.id)))
    .map((t) => h('a', { href: t.href, 'aria-current': t.id === nav ? 'page' : false }, icon(t.icon, 22), t.label)));

  window.addEventListener('offline', () => document.body.classList.add('is-offline'));
  window.addEventListener('online', () => document.body.classList.remove('is-offline'));

  if (isPatient) startReminderWatch();

  const main = document.getElementById('main');
  main.replaceChildren();
  return { main, user, config };
}

/** Error panel for a failed page load, with a retry. */
export function loadError(main, err) {
  main.replaceChildren(h('div', { class: 'page' },
    h('section', { class: 'card empty' },
      h('span', { class: 'empty-art' }, icon('alert', 32)),
      h('p', { class: 't-title-3' }, 'This page could not load'),
      h('p', { class: 't-subhead muted' }, err?.message || 'Something went wrong.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, 'Try again'))));
}
