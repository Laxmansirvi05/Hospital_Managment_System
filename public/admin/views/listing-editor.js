// Add or edit one listing. The form is built from a small spec per kind, so the four kinds
// share one code path and the server's field errors land beside the right input (D-83).
import { api } from '/js/api.js';
import { h, icon, toast, pageHead, tag, KIND_LABEL, field, showErrors, busy, confirmDialog, debounce, errorText } from '/admin/lib.js';

const FACILITY = [['hospital', 'Hospital'], ['clinic', 'Clinic'], ['nursing_home', 'Nursing home'], ['dental', 'Dental'], ['eye', 'Eye care'], ['maternity', 'Maternity'], ['ayush', 'AYUSH']];
const HYD = 'Hyderabad is roughly latitude 17.38 and longitude 78.48.';

// type: text | area | num | int | bool | list | select | url | date. `nullable` empty becomes null.
const PLACE = [
  { key: 'name', label: 'Name', type: 'text', required: true, span2: true },
  { key: 'area', label: 'Area', type: 'text', required: true, hint: 'For example Banjara Hills' },
  { key: 'phone', label: 'Phone', type: 'text', nullable: true },
  { key: 'address', label: 'Address', type: 'text', required: true, span2: true },
  { key: 'lat', label: 'Latitude', type: 'num', required: true, hint: HYD },
  { key: 'lng', label: 'Longitude', type: 'num', required: true },
  { key: 'email', label: 'Email', type: 'text', nullable: true },
  { key: 'website', label: 'Website', type: 'url', nullable: true },
];
const SOURCE = [
  { key: 'sourcePlatform', label: 'Where the details came from', type: 'text', required: true, hint: 'A website, a phone call, a visit' },
  { key: 'sourceUrl', label: 'Source web address', type: 'url', nullable: true },
  { key: 'checkedAt', label: 'Last checked', type: 'date', required: true, hint: 'The date someone last confirmed these details' },
];
const SPEC = {
  hospital: [...PLACE,
    { key: 'facilityType', label: 'Type', type: 'select', options: FACILITY },
    { key: 'emergencyAvailable', label: 'Has an emergency department', type: 'bool' },
    { key: 'description', label: 'Description', type: 'area', span2: true },
    { key: 'specialities', label: 'Specialities', type: 'list', hint: 'One per line', span2: true },
    { key: 'departments', label: 'Departments', type: 'list', hint: 'One per line', span2: true }, ...SOURCE],
  pharmacy: [...PLACE,
    { key: 'chain', label: 'Chain', type: 'text', nullable: true },
    { key: 'hours', label: 'Opening hours', type: 'text' },
    { key: 'open24', label: 'Open 24 hours', type: 'bool' }, ...SOURCE],
  diagnostic_centre: [...PLACE,
    { key: 'hours', label: 'Opening hours', type: 'text' },
    { key: 'description', label: 'Description', type: 'area', span2: true },
    { key: 'testsListed', label: 'Tests listed', type: 'list', hint: 'One per line', span2: true }, ...SOURCE],
  doctor: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'title', label: 'Title', type: 'text', hint: 'For example Dr. or Prof.' },
    { key: 'specialization', label: 'Specialization', type: 'text', required: true },
    { key: 'experienceYears', label: 'Years of experience', type: 'int', nullable: true },
    { key: 'qualifications', label: 'Qualifications', type: 'list', hint: 'One per line', span2: true },
    { key: 'languages', label: 'Languages', type: 'list', hint: 'One per line' },
    { key: 'expertise', label: 'Areas of expertise', type: 'list', hint: 'One per line' },
    { key: 'publishedTimings', label: 'Published timings', type: 'text', span2: true },
    { key: 'consultationFeeInr', label: 'Consultation fee (rupees)', type: 'num', nullable: true },
    { key: 'appointmentPhone', label: 'Appointment phone', type: 'text', nullable: true },
    { key: 'bookingUrl', label: 'Booking web address', type: 'url', nullable: true, hint: 'Must start with https://' },
    { key: 'profileUrl', label: 'Profile web address', type: 'url', nullable: true }, ...SOURCE],
};
const CLINIC = [
  { key: 'clinic.name', id: 'clinic-name', label: 'Clinic name', type: 'text', required: true },
  { key: 'clinic.area', id: 'clinic-area', label: 'Area', type: 'text', required: true },
  { key: 'clinic.address', id: 'clinic-address', label: 'Address', type: 'text', required: true, span2: true },
  { key: 'clinic.lat', id: 'clinic-lat', label: 'Latitude', type: 'num', required: true, hint: HYD },
  { key: 'clinic.lng', id: 'clinic-lng', label: 'Longitude', type: 'num', required: true },
  { key: 'clinic.phone', id: 'clinic-phone', label: 'Clinic phone', type: 'text', nullable: true },
];

const today = () => new Date().toISOString().slice(0, 10);

function control(spec, value) {
  const { type } = spec;
  if (type === 'bool') return h('input', { type: 'checkbox', checked: !!value });
  if (type === 'area' || type === 'list') return h('textarea', { class: 'input', rows: type === 'list' ? 4 : 3, value: type === 'list' ? (value || []).join('\n') : value ?? '' });
  if (type === 'select') return h('select', { class: 'select' }, spec.options.map(([v, t]) => h('option', { value: v, selected: v === (value ?? spec.options[0][0]) }, t)));
  const attrs = { class: 'input', type: type === 'num' || type === 'int' ? 'number' : type === 'date' ? 'date' : type === 'url' ? 'url' : 'text', value: type === 'date' ? String(value ?? '').slice(0, 10) : value ?? '', autocomplete: 'off' };
  if (type === 'num') { attrs.step = 'any'; attrs.inputmode = 'decimal'; }
  if (type === 'int') { attrs.step = '1'; attrs.inputmode = 'numeric'; }
  if (type === 'date') attrs.max = today();
  return h('input', attrs);
}
function build(spec, value) {
  const input = control(spec, value);
  const id = spec.id || spec.key;
  if (spec.type === 'bool') {
    input.id = id; input.name = id;
    return h('div', { class: `field${spec.span2 ? ' span-2' : ''}` }, h('label', { for: id, class: 'row-8' }, input, spec.label), h('span', { class: 'field-error', id: `${id}-error`, hidden: true }));
  }
  return field({ id, label: spec.required ? `${spec.label} (required)` : spec.label, input, hint: spec.hint, span2: spec.span2 });
}
function read(spec, el) {
  const raw = el.type === 'checkbox' ? el.checked : el.value;
  switch (spec.type) {
    case 'bool': return raw;
    case 'list': return raw.split('\n').map((x) => x.trim()).filter(Boolean);
    case 'num': case 'int': return raw === '' ? (spec.nullable ? null : undefined) : Number(raw);
    default: { const t = String(raw).trim(); return t === '' ? (spec.nullable ? null : spec.required ? undefined : '') : t; }
  }
}
const getPath = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);

export async function renderEditor(page, { navigate }, { kind, id }) {
  const creating = !id;
  let listing = null;
  if (!creating) listing = (await api(`/admin/listings/${kind}/${id}`)).listing;
  const spec = SPEC[kind];
  const els = new Map(); // key -> element
  const title = creating ? `Add ${KIND_LABEL[kind].toLowerCase()}` : listing.name;

  const form = h('form', { class: 'admin-form', novalidate: true, 'aria-label': title });
  const message = h('div', { class: 'notice notice-danger span-2', role: 'alert', hidden: true });
  const initial = creating ? { sourcePlatform: 'CareRoute admin', checkedAt: today(), facilityType: 'hospital', specialities: [], departments: [], testsListed: [], qualifications: [], languages: [], expertise: [], title: '' } : listing;
  const put = (s, container) => { const f = build(s, getPath(initial, s.key)); container.append(f); els.set(s.key, f.querySelector('input,textarea,select')); };

  // Doctors choose a hospital or a clinic of their own; everything else is one flat list of fields.
  let workplace = 'hospital';
  let hospitalId = listing?.hospitalId ?? null;
  let hospitalName = listing?.hospitalName ?? '';
  const clinicSet = h('fieldset', {}, h('legend', {}, 'Clinic details'));
  const hospitalBox = h('div', { class: 'admin-picker span-2' });
  const modeBox = h('fieldset', { class: 'span-2' }, h('legend', {}, 'Where this doctor practises'));

  for (const s of spec) {
    if (kind === 'doctor' && s.key === 'qualifications') {
      form.append(modeBox, hospitalBox, clinicSet);
    }
    put(s, form);
  }
  if (kind === 'doctor') {
    for (const s of CLINIC) put(s, clinicSet);
    workplace = listing?.clinic ? 'clinic' : 'hospital';
    const radio = (v, t) => h('label', {}, h('input', { type: 'radio', name: 'workplace', value: v, checked: workplace === v, onchange: () => { workplace = v; sync(); } }), t);
    modeBox.append(h('div', { class: 'admin-radio' }, radio('hospital', 'At a hospital or clinic already listed'), radio('clinic', 'At their own clinic')));
    if (listing?.clinic) for (const s of CLINIC) els.get(s.key).value = getPath(listing, s.key) ?? '';
    drawPicker();
    sync();
  }

  function sync() {
    hospitalBox.hidden = workplace !== 'hospital';
    clinicSet.hidden = workplace !== 'clinic';
    modeBox.querySelector('.admin-radio')?.setAttribute('aria-label', 'Workplace');
  }
  function drawPicker() {
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search hospitals by name or area', autocomplete: 'off', 'aria-label': 'Search hospitals' });
    const results = h('ul', { 'aria-label': 'Matching hospitals' });
    const current = h('p', { class: 't-subhead', id: 'hospitalId-current' });
    const err = h('span', { class: 'field-error', id: 'hospitalId-error', hidden: true });
    const paint = () => { current.replaceChildren(hospitalId ? h('span', {}, 'Selected: ', h('strong', {}, hospitalName || 'a hospital')) : 'No hospital selected.'); };
    const find = debounce(async () => {
      try {
        const { hospitals } = await api(`/admin/hospital-choices?q=${encodeURIComponent(search.value.trim())}&limit=8`);
        results.replaceChildren(...hospitals.map((x) => h('li', {}, h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { hospitalId = x.id; hospitalName = x.name; paint(); results.replaceChildren(); search.value = ''; } }, `${x.name}${x.area ? `, ${x.area}` : ''}${x.active ? '' : ' (hidden)'}`))));
        if (!hospitals.length) results.replaceChildren(h('li', { class: 't-footnote muted' }, 'No hospital matches.'));
      } catch (e) { results.replaceChildren(h('li', { class: 't-footnote' }, errorText(e))); }
    });
    search.addEventListener('input', find);
    paint();
    hospitalBox.replaceChildren(h('label', { for: 'hospital-search', class: 't-subhead', style: 'font-weight:600' }, 'Hospital'), current, Object.assign(search, { id: 'hospital-search' }), results, err);
  }

  function collect() {
    const body = {};
    for (const s of spec) { const v = read(s, els.get(s.key)); if (v !== undefined) body[s.key] = v; }
    if (kind === 'doctor') {
      if (workplace === 'hospital') { body.hospitalId = hospitalId; body.clinic = null; }
      else {
        const clinic = {};
        for (const s of CLINIC) { const v = read(s, els.get(s.key)); if (v !== undefined) clinic[s.key.split('.')[1]] = v; }
        body.hospitalId = null; body.clinic = clinic;
      }
    }
    return body;
  }

  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, creating ? 'Add listing' : 'Save changes');
  const actions = h('div', { class: 'admin-actions span-2' }, save, h('a', { class: 'btn btn-secondary', href: '#/listings' }, 'Cancel'));
  form.append(message, actions);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.hidden = true;
    if (kind === 'doctor' && workplace === 'hospital' && !hospitalId) {
      const el = form.querySelector('#hospitalId-error'); el.textContent = 'Choose a hospital, or switch to their own clinic.'; el.hidden = false; form.querySelector('#hospital-search').focus(); return;
    }
    const empties = [...spec, ...(kind === 'doctor' && workplace === 'clinic' ? CLINIC : [])].filter((x) => x.required && [undefined, null, ''].includes(read(x, els.get(x.key))));
    if (empties.length) { showErrors(form, { fields: Object.fromEntries(empties.map((x) => [x.key, `${x.label} is required`])) }, message); return; }
    const done = busy(save);
    try {
      const res = creating
        ? await api(`/admin/listings/${kind}`, { method: 'POST', body: collect() })
        : await api(`/admin/listings/${kind}/${id}`, { method: 'PATCH', body: collect() });
      toast(creating ? 'Listing added' : 'Changes saved');
      if (creating) navigate(`#/listings/${kind}/${res.listing.id}`);
      else { listing = res.listing; done(); drawHead(); }
    } catch (err) { done(); showErrors(form, err, message); }
  });

  const head = h('div', { class: 'stack-12' });
  function drawHead() {
    if (creating) { head.replaceChildren(pageHead({ title, sub: 'New listings appear to patients as soon as you add them. Fill in where the details came from so the next person can check them.' })); return; }
    head.replaceChildren(pageHead({
      title: listing.name, sub: `${KIND_LABEL[kind]}. Changes are visible to patients straight away and are recorded in the audit log.`,
      actions: h('div', { class: 'row-8' }, listing.active ? tag('Shown to patients', 'success') : tag('Hidden from patients', 'danger'),
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: toggle }, listing.active ? 'Hide' : 'Show again')),
    }));
  }
  async function toggle() {
    if (listing.active && !(await confirmDialog({ title: `Hide ${listing.name}?`, text: 'Patients will stop seeing it in search, maps and the assistant. You can show it again at any time.', confirm: 'Hide listing' }))) return;
    try { listing = (await api(`/admin/listings/${kind}/${id}/${listing.active ? 'hide' : 'unhide'}`, { method: 'POST', body: {} })).listing; toast(listing.active ? 'Listing shown again' : 'Listing hidden'); drawHead(); }
    catch (err) { toast(err.message); }
  }

  drawHead();
  page.append(h('a', { class: 'admin-link row-8', href: '#/listings' }, icon('back', 18), 'All listings'), head, form);
}
