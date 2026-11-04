import { api } from '../api.js';
import { createRealMap } from '../real-map.js';

const token = new URLSearchParams(location.search).get('token') || '';
const statusNode = document.querySelector('#tracking-status');
const etaNode = document.querySelector('#tracking-eta');
const positionNode = document.querySelector('#tracking-position');
const errorNode = document.querySelector('#tracking-error');
const map = createRealMap({ height: 300, label: 'Map showing the demo ambulance position' });
document.querySelector('#tracking-map').append(map);
const statusText = { matching: 'Finding a demo crew', assigned: 'Crew accepted', en_route: 'Crew travelling', arrived: 'Crew arrived', picked_up: 'Patient picked up', at_hospital: 'Trip at hospital', completed: 'Demo trip complete', cancelled: 'Request cancelled', no_match: 'No demo crew accepted' };
let delay = 3000; let timer = null; let stopped = false;

async function refresh() {
  if (stopped) return;
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) { expired(); return; }
  try {
    const data = await api(`/track/${encodeURIComponent(token)}`, { retry: false });
    statusNode.textContent = statusText[data.status] || 'Demo status updated.';
    etaNode.textContent = Number.isFinite(data.etaSeconds) ? `${data.etaIsEstimate ? 'Estimated arrival' : 'Route ETA'}: about ${Math.max(1, Math.ceil(data.etaSeconds / 60))} min${data.etaIsEstimate ? ' (estimate)' : ''}.` : '';
    const p = data.ambulance;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      map.update({ pins: [{ lat: p.lat, lng: p.lng, label: 'Demo crew', kind: 'emergency' }] });
      positionNode.textContent = `Demo crew position: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}.`;
    } else { map.update({ pins: [] }); positionNode.textContent = 'Demo crew position is not available yet.'; }
    errorNode.hidden = true; delay = 3000;
    if (['completed', 'cancelled', 'no_match'].includes(data.status)) { stopped = true; return; }
    timer = setTimeout(refresh, delay);
  } catch (err) {
    if (err.status === 404) { expired(); return; }
    errorNode.hidden = false; errorNode.textContent = 'Reconnecting. Demo status will be checked again.';
    delay = Math.min(delay * 2, 30_000); timer = setTimeout(refresh, delay);
  }
}
function expired() {
  stopped = true; clearTimeout(timer);
  statusNode.textContent = 'This tracking link has expired or is not valid.';
  etaNode.textContent = ''; positionNode.textContent = ''; errorNode.textContent = 'Ask the person who shared the link for a current one.'; errorNode.hidden = false; map.update({ pins: [] });
}
refresh();
