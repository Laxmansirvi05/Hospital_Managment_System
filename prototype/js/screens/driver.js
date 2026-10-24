import { h, s, icon, toast, announce } from '../h.js';
import { AMBULANCE, PATIENT, YOU, ROUTE_TO_PATIENT, STATUS_LABEL } from '../data.js';
import { createMap } from '../map3d.js';
import { pageHead } from './ui.js';

const OFFER_SECONDS = 30;
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

const driver = {
  availability: 'available',
  trip: null,
};

const STEPS = [
  ['assigned', 'On my way', 'Tell the patient you have started driving'],
  ['en_route', 'Arrived at pickup', 'Tap when you reach the patient'],
  ['arrived', 'Patient on board', 'Tap when the patient is in the ambulance'],
  ['picked_up', 'Arrived at hospital', 'Tap when you reach the hospital'],
  ['at_hospital', 'Complete trip', 'Ends the trip for everyone'],
];
const NEXT = { assigned: 'en_route', en_route: 'arrived', arrived: 'picked_up', picked_up: 'at_hospital', at_hospital: 'completed' };

function ring(seconds) {
  const bar = s('circle', { class: 'ring-bar', cx: 60, cy: 60, r: RING_R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-dasharray': RING_C, 'stroke-dashoffset': 0 });
  const num = h('span', { class: 't-title-1' }, String(seconds));
  const el = h('div', { class: 'ring', role: 'timer', 'aria-label': `${seconds} seconds left to accept` },
    s('svg', { width: 120, height: 120, viewBox: '0 0 120 120', 'aria-hidden': 'true' },
      s('circle', { class: 'ring-track', cx: 60, cy: 60, r: RING_R, fill: 'none', 'stroke-width': 8 }), bar),
    h('span', { class: 'ring-text' }, num, h('span', { class: 't-caption muted' }, 'seconds')),
  );
  return {
    el,
    set(left) {
      num.textContent = String(left);
      el.setAttribute('aria-label', `${left} seconds left to accept`);
      bar.setAttribute('stroke-dashoffset', String(RING_C * (1 - left / OFFER_SECONDS)));
      el.classList.toggle('ring-low', left <= 10);
    },
  };
}

function statusCard(onChange) {
  const options = [['available', 'Available'], ['offline', 'Offline'], ['busy', 'Busy']];
  const text = { available: 'You receive offers for requests near you.', offline: 'You do not receive offers.', busy: 'You do not receive new offers until you are available again.' };
  const hint = h('p', { class: 't-subhead muted' }, text[driver.availability]);
  const group = h('div', { class: 'seg seg-block', role: 'group', 'aria-label': 'Your status' },
    options.map(([v, label]) => h('button', {
      type: 'button', 'aria-pressed': String(driver.availability === v),
      onclick: (e) => {
        driver.availability = v;
        for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        hint.textContent = text[v];
        onChange();
      },
    }, label)));
  return h('section', { class: 'card stack-16' },
    h('h2', { class: 't-title-3' }, 'Your status'),
    group,
    hint,
    h('hr', { class: 'divider' }),
    h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, 'Vehicle'), h('dd', { class: 'num strong' }, AMBULANCE.registration)),
      h('div', {}, h('dt', {}, 'Type'), h('dd', {}, 'ALS')),
      h('div', {}, h('dt', {}, 'Operator'), h('dd', {}, AMBULANCE.operator)),
      h('div', {}, h('dt', {}, 'Last location sent'), h('dd', {}, 'Secunderabad, 3 s ago')),
    ),
  );
}

export function offers(ctx) {
  const slot = h('div');
  let timer = 0;

  const stop = () => { window.clearInterval(timer); timer = 0; };
  ctx.onCleanup(stop);

  function showOffer() {
    stop();
    if (driver.availability !== 'available') {
      slot.replaceChildren(h('section', { class: 'card empty' },
        h('span', { class: 'obj', style: 'width:56px;height:56px' }, icon('ambulance', 26)),
        h('p', { class: 't-headline' }, 'No offers while you are not available'),
        h('p', { class: 't-subhead muted' }, 'Set your status to Available to receive requests.')));
      return;
    }
    let left = OFFER_SECONDS;
    const r = ring(left);
    const card = h('section', { class: 'card card-raised stack-24', 'aria-labelledby': 'of-h' },
      h('div', { class: 'spread', style: 'align-items:flex-start' },
        h('div', { class: 'stack-8' },
          h('span', { class: 'status status-live' }, 'New request'),
          h('h2', { class: 't-title-1', id: 'of-h' }, 'Heart or chest pain'),
          h('p', { class: 't-callout muted' }, `Pickup at ${YOU.address}`),
        ),
        r.el,
      ),
      h('dl', { class: 'facts facts-2' },
        h('div', {}, h('dt', {}, 'Distance'), h('dd', { class: 'num strong' }, '5.4 km, about 8 min by road')),
        h('div', {}, h('dt', {}, 'Requested type'), h('dd', {}, 'Advanced life support')),
        h('div', {}, h('dt', {}, 'Awake and responding'), h('dd', {}, 'Yes')),
        h('div', {}, h('dt', {}, 'Patients'), h('dd', { class: 'num' }, '1')),
      ),
      createMap({ route: ROUTE_TO_PATIENT, ambulance: AMBULANCE.start, pins: [], legend: [['you', 'Pickup'], ['ambulance', 'You']] }).el,
      h('div', { class: 'pair' },
        h('button', { class: 'btn btn-secondary btn-l', type: 'button', onclick: () => end('rejected') }, 'Reject'),
        h('button', { class: 'btn btn-primary btn-l', type: 'button', onclick: accept }, 'Accept'),
      ),
      h('p', { class: 't-footnote muted' }, 'If you reject or do not answer in 30 seconds, the request goes to the next nearest ambulance.'),
    );
    slot.replaceChildren(card);
    announce('New request. 30 seconds to accept.');
    timer = window.setInterval(() => {
      left -= 1;
      r.set(left);
      if (left <= 0) end('expired');
    }, 1000);
  }

  function end(reason) {
    stop();
    slot.replaceChildren(h('section', { class: 'card empty' },
      h('p', { class: 't-headline' }, reason === 'expired' ? 'The offer expired' : 'You rejected the offer'),
      h('p', { class: 't-subhead muted' }, 'It moved to the next nearest ambulance. New offers appear here.'),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: showOffer }, 'Show a new sample offer')));
  }

  function accept() {
    stop();
    driver.trip = { status: 'assigned' };
    driver.availability = 'busy';
    toast('Accepted. The patient can now see you are on the way.');
    location.hash = '#/driver/trip';
  }

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Offers', sub: 'Requests are offered to one ambulance at a time, nearest first.' }),
    h('div', { class: 'grid-side-main' }, statusCard(showOffer), slot),
  );
  showOffer();
  return { el, title: 'Offers' };
}

export function trip() {
  if (!driver.trip) {
    return {
      title: 'Current trip',
      el: h('div', { class: 'page', style: 'max-width:680px' },
        pageHead({ title: 'No current trip', sub: 'Accept an offer to start a trip.' }),
        h('a', { class: 'btn btn-primary', href: '#/driver' }, 'Go to offers')),
    };
  }

  const stepSlot = h('div');
  const statusSlot = h('div', { 'aria-live': 'polite' });
  const map = createMap({ route: ROUTE_TO_PATIENT, ambulance: AMBULANCE.start, pins: [], legend: [['you', 'Pickup'], ['ambulance', 'You']] });

  function draw() {
    const st = driver.trip.status;
    statusSlot.replaceChildren(h('div', { class: 'stack-8' },
      h('span', { class: `status ${st === 'completed' ? 'status-ok' : 'status-live'}` }, STATUS_LABEL[st]),
      h('p', { class: 't-title-2' }, st === 'completed' ? 'Trip complete.' : `Pickup at ${YOU.address}`),
    ));
    const step = STEPS.find(([k]) => k === st);
    if (st === 'en_route') map.setAmbulance({ x: 548, y: 246 });
    if (['arrived', 'picked_up', 'at_hospital', 'completed'].includes(st)) { map.setAmbulance(YOU); map.setRoute(null); }
    stepSlot.replaceChildren(step
      ? h('div', { class: 'stack-8' },
        h('button', {
          class: 'btn btn-primary btn-l btn-block', type: 'button', style: 'min-height:72px;font-size:var(--fs-title-3)',
          onclick: () => { driver.trip.status = NEXT[st]; draw(); announce(STATUS_LABEL[driver.trip.status]); },
        }, step[1]),
        h('p', { class: 't-footnote muted', style: 'text-align:center' }, step[2]))
      : h('div', { class: 'stack-12' },
        h('p', { class: 't-subhead muted' }, 'Set yourself available when you are ready for the next request.'),
        h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { driver.availability = 'available'; driver.trip = null; location.hash = '#/driver'; } }, 'Set available')));
  }
  draw();

  const mid = PATIENT.medicalId;
  const el = h('div', { class: 'page' },
    pageHead({ title: 'Current trip' }),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised stack-24' }, statusSlot, stepSlot),
        map.el,
      ),
      h('div', { class: 'stack-16' },
        h('section', { class: 'card stack-16' },
          h('h2', { class: 't-title-3' }, 'About the patient'),
          h('dl', { class: 'facts facts-2' },
            h('div', {}, h('dt', {}, 'What happened'), h('dd', {}, 'Heart or chest pain')),
            h('div', {}, h('dt', {}, 'Awake and responding'), h('dd', {}, 'Yes')),
            h('div', {}, h('dt', {}, 'Patients'), h('dd', { class: 'num' }, '1')),
            h('div', {}, h('dt', {}, 'Raised by'), h('dd', {}, 'The patient')),
          ),
          h('a', { class: 'btn btn-secondary btn-block', href: `tel:${PATIENT.phone.replace(/\s/g, '')}` }, icon('phone', 18), 'Call the patient'),
        ),
        h('section', { class: 'card stack-12' },
          h('div', { class: 'spread' }, h('h2', { class: 't-title-3' }, 'Medical ID'), h('span', { class: 'tag tag-success' }, 'Shared by patient')),
          h('dl', { class: 'facts facts-2' },
            h('div', {}, h('dt', {}, 'Blood group'), h('dd', { class: 't-title-3' }, mid.bloodGroup)),
            h('div', {}, h('dt', {}, 'Allergies'), h('dd', { class: 'strong', style: 'color:var(--danger)' }, mid.allergies.join(', '))),
          ),
          h('p', { class: 't-subhead' }, mid.notes),
          h('p', { class: 't-footnote muted' }, 'Visible only while this trip is active.'),
        ),
      ),
    ),
  );
  return { el, title: 'Current trip' };
}
