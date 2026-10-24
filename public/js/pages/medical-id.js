import { h, icon, toast } from '../h.js';
import { api, uploadTo } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, field, showErrors, busy, confirmDialog } from '../ui.js';
import { initials } from '../format.js';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'];
const RELATIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Neighbour', 'Other'];

const { main, user } = await shell({ nav: 'medical-id', title: 'Medical ID' });

try {
  const [mid, contacts] = await Promise.all([api('/patients/me/medical-id'), api('/patients/me/contacts')]);
  const photo = mid.hasPhoto ? (await api('/patients/me/photo').catch(() => null))?.url : null;
  render(mid, contacts.contacts, photo);
} catch (err) {
  loadError(main, err);
}

function input(value = '', attrs = {}) {
  return h('input', { class: 'input', value: value ?? '', ...attrs });
}

function select(options, value, placeholder) {
  return h('select', { class: 'select' },
    placeholder ? h('option', { value: '' }, placeholder) : null,
    options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
}

/** List input: type, press Add or Enter, remove with the cross. */
function chipList({ id, label, values, placeholder, hint }) {
  const items = [...values];
  const list = h('div', { class: 'chips', 'aria-live': 'polite' });
  const text = h('input', { class: 'input', id, placeholder, maxlength: 120 });
  const draw = () => list.replaceChildren(...items.map((v, i) => h('span', { class: 'chip-x' }, v,
    h('button', { type: 'button', 'aria-label': `Remove ${v}`, onclick: () => { items.splice(i, 1); draw(); } }, icon('close', 14)))));
  const add = () => {
    const v = text.value.trim();
    if (v && !items.some((x) => x.toLowerCase() === v.toLowerCase())) items.push(v);
    text.value = '';
    draw();
  };
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  draw();
  const el = h('div', { class: 'field span-2', 'data-field': id },
    h('label', { for: id }, label),
    list,
    h('div', { class: 'inline-add' }, text, h('button', { class: 'btn btn-secondary', type: 'button', onclick: add }, icon('plus', 18), 'Add')),
    hint ? h('span', { class: 'hint' }, hint) : null,
    h('span', { class: 'field-error', id: `${id}-error`, hidden: true }));
  return { el, values: () => { if (text.value.trim()) add(); return [...items]; } };
}

function section(id, title, sub, ...children) {
  return h('section', { class: 'card form-section', id, 'aria-labelledby': `${id}-h` },
    h('div', { class: 'stack-4' }, h('h2', { class: 't-title-2', id: `${id}-h` }, title), sub ? h('p', { class: 't-subhead muted' }, sub) : null),
    ...children);
}

function render(mid, contacts, photoUrl) {
  // Identity
  const fullName = input(mid.fullName, { autocomplete: 'name', maxlength: 100 });
  const dob = input(mid.dateOfBirth, { type: 'date', max: new Date().toISOString().slice(0, 10) });
  const gender = select([['female', 'Female'], ['male', 'Male'], ['other', 'Other'], ['prefer_not_to_say', 'Prefer not to say']], mid.gender, 'Choose');
  const language = input(mid.preferredLanguage, { placeholder: 'For example Telugu, Hindi, English', maxlength: 40 });

  // Address
  const a = mid.address;
  const line1 = input(a.line1, { autocomplete: 'address-line1', maxlength: 120 });
  const line2 = input(a.line2, { autocomplete: 'address-line2', maxlength: 120 });
  const landmark = input(a.landmark, { maxlength: 120, placeholder: 'Near a metro station, temple or shop' });
  const area = input(a.area, { maxlength: 60 });
  const city = input(a.city || 'Hyderabad', { autocomplete: 'address-level2', maxlength: 60 });
  const pin = input(a.pinCode, { inputmode: 'numeric', autocomplete: 'postal-code', maxlength: 6, placeholder: '500016' });

  // Health
  const blood = select(BLOOD.map((b) => [b, b]), mid.bloodGroup, 'Choose');
  const height = input(mid.heightCm ?? '', { type: 'number', min: 30, max: 250, inputmode: 'numeric' });
  const weight = input(mid.weightKg ?? '', { type: 'number', min: 1, max: 350, step: '0.1', inputmode: 'decimal' });
  const allergies = chipList({ id: 'allergies', label: 'Allergies', values: mid.allergies, placeholder: 'For example Penicillin', hint: 'Medicines, foods or anything else you react to.' });
  const conditions = chipList({ id: 'conditions', label: 'Conditions', values: mid.conditions, placeholder: 'For example Type 2 diabetes' });
  const meds = chipList({ id: 'currentMedicines', label: 'Medicines you take now', values: mid.currentMedicines, placeholder: 'For example Metformin 500 mg twice a day' });
  const surgeries = chipList({ id: 'pastSurgeries', label: 'Past surgeries', values: mid.pastSurgeries, placeholder: 'For example Appendix removed, 2019' });
  const disabilities = chipList({ id: 'disabilities', label: 'Disabilities or access needs', values: mid.disabilities, placeholder: 'For example Uses a wheelchair' });
  const donor = select([['yes', 'Yes, I am a registered organ donor'], ['no', 'No'], ['undecided', 'Not decided']], mid.organDonor);
  const notes = h('textarea', { class: 'textarea', maxlength: 500 }, mid.medicalNotes);

  // Insurance and doctor
  const insProvider = input(mid.insurance.provider, { maxlength: 80 });
  const insPolicy = input(mid.insurance.policyNumber, { maxlength: 40, autocomplete: 'off' });
  const docName = input(mid.primaryDoctor.name, { maxlength: 100 });
  const docPhone = input(mid.primaryDoctor.phone, { type: 'tel', inputmode: 'tel', maxlength: 20 });

  // Crew sharing
  const share = h('input', { type: 'checkbox', role: 'switch', id: 'share', checked: mid.shareWithCrew, 'aria-describedby': 'share-desc' });
  const shareText = h('p', { class: 't-subhead muted', id: 'share-desc' });
  const syncShare = () => {
    shareText.textContent = share.checked
      ? 'On. During an active emergency, the crew assigned to you can see your name, photo, age, blood group, allergies, conditions, current medicines and disabilities. Never your address beyond the pickup point, and never your insurance.'
      : 'Off. Nobody else can see your medical ID.';
  };
  share.addEventListener('change', syncShare);
  syncShare();

  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const saveBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save changes');
  const meter = h('span', { style: `width:${mid.completeness}%` });
  const meterText = h('span', { class: 't-headline num' }, `${mid.completeness}% complete`);

  const form = h('form', { class: 'stack-24', novalidate: true },
    message,
    section('identity', 'About you', 'Your photo helps the crew find and recognise you.',
      photoBlock(photoUrl, mid.fullName || user.name),
      h('div', { class: 'form-grid' },
        field({ id: 'fullName', label: 'Full name', input: fullName }),
        field({ id: 'dateOfBirth', label: 'Date of birth', input: dob }),
        field({ id: 'gender', label: 'Gender', input: gender }),
        field({ id: 'preferredLanguage', label: 'Preferred language', input: language }),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Mobile number'), h('p', { class: 't-callout num' }, mid.phone), h('span', { class: 'hint' }, 'From your account.')))),
    section('address', 'Home address', 'Used to fill the pickup address when you ask for help from home.',
      h('div', { class: 'form-grid' },
        field({ id: 'line1', label: 'House, flat or building', input: line1, span2: true }),
        field({ id: 'line2', label: 'Street and locality', input: line2, span2: true }),
        field({ id: 'landmark', label: 'Landmark', input: landmark, span2: true }),
        field({ id: 'addrArea', label: 'Area', input: area }),
        field({ id: 'city', label: 'City', input: city }),
        field({ id: 'pinCode', label: 'Pin code', input: pin }))),
    section('health', 'Health history', 'Only what you choose to add. Keep it short and specific.',
      h('div', { class: 'form-grid' },
        field({ id: 'bloodGroup', label: 'Blood group', input: blood }),
        field({ id: 'organDonor', label: 'Organ donor', input: donor }),
        field({ id: 'heightCm', label: 'Height (cm)', input: height }),
        field({ id: 'weightKg', label: 'Weight (kg)', input: weight }),
        allergies.el, conditions.el, meds.el, surgeries.el, disabilities.el,
        field({ id: 'medicalNotes', label: 'Notes for the crew', input: notes, hint: 'Up to 500 characters, for example "Has a pacemaker".', span2: true }))),
    section('insurance', 'Insurance and your doctor', 'Kept for your own reference. Never shared with the crew.',
      h('div', { class: 'form-grid' },
        field({ id: 'provider', label: 'Insurance provider', input: insProvider }),
        field({ id: 'policyNumber', label: 'Policy number', input: insPolicy }),
        field({ id: 'docName', label: 'Primary doctor', input: docName }),
        field({ id: 'phone', label: 'Doctor’s phone', input: docPhone }))),
    section('sharing', 'Sharing in an emergency', null,
      h('div', { class: 'card', style: 'background:var(--surface-sunken);box-shadow:none' },
        h('label', { class: 'switch', for: 'share' }, h('span', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'Share with the ambulance crew'), shareText), share))),
    h('div', { class: 'sticky-save' },
      h('div', { class: 'stack-4', style: 'flex:1;max-width:280px' }, meterText, h('div', { class: 'meter', 'aria-hidden': 'true' }, meter)),
      saveBtn));

  const num = (el) => (el.value === '' ? null : Number(el.value));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(saveBtn);
    const body = {
      fullName: fullName.value.trim() || user.name,
      preferredLanguage: language.value.trim(),
      address: { line1: line1.value.trim(), line2: line2.value.trim(), landmark: landmark.value.trim(), area: area.value.trim(), city: city.value.trim(), pinCode: pin.value.trim() },
      heightCm: num(height),
      weightKg: num(weight),
      allergies: allergies.values(),
      conditions: conditions.values(),
      currentMedicines: meds.values(),
      pastSurgeries: surgeries.values(),
      disabilities: disabilities.values(),
      organDonor: donor.value,
      medicalNotes: notes.value.trim(),
      insurance: { provider: insProvider.value.trim(), policyNumber: insPolicy.value.trim() },
      primaryDoctor: { name: docName.value.trim(), phone: docPhone.value.trim() },
      shareWithCrew: share.checked,
    };
    if (dob.value) body.dateOfBirth = dob.value;
    if (gender.value) body.gender = gender.value;
    if (blood.value) body.bloodGroup = blood.value;
    try {
      const saved = await api('/patients/me/medical-id', { method: 'PUT', body });
      restore();
      message.hidden = true;
      meter.style.width = `${saved.completeness}%`;
      meterText.textContent = `${saved.completeness}% complete`;
      toast('Medical ID saved');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });

  const welcome = new URLSearchParams(location.search).get('welcome');
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title: welcome ? 'Welcome to CareRoute' : 'Medical ID', sub: welcome ? 'Add the details that matter in an emergency. You can fill this in over time. Everything is private unless you turn on sharing.' : 'Your personal and health details in one place. Private unless you turn on sharing.' }),
    h('nav', { class: 'section-nav', 'aria-label': 'Sections' },
      [['identity', 'About you'], ['address', 'Address'], ['health', 'Health'], ['insurance', 'Insurance and doctor'], ['sharing', 'Sharing'], ['contacts', 'Emergency contacts']].map(([id, label]) => h('a', { href: `#${id}` }, label))),
    h('div', { class: 'grid-main-side' }, form, contactsCard(contacts))));
}

function photoBlock(url, name) {
  const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png', class: 'visually-hidden', id: 'photo-file' });
  const av = h('span', { class: 'avatar avatar-l' }, url ? h('img', { src: url, alt: 'Your photo' }) : initials(name));
  const status = h('span', { class: 't-footnote muted' }, 'JPEG or PNG, up to 2 MB.');
  const removeBtn = h('button', { class: 'btn btn-text btn-sm', type: 'button', hidden: !url }, 'Remove');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { toast('Choose a JPEG or PNG photo.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('That photo is larger than 2 MB.'); return; }
    status.textContent = 'Uploading';
    try {
      const start = await api('/patients/me/photo', { body: { contentType: file.type, sizeBytes: file.size } });
      await uploadTo(start.uploadUrl, file);
      await api(`/patients/me/photo/${start.id}/complete`, { method: 'POST' });
      const { url: fresh } = await api('/patients/me/photo');
      av.replaceChildren(h('img', { src: fresh, alt: 'Your photo' }));
      removeBtn.hidden = false;
      status.textContent = 'Photo saved.';
    } catch (err) {
      status.textContent = err.message;
    }
  });
  removeBtn.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Remove your photo?', confirm: 'Remove' }))) return;
    try {
      await api('/patients/me/photo', { method: 'DELETE' });
      av.replaceChildren(initials(name));
      removeBtn.hidden = true;
      status.textContent = 'Photo removed.';
    } catch (err) {
      toast(err.message);
    }
  });
  return h('div', { class: 'row' }, av,
    h('div', { class: 'stack-8' },
      h('div', { class: 'row-8' }, h('label', { class: 'btn btn-secondary btn-sm', for: 'photo-file' }, icon('camera', 16), url ? 'Change photo' : 'Add photo'), removeBtn, fileInput),
      status));
}

function contactsCard(initial) {
  const contacts = [...initial];
  const list = h('div', { class: 'list' });
  const draw = () => list.replaceChildren(...(contacts.length ? contacts.map((c) => h('div', { class: 'list-row' },
    h('span', { class: 'avatar', style: 'width:44px;height:44px;font-size:var(--fs-headline)', 'aria-hidden': 'true' }, initials(c.name)),
    h('span', { class: 'list-row-main' }, h('span', { class: 'list-row-title' }, c.name), h('span', { class: 'list-row-meta num' }, `${c.relation} · ${c.phone}`)),
    h('button', {
      class: 'icon-btn', type: 'button', 'aria-label': `Remove ${c.name}`,
      onclick: async () => {
        if (!(await confirmDialog({ title: `Remove ${c.name}?`, text: 'They will no longer get a tracking link when you raise an SOS.', confirm: 'Remove' }))) return;
        try {
          await api(`/patients/me/contacts/${c.id}`, { method: 'DELETE' });
          contacts.splice(contacts.indexOf(c), 1);
          draw();
          toast('Contact removed');
        } catch (err) {
          toast(err.message);
        }
      },
    }, icon('trash', 18)))) : [h('p', { class: 't-subhead muted' }, 'No contacts yet. Add someone who should know when you need help.')]));
  draw();

  const name = h('input', { class: 'input', maxlength: 100, autocomplete: 'off' });
  const phone = h('input', { class: 'input', type: 'tel', inputmode: 'tel', placeholder: '98765 43210' });
  const relation = h('select', { class: 'select' }, RELATIONS.map((r) => h('option', {}, r)));
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const addBtn = h('button', { class: 'btn btn-secondary', type: 'submit' }, icon('plus', 18), 'Add contact');
  const form = h('form', { class: 'stack-16', novalidate: true },
    message,
    field({ id: 'contact-name', label: 'Name', input: name }),
    field({ id: 'contact-phone', label: 'Mobile number', input: phone }),
    field({ id: 'contact-relation', label: 'Relation', input: relation }),
    addBtn);
  // Map server field names onto this form's ids.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(addBtn, 'Adding');
    try {
      const c = await api('/patients/me/contacts', { body: { name: name.value, phone: phone.value, relation: relation.value } });
      contacts.push(c);
      form.reset();
      message.hidden = true;
      draw();
      toast('Contact added');
    } catch (err) {
      const fields = Object.fromEntries(Object.entries(err.fields || {}).map(([k, v]) => [`contact-${k}`, v]));
      showErrors(form, { message: err.message, fields }, message);
    } finally {
      restore();
    }
  });

  return h('section', { class: 'card stack-16', id: 'contacts', 'aria-labelledby': 'ct-h', style: 'align-self:start' },
    h('div', { class: 'stack-4' },
      h('h2', { class: 't-title-2', id: 'ct-h' }, 'Emergency contacts'),
      h('p', { class: 't-subhead muted' }, 'Up to 5 people. They get an SMS with a tracking link when you raise an SOS. The SMS never includes health details.')),
    list,
    h('hr', { class: 'divider' }),
    form);
}
