import { api } from '../api.js';

const form = document.querySelector('#sos-form');
const error = document.querySelector('#form-error');
const locateButton = document.querySelector('#locate');
const locationStatus = document.querySelector('#location-status');
const live = document.querySelector('#live');
const undoPanel = document.querySelector('#undo-panel');
const cancelButton = document.querySelector('#cancel-request');
const accountLink = document.querySelector('#account-link');
const HYDERABAD_APPROX = { lat: 17.385, lng: 78.4867 };
let currentUser = null;
let currentLocation = null;
let currentRequest = null;
let undoTimer = null;
let redirectTimer = null;

try { currentUser = await api('/auth/me'); } catch { currentUser = null; }
// The button stays off until this point: an earlier tap would reload the page, or stop on the hidden
// guest phone field of a signed-in patient, and lose the request with no message.
document.querySelector('#send-request').disabled = false;
if (currentUser) { accountLink.href = currentUser.role === 'driver' ? '/driver/' : currentUser.role === 'admin' ? '/admin/' : '/dashboard/'; accountLink.textContent = 'Account'; document.querySelector('#guest-phone-wrap').hidden = true; }

locateButton.addEventListener('click', () => {
  if (!navigator.geolocation) { locationStatus.textContent = 'Location is not available in this browser. Enter an address to continue.'; return; }
  locateButton.disabled = true;
  locationStatus.textContent = 'Checking your location…';
  navigator.geolocation.getCurrentPosition((position) => {
    currentLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    locationStatus.textContent = `Location ready, accuracy about ${Math.round(position.coords.accuracy)} metres.`;
    locateButton.disabled = false;
  }, () => {
    currentLocation = null;
    locationStatus.textContent = 'Location was not shared. Enter an address or landmark. Demo routing uses an approximate Hyderabad point.';
    locateButton.disabled = false;
  }, { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.hidden = true;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const address = String(data.get('address') || '').trim();
  if (!currentLocation && !address) { error.textContent = 'Allow location or enter an address to continue.'; error.hidden = false; return; }
  const body = {
    emergencyType: data.get('emergencyType'), forSelf: data.get('forSelf') === 'true',
    conscious: data.get('conscious') === '' ? null : data.get('conscious') === 'true', patientCount: Number(data.get('patientCount')),
    ambulanceType: data.get('ambulanceType'), notes: String(data.get('notes') || '').trim(), location: currentLocation || HYDERABAD_APPROX,
    address, ...(currentUser ? {} : { guestPhone: String(data.get('guestPhone') || '').trim() }),
  };
  const send = document.querySelector('#send-request'); send.disabled = true; send.textContent = 'Sending request…';
  try {
    const result = await api('/emergencies', { method: 'POST', body });
    currentRequest = { id: result.emergency.id, token: result.trackingToken, user: Boolean(currentUser) };
    undoPanel.hidden = false; live.textContent = 'Demo request sent. Cancel is available for five seconds.';
    send.hidden = true; form.querySelectorAll('input,select,textarea,fieldset button').forEach((el) => { el.disabled = true; });
    let seconds = 5;
    const message = document.querySelector('#undo-message');
    message.textContent = `Demo request sent. Cancel available for ${seconds} seconds.`;
    undoTimer = window.setInterval(() => {
      seconds -= 1;
      if (seconds > 0) { message.textContent = `Demo request sent. Cancel available for ${seconds} seconds.`; live.textContent = `Cancel request available for ${seconds} seconds.`; }
      else { clearInterval(undoTimer); undoTimer = null; message.textContent = 'Opening demo status.'; redirectTimer = window.setTimeout(openStatus, 250); }
    }, 1_000);
  } catch (err) {
    error.textContent = err.status === 422 ? Object.values(err.fields || {}).join(' ') : err.message;
    error.hidden = false; send.disabled = false; send.textContent = 'Send demo request';
  }
});

function openStatus() {
  if (!currentRequest) return;
  const params = new URLSearchParams({ token: currentRequest.token });
  if (currentRequest.user) params.set('id', currentRequest.id);
  location.assign(`${currentRequest.user ? '/emergency/' : '/track/'}?${params}`);
}

cancelButton.addEventListener('click', async () => {
  if (!currentRequest) return;
  clearInterval(undoTimer); clearTimeout(redirectTimer); undoTimer = null; redirectTimer = null;
  cancelButton.disabled = true;
  try {
    const path = currentRequest.user ? `/emergencies/${currentRequest.id}/cancel` : `/track/${currentRequest.token}/cancel`;
    await api(path, { method: 'POST', body: {} });
    currentRequest = null; document.querySelector('#undo-message').textContent = 'Demo request cancelled. No contact message was sent.';
    cancelButton.hidden = true; live.textContent = 'Demo request cancelled.';
  } catch (err) {
    document.querySelector('#undo-message').textContent = `${err.message} Call 112 if you need immediate help.`;
    live.textContent = 'The request could not be cancelled.';
  }
});
