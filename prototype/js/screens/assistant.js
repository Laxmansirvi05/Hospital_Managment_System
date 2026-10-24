import { h, icon, rupees, announce } from '../h.js';
import { DOCTORS, HOSPITALS, MEDICINES, DIAGNOSTICS, distanceKm } from '../data.js';
import { pageHead, listingRow, km, disclaimer, hospitalName } from './ui.js';

// Sample answers only. The real assistant runs the red-flag rules first, then the model chain,
// and its results come only from CareRoute's own listings (docs/07-ai-triage.md sections 0 and 7).
const RED_FLAGS = [
  /chest (pain|tight|pressure)/, /(can.?t|cannot|hard to|difficulty) breath/, /short(ness)? of breath/,
  /unconscious|not waking|fainted|collapsed/, /bleeding (heavily|a lot)|severe bleeding/,
  /face droop|slurred|stroke/, /seizure|fits/,
];

const SPECIALITY_RULES = [
  [/skin|rash|itch|acne|eczema/, 'Dermatology'],
  [/knee|joint|back pain|fracture|bone|sprain|shoulder/, 'Orthopaedics'],
  [/child|baby|kid|infant|toddler/, 'Paediatrics'],
  [/eye|vision|blurred|cataract/, 'Ophthalmology'],
  [/\bear\b|throat|nose|sinus|tonsil/, 'ENT'],
  [/stomach|acidity|digest|vomit|liver|constipation/, 'Gastroenterology'],
  [/cough|asthma|wheez/, 'Pulmonology'],
  [/headache|migraine|numb|dizz/, 'Neurology'],
  [/heart|palpitation|blood pressure/, 'Cardiology'],
  [/pregnan|period|gyn/, 'Obstetrics and Gynaecology'],
  [/fever|cold|tired|weak|body ache/, 'General Medicine'],
];

const SUGGESTIONS = [
  'Itchy rash on my arm for a week',
  'Knee pain after a fall yesterday',
  'Where can I get an MRI near Banjara Hills?',
  'Compare prices for paracetamol 650',
  'My child has had a fever since last night',
];

function doctorsFor(spec) {
  return DOCTORS.filter((d) => d.specialization === spec)
    .map((d) => ({ d, place: d.hospitalId ? HOSPITALS.find((x) => x.id === d.hospitalId) : d }))
    .sort((a, b) => distanceKm(a.place) - distanceKm(b.place)).slice(0, 3);
}

function answer(text) {
  const t = text.toLowerCase();

  if (RED_FLAGS.some((re) => re.test(t))) {
    return h('div', { class: 'bubble bubble-bot' },
      h('p', { class: 'notice notice-danger' }, icon('alert', 18),
        h('span', {}, h('strong', {}, 'This may be an emergency. '), 'What you describe can be a warning sign. Request an ambulance now, or call 112.')),
      h('a', { class: 'sos-key sos-key-compact', href: '#/sos', style: 'justify-self:start' }, icon('ambulance', 22), 'Request ambulance'),
      disclaimer(),
    );
  }

  if (/price|paracetamol|cetirizine|tablet|medicine|metformin|pantoprazole/.test(t)) {
    const meds = MEDICINES.filter((m) => t.includes(m.name.split(' ')[0].toLowerCase()));
    const list = meds.length ? meds : MEDICINES.slice(0, 2);
    return h('div', { class: 'bubble bubble-bot' },
      h('p', {}, 'Here are the listed prices I found. CareRoute compares prices only. It does not suggest which medicine to take.'),
      h('div', { class: 'list' }, list.map((m) => listingRow({
        href: `#/medicine/${m.id}`, kind: 'medicine', title: m.name, meta: [`${m.pack} · lowest on ${m.listings[0].platform}`],
        trail: h('span', { class: 't-headline num', style: 'color:var(--text-1)' }, rupees(m.listings[0].price)),
      }))),
      disclaimer('Ask a doctor or pharmacist which medicine is right for you. Prices are listed prices and may differ on each platform.'),
    );
  }

  if (/mri|x-ray|xray|scan|blood test|test|lab|ultrasound/.test(t)) {
    const centres = DIAGNOSTICS.filter((c) => c.tests.some((x) => t.includes(x.toLowerCase().split(' ')[0])))
      .sort((a, b) => distanceKm(a) - distanceKm(b));
    const list = (centres.length ? centres : DIAGNOSTICS).slice(0, 3);
    return h('div', { class: 'bubble bubble-bot' },
      h('p', {}, 'These diagnostic centres list that test publicly. Call the centre to confirm and to book.'),
      h('div', { class: 'list' }, list.map((c) => listingRow({
        href: `#/place/diagnostic/${c.id}`, kind: 'diagnostic', title: c.name, meta: [`${c.area} · ${c.hours}`],
        trail: h('span', { class: 'num t-subhead' }, km(c)),
      }))),
      disclaimer(),
    );
  }

  const rule = SPECIALITY_RULES.find(([re]) => re.test(t));
  const spec = rule ? rule[1] : 'General Medicine';
  const docs = doctorsFor(spec);
  const hosp = HOSPITALS.filter((x) => x.specialities.includes(spec)).sort((a, b) => distanceKm(a) - distanceKm(b)).slice(0, 2);
  return h('div', { class: 'bubble bubble-bot' },
    rule
      ? h('p', {}, 'From what you describe, a doctor in ', h('strong', {}, spec), ' may be a good place to start. This is a suggestion of where to look, not a diagnosis.')
      : h('p', {}, 'I could not match that to one speciality, so here is ', h('strong', {}, 'General Medicine'), ' as a first step. You can also describe where it hurts and for how long.'),
    docs.length ? h('div', { class: 'stack-8' },
      h('p', { class: 't-footnote muted strong' }, 'Doctors'),
      h('div', { class: 'list' }, docs.map(({ d, place }) => listingRow({
        href: `#/doctor/${d.id}`, kind: 'doctor', title: d.name,
        meta: [`${d.specialization} · ${d.hospitalId ? hospitalName(d.hospitalId) : d.clinic}`],
        trail: h('span', { class: 'num t-subhead' }, km(place)),
      }))),
    ) : null,
    hosp.length ? h('div', { class: 'stack-8' },
      h('p', { class: 't-footnote muted strong' }, 'Hospitals'),
      h('div', { class: 'list' }, hosp.map((x) => listingRow({
        href: `#/hospital/${x.id}`, kind: 'hospital', title: x.name, meta: [`${x.area}`], trail: h('span', { class: 'num t-subhead' }, km(x)),
      }))),
    ) : null,
    disclaimer(),
  );
}

export function view({ query }) {
  const thread = h('div', { class: 'chat', 'aria-live': 'polite' },
    h('div', { class: 'bubble bubble-bot' },
      h('p', {}, 'Describe what you need in your own words. I will suggest the kind of doctor to see and show care near you.'),
      h('div', { class: 'row-8' }, SUGGESTIONS.map((sg) => h('button', { class: 'chip', type: 'button', onclick: () => send(sg) }, sg))),
    ),
  );

  const input = h('input', { class: 'input', id: 'ask', placeholder: 'Describe the problem, for example: rash on my arm for a week', autocomplete: 'off' });
  const form = h('form', { class: 'composer' },
    h('label', { class: 'visually-hidden', for: 'ask' }, 'Message'),
    input,
    h('button', { class: 'btn btn-primary', type: 'submit' }, icon('send', 18), h('span', {}, 'Send')),
  );

  function send(text) {
    if (!text.trim()) return;
    thread.append(h('div', { class: 'bubble bubble-user' }, text));
    thread.append(answer(text));
    announce('The assistant answered.');
    input.value = '';
    thread.lastElementChild.scrollIntoView({ block: 'nearest' });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });

  const el = h('div', { class: 'page', style: 'max-width:840px' },
    pageHead({ title: 'Assistant', sub: 'Find the right kind of care. The assistant never diagnoses, prescribes or recommends a medicine.' }),
    h('p', { class: 'notice' }, icon('info', 18),
      h('span', {}, 'In the real product, your text is sent to an AI service to produce guidance, so do not enter names or phone numbers. In this prototype, answers are sample responses and no AI service is used.')),
    thread,
    h('div', { style: 'position:sticky;bottom:var(--space-16)' }, form),
  );

  const first = query.get('q');
  if (first) send(first);
  return { el, title: 'Assistant' };
}
