import { h, icon, toast, announce } from '../h.js';
import { YOU, AMBULANCE, PATIENT, ROUTE_TO_PATIENT, ROUTE_TO_HOSPITAL, STATUS_TEXT, STATUS_LABEL } from '../data.js';
import { createMap, remaining } from '../map3d.js';
import { em, startEmergency, subscribe, advance, cancelEmergency, canCancel, etaMinutes } from '../emergency-store.js';
import { pageHead } from './ui.js';

const TYPES = [
  ['cardiac', 'Heart or chest pain', 'Chest pain, pressure, or a racing heart'],
  ['accident', 'Accident or injury', 'Road accident, fall, burn or wound'],
  ['other', 'Something else', 'Breathing trouble, fainting or anything else'],
];

const AMB_TYPES = [
  ['any', 'Nearest suitable', 'CareRoute picks the closest ambulance that fits'],
  ['BLS', 'Basic life support', 'BLS: oxygen, first aid, stretcher'],
  ['ALS', 'Advanced life support', 'ALS: cardiac monitor, defibrillator, paramedic'],
  ['ICU', 'Intensive care', 'ICU: ventilator and critical care equipment'],
];

function seg(name, options, value, onChange) {
  const group = h('div', { class: 'seg', role: 'group', 'aria-label': name },
    options.map(([v, label]) => h('button', {
      type: 'button', 'aria-pressed': String(v === value),
      onclick: (e) => {
        for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        onChange(v);
      },
    }, label)));
  return group;
}

function choices(name, options, value, onChange, cols) {
  const group = h('div', { class: `choices ${cols}`, role: 'group', 'aria-label': name },
    options.map(([v, title, sub]) => h('button', {
      type: 'button', class: 'choice', 'aria-pressed': String(v === value),
      onclick: (e) => {
        for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        onChange(v);
      },
    }, h('span', { class: 't-headline' }, title), h('span', { class: 't-footnote muted' }, sub))));
  return group;
}

export function request() {
  const form = { forSelf: true, emergencyType: 'other', conscious: 'yes', patientCount: 1, ambulanceType: 'any', notes: '', address: YOU.address };

  const count = h('output', { 'aria-live': 'polite' }, '1');
  const setCount = (n) => { form.patientCount = Math.min(10, Math.max(1, n)); count.textContent = String(form.patientCount); };

  const addressInput = h('input', { class: 'input', id: 'addr', value: form.address });
  addressInput.addEventListener('input', () => { form.address = addressInput.value; });
  const addressField = h('div', { class: 'field', hidden: true },
    h('label', { for: 'addr' }, 'Address or landmark'), addressInput,
    h('span', { class: 'hint' }, 'If location access is off, type the address. Your request still goes out.'));

  const notes = h('textarea', { class: 'textarea', id: 'notes', placeholder: 'Floor, gate number, or anything the crew should know' });
  notes.addEventListener('input', () => { form.notes = notes.value; });

  const submit = (e) => {
    e.preventDefault();
    startEmergency({ ...form });
    location.hash = '#/emergency';
  };

  const el = h('form', { class: 'page', style: 'max-width:880px', onsubmit: submit },
    pageHead({ title: 'Request an ambulance', sub: 'Your location is filled in. Everything else is optional, and you can send the request at any point.' }),
    h('p', { class: 'notice notice-danger' }, icon('phone', 18), h('span', {}, 'If you can, also call ', h('a', { href: 'tel:112', class: 'strong' }, '112'), '. The request below goes to the nearest available ambulance on CareRoute.')),

    h('section', { class: 'card card-raised stack-16', 'aria-labelledby': 'loc-h' },
      h('h2', { class: 't-title-3', id: 'loc-h' }, 'Pickup location'),
      h('div', { class: 'spread' },
        h('div', { class: 'row', style: 'flex-wrap:nowrap' },
          h('span', { class: 'obj' }, icon('locate', 22)),
          h('div', { class: 'stack-4' },
            h('span', { class: 't-headline' }, YOU.address),
            h('span', { class: 't-footnote muted' }, 'From your phone’s location'),
          ),
        ),
        h('button', { class: 'btn btn-text', type: 'button', onclick: () => { addressField.hidden = !addressField.hidden; if (!addressField.hidden) addressInput.focus(); } }, 'Change'),
      ),
      addressField,
    ),

    h('section', { class: 'card stack-24' },
      h('div', { class: 'field' },
        h('span', { class: 'label' }, 'Who needs help?'),
        seg('Who needs help', [['self', 'Me'], ['other', 'Someone else']], 'self', (v) => { form.forSelf = v === 'self'; }),
      ),
      h('div', { class: 'field' },
        h('span', { class: 'label' }, 'What happened?'),
        choices('What happened', TYPES, form.emergencyType, (v) => { form.emergencyType = v; }, 'choices-2'),
      ),
      h('div', { class: 'grid-2' },
        h('div', { class: 'field' },
          h('span', { class: 'label' }, 'Is the person awake and responding?'),
          seg('Is the person awake and responding', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']], 'yes', (v) => { form.conscious = v; }),
        ),
        h('div', { class: 'field' },
          h('span', { class: 'label', id: 'pc-l' }, 'Number of patients'),
          h('div', { class: 'stepper', role: 'group', 'aria-labelledby': 'pc-l' },
            h('button', { type: 'button', 'aria-label': 'One fewer patient', onclick: () => setCount(form.patientCount - 1) }, icon('minus', 18)),
            count,
            h('button', { type: 'button', 'aria-label': 'One more patient', onclick: () => setCount(form.patientCount + 1) }, icon('plus', 18)),
          ),
        ),
      ),
      h('div', { class: 'field' },
        h('span', { class: 'label' }, 'Ambulance type'),
        choices('Ambulance type', AMB_TYPES, 'any', (v) => { form.ambulanceType = v; }, 'choices-4'),
        h('span', { class: 'hint' }, 'Not sure? Leave it on nearest suitable.'),
      ),
      h('div', { class: 'field' }, h('label', { for: 'notes' }, 'Notes for the crew (optional)'), notes),
    ),

    h('p', { class: 'notice notice-neutral' }, icon('shield', 18),
      h('span', {}, 'Your medical ID will be shared with the assigned crew during this request. Your ', h('a', { href: '#/medical-id' }, `${PATIENT.contacts.length} emergency contacts`), ' will get a tracking link by SMS.')),

    h('div', { style: 'position:sticky;bottom:var(--space-16);z-index:5' },
      h('button', { class: 'sos-key', type: 'submit' },
        h('span', { class: 'sos-key-title' }, 'Request ambulance now'),
        h('span', { class: 'sos-key-sub' }, 'Sends your location to the nearest available ambulance'),
      ),
    ),
  );
  return { el, title: 'Request an ambulance' };
}

function threadNode(state, title, text, iconName) {
  return h('li', { class: `thread-node is-${state}` },
    h('span', { class: 'thread-dot' }, icon(iconName, 18)),
    h('span', { class: 'thread-body' },
      h('span', { class: 't-headline' }, title),
      h('span', { class: 't-subhead muted' }, text),
    ),
  );
}

function careThread(e) {
  const st = e.status;
  const mins = etaMinutes();
  const patient = {
    matching: ['active', 'Request sent from Begumpet'], assigned: ['done', 'Waiting at Begumpet'], en_route: ['done', 'Waiting at Begumpet'],
    arrived: ['active', 'The crew is with you'], picked_up: ['done', 'On board'], at_hospital: ['done', 'At the hospital'],
    completed: ['done', 'Trip complete'], cancelled: ['stopped', 'Request cancelled'],
  }[st] || ['idle', ''];
  const amb = {
    matching: ['active', 'Searching for the nearest ambulance'],
    assigned: ['active', `ALS ambulance accepted, about ${mins} min away`],
    en_route: ['active', `On the way, about ${mins} min away`],
    arrived: ['done', 'At your location'],
    picked_up: ['active', `On the way to the hospital, about ${mins} min`],
    at_hospital: ['done', 'Reached the hospital'],
    completed: ['done', 'Trip complete'],
    cancelled: ['stopped', 'Stopped'],
  }[st] || ['idle', ''];
  const rep = st === 'completed' ? ['done', 'None shared'] : st === 'cancelled' ? ['stopped', 'None shared'] : ['idle', 'None shared with the crew'];
  return h('ol', { class: 'thread thread-wide', 'aria-label': 'Care Thread' },
    threadNode(patient[0], 'Patient', patient[1], 'user'),
    threadNode(amb[0], 'Ambulance', amb[1], 'ambulance'),
    threadNode(rep[0], 'Reports', rep[1], 'report'),
  );
}

function statusClass(st) {
  if (['completed', 'arrived', 'at_hospital'].includes(st)) return 'status-ok';
  if (st === 'cancelled') return 'status-idle';
  if (st === 'failed') return 'status-bad';
  return 'status-live';
}

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 60 ? `Updated ${s} s ago` : `Updated ${Math.round(s / 60)} min ago`;
}

function liveHeader(e, freshness) {
  const mins = etaMinutes();
  return h('div', { class: 'spread', style: 'align-items:flex-end' },
    h('div', { class: 'stack-8' },
      h('span', { class: `status ${statusClass(e.status)}` }, STATUS_LABEL[e.status]),
      h('p', { class: 't-title-2', style: 'max-width:520px' }, STATUS_TEXT[e.status]),
      freshness,
    ),
    mins !== null && ['assigned', 'en_route', 'picked_up'].includes(e.status)
      ? h('div', { class: 'eta', 'aria-label': `About ${mins} minutes` },
        h('span', { class: 't-footnote muted strong' }, e.status === 'picked_up' ? 'To the hospital' : 'Arrives in about'),
        h('span', { class: 'eta-value' }, h('span', { class: 'eta-number' }, String(mins)), h('span', { class: 'eta-unit' }, 'min')))
      : null,
  );
}

function routeFor(e) {
  if (['assigned', 'en_route'].includes(e.status)) return remaining(ROUTE_TO_PATIENT, e.status === 'assigned' ? 0 : e.progress);
  if (e.status === 'picked_up') return remaining(ROUTE_TO_HOSPITAL, e.progress);
  return null;
}

function feedback() {
  let stars = 0;
  const btns = [1, 2, 3, 4, 5].map((n) => h('button', {
    type: 'button', class: 'icon-btn', 'aria-label': `${n} of 5`, 'aria-pressed': 'false',
    onclick: () => {
      stars = n;
      btns.forEach((b, i) => { b.setAttribute('aria-pressed', String(i < n)); b.style.color = i < n ? 'var(--warning)' : 'var(--border-strong)'; });
    },
    style: 'color:var(--border-strong)',
  }, icon('star', 22)));
  const comment = h('textarea', { class: 'textarea', id: 'fb', placeholder: 'Optional' });
  const form = h('form', { class: 'card card-raised stack-16' },
    h('h2', { class: 't-title-3' }, 'How was your trip?'),
    h('div', { class: 'row-8', role: 'group', 'aria-label': 'Rating' }, btns),
    h('div', { class: 'field' }, h('label', { for: 'fb' }, 'Comment'), comment),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Send feedback')),
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!stars) { toast('Choose a rating from 1 to 5 first'); return; }
    form.replaceChildren(h('p', { class: 'status status-ok' }, 'Thank you. Your feedback was sent.'));
  });
  return form;
}

export function active(ctx) {
  if (em.status === 'idle') {
    return {
      title: 'Emergency',
      el: h('div', { class: 'page', style: 'max-width:680px' },
        pageHead({ title: 'No active request', sub: 'When you request an ambulance, its live status appears here.' }),
        h('a', { class: 'sos-key', href: '#/sos' }, h('span', { class: 'sos-key-title' }, 'Request ambulance')),
      ),
    };
  }

  const map = createMap({ ambulance: em.ambulance, route: routeFor(em), pins: [], legend: [['you', 'You'], ['ambulance', 'Ambulance']] });
  const freshness = h('span', { class: 't-footnote muted num' }, ago(em.updatedAt));
  const header = h('div', { 'aria-live': 'polite' });
  const thread = h('div');
  const side = h('div', { class: 'stack-16' });
  let lastStatus = '';

  const ambulanceCard = () => h('section', { class: 'card stack-16' },
    h('h2', { class: 't-title-3' }, 'Your ambulance'),
    ['matching'].includes(em.status)
      ? h('p', { class: 't-subhead muted' }, 'Details appear when a driver accepts.')
      : h('dl', { class: 'facts facts-2' },
        h('div', {}, h('dt', {}, 'Vehicle'), h('dd', { class: 'num strong' }, AMBULANCE.registration)),
        h('div', {}, h('dt', {}, 'Type'), h('dd', {}, 'Advanced life support')),
        h('div', {}, h('dt', {}, 'Driver'), h('dd', {}, AMBULANCE.driver)),
        h('div', {}, h('dt', {}, 'Operator'), h('dd', {}, AMBULANCE.operator)),
      ),
    ['matching', 'completed', 'cancelled'].includes(em.status) ? null
      : h('a', { class: 'btn btn-secondary btn-block', href: `tel:${AMBULANCE.driverPhone.replace(/\s/g, '')}` }, icon('phone', 18), 'Call the driver'),
  );

  const familyCard = () => h('section', { class: 'card stack-12' },
    h('h2', { class: 't-title-3' }, 'Family tracking'),
    h('p', { class: 't-subhead muted' }, `${PATIENT.contacts.map((c) => c.name.split(' ')[0]).join(' and ')} got an SMS with a link to follow the ambulance. The link never shows health details.`),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn-secondary btn-sm', href: '#/track' }, icon('eye', 16), 'Open family view'),
      h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: () => toast('Prototype only. No link was copied.') }, icon('share', 16), 'Share link'),
    ),
  );

  const cancelDialog = h('dialog', { class: 'sheet', 'aria-labelledby': 'cx-h' });
  const reason = h('select', { class: 'select', id: 'cx-r' }, ['I no longer need an ambulance', 'I found another way to the hospital', 'I sent this by mistake', 'Other'].map((r) => h('option', {}, r)));
  cancelDialog.append(h('form', { method: 'dialog', class: 'sheet-body' },
    h('h2', { class: 't-title-2', id: 'cx-h' }, 'Cancel this request?'),
    h('p', { class: 't-subhead muted' }, 'The ambulance will be released for someone else. If you still need help, call 112.'),
    h('div', { class: 'field' }, h('label', { for: 'cx-r' }, 'Reason'), reason),
    h('div', { class: 'row', style: 'justify-content:flex-end' },
      h('button', { class: 'btn btn-secondary', value: 'keep' }, 'Keep request'),
      h('button', { class: 'btn btn-danger', value: 'cancel' }, 'Cancel request'),
    ),
  ));
  cancelDialog.addEventListener('close', () => { if (cancelDialog.returnValue === 'cancel') cancelEmergency(reason.value); });

  const actionsCard = () => h('section', { class: 'card stack-12' },
    h('a', { class: 'btn btn-danger btn-block', href: 'tel:112' }, icon('phone', 18), 'Call 112'),
    canCancel() ? h('button', { class: 'btn btn-destructive btn-block', type: 'button', onclick: () => cancelDialog.showModal() }, 'Cancel request') : null,
    canCancel() ? h('p', { class: 't-footnote muted' }, 'You can cancel until the patient is on board.') : null,
  );

  const protoCard = () => h('section', { class: 'card stack-12', style: 'background:var(--surface-sunken);box-shadow:none' },
    h('h2', { class: 't-headline' }, 'Prototype controls'),
    h('p', { class: 't-footnote muted' }, 'The request moves on its own. Use these to look at each step.'),
    h('div', { class: 'row-8' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: ['completed', 'cancelled'].includes(em.status), onclick: advance }, 'Next step'),
      h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: () => startEmergency(em.form) }, 'Start over'),
    ),
  );

  const feedbackSlot = h('div');

  const draw = (e) => {
    freshness.textContent = ago(e.updatedAt);
    header.replaceChildren(liveHeader(e, freshness));
    map.setAmbulance(e.ambulance);
    map.setRoute(routeFor(e));
    if (e.status !== lastStatus) {
      thread.replaceChildren(careThread(e));
      side.replaceChildren(ambulanceCard(), familyCard(), actionsCard(), protoCard());
      feedbackSlot.replaceChildren(e.status === 'completed' ? feedback() : '');
      announce(STATUS_TEXT[e.status]);
      lastStatus = e.status;
    } else {
      thread.replaceChildren(careThread(e));
    }
  };

  ctx.onCleanup(subscribe(draw));
  const clock = window.setInterval(() => { freshness.textContent = ago(em.updatedAt); }, 1000);
  ctx.onCleanup(() => window.clearInterval(clock));

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Your ambulance request', sub: `Request ${em.id} · Begumpet` }),
    h('section', { class: 'card card-raised' }, header),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        map.el,
        h('section', { class: 'card stack-16' }, h('h2', { class: 't-title-3' }, 'Care Thread'), thread),
        feedbackSlot,
      ),
      side,
    ),
    cancelDialog,
  );
  return { el, title: 'Your ambulance request' };
}

export function track(ctx) {
  const map = createMap({ ambulance: em.ambulance, route: routeFor(em), you: false, pins: [], caption: 'Illustrative map, not to scale. The pickup address is not shown.' });
  const freshness = h('span', { class: 't-footnote muted num' });
  const header = h('div', { 'aria-live': 'polite' });
  const node = h('div');

  const draw = (e) => {
    if (e.status === 'idle') {
      header.replaceChildren(h('div', { class: 'stack-12' },
        h('p', { class: 't-title-3' }, 'No active request'),
        h('p', { class: 't-subhead muted' }, 'This view opens from the SMS link. Start a sample request to see it.'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => startEmergency({}) }, 'Start a sample request')),
      ));
      return;
    }
    freshness.textContent = ago(e.updatedAt);
    const familyText = { ...STATUS_TEXT, picked_up: 'The patient is on board. On the way to the hospital.', arrived: 'The ambulance has reached the pickup point.' };
    const mins = etaMinutes();
    header.replaceChildren(h('div', { class: 'spread', style: 'align-items:flex-end' },
      h('div', { class: 'stack-8' },
        h('span', { class: `status ${statusClass(e.status)}` }, STATUS_LABEL[e.status]),
        h('p', { class: 't-title-2' }, familyText[e.status]),
        freshness,
      ),
      mins && ['assigned', 'en_route', 'picked_up'].includes(e.status)
        ? h('div', { class: 'eta' }, h('span', { class: 't-footnote muted strong' }, 'About'), h('span', { class: 'eta-value' }, h('span', { class: 'eta-number' }, String(mins)), h('span', { class: 'eta-unit' }, 'min')))
        : null,
    ));
    map.setAmbulance(e.ambulance);
    map.setRoute(routeFor(e));
    node.replaceChildren(h('ol', { class: 'thread' }, threadNode(['completed', 'arrived', 'at_hospital'].includes(e.status) ? 'done' : 'active', 'Ambulance', `${AMBULANCE.registration} · Advanced life support`, 'ambulance')));
  };
  ctx.onCleanup(subscribe(draw));
  const clock = window.setInterval(() => { if (em.status !== 'idle') freshness.textContent = ago(em.updatedAt); }, 1000);
  ctx.onCleanup(() => window.clearInterval(clock));

  const el = h('div', { class: 'page', style: 'max-width:760px' },
    h('div', { class: 'spread' },
      h('a', { class: 'btn btn-text', href: '#/emergency' }, icon('back', 18), 'Back to patient view'),
      h('span', { class: 'tag' }, 'Family view, no sign in'),
    ),
    pageHead({ title: 'Ambulance tracking', sub: 'Shared with you by a family member. This page shows the ambulance only, never health details.' }),
    h('section', { class: 'card card-raised' }, header),
    map.el,
    h('section', { class: 'card' }, node),
    h('p', { class: 't-footnote muted' }, 'If you are worried, call 112.'),
  );
  return { el, title: 'Ambulance tracking' };
}
