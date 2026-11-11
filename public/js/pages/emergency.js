import { api } from '../api.js';
import { createRealMap } from '../real-map.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const trackingToken = params.get('token');
const statusCopy = document.querySelector('#status-copy');
const connection = document.querySelector('#connection-state');
const steps = document.querySelector('#status-steps');
const eta = document.querySelector('#eta');
const position = document.querySelector('#position-text');
const live = document.querySelector('#live');
const cancel = document.querySelector('#cancel-trip');
const copy = document.querySelector('#copy-link');
const trackingLink = document.querySelector('#tracking-link');
const noMatch = document.querySelector('#no-match');
const feedback = document.querySelector('#feedback-form');
const feedbackResult = document.querySelector('#feedback-result');
const map = createRealMap({ height: 280, label: 'Map of the demo ambulance location' });
document.querySelector('#map-slot').append(map);
const path = `/emergencies/${encodeURIComponent(id || '')}`;
const stepsList = ['matching', 'assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital', 'completed'];
const labels = { matching: 'Finding a crew', assigned: 'Crew accepted', en_route: 'Crew travelling', arrived: 'Crew arrived', picked_up: 'Patient picked up', at_hospital: 'Trip at hospital', completed: 'Demo trip complete', cancelled: 'Request cancelled', no_match: 'No crew accepted yet' };
let delay = 3000; let timer = null; let lastStatus = null; let stopped = false; let currentState = null;

const trackingUrl = trackingToken ? `${location.origin}/track/?token=${encodeURIComponent(trackingToken)}` : '';

function render(emergency) {
  currentState = emergency; const status = emergency.status;
  statusCopy.textContent = labels[status] || 'Status updated.';
  if (lastStatus !== status) { live.textContent = `Demo status: ${labels[status] || status}.`; lastStatus = status; }
  steps.replaceChildren(...stepsList.map((step) => {
    const li = document.createElement('li'); li.textContent = labels[step];
    li.dataset.state = stepsList.indexOf(step) < stepsList.indexOf(status) ? 'complete' : step === status ? 'current' : 'upcoming';
    if (step === status) li.setAttribute('aria-current', 'step'); return li;
  }));
  const seconds = emergency.etaSeconds;
  eta.textContent = Number.isFinite(seconds) && seconds >= 0 ? `${emergency.etaIsEstimate ? 'Estimated arrival' : 'Route ETA'}: about ${Math.max(1, Math.ceil(seconds / 60))} min${emergency.etaIsEstimate ? ' (estimate)' : ''}.` : '';
  const p = emergency.ambulance?.position;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    position.textContent = `Ambulance position: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}.`;
    map.update({ pins: [{ ...p, label: 'Ambulance', kind: 'emergency' }] });
  } else { position.textContent = 'The ambulance location is not available yet. Status updates will continue.'; map.update({ pins: [] }); }
  const beforePickup = ['matching', 'assigned', 'en_route', 'arrived'].includes(status);
  cancel.hidden = !beforePickup;
  noMatch.hidden = status !== 'no_match';
  feedback.hidden = status !== 'completed';
  copy.hidden = !trackingUrl;
  const terminal = ['completed', 'cancelled', 'no_match'].includes(status);
  if (terminal) stopped = true;
  return terminal;
}

async function refresh() {
  if (stopped) return;
  try {
    if (!id) throw new Error('Open the patient status page from your SOS request.');
    const { emergency } = await api(path);
    const terminal = render(emergency);
    connection.hidden = true; delay = 3000;
    if (!terminal) timer = setTimeout(refresh, delay);
  } catch (err) {
    connection.hidden = false; connection.textContent = 'Reconnecting. Your status will be checked again.';
    statusCopy.textContent = err.status === 404 ? 'This request is no longer available.' : 'We could not refresh the demo status.';
    delay = Math.min(delay * 2, 30_000); timer = setTimeout(refresh, delay);
  }
}
refresh();

cancel.addEventListener('click', async () => {
  cancel.disabled = true;
  try { const result = await api(`${path}/cancel`, { method: 'POST', body: {} }); stopped = true; clearTimeout(timer); render(result.emergency); }
  catch (err) { cancel.disabled = false; connection.hidden = false; connection.textContent = err.message; }
});

copy.addEventListener('click', async () => {
  if (!trackingUrl) return;
  trackingLink.href = trackingUrl; trackingLink.textContent = trackingUrl; trackingLink.hidden = false;
  try { await navigator.clipboard.writeText(trackingUrl); live.textContent = 'Tracking link copied.'; copy.textContent = 'Link copied'; }
  catch { live.textContent = 'Tracking link is shown below. Select and copy it.'; }
});

feedback.addEventListener('submit', async (event) => {
  event.preventDefault(); if (!currentState || currentState.status !== 'completed') return;
  const data = new FormData(feedback);
  try { await api(`${path}/feedback`, { method: 'POST', body: { rating: Number(data.get('rating')), comment: String(data.get('comment') || '') } }); feedbackResult.textContent = 'Thank you. Feedback was saved.'; feedback.querySelector('button').disabled = true; }
  catch (err) { feedbackResult.textContent = err.message; }
});
