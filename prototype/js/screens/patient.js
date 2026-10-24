import { h, icon, toast } from '../h.js';
import { HOSPITALS, AREA_NAMES, PATIENT, REPORTS, HISTORY, STATUS_LABEL } from '../data.js';
import { createMap } from '../map3d.js';
import { pageHead, km, listingRow, sectionTitle } from './ui.js';

export const SEARCH_TYPES = [
  ['hospitals', 'Hospitals'],
  ['doctors', 'Doctors'],
  ['medicines', 'Medicines'],
  ['pharmacies', 'Pharmacies'],
  ['diagnostics', 'Diagnostic centres'],
];

const PLACEHOLDER = {
  hospitals: 'Hospital name, speciality or department',
  doctors: 'Doctor name or specialization',
  medicines: 'Medicine name, for example paracetamol',
  pharmacies: 'Pharmacy or medical store name',
  diagnostics: 'Centre name or test, for example MRI',
};

/** Search form shared by home and the search page. */
export function searchForm({ type = 'hospitals', q = '', area = '' } = {}) {
  let current = type;
  const input = h('input', { class: 'input', id: 'q', name: 'q', type: 'search', value: q, placeholder: PLACEHOLDER[current], autocomplete: 'off' });
  const areaSelect = h('select', { class: 'select', id: 'area', 'aria-label': 'Area' },
    h('option', { value: '' }, 'All of Hyderabad'),
    AREA_NAMES.map((a) => h('option', { value: a, selected: a === area }, a)),
  );
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'What are you looking for' },
    SEARCH_TYPES.map(([value, label]) => h('button', {
      type: 'button', 'aria-pressed': String(value === current),
      onclick: (e) => {
        current = value;
        for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        input.placeholder = PLACEHOLDER[value];
        areaSelect.disabled = value === 'medicines';
      },
    }, label)),
  );
  areaSelect.disabled = current === 'medicines';
  const form = h('form', { class: 'searchbar', role: 'search' },
    seg,
    h('div', { class: 'searchbar-row' },
      h('label', { class: 'input-icon' }, h('span', { class: 'visually-hidden' }, 'Search'), icon('search'), input),
      areaSelect,
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Search'),
    ),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams({ type: current });
    if (input.value.trim()) params.set('q', input.value.trim());
    if (areaSelect.value && current !== 'medicines') params.set('area', areaSelect.value);
    location.hash = `#/search?${params}`;
  });
  return form;
}

export function home() {
  const nearest = HOSPITALS.filter((x) => x.emergency).map((x) => ({ x, d: km(x) }))
    .sort((a, b) => parseFloat(a.d) - parseFloat(b.d)).slice(0, 4);

  const map = createMap({
    pins: nearest.map(({ x }, i) => ({ ...x, kind: 'hospital', label: x.name, showLabel: i === 0, active: i === 0, onSelect: () => { location.hash = `#/hospital/${x.id}`; } })),
    legend: [['you', 'You'], ['hospital', 'Hospital with emergency care']],
  });

  const assistantInput = h('input', { class: 'input', placeholder: 'For example: knee pain after a fall', 'aria-label': 'Describe what you need' });
  const assistantForm = h('form', { class: 'composer' },
    assistantInput,
    h('button', { class: 'btn btn-primary', type: 'submit', 'aria-label': 'Ask the assistant' }, icon('send', 18)),
  );
  assistantForm.addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = `#/assistant?q=${encodeURIComponent(assistantInput.value.trim())}`;
  });

  const latest = REPORTS[0];
  const el = h('div', { class: 'page' },
    pageHead({ title: 'Find care in Hyderabad', sub: 'Search hospitals, doctors, medicines, pharmacies and diagnostic centres in one place, and get an ambulance when you need one.' }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised', 'aria-labelledby': 'search-title' },
          h('h2', { class: 't-title-3', id: 'search-title', style: 'margin-bottom:var(--space-16)' }, 'What are you looking for?'),
          searchForm(),
        ),
        h('section', { class: 'card stack-16', 'aria-labelledby': 'near-title' },
          h('div', { class: 'spread' },
            h('div', { class: 'stack-4' },
              h('h2', { class: 't-title-2', id: 'near-title' }, 'Emergency care near you'),
              h('p', { class: 't-subhead muted row-8' }, icon('locate', 16), 'Near Prakash Nagar Metro, Begumpet'),
            ),
            h('a', { class: 'btn btn-secondary btn-sm', href: '#/search?type=hospitals&emergency=1' }, 'See all'),
          ),
          map.el,
          h('div', { class: 'list' }, nearest.map(({ x, d }) => listingRow({
            href: `#/hospital/${x.id}`, kind: 'hospital', title: x.name,
            meta: [`${x.area} · ${x.specialities.slice(0, 2).join(', ')}`],
            trail: h('span', { class: 'num t-subhead' }, d),
          }))),
        ),
      ),
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'sos-title' },
          h('div', { class: 'stack-4' },
            h('h2', { class: 't-title-2', id: 'sos-title' }, 'Need an ambulance?'),
            h('p', { class: 't-subhead muted' }, 'Your request goes to the nearest available ambulance. Your family can follow it with a link.'),
          ),
          h('a', { class: 'sos-key', href: '#/sos' },
            h('span', { class: 'sos-key-title' }, 'Request ambulance'),
            h('span', { class: 'sos-key-sub' }, 'Your location is filled in for you'),
          ),
          h('p', { class: 't-subhead', style: 'text-align:center' }, 'Or call ', h('a', { href: 'tel:112', class: 'strong' }, '112')),
        ),
        h('section', { class: 'card stack-16', 'aria-labelledby': 'ask-title' },
          h('div', { class: 'stack-4' },
            h('h2', { class: 't-title-3', id: 'ask-title' }, 'Not sure who to see?'),
            h('p', { class: 't-subhead muted' }, 'Describe it in your own words. The assistant suggests a speciality and nearby care.'),
          ),
          assistantForm,
        ),
        h('section', { class: 'card stack-12', 'aria-labelledby': 'report-title' },
          h('div', { class: 'spread' },
            h('h2', { class: 't-title-3', id: 'report-title' }, 'Latest report'),
            h('a', { href: '#/reports', class: 't-subhead strong' }, 'All reports'),
          ),
          h('a', { class: 'list-row', href: `#/reports/${latest.id}` },
            h('span', { class: 'obj' }, icon('report', 22)),
            h('span', { class: 'list-row-main' },
              h('span', { class: 'list-row-title' }, latest.title),
              h('span', { class: 'list-row-meta' }, `Uploaded ${latest.uploaded}`),
            ),
            h('span', { class: 'list-row-trail' }, h('span', { class: 'tag tag-primary' }, 'Explain'), icon('chevron', 18)),
          ),
        ),
        h('section', { class: 'card stack-12', 'aria-labelledby': 'mid-title' },
          h('div', { class: 'spread' },
            h('h2', { class: 't-title-3', id: 'mid-title' }, 'Medical ID'),
            h('a', { href: '#/medical-id', class: 't-subhead strong' }, 'Edit'),
          ),
          h('dl', { class: 'facts facts-2' },
            h('div', {}, h('dt', {}, 'Blood group'), h('dd', { class: 'strong' }, PATIENT.medicalId.bloodGroup)),
            h('div', {}, h('dt', {}, 'Allergies'), h('dd', {}, PATIENT.medicalId.allergies.join(', '))),
          ),
          h('p', { class: 'status status-ok' }, 'Shared with your ambulance crew during an emergency'),
        ),
      ),
    ),
  );
  return { el, title: 'Home' };
}

export function medicalId() {
  const mid = { ...PATIENT.medicalId };
  const contacts = [...PATIENT.contacts];

  const share = h('input', { type: 'checkbox', role: 'switch', id: 'share', checked: mid.shareWithCrew });
  const shareText = h('p', { class: 't-subhead muted', id: 'share-desc' });
  const syncShare = () => {
    shareText.textContent = share.checked
      ? 'On. The ambulance crew assigned to you can see your blood group, allergies and notes, only during an active emergency.'
      : 'Off. Nobody else can see your medical ID.';
  };
  share.setAttribute('aria-describedby', 'share-desc');
  share.addEventListener('change', syncShare);
  syncShare();

  const form = h('form', { class: 'card stack-24', 'aria-labelledby': 'mid-h' },
    h('div', { class: 'stack-4' },
      h('h2', { class: 't-title-2', id: 'mid-h' }, 'Medical ID'),
      h('p', { class: 't-subhead muted' }, 'Details that help an ambulance crew treat you quickly.'),
    ),
    h('div', { class: 'grid-2' },
      h('div', { class: 'field' },
        h('label', { for: 'bg' }, 'Blood group'),
        h('select', { class: 'select', id: 'bg' }, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'].map((g) => h('option', { selected: g === mid.bloodGroup }, g))),
      ),
      h('div', { class: 'field' },
        h('label', { for: 'al' }, 'Allergies'),
        h('input', { class: 'input', id: 'al', value: mid.allergies.join(', ') }),
        h('span', { class: 'hint' }, 'Separate allergies with commas.'),
      ),
    ),
    h('div', { class: 'field' },
      h('label', { for: 'notes' }, 'Notes for the crew'),
      h('textarea', { class: 'textarea', id: 'notes' }, mid.notes),
      h('span', { class: 'hint' }, 'Conditions or regular medicines. Up to 500 characters.'),
    ),
    h('div', { class: 'card', style: 'background:var(--surface-sunken);box-shadow:none' },
      h('label', { class: 'switch', for: 'share' },
        h('span', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'Share with the ambulance crew'), shareText),
        share,
      ),
    ),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save medical ID')),
  );
  form.addEventListener('submit', (e) => { e.preventDefault(); toast('Medical ID saved'); });

  const list = h('div', { class: 'list' });
  const drawContacts = () => {
    list.replaceChildren(...(contacts.length ? contacts.map((c) => h('div', { class: 'list-row' },
      h('span', { class: 'obj' }, icon('user', 22)),
      h('span', { class: 'list-row-main' },
        h('span', { class: 'list-row-title' }, c.name),
        h('span', { class: 'list-row-meta num' }, `${c.relation} · ${c.phone}`),
      ),
      h('button', { class: 'btn btn-text', type: 'button', onclick: () => { contacts.splice(contacts.indexOf(c), 1); drawContacts(); toast('Contact removed'); } }, 'Remove'),
    )) : [h('p', { class: 'empty t-subhead muted' }, 'No contacts yet. Add someone who should know when you raise an SOS.')]));
  };
  drawContacts();

  const nameIn = h('input', { class: 'input', id: 'cn', required: true, autocomplete: 'off' });
  const phoneIn = h('input', { class: 'input', id: 'cp', required: true, inputmode: 'tel', placeholder: '+91 98765 00000' });
  const relIn = h('select', { class: 'select', id: 'cr' }, ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'].map((r) => h('option', {}, r)));
  const addForm = h('form', { class: 'stack-16' },
    h('div', { class: 'grid-2' },
      h('div', { class: 'field' }, h('label', { for: 'cn' }, 'Name'), nameIn),
      h('div', { class: 'field' }, h('label', { for: 'cp' }, 'Mobile number'), phoneIn),
    ),
    h('div', { class: 'field' }, h('label', { for: 'cr' }, 'Relation'), relIn),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-secondary', type: 'submit' }, icon('plus', 18), 'Add contact')),
  );
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    contacts.push({ id: `k${Date.now()}`, name: nameIn.value.trim(), phone: phoneIn.value.trim(), relation: relIn.value });
    addForm.reset();
    drawContacts();
    toast('Contact added');
  });

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Medical ID and contacts', sub: 'Keep these up to date. They are used only when you raise an SOS.' }),
    h('div', { class: 'grid-main-side' },
      form,
      h('section', { class: 'card stack-16', 'aria-labelledby': 'ct-h' },
        h('div', { class: 'stack-4' },
          h('h2', { class: 't-title-2', id: 'ct-h' }, 'Emergency contacts'),
          h('p', { class: 't-subhead muted' }, 'They get an SMS with a tracking link when you raise an SOS. The SMS never includes health details.'),
        ),
        list,
        h('hr', { class: 'divider' }),
        addForm,
      ),
    ),
  );
  return { el, title: 'Medical ID' };
}

export function history() {
  const el = h('div', { class: 'page' },
    pageHead({ title: 'Emergency history', sub: 'Your past ambulance requests, newest first.' }),
    h('section', { class: 'card' },
      h('div', { class: 'list' }, HISTORY.map((e) => h('div', { class: 'list-row' },
        h('span', { class: 'obj' }, icon('ambulance', 22)),
        h('span', { class: 'list-row-main' },
          h('span', { class: 'list-row-title' }, `${e.type}, ${e.area}`),
          h('span', { class: 'list-row-meta' }, `${e.date} · ${e.ambulance}${e.arrival ? ` · Arrived in ${e.arrival}` : ''}`),
        ),
        h('span', { class: 'list-row-trail' },
          h('span', { class: `status ${e.status === 'completed' ? 'status-ok' : 'status-idle'}` }, STATUS_LABEL[e.status]),
          e.rating ? h('span', { class: 'rating' }, icon('star', 16), `${e.rating} of 5`) : null,
        ),
      ))),
    ),
  );
  return { el, title: 'Emergency history' };
}

export { sectionTitle };
