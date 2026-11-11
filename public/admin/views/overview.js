import { api } from '/js/api.js';
import { h, icon, pageHead, KIND_LABEL } from '/admin/lib.js';

const kpi = (label, value, href, note) => h(href ? 'a' : 'div', { class: `card kpi${href ? ' card-link' : ''}`, href }, h('span', { class: 't-footnote muted' }, label), h('span', { class: 'kpi-value' }, String(value)), note ? h('span', { class: 't-footnote muted' }, note) : null);

export async function render(page) {
  const o = await api('/admin/overview');
  const listingCards = Object.entries(o.listings).map(([kind, c]) => kpi(KIND_LABEL[kind], c.active, `#/listings?kind=${kind}`, c.hidden ? `${c.hidden} hidden` : 'None hidden'));
  const waiting = (o.drivers?.pending ?? 0) + (o.passwordResets?.open ?? 0);
  page.append(
    pageHead({ title: 'Overview', sub: 'What is on CareRoute right now. Everything you change here is written to the audit log.' }),
    h('section', { class: 'stack-12', 'aria-labelledby': 'ov-wait' },
      h('h2', { class: 't-title-2', id: 'ov-wait' }, 'Waiting for you'),
      h('div', { class: 'admin-grid' },
        kpi('Driver requests', o.drivers?.pending ?? 0, '#/drivers', o.drivers?.pending ? 'Check and approve' : 'Nobody waiting'),
        kpi('Password reset requests', o.passwordResets?.open ?? 0, '#/users', o.passwordResets?.open ? 'Issue a reset link' : 'Nobody waiting'))),
    h('section', { class: 'stack-12', 'aria-labelledby': 'ov-people' },
      h('h2', { class: 't-title-2', id: 'ov-people' }, 'People'),
      h('div', { class: 'admin-grid' },
        kpi('Patients', o.users.patients, '#/users?role=patient'), kpi('Drivers', o.users.drivers, '#/users?role=driver'),
        kpi('Admins', o.users.admins, '#/users?role=admin'), kpi('Disabled accounts', o.users.disabled, '#/users?status=disabled'))),
    h('section', { class: 'stack-12', 'aria-labelledby': 'ov-list' },
      h('h2', { class: 't-title-2', id: 'ov-list' }, 'Listings shown to patients'),
      h('div', { class: 'admin-grid' }, listingCards)),
    h('section', { class: 'stack-12', 'aria-labelledby': 'ov-rev' },
      h('h2', { class: 't-title-2', id: 'ov-rev' }, 'Reviews'),
      h('div', { class: 'admin-grid' },
        kpi('Visible to patients', o.reviews.visible),
        kpi('Reported', o.reviews.reported, '#/reviews?status=reported', o.reviews.reported ? 'Need a look' : 'Nothing waiting'),
        kpi('Hidden', o.reviews.hidden, '#/reviews?status=hidden', 'Hidden after 3 reports'))),
    h('div', { class: 'row-8' }, icon('shield', 18), h('span', { class: 't-footnote muted' }, `${o.auditEntries} actions recorded in the `, h('a', { class: 'admin-link', href: '#/audit' }, 'audit log'), '.')));
}
