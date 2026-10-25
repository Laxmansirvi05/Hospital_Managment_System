import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { createMap } from '../map3d.js';
import { pageHead, listingRow, rating, doctorPhoto } from '../ui.js';
import { hbars } from '../charts.js';
import { idParam, notFoundPage, contactCard } from '../details.js';
import { reviewsSection } from '../reviews.js';

const doctorRow = (d) => listingRow({ href: `/doctor/?id=${d.id}`, kind: 'doctor', title: d.name, media: doctorPhoto(d, 'avatar-m'), meta: [[d.specialization, d.experienceYears !== null ? `${d.experienceYears} years` : ''].filter(Boolean).join(' · '), d.title], trail: rating(d) });

/** Doctors at this hospital: counts by speciality, chips to filter, and a list that grows on request. */
function doctorsSection(all) {
  const section = h('section', { class: 'card stack-16', 'aria-labelledby': 'docs-h' });
  if (!all.length) {
    section.append(h('h2', { class: 't-title-3', id: 'docs-h' }, 'Doctors'), h('p', { class: 't-subhead muted' }, 'No doctor profiles listed for this hospital yet.'));
    return section;
  }
  const bySpec = Object.entries(all.reduce((m, d) => ({ ...m, [d.specialization]: (m[d.specialization] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let chosen = '';
  let shown = 20;
  const chips = h('div', { class: 'row-8' });
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn btn-secondary', type: 'button' });
  // Chips are built once and updated in place, so keyboard focus stays on the chip just pressed.
  const chipButtons = [['', `All (${all.length})`], ...bySpec.slice(0, 10).map(([k, n]) => [k, `${k} (${n})`])].map(([k, label]) => {
    const check = icon('check', 16);
    const b = h('button', { class: 'chip', type: 'button', onclick: () => { chosen = k; shown = 20; draw(); } }, check, label);
    b.dataset.key = k;
    b.check = check;
    return b;
  });
  chips.append(...chipButtons);
  const draw = () => {
    const rows = chosen ? all.filter((d) => d.specialization === chosen) : all;
    for (const b of chipButtons) {
      const on = b.dataset.key === chosen;
      b.classList.toggle('chip-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.check.style.display = on ? '' : 'none';
    }
    list.replaceChildren(...rows.slice(0, shown).map(doctorRow));
    more.hidden = rows.length <= shown;
    more.textContent = `Show all ${rows.length} doctors`;
  };
  more.addEventListener('click', () => {
    const before = list.children.length;
    shown = Infinity;
    draw();
    // The button disappears; move focus to the first doctor that was just added.
    list.children[before]?.focus();
  });
  draw();
  section.append(
    h('h2', { class: 't-title-3', id: 'docs-h' }, `Doctors (${all.length})`),
    bySpec.length > 2 ? hbars({ title: 'Doctors at this hospital by speciality', items: bySpec.slice(0, 8).map(([k, n]) => ({ label: k, value: n })) }) : null,
    chips, list, more);
  return section;
}

const { main, user } = await shell({ nav: 'hospitals', title: 'Hospital' });

try {
  const id = idParam();
  const [x, docs] = await Promise.all([api(`/hospitals/${encodeURIComponent(id)}`), api(`/hospitals/${encodeURIComponent(id)}/doctors`)]);
  document.title = `${x.name} · CareRoute`;
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: x.name, crumbs: [['Hospitals and doctors', '/search/hospitals/'], [x.name]], large: false }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised hero-detail' },
          h('div', { class: 'row' },
            x.emergencyAvailable === true ? h('span', { class: 'tag tag-success' }, icon('check', 14), 'Emergency department')
              : x.emergencyAvailable === false ? h('span', { class: 'tag' }, 'No emergency department')
              : h('span', { class: 'tag' }, 'Emergency department not listed'),
            h('span', { class: 't-subhead muted' }, x.area)),
          x.description ? h('p', { class: 't-callout', style: 'max-width:680px' }, x.description) : null,
          createMap({ pins: [{ ...x.location, kind: 'hospital', label: x.name, showLabel: true, active: true }], tilt: 40 })),
        h('section', { class: 'card stack-16' },
          h('h2', { class: 't-title-3' }, 'Specialities'),
          x.specialities.length
            ? h('div', { class: 'row-8' }, x.specialities.map((s) => h('a', { class: 'tag tag-primary', href: `/search/hospitals/?tab=doctors&speciality=${encodeURIComponent(s)}` }, s)))
            : h('p', { class: 't-callout muted' }, 'The source does not list specialities for this hospital. Call it or check its website.'),
          x.departments.length ? [h('h2', { class: 't-title-3' }, 'Departments'), h('div', { class: 'row-8' }, x.departments.map((d) => h('span', { class: 'tag' }, d)))] : null),
        doctorsSection(docs.doctors),
        reviewsSection({ kind: 'hospital', id: x.id, listing: x, canWrite: user.role === 'patient' })),
      h('div', { class: 'stack-16' }, contactCard(x)))));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/hospitals/', 'Search hospitals');
  else loadError(main, err);
}
