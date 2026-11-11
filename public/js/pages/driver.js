// The driver's workspace (D-73, D-84). A driver goes online, shares a live location so patients can be
// matched to the nearest crew, is alerted when a request arrives, and walks the trip step by step.
// Location is sent only while online. A request alerts with a sound, a browser notice and a flashing
// tab title, and works only while this page is open (there is no push service).
import { h, icon, toast } from '../h.js';
import { api } from '../api.js';
import { shell } from '../shell.js';
import { pageHead } from '../ui.js';
import { createRealMap } from '../real-map.js';
import { areaCentroids } from '../location.js';

const { main, user } = await shell({ nav: 'driver', title: 'Driver' });

const POLL_MS = 3000;
// A fresh ping keeps the crew eligible for matching (D-74); send well inside that window.
const PING_MS = 20000;
const STEPS = {
  assigned: ['en_route', 'Start driving to the patient'],
  en_route: ['arrived', 'I have arrived'],
  arrived: ['picked_up', 'Patient is on board'],
  picked_up: ['at_hospital', 'Arrived at the hospital'],
  at_hospital: ['completed', 'Complete the trip'],
};
const STATUS_WORDS = { assigned: 'Request accepted', en_route: 'On the way', arrived: 'At the pickup', picked_up: 'Patient on board', at_hospital: 'At the hospital', completed: 'Trip complete' };
const TYPE_WORDS = { cardiac: 'Heart problem', accident: 'Accident or injury', breathing: 'Trouble breathing', stroke: 'Stroke signs', pregnancy: 'Pregnancy', other: 'Other emergency' };

const live = document.querySelector('#live');
const say = (text) => { live.textContent = text; };

if (user.role !== 'driver') {
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ art: 'ambulance', title: 'Driver workspace', sub: 'This page is for driver accounts.' }),
    h('a', { class: 'btn btn-primary', href: user.role === 'admin' ? '/admin/' : '/dashboard/', style: 'justify-self:start' }, 'Go to your workspace')));
} else {
  await start();
}

async function start() {
  const state = { ambulance: null, offer: null, trip: null, watchId: null, lastPing: 0, chosen: null, areas: [], flash: null, seenOffer: null };

  const statusChip = h('span', { class: 'tag' });
  const goButton = h('button', { class: 'btn btn-primary', type: 'button' });
  const locationLine = h('p', { class: 't-subhead muted', role: 'status' });
  const areaSelect = h('select', { class: 'select', 'aria-label': 'Where you are' }, h('option', { value: '' }, 'Choose where you are'));
  const areaButton = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, icon('locate', 16), 'Use this place');
  const areaRow = h('div', { class: 'row-8', hidden: true }, areaSelect, areaButton);
  const vehicleLine = h('p', { class: 't-headline' });
  const waiting = h('p', { class: 't-subhead muted' });

  const offerTitle = h('h2', { class: 't-title-2', id: 'driver-offer-h' }, 'New ambulance request');
  const offerBody = h('dl', { class: 'facts facts-2' });
  const countdown = h('p', { class: 't-headline', 'aria-live': 'off' });
  const accept = h('button', { class: 'btn btn-primary', type: 'button' }, icon('check', 18), 'Accept');
  const decline = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Decline');
  const offerCard = h('section', { class: 'card stack-12 driver-offer', role: 'alert', 'aria-labelledby': 'driver-offer-h', hidden: true },
    offerTitle, offerBody, countdown, h('div', { class: 'row-8' }, accept, decline));

  const tripTitle = h('h2', { class: 't-title-2', id: 'driver-trip-h' }, 'Current trip');
  const tripFacts = h('dl', { class: 'facts facts-2' });
  const mapBox = h('div');
  const mapsLink = h('a', { class: 'btn btn-secondary', target: '_blank', rel: 'noopener noreferrer' }, icon('route', 18), 'Open in Maps', icon('external', 16));
  const nextStep = h('button', { class: 'btn btn-primary', type: 'button' });
  const release = h('button', { class: 'btn btn-primary', type: 'button', hidden: true }, 'Back to waiting for requests');
  const tripCard = h('section', { class: 'card stack-12', 'aria-labelledby': 'driver-trip-h', hidden: true },
    tripTitle, tripFacts, mapBox, h('div', { class: 'row-8' }, nextStep, mapsLink, release));
  let map = null;

  const errorLine = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const fail = (err) => { errorLine.hidden = false; errorLine.replaceChildren(icon('alert', 18), h('span', {}, err.message || 'Something went wrong. Try again.')); };
  const clearFail = () => { errorLine.hidden = true; };

  main.replaceChildren(h('div', { class: 'page driver-page' },
    pageHead({ art: 'ambulance', title: 'Driver workspace', sub: 'Go online to receive ambulance requests near you. Keep this page open while you are online.' }),
    errorLine,
    h('section', { class: 'card stack-12', 'aria-labelledby': 'driver-vehicle-h' },
      h('div', { class: 'spread' }, h('h2', { class: 't-title-3', id: 'driver-vehicle-h' }, 'Your ambulance'), statusChip),
      vehicleLine, waiting, goButton, locationLine, areaRow),
    offerCard,
    tripCard));

  const dim = (label, value) => h('div', {}, h('dt', {}, label), h('dd', {}, value ?? 'Not given'));
  const online = () => state.ambulance?.status === 'available' || state.ambulance?.status === 'busy';

  // ---- alerting -------------------------------------------------------------------------------
  let audio = null;
  function beep() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      [0, 0.35, 0.7].forEach((offset) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.25);
        osc.connect(gain).connect(audio.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.3);
      });
    } catch (err) {
      // Some browsers hold audio back until the page has been used; the banner and notice still show.
      console.debug('alert sound unavailable', err?.name);
    }
  }
  function alertDriver(offer) {
    say(`New ambulance request. ${offer.secondsRemaining} seconds to answer.`);
    beep();
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try {
        const n = new Notification('CareRoute: new ambulance request', { body: `${TYPE_WORDS[offer.emergencyType] || 'Emergency'}. Open CareRoute to accept or decline.`, tag: 'careroute-offer', requireInteraction: true });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (err) {
        console.debug('browser notice failed', err?.name);
      }
    }
    const original = document.title;
    let on = false;
    clearInterval(state.flash);
    state.flash = setInterval(() => { on = !on; document.title = on ? 'New request! · CareRoute' : original; }, 800);
    state.restoreTitle = () => { clearInterval(state.flash); document.title = original; };
  }
  function quiet() { state.restoreTitle?.(); state.restoreTitle = null; }

  // ---- location -------------------------------------------------------------------------------
  async function ping(point) {
    state.lastPing = Date.now();
    try { await api('/driver/me/location', { method: 'PUT', body: { lat: point.lat, lng: point.lng, heading: point.heading ?? null, speed: point.speed ?? null } }); } catch (err) { fail(err); }
  }
  function stopWatching() {
    if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
    clearInterval(state.heartbeat);
  }
  function startWatching() {
    stopWatching();
    if (!navigator.geolocation) { needPlace('This browser cannot share location. Choose where you are instead.'); return; }
    locationLine.textContent = 'Finding your location.';
    state.watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
      state.chosen = null; areaRow.hidden = true;
      locationLine.textContent = `Sharing your live location, accurate to about ${Math.round(accuracy)} metres.`;
      if (Date.now() - state.lastPing >= 8000) ping({ lat, lng, heading: Number.isFinite(heading) ? Math.round(heading) : null, speed: speed ? Math.round(speed * 3.6) : null });
      state.last = { lat, lng };
    }, (err) => {
      stopWatching();
      needPlace(err.code === 1 ? 'Location is blocked for this site. Choose where you are, or allow location in the browser settings.' : 'Your location could not be found. Choose where you are instead.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    // A still crew sends no new fixes, so a steady heartbeat keeps it eligible for matching.
    state.heartbeat = setInterval(() => { if (state.last) ping({ ...state.last }); }, PING_MS);
  }
  function needPlace(text) {
    locationLine.textContent = text;
    areaRow.hidden = false;
  }
  areaButton.addEventListener('click', async () => {
    const area = state.areas.find((a) => a.name === areaSelect.value);
    if (!area) { toast('Choose where you are first.'); return; }
    state.chosen = area;
    state.last = { lat: area.lat, lng: area.lng };
    await ping({ lat: area.lat, lng: area.lng });
    clearInterval(state.heartbeat);
    state.heartbeat = setInterval(() => ping({ lat: area.lat, lng: area.lng }), PING_MS);
    locationLine.textContent = `Your place is set to ${area.name}. Requests near it will reach you.`;
    await refresh();
  });
  areaCentroids().then((areas) => { state.areas = areas; areaSelect.append(...areas.map((a) => h('option', { value: a.name }, a.name))); });

  // ---- going online ---------------------------------------------------------------------------
  goButton.addEventListener('click', async () => {
    goButton.disabled = true;
    clearFail();
    try {
      if (online() && state.ambulance.status !== 'busy') {
        await api('/driver/me/status', { method: 'PUT', body: { status: 'offline' } });
        stopWatching();
        locationLine.textContent = '';
      } else if (!online()) {
        // Asked on this tap, because a browser only allows the question after a click.
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
        beepReady();
        if (state.chosen) { state.last = { lat: state.chosen.lat, lng: state.chosen.lng }; } else startWatching();
        // Matching needs a position, so a first one is sent before going online.
        await waitForPlace();
        await api('/driver/me/status', { method: 'PUT', body: { status: 'available' } });
      }
      await refresh();
    } catch (err) { fail(err); } finally { goButton.disabled = false; }
  });
  function beepReady() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* the sound is optional */ } }
  async function waitForPlace() {
    for (let i = 0; i < 40 && !state.last; i++) await new Promise((r) => setTimeout(r, 250));
    if (!state.last) throw new Error('Share your location, or choose where you are, before going online.');
    await ping({ ...state.last });
  }

  // ---- offers and trips -----------------------------------------------------------------------
  function paintVehicle() {
    const a = state.ambulance;
    vehicleLine.textContent = `${a.registrationNumber} · ${a.type}`;
    const busy = a.status === 'busy';
    statusChip.className = `tag ${a.status === 'available' ? 'tag-success' : busy ? 'tag-warning' : ''}`;
    statusChip.textContent = a.status === 'available' ? 'Online' : busy ? 'On a trip' : 'Offline';
    goButton.hidden = busy;
    goButton.className = a.status === 'available' ? 'btn btn-secondary' : 'btn btn-primary';
    goButton.replaceChildren(icon(a.status === 'available' ? 'close' : 'ambulance', 18), a.status === 'available' ? 'Go offline' : 'Go online');
    waiting.textContent = a.status === 'available' ? 'Waiting for requests. Keep this page open; you will hear an alert.' : busy ? '' : 'You are offline. Patients cannot reach you.';
    // After a reload the watch is gone, so an online driver starts sharing again.
    if (a.status === 'available' && state.watchId === null && !state.chosen && !state.last) startWatching();
  }
  function paintOffer(offer) {
    offerBody.replaceChildren(...[
      dim('Situation', TYPE_WORDS[offer.emergencyType] || offer.emergencyType),
      dim('People', String(offer.patientCount)),
      dim('Conscious', offer.conscious === null ? 'Not sure' : offer.conscious ? 'Yes' : 'No'),
      dim('Distance from you', Number.isFinite(offer.distanceKm) ? `${offer.distanceKm} km` : 'Not known'),
      h('p', { class: 't-footnote muted' }, 'The exact place, address and notes appear after you accept.')].filter(Boolean));
  }
  let countdownTimer = null;
  function showOffer(offer) {
    if (state.seenOffer !== offer.emergencyId) {
      state.seenOffer = offer.emergencyId;
      paintOffer(offer);
      alertDriver(offer);
      accept.disabled = false; decline.disabled = false;
      let left = offer.secondsRemaining;
      clearInterval(countdownTimer);
      const tick = () => { countdown.textContent = left > 0 ? `${left} seconds to answer` : 'This request has expired'; left = Math.max(0, left - 1); };
      tick();
      countdownTimer = setInterval(tick, 1000);
    }
    offerCard.hidden = false;
  }
  function hideOffer() { offerCard.hidden = true; state.seenOffer = null; clearInterval(countdownTimer); quiet(); }

  function showTrip(trip) {
    state.trip = trip;
    tripCard.hidden = false;
    tripTitle.textContent = STATUS_WORDS[trip.status] || 'Current trip';
    const id = trip.medicalId;
    tripFacts.replaceChildren(...[
      dim('Pickup', trip.address || `${trip.location.lat.toFixed(4)}, ${trip.location.lng.toFixed(4)}`), dim('People', String(trip.patientCount ?? 1)),
      dim('Conscious', trip.conscious === null || trip.conscious === undefined ? 'Not sure' : trip.conscious ? 'Yes' : 'No'),
      trip.notes ? dim('Notes', trip.notes) : null,
      id ? dim('Medical ID shared by the patient', [id.fullName, id.bloodGroup && `Blood group ${id.bloodGroup}`, id.allergies?.length && `Allergies: ${id.allergies.join(', ')}`, id.conditions?.length && `Conditions: ${id.conditions.join(', ')}`].filter(Boolean).join('. ')) : null].filter(Boolean));
    const pins = [{ ...trip.location, label: 'Patient', kind: 'hospital' }];
    const origin = state.last ? { ...state.last, label: 'You' } : null;
    if (!map) { map = createRealMap({ pins, origin, height: 260, label: 'Map of the pickup' }); mapBox.replaceChildren(map); } else map.update({ pins, origin });
    mapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${trip.location.lat},${trip.location.lng}`;
    const step = STEPS[trip.status];
    nextStep.hidden = !step;
    if (step) { nextStep.textContent = step[1]; nextStep.dataset.status = step[0]; nextStep.disabled = false; }
    release.hidden = trip.status !== 'completed';
    mapsLink.hidden = trip.status === 'completed';
  }
  function hideTrip() { tripCard.hidden = true; state.trip = null; map = null; mapBox.replaceChildren(); }

  async function refresh() {
    try {
      const [me, offers, trip] = await Promise.all([api('/driver/me'), api('/driver/offers'), api('/driver/trips/active')]);
      state.ambulance = me.ambulance;
      paintVehicle();
      if (trip.emergency) { hideOffer(); showTrip(trip.emergency); } else if (state.trip?.status === 'completed') { /* stay on the finished trip until released */ } else hideTrip();
      if (!trip.emergency && offers.offer && state.ambulance.status === 'available') showOffer(offers.offer); else if (!trip.emergency) hideOffer();
      clearFail();
    } catch (err) {
      fail(err.status === 404 ? new Error('No ambulance is linked to this driver account.') : err);
    }
  }

  async function answer(action) {
    if (!state.seenOffer) return;
    accept.disabled = true; decline.disabled = true;
    try {
      await api(`/driver/offers/${state.seenOffer}/${action}`, { method: 'POST', body: {} });
      quiet();
      toast(action === 'accept' ? 'Request accepted. Drive to the patient.' : 'Request declined.');
      hideOffer();
      await refresh();
    } catch (err) {
      accept.disabled = false; decline.disabled = false;
      fail(err);
      await refresh();
    }
  }
  accept.addEventListener('click', () => answer('accept'));
  decline.addEventListener('click', () => answer('reject'));

  nextStep.addEventListener('click', async () => {
    if (!state.trip) return;
    nextStep.disabled = true;
    try {
      const { emergency } = await api(`/driver/trips/${state.trip.id}/status`, { method: 'POST', body: { status: nextStep.dataset.status } });
      showTrip({ ...state.trip, ...emergency });
      say(STATUS_WORDS[emergency.status] || '');
    } catch (err) { nextStep.disabled = false; fail(err); }
  });
  release.addEventListener('click', async () => {
    release.disabled = true;
    try { await api('/driver/me/release', { method: 'POST', body: {} }); hideTrip(); await refresh(); } catch (err) { fail(err); } finally { release.disabled = false; }
  });

  await refresh();
  const poll = setInterval(refresh, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('beforeunload', () => { clearInterval(poll); stopWatching(); quiet(); });
}
