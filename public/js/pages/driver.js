import { api } from '../api.js';
import { shell, loadError } from '../shell.js';

const { main, user } = await shell({ nav: 'driver', title: 'Driver' });
const live = document.querySelector('#live');
const wrapper = document.createElement('div'); wrapper.className = 'page emergency-driver-page';
const title = document.createElement('h1'); title.className = 't-large-title'; title.textContent = 'Driver workspace';
const notice = document.createElement('p'); notice.className = 'emergency-demo-notice'; const noticeStrong = document.createElement('strong'); noticeStrong.textContent = 'Demo: no real ambulance is sent.'; notice.append(noticeStrong, ' Use demo location mode on a desktop to try the workflow.');
const message = document.createElement('p'); message.className = 'notice'; message.setAttribute('role', 'status');
const vehicle = document.createElement('section'); vehicle.className = 'card emergency-driver-card';
const vehicleTitle = document.createElement('h2'); vehicleTitle.textContent = 'Vehicle';
const vehicleStatus = document.createElement('p'); vehicleStatus.className = 'emergency-muted';
const controls = document.createElement('div'); controls.className = 'emergency-actions';
const availableButton = button('Set available'); const offlineButton = button('Go offline'); const locationButton = button('Use browser location'); const demoLocationButton = button('Use demo location');
controls.append(availableButton, offlineButton, locationButton, demoLocationButton);
vehicle.append(vehicleTitle, vehicleStatus, controls);
const offerCard = document.createElement('section'); offerCard.className = 'card emergency-driver-card';
offerCard.setAttribute('aria-labelledby', 'offer-title');
const offerTitle = document.createElement('h2'); offerTitle.id = 'offer-title'; offerTitle.textContent = 'Incoming offer';
const offerBody = document.createElement('div'); offerBody.className = 'emergency-driver-content';
const countdown = document.createElement('p'); countdown.className = 'emergency-countdown'; countdown.setAttribute('aria-live', 'polite');
const offerActions = document.createElement('div'); offerActions.className = 'emergency-actions'; const accept = button('Accept'); const reject = button('Reject'); offerActions.append(accept, reject);
offerCard.append(offerTitle, offerBody, countdown, offerActions);
const tripCard = document.createElement('section'); tripCard.className = 'card emergency-driver-card';
const tripTitle = document.createElement('h2'); tripTitle.textContent = 'Active trip';
const tripBody = document.createElement('div'); tripBody.className = 'emergency-driver-content';
const nextStep = button(''); const release = button('Release vehicle');
tripCard.append(tripTitle, tripBody, nextStep, release);
wrapper.append(title, notice, message, vehicle, offerCard, tripCard); main.replaceChildren(wrapper);
let ambulance = null; let currentOffer = null; let offerSeconds = 0; let offerTimer = null; let currentTrip = null; let polling = null;
const DEMO_POINT = { lat: 17.43, lng: 78.45, heading: 0, speed: 0 };

if (user.role !== 'driver') {
  message.textContent = 'This page is for driver accounts.'; [availableButton, offlineButton, locationButton, demoLocationButton, accept, reject, nextStep, release].forEach((x) => { x.disabled = true; });
} else {
  [vehicle, offerCard, tripCard].forEach((x) => x.hidden = false);
  offerCard.hidden = true; tripCard.hidden = true;
  await refresh(); polling = setInterval(refresh, 3000);
}

function button(label) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary emergency-control'; b.textContent = label; return b; }
function addLine(target, label, value) { const p = document.createElement('p'); p.textContent = `${label}: ${value ?? 'Not provided'}`; target.append(p); }
function showError(err) { message.textContent = err.status === 404 ? 'No driver vehicle is linked to this account yet.' : err.message; }
async function refresh() {
  if (user.role !== 'driver') return;
  try {
    const [me, offerResult, tripResult] = await Promise.all([api('/driver/me'), api('/driver/offers'), api('/driver/trips/active')]);
    ambulance = me.ambulance; vehicleStatus.textContent = `${ambulance.registrationNumber}, ${ambulance.type}, ${ambulance.status}.`;
    if (offerResult.offer && !currentTrip) renderOffer(offerResult.offer); else { offerCard.hidden = true; currentOffer = null; clearInterval(offerTimer); }
    if (tripResult.emergency) renderTrip(tripResult.emergency); else if (currentTrip?.status === 'completed') renderTrip(currentTrip); else { tripCard.hidden = true; currentTrip = null; }
    message.textContent = '';
  } catch (err) { showError(err); }
}
function renderOffer(offer) {
  if (currentOffer?.emergencyId !== offer.emergencyId) {
    clearInterval(offerTimer); currentOffer = offer; offerSeconds = offer.secondsRemaining;
    offerBody.replaceChildren();
    addLine(offerBody, 'Situation', offer.emergencyType); addLine(offerBody, 'Pickup address', offer.address || `${offer.location.lat.toFixed(4)}, ${offer.location.lng.toFixed(4)}`);
    addLine(offerBody, 'Conscious', offer.conscious === null ? 'Not sure' : offer.conscious ? 'Yes' : 'No'); addLine(offerBody, 'People', offer.patientCount); addLine(offerBody, 'Notes', offer.notes || 'None');
    if (offer.medicalId) { const title = document.createElement('h3'); title.textContent = 'Shared Medical ID'; offerBody.append(title); addLine(offerBody, 'Name', offer.medicalId.fullName); addLine(offerBody, 'Blood group', offer.medicalId.bloodGroup); addLine(offerBody, 'Allergies', offer.medicalId.allergies?.join(', ')); }
    offerCard.hidden = false; accept.disabled = false; reject.disabled = false;
    countdown.textContent = `Offer expires in ${offerSeconds} seconds.`;
    offerTimer = setInterval(() => { offerSeconds = Math.max(0, offerSeconds - 1); countdown.textContent = offerSeconds ? `Offer expires in ${offerSeconds} seconds.` : 'Offer expired.'; if ([10, 5].includes(offerSeconds)) live.textContent = `Offer expires in ${offerSeconds} seconds.`; if (!offerSeconds) clearInterval(offerTimer); }, 1000);
  }
}
const nextStatus = { assigned: ['en_route', 'Mark en route'], en_route: ['arrived', 'Mark arrived'], arrived: ['picked_up', 'Confirm patient picked up'], picked_up: ['at_hospital', 'Mark at hospital'], at_hospital: ['completed', 'Complete trip'] };
function renderTrip(trip) {
  currentTrip = trip; tripCard.hidden = false; offerCard.hidden = true; tripBody.replaceChildren();
  addLine(tripBody, 'Status', trip.status); addLine(tripBody, 'Pickup', trip.location ? `${trip.location.lat.toFixed(5)}, ${trip.location.lng.toFixed(5)}` : 'Not available');
  const move = nextStatus[trip.status]; nextStep.hidden = !move; release.hidden = trip.status !== 'completed';
  if (move) { nextStep.textContent = move[1]; nextStep.disabled = false; nextStep.dataset.status = move[0]; }
  live.textContent = `Trip status: ${trip.status.replaceAll('_', ' ')}.`;
}

accept.addEventListener('click', () => offerAction('accept'));
reject.addEventListener('click', () => offerAction('reject'));
async function offerAction(action) {
  if (!currentOffer) return; accept.disabled = true; reject.disabled = true;
  try { await api(`/driver/offers/${currentOffer.emergencyId}/${action}`, { method: 'POST', body: {} }); currentOffer = null; await refresh(); }
  catch (err) { accept.disabled = false; reject.disabled = false; message.textContent = err.message; }
}
nextStep.addEventListener('click', async () => {
  if (!currentTrip || !nextStep.dataset.status) return; nextStep.disabled = true;
  try { const { emergency } = await api(`/driver/trips/${currentTrip.id}/status`, { method: 'POST', body: { status: nextStep.dataset.status } }); renderTrip(emergency); if (emergency.status !== 'completed') await refresh(); }
  catch (err) { nextStep.disabled = false; message.textContent = err.message; }
});
release.addEventListener('click', async () => {
  release.disabled = true;
  try { await api('/driver/me/release', { method: 'POST', body: {} }); currentTrip = null; tripCard.hidden = true; await refresh(); }
  catch (err) { release.disabled = false; message.textContent = err.message; }
});
async function setStatus(status) {
  if (status === 'available' && !ambulance?.lat) { await sendLocation(DEMO_POINT); }
  try { await api('/driver/me/status', { method: 'PUT', body: { status } }); await refresh(); }
  catch (err) { message.textContent = err.message; }
}
availableButton.addEventListener('click', () => setStatus('available'));
offlineButton.addEventListener('click', () => setStatus('offline'));
locationButton.addEventListener('click', () => {
  if (!navigator.geolocation) { message.textContent = 'Browser location is not available. Use demo location mode.'; return; }
  message.textContent = 'Waiting for browser location permission.';
  navigator.geolocation.getCurrentPosition(({ coords }) => sendLocation({ lat: coords.latitude, lng: coords.longitude, heading: Number.isFinite(coords.heading) ? Math.round(coords.heading) : null, speed: coords.speed ? coords.speed * 3.6 : 0 }), () => { message.textContent = 'Location was not shared. Try demo location mode.'; }, { enableHighAccuracy: true, timeout: 8_000 });
});
demoLocationButton.addEventListener('click', () => sendLocation(DEMO_POINT));
async function sendLocation(point) {
  try { await api('/driver/me/location', { method: 'PUT', body: point }); message.textContent = point === DEMO_POINT ? 'Demo location set.' : 'Location updated.'; await refresh(); }
  catch (err) { message.textContent = err.message; }
}
window.addEventListener('beforeunload', () => { clearInterval(polling); clearInterval(offerTimer); });
